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
  let errHandler = null, conflictHandler = null;
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

  /* A song with nothing written in it is never sent. Opening the app on a new
     device makes one to put on screen, and pushing it is what left an
     "Untitled" in the account for every device and every cleared browser.
     The test itself lives in app.js — it errs entirely towards keeping. */
  const blank = so => !!(window.songIsBlank && window.songIsBlank(so));
  const worthSending = list => list.filter(s => !blank(s));

  /* Setlists have no table of their own, and adding one would mean asking a
     musician to run SQL before a gig. They ride in the songs table instead,
     as a single row marked __setlists — filtered out of the song list at both
     ends, and shaped like an empty song so an out-of-date client shows a
     harmless blank row rather than falling over. */
  /* Who moved since the version this device last agreed with the server?
       'none'   nobody — just refresh the base
       'remote' only they moved — take theirs
       'local'  only we moved — push ours
       'both'   both moved — keep both, never discard
     With no base yet (the first sync after this device learned to track one)
     it falls back to newest-wins, which is what it always did, so an upgrade
     does not manufacture a pile of duplicates. */
  function decide(mine, remote, base) {
    const known = base != null;
    const localMoved  = known ? stamp(mine)   > base : stamp(mine)   > stamp(remote);
    const remoteMoved = known ? stamp(remote) > base : stamp(remote) > stamp(mine);
    if (localMoved && remoteMoved) return 'both';
    if (remoteMoved) return 'remote';
    if (localMoved)  return 'local';
    return 'none';
  }

  /* Postgres will not let one statement touch the same key twice */
  const dedupe = songs => {
    const by = new Map();
    songs.forEach(s => by.set(s.id, s));
    return [...by.values()];
  };

  const LIST_ROW = '__setlists';
  const isListRow = d => !!(d && d.__setlists);
  function listPayload() {
    return { id: LIST_ROW, __setlists: true, title: '', artist: '', key: '', bpm: '', time: '4/4',
             sections: [], media: [], setlists: state_lists(), updated: state_lists_stamp() };
  }

  async function syncAll() {
    if (!user) return;
    set('syncing');
    try {
      const { data: rows, error } = await sb.from('songs').select('id,data,updated_at');
      if (error) throw error;

      const local = state_songs();
      const byId = Object.fromEntries(local.map(s => [s.id, s]));
      let changed = false;
      const toPush = [], kept = [], seen = new Set();

      /* remote → local, one song at a time, against this device's base stamp */
      let remoteLists = null;
      for (const row of rows || []) {
        const remote = row.data;
        if (isListRow(remote)) { remoteLists = remote; continue; }
        seen.add(row.id);
        const mine = byId[row.id];
        if (!mine) { local.push(remote); set_base(row.id, stamp(remote)); changed = true; continue; }

        const d = decide(mine, remote, base_of(row.id));
        if (d === 'both') {
          const copy = keep_both(mine, remote);     /* their version, kept as its own song */
          mine.updated = Date.now();                /* the one you are holding stays live */
          toPush.push(mine, copy); kept.push(copy.title); changed = true;
        } else if (d === 'remote') {
          Object.assign(mine, remote); set_base(row.id, stamp(remote)); changed = true;
        } else if (d === 'local') {
          toPush.push(mine);
        } else {
          set_base(row.id, stamp(mine));
        }
      }
      if (remoteLists && stamp(remoteLists) > state_lists_stamp()) {
        take_lists(remoteLists.setlists || [], stamp(remoteLists));
        changed = true;
      }

      /* songs that only exist here — an empty one is not worth a row */
      for (const s of local) if (!seen.has(s.id) && !blank(s)) toPush.push(s);

      const once = dedupe(toPush);      /* one row per id, or the upsert is rejected */
      if (once.length) {
        await upsert(once);
        once.forEach(s => set_base(s.id, stamp(s)));
      }
      if (!remoteLists || state_lists_stamp() > stamp(remoteLists)) {
        if (state_lists().length || remoteLists) await upsert([listPayload()]);
      }

      if (changed) onPulled();
      if (kept.length && conflictHandler) conflictHandler(kept);
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
    if (!user || !so || blank(so)) return;      /* nothing written yet — nothing to send */
    pending.add(so.id);
    set('pending');
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }
  /* the same batching, for the setlists row */
  let listsDirty = false;
  function touchLists() {
    if (!user) return;
    listsDirty = true;
    set('pending');
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }
  async function flush() {
    if (!user || (!pending.size && !listsDirty)) return;
    const ids = [...pending]; pending.clear();
    const songs = worthSending(state_songs().filter(s => ids.includes(s.id)));
    const lists = listsDirty ? [listPayload()] : [];
    listsDirty = false;
    if (!songs.length && !lists.length) return set('ok');
    set('syncing');
    try { await pushSongs(songs, lists); set('ok'); }
    catch (e) { console.warn('[cloud] push failed', e); set('error'); }
  }

  /* A push is the other place a song can be trampled: this device may have
     been holding a stale copy while the other one moved. Look before writing. */
  async function pushSongs(songs, extra) {
    const out = (extra || []).slice(), kept = [];
    songs = worthSending(songs || []);
    if (songs.length) {
      const { data: rows, error } = await sb.from('songs').select('id,data').in('id', songs.map(s => s.id));
      if (error) throw error;
      const remoteById = Object.fromEntries((rows || []).map(r => [r.id, r.data]));
      for (const s of songs) {
        const r = remoteById[s.id];
        if (r && decide(s, r, base_of(s.id)) === 'both') {
          const copy = keep_both(s, r);
          s.updated = Date.now();
          out.push(copy); kept.push(copy.title);
        }
        out.push(s);
      }
    }
    const once = dedupe(out);
    if (!once.length) return;
    await upsert(once);
    once.forEach(s => { if (!isListRow(s)) set_base(s.id, stamp(s)); });
    if (kept.length) {
      onPulled();
      if (conflictHandler) conflictHandler(kept);
    }
  }

  async function remove(id) {
    forget_base(id);
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
    const tracks = [];
    state_songs().forEach(so => {
      owners.push(so);
      if (so.track) tracks.push(so.track);          /* the song's own mp3 counts */
      (so.sections || []).forEach(sec => { owners.push(sec); sec.bars.forEach(b => owners.push(b)); });
    });
    let n = 0;
    for (const ref of tracks) if (!ref.remote && await upload(ref)) n++;
    for (const o of owners) for (const ref of o.media || []) {
      if (!ref.remote && await upload(ref)) n++;
    }
    if (n) { onPulled(); flush(); }
    return n;
  }

  return {
    init, signIn, signInPassword, signUpPassword, setPassword, signOut, verifyCode, refresh, syncAll,
    onError: f => { errHandler = f; }, onConflict: f => { conflictHandler = f; },
    touch, touchLists, flush, remove, upload, fetchMedia, removeMedia, backfill,
    on: f => { subs.push(f); f(state, user); },
    get state() { return state; },
    get user() { return user; },
    get ready() { return !!(sb && user); }
  };
})();

/* A top-level `const` is a script-scoped binding, not a property of window —
   so every `window.Cloud` test elsewhere was quietly false, and save() never
   queued anything for sync. Publish it explicitly. */
window.Cloud = Cloud;
