/* ═══ Song Structure ═══════════════════════════════════════════════
   Bars are laid out like sheet music: 4 measures to a row, sharing
   barlines. Above each row sits a slim region strip (Reaper-style)
   carrying the section name, and above that a marker lane for cues.
   ================================================================= */

const KEY = 'song-structure.v1';
const PER_ROW = 4;
const COLORS = ['#2f5fa8','#b0491e','#2b7a4b','#6b46c1','#a3226b','#8a6212','#1f6f70','#5a5f6b'];
const KIND_ICON = { image: 'image', audio: 'audio', video: 'video', file: 'file' };
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const $  = s => document.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
/* pack blocks into rows of PER_ROW bars of time, never splitting a block */
function packRows(bars, startBar) {
  const rows = []; let row = [], used = 0, no = startBar;
  bars.forEach((bar, i) => {
    const span = Math.max(1, Math.min(PER_ROW, bar.span || 1));
    if (used + span > PER_ROW && row.length) { rows.push({ items: row, used }); row = []; used = 0; }
    row.push({ bar, i, span, col: used, no });
    used += span; no += span;
  });
  rows.push({ items: row, used });
  return rows;
}

/* ─── state ─────────────────────────────────────────────────────── */
let state = migrate(load());

function blankSong() {
  return { id: uid('s'), title: '', artist: '', key: '', bpm: 120, time: '4/4', sections: [], media: [], updated: Date.now() };
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.songs && raw.songs.length) return raw;
  } catch (_) {}
  const s = blankSong();
  return { songs: [s], currentId: s.id };
}
function save(quiet) {
  song().updated = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
  if (!quiet && window.Cloud) Cloud.touch(song());
}

/* Setlists live beside the songs in the same record. They are written with
   saveLists(), not save(): editing a setlist must not restamp the open song. */
function saveLocal() { localStorage.setItem(KEY, JSON.stringify(state)); }
function saveLists() {
  state.setlistsUpdated = Date.now();
  saveLocal();
  if (window.Cloud && Cloud.touchLists) Cloud.touchLists();
}

/* ─── what each device last agreed with the server ──────────────
   Sync used to be newest-wins on the whole song: edit on the laptop, edit the
   same song later on the iPad, and the iPad's copy replaced the laptop's —
   silently, whole. So each device remembers the version of each song it last
   agreed with the server on. If both sides moved on from that point, the copy
   on the device you are holding stays live and the other one is kept as its
   own song. Nothing is ever thrown away. This map is per device and never
   leaves it — it is not part of the song. */
function base_of(id) { return state.syncBase ? state.syncBase[id] : undefined; }
function set_base(id, stamp) { (state.syncBase = state.syncBase || {})[id] = stamp || 0; saveLocal(); }
function forget_base(id) { if (state.syncBase) { delete state.syncBase[id]; saveLocal(); } }

/* the other device's version, kept beside yours rather than thrown away */
function keep_both(mine, remote) {
  const copy = JSON.parse(JSON.stringify(remote));
  copy.id = uid('s');
  const when = new Date(remote.updated || Date.now())
    .toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  copy.title = `${remote.title || 'Untitled'} (other device, ${when})`;
  copy.updated = Date.now();
  state.songs.push(copy);
  return copy;
}

/* the cloud layer reads and writes the setlists through these three */
function state_lists() { return state.setlists; }
function state_lists_stamp() { return state.setlistsUpdated || 0; }
function take_lists(lists, stamp) {
  state.setlists = Array.isArray(lists) ? lists : [];
  state.setlists.forEach(l => { if (!Array.isArray(l.songs)) l.songs = []; });
  state.setlistsUpdated = Number(stamp) || 0;     /* never invent a stamp: it would outrank the server */
  if (!listById(state.currentListId)) state.currentListId = null;
}

/* the cloud layer reads and writes through these two */
function state_songs() { return state.songs; }
function onPulled() {
  localStorage.setItem(KEY, JSON.stringify(state));
  render();
  if (!$('#drawer').hidden) showTab(drawerTab);
  if (typeof gigIsOn === 'function' && gigIsOn()) renderGig();
}
const song = () => state.songs.find(s => s.id === state.currentId) || state.songs[0];
const beatsPerBar = () => parseInt(song().time.split('/')[0], 10) || 4;

/* A block occupies `span` bars of time and shows `beats.length` chord fields.
   One field by default — the chord written big across the whole bar. */
function newBar() { return { id: uid('b'), span: 1, beats: [''], lyric: '', media: [] }; }
const spanOf = b => Math.max(1, Math.min(PER_ROW, b.span || 1));
const barCount = sec => sec.bars.reduce((n, b) => n + spanOf(b), 0);

/* Older songs stored one slot per beat; keep the slots only where they carry
   information, so a bar with a single chord becomes a single big field. */
function migrate(st) {
  if (!Array.isArray(st.setlists)) st.setlists = [];      /* added 2026-09 — never drops songs */
  if (!st.syncBase || typeof st.syncBase !== 'object') st.syncBase = {};
  st.songs = st.songs.filter(so => !so.__setlists);       /* the synced setlists row is not a song */
  if (!st.songs.length) st.songs = [blankSong()];
  st.setlists.forEach(l => { if (!Array.isArray(l.songs)) l.songs = []; });
  st.songs.forEach(so => (so.sections || []).forEach(sec => sec.bars.forEach(b => {
    if (b.span == null) b.span = 1;
    delete b.split;
    if (b.beats.filter(Boolean).length <= 1) {
      const v = b.beats.find(Boolean) || '';
      b.beats = b.beats[0] === v || !v ? [v] : b.beats.slice(0, b.beats.findIndex(Boolean) + 1);
    }
    if (!b.beats.length) b.beats = [''];
  })));
  return st;
}
function newSection(name, count, repeat, color, note) {
  return { id: uid('x'), name, repeat: repeat || 1, color: color || COLORS[0], note: note || '',
           collapsed: false, cues: [], media: [], bars: Array.from({ length: count }, () => newBar()) };
}
const findSection = id => song().sections.find(s => s.id === id);

/* ─── render ────────────────────────────────────────────────────── */
function render() {
  const s = song();
  $('#song-title').value  = s.title;
  $('#song-artist').value = s.artist;
  $('#song-key').value    = s.key;
  $('#song-bpm').value    = s.bpm || '';
  $('#song-time').value   = s.time;
  document.title = s.title ? `${s.title} — Song Structure` : 'Song Structure';

  renderTrack();
  renderRoadmap();

  const host = $('#sections');
  host.innerHTML = '';
  if (!s.sections.length) {
    const e = el('div', 'empty');
    e.innerHTML = '<b>No regions yet.</b><br>Start with <i>Intro</i>, or jump straight to a <i>Verse</i> — add one below.';
    host.appendChild(e);
    return;
  }
  let barNo = 1;
  s.sections.forEach((sec, i) => {
    host.appendChild(renderSection(sec, i, barNo));
    barNo += barCount(sec);
  });
  fitAllChords();
}

/* ─── one sound at a time ───────────────────────────────────────
   A detached <audio> keeps playing — removing it from the DOM does not
   stop it — so opening a second clip left the first one running under it.
   Every player registers here and the previous one is paused. */
const Sound = {
  current: null,
  claim(node) {
    if (this.current && this.current !== node) { try { this.current.pause(); } catch (_) {} }
    this.current = node;
  },
  stop(node) {
    if (!node) return;
    try { node.pause(); } catch (_) {}
    if (this.current === node) this.current = null;
  },
  stopIn(host) { if (host) host.querySelectorAll('audio,video').forEach(n => Sound.stop(n)); }
};
/* play does not bubble, but it does capture */
document.addEventListener('play', e => Sound.claim(e.target), true);

/* ─── the song's own recording ──────────────────────────────────
   One mp3 for the whole chart. Clips of it get attached to regions and
   bars, so the same file answers "how does this part go?" everywhere. */
function renderTrack() {
  const host = $('#track-bar');
  /* the whole bar is rebuilt on every render; carry the playhead over rather
     than leaving an invisible player running behind the new one */
  const old = host.querySelector('audio');
  const was = old ? { at: old.currentTime, playing: !old.paused } : null;
  Sound.stopIn(host);
  host.innerHTML = '';
  const t = song().track;

  if (!t) {
    const add = el('button', 'track-add');
    add.type = 'button';
    add.append(icon('audio', 15), el('span', null, 'Add the song (mp3)'));
    add.dataset.tip = 'Attach the recording this chart is of — then clip parts of it onto any region or bar';
    add.onclick = pickTrack;
    host.appendChild(add);
    return;
  }

  const row = el('div', 'track-row');
  row.append(icon('audio', 16));
  const name = el('div', 'track-name', t.name);
  const meta = el('span', 'track-meta', t.duration ? fmtTime(t.duration) : '');
  const player = el('audio', 'track-audio');
  player.controls = true; player.preload = 'metadata';
  bindVolume(player, t);
  const warn = el('div', 'track-warn');
  warn.hidden = true;
  trackURL(t).then(u => {
    if (u) {
      player.src = u;
      if (was && was.at) player.onloadedmetadata = () => { player.currentTime = was.at; };
      if (was && was.playing) player.play().catch(() => {});
      return;
    }
    player.hidden = true;
    warn.textContent = trackMissingReason(t);
    warn.hidden = false;
  });

  const clip = el('button', 'btn ghost track-btn');
  clip.type = 'button';
  clip.append(icon('scissors', 14), el('span', null, 'Clip'));
  clip.dataset.tip = 'Cut a piece of this song and attach it to a region or bar';
  clip.onclick = () => trimDialog(null);

  const del = tool('trash', 'Remove the song from this chart', async () => {
    if (!await ask(`${t.name} will be removed, along with every clip taken from it.`, 'Remove')) return;
    await Media.del(t.id);
    if (t.remote && Cloud.ready) await Cloud.removeMedia(t.id);
    forEachOwner(o => { if (o.media) o.media = o.media.filter(m => !(m.clip && m.track === t.id)); });
    song().track = null;
    save(); render();
  }, 'danger');

  row.append(name, meta, player, warn, clip, del);
  host.appendChild(row);
}

/* The blob lives in this browser's IndexedDB. On a second browser there is
   no local copy, so fall back to the server and cache it once fetched. */
/* Volume is a per-thing setting: the song has one, and every clip and
   attachment keeps its own — a quiet voice memo should not come back at
   the level you last used for the full mix. */
let volTimer = null;
function bindVolume(audio, obj) {
  audio.volume = typeof obj.volume === 'number' ? obj.volume : 1;
  audio.muted  = !!obj.muted;
  audio.onvolumechange = () => {
    obj.volume = audio.volume;
    obj.muted  = audio.muted;
    clearTimeout(volTimer);                 /* dragging the slider fires constantly */
    volTimer = setTimeout(() => save(), 400);
  };
}

const trackURLs = new Map();          /* one fetch per file, not one per player */
function trackURL(t) {
  if (trackURLs.has(t.id)) return trackURLs.get(t.id);
  const p = (async () => {
    const local = await Media.url(t.id);
    if (local) return local;
    if (t.remote && Cloud.ready) {
      const blob = await Cloud.fetchMedia(t);
      if (blob) return URL.createObjectURL(blob);
    }
    trackURLs.delete(t.id);            /* nothing yet — let a later attempt retry */
    return null;
  })();
  trackURLs.set(t.id, p);
  return p;
}
function trackMissingReason(t) {
  if (!Cloud.user) return 'This song was added on another device. Sign in to bring it over.';
  if (!t.remote)   return 'This song was never uploaded. Open it on the device that has it and press Sync.';
  return 'Could not fetch the song from the server.';
}

function pickTrack() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'audio/mpeg,audio/mp3,.mp3';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    if (!/mpeg|mp3/i.test(f.type) && !/\.mp3$/i.test(f.name)) return toast('That is not an mp3');
    const ref = await Media.put(f);
    ref.duration = await audioDuration(f);
    song().track = ref;
    save(); render();
    toast(`Added ${ref.name}`);
    if (Cloud.ready && await Cloud.upload(ref)) save();
  };
  inp.click();
}

function audioDuration(blob) {
  return new Promise(res => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { res(isFinite(a.duration) ? a.duration : 0); URL.revokeObjectURL(a.src); };
    a.onerror = () => res(0);
    a.src = URL.createObjectURL(blob);
  });
}

/* every object that can hold attachments */
function forEachOwner(fn) {
  const s = song();
  fn(s);
  (s.sections || []).forEach(sec => { fn(sec); sec.bars.forEach(fn); });
}

const fmtTime = t => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), sec = t - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
};
function parseTime(v) {
  const s = String(v).trim();
  if (!s) return 0;
  const parts = s.split(':');
  const secs = parseFloat(parts.pop()) || 0;
  const mins = parts.length ? parseInt(parts.pop(), 10) || 0 : 0;
  return mins * 60 + secs;
}

function renderRoadmap() {
  const host = $('#roadmap');
  host.innerHTML = '';
  const secs = song().sections;
  if (!secs.length) { host.appendChild(el('span', 'rm-empty', 'Add a section and the form appears here.')); return; }
  secs.forEach(sec => {
    const c = el('button', 'rm-chip');
    c.style.background = `color-mix(in srgb, ${sec.color} 16%, transparent)`;
    c.style.borderColor = sec.color;
    c.append(sec.name || 'Untitled');
    if ((sec.repeat || 1) > 1) { const x = el('span', 'rm-x', ` ×${sec.repeat}`); c.append(x); }
    c.onclick = () => {
      const node = document.getElementById(sec.id);
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.animate([{ outline: `2px solid ${sec.color}` }, { outline: '2px solid transparent' }], { duration: 1100 });
    };
    host.appendChild(c);
  });
}

function addBarButton(sec) {
  const add = el('button', 'add-bar');
  add.type = 'button';
  add.appendChild(icon('plus', 14));
  add.dataset.tip = 'Add one more bar to this region';
  add.setAttribute('aria-label', 'Add one more bar to this region');
  add.onclick = () => { sec.bars.push(newBar()); save(); render(); };
  return add;
}

/* ─── a section = one or more 4-bar systems ─────────────────────── */
function renderSection(sec, idx, startBar) {
  const wrap = el('section', 'sect' + (sec.collapsed ? ' collapsed' : ''));
  wrap.id = sec.id;
  const total = barCount(sec);
  const rep = (sec.repeat || 1) > 1 ? `, played ${sec.repeat} times` : '';
  wrap.setAttribute('aria-label', `${sec.name || 'Region'}, ${total} bars${rep}`);
  wrap.style.setProperty('--sec', sec.color);

  const rows = packRows(sec.bars, startBar);
  let placedAdd = false;
  rows.forEach((row, ri) => {
    const first  = ri === 0;
    const isLast = ri === rows.length - 1;
    const ghost  = isLast && row.used < PER_ROW;

    const sys = el('div', 'system');
    const markers = markerLane(sec, row);
    if (markers) sys.appendChild(markers);

    const box = el('div', 'rowbox');
    box.style.gridColumn = `span ${Math.max(1, row.used)}`;
    if (first) box.appendChild(regionStrip(sec, idx));
    if (!sec.collapsed) box.appendChild(measureRow(sec, row));
    sys.appendChild(box);

    if (ghost && !sec.collapsed) {
      const cell = el('div', 'add-cell');
      cell.appendChild(addBarButton(sec));
      sys.appendChild(cell);
      placedAdd = true;
    }
    wrap.appendChild(sys);
  });

  /* the last row filled all four columns, so the button has no spare column to sit in.
     Give it a row of its own — otherwise a region whose bars land on a multiple of 4
     (a fresh 8-bar section, say) has no visible way to grow. */
  if (!sec.collapsed && !placedAdd) {
    const sys = el('div', 'system');
    const cell = el('div', 'add-cell solo');
    cell.appendChild(addBarButton(sec));
    sys.appendChild(cell);
    wrap.appendChild(sys);
  }

  dropZone(wrap, f => addMedia(sec, f));
  return wrap;
}

/* marker lane — cues sitting above the block that contains their bar */
function markerLane(sec, row) {
  if (!row.items.length) return null;
  const base = row.items[0].no - cueOffset(sec, row.items[0].i);   /* cue.bar is 1-based per region */
  const inRow = rowCues(sec, row);
  if (!inRow.length) return null;

  const lane = el('div', 'markers');
  const slots = [];
  for (let i = 0; i < PER_ROW; i++) { const sl = el('div', 'mk-slot'); sl.style.gridColumn = String(i + 1); slots.push(sl); lane.appendChild(sl); }
  inRow.forEach(c => {
    const abs = base + c.bar - 1;
    const item = row.items.find(it => abs >= it.no && abs < it.no + it.span) || row.items[0];
    const m = el('button', 'marker');
    m.type = 'button';
    m.dataset.tip = `${c.text} — bar ${c.bar} of this region. Click to edit, \u2325-click to remove.`;
    m.append(c.icon || '\ud83d\udccc', el('span', null, c.text));
    m.onclick = e => {
      if (e.altKey) { sec.cues.splice(sec.cues.indexOf(c), 1); save(); render(); }
      else cueDialog(sec, c);
    };
    slots[Math.min(PER_ROW - 1, item.col)].appendChild(m);
  });
  return lane;
}
/* which cues land in this row, and which column each one sits over */
function rowCues(sec, row) {
  if (!row.items.length) return [];
  const last = row.items[row.items.length - 1];
  const from = row.items[0].no, to = last.no + last.span - 1;
  const base = row.items[0].no - cueOffset(sec, row.items[0].i);
  return (sec.cues || []).filter(c => {
    const abs = base + c.bar - 1;
    return abs >= from && abs <= to;
  });
}

/* bars of time before block index i, so cue numbers stay 1-based per region */
function cueOffset(sec, i) { return sec.bars.slice(0, i).reduce((n, b) => n + spanOf(b), 0); }

/* the slim region rectangle across the top of the box */
function regionStrip(sec, idx) {
  const r = el('div', 'region');

  const caret = el('button', 'r-caret');
  caret.type = 'button';
  caret.appendChild(icon(sec.collapsed ? 'caretRight' : 'caretDown', 13));
  caret.dataset.tip = sec.collapsed ? 'Show this region\u2019s bars' : 'Collapse to just the region strip';
  caret.setAttribute('aria-label', caret.dataset.tip);
  caret.setAttribute('aria-expanded', String(!sec.collapsed));
  caret.onclick = () => { sec.collapsed = !sec.collapsed; save(); render(); };
  r.appendChild(caret);

  const mid = el('div', 'r-mid');
  const name = el('input', 'r-name');
  name.value = sec.name; name.spellcheck = false; name.placeholder = 'region name';
  name.setAttribute('aria-label', 'Region name');
  const fit = () => name.size = Math.max(5, (name.value || name.placeholder).length);
  fit();
  name.oninput = () => { sec.name = name.value; fit(); save(); renderRoadmap(); };
  mid.appendChild(name);

  if (repeatEdit === sec.id) {
    mid.appendChild(repeatField(sec));
  } else if ((sec.repeat || 1) > 1) {
    const x = el('button', 'r-rep', '×' + sec.repeat);
    x.type = 'button';
    x.dataset.tip = `Played ${sec.repeat} times — click to change`;
    x.onclick = () => setRepeat(sec);
    mid.appendChild(x);
  }
  if (sec.note) mid.appendChild(el('span', 'r-note', sec.note));
  r.appendChild(mid);

  const right = el('div', 'r-right');
  {
    (sec.media || []).forEach(m => right.appendChild(mediaIcon(m, sec)));
    const acts = [
      { icon: 'repeat', label: 'Repeat count',        tip: 'Set repeat count — how many times this region is played', run: () => setRepeat(sec) },
      { icon: 'pin',    label: 'Add a pointer / cue', tip: 'Add a pointer above the bars (vocal starts, drums enter…)', run: () => cueDialog(sec) },
      { icon: 'clip',   label: 'Attach a clip or file', tip: 'Attach a clip of the song, or a file, to this region', run: () => attachTo(sec, `the ${sec.name || 'region'} region`) },
      { icon: 'plus',   label: 'Add one more bar',    tip: 'Add one more bar to this region', run: () => { sec.bars.push(newBar()); save(); render(); } },
      { icon: 'paint',  label: 'Change the colour',   tip: 'Change the region colour', run: () => { sec.color = COLORS[(COLORS.indexOf(sec.color) + 1) % COLORS.length]; save(); render(); } },
      { icon: 'up',     label: 'Move region earlier', tip: 'Move this region earlier in the song', run: () => moveSection(idx, -1) },
      { icon: 'down',   label: 'Move region later',   tip: 'Move this region later in the song', run: () => moveSection(idx, 1) },
      { icon: 'copy',   label: 'Duplicate the region', tip: 'Duplicate this region with all its bars', run: () => {
        const copy = JSON.parse(JSON.stringify(sec));
        copy.id = uid('x'); copy.bars.forEach(b => b.id = uid('b')); copy.cues.forEach(c => c.id = uid('c'));
        song().sections.splice(idx + 1, 0, copy); save(); render();
      } },
      { icon: 'trash',  label: 'Delete the region',   tip: 'Delete this region', danger: true, run: async () => {
        if (!await ask(`"${sec.name}" and its ${barCount(sec)} bars will be removed.`)) return;
        song().sections.splice(idx, 1); save(); render();
      } }
    ];
    const tools = el('div', 'r-tools');
    acts.forEach(a => tools.appendChild(tool(a.icon, a.tip, a.run, a.danger ? 'danger' : '')));
    right.appendChild(tools);
    right.appendChild(sheetButton(`${sec.name || 'Region'}`, acts, 'r-more'));
  }
  r.appendChild(right);
  return r;
}
let repeatEdit = null;                       /* id of the region whose ×N is being typed */
function setRepeat(sec) { repeatEdit = sec.id; render(); }
function repeatField(sec) {
  const inp = el('input', 'r-rep r-rep-in');
  inp.type = 'number'; inp.min = 1; inp.max = 64; inp.value = sec.repeat || 1;
  inp.setAttribute('aria-label', `How many times ${sec.name} is played`);
  const commit = () => {
    sec.repeat = Math.min(64, Math.max(1, parseInt(inp.value, 10) || 1));
    repeatEdit = null; save(); render();
  };
  inp.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); repeatEdit = null; render(); }
  };
  inp.onblur = commit;
  setTimeout(() => { inp.focus(); inp.select(); }, 0);
  return inp;
}

/* one row of measures, sharing barlines inside the box */
function measureRow(sec, row) {
  const line = el('div', 'measures');
  line.style.gridTemplateColumns = `repeat(${Math.max(1, row.used)},1fr)`;
  row.items.forEach((it, k) => line.appendChild(measure(sec, it, k === 0)));
  return line;
}

/* ─── one block ─────────────────────────────────────────────────────── */
function measure(sec, it, firstInRow) {
  const { bar, i, span, no } = it;
  const m = el('div', 'measure');
  m.dataset.sec = sec.id; m.dataset.idx = i; m.dataset.no = no;
  m.style.gridColumn = `span ${span}`;

  const label = span > 1 ? `${no}\u2013${no + span - 1}` : String(no);
  const name  = span > 1 ? `bars ${no}\u2013${no + span - 1}` : `bar ${no}`;
  const num = el('span', 'm-num', label);
  num.dataset.tip = span > 1
    ? `One block of ${span * 4} beats, bars ${no}\u2013${no + span - 1}`
    : `Bar ${no}`;

  /* remove the barline on this block's left edge → join it to the previous one */
  let canJoin = false;
  if (!firstInRow && i > 0) {
    const prev = sec.bars[i - 1];
    if (spanOf(prev) + span <= PER_ROW) {
      canJoin = true;
      const b = el('button', 'barline-btn');
      b.type = 'button';
      b.appendChild(icon('x', 11));
      b.dataset.tip = `Remove this barline \u2014 join bars ${no - spanOf(prev)}\u2013${no + span - 1} into one ${(spanOf(prev) + span) * 4}-beat block`;
      b.setAttribute('aria-label', b.dataset.tip);
      b.onclick = () => mergeBars(sec, i - 1);
      m.appendChild(b);
    }
  }
  /* put a barline back inside a merged block */
  if (span > 1) {
    const b = el('button', 'barline-add');
    b.type = 'button';
    b.appendChild(icon('plus', 11));
    b.style.left = `calc(${100 / span}% - 9px)`;
    b.dataset.tip = 'Put the barline back \u2014 split this into separate bars';
    b.setAttribute('aria-label', b.dataset.tip);
    b.onclick = () => splitBar(sec, i);
    m.appendChild(b);
  }

  const fields = bar.beats.length;
  const chords = el('div', 'm-chords' + (fields > 1 ? ' split' : ''));
  chords.style.setProperty('--beats', fields);
  bar.beats.forEach((v, bi) => chords.appendChild(beatInput(bar, bi, m, chords, fields === 1)));

  const acts = [
    { icon: 'columns', label: `Use ${nextFields(fields, span)} chord field${nextFields(fields, span) === 1 ? '' : 's'}`,
      tip: `${fields} chord field${fields === 1 ? '' : 's'} in this block \u2014 click for ${nextFields(fields, span)}`,
      run: () => setFields(bar, nextFields(fields, span)) },
    { icon: 'copy', label: 'Duplicate this block', tip: 'Duplicate this block', run: () => {
      const copy = JSON.parse(JSON.stringify(bar)); copy.id = uid('b');
      sec.bars.splice(i + 1, 0, copy); save(); render();
    } },
    { icon: 'clip', label: 'Attach a clip or file', tip: 'Attach a clip of the song, or a file, to this block', run: () => attachTo(bar, name) },
    { icon: 'trash', label: span > 1 ? 'Delete this block' : 'Delete this bar', tip: span > 1 ? 'Delete this block' : 'Delete this bar',
      danger: true, run: async () => {
        const written = bar.beats.some(Boolean) || bar.lyric || (bar.media || []).length;
        if (written && !await ask(`${name.charAt(0).toUpperCase() + name.slice(1)} and what is written in it will be removed.`)) return;
        sec.bars.splice(i, 1); save(); render();
      } }
  ];
  const tools = el('div', 'm-tools');
  acts.forEach(a => tools.appendChild(tool(a.icon, a.tip, a.run, a.danger ? 'danger' : '')));

  const lyric = el('input', 'm-lyric');
  lyric.value = bar.lyric || ''; lyric.placeholder = '\u2026'; lyric.spellcheck = false;
  lyric.setAttribute('aria-label', `Lyric or cue under bar ${no}`);
  lyric.dataset.tip = 'A lyric or short cue for this bar';
  lyric.oninput = () => { bar.lyric = lyric.value; lyric.classList.toggle('has', !!lyric.value); save(); };
  if (bar.lyric) lyric.classList.add('has');

  const icons = el('div', 'm-icons');
  (bar.media || []).forEach(md => icons.appendChild(mediaIcon(md, bar)));

  /* the floating barline circles are a pointer affordance; on touch the same
     two actions live in the sheet, where they cannot be hit by accident */
  const sheetActs = acts.slice(0, -1);
  sheetActs.push(
    { icon: 'caretLeft',  label: 'Move this block earlier', run: () => nudge(sec, i, -1) },
    { icon: 'caretRight', label: 'Move this block later',   run: () => nudge(sec, i, 1) });
  if (canJoin) sheetActs.push({ icon: 'x', label: `Join with bar ${no - spanOf(sec.bars[i - 1])}`, run: () => mergeBars(sec, i - 1) });
  if (span > 1) sheetActs.push({ icon: 'plus', label: 'Put the barline back', run: () => splitBar(sec, i) });
  sheetActs.push(acts[acts.length - 1]);

  m.append(num, tools, chords, lyric, icons,
           moveHandle(sec, i, m, name),
           sheetButton(name.charAt(0).toUpperCase() + name.slice(1), sheetActs, 'm-more'));

  return m;
}

/* ─── moving a block ────────────────────────────────────────────
   One pointer-driven drag that works with a mouse and a finger (HTML5
   drag-and-drop never fires on touch), plus arrow keys for the keyboard. */
let drag = null;
function moveHandle(sec, i, m, name) {
  const h = el('button', 'm-grip');
  h.type = 'button';
  h.appendChild(icon('grip', 13));
  h.dataset.tip = `Move ${name} — drag it anywhere, or press \u2190 \u2192`;
  h.setAttribute('aria-label', `Move ${name}`);
  h.onpointerdown = e => beginDrag(e, sec, i, m);
  h.onkeydown = e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(sec, i, -1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nudge(sec, i, 1); }
  };
  h.onclick = e => e.preventDefault();
  return h;
}

function beginDrag(e, sec, i, m) {
  if (e.button != null && e.button > 0) return;
  e.preventDefault();
  Tip.hide();
  const chord = sec.bars[i].beats.find(Boolean) || m.dataset.no;
  const ghost = el('div', 'drag-ghost', chord);
  document.body.appendChild(ghost);
  drag = { secId: sec.id, i, m, ghost, target: null };
  m.classList.add('dragging');
  document.body.classList.add('is-dragging');
  moveGhost(e);
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', endDrag, { once: true });
  window.addEventListener('pointercancel', endDrag, { once: true });
}
function moveGhost(e) {
  drag.ghost.style.left = e.clientX + 'px';
  drag.ghost.style.top  = e.clientY + 'px';
}
function clearMarks() {
  document.querySelectorAll('.drop-before,.drop-after')
    .forEach(n => n.classList.remove('drop-before', 'drop-after'));
}
function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();
  moveGhost(e);
  drag.ghost.classList.add('on');
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const cell = under && under.closest('.measure');
  clearMarks();
  drag.target = null;
  if (cell && cell !== drag.m) {
    const r = cell.getBoundingClientRect();
    const after = e.clientX > r.left + r.width / 2;
    cell.classList.add(after ? 'drop-after' : 'drop-before');
    drag.target = { sec: cell.dataset.sec, idx: parseInt(cell.dataset.idx, 10), after };
  }
}
function endDrag() {
  if (!drag) return;
  window.removeEventListener('pointermove', onDragMove);
  drag.ghost.remove();
  drag.m.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  clearMarks();
  const t = drag.target, fromId = drag.secId, fromIdx = drag.i;
  drag = null;
  if (!t) return;
  const from = findSection(fromId), to = findSection(t.sec);
  if (!from || !to) return;
  const [block] = from.bars.splice(fromIdx, 1);
  let at = t.idx + (t.after ? 1 : 0);
  if (from === to && fromIdx < at) at--;
  to.bars.splice(at, 0, block);
  save(); render();
}

/* one step left or right, hopping into the neighbouring region at the edge */
function nudge(sec, i, dir) {
  const secs = song().sections, si = secs.indexOf(sec);
  const to = i + dir;
  if (to >= 0 && to < sec.bars.length) {
    [sec.bars[i], sec.bars[to]] = [sec.bars[to], sec.bars[i]];
  } else {
    const nb = secs[si + dir];
    if (!nb) return;
    const [block] = sec.bars.splice(i, 1);
    dir < 0 ? nb.bars.push(block) : nb.bars.unshift(block);
  }
  save(); render();
  const sel = dir < 0
    ? `#${(secs[si + dir] || sec).id} .m-grip`
    : `#${(secs[si + dir] || sec).id} .m-grip`;
  requestAnimationFrame(() => {
    const grips = [...document.querySelectorAll('.m-grip')];
    const moved = document.querySelector('.measure.just-moved .m-grip');
    (moved || grips[0]) && (moved || grips[0]).focus();
  });
}

/* how many chord fields the next click gives you */
function nextFields(n, span) {
  const opts = span > 1 ? [1, 2, 3, 4, 6, 8] : [1, 2, 3, 4];
  return opts[(opts.indexOf(n) + 1) % opts.length] || 1;
}
function setFields(bar, n) {
  const kept = bar.beats.filter(Boolean);
  const next = Array(n).fill('');
  if (n >= bar.beats.length) bar.beats.forEach((v, k) => next[k] = v);
  else kept.slice(0, n).forEach((v, k) => next[k] = v);
  bar.beats = next;
  save(); render();
}
function mergeBars(sec, i) {
  const a = sec.bars[i], b = sec.bars[i + 1];
  if (!a || !b) return;
  a.span = spanOf(a) + spanOf(b);
  const joined = [...a.beats, ...b.beats];
  while (joined.length > 1 && !joined[joined.length - 1]) joined.pop();
  a.beats = joined;
  a.lyric = [a.lyric, b.lyric].filter(Boolean).join(' / ');
  a.media = [...(a.media || []), ...(b.media || [])];
  sec.bars.splice(i + 1, 1);
  save(); render();
}
function splitBar(sec, i) {
  const a = sec.bars[i], span = spanOf(a);
  if (span < 2) return;
  const b = newBar();
  b.span = span - 1;
  const half = Math.ceil(a.beats.length / span);
  b.beats = a.beats.slice(half).filter((_, k, arr) => true);
  if (!b.beats.length) b.beats = [''];
  a.beats = a.beats.slice(0, half);
  if (!a.beats.length) a.beats = [''];
  a.span = 1;
  sec.bars.splice(i + 1, 0, b);
  save(); render();
}

/* ─── fitting long chords ───────────────────────────────────────
   "Cmaj7#11/G" must not spill out of its bar. Measure the text and shrink
   the type until it fits, down to a floor where it is still readable.
   The base size comes from the stylesheet, so the breakpoints still rule. */
const fitCtx = document.createElement('canvas').getContext('2d');
const fitBase = new Map();

function baseSizeFor(inp) {
  const key = inp.className;
  if (!fitBase.has(key)) {
    const prev = inp.style.fontSize;
    inp.style.fontSize = '';
    const cs = getComputedStyle(inp);
    fitBase.set(key, { size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily });
    inp.style.fontSize = prev;
  }
  return fitBase.get(key);
}

function fitChord(inp) {
  const v = inp.value;
  const b = baseSizeFor(inp);
  if (!v) { inp.style.fontSize = ''; return; }
  const avail = inp.clientWidth - 6;
  if (avail <= 0) return;
  fitCtx.font = `${b.weight} ${b.size}px ${b.family}`;
  const w = fitCtx.measureText(v).width;
  inp.style.fontSize = w > avail
    ? Math.max(10, b.size * avail / w).toFixed(1) + 'px'
    : '';
}
function fitAllChords() {
  fitBase.clear();                       /* breakpoint may have changed */
  document.querySelectorAll('.beat').forEach(fitChord);
}

function beatInput(bar, bi, m, chords, solo) {
  const inp = el('input', 'beat' + (solo ? ' solo' : ''));
  inp.value = bar.beats[bi] || '';
  inp.spellcheck = false;
  const where = solo ? `bar ${m.dataset.no}` : `bar ${m.dataset.no}, field ${bi + 1}`;
  inp.setAttribute('aria-label', `Chord for ${where}`);
  inp.oninput = () => { bar.beats[bi] = inp.value; fitChord(inp); save(); };
  inp.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); step(m, 1); }
    else if (e.key === 'Backspace' && !inp.value && bi > 0 && !solo) { e.preventDefault(); chords.children[bi - 1].focus(); }
    else if (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length) {
      e.preventDefault();
      (!solo && bi < bar.beats.length - 1) ? chords.children[bi + 1].focus() : step(m, 1);
    } else if (e.key === 'ArrowLeft' && inp.selectionStart === 0) {
      e.preventDefault();
      (!solo && bi > 0) ? chords.children[bi - 1].focus() : step(m, -1);
    }
  };
  return inp;
}

function step(node, dir) {
  const all = [...document.querySelectorAll('.measure:not(.blank):not(.ghost)')];
  const nxt = all[all.indexOf(node) + dir];
  if (nxt) nxt.querySelector('.beat')[dir > 0 ? 'focus' : 'focus']();
}

/* On a touch screen there is no hover, and Safari fires :hover on a tap — so
   the tool row used to spring open over the block the moment you tried to type
   in it. Touch gets a ⋯ that opens a proper sheet instead: labelled actions,
   thumb-sized, anchored to the bottom of the screen, nothing over the chart. */
function sheetButton(title, acts, cls) {
  const b = el('button', cls);
  b.type = 'button';
  b.appendChild(icon('more', 15));
  b.dataset.tip = `More for ${title.toLowerCase()}`;
  b.setAttribute('aria-label', `More for ${title.toLowerCase()}`);
  b.setAttribute('aria-haspopup', 'dialog');
  b.onpointerdown = e => e.preventDefault();       /* never steal focus from a field */
  b.onclick = e => { e.stopPropagation(); e.preventDefault(); openSheet(title, acts); };
  return b;
}
let sheetBack = null;
function openSheet(title, acts) {
  const host = $('#sheet-items');
  host.innerHTML = '';
  $('#sheet-title').textContent = title;
  acts.forEach(a => {
    const row = el('button', 'sheet-row' + (a.danger ? ' danger' : ''));
    row.type = 'button';
    row.append(icon(a.icon, 17), el('span', null, a.label));
    row.onclick = () => { closeSheet(); a.run(); };
    host.appendChild(row);
  });
  sheetBack = document.activeElement;
  $('#sheet').hidden = false;
  document.body.classList.add('sheet-on');
  host.firstChild && host.firstChild.focus({ preventScroll: true });
}
function closeSheet() {
  if ($('#sheet').hidden) return;
  $('#sheet').hidden = true;
  document.body.classList.remove('sheet-on');
  if (sheetBack && sheetBack.isConnected) sheetBack.focus({ preventScroll: true });
  sheetBack = null;
}
const closeTools = closeSheet;               /* one thing to close, from anywhere */

function tool(name, tip, fn, extra) {
  const b = el('button', 'ibtn' + (extra ? ' ' + extra : ''));
  b.type = 'button';
  b.appendChild(icon(name));
  b.dataset.tip = tip;
  b.setAttribute('aria-label', tip);          /* icon-only: needs its own name */
  b.onclick = e => { e.stopPropagation(); fn(e); };
  return b;
}
function moveSection(i, d) {
  const a = song().sections, j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; save(); render();
}

/* ─── media ─────────────────────────────────────────────────────── */
function mediaIcon(m, owner) {
  const b = el('button', 'micon ' + m.kind);
  b.type = 'button';
  b.appendChild(icon(m.clip ? 'wave' : (KIND_ICON[m.kind] || 'file'), 12));
  const verb = m.kind === 'image' ? 'View' : m.kind === 'file' ? 'Open' : 'Play';
  b.dataset.tip = m.clip
    ? `Play ${m.label ? m.label + ', ' : ''}${fmtTime(m.start)}–${fmtTime(m.end)} of the song`
    : `${verb} ${m.name}`;
  b.setAttribute('aria-label', b.dataset.tip);
  b.onclick = e => { e.stopPropagation(); openViewer(m, owner); };
  return b;
}
/* 📎 on a region or bar: pick a file, or cut a clip out of the song */
function attachTo(owner, where) {
  if (pendingClip) {                          /* clip cut first, target chosen after */
    const c = pendingClip; pendingClip = null;
    (owner.media = owner.media || []).push(c);
    save(); render(); toast('Clip attached');
    return;
  }
  const t = song().track;
  if (!t) return pickMedia(f => addMedia(owner, f));
  const d = $('#dlg-attach');
  $('#attach-where').textContent = `Attach to ${where}.`;
  $('#attach-track-name').textContent = t.name;
  $('#attach-clip').onclick = () => { d.close(); trimDialog(owner); };
  $('#attach-file').onclick = () => { d.close(); pickMedia(f => addMedia(owner, f)); };
  d.querySelector('[data-close]').onclick = () => d.close();
  d.showModal();
}

/* ─── trimming a clip out of the song ───────────────────────────── */
let trimAudio = null;
async function trimDialog(owner, existing) {
  const t = song().track;
  if (!t) return toast('Add the song first');
  const d = $('#dlg-trim');
  let dur = t.duration || 0;
  if (!dur) {
    const rec = await Media.get(t.id);
    if (rec) dur = await audioDuration(rec.blob) || 0;
  }
  if (!t.duration) { t.duration = dur; save(); }

  const startS = $('#trim-start'), endS = $('#trim-end');
  const startT = $('#trim-start-t'), endT = $('#trim-end-t');
  [startS, endS].forEach(r => { r.min = 0; r.max = dur || 100; r.step = 0.05; });

  let a = existing ? existing.start : 0;
  let b = existing ? existing.end : Math.min(dur, 15);

  /* `from` says which control moved, so we never overwrite the box being
     typed in — and never skip an update just because it holds focus. */
  const paint = from => {
    a = Math.max(0, Math.min(a, dur));
    b = Math.max(a + 0.1, Math.min(b, dur));
    if (from !== 'startS') startS.value = a;
    if (from !== 'endS')   endS.value = b;
    if (from !== 'startT') startT.value = fmtTime(a);
    if (from !== 'endT')   endT.value = fmtTime(b);
    $('#trim-len').textContent = fmtTime(b - a);
    const sel = $('#trim-sel');
    sel.style.left  = (dur ? a / dur * 100 : 0) + '%';
    sel.style.width = (dur ? (b - a) / dur * 100 : 100) + '%';
  };

  startS.oninput = () => { a = parseFloat(startS.value); if (a > b - 0.1) a = b - 0.1; paint('startS'); };
  endS.oninput   = () => { b = parseFloat(endS.value);   if (b < a + 0.1) b = a + 0.1; paint('endS'); };
  startT.oninput = () => { a = parseTime(startT.value); paint('startT'); };
  endT.oninput   = () => { b = parseTime(endT.value);   paint('endT'); };
  startT.onblur = () => paint();
  endT.onblur   = () => paint();

  /* preview */
  const url = await trackURL(t);
  if (!url) { toast(trackMissingReason(t)); return; }
  stopTrim();
  trimAudio = new Audio(url);
  bindVolume(trimAudio, t);
  const head = $('#trim-head');
  const btn = $('#trim-preview');
  const stopAt = () => {
    if (!trimAudio) return;
    if (trimAudio.currentTime >= b) { trimAudio.pause(); trimAudio.currentTime = a; }
    head.hidden = false;
    head.style.left = (dur ? trimAudio.currentTime / dur * 100 : 0) + '%';
    btn.textContent = trimAudio.paused ? 'Play clip' : 'Stop';
  };
  trimAudio.ontimeupdate = stopAt;
  trimAudio.onpause = () => btn.textContent = 'Play clip';
  btn.onclick = () => {
    if (!trimAudio) return;
    if (trimAudio.paused) { Sound.claim(trimAudio); trimAudio.currentTime = a; trimAudio.play(); btn.textContent = 'Stop'; }
    else { trimAudio.pause(); }
  };
  $('#trim-set-start').onclick = () => { a = trimAudio ? trimAudio.currentTime : a; paint(); };
  $('#trim-set-end').onclick   = () => { b = trimAudio ? trimAudio.currentTime : b; paint(); };
  $('#trim-strip').onclick = e => {
    const r = $('#trim-strip').getBoundingClientRect();
    if (trimAudio) { trimAudio.currentTime = (e.clientX - r.left) / r.width * dur; stopAt(); }
  };

  $('#trim-label').value = existing ? (existing.label || '') : '';
  $('#trim-title').textContent = existing ? 'Edit clip' : 'Clip from the song';
  $('#trim-save').textContent = existing ? 'Save clip' : (owner ? 'Attach clip' : 'Choose where…');

  $('#trim-save').onclick = () => {
    const clip = {
      id: existing ? existing.id : uid('k'),
      clip: true, track: t.id, kind: 'clip',
      start: +a.toFixed(2), end: +b.toFixed(2),
      label: $('#trim-label').value.trim(),
      name: ($('#trim-label').value.trim() || `${fmtTime(a)}–${fmtTime(b)}`) + ` · ${t.name}`
    };
    stopTrim(); d.close();
    if (existing) { Object.assign(existing, clip); save(); render(); return; }
    if (owner) { (owner.media = owner.media || []).push(clip); save(); render(); toast('Clip attached'); return; }
    pendingClip = clip;                       /* started from the track bar */
    toast('Now click 📎 on the region or bar to put it on');
  };
  d.querySelector('[data-close]').onclick = () => { stopTrim(); d.close(); };
  d.oncancel = stopTrim;

  paint();
  d.showModal();
}
function stopTrim() {
  if (!trimAudio) return;
  Sound.stop(trimAudio); trimAudio.ontimeupdate = null; trimAudio = null;
  $('#trim-head').hidden = true;
}
let pendingClip = null;

function pickMedia(cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,audio/*,video/*'; inp.multiple = true;
  inp.onchange = () => [...inp.files].forEach(cb);
  inp.click();
}
async function addMedia(owner, file) {
  const ref = await Media.put(file);
  (owner.media = owner.media || []).push(ref);
  save(); render();
  toast(`Attached ${ref.name}`);
  if (Cloud.ready && await Cloud.upload(ref)) save();
}
async function playClip(m, owner) {
  const t = song().track;
  if (!t || t.id !== m.track) { toast('The song this clip came from is gone'); return; }
  const url = await trackURL(t);
  if (!url) { toast(trackMissingReason(t)); return; }
  const body = $('#viewer-body');
  Sound.stopIn(body);
  body.innerHTML = '';
  $('#viewer-name').textContent = `${m.label || 'Clip'} · ${fmtTime(m.start)}–${fmtTime(m.end)}`;
  const a = el('audio');
  a.controls = true; a.src = url; a.autoplay = true;
  bindVolume(a, m);
  a.onloadedmetadata = () => a.currentTime = m.start;
  a.ontimeupdate = () => { if (a.currentTime >= m.end) { a.pause(); a.currentTime = m.start; } };
  body.appendChild(a);
  const edit = el('button', 'btn', 'Edit clip');
  edit.type = 'button';
  edit.onclick = () => { closeViewer(); trimDialog(owner, m); };
  body.appendChild(edit);
  const rm = $('#viewer-remove');
  rm.onclick = async () => {
    if (!await ask(`${m.label || 'This clip'} will be removed from the chart. The song itself stays.`, 'Remove')) return;
    owner.media.splice(owner.media.findIndex(x => x.id === m.id), 1);
    save(); render(); closeViewer();
  };
  $('#viewer').hidden = false;
}

async function openViewer(m, owner) {
  if (m.clip) return playClip(m, owner);
  let url = await Media.url(m.id);
  if (!url && m.remote && Cloud.ready) {           /* attached on another device */
    toast(`Fetching ${m.name}\u2026`);
    const blob = await Cloud.fetchMedia(m);
    if (blob) url = URL.createObjectURL(blob);
  }
  if (!url) { toast('That file is not on this device'); return; }
  const body = $('#viewer-body');
  Sound.stopIn(body);
  body.innerHTML = '';
  $('#viewer-name').textContent = m.name;
  let node;
  if (m.kind === 'image') { node = el('img'); node.src = url; }
  else if (m.kind === 'audio') { node = el('audio'); node.controls = true; node.autoplay = true; node.src = url; bindVolume(node, m); }
  else if (m.kind === 'video') { node = el('video'); node.controls = true; node.src = url; bindVolume(node, m); }
  else { node = el('a', null, 'Download ' + m.name); node.href = url; node.download = m.name; }
  body.appendChild(node);
  const rm = $('#viewer-remove');
  rm.onclick = async () => {
    if (!await ask(`${m.name} will be removed from this song.`, 'Remove')) return;
    await Media.del(m.id);
    if (m.remote && Cloud.ready) await Cloud.removeMedia(m.id);
    owner.media.splice(owner.media.findIndex(x => x.id === m.id), 1);
    save(); render(); closeViewer();
  };
  $('#viewer').hidden = false;
}
function closeViewer() { Sound.stopIn($('#viewer-body')); $('#viewer').hidden = true; $('#viewer-body').innerHTML = ''; }
function dropZone(node, cb) {
  node.ondragover = e => {
    if (![...(e.dataTransfer.types || [])].includes('Files')) return;
    e.preventDefault(); node.classList.add('drop-hint');
  };
  node.ondragleave = () => node.classList.remove('drop-hint');
  node.ondrop = e => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); node.classList.remove('drop-hint');
    [...e.dataTransfer.files].forEach(cb);
  };
}

/* ─── dialogs ───────────────────────────────────────────────────── */
let pendingColor = COLORS[0];
function buildSwatches() {
  const host = $('#sec-swatches');
  host.innerHTML = '';
  COLORS.forEach(c => {
    const b = el('button', 'sw' + (c === pendingColor ? ' on' : ''));
    b.type = 'button'; b.style.background = c;
    b.onclick = () => { pendingColor = c; buildSwatches(); };
    host.appendChild(b);
  });
}
function sectionDialog() {
  const s = song();
  const used = s.sections.map(x => x.name);
  const guess = !used.length ? 'Intro'
    : used.filter(n => /verse/i.test(n)).length && !used.filter(n => /chorus/i.test(n)).length ? 'Chorus'
    : 'Verse ' + (used.filter(n => /verse/i.test(n)).length + 1);
  pendingColor = COLORS[s.sections.length % COLORS.length];
  buildSwatches();
  $('#sec-name').value = guess;
  $('#sec-bars').value = 8;
  $('#sec-repeat').value = 1;
  $('#sec-note').value = '';
  const d = $('#dlg-section');
  $('#sec-submit').onclick = () => {
    const name = $('#sec-name').value.trim() || 'Section';
    const bars = Math.min(128, Math.max(1, parseInt($('#sec-bars').value, 10) || 8));
    const rep  = Math.min(64, Math.max(1, parseInt($('#sec-repeat').value, 10) || 1));
    d.close();
    s.sections.push(newSection(name, bars, rep, pendingColor, $('#sec-note').value.trim()));
    save(); render();
    document.getElementById(s.sections[s.sections.length - 1].id).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  d.querySelector('[data-close]').onclick = () => d.close();
  d.showModal();
  $('#sec-name').select();
  setTimeout(() => $('#sec-name').select(), 30);
}
function cueDialog(sec, existing) {
  const d = $('#dlg-cue');
  $('#cue-text').value = existing ? existing.text : '';
  $('#cue-icon').value = existing ? existing.icon : '\ud83c\udfa4';
  $('#cue-bar').value  = existing ? existing.bar : 1;
  $('#cue-bar').max = barCount(sec) || 1;
  $('#cue-delete').hidden = !existing;

  const drop = () => {
    const i = (sec.cues || []).indexOf(existing);
    if (i > -1) sec.cues.splice(i, 1);
    save(); render();
  };

  $('#cue-save').onclick = () => {
    const text = $('#cue-text').value.trim();
    d.close();
    if (!text) { if (existing) drop(); return; }   /* cleared means remove it */
    const data = {
      text, icon: $('#cue-icon').value,
      bar: Math.min(barCount(sec) || 1, Math.max(1, parseInt($('#cue-bar').value, 10) || 1))
    };
    if (existing) Object.assign(existing, data);
    else (sec.cues = sec.cues || []).push({ id: uid('c'), ...data });
    sec.cues.sort((a, b) => a.bar - b.bar);
    save(); render();
  };
  $('#cue-delete').onclick = () => { d.close(); drop(); };
  d.querySelector('[data-close]').onclick = () => d.close();

  d.showModal();
  $('#cue-text').select();
  setTimeout(() => $('#cue-text').select(), 30);
}

/* ─── sync UI ───────────────────────────────────────────────────── */
const CLOUD_TEXT = {
  off:     ['Not configured', 'No project is configured, so everything stays on this device.'],
  nolib:   ['Offline',        'The Supabase library could not load — check your connection.'],
  out:     ['Sign in',        'Sign in and your songs, mp3s and chord diagrams sync to your account, so they are on every device.'],
  syncing: ['Syncing…',       'Talking to the server.'],
  pending: ['Saving…',        'Changes queued — they go up in a moment.'],
  ok:      ['Synced',         'Everything on this device is on the server.'],
  error:   ['Sync failed',    'Something went wrong. Your work is safe on this device; try again.']
};

function cloudDialog(awaitingCode) {
  const d = $('#dlg-cloud');
  msg('');
  paintCloud(awaitingCode);
  if (!d.open) d.showModal();
}

function msg(text, kind) {
  const p = $('#cloud-msg');
  p.textContent = text;
  p.className = 'dlg-msg' + (kind ? ' ' + kind : '');
  p.hidden = !text;
}

/* Primary action: sign in with a password (or sync, when already signed in).
   No email is sent, so the mailer's rate limit cannot lock you out. */
$('#cloud-go').onclick = async () => {
  if (Cloud.user) {
    msg('Syncing…');
    try {
      await Cloud.syncAll();
      const n = await Cloud.backfill();
      msg(n ? `Synced, ${n} file${n === 1 ? '' : 's'} uploaded` : 'Everything is up to date', 'good');
    } catch (e) { msg(e.message || 'Sync failed', 'bad'); }
    return;
  }
  const email = $('#cloud-email').value.trim(), pw = $('#cloud-pw').value;
  if (!email) { $('#cloud-email').focus(); return msg('Enter your email first', 'bad'); }
  if (!pw)    { $('#cloud-pw').focus();    return msg('Enter your password, or use “Email a link”', 'bad'); }
  msg('Signing in…');
  try {
    await Cloud.signInPassword(email, pw);
    remember(email);
    msg('Signed in', 'good');
    paintCloud();
    setTimeout(() => $('#dlg-cloud').close(), 600);
  } catch (e) {
    msg(/invalid/i.test(e.message || '') ? 'Wrong email or password. If you have never set one, use “Email a link”.' : (e.message || 'Could not sign in'), 'bad');
  }
};

$('#cloud-signup').onclick = async () => {
  const email = $('#cloud-email').value.trim(), pw = $('#cloud-pw').value;
  if (!email || pw.length < 6) return msg('Enter your email and a password of at least 6 characters', 'bad');
  msg('Creating your account…');
  try {
    const r = await Cloud.signUpPassword(email, pw);
    remember(email);
    if (r.signedIn) { msg('Account created — signed in', 'good'); paintCloud(); setTimeout(() => $('#dlg-cloud').close(), 600); }
    else msg('Account created. Confirm it from the email we sent, then sign in.', 'good');
  } catch (e) {
    msg(/already/i.test(e.message || '') ? 'That account exists — sign in with its password, or use “Email a link”.' : (e.message || 'Could not create the account'), 'bad');
  }
};

/* Magic link stays as the fallback for when you have no password yet. */
$('#cloud-link').onclick = async () => {
  const email = $('#cloud-email').value.trim();
  if (!email) { $('#cloud-email').focus(); return msg('Enter your email first', 'bad'); }
  const btn = $('#cloud-link');
  btn.disabled = true; msg('Sending…');
  try {
    await Cloud.signIn(email);
    remember(email);
    msg('Link sent — open it in this browser.', 'good');
    paintCloud(true);
  } catch (e) {
    msg(/rate limit/i.test(e.message || '')
      ? 'The email limit is reached (2 per hour on the free plan). Set a password instead, or wait for the hour to turn over.'
      : (e.message || 'Could not send the link'), 'bad');
  } finally { setTimeout(() => btn.disabled = false, 20000); }
};

/* Set a password from a session that is already signed in — the way out of
   an email lock-out, since it needs no email at all. */
async function savePassword() {
  const pw = $('#cloud-newpw').value;
  if (pw.length < 6) { $('#cloud-newpw').focus(); return msg('Use at least 6 characters', 'bad'); }
  msg('Saving…');
  try {
    await Cloud.setPassword(pw);
    $('#cloud-newpw').value = '';
    msg('Password saved. Sign in anywhere with your email and this password.', 'good');
  } catch (e) { msg(e.message || 'Could not set the password', 'bad'); }
}
$('#cloud-savepw').onclick = savePassword;
$('#cloud-newpw').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); savePassword(); } };
$('#cloud-pw').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#cloud-go').click(); } };
$('#cloud-email').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#cloud-pw').focus(); } };

const remember = email => localStorage.setItem('song-structure.email', email);

$('#cloud-verify').onclick = async () => {
  const email = $('#cloud-email').value.trim(), code = $('#cloud-code').value.trim();
  if (!email || !code) return msg('Enter your email and the code', 'bad');
  msg('Checking…');
  try {
    await Cloud.verifyCode(email, code);
    msg('Signed in', 'good');
    paintCloud();
    setTimeout(() => $('#dlg-cloud').close(), 700);
  } catch (e) { msg(e.message || 'That code did not work', 'bad'); }
};

$('#dlg-cloud').querySelector('[data-close]').onclick = () => $('#dlg-cloud').close();

$('#cloud-signout').onclick = async () => {
  await Cloud.signOut();
  msg('Signed out — your songs stay on this device', 'good');
  paintCloud();
};

function paintCloud(awaitingCode) {
  const [, note] = CLOUD_TEXT[Cloud.state] || CLOUD_TEXT.out;
  const signedIn = !!Cloud.user;
  const dead = Cloud.state === 'off' || Cloud.state === 'nolib';

  if (!signedIn && !$('#cloud-email').value)
    $('#cloud-email').value = localStorage.getItem('song-structure.email') || '';

  $('#cloud-title').textContent = signedIn ? 'Sync' : 'Sign in to sync';
  $('#cloud-state').textContent = note;

  $('#cloud-account').hidden    = !signedIn;
  if (signedIn) $('#cloud-who').textContent = Cloud.user.email;
  $('#cloud-newpw-field').hidden = !signedIn;

  $('#cloud-email-field').hidden = signedIn;
  $('#cloud-pw-field').hidden    = signedIn;
  $('#cloud-code-field').hidden  = signedIn || !awaitingCode;

  $('#cloud-verify').hidden = signedIn || !awaitingCode;
  $('#cloud-signup').hidden = signedIn || dead;
  $('#cloud-link').hidden   = signedIn || dead;
  $('#cloud-go').textContent = signedIn ? 'Sync now' : 'Sign in';
  $('#cloud-go').hidden = dead;
}

/* The sign-in link opens in a new tab, and two tabs can both hold the chart.
   Follow whatever the other tab writes instead of quietly diverging. */
let fitTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => { fitAllChords(); if (gigIsOn()) fitGigChords(); }, 120);
});

window.addEventListener('storage', e => {
  if (!e.key) return;
  if (e.key === KEY && e.newValue) {
    try {
      const next = migrate(JSON.parse(e.newValue));
      const keep = state.currentId;
      state = next;
      if (state.songs.some(s => s.id === keep)) state.currentId = keep;
      render();
      if (!$('#drawer').hidden) renderSongs();
    } catch (_) {}
  }
  if (/auth-token/.test(e.key)) Cloud.refresh();
});

Cloud.onError(m => toast(m));
/* both devices changed the same song — say so plainly, and open the drawer so
   the kept copy is right there rather than a mystery */
Cloud.onConflict(titles => {
  const one = titles.length === 1;
  toast(one ? `That song was also changed on another device — both are kept`
            : `${titles.length} songs were also changed on another device — both copies of each are kept`,
        { label: 'Show', run: () => { showTab('songs'); $('#drawer').hidden = false; } });
});
Cloud.on((st, user) => {
  const btn = $('#btn-cloud');
  if (!btn) return;
  const [label] = CLOUD_TEXT[st] || CLOUD_TEXT.out;
  btn.querySelector('.lbl').textContent = user ? label : (st === 'off' || st === 'nolib' ? label : 'Sign in');
  btn.classList.toggle('primary', !user && st !== 'off' && st !== 'nolib');
  btn.dataset.state = st;
  btn.dataset.tip = user
    ? `${label} — signed in as ${user.email}`
    : 'Sign in to sync songs and attachments across your devices';
  btn.setAttribute('aria-label', btn.dataset.tip);
  if (!$('#dlg-cloud').open) return;
  paintCloud();
});

/* ─── confirm ───────────────────────────────────────────────────
   prompt()/confirm() are blocked in some embedded browsers and look
   nothing like the app, so both are replaced with real dialogs. */
function ask(body, okLabel = 'Delete') {
  return new Promise(res => {
    const d = $('#dlg-confirm');
    $('#confirm-body').textContent = body;
    $('#confirm-ok').textContent = okLabel;
    const done = yes => { d.close(); res(yes); };
    $('#confirm-ok').onclick = () => done(true);
    d.querySelector('[data-close]').onclick = () => done(false);
    d.oncancel = () => res(false);          /* Escape */
    d.showModal();
  });
}

/* ─── songs ─────────────────────────────────────────────────────── */
function renderSongs() {
  const host = $('#song-list');
  host.innerHTML = '';
  state.songs.slice().sort((a, b) => b.updated - a.updated).forEach(s => {
    const row = el('div', 'song-row' + (s.id === state.currentId ? ' on' : ''));
    const main = el('div', 'sr-main');
    main.append(el('div', 'sr-title', s.title || 'Untitled'));
    const bars = s.sections.reduce((n, x) => n + barCount(x), 0);
    main.append(el('div', 'sr-sub', `${s.sections.length} regions · ${bars} bars${s.key ? ' · ' + s.key : ''}`));
    row.appendChild(main);
    row.onclick = () => { state.currentId = s.id; save(); render(); renderSongs(); closeDrawer(); };
    row.appendChild(tool('trash', 'Delete this song', async () => {
      if (!await ask(`"${s.title || 'Untitled'}" will be removed, along with anything attached to it.`)) return;
      const inLists = state.setlists.some(l => (l.songs || []).includes(s.id));
      state.songs = state.songs.filter(x => x.id !== s.id);
      state.setlists.forEach(l => { l.songs = (l.songs || []).filter(id => id !== s.id); });
      if (!state.songs.length) state.songs = [blankSong()];
      if (state.currentId === s.id) state.currentId = state.songs[0].id;
      forget_base(s.id);
      if (Cloud.ready) Cloud.remove(s.id);
      if (inLists) saveLists();
      save(); render(); renderSongs();
    }, 'danger'));
    host.appendChild(row);
  });
}
let drawerTab = 'songs';
const openDrawer  = () => { showTab(drawerTab); $('#drawer').hidden = false; };
const closeDrawer = () => { $('#drawer').hidden = true; };

/* ─── setlists ──────────────────────────────────────────────────
   A setlist is a named, ordered list of song ids — a gig. It holds ids, not
   copies, so editing a song edits it everywhere, and deleting a song only
   removes it from the running order. Setlists are local to this device:
   the cloud has a table for songs and nothing else, so they are written
   with saveLocal() and never restamp the open song. */
const listById  = id => state.setlists.find(l => l.id === id);
const songById  = id => state.songs.find(s => s.id === id);
const listSongs = l => (l.songs || []).map(songById).filter(Boolean);

function newList(name, note) {
  return { id: uid('l'), name: name || 'Setlist', note: note || '', songs: [], updated: Date.now() };
}
let listEdit = null;                        /* the setlist being renamed, if any */
function listDialog(existing) {
  const d = $('#dlg-list');
  listEdit = existing || null;
  $('#list-title').textContent = existing ? 'Rename setlist' : 'New setlist';
  $('#list-name').value = existing ? existing.name : '';
  $('#list-note').value = existing ? (existing.note || '') : '';
  $('#list-save').textContent = existing ? 'Save' : 'Create setlist';
  $('#list-save').onclick = () => {
    const name = $('#list-name').value.trim();
    if (!name) { $('#list-name').focus(); return; }
    const note = $('#list-note').value.trim();
    if (listEdit) { listEdit.name = name; listEdit.note = note; }
    else { const l = newList(name, note); state.setlists.push(l); openList = l.id; }
    listEdit = null;
    saveLists(); d.close(); renderLists();
  };
  d.querySelector('[data-close]').onclick = () => { listEdit = null; d.close(); };
  d.showModal();
  setTimeout(() => $('#list-name').select(), 30);
}

let openList = null;                        /* which setlist is expanded in the drawer */
function renderLists() {
  const host = $('#list-pane');
  host.innerHTML = '';

  const add = el('button', 'btn primary big list-new');
  add.type = 'button';
  add.append(icon('plus', 15), el('span', null, 'New setlist'));
  add.onclick = () => listDialog();
  host.appendChild(add);

  if (!state.setlists.length) {
    host.appendChild(el('p', 'list-empty',
      'A setlist is one gig: the songs you are playing, in order. Build one here and Gig mode walks it with ‹ and ›.'));
    return;
  }

  state.setlists.forEach(l => {
    const songs = listSongs(l);
    const box = el('div', 'list-box' + (openList === l.id ? ' open' : ''));

    const head = el('div', 'list-head');
    const caret = el('button', 'ibtn');
    caret.type = 'button';
    caret.appendChild(icon(openList === l.id ? 'caretDown' : 'caretRight', 14));
    caret.setAttribute('aria-label', (openList === l.id ? 'Collapse ' : 'Expand ') + l.name);
    caret.setAttribute('aria-expanded', String(openList === l.id));
    caret.onclick = () => { openList = openList === l.id ? null : l.id; renderLists(); };

    const main = el('div', 'list-main');
    main.append(el('div', 'list-name', l.name));
    main.append(el('div', 'list-sub',
      `${songs.length} song${songs.length === 1 ? '' : 's'}${l.note ? ' · ' + l.note : ''}`));
    main.onclick = caret.onclick;

    const go = el('button', 'btn list-go');
    go.type = 'button';
    go.append(icon('play', 14), el('span', null, 'Start'));
    go.dataset.tip = 'Open the first song in Gig mode and walk the setlist from there';
    go.disabled = !songs.length;
    go.onclick = () => startList(l);

    head.append(caret, main, go,
      tool('save', 'Rename this setlist', () => listDialog(l)),
      tool('trash', 'Delete this setlist', async () => {
        if (!await ask(`The setlist "${l.name}" will be removed. The songs in it stay.`)) return;
        state.setlists = state.setlists.filter(x => x.id !== l.id);
        if (state.currentListId === l.id) state.currentListId = null;
        saveLists(); renderLists();
      }, 'danger'));
    box.appendChild(head);

    if (openList === l.id) {
      const body = el('div', 'list-body');
      songs.forEach((so, i) => {
        const row = el('div', 'list-song' + (so.id === state.currentId ? ' on' : ''));
        row.append(el('span', 'ls-no', String(i + 1)));
        const t = el('div', 'ls-main');
        t.append(el('div', 'ls-title', so.title || 'Untitled'));
        const bars = so.sections.reduce((n, x) => n + barCount(x), 0);
        t.append(el('div', 'ls-sub', `${so.sections.length} regions · ${bars} bars${so.key ? ' · ' + so.key : ''}`));
        t.onclick = () => { state.currentListId = l.id; openSong(so.id); closeDrawer(); };
        row.appendChild(t);
        const tools = el('div', 'ls-tools');
        tools.append(
          tool('up', 'Move up the running order', () => moveInList(l, i, -1)),
          tool('down', 'Move down the running order', () => moveInList(l, i, 1)),
          tool('x', 'Take this song out of the setlist', () => {
            l.songs.splice(l.songs.indexOf(so.id), 1); saveLists(); renderLists();
          }));
        row.appendChild(tools);
        body.appendChild(row);
      });

      const rest = state.songs.filter(so => !(l.songs || []).includes(so.id));
      if (rest.length) {
        const pick = el('div', 'list-add');
        const sel = el('select', 'list-select');
        sel.setAttribute('aria-label', `Add a song to ${l.name}`);
        sel.appendChild(el('option', null, 'Add a song…'));
        rest.forEach(so => {
          const o = el('option', null, so.title || 'Untitled');
          o.value = so.id; sel.appendChild(o);
        });
        sel.onchange = () => {
          if (!sel.value) return;
          l.songs.push(sel.value); l.updated = Date.now();
          saveLists(); renderLists();
        };
        pick.appendChild(sel);
        body.appendChild(pick);
      } else if (!songs.length) {
        body.appendChild(el('p', 'list-empty', 'No songs yet — add one below.'));
      }
      box.appendChild(body);
    }
    host.appendChild(box);
  });
}
function moveInList(l, i, d) {
  const j = i + d;
  if (j < 0 || j >= l.songs.length) return;
  [l.songs[i], l.songs[j]] = [l.songs[j], l.songs[i]];
  l.updated = Date.now(); saveLists(); renderLists();
}
function openSong(id) {
  if (!songById(id)) return;
  state.currentId = id; saveLocal(); render(); renderSongs();
}
function startList(l) {
  const songs = listSongs(l);
  if (!songs.length) return;
  state.currentListId = l.id;
  openSong(songs[0].id);
  closeDrawer();
  gigOn();
}

/* drawer tabs */
function showTab(which) {
  const songs = which === 'songs';
  $('#song-list').hidden = !songs;
  $('#list-pane').hidden = songs;
  $('#tab-songs').classList.toggle('on', songs);
  $('#tab-lists').classList.toggle('on', !songs);
  $('#tab-songs').setAttribute('aria-selected', String(songs));
  $('#tab-lists').setAttribute('aria-selected', String(!songs));
  $('#drawer-title').textContent = songs ? 'Songs' : 'Setlists';
  drawerTab = which;
  if (songs) renderSongs(); else renderLists();
}

/* ─── gig mode ──────────────────────────────────────────────────
   A second, read-only rendering of the song: no inputs, no tools, no
   dialogs — nothing that a sleeve can knock out of place mid-song. Every
   cue is on, including the line under each bar. It reads from the same
   state, so it works with no signal like the rest of the app. */
let wakeLock = null;
const GIG_SCALE = 'song-structure.gigScale';
let gigScale = parseFloat(localStorage.getItem(GIG_SCALE)) || 1;

const gigIsOn = () => !$('#gig').hidden;

function gigOn() {
  closeTools();
  /* If you walked in from the top bar, put yourself in whichever setlist has
     this song, so ‹ and › work without going back to the drawer first. */
  const cur = listById(state.currentListId);
  if (!cur || !(cur.songs || []).includes(state.currentId)) {
    const found = state.setlists.find(l => (l.songs || []).includes(state.currentId));
    state.currentListId = found ? found.id : null;
  }
  if (!$('#drawer').hidden) closeDrawer();
  $('#gig').hidden = false;
  document.body.classList.add('gig-on');
  applyGigScale();
  renderGig();
  keepAwake();
  $('#gig-body').scrollTop = 0;
  $('#gig-close').focus({ preventScroll: true });
}
function gigOff() {
  closeJump();
  $('#gig').hidden = true;
  document.body.classList.remove('gig-on');
  releaseWake();
  $('#btn-gig').focus({ preventScroll: true });
}
async function keepAwake() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}
function releaseWake() {
  try { if (wakeLock) wakeLock.release(); } catch (_) {}
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && gigIsOn()) keepAwake(); else if (!gigIsOn()) releaseWake();
});
function applyGigScale() {
  gigScale = Math.round(Math.min(1.8, Math.max(0.7, gigScale)) * 100) / 100;
  $('#gig').style.setProperty('--gs', gigScale);
  localStorage.setItem(GIG_SCALE, String(gigScale));
  if (gigIsOn()) fitGigChords();
}
function gigStep(d) {
  const l = listById(state.currentListId);
  if (!l) return;
  const songs = listSongs(l);
  const i = songs.findIndex(x => x.id === state.currentId);
  const nxt = songs[i + d];
  if (!nxt) return;
  openSong(nxt.id);
  renderGig();
  $('#gig-body').scrollTop = 0;
}

/* tap the setlist name to jump straight to another song in it */
function toggleJump() {
  const panel = $('#gig-jump');
  if (!panel.hidden) return closeJump();
  const l = listById(state.currentListId);
  if (!l) return;
  panel.innerHTML = '';
  listSongs(l).forEach((so, n) => {
    const b = el('button', 'gj-row' + (so.id === state.currentId ? ' on' : ''));
    b.type = 'button';
    b.append(el('span', 'gj-no', String(n + 1)), el('span', 'gj-title', so.title || 'Untitled'));
    b.onclick = () => { closeJump(); openSong(so.id); renderGig(); $('#gig-body').scrollTop = 0; };
    panel.appendChild(b);
  });
  panel.hidden = false;
  $('#gig-pos').setAttribute('aria-expanded', 'true');
}
function closeJump() {
  $('#gig-jump').hidden = true;
  $('#gig-pos').setAttribute('aria-expanded', 'false');
}

function renderGig() {
  const s = song();
  $('#gig-name').textContent = s.title || 'Untitled';
  const bits = [];
  if (s.artist) bits.push(s.artist);
  if (s.key) bits.push('Key ' + s.key);
  if (s.bpm) bits.push(s.bpm + ' bpm');
  if (s.time && s.time !== '4/4') bits.push(s.time);
  $('#gig-meta').textContent = bits.join('  ·  ');

  const l = listById(state.currentListId);
  const songs = l ? listSongs(l) : [];
  const i = songs.findIndex(x => x.id === s.id);
  const inList = !!l && i > -1;
  $('#gig-prev').hidden = !inList;
  $('#gig-next').hidden = !inList;
  $('#gig-prev').disabled = !inList || i === 0;
  $('#gig-next').disabled = !inList || i === songs.length - 1;
  const pos = $('#gig-pos');
  pos.innerHTML = '';
  if (inList) {
    pos.append(el('span', 'gp-name', l.name + '  \u00b7'), el('span', 'gp-n', `${i + 1}/${songs.length}`));
    pos.setAttribute('aria-label', `${l.name}, song ${i + 1} of ${songs.length} — jump to another`);
  }
  $('#gig-pos').hidden = !inList;
  if (!inList) closeJump();

  const foot = $('#gig-foot');
  const nxt = inList ? songs[i + 1] : null;
  foot.textContent = nxt ? 'Next: ' + (nxt.title || 'Untitled') : '';
  foot.hidden = !nxt;

  const host = $('#gig-body');
  host.innerHTML = '';
  if (!s.sections.length) {
    host.appendChild(el('p', 'gig-empty', 'This song has no regions yet.'));
    return;
  }
  let barNo = 1;
  s.sections.forEach(sec => {
    host.appendChild(gigSection(sec, barNo));
    barNo += barCount(sec);
  });
  fitGigChords();
}

/* Same idea as the editor's fitChord: "Cmaj7#11/G" must shrink to fit its bar
   rather than be cut off, and that has to hold at every A+ step. */
function fitGigChords() {
  document.querySelectorAll('#gig-body .g-ch').forEach(n => {
    n.style.fontSize = '';
    const txt = n.textContent;
    if (!txt) return;
    const cell = n.closest('.g-bar');
    const fields = n.parentElement.children.length;
    const avail = (cell.clientWidth - 10) / fields - 4;
    if (avail <= 0) return;
    const cs = getComputedStyle(n);
    const base = parseFloat(cs.fontSize);
    fitCtx.font = `${cs.fontWeight} ${base}px ${cs.fontFamily}`;
    const w = fitCtx.measureText(txt).width;
    if (w > avail) n.style.fontSize = Math.max(11, base * avail / w).toFixed(1) + 'px';
  });
}

function gigSection(sec, startBar) {
  const wrap = el('section', 'g-sect');
  wrap.style.setProperty('--sec', sec.color);
  const rows = packRows(sec.bars, startBar);

  rows.forEach((row, ri) => {
    const cues = rowCues(sec, row);
    if (cues.length) {
      const lane = el('div', 'g-cues');
      const base = row.items[0].no - cueOffset(sec, row.items[0].i);
      cues.forEach(c => {
        const abs = base + c.bar - 1;
        const item = row.items.find(it => abs >= it.no && abs < it.no + it.span) || row.items[0];
        const tag = el('span', 'g-cue');
        tag.append(c.icon || '📌', el('span', null, c.text));
        tag.style.gridColumn = `${item.col + 1} / span ${Math.max(1, item.span)}`;
        lane.appendChild(tag);
      });
      lane.style.gridTemplateColumns = `repeat(${PER_ROW},1fr)`;
      wrap.appendChild(lane);
    }

    const box = el('div', 'g-box');
    if (ri === 0) {
      const strip = el('div', 'g-strip');
      strip.append(el('span', 'g-name', sec.name || 'Region'));
      if ((sec.repeat || 1) > 1) strip.append(el('span', 'g-rep', '×' + sec.repeat));
      if (sec.note) strip.append(el('span', 'g-note', sec.note));
      box.appendChild(strip);
    }
    const line = el('div', 'g-row');
    line.style.gridTemplateColumns = `repeat(${Math.max(1, row.used)},1fr)`;
    row.items.forEach(it => {
      const cell = el('div', 'g-bar');
      cell.style.gridColumn = `span ${it.span}`;
      cell.append(el('span', 'g-no', it.span > 1 ? `${it.no}–${it.no + it.span - 1}` : String(it.no)));
      const ch = el('div', 'g-chords' + (it.bar.beats.length > 1 ? ' split' : ''));
      ch.style.setProperty('--beats', it.bar.beats.length);
      it.bar.beats.forEach(v => ch.appendChild(el('span', 'g-ch', v || '')));
      cell.appendChild(ch);
      /* every bar gets the cue slot, empty or not, so chords across a row sit
         on the same line instead of bobbing up and down */
      cell.appendChild(el('div', 'g-lyric', it.bar.lyric || ''));
      line.appendChild(cell);
    });
    box.appendChild(line);
    wrap.appendChild(box);
  });
  return wrap;
}

/* ─── PDF ───────────────────────────────────────────────────────
   The print stylesheet already lays the chart out cleanly, so "Save as PDF"
   in the browser's print dialog is the export — no library, no server,
   and the page you see is the page you get. */
function exportPDF() {
  const t = song().title || 'Song structure';
  const prev = document.title;
  document.title = t;                       /* becomes the PDF's filename */
  Tip.hide();
  const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
}

/* ─── backup / restore (JSON, from the Songs drawer) ────────────── */
async function exportSong() {
  const s = JSON.parse(JSON.stringify(song()));
  const blobs = {};
  const collect = async owner => {
    for (const m of owner.media || []) { const d = await Media.toDataURL(m.id); if (d) blobs[m.id] = d; }
  };
  await collect(s);
  for (const sec of s.sections) { await collect(sec); for (const b of sec.bars) await collect(b); }
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'song-structure/1', song: s, media: blobs }, null, 2)],
    { type: 'application/json' }));
  const a = el('a'); a.href = url;
  a.download = (s.title || 'song').replace(/[^\w\- ]+/g, '') + '.songstructure.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Exported (media included)');
}
async function importSong(file) {
  const data = JSON.parse(await file.text());
  const s = data.song || data;
  if (!s.sections) { toast('Not a song file'); return; }
  s.id = uid('s'); s.updated = Date.now();
  for (const [id, rec] of Object.entries(data.media || {})) await Media.fromDataURL(id, rec);
  state.songs.push(s); state.currentId = s.id;
  save(); render();
  toast(`Imported "${s.title || 'Untitled'}"`);
}

/* ─── misc ──────────────────────────────────────────────────────── */
let toastT;
function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  if (action) {                              /* "…sign in" is only useful if you can act on it */
    const b = el('button', 'toast-do', action.label);
    b.type = 'button';
    b.onclick = () => { t.hidden = true; action.run(); };
    t.appendChild(b);
  }
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, action ? 6000 : 2200);
}

/* ─── Save ──────────────────────────────────────────────────────
   Every keystroke is already written to this device, so Save is really
   "push it to my account now" — the one button people look for before
   they close a laptop or walk on stage. */
let savingNow = false;
/* Supabase restores the session from storage asynchronously. Pressing Save in
   the first second after a load must not report "not signed in" when there is
   a session sitting in storage waiting to be read. */
function settled() {
  if (!window.Cloud) return Promise.resolve();
  const stored = Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k));
  if (!stored) return Promise.resolve();
  return new Promise(res => {
    const t0 = Date.now();
    const tick = () => {
      if (Cloud.user || Cloud.state === 'off' || Cloud.state === 'nolib' || Date.now() - t0 > 2500) return res();
      setTimeout(tick, 120);
    };
    tick();
  });
}
async function saveNow() {
  if (savingNow) return;
  save();                                    /* flush the current song and queue it */
  const btn = $('#btn-save'), lbl = btn.querySelector('.lbl');
  const done = (text, action) => {
    const svg = btn.querySelector('svg');
    if (svg) svg.replaceWith(icon('check', 15));
    lbl.textContent = 'Saved';
    btn.classList.add('saved');
    setTimeout(() => {
      const cur = btn.querySelector('svg');
      if (cur) cur.replaceWith(icon('save', 15));
      lbl.textContent = 'Save';
      btn.classList.remove('saved');
    }, 1600);
    if (text) toast(text, action);
  };

  if (!window.Cloud || !Cloud.user) { lbl.textContent = 'Saving…'; await settled(); }
  if (!window.Cloud || !Cloud.user) {
    const dead = Cloud && (Cloud.state === 'off' || Cloud.state === 'nolib');
    const offline = !navigator.onLine;
    done(offline ? 'Saved on this device — it goes up when you have signal'
       : dead     ? 'Saved on this device'
       : 'Saved on this device — sign in to have it on every device',
       offline || dead ? null : { label: 'Sign in', run: cloudDialog });
    return;
  }
  savingNow = true; btn.disabled = true; lbl.textContent = 'Saving…';
  try {
    await Cloud.syncAll();
    const n = await Cloud.backfill();
    done(n ? `Saved — ${n} file${n === 1 ? '' : 's'} uploaded` : 'Saved to your account');
  } catch (e) {
    lbl.textContent = 'Save';
    toast(e.message || 'Could not reach your account — the chart is safe on this device');
  } finally { savingNow = false; btn.disabled = false; }
}

/* ⌘S / Ctrl-S does the same thing, instead of saving the page */
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveNow(); }
});

/* ─── wiring ────────────────────────────────────────────────────── */
$('#song-title').oninput  = e => {
  song().title = e.target.value; save();
  document.title = e.target.value ? `${e.target.value} — Song Structure` : 'Song Structure';
};
$('#song-artist').oninput = e => { song().artist = e.target.value; save(); };
$('#song-key').oninput    = e => { song().key = e.target.value; save(); };
$('#song-bpm').oninput    = e => { song().bpm = e.target.value; save(); };
$('#song-time').onchange  = e => { song().time = e.target.value; save(); };

$('#btn-add-section').onclick = sectionDialog;
$('#btn-songs').onclick    = openDrawer;
$('#drawer-close').onclick = closeDrawer;
$('#drawer-scrim').onclick = closeDrawer;
$('#btn-new-song').onclick = () => { const s = blankSong(); state.songs.push(s); state.currentId = s.id; save(); render(); $('#song-title').focus(); };
$('#btn-pdf').onclick      = exportPDF;
$('#btn-gig').onclick      = gigOn;
$('#gig-close').onclick    = gigOff;
$('#gig-pos').onclick      = toggleJump;
$('#gig-body').addEventListener('pointerdown', closeJump);
$('#gig-prev').onclick     = () => gigStep(-1);
$('#gig-next').onclick     = () => gigStep(1);
$('#gig-bigger').onclick   = () => { gigScale += 0.12; applyGigScale(); };
$('#gig-smaller').onclick  = () => { gigScale -= 0.12; applyGigScale(); };
$('#tab-songs').onclick    = () => showTab('songs');
$('#tab-lists').onclick    = () => showTab('lists');
$('#sheet-cancel').onclick = closeSheet;
$('#sheet-scrim').onclick  = closeSheet;
$('#btn-save').onclick     = saveNow;
$('#btn-cloud').onclick    = cloudDialog;
$('#btn-theme').onclick     = cycleTheme;
$('#btn-account').onclick  = () => { closeDrawer(); cloudDialog(); };
$('#btn-backup').onclick   = exportSong;
$('#btn-restore').onclick  = () => $('#import-file').click();
$('#import-file').onchange = e => { if (e.target.files[0]) importSong(e.target.files[0]); e.target.value = ''; };
$('#viewer-close').onclick = closeViewer;
$('#viewer').onclick = e => { if (e.target.id === 'viewer') closeViewer(); };

/* ─── theme ─────────────────────────────────────────────────────
   Three states, not two: a stage is dark, a rehearsal room is not, and the
   device's own setting is right most of the time — so "System" stays, and the
   choice is remembered per device. */
const THEME_KEY = 'song-structure.theme';
const THEMES = [
  { id: 'system', icon: 'auto', label: 'System' },
  { id: 'light',  icon: 'sun',  label: 'Light'  },
  { id: 'dark',   icon: 'moon', label: 'Dark'   }
];
let theme = localStorage.getItem(THEME_KEY) || 'system';
function applyTheme() {
  const t = THEMES.find(x => x.id === theme) || THEMES[0];
  if (t.id === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t.id);
  localStorage.setItem(THEME_KEY, t.id);
  /* the address bar / status bar follows the chart */
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement)
    .getPropertyValue('--panel').trim() || '#1f5fb0');
  const btn = $('#btn-theme');
  if (btn) {
    btn.innerHTML = '';
    btn.append(icon(t.icon, 15), el('span', 'lbl', t.label));
    btn.dataset.tip = `Theme: ${t.label} — click for ${(THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]).label}`;
    btn.setAttribute('aria-label', btn.dataset.tip);
  }
}
function cycleTheme() {
  const i = THEMES.findIndex(x => x.id === theme);
  theme = THEMES[(i + 1) % THEMES.length].id;
  applyTheme();
  toast(`Theme: ${(THEMES.find(x => x.id === theme) || THEMES[0]).label}`);
}

/* ─── offline ───────────────────────────────────────────────────
   A gig is the case this app has to survive: no signal, phone in airplane
   mode, chart still opens. The worker keeps a copy of the app itself; the
   songs were always in this browser. Asking for persistent storage is what
   stops iOS clearing them after a week of not opening the site. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
}

/* ─── tooltips ──────────────────────────────────────────────────
   Anything with data-tip gets one: 400ms on hover, instant on keyboard
   focus, dismissed by Escape (WCAG 1.4.13). Icon-only controls also carry
   an aria-label, so the tooltip is a convenience, never the only label. */
const Tip = (() => {
  let node, timer, current;
  const build = () => {
    if (node) return node;
    node = el('div', 'tip'); node.setAttribute('role', 'tooltip'); node.hidden = true;
    document.body.appendChild(node);
    return node;
  };
  function show(t) {
    const text = t.dataset.tip; if (!text) return;
    build(); node.textContent = text; node.hidden = false;
    const r = t.getBoundingClientRect(), n = node.getBoundingClientRect();
    let y = r.top - n.height - 8, below = false;
    if (y < 6) { y = r.bottom + 8; below = true; }
    const x = Math.max(8, Math.min(r.left + r.width / 2 - n.width / 2, innerWidth - n.width - 8));
    node.style.left = Math.round(x) + 'px';
    node.style.top  = Math.round(y) + 'px';
    node.classList.toggle('below', below);
    node.classList.add('on');
    current = t;
  }
  function hide() { clearTimeout(timer); if (node) { node.classList.remove('on'); node.hidden = true; } current = null; }
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) return hide();
    if (t === current) return;
    clearTimeout(timer); timer = setTimeout(() => show(t), 400);
  });
  document.addEventListener('mouseleave', hide, true);
  document.addEventListener('focusin',  e => { const t = e.target.closest('[data-tip]'); if (t) show(t); });
  document.addEventListener('focusout', hide);
  document.addEventListener('mousedown', hide);
  window.addEventListener('scroll', hide, true);
  return { hide };
})();

document.addEventListener('keydown', e => {
  if (gigIsOn()) {
    if (e.key === 'Escape')     { e.preventDefault(); if (!$('#gig-jump').hidden) closeJump(); else gigOff(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); gigStep(1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); gigStep(-1); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); gigScale += 0.12; applyGigScale(); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); gigScale -= 0.12; applyGigScale(); }
    return;
  }
  if (e.key === 'Escape') {
    Tip.hide();
    if (!$('#sheet').hidden) { e.preventDefault(); closeSheet(); return; }
    closeDrawer();
    if (!$('#viewer').hidden) closeViewer();
  }
  const typing = /input|textarea|select/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  /* a modal dialog sits in the top layer: opening another one under it, or
     showModal() on one already open, both end badly */
  if ($('dialog[open]') || !$('#sheet').hidden || !$('#viewer').hidden) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); sectionDialog(); }
  if (e.key === 'g' || e.key === 'G') { e.preventDefault(); gigOn(); }
});

/* icons declared in the markup */
document.querySelectorAll('[data-icon]').forEach(b => b.prepend(icon(b.dataset.icon, 15)));
applyTheme();
$('#logo').appendChild(icon('music', 17));

render();
Cloud.init();
