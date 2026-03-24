import { create } from 'zustand';

import {
  loadFavoriteFileIds,
  saveFavoriteFileIds,
  saveFavoriteFileIdsImmediate,
} from '../lib/favorites';
import { pruneFileEditorStates, type FileEditorState } from '../lib/lastOpenState';
import { getStoragePrefix } from '../lib/workspaceScope';
import type {
  CursorPosition,
  DirectoryTreeNode,
  JsonFileRecord,
  ScrollPosition,
  ValidationState,
} from '../types/editor';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type JsonIndentSize = 2 | 4;
type FavoriteMovePosition = 'before' | 'after';

interface DirectoryPayload {
  workspacePath: string;
  workspaceScope: string;
  directoryName: string;
  files: JsonFileRecord[];
  tree: DirectoryTreeNode;
  expandedDirectoryIds: string[];
  fileViewStates?: Record<string, FileEditorState>;
}

interface EditorStore {
  workspacePath: string;
  workspaceScope: string;
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
  fileViewStates: Record<string, FileEditorState>;
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
  moveFavoriteFile: (
    draggingFileId: string,
    targetFileId: string,
    position?: FavoriteMovePosition,
  ) => void;
  setValidation: (validation: ValidationState) => void;
  setCursor: (cursor: CursorPosition) => void;
  setScroll: (scroll: ScrollPosition) => void;
  markActiveFileFormatted: (cursorOffset: number) => void;
  clearActiveFileFormatted: () => void;
  setThemeId: (themeId: string) => void;
  setIndentSize: (indentSize: JsonIndentSize) => void;
  setAutoSaveOnFocus: (enabled: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSaveState: (saveStatus: SaveStatus, statusMessage: string) => void;
  markSaved: (persistedContent: string) => void;
}

const STORAGE_PREFIX = getStoragePrefix();
const THEME_STORAGE_KEY = `${STORAGE_PREFIX}-theme`;
const AUTO_SAVE_ON_FOCUS_STORAGE_KEY = `${STORAGE_PREFIX}-auto-save-on-focus`;
const DEFAULT_THEME_ID = readThemeFromStorage();
const DEFAULT_AUTO_SAVE_ON_FOCUS = readAutoSaveOnFocusFromStorage();
const DEFAULT_CURSOR: CursorPosition = { line: 1, column: 1 };
const DEFAULT_SCROLL: ScrollPosition = { top: 0, left: 0 };

export const useEditorStore = create<EditorStore>((set) => ({
  workspacePath: '',
  workspaceScope: '',
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
  fileViewStates: {},
  validation: {
    errorCount: 0,
    message: '请选择一个 JSON 文件开始编辑',
  },
  cursor: { ...DEFAULT_CURSOR },
  scroll: { ...DEFAULT_SCROLL },
  themeId: DEFAULT_THEME_ID,
  indentSize: 2,
  autoSaveOnFocus: DEFAULT_AUTO_SAVE_ON_FOCUS,
  isSidebarCollapsed: false,
  saveStatus: 'idle',
  statusMessage: '未保存',
  setDirectoryData: ({
    workspacePath,
    workspaceScope,
    directoryName,
    files,
    tree,
    expandedDirectoryIds,
    fileViewStates = {},
  }) => {
    const expandedDirectories = Object.fromEntries(
      expandedDirectoryIds.map((directoryId) => [directoryId, true]),
    );
    const availableFileIds = new Set(files.map((file) => file.id));
    const nextFileViewStates = pruneFileEditorStates(fileViewStates, availableFileIds);
    const persistedFavoriteFileIds = loadFavoriteFileIds(workspaceScope);
    const favoriteFileIds = persistedFavoriteFileIds.filter((fileId) => availableFileIds.has(fileId));

    if (persistedFavoriteFileIds.length !== favoriteFileIds.length) {
      saveFavoriteFileIds(workspaceScope, favoriteFileIds);
    }

    set({
      workspacePath,
      workspaceScope,
      directoryName,
      files,
      tree,
      expandedDirectories,
      favoriteFileIds,
      fileViewStates: nextFileViewStates,
      activeFileId: null,
      content: '',
      persistedContent: '',
      isDirty: false,
      searchQuery: '',
      validation: {
        errorCount: 0,
        message: '请选择一个 JSON 文件开始编辑',
      },
      cursor: { ...DEFAULT_CURSOR },
      scroll: { ...DEFAULT_SCROLL },
      saveStatus: 'idle',
      statusMessage: '目录已打开',
    });
  },
  setActiveFileContent: (fileId, content) => {
    set((state) => {
      const nextFileState = state.fileViewStates[fileId] ?? createDefaultFileEditorState();

      return {
        activeFileId: fileId,
        content,
        persistedContent: content,
        isDirty: false,
        validation: {
          errorCount: 0,
          message: 'JSON 格式正确',
        },
        fileViewStates: {
          ...state.fileViewStates,
          [fileId]: nextFileState,
        },
        cursor: { ...nextFileState.cursor },
        scroll: { ...nextFileState.scroll },
        saveStatus: 'idle',
        statusMessage: '文件已加载',
      };
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
      if (!state.workspaceScope) {
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
        saveFavoriteFileIds(state.workspaceScope, nextFavoriteFileIds);
        return { favoriteFileIds: nextFavoriteFileIds };
      } catch (error) {
        console.error('保存收藏状态失败:', error);
        return {};
      }
    });
  },
  moveFavoriteFile: (draggingFileId, targetFileId, position = 'before') => {
    set((state) => {
      if (!state.workspaceScope) {
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

      const insertionIndex = resolveInsertionIndex({
        fromIndex,
        toIndex,
        position,
      });
      nextFavoriteFileIds.splice(insertionIndex, 0, draggingFileId);

      try {
        saveFavoriteFileIdsImmediate(state.workspaceScope, nextFavoriteFileIds);
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
    set((state) => ({
      cursor,
      fileViewStates: patchActiveFileViewState(state, { cursor }),
    }));
  },
  setScroll: (scroll) => {
    set((state) => ({
      scroll,
      fileViewStates: patchActiveFileViewState(state, { scroll }),
    }));
  },
  markActiveFileFormatted: (cursorOffset) => {
    set((state) => ({
      fileViewStates: patchActiveFileViewState(state, {
        cursorOffset,
        formatted: true,
      }),
    }));
  },
  clearActiveFileFormatted: () => {
    set((state) => ({
      fileViewStates: patchActiveFileViewState(state, {
        formatted: false,
      }),
    }));
  },
  setThemeId: (themeId) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    set({ themeId });
  },
  setIndentSize: (indentSize) => {
    set({ indentSize });
  },
  setAutoSaveOnFocus: (autoSaveOnFocus) => {
    window.localStorage.setItem(AUTO_SAVE_ON_FOCUS_STORAGE_KEY, autoSaveOnFocus ? '1' : '0');
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

  return window.localStorage.getItem(THEME_STORAGE_KEY) ?? fallback;
}

function readAutoSaveOnFocusFromStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(AUTO_SAVE_ON_FOCUS_STORAGE_KEY) === '1';
}

function createDefaultFileEditorState(): FileEditorState {
  return {
    cursor: { ...DEFAULT_CURSOR },
    scroll: { ...DEFAULT_SCROLL },
    cursorOffset: 0,
    formatted: false,
  };
}

function patchActiveFileViewState(
  state: Pick<EditorStore, 'activeFileId' | 'fileViewStates'>,
  patch: Partial<FileEditorState>,
): Record<string, FileEditorState> {
  const activeFileId = state.activeFileId;
  if (!activeFileId) {
    return state.fileViewStates;
  }

  const currentState = state.fileViewStates[activeFileId] ?? createDefaultFileEditorState();
  const nextCursor = patch.cursor ? { ...patch.cursor } : { ...currentState.cursor };
  const nextScroll = patch.scroll ? { ...patch.scroll } : { ...currentState.scroll };

  return {
    ...state.fileViewStates,
    [activeFileId]: {
      cursor: nextCursor,
      scroll: nextScroll,
      cursorOffset:
        typeof patch.cursorOffset === 'number' ? patch.cursorOffset : currentState.cursorOffset,
      formatted:
        typeof patch.formatted === 'boolean' ? patch.formatted : currentState.formatted,
    },
  };
}

function resolveInsertionIndex(params: {
  fromIndex: number;
  toIndex: number;
  position: FavoriteMovePosition;
}): number {
  const { fromIndex, toIndex, position } = params;

  if (position === 'after') {
    return fromIndex < toIndex ? toIndex : toIndex + 1;
  }

  return fromIndex < toIndex ? toIndex - 1 : toIndex;
}
