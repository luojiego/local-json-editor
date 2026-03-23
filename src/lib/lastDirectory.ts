const DB_NAME = 'json-editor-storage';
const STORE_NAME = 'file-system-handles';
const LAST_DIRECTORY_KEY = 'last-directory';
const DB_VERSION = 1;

export async function saveLastDirectoryHandle(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<void> {
  if (!('indexedDB' in window)) {
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('保存目录句柄失败'));
    transaction.objectStore(STORE_NAME).put(directoryHandle, LAST_DIRECTORY_KEY);
  });

  database.close();
}

export async function loadLastDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!('indexedDB' in window)) {
    return null;
  }

  const database = await openDatabase();

  const value = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(LAST_DIRECTORY_KEY);

    request.onsuccess = () => {
      const result = request.result;
      if (isDirectoryHandle(result)) {
        resolve(result);
        return;
      }
      resolve(null);
    };

    request.onerror = () => reject(request.error ?? new Error('读取目录句柄失败'));
  });

  database.close();
  return value;
}

export async function clearLastDirectoryHandle(): Promise<void> {
  if (!('indexedDB' in window)) {
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('清理目录句柄失败'));
    transaction.objectStore(STORE_NAME).delete(LAST_DIRECTORY_KEY);
  });

  database.close();
}

export async function ensureDirectoryPermission(
  directoryHandle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  const permissionAwareHandle = directoryHandle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
    requestPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
  };

  if (!permissionAwareHandle.queryPermission || !permissionAwareHandle.requestPermission) {
    return true;
  }

  const queried = await permissionAwareHandle.queryPermission({ mode });
  if (queried === 'granted') {
    return true;
  }

  if (queried === 'denied') {
    return false;
  }

  const requested = await permissionAwareHandle.requestPermission({ mode });
  return requested === 'granted';
}

export async function queryDirectoryPermission(
  directoryHandle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<PermissionState> {
  const permissionAwareHandle = directoryHandle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;
  };

  if (!permissionAwareHandle.queryPermission) {
    return 'granted';
  }

  return permissionAwareHandle.queryPermission({ mode });
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开 IndexedDB 失败'));
  });
}

function isDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FileSystemDirectoryHandle>;
  return candidate.kind === 'directory';
}
