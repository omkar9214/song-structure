/* Media store — blobs live in IndexedDB so images/audio/video never hit localStorage. */
const Media = (() => {
  const DB = 'song-structure', STORE = 'media', VER = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  }

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
    }
  };
})();
