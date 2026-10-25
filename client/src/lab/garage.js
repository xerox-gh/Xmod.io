// IndexedDB stores real structured objects and thumbnails, not a small
// localStorage string. Nothing is uploaded; the browser owns its storage quota.
export class Garage {
  constructor() {
    this.promise = null;
  }
  open() {
    return (this.promise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('xmod-local-garage', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('items', { keyPath: 'id' });
        store.createIndex('created', 'created');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error('Browser storage is unavailable: ' + request.error?.message));
    }));
  }
  async transaction(mode, run) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', mode),
        request = run(tx.objectStore('items'));
      let result;
      request.onsuccess = () => (result = request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error('Could not save to this browser'));
    });
  }
  async save(kind, name, data, thumbnail = null) {
    const item = {
      id: crypto.randomUUID(),
      kind,
      name: String(name || 'Untitled').slice(0, 80),
      created: Date.now(),
      data,
      thumbnail,
    };
    await this.transaction('readwrite', (s) => s.put(item));
    return item;
  }
  async list() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', 'readonly'),
        request = tx.objectStore('items').openCursor(),
        items = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const { id, kind, name, created, thumbnail } = cursor.value;
        items.push({ id, kind, name, created, thumbnail });
        cursor.continue();
      };
      tx.oncomplete = () => resolve(items.sort((a, b) => b.created - a.created));
      tx.onerror = () => reject(tx.error);
    });
  }
  async get(id) {
    return this.transaction('readonly', (s) => s.get(id));
  }
  async remove(id) {
    return this.transaction('readwrite', (s) => s.delete(id));
  }
}
