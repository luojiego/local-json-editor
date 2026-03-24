import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { HistoryDialog } from './components/HistoryDialog';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { calculateHistoryAnchor } from './lib/historyDiff';
import {
  appendHistoryEntry,
  clearAllHistory,
  MAX_HISTORY_ENTRIES_PER_DIRECTORY,
  pruneDirectoryHistory,
} from './lib/historyStorage';
import {
  buildDirectoryTree,
  collectDirectoryIds,
  createFileMap,
  readFileContent,
  saveFileContent,
  scanJsonFiles,
} from './lib/fileSystem';
import {
  formatJsonWithCursorOffset,
  hasSemanticDifference,
  mergeJsonWithOriginalFormatting,
  validateJsonContent,
} from './lib/jsonTools';
import {
  clearLastDirectoryHandle,
  ensureDirectoryPermission,
  loadLastDirectoryHandle,
  queryDirectoryPermission,
  saveLastDirectoryHandle,
} from './lib/lastDirectory';
import {
  loadLastOpenState,
  pruneFileEditorStates,
  saveLastOpenState,
} from './lib/lastOpenState';
import { applyThemeVariables, getThemeById } from './lib/themes';
import { searchFiles } from './lib/search';
import { useEditorStore } from './store/editorStore';
import type {
  CursorPosition,
  JsonFileRecord,
  ScrollPosition,
  ViewRestoreRequest,
} from './types/editor';
import type { HistoryEntry } from './types/history';

const TABLET_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 768;
const LOCAL_STORAGE_APP_KEY_PREFIX = 'json-editor-';
const DEFAULT_CURSOR: CursorPosition = { line: 1, column: 1 };
const DEFAULT_SCROLL: ScrollPosition = { top: 0, left: 0 };

interface FileSystemCapability {
  supported: boolean;
  hasDirectoryPicker: boolean;
  isSecureContext: boolean;
  isTopLevelContext: boolean;
}

type SaveTrigger = 'manual' | 'auto';
type SaveAttemptResult = 'saved' | 'skipped' | 'cancelled' | 'failed';

function App() {
  const {
    files,
    tree,
    activeFileId,
    directoryName,
    content,
    persistedContent,
    isDirty,
    searchQuery,
    expandedDirectories,
    favoriteFileIds,
    fileViewStates,
    validation,
    cursor,
    themeId,
    indentSize,
    autoSaveOnFocus,
    isSidebarCollapsed,
    saveStatus,
    statusMessage,
    setDirectoryData,
    setActiveFileContent,
    setContent,
    setDirty,
    setSearchQuery,
    toggleDirectoryExpanded,
    toggleFavoriteFile,
    moveFavoriteFile,
    setValidation,
    setCursor,
    setScroll,
    markActiveFileFormatted,
    clearActiveFileFormatted,
    setThemeId,
    setIndentSize,
    setAutoSaveOnFocus,
    toggleSidebarCollapsed,
    setSidebarCollapsed,
    setSaveState,
    markSaved,
  } = useEditorStore();

  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [restoreRequest, setRestoreRequest] = useState<ViewRestoreRequest | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const initialLastOpenStateRef = useRef(loadLastOpenState());
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasRecentDirectory, setHasRecentDirectory] = useState(
    () => Boolean(initialLastOpenStateRef.current?.directoryName),
  );
  const [recentDirectoryName, setRecentDirectoryName] = useState(
    () => initialLastOpenStateRef.current?.directoryName ?? '',
  );
  const restoredLastDirectoryRef = useRef(false);
  const restoreSessionTokenRef = useRef(0);
  const loadDirectoryFromHandleRef = useRef<
    (directoryHandle: FileSystemDirectoryHandle, shouldPersistHandle: boolean, sessionToken?: number) => Promise<void>
  >(async () => {});
  const restoreRequestIdRef = useRef(0);
  const enqueueRestoreRequest = useCallback(
    (reason: ViewRestoreRequest['reason'], nextCursor: CursorPosition | null, nextScroll: ScrollPosition | null) => {
      restoreRequestIdRef.current += 1;
      setRestoreRequest({
        requestId: restoreRequestIdRef.current,
        reason,
        cursor: nextCursor,
        scroll: nextScroll,
      });
    },
    [],
  );
  const handleCursorRestored = useCallback((requestId: number) => {
    setRestoreRequest((current) => (current?.requestId === requestId ? null : current));
  }, []);
  const saveInFlightRef = useRef<Promise<SaveAttemptResult> | null>(null);
  const autoSaveInvalidNoticeRef = useRef<Map<string, string>>(new Map());
  const persistSaveHistory = useCallback(
    (params: {
      directoryName: string;
      fileId: string;
      fileRelativePath: string;
      trigger: SaveTrigger;
      beforeContent: string;
      afterContent: string;
    }) => {
      if (!params.directoryName || params.beforeContent === params.afterContent) {
        return;
      }

      const anchor = calculateHistoryAnchor(params.beforeContent, params.afterContent);

      void (async () => {
        try {
          await appendHistoryEntry({
            directoryName: params.directoryName,
            fileId: params.fileId,
            fileRelativePath: params.fileRelativePath,
            trigger: params.trigger,
            beforeContent: params.beforeContent,
            afterContent: params.afterContent,
            anchor,
          });
          await pruneDirectoryHistory(params.directoryName, MAX_HISTORY_ENTRIES_PER_DIRECTORY);
        } catch (error) {
          console.error('写入历史记录失败:', error);
        }
      })();
    },
    [],
  );

  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  const isTabletOrBelow = viewportWidth <= TABLET_BREAKPOINT;

  const fileSystemCapability = useMemo<FileSystemCapability>(() => {
    const hasDirectoryPicker = typeof window.showDirectoryPicker === 'function';
    const isSecure = window.isSecureContext;

    let isTopLevelContext = true;
    try {
      isTopLevelContext = window.self === window.top;
    } catch {
      isTopLevelContext = false;
    }

    return {
      supported: hasDirectoryPicker && isSecure && isTopLevelContext,
      hasDirectoryPicker,
      isSecureContext: isSecure,
      isTopLevelContext,
    };
  }, []);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const filesById = useMemo(() => createFileMap(files), [files]);
  const activeFile = useMemo(() => {
    if (!activeFileId) {
      return null;
    }

    return filesById.get(activeFileId) ?? null;
  }, [activeFileId, filesById]);
  const activeFileViewState = useMemo(
    () => (activeFileId ? fileViewStates[activeFileId] ?? null : null),
    [activeFileId, fileViewStates],
  );

  const searchResults = useMemo(() => searchFiles(files, searchQuery), [files, searchQuery]);
  const visibleFileIds = useMemo(
    () => new Set(searchResults.map((result) => result.file.id)),
    [searchResults],
  );

  const saveLabel = useMemo(() => {
    if (saveStatus === 'saving') {
      return '保存中';
    }

    if (saveStatus === 'saved') {
      return '已保存';
    }

    if (saveStatus === 'error') {
      return '失败';
    }

    if (isDirty) {
      return '未保存';
    }

    return activeFileViewState?.formatted ? '已格式化' : '就绪';
  }, [activeFileViewState?.formatted, isDirty, saveStatus]);

  useEffect(() => {
    logViewStateDebug('save-label-evaluated', {
      activeFileId,
      saveStatus,
      isDirty,
      formatted: activeFileViewState?.formatted ?? false,
      saveLabel,
    });
  }, [activeFileId, activeFileViewState?.formatted, isDirty, saveLabel, saveStatus]);

  const fileSystemIssueMessage = useMemo(() => {
    if (fileSystemCapability.supported) {
      return '';
    }

    if (!fileSystemCapability.isSecureContext) {
      return '当前页面不是安全上下文，请使用 https 或 http://localhost 访问（不要使用局域网 IP）。';
    }

    if (!fileSystemCapability.isTopLevelContext) {
      return '当前页面运行在嵌入式环境/iframe 中，请在独立浏览器标签页中打开。';
    }

    if (!fileSystemCapability.hasDirectoryPicker) {
      return '当前运行环境未暴露 showDirectoryPicker（常见于内嵌 WebView）。';
    }

    return '当前环境无法使用 File System Access API。';
  }, [fileSystemCapability]);

  useEffect(() => {
    applyThemeVariables(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (!isTabletOrBelow) {
      setSidebarCollapsed(false);
      return;
    }

    setSidebarCollapsed(true);
  }, [isTabletOrBelow, setSidebarCollapsed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (saveStatus !== 'saved' && saveStatus !== 'error') {
        return;
      }

      setSaveState('idle', isDirty ? '未保存' : '就绪');
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isDirty, saveStatus, setSaveState]);

  useEffect(() => {
    if (!directoryName) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveLastOpenState({
        directoryName,
        activeFileId: activeFileId ?? '',
        files: fileViewStates,
      });
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFileId, directoryName, fileViewStates]);

  const openFile = useCallback(
    async (file: JsonFileRecord, checkDirty: boolean) => {
      if (checkDirty && isDirty && activeFileId && activeFileId !== file.id) {
        const confirmed = window.confirm('当前文件尚未保存，确定要切换文件吗？');
        if (!confirmed) {
          return;
        }
      }

      try {
        const fileContent = await readFileContent(file.handle);

        const restoredState = useEditorStore.getState().fileViewStates[file.id] ?? null;
        logViewStateDebug('open-file-restored-state', {
          fileId: file.id,
          formatted: restoredState?.formatted ?? false,
          cursorOffset: restoredState?.cursorOffset ?? null,
        });

        let displayContent = fileContent;
        if (restoredState?.formatted) {
          try {
            const { formattedContent } = formatJsonWithCursorOffset(
              fileContent,
              indentSize,
              restoredState.cursorOffset,
            );
            displayContent = formattedContent;
          } catch {
            // 格式化失败（如文件已损坏），回退到原始内容
          }
        }

        setActiveFileContent(file.id, displayContent);

        const validationResult = validateJsonContent(displayContent);
        setValidation({
          errorCount: validationResult.valid ? 0 : 1,
          message: validationResult.valid ? 'JSON 格式正确' : validationResult.message,
        });

        enqueueRestoreRequest(
          'file-switch',
          restoredState?.cursor ?? DEFAULT_CURSOR,
          restoredState?.scroll ?? DEFAULT_SCROLL,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '读取文件失败';
        setSaveState('error', '读取失败');
        window.alert(`读取文件失败: ${message}`);
      }
    },
    [activeFileId, enqueueRestoreRequest, indentSize, isDirty, setActiveFileContent, setSaveState, setValidation],
  );

  const loadDirectoryFromHandle = useCallback(
    async (directoryHandle: FileSystemDirectoryHandle, shouldPersistHandle: boolean, sessionToken?: number) => {
      const isSessionValid = () => sessionToken === undefined || sessionToken === restoreSessionTokenRef.current;

      setSaveState('saving', '扫描中');

      const scannedFiles = await scanJsonFiles(directoryHandle);
      if (!isSessionValid()) {
        return;
      }

      const directoryTree = buildDirectoryTree(directoryHandle.name, scannedFiles);
      const expandedIds = collectDirectoryIds(directoryTree);
      const availableFileIds = new Set(scannedFiles.map((file) => file.id));
      const lastOpenState = loadLastOpenState();
      const fromSameDirectory =
        lastOpenState && lastOpenState.directoryName === directoryHandle.name ? lastOpenState : null;
      const restoredFileViewStates = fromSameDirectory
        ? pruneFileEditorStates(fromSameDirectory.files, availableFileIds)
        : {};

      if (!isSessionValid()) {
        return;
      }

      setDirectoryData({
        directoryHandle,
        directoryName: directoryHandle.name,
        files: scannedFiles,
        tree: directoryTree,
        expandedDirectoryIds: expandedIds,
        fileViewStates: restoredFileViewStates,
      });

      if (shouldPersistHandle) {
        await saveLastDirectoryHandle(directoryHandle);
      }
      setHasRecentDirectory(true);
      setRecentDirectoryName(directoryHandle.name);

      if (scannedFiles.length === 0) {
        setRestoreRequest(null);
        setSaveState('idle', '未找到 JSON');
        setIsInitializing(false);
        return;
      }

      const preferredFile =
        fromSameDirectory
          ? scannedFiles.find((file) => file.id === fromSameDirectory.activeFileId) ?? null
          : null;
      const fileToOpen = preferredFile ?? scannedFiles[0];

      if (!isSessionValid()) {
        return;
      }

      await openFile(fileToOpen, false);

      if (!isSessionValid()) {
        return;
      }

      setSaveState('idle', '目录已打开');
      setIsInitializing(false);
    },
    [openFile, setDirectoryData, setSaveState],
  );

  useEffect(() => {
    loadDirectoryFromHandleRef.current = loadDirectoryFromHandle;
  }, [loadDirectoryFromHandle]);

  const selectNewDirectory = useCallback(async () => {
    if (!fileSystemCapability.supported) {
      window.alert(fileSystemIssueMessage || '当前环境不支持 File System Access API。');
      return;
    }

    try {
      const directoryHandle = await window.showDirectoryPicker?.({
        id: 'json-editor-workspace',
        mode: 'readwrite',
      });

      if (!directoryHandle) {
        return;
      }

      await loadDirectoryFromHandle(directoryHandle, true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      const message = error instanceof Error ? error.message : '打开目录失败';
      setSaveState('error', '打开失败');
      setIsInitializing(false);
      window.alert(`打开目录失败: ${message}`);
    }
  }, [fileSystemCapability.supported, fileSystemIssueMessage, loadDirectoryFromHandle, setSaveState]);

  const restoreWithPrompt = useCallback(async () => {
    try {
      const lastHandle = await loadLastDirectoryHandle();

      if (!lastHandle) {
        await selectNewDirectory();
        return;
      }

      const granted = await ensureDirectoryPermission(lastHandle, 'readwrite');
      if (granted) {
        await loadDirectoryFromHandle(lastHandle, true);
        setSaveState('idle', '✅ 已恢复上次目录');
        return;
      }

      window.alert('权限被拒绝，请选择新目录');
      await selectNewDirectory();
    } catch (error) {
      const message = error instanceof Error ? error.message : '恢复目录失败';
      setSaveState('error', '恢复失败');
      setIsInitializing(false);
      window.alert(`恢复目录失败: ${message}`);
    }
  }, [loadDirectoryFromHandle, selectNewDirectory, setSaveState]);

  const handleOpenDirectory = useCallback(async () => {
    await selectNewDirectory();
  }, [selectNewDirectory]);

  const handleOpenHistoryDialog = useCallback(() => {
    if (!directoryName) {
      window.alert('请先打开目录，再查看历史记录。');
      return;
    }

    setIsHistoryDialogOpen(true);
  }, [directoryName]);

  const handleClearCache = useCallback(async () => {
    const shouldClear = window.confirm('将清空本地缓存并刷新页面。\n是否继续？');
    if (!shouldClear) {
      return;
    }

    const secondaryConfirmMessage = isDirty
      ? '此操作不可恢复，且会丢失当前未保存修改。\n是否确认清空缓存？'
      : '此操作不可恢复。\n是否确认清空缓存？';
    const confirmedIrreversible = window.confirm(secondaryConfirmMessage);
    if (!confirmedIrreversible) {
      return;
    }

    try {
      clearAppLocalStorage();
      await clearAllHistory();
      await clearLastDirectoryHandle();
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : '清空缓存失败';
      setSaveState('error', '清理失败');
      window.alert(`清空缓存失败: ${message}`);
    }
  }, [isDirty, setSaveState]);

  useEffect(() => {
    if (restoredLastDirectoryRef.current) {
      return;
    }

    restoredLastDirectoryRef.current = true;
    let cancelled = false;

    const initializeApp = async () => {
      if (!fileSystemCapability.supported) {
        setIsInitializing(false);
        return;
      }

      try {
        const lastHandle = await loadLastDirectoryHandle();
        if (!lastHandle || cancelled) {
          return;
        }

        setHasRecentDirectory(true);
        setRecentDirectoryName(lastHandle.name);

        const permission = await queryDirectoryPermission(lastHandle, 'read');
        if (cancelled) {
          return;
        }

        if (permission === 'denied' || permission === 'prompt') {
          if (!cancelled) {
            setSaveState('idle', '检测到上次目录，可点击"继续使用此目录"恢复访问');
          }
          return;
        }

        const currentSessionToken = ++restoreSessionTokenRef.current;
        const AUTO_RESTORE_TIMEOUT_MS = 5000;

        const restorePromise = loadDirectoryFromHandleRef.current(lastHandle, true, currentSessionToken);
        const timeoutPromise = new Promise<'timeout'>((resolve) => {
          setTimeout(() => resolve('timeout'), AUTO_RESTORE_TIMEOUT_MS);
        });

        const result = await Promise.race([
          restorePromise.then(() => 'success' as const),
          timeoutPromise,
        ]);

        if (cancelled) {
          return;
        }

        if (result === 'timeout') {
          restoreSessionTokenRef.current++;
          setSaveState('idle', '检测到上次目录，可点击"继续使用此目录"恢复访问');
        } else {
          setSaveState('idle', '已自动恢复上次目录');
        }
      } catch {
        if (!cancelled) {
          setSaveState('idle', '检测到上次目录，可点击"继续使用此目录"恢复访问');
        }
      } finally {
        // 无论何种情况（含 React Strict Mode 下 cancelled=true）都必须退出初始化
        setIsInitializing(false);
      }
    };

    void initializeApp();

    return () => {
      cancelled = true;
    };
  }, [fileSystemCapability.supported, setSaveState]);

  const performSave = useCallback(
    async (trigger: SaveTrigger): Promise<SaveAttemptResult> => {
      if (!activeFile) {
        return 'skipped';
      }

      if (trigger === 'auto' && !isDirty) {
        return 'skipped';
      }

      if (saveInFlightRef.current) {
        return saveInFlightRef.current;
      }

      const savePromise = (async (): Promise<SaveAttemptResult> => {
        const validationResult = validateJsonContent(content);

        if (!validationResult.valid) {
          if (trigger === 'manual') {
            const forceSave = window.confirm(
              `JSON 格式存在错误：${validationResult.message}\n是否继续强制保存？`,
            );

            if (!forceSave) {
              setSaveState('idle', '已取消');
              return 'cancelled';
            }
          } else {
            const contentSignature = createContentSignature(content);
            const lastSignature = autoSaveInvalidNoticeRef.current.get(activeFile.id);
            if (lastSignature !== contentSignature) {
              autoSaveInvalidNoticeRef.current.set(activeFile.id, contentSignature);
              window.alert(`自动保存已跳过：${validationResult.message}`);
            }
            setSaveState('error', '自动保存跳过');
            return 'skipped';
          }
        } else {
          autoSaveInvalidNoticeRef.current.delete(activeFile.id);
        }

        try {
          setSaveState('saving', trigger === 'auto' ? '自动保存中' : '保存中');

          let nextPersistedContent = content;
          if (validationResult.valid) {
            try {
              nextPersistedContent = mergeJsonWithOriginalFormatting(
                persistedContent,
                content,
                indentSize,
              );
            } catch {
              nextPersistedContent = content;
            }
          }

          await saveFileContent(activeFile.handle, nextPersistedContent);
          markSaved(nextPersistedContent);
          persistSaveHistory({
            directoryName,
            fileId: activeFile.id,
            fileRelativePath: activeFile.relativePath,
            trigger,
            beforeContent: persistedContent,
            afterContent: nextPersistedContent,
          });
          return 'saved';
        } catch (error) {
          const message = error instanceof Error ? error.message : '保存失败';
          if (trigger === 'auto') {
            setSaveState('error', '自动保存失败');
            window.alert(`自动保存失败: ${message}`);
          } else {
            setSaveState('error', '保存失败');
            window.alert(`保存失败: ${message}`);
          }
          return 'failed';
        }
      })();

      saveInFlightRef.current = savePromise;
      try {
        return await savePromise;
      } finally {
        if (saveInFlightRef.current === savePromise) {
          saveInFlightRef.current = null;
        }
      }
    },
    [
      activeFile,
      content,
      directoryName,
      indentSize,
      isDirty,
      markSaved,
      persistSaveHistory,
      persistedContent,
      setSaveState,
    ],
  );

  const handleEditorBlur = useCallback(() => {
    if (!autoSaveOnFocus) {
      return;
    }

    void performSave('auto');
  }, [autoSaveOnFocus, performSave]);

  const handleSelectFile = useCallback(
    async (file: JsonFileRecord) => {
      if (isTabletOrBelow) {
        setSidebarCollapsed(true);
      }

      setRestoreRequest(null);

      let shouldCheckDirty = true;
      if (autoSaveOnFocus && isDirty && activeFileId && activeFileId !== file.id) {
        const saveResult = await performSave('auto');
        if (saveResult === 'saved') {
          shouldCheckDirty = false;
        }
      }

      await openFile(file, shouldCheckDirty);
    },
    [
      activeFileId,
      autoSaveOnFocus,
      isDirty,
      isTabletOrBelow,
      openFile,
      performSave,
      setSidebarCollapsed,
    ],
  );

  const handleJumpToHistoryEntry = useCallback(
    async (entry: HistoryEntry) => {
      const targetFile = filesById.get(entry.fileId);
      if (!targetFile) {
        window.alert('无法定位历史修改：目标文件不存在。');
        return;
      }

      const currentActiveFileId = useEditorStore.getState().activeFileId;
      if (currentActiveFileId !== targetFile.id) {
        await handleSelectFile(targetFile);
      }

      if (useEditorStore.getState().activeFileId !== targetFile.id) {
        return;
      }

      enqueueRestoreRequest(
        'history-jump',
        {
          line: Math.max(1, Math.floor(entry.anchor.line)),
          column: Math.max(1, Math.floor(entry.anchor.column)),
        },
        null,
      );

      setIsHistoryDialogOpen(false);
      setSaveState('idle', `已跳转到 ${targetFile.relativePath}`);
    },
    [enqueueRestoreRequest, filesById, handleSelectFile, setSaveState],
  );

  const handleSaveFile = useCallback(async () => {
    await performSave('manual');
  }, [performSave]);

  const handleFormat = useCallback(() => {
    if (!activeFile) {
      return;
    }

    try {
      const cursorOffset = calculateCursorOffset(content, cursor);
      const { formattedContent, mappedCursorOffset } = formatJsonWithCursorOffset(
        content,
        indentSize,
        cursorOffset,
      );
      logViewStateDebug('format-apply', {
        fileId: activeFile.id,
        beforeOffset: cursorOffset,
        mappedOffset: mappedCursorOffset,
      });
      const cursorAfterFormat = calculateCursorFromOffset(formattedContent, mappedCursorOffset);

      setContent(formattedContent);
      setDirty(hasSemanticDifference(persistedContent, formattedContent));
      setCursor(cursorAfterFormat);
      markActiveFileFormatted(mappedCursorOffset);
      enqueueRestoreRequest('format', cursorAfterFormat, null);
      setValidation({ errorCount: 0, message: 'JSON 格式正确' });
      setSaveState('idle', '已格式化');
    } catch (error) {
      const message = error instanceof Error ? error.message : '当前 JSON 无法格式化';
      window.alert(`格式化失败: ${message}`);
    }
  }, [
    activeFile,
    content,
    cursor,
    enqueueRestoreRequest,
    indentSize,
    markActiveFileFormatted,
    persistedContent,
    setContent,
    setCursor,
    setDirty,
    setSaveState,
    setValidation,
  ]);

  const handleContentChange = useCallback(
    (nextContent: string, source: 'user' | 'programmatic') => {
      const currentContent = useEditorStore.getState().content;
      if (nextContent === currentContent) {
        return;
      }

      if (source === 'programmatic') {
        logViewStateDebug('skip-clear-formatted-programmatic-change', {
          fileId: useEditorStore.getState().activeFileId,
          nextLength: nextContent.length,
          currentLength: currentContent.length,
        });
        return;
      }

      const activeId = useEditorStore.getState().activeFileId;
      const formattedBefore = activeId
        ? Boolean(useEditorStore.getState().fileViewStates[activeId]?.formatted)
        : false;
      logViewStateDebug('user-edit-clear-formatted', {
        fileId: activeId,
        formattedBefore,
        nextLength: nextContent.length,
        currentLength: currentContent.length,
      });

      clearActiveFileFormatted();
      setContent(nextContent);
      setDirty(hasSemanticDifference(persistedContent, nextContent));
    },
    [clearActiveFileFormatted, persistedContent, setContent, setDirty],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const primary = event.metaKey || event.ctrlKey;
      if (!primary) {
        return;
      }

      const lowerKey = event.key.toLowerCase();

      if (lowerKey === 's') {
        event.preventDefault();
        void handleSaveFile();
        return;
      }

      if (event.shiftKey && lowerKey === 'f') {
        event.preventDefault();
        handleFormat();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleFormat, handleSaveFile]);

  const showWelcomeScreen =
    !isInitializing && !tree && fileSystemCapability.supported;

  if (isMobile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-base)] px-6 text-center text-[var(--text-main)]">
        <div className="max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-toolbar)] p-8 shadow-[var(--shadow)]">
          <h1 className="text-2xl font-semibold">JSON 配置编辑器</h1>
          <p className="text-sm text-[var(--text-muted)]">
            当前版本暂不支持移动端，请使用桌面浏览器（Chrome / Edge）访问。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-main)]">
      <Toolbar
        fileName={activeFile?.relativePath ?? statusMessage}
        canSave={Boolean(activeFile)}
        canOpenHistory={Boolean(directoryName)}
        saveLabel={saveLabel}
        indentSize={indentSize}
        themeId={themeId}
        autoSaveOnFocus={autoSaveOnFocus}
        onOpenDirectory={() => void handleOpenDirectory()}
        onOpenHistory={handleOpenHistoryDialog}
        onSave={() => void handleSaveFile()}
        onFormat={handleFormat}
        onClearCache={() => void handleClearCache()}
        onToggleAutoSave={() => setAutoSaveOnFocus(!autoSaveOnFocus)}
        onIndentSizeChange={setIndentSize}
        onThemeChange={setThemeId}
        onToggleSidebar={toggleSidebarCollapsed}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={[
            'z-30 flex h-full w-[300px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)]',
            'transition-transform duration-200',
            'xl:relative xl:translate-x-0',
            isTabletOrBelow ? 'absolute left-0 top-0' : 'relative',
            isTabletOrBelow && isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0',
          ].join(' ')}
        >
          <div className="border-b border-[var(--border)] p-3">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="search"
                className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent pl-9 pr-3 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]"
                placeholder="搜索文件名..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <FileTree
              tree={tree}
              activeFileId={activeFileId}
              filesById={filesById}
              searchQuery={searchQuery}
              expandedDirectories={expandedDirectories}
              favoriteFileIds={favoriteFileIds}
              onToggleDirectory={toggleDirectoryExpanded}
              onToggleFavoriteFile={toggleFavoriteFile}
              onMoveFavoriteFile={moveFavoriteFile}
              onSelectFile={(file) => void handleSelectFile(file)}
              visibleFileIds={visibleFileIds}
            />
          </div>
        </aside>

        {isTabletOrBelow && !isSidebarCollapsed && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/25"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="关闭侧边栏"
          />
        )}

        <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
          {!fileSystemCapability.supported && (
            <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-4 py-2 text-sm text-[var(--danger)]">
              {fileSystemIssueMessage}
            </div>
          )}
          <div className="min-h-0 flex-1 bg-[var(--bg-editor)]">
            {isInitializing ? (
              <div className="flex h-full items-center justify-center px-6">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-toolbar)] px-6 py-5 text-sm text-[var(--text-muted)] shadow-[var(--shadow)]">
                  正在尝试恢复上次打开的目录...
                </div>
              </div>
            ) : showWelcomeScreen ? (
              <div className="flex h-full items-center justify-center px-6">
                <div className="w-full max-w-xl space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-toolbar)] p-8 shadow-[var(--shadow)]">
                  <h1 className="text-2xl font-semibold text-[var(--text-main)]">JSON 配置编辑器</h1>
                  <p className="text-sm text-[var(--text-muted)]">
                    选择一个包含 JSON 文件的目录开始。
                  </p>

                  {hasRecentDirectory && (
                    <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">上次打开</p>
                      <p className="mt-1 font-mono text-sm text-[var(--text-main)]">
                        {recentDirectoryName || '未命名目录'}
                      </p>
                      <button
                        type="button"
                        className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                        onClick={() => void restoreWithPrompt()}
                      >
                        继续使用此目录（重新授权）
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                    onClick={() => void selectNewDirectory()}
                  >
                    选择新目录
                  </button>
                </div>
              </div>
            ) : (
              <EditorPane
                value={content}
                modelPath={activeFile ? `inmemory://json/${activeFile.id}` : null}
                monacoThemeId={activeTheme.monacoThemeId}
                indentation={indentSize}
                restoreRequest={restoreRequest}
                onChange={handleContentChange}
                onValidation={(errorCount, message) => setValidation({ errorCount, message })}
                onCursorChange={setCursor}
                onScrollChange={setScroll}
                onEditorBlur={handleEditorBlur}
                onViewStateRestored={handleCursorRestored}
              />
            )}
          </div>
          <StatusBar validation={validation} cursor={cursor} saveText={saveLabel} isDirty={isDirty} />
        </main>
      </div>

      <HistoryDialog
        open={isHistoryDialogOpen}
        directoryName={directoryName}
        monacoThemeId={activeTheme.monacoThemeId}
        onClose={() => setIsHistoryDialogOpen(false)}
        onJumpToChange={handleJumpToHistoryEntry}
        onHistoryCleared={() => setSaveState('idle', '历史记录已清空')}
      />
    </div>
  );
}

export default App;

function createContentSignature(content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) | 0;
  }

  return `${content.length}:${hash}`;
}

function clearAppLocalStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(LOCAL_STORAGE_APP_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}

function calculateCursorOffset(content: string, cursor: CursorPosition): number {
  if (content.length === 0) {
    return 0;
  }

  const lines = content.split('\n');
  const lineIndex = clamp(cursor.line - 1, 0, lines.length - 1);
  const lineText = lines[lineIndex] ?? '';
  const column = clamp(cursor.column, 1, lineText.length + 1);

  let offset = 0;
  for (let index = 0; index < lineIndex; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }

  offset += column - 1;
  return clamp(offset, 0, content.length);
}

function calculateCursorFromOffset(content: string, offset: number): CursorPosition {
  if (content.length === 0) {
    return { ...DEFAULT_CURSOR };
  }

  const safeOffset = clamp(offset, 0, content.length);
  let line = 1;
  let column = 1;

  for (let index = 0; index < safeOffset; index += 1) {
    if (content[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function logViewStateDebug(label: string, payload?: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem('json-editor-debug-view-state') !== '1') {
    return;
  }

  if (payload === undefined) {
    console.log(`[view-state] ${label}`);
    return;
  }

  console.log(`[view-state] ${label}`, payload);
}
