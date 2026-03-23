import { create } from 'zustand';

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
  validation: ValidationState;
  cursor: CursorPosition;
  scroll: ScrollPosition;
  themeId: string;
  indentSize: JsonIndentSize;
  isSidebarCollapsed: boolean;
  saveStatus: SaveStatus;
  statusMessage: string;
  setDirectoryData: (payload: DirectoryPayload) => void;
  setActiveFileContent: (fileId: string, content: string) => void;
  setContent: (content: string) => void;
  setDirty: (dirty: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleDirectoryExpanded: (directoryId: string) => void;
  setValidation: (validation: ValidationState) => void;
  setCursor: (cursor: CursorPosition) => void;
  setScroll: (scroll: ScrollPosition) => void;
  setThemeId: (themeId: string) => void;
  setIndentSize: (indentSize: JsonIndentSize) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSaveState: (saveStatus: SaveStatus, statusMessage: string) => void;
  markSaved: (persistedContent: string) => void;
}

const THEME_STORAGE_KEY = 'json-editor-theme';
const DEFAULT_THEME_ID = readThemeFromStorage();

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
  isSidebarCollapsed: false,
  saveStatus: 'idle',
  statusMessage: '未保存',
  setDirectoryData: ({ directoryHandle, directoryName, files, tree, expandedDirectoryIds }) => {
    const expandedDirectories = Object.fromEntries(
      expandedDirectoryIds.map((directoryId) => [directoryId, true]),
    );

    set({
      directoryHandle,
      directoryName,
      files,
      tree,
      expandedDirectories,
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
