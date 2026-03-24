import { create } from 'zustand';

import { loadFavoriteFileIds, saveFavoriteFileIds } from '../lib/favorites';
import type {
  CursorPosition,
  DirectoryTreeNode,
  JsonFileRecord,
  ScrollPosition,
  ValidationState,
} from '../types/editor';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type JsonIndentSize = 2 | 4;

interface DirectoryPayload {
  directoryHandle: FileSystemDirectoryHandle;
  directoryName: string;
  files: JsonFileRecord[];
  tree: DirectoryTreeNode;
  expandedDirectoryIds: string[];
}

interface EditorStore {
  directoryHandle: FileSystemDirectoryHandle | null;
  directoryName: string;
  files: JsonFileRecord[];
  tree: DirectoryTreeNode | null;
  activeFileId: string | null;
  content: string;
  persistedContent: string;
  isDirty: boolean;
  searchQuery: string;
  expandedDirectories: Record<string, boolean>;
  favoriteFileIds: string[];
  validation: ValidationState;
  cursor: CursorPosition;
  scroll: ScrollPosition;
  themeId: string;
  indentSize: JsonIndentSize;
  autoSaveOnFocus: boolean;
  isSidebarCollapsed: boolean;
  saveStatus: SaveStatus;
  statusMessage: string;
  setDirectoryData: (payload: DirectoryPayload) => void;
  setActiveFileContent: (fileId: string, content: string) => void;
  setContent: (content: string) => void;
  setDirty: (dirty: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleDirectoryExpanded: (directoryId: string) => void;
  toggleFavoriteFile: (fileId: string) => void;
  moveFavoriteFile: (draggingFileId: string, targetFileId: string) => void;
  setValidation: (validation: ValidationState) => void;
  setCursor: (cursor: CursorPosition) => void;
  setScroll: (scroll: ScrollPosition) => void;
  setThemeId: (themeId: string) => void;
  setIndentSize: (indentSize: JsonIndentSize) => void;
  setAutoSaveOnFocus: (enabled: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSaveState: (saveStatus: SaveStatus, statusMessage: string) => void;
  markSaved: (persistedContent: string) => void;
}

const THEME_STORAGE_KEY = 'json-editor-theme';
const AUTO_SAVE_ON_FOCUS_STORAGE_KEY = 'json-editor-auto-save-on-focus';
const DEFAULT_THEME_ID = readThemeFromStorage();
const DEFAULT_AUTO_SAVE_ON_FOCUS = readAutoSaveOnFocusFromStorage();

export const useEditorStore = create<EditorStore>((set) => ({
  directoryHandle: null,
  directoryName: '',
  files: [],
  tree: null,
  activeFileId: null,
  content: '',
  persistedContent: '',
  isDirty: false,
  searchQuery: '',
  expandedDirectories: {},
  favoriteFileIds: [],
  validation: {
    errorCount: 0,
    message: '请选择一个 JSON 文件开始编辑',
  },
  cursor: {
    line: 1,
    column: 1,
  },
  scroll: {
    top: 0,
    left: 0,
  },
  themeId: DEFAULT_THEME_ID,
  indentSize: 2,
  autoSaveOnFocus: DEFAULT_AUTO_SAVE_ON_FOCUS,
  isSidebarCollapsed: false,
  saveStatus: 'idle',
  statusMessage: '未保存',
  setDirectoryData: ({ directoryHandle, directoryName, files, tree, expandedDirectoryIds }) => {
    const expandedDirectories = Object.fromEntries(
      expandedDirectoryIds.map((directoryId) => [directoryId, true]),
    );
    const availableFileIds = new Set(files.map((file) => file.id));
    const persistedFavoriteFileIds = loadFavoriteFileIds(directoryName);
    const favoriteFileIds = persistedFavoriteFileIds.filter((fileId) => availableFileIds.has(fileId));

    if (persistedFavoriteFileIds.length !== favoriteFileIds.length) {
      saveFavoriteFileIds(directoryName, favoriteFileIds);
    }

    set({
      directoryHandle,
      directoryName,
      files,
      tree,
      expandedDirectories,
      favoriteFileIds,
      activeFileId: null,
      content: '',
      persistedContent: '',
      isDirty: false,
      searchQuery: '',
      validation: {
        errorCount: 0,
        message: '请选择一个 JSON 文件开始编辑',
      },
      cursor: {
        line: 1,
        column: 1,
      },
      scroll: {
        top: 0,
        left: 0,
      },
      saveStatus: 'idle',
      statusMessage: '目录已打开',
    });
  },
  setActiveFileContent: (fileId, content) => {
    set({
      activeFileId: fileId,
      content,
      persistedContent: content,
      isDirty: false,
      validation: {
        errorCount: 0,
        message: 'JSON 格式正确',
      },
      cursor: {
        line: 1,
        column: 1,
      },
      scroll: {
        top: 0,
        left: 0,
      },
      saveStatus: 'idle',
      statusMessage: '文件已加载',
    });
  },
  setContent: (content) => {
    set({ content });
  },
  setDirty: (isDirty) => {
    set({ isDirty, saveStatus: 'idle', statusMessage: isDirty ? '未保存' : '就绪' });
  },
  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
  },
  toggleDirectoryExpanded: (directoryId) => {
    set((state) => ({
      expandedDirectories: {
        ...state.expandedDirectories,
        [directoryId]: !state.expandedDirectories[directoryId],
      },
    }));
  },
  toggleFavoriteFile: (fileId) => {
    set((state) => {
      if (!state.directoryName) {
        console.warn('无法切换收藏状态：未打开目录');
        return {};
      }

      if (!state.files.some((file) => file.id === fileId)) {
        console.warn('无法切换收藏状态：文件不存在');
        return {};
      }

      const exists = state.favoriteFileIds.includes(fileId);
      const nextFavoriteFileIds = exists
        ? state.favoriteFileIds.filter((id) => id !== fileId)
        : [...state.favoriteFileIds, fileId];

      try {
        saveFavoriteFileIds(state.directoryName, nextFavoriteFileIds);
        return { favoriteFileIds: nextFavoriteFileIds };
      } catch (error) {
        console.error('保存收藏状态失败:', error);
        return {};
      }
    });
  },
  moveFavoriteFile: (draggingFileId, targetFileId) => {
    set((state) => {
      if (!state.directoryName) {
        console.warn('无法移动收藏文件：未打开目录');
        return {};
      }

      if (draggingFileId === targetFileId) {
        return {};
      }

      const fromIndex = state.favoriteFileIds.indexOf(draggingFileId);
      const toIndex = state.favoriteFileIds.indexOf(targetFileId);

      if (fromIndex < 0) {
        console.warn('无法移动收藏文件：源文件不在收藏列表中');
        return {};
      }

      if (toIndex < 0) {
        console.warn('无法移动收藏文件：目标文件不在收藏列表中');
        return {};
      }

      const nextFavoriteFileIds = [...state.favoriteFileIds];
      nextFavoriteFileIds.splice(fromIndex, 1);
      nextFavoriteFileIds.splice(toIndex, 0, draggingFileId);

      try {
        saveFavoriteFileIds(state.directoryName, nextFavoriteFileIds);
        return { favoriteFileIds: nextFavoriteFileIds };
      } catch (error) {
        console.error('保存收藏顺序失败:', error);
        return {};
      }
    });
  },
  setValidation: (validation) => {
    set({ validation });
  },
  setCursor: (cursor) => {
    set({ cursor });
  },
  setScroll: (scroll) => {
    set({ scroll });
  },
  setThemeId: (themeId) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    set({ themeId });
  },
  setIndentSize: (indentSize) => {
    set({ indentSize });
  },
  setAutoSaveOnFocus: (autoSaveOnFocus) => {
    localStorage.setItem(AUTO_SAVE_ON_FOCUS_STORAGE_KEY, autoSaveOnFocus ? '1' : '0');
    set({ autoSaveOnFocus });
  },
  toggleSidebarCollapsed: () => {
    set((state) => ({
      isSidebarCollapsed: !state.isSidebarCollapsed,
    }));
  },
  setSidebarCollapsed: (isSidebarCollapsed) => {
    set({ isSidebarCollapsed });
  },
  setSaveState: (saveStatus, statusMessage) => {
    set({ saveStatus, statusMessage });
  },
  markSaved: (persistedContent) => {
    set({ persistedContent, isDirty: false, saveStatus: 'saved', statusMessage: '已保存' });
  },
}));

function readThemeFromStorage(): string {
  const fallback = 'github-light';

  if (typeof window === 'undefined') {
    return fallback;
  }

  return localStorage.getItem(THEME_STORAGE_KEY) ?? fallback;
}

function readAutoSaveOnFocusFromStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(AUTO_SAVE_ON_FOCUS_STORAGE_KEY) === '1';
}
