const FAVORITE_FILES_STORAGE_KEY = 'json-editor-favorite-files';
const SAVE_DEBOUNCE_MS = 300;

let saveTimeoutId: number | null = null;

export function loadFavoriteFileIds(
  directoryName: string,
  availableFileIds?: Set<string>,
): string[] {
  if (typeof window === 'undefined' || !directoryName) {
    return [];
  }

  try {
    const state = readFavoriteState();
    const favorites = sanitizeFavoriteIds(state[directoryName]);

    if (!availableFileIds) {
      return favorites;
    }

    return favorites.filter((fileId) => availableFileIds.has(fileId));
  } catch (error) {
    console.error('加载收藏文件失败:', error);
    return [];
  }
}

export function saveFavoriteFileIds(directoryName: string, favoriteFileIds: string[]): void {
  if (typeof window === 'undefined' || !directoryName) {
    return;
  }

  if (saveTimeoutId !== null) {
    window.clearTimeout(saveTimeoutId);
  }

  saveTimeoutId = window.setTimeout(() => {
    try {
      const state = readFavoriteState();
      const sanitized = sanitizeFavoriteIds(favoriteFileIds);

      if (sanitized.length === 0) {
        delete state[directoryName];
      } else {
        state[directoryName] = sanitized;
      }

      localStorage.setItem(FAVORITE_FILES_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('保存收藏文件失败:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage 存储空间已满，无法保存收藏列表');
      }
    }
    saveTimeoutId = null;
  }, SAVE_DEBOUNCE_MS);
}

export function saveFavoriteFileIdsImmediate(directoryName: string, favoriteFileIds: string[]): void {
  if (typeof window === 'undefined' || !directoryName) {
    return;
  }

  if (saveTimeoutId !== null) {
    window.clearTimeout(saveTimeoutId);
    saveTimeoutId = null;
  }

  try {
    const state = readFavoriteState();
    const sanitized = sanitizeFavoriteIds(favoriteFileIds);

    if (sanitized.length === 0) {
      delete state[directoryName];
    } else {
      state[directoryName] = sanitized;
    }

    localStorage.setItem(FAVORITE_FILES_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('保存收藏文件失败:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage 存储空间已满，无法保存收藏列表');
    }
  }
}

function readFavoriteState(): Record<string, unknown> {
  const raw = localStorage.getItem(FAVORITE_FILES_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
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
