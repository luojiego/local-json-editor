import { getStoragePrefix } from './workspaceScope';

const DB_NAME = `${getStoragePrefix()}-storage`;
const DB_VERSION = 1;

export const HISTORY_STORE_NAME = 'history-records';

export async function openStorageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const historyStore = database.createObjectStore(HISTORY_STORE_NAME, {
          keyPath: 'id',
        });
        historyStore.createIndex('by-workspace', 'workspaceScope', { unique: false });
        historyStore.createIndex('by-workspace-saved-at', ['workspaceScope', 'savedAt'], {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开 IndexedDB 失败'));
  });
}
