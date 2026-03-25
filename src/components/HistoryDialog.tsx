import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DiffEditor, type DiffOnMount, type Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { ArrowUpRight, Eraser, FileJson, RefreshCcw, X } from 'lucide-react';

import { createHistoryChangeSummary } from '../lib/historyDiff';
import { clearDirectoryHistory, listDirectoryHistory } from '../lib/historyStorage';
import { defineMonacoThemes } from '../lib/themes';
import type { HistoryEntry } from '../types/history';

interface HistoryDialogProps {
  open: boolean;
  directoryName: string;
  monacoThemeId: string;
  onClose: () => void;
  onJumpToChange: (entry: HistoryEntry) => Promise<void>;
  onHistoryCleared: () => void;
}

export function HistoryDialog({
  open,
  directoryName,
  monacoThemeId,
  onClose,
  onJumpToChange,
  onHistoryCleared,
}: HistoryDialogProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lineChanges, setLineChanges] = useState<MonacoEditor.ILineChange[]>([]);
  const diffEditorRef = useRef<MonacoEditor.IStandaloneDiffEditor | null>(null);
  const diffDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeEntryId) ?? null,
    [activeEntryId, entries],
  );

  const loadHistory = useCallback(async () => {
    if (!directoryName) {
      setEntries([]);
      setActiveEntryId(null);
      setErrorMessage('请先打开目录，再查看历史记录。');
      return;
    }

    setIsLoading(true);
    try {
      const nextEntries = await listDirectoryHistory(directoryName);
      setEntries(nextEntries);
      setActiveEntryId((current) => {
        if (current && nextEntries.some((entry) => entry.id === current)) {
          return current;
        }

        return nextEntries[0]?.id ?? null;
      });
      setErrorMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载历史记录失败';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [directoryName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadHistory();
  }, [loadHistory, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    setLineChanges([]);
  }, [activeEntryId]);

  useEffect(() => {
    return () => {
      for (const disposable of diffDisposablesRef.current) {
        disposable.dispose();
      }
      diffDisposablesRef.current = [];
    };
  }, []);

  const handleClearHistory = useCallback(async () => {
    if (!directoryName || entries.length === 0) {
      return;
    }

    const confirmed = window.confirm('确定清空当前目录的历史变更吗？此操作不可恢复。');
    if (!confirmed) {
      return;
    }

    try {
      await clearDirectoryHistory(directoryName);
      setEntries([]);
      setActiveEntryId(null);
      setErrorMessage('');
      setLineChanges([]);
      onHistoryCleared();
    } catch (error) {
      const message = error instanceof Error ? error.message : '清空历史记录失败';
      window.alert(`清空历史记录失败: ${message}`);
    }
  }, [directoryName, entries.length, onHistoryCleared]);

  const handleDiffMount: DiffOnMount = useCallback((editorInstance) => {
    diffEditorRef.current = editorInstance;

    for (const disposable of diffDisposablesRef.current) {
      disposable.dispose();
    }
    diffDisposablesRef.current = [];

    const refreshChanges = () => {
      setLineChanges(editorInstance.getLineChanges() ?? []);
    };

    refreshChanges();
    diffDisposablesRef.current.push(editorInstance.onDidUpdateDiff(refreshChanges));
    diffDisposablesRef.current.push(editorInstance.onDidChangeModel(refreshChanges));
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 px-5 py-4"
      onMouseDown={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-toolbar)] shadow-[var(--shadow)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-[var(--text-main)]">历史记录</div>
            <div className="mt-1 truncate text-sm text-[var(--text-muted)]">
              {directoryName ? `目录：${directoryName}` : '未打开目录'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-main)] transition hover:border-[var(--accent)]"
              onClick={() => void loadHistory()}
            >
              <RefreshCcw size={14} />
              刷新
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--danger)_50%,var(--border))] px-3 text-xs font-semibold text-[var(--danger)] transition hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleClearHistory()}
              disabled={!directoryName || entries.length === 0}
            >
              <Eraser size={14} />
              清空历史变更
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-main)] transition hover:border-[var(--accent)]"
              onClick={onClose}
              aria-label="关闭历史记录"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] overflow-hidden">
          <aside className="min-h-0 overflow-auto border-r border-[var(--border)] bg-[var(--bg-sidebar)] p-3">
            {isLoading ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-toolbar)] px-3 py-2 text-sm text-[var(--text-muted)]">
                正在加载历史记录...
              </div>
            ) : errorMessage ? (
              <div className="rounded-md border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-[var(--danger)]">
                {errorMessage}
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-toolbar)] px-3 py-2 text-sm text-[var(--text-muted)]">
                暂无历史变更，保存文件后会出现在这里。
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const isActive = entry.id === activeEntryId;

                  return (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      className={[
                        'w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                        isActive
                          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                          : 'border-[var(--border)] bg-[var(--bg-toolbar)] hover:border-[var(--accent)]',
                      ].join(' ')}
                      onClick={() => setActiveEntryId(entry.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActiveEntryId(entry.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-[var(--text-main)]">
                          {entry.fileRelativePath}
                        </span>
                        <span
                          className={[
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            entry.trigger === 'auto'
                              ? 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]'
                              : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent-strong)]',
                          ].join(' ')}
                        >
                          {entry.trigger === 'auto' ? '自动保存' : '手动保存'}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-[var(--text-muted)]">{formatSavedAt(entry.savedAt)}</div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-[var(--text-muted)]">
                          {createHistoryChangeSummary(entry.beforeContent, entry.afterContent)}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--text-main)] transition hover:border-[var(--accent)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onJumpToChange(entry);
                          }}
                        >
                          定位
                          <ArrowUpRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="flex min-h-0 flex-col bg-[var(--bg-editor)]">
            {!activeEntry ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                选择左侧任意历史记录，查看具体变更行并定位到修改位置。
              </div>
            ) : (
              <>
                <div className="border-b border-[var(--border)] bg-[var(--bg-toolbar)] px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                        <FileJson size={14} className="text-[var(--accent-strong)]" />
                        <span className="truncate">{activeEntry.fileRelativePath}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        保存时间：{formatSavedAt(activeEntry.savedAt)} | 锚点：第 {activeEntry.anchor.line} 行 第{' '}
                        {activeEntry.anchor.column} 列
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-main)] transition hover:border-[var(--accent)]"
                      onClick={() => void onJumpToChange(activeEntry)}
                    >
                      跳转到该修改位置
                      <ArrowUpRight size={13} />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {lineChanges.length === 0 ? (
                      <span className="text-xs text-[var(--text-muted)]">正在计算变更行...</span>
                    ) : (
                      lineChanges.map((change, index) => (
                        <button
                          key={`${change.modifiedStartLineNumber}-${change.modifiedEndLineNumber}-${index}`}
                          type="button"
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-main)] transition hover:border-[var(--accent)]"
                          onClick={() => {
                            const targetLine =
                              change.modifiedStartLineNumber > 0
                                ? change.modifiedStartLineNumber
                                : change.originalStartLineNumber;
                            diffEditorRef.current?.getModifiedEditor().revealLineInCenter(targetLine);
                          }}
                        >
                          变更 {index + 1}: 原 {renderLineRange(change.originalStartLineNumber, change.originalEndLineNumber)} | 新{' '}
                          {renderLineRange(change.modifiedStartLineNumber, change.modifiedEndLineNumber)}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  <DiffEditor
                    key={activeEntry.id}
                    height="100%"
                    language="json"
                    original={activeEntry.beforeContent}
                    modified={activeEntry.afterContent}
                    theme={monacoThemeId}
                    beforeMount={registerMonacoThemes}
                    onMount={handleDiffMount}
                    options={{
                      readOnly: true,
                      renderSideBySide: false,
                      useTrueInlineView: true,
                      renderOverviewRuler: false,
                      originalEditable: false,
                      minimap: {
                        enabled: false,
                      },
                      scrollBeyondLastLine: false,
                      fontFamily: 'IBM Plex Mono',
                      fontSize: 13,
                      lineNumbersMinChars: 3,
                      wordWrap: 'on',
                      automaticLayout: true,
                      editContext: false,
                      renderRichScreenReaderContent: false,
                      hideUnchangedRegions: {
                        enabled: true,
                        contextLineCount: 2,
                        minimumLineCount: 2,
                        revealLineCount: 2,
                      },
                    }}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function registerMonacoThemes(monaco: Monaco): void {
  defineMonacoThemes(monaco);
}

function formatSavedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function renderLineRange(startLine: number, endLine: number): string {
  if (startLine <= 0 || endLine <= 0) {
    return '∅';
  }

  if (startLine === endLine) {
    return `L${startLine}`;
  }

  return `L${startLine}-L${endLine}`;
}
