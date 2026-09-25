/* Media store — blobs live in IndexedDB so images/audio/video never hit localStorage.
   The same database also holds a full copy of the chart library (the `vault`
   store): localStorage is a 5 MB box that a browser may clear on its own, and
   when it goes, an offline device has nothing to show. Two copies, one of them
   in a store with real space, is what makes "no signal" survivable. */
const DB_NAME = 'song-structure', DB_VER = 2;
const STORE_MEDIA = 'media', STORE_VAULT = 'vault';
let DBP = null;
function dbOpen() {
  if (DBP) return DBP;
  DBP = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_VAULT)) db.createObjectStore(STORE_VAULT, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return DBP;
}
async function dbTx(store, mode, fn) {
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

const Media = (() => {
  const tx = (mode, fn) => dbTx(STORE_MEDIA, mode, fn);

  const kind = (type, name = '') => {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    if (/\.(png|jpe?g|gif|webp|heic)$/i.test(name)) return 'image';
    if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) return 'audio';
    if (/\.(mp4|mov|webm|m4v)$/i.test(name)) return 'video';
    return 'file';
  };

  return {
    kind,
    async put(file) {
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const rec = { id, name: file.name || 'clip', type: file.type || '', kind: kind(file.type || '', file.name || ''), blob: file };
      await tx('readwrite', s => s.put(rec));
      return { id: rec.id, name: rec.name, type: rec.type, kind: rec.kind };
    },
    get(id) { return tx('readonly', s => s.get(id)); },
    del(id) { return tx('readwrite', s => s.delete(id)); },
    async url(id) {
      const rec = await this.get(id);
      return rec ? URL.createObjectURL(rec.blob) : null;
    },
    /* store a blob that came from somewhere else (e.g. the server) */
    async cache(id, blob, meta = {}) {
      const rec = { id, name: meta.name || 'clip', type: meta.type || blob.type || '',
                    kind: meta.kind || kind(blob.type || '', meta.name || ''), blob };
      await tx('readwrite', s => s.put(rec));
      return rec;
    },

    /* export/import support */
    async toDataURL(id) {
      const rec = await this.get(id);
      if (!rec) return null;
      return await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res({ name: rec.name, type: rec.type, kind: rec.kind, data: fr.result });
        fr.readAsDataURL(rec.blob);
      });
    },
    async fromDataURL(id, rec) {
      const blob = await (await fetch(rec.data)).blob();
      await tx('readwrite', s => s.put({ id, name: rec.name, type: rec.type, kind: rec.kind, blob }));
    },
    /* which of these ids this device actually holds, and how much they weigh */
    async audit(ids) {
      const have = [], missing = [];
      let bytes = 0;
      for (const id of ids) {
        const rec = await this.get(id).catch(() => null);
        if (rec) { have.push(id); bytes += (rec.blob && rec.blob.size) || 0; } else missing.push(id);
      }
      return { have, missing, bytes };
    }
  };
})();
window.Media = Media;

/* ─── the vault ─────────────────────────────────────────────────
   One record, the whole library, written beside every localStorage write.
   It is never read in preference to localStorage — only used to put back
   what localStorage has lost. Nothing here is ever deleted. */
const Vault = (() => {
  const ID = 'library';
  return {
    async put(json) {
      try { await dbTx(STORE_VAULT, 'readwrite', s => s.put({ id: ID, json, at: Date.now() })); return true; }
      catch (e) { console.warn('[vault] write failed', e); return false; }
    },
    async get() {
      try { return await dbTx(STORE_VAULT, 'readonly', s => s.get(ID)) || null; }
      catch (e) { console.warn('[vault] read failed', e); return null; }
    }
  };
})();
window.Vault = Vault;
