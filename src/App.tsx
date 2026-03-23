import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import {
  buildDirectoryTree,
  collectDirectoryIds,
  createFileMap,
  readFileContent,
  saveFileContent,
  scanJsonFiles,
} from './lib/fileSystem';
import {
  formatJson,
  hasSemanticDifference,
  mergeJsonWithOriginalFormatting,
  validateJsonContent,
} from './lib/jsonTools';
import {
  ensureDirectoryPermission,
  loadLastDirectoryHandle,
  queryDirectoryPermission,
  saveLastDirectoryHandle,
} from './lib/lastDirectory';
import { loadLastOpenState, saveLastOpenState } from './lib/lastOpenState';
import { applyThemeVariables, getThemeById } from './lib/themes';
import { searchFiles } from './lib/search';
import { useEditorStore } from './store/editorStore';
import type { CursorPosition, JsonFileRecord, ScrollPosition } from './types/editor';

const TABLET_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 768;

interface FileSystemCapability {
  supported: boolean;
  hasDirectoryPicker: boolean;
  isSecureContext: boolean;
  isTopLevelContext: boolean;
}

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
    validation,
    cursor,
    scroll,
    themeId,
    indentSize,
    isSidebarCollapsed,
    saveStatus,
    statusMessage,
    setDirectoryData,
    setActiveFileContent,
    setContent,
    setDirty,
    setSearchQuery,
    toggleDirectoryExpanded,
    setValidation,
    setCursor,
    setScroll,
    setThemeId,
    setIndentSize,
    toggleSidebarCollapsed,
    setSidebarCollapsed,
    setSaveState,
    markSaved,
  } = useEditorStore();

  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [cursorToRestore, setCursorToRestore] = useState<CursorPosition | null>(null);
  const [scrollToRestore, setScrollToRestore] = useState<ScrollPosition | null>(null);
  const initialLastOpenStateRef = useRef(loadLastOpenState());
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasRecentDirectory, setHasRecentDirectory] = useState(
    () => Boolean(initialLastOpenStateRef.current?.directoryName),
  );
  const [recentDirectoryName, setRecentDirectoryName] = useState(
    () => initialLastOpenStateRef.current?.directoryName ?? '',
  );
  const restoredLastDirectoryRef = useRef(false);
  const loadDirectoryFromHandleRef = useRef<
    (directoryHandle: FileSystemDirectoryHandle, shouldPersistHandle: boolean) => Promise<void>
  >(async () => {});
  const handleCursorRestored = useCallback(() => {
    setCursorToRestore(null);
    setScrollToRestore(null);
  }, []);

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

    return isDirty ? '未保存' : '就绪';
  }, [isDirty, saveStatus]);

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
    if (!directoryName || !activeFileId) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveLastOpenState({
        directoryName,
        fileId: activeFileId,
        cursor,
        scroll,
      });
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeFileId, cursor, directoryName, scroll]);

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
        setActiveFileContent(file.id, fileContent);

        const validationResult = validateJsonContent(fileContent);
        setValidation({
          errorCount: validationResult.valid ? 0 : 1,
          message: validationResult.valid ? 'JSON 格式正确' : validationResult.message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '读取文件失败';
        setSaveState('error', '读取失败');
        window.alert(`读取文件失败: ${message}`);
      }
    },
    [activeFileId, isDirty, setActiveFileContent, setSaveState, setValidation],
  );

  const loadDirectoryFromHandle = useCallback(
    async (directoryHandle: FileSystemDirectoryHandle, shouldPersistHandle: boolean) => {
      setSaveState('saving', '扫描中');
      const scannedFiles = await scanJsonFiles(directoryHandle);
      const directoryTree = buildDirectoryTree(directoryHandle.name, scannedFiles);
      const expandedIds = collectDirectoryIds(directoryTree);

      setDirectoryData({
        directoryHandle,
        directoryName: directoryHandle.name,
        files: scannedFiles,
        tree: directoryTree,
        expandedDirectoryIds: expandedIds,
      });

      if (shouldPersistHandle) {
        await saveLastDirectoryHandle(directoryHandle);
      }
      setHasRecentDirectory(true);
      setRecentDirectoryName(directoryHandle.name);

      if (scannedFiles.length === 0) {
        setCursorToRestore(null);
        setScrollToRestore(null);
        setSaveState('idle', '未找到 JSON');
        return;
      }

      const lastOpenState = loadLastOpenState();
      const fromSameDirectory =
        lastOpenState && lastOpenState.directoryName === directoryHandle.name ? lastOpenState : null;
      const preferredFile =
        fromSameDirectory
          ? scannedFiles.find((file) => file.id === fromSameDirectory.fileId) ?? null
          : null;
      const fileToOpen = preferredFile ?? scannedFiles[0];

      await openFile(fileToOpen, false);

      if (fromSameDirectory && preferredFile) {
        setCursorToRestore(fromSameDirectory.cursor ?? null);
        setScrollToRestore(fromSameDirectory.scroll ?? null);
      } else {
        setCursorToRestore(null);
        setScrollToRestore(null);
      }
      setSaveState('idle', '目录已打开');
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
      setIsInitializing(false);
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
        setIsInitializing(false);
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

      setIsInitializing(true);

      try {
        const lastHandle = await loadLastDirectoryHandle();
        if (!lastHandle || cancelled) {
          if (!cancelled) {
            setIsInitializing(false);
          }
          return;
        }

        setHasRecentDirectory(true);
        setRecentDirectoryName(lastHandle.name);

        const permission = await queryDirectoryPermission(lastHandle, 'read');
        if (cancelled) {
          return;
        }

        if (permission === 'denied') {
          setSaveState('idle', '检测到上次目录，可点击“继续使用此目录”恢复访问');
          setIsInitializing(false);
          return;
        }

        try {
          await loadDirectoryFromHandleRef.current(lastHandle, true);
          if (!cancelled) {
            setSaveState('idle', '已自动恢复上次目录');
          }
          return;
        } catch {
          if (permission === 'prompt') {
            if (!cancelled) {
              setSaveState('idle', '检测到上次目录，可点击“继续使用此目录”恢复访问');
              setIsInitializing(false);
            }
            return;
          }
          throw new Error('restore-failed');
        }
      } catch {
        if (!cancelled) {
          setSaveState('idle', '请点击“打开目录”');
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void initializeApp();

    return () => {
      cancelled = true;
    };
  }, [fileSystemCapability.supported, setSaveState]);

  const handleSelectFile = useCallback(
    async (file: JsonFileRecord) => {
      if (isTabletOrBelow) {
        setSidebarCollapsed(true);
      }

      setCursorToRestore(null);
      setScrollToRestore(null);
      await openFile(file, true);
    },
    [isTabletOrBelow, openFile, setSidebarCollapsed],
  );

  const handleSaveFile = useCallback(async () => {
    if (!activeFile) {
      return;
    }

    const validationResult = validateJsonContent(content);
    if (!validationResult.valid) {
      const forceSave = window.confirm(
        `JSON 格式存在错误：${validationResult.message}\n是否继续强制保存？`,
      );

      if (!forceSave) {
        setSaveState('idle', '已取消');
        return;
      }
    }

    try {
      setSaveState('saving', '保存中');

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
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      setSaveState('error', '保存失败');
      window.alert(`保存失败: ${message}`);
    }
  }, [activeFile, content, indentSize, markSaved, persistedContent, setSaveState]);

  const handleFormat = useCallback(() => {
    if (!activeFile) {
      return;
    }

    try {
      const formatted = formatJson(content, indentSize);
      setContent(formatted);
      setDirty(hasSemanticDifference(persistedContent, formatted));
      setValidation({ errorCount: 0, message: 'JSON 格式正确' });
      setSaveState('idle', '已格式化');
    } catch (error) {
      const message = error instanceof Error ? error.message : '当前 JSON 无法格式化';
      window.alert(`格式化失败: ${message}`);
    }
  }, [activeFile, content, indentSize, persistedContent, setContent, setDirty, setSaveState, setValidation]);

  const handleContentChange = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      setDirty(hasSemanticDifference(persistedContent, nextContent));
    },
    [persistedContent, setContent, setDirty],
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
        saveLabel={saveLabel}
        indentSize={indentSize}
        themeId={themeId}
        onOpenDirectory={() => void handleOpenDirectory()}
        onSave={() => void handleSaveFile()}
        onFormat={handleFormat}
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
              onToggleDirectory={toggleDirectoryExpanded}
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
                cursorToRestore={cursorToRestore}
                scrollToRestore={scrollToRestore}
                onChange={handleContentChange}
                onValidation={(errorCount, message) => setValidation({ errorCount, message })}
                onCursorChange={setCursor}
                onScrollChange={setScroll}
                onViewStateRestored={handleCursorRestored}
              />
            )}
          </div>
          <StatusBar validation={validation} cursor={cursor} saveText={saveLabel} isDirty={isDirty} />
        </main>
      </div>
    </div>
  );
}

export default App;
