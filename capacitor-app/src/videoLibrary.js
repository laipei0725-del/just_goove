const DATABASE = 'just-groove-library';
const STORE = 'videos';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, work) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const listVideos = () => transact('readonly', (store) => store.getAll());
export const saveVideo = (video) => transact('readwrite', (store) => store.put(video));
export const removeVideo = (id) => transact('readwrite', (store) => store.delete(id));

export function sourceFor(video) {
  if (video.type === 'local' && video.blob) return URL.createObjectURL(video.blob);
  return video.embedUrl || video.originalUrl;
}
