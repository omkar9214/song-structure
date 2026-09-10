/* ═══ Cloud sync (Supabase) ════════════════════════════════════════
   Local-first. The app keeps working with no network exactly as before;
   this layer copies songs to Postgres and attachments to Storage, and
   pulls them back on another device. Newest write per song wins.
   ================================================================= */
const Cloud = (() => {
  const cfg = window.SUPABASE || {};
  let sb = null, user = null, state = 'off', pending = new Set(), timer = null;
  const subs = [];

  const notify = () => subs.forEach(f => f(state, user));
  const set = s => { if (s !== state) { state = s; notify(); } };

  async function init() {
    if (!cfg.url || !cfg.key) { set('off'); return; }
    if (!window.supabase) { set('nolib'); return; }
    /* Implicit, not PKCE: the sign-in link routinely opens in a different
       browser from the one that asked for it, and PKCE keeps its verifier in
       the requesting browser's storage — so the exchange fails and you land
       signed out. Implicit carries the session in the URL itself. */
    sb = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' }
    });
    const hint = readUrlHint();
    let { data } = await sb.auth.getSession();
    /* detectSessionInUrl finishes asynchronously — give it a moment when the
       URL actually carries a token, instead of reporting "signed out" early */
    if (!data.session && hint.token) {
      for (let i = 0; i < 20 && !data.session; i++) {
        await new Promise(r => setTimeout(r, 100));
        ({ data } = await sb.auth.getSession());
      }
    }
    user = data.session ? data.session.user : null;
    if (hint.error) onError(hint.error);
    if (hint.token || hint.error) history.replaceState({}, '', location.pathname + location.search);
    sb.auth.onAuthStateChange((_e, sess) => {
      const next = sess ? sess.user : null;
      const changed = (next && next.id) !== (user && user.id);
      user = next;
      if (user && changed) syncAll(); else if (!user) set('out');
    });
    if (user) await syncAll(); else set('out');
  }

  /* what came back on the sign-in link */
  function readUrlHint() {
    const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const q = new URLSearchParams(location.search);
    return {
      token: h.get('access_token') || q.get('code') || null,
      error: h.get('error_description') || q.get('error_description') || null
    };
  }
  let errHandler = null;
  const onError = msg => errHandler && errHandler(msg);

  /* ── auth ───────────────────────────────────────────────────── */
  async function signIn(email) {
    const redirect = location.origin + location.pathname;
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: redirect }
    });
    if (error) throw error;
  }
  /* Password sign-in. No email involved, so it is not subject to the
     mailer's rate limit and it works in any browser. */
  async function signInPassword(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user || null;
    if (user) await syncAll();
    return !!user;
  }
  async function signUpPassword(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    user = data.session ? data.session.user : null;
    if (user) await syncAll();
    return { signedIn: !!user, needsConfirm: !data.session };
  }
  /* set or change the password of the account already signed in here */
  async function setPassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    return true;
  }

  async function signOut() { await sb.auth.signOut(); user = null; set('out'); }

  /* another tab signed in or out — pick that up without a reload */
  async function refresh() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const next = data.session ? data.session.user : null;
    if ((next && next.id) === (user && user.id)) return;
    user = next;
    if (user) await syncAll(); else set('out');
  }

  /* fallback for when the link cannot come back to this browser at all:
     paste the 6-digit code from the same email */
  async function verifyCode(email, token) {
    const { data, error } = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
    if (error) throw error;
    user = data.session ? data.session.user : null;
    if (user) await syncAll();
    return !!user;
  }

  /* ── songs ──────────────────────────────────────────────────── */
  const stamp = so => so.updated || 0;

  async function syncAll() {
    if (!user) return;
    set('syncing');
    try {
      const { data: rows, error } = await sb.from('songs').select('id,data,updated_at');
      if (error) throw error;

      const local = state_songs();
      const byId = Object.fromEntries(local.map(s => [s.id, s]));
      let changed = false;

      /* remote → local */
      for (const row of rows || []) {
        const mine = byId[row.id];
        const remote = row.data;
        if (!mine) { local.push(remote); changed = true; }
        else if (stamp(remote) > stamp(mine)) { Object.assign(mine, remote); changed = true; }
      }

      /* local → remote (anything missing there, or newer here) */
      const remoteById = Object.fromEntries((rows || []).map(r => [r.id, r.data]));
      const up = local.filter(s => {
        const r = remoteById[s.id];
        return !r || stamp(s) > stamp(r);
      });
      if (up.length) await upsert(up);

      if (changed) onPulled();
      set('ok');
    } catch (e) {
      console.warn('[cloud] sync failed', e);
      set('error');
    }
  }

  async function upsert(songs) {
    const rows = songs.map(s => ({
      owner: user.id, id: s.id, data: s,
      updated_at: new Date(s.updated || Date.now()).toISOString()
    }));
    const { error } = await sb.from('songs').upsert(rows, { onConflict: 'owner,id' });
    if (error) throw error;
  }

  /* called on every local save — batched, so typing does not hammer the API */
  function touch(so) {
    if (!user || !so) return;
    pending.add(so.id);
    set('pending');
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }
  async function flush() {
    if (!user || !pending.size) return;
    const ids = [...pending]; pending.clear();
    const songs = state_songs().filter(s => ids.includes(s.id));
    if (!songs.length) return set('ok');
    set('syncing');
    try { await upsert(songs); set('ok'); }
    catch (e) { console.warn('[cloud] push failed', e); set('error'); }
  }

  async function remove(id) {
    if (!user) return;
    await sb.from('songs').delete().eq('owner', user.id).eq('id', id);
  }

  /* ── media ──────────────────────────────────────────────────── */
  const path = id => `${user.id}/${id}`;

  async function upload(ref) {
    if (!user) return false;
    try {
      const rec = await Media.get(ref.id);
      if (!rec) return false;
      const { error } = await sb.storage.from('media')
        .upload(path(ref.id), rec.blob, { contentType: rec.type || 'application/octet-stream', upsert: true });
      if (error && error.statusCode !== '409') throw error;
      ref.remote = true;
      return true;
    } catch (e) { console.warn('[cloud] upload failed', e); return false; }
  }

  /* pull a file this device has never seen, and cache it locally */
  async function fetchMedia(ref) {
    if (!user) return null;
    try {
      const { data, error } = await sb.storage.from('media').download(path(ref.id));
      if (error) throw error;
      await Media.cache(ref.id, data, ref);
      return data;
    } catch (e) { console.warn('[cloud] download failed', e); return null; }
  }

  async function removeMedia(id) {
    if (!user) return;
    try { await sb.storage.from('media').remove([path(id)]); } catch (_) {}
  }

  /* upload anything attached before sign-in */
  async function backfill() {
    if (!user) return;
    const owners = [];
    state_songs().forEach(so => {
      owners.push(so);
      (so.sections || []).forEach(sec => { owners.push(sec); sec.bars.forEach(b => owners.push(b)); });
    });
    let n = 0;
    for (const o of owners) for (const ref of o.media || []) {
      if (!ref.remote && await upload(ref)) n++;
    }
    if (n) { onPulled(); flush(); }
    return n;
  }

  return {
    init, signIn, signInPassword, signUpPassword, setPassword, signOut, verifyCode, refresh, syncAll,
    onError: f => { errHandler = f; }, touch, flush, remove, upload, fetchMedia, removeMedia, backfill,
    on: f => { subs.push(f); f(state, user); },
    get state() { return state; },
    get user() { return user; },
    get ready() { return !!(sb && user); }
  };
})();
