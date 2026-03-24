const DB_NAME = 'json-editor-storage';
const DB_VERSION = 2;

export const FILE_SYSTEM_HANDLES_STORE_NAME = 'file-system-handles';
export const HISTORY_STORE_NAME = 'history-records';

export async function openStorageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(FILE_SYSTEM_HANDLES_STORE_NAME)) {
        database.createObjectStore(FILE_SYSTEM_HANDLES_STORE_NAME);
      }

      if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const historyStore = database.createObjectStore(HISTORY_STORE_NAME, {
          keyPath: 'id',
        });
        historyStore.createIndex('by-directory', 'directoryName', { unique: false });
        historyStore.createIndex('by-directory-saved-at', ['directoryName', 'savedAt'], {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开 IndexedDB 失败'));
  });
}
