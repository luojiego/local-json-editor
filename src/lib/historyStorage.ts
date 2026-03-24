import { HISTORY_STORE_NAME, openStorageDatabase } from './storageDb';
import type { HistoryAnchor, HistoryEntry, HistoryTrigger } from '../types/history';

export const MAX_HISTORY_ENTRIES_PER_WORKSPACE = 200;

interface AppendHistoryEntryInput {
  id?: string;
  workspaceScope: string;
  workspaceName: string;
  fileId: string;
  fileRelativePath: string;
  trigger: HistoryTrigger;
  savedAt?: number;
  beforeContent: string;
  afterContent: string;
  anchor: HistoryAnchor;
}

export async function appendHistoryEntry(input: AppendHistoryEntryInput): Promise<void> {
  if (!('indexedDB' in window) || !input.workspaceScope) {
    return;
  }

  const entry = createHistoryEntry(input);
  const database = await openStorageDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('写入历史记录失败'));

    transaction.objectStore(HISTORY_STORE_NAME).put(entry);
  });

  database.close();
}

export async function listWorkspaceHistory(workspaceScope: string): Promise<HistoryEntry[]> {
  if (!('indexedDB' in window) || !workspaceScope) {
    return [];
  }

  const database = await openStorageDatabase();

  const entries = await new Promise<HistoryEntry[]>((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE_NAME, 'readonly');
    transaction.onerror = () => reject(transaction.error ?? new Error('读取历史记录失败'));

    const index = transaction.objectStore(HISTORY_STORE_NAME).index('by-workspace');
    const request = index.getAll(IDBKeyRange.only(workspaceScope));
    request.onsuccess = () => {
      const items: HistoryEntry[] = [];
      for (const raw of request.result as unknown[]) {
        const parsed = parseHistoryEntry(raw);
        if (parsed) {
          items.push(parsed);
        }
      }
      resolve(items);
    };
    request.onerror = () => reject(request.error ?? new Error('读取历史记录失败'));
  });

  database.close();

  return entries.sort((left, right) => {
    if (left.savedAt !== right.savedAt) {
      return right.savedAt - left.savedAt;
    }
    return right.id.localeCompare(left.id);
  });
}

export async function clearWorkspaceHistory(workspaceScope: string): Promise<void> {
  if (!('indexedDB' in window) || !workspaceScope) {
    return;
  }

  const database = await openStorageDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('清空历史记录失败'));

    const index = transaction.objectStore(HISTORY_STORE_NAME).index('by-workspace');
    const request = index.openCursor(IDBKeyRange.only(workspaceScope));

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      cursor.delete();
      cursor.continue();
    };

    request.onerror = () => reject(request.error ?? new Error('清空历史记录失败'));
  });

  database.close();
}

export async function clearAllHistory(): Promise<void> {
  if (!('indexedDB' in window)) {
    return;
  }

  const database = await openStorageDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('清空全部历史记录失败'));
    transaction.objectStore(HISTORY_STORE_NAME).clear();
  });

  database.close();
}

export async function pruneWorkspaceHistory(
  workspaceScope: string,
  maxEntries = MAX_HISTORY_ENTRIES_PER_WORKSPACE,
): Promise<number> {
  if (!workspaceScope || maxEntries <= 0) {
    return 0;
  }

  const entries = await listWorkspaceHistory(workspaceScope);
  if (entries.length <= maxEntries) {
    return 0;
  }

  const staleEntries = entries.slice(maxEntries);
  const staleEntryIds = new Set(staleEntries.map((entry) => entry.id));
  if (staleEntryIds.size === 0) {
    return 0;
  }

  const database = await openStorageDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('裁剪历史记录失败'));

    const store = transaction.objectStore(HISTORY_STORE_NAME);
    for (const entryId of staleEntryIds) {
      store.delete(entryId);
    }
  });

  database.close();
  return staleEntries.length;
}

function createHistoryEntry(input: AppendHistoryEntryInput): HistoryEntry {
  const savedAt = Number.isFinite(input.savedAt) ? Math.floor(input.savedAt as number) : Date.now();

  return {
    id: input.id?.trim() || generateHistoryEntryId(savedAt),
    workspaceScope: input.workspaceScope,
    workspaceName: input.workspaceName,
    fileId: input.fileId,
    fileRelativePath: input.fileRelativePath,
    trigger: input.trigger,
    savedAt: Math.max(0, savedAt),
    beforeContent: input.beforeContent,
    afterContent: input.afterContent,
    anchor: {
      line: Math.max(1, Math.floor(input.anchor.line)),
      column: Math.max(1, Math.floor(input.anchor.column)),
    },
  };
}

function parseHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<HistoryEntry>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.workspaceScope !== 'string' ||
    typeof candidate.workspaceName !== 'string' ||
    typeof candidate.fileId !== 'string' ||
    typeof candidate.fileRelativePath !== 'string' ||
    (candidate.trigger !== 'manual' && candidate.trigger !== 'auto') ||
    typeof candidate.savedAt !== 'number' ||
    !Number.isFinite(candidate.savedAt) ||
    typeof candidate.beforeContent !== 'string' ||
    typeof candidate.afterContent !== 'string'
  ) {
    return null;
  }

  const anchor = parseAnchor(candidate.anchor);
  if (!anchor) {
    return null;
  }

  return {
    id: candidate.id,
    workspaceScope: candidate.workspaceScope,
    workspaceName: candidate.workspaceName,
    fileId: candidate.fileId,
    fileRelativePath: candidate.fileRelativePath,
    trigger: candidate.trigger,
    savedAt: Math.max(0, Math.floor(candidate.savedAt)),
    beforeContent: candidate.beforeContent,
    afterContent: candidate.afterContent,
    anchor,
  };
}

function parseAnchor(value: unknown): HistoryAnchor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const anchor = value as Partial<HistoryAnchor>;
  if (
    typeof anchor.line !== 'number' ||
    !Number.isFinite(anchor.line) ||
    typeof anchor.column !== 'number' ||
    !Number.isFinite(anchor.column)
  ) {
    return null;
  }

  return {
    line: Math.max(1, Math.floor(anchor.line)),
    column: Math.max(1, Math.floor(anchor.column)),
  };
}

function generateHistoryEntryId(savedAt: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomSuffix = Math.random().toString(16).slice(2, 10);
  return `${savedAt}-${randomSuffix}`;
}
