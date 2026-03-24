import { buildScopedStorageKey } from './workspaceScope';

const SAVE_DEBOUNCE_MS = 300;
const FAVORITE_FILES_STORAGE_KEY = 'favorite-files';

let saveTimeoutId: number | null = null;

export function loadFavoriteFileIds(
  workspaceScope: string,
  availableFileIds?: Set<string>,
): string[] {
  if (typeof window === 'undefined' || !workspaceScope) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getFavoritesStorageKey(workspaceScope));
    const favorites = sanitizeFavoriteIds(raw ? JSON.parse(raw) : []);

    if (!availableFileIds) {
      return favorites;
    }

    return favorites.filter((fileId) => availableFileIds.has(fileId));
  } catch (error) {
    console.error('加载收藏文件失败:', error);
    return [];
  }
}

export function saveFavoriteFileIds(workspaceScope: string, favoriteFileIds: string[]): void {
  if (typeof window === 'undefined' || !workspaceScope) {
    return;
  }

  if (saveTimeoutId !== null) {
    window.clearTimeout(saveTimeoutId);
  }

  saveTimeoutId = window.setTimeout(() => {
    persistFavoriteFileIds(workspaceScope, favoriteFileIds);
    saveTimeoutId = null;
  }, SAVE_DEBOUNCE_MS);
}

export function saveFavoriteFileIdsImmediate(workspaceScope: string, favoriteFileIds: string[]): void {
  if (typeof window === 'undefined' || !workspaceScope) {
    return;
  }

  if (saveTimeoutId !== null) {
    window.clearTimeout(saveTimeoutId);
    saveTimeoutId = null;
  }

  persistFavoriteFileIds(workspaceScope, favoriteFileIds);
}

function persistFavoriteFileIds(workspaceScope: string, favoriteFileIds: string[]): void {
  try {
    const sanitized = sanitizeFavoriteIds(favoriteFileIds);
    const storageKey = getFavoritesStorageKey(workspaceScope);

    if (sanitized.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sanitized));
  } catch (error) {
    console.error('保存收藏文件失败:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage 存储空间已满，无法保存收藏列表');
    }
  }
}

function getFavoritesStorageKey(workspaceScope: string): string {
  return buildScopedStorageKey(FAVORITE_FILES_STORAGE_KEY, workspaceScope);
}

function sanitizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<string>();
  const sanitized: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed || uniqueIds.has(trimmed)) {
      continue;
    }

    uniqueIds.add(trimmed);
    sanitized.push(trimmed);
  }

  return sanitized;
}
