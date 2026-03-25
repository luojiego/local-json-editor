import { useEffect, useRef } from 'react';

import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';

import { defineMonacoThemes } from '../lib/themes';
import type { CursorPosition, ScrollPosition, ViewRestoreRequest } from '../types/editor';

interface EditorPaneProps {
  value: string;
  modelPath: string | null;
  monacoThemeId: string;
  indentation: 2 | 4;
  restoreRequest: ViewRestoreRequest | null;
  onChange: (content: string, source: 'user' | 'programmatic') => void;
  onValidation: (errorCount: number, message: string) => void;
  onCursorChange: (cursor: CursorPosition) => void;
  onScrollChange: (scroll: ScrollPosition) => void;
  onEditorBlur: () => void;
  onViewStateRestored: (requestId: number) => void;
}

export function EditorPane({
  value,
  modelPath,
  monacoThemeId,
  indentation,
  restoreRequest,
  onChange,
  onValidation,
  onCursorChange,
  onScrollChange,
  onEditorBlur,
  onViewStateRestored,
}: EditorPaneProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onEditorBlurRef = useRef(onEditorBlur);
  const cursorListenerRef = useRef<{ dispose: () => void } | null>(null);
  const scrollListenerRef = useRef<{ dispose: () => void } | null>(null);
  const blurListenerRef = useRef<{ dispose: () => void } | null>(null);
  const lastRestoredRequestIdRef = useRef<number>(0);
  const restoreCursorFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onEditorBlurRef.current = onEditorBlur;
  }, [onEditorBlur]);

  const handleEditorMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;

    cursorListenerRef.current?.dispose();
    cursorListenerRef.current = editorInstance.onDidChangeCursorPosition((event) => {
      onCursorChange({
        line: event.position.lineNumber,
        column: event.position.column,
      });
    });

    scrollListenerRef.current?.dispose();
    scrollListenerRef.current = editorInstance.onDidScrollChange((event) => {
      onScrollChange({
        top: event.scrollTop,
        left: event.scrollLeft,
      });
    });

    blurListenerRef.current?.dispose();
    blurListenerRef.current = editorInstance.onDidBlurEditorText(() => {
      onEditorBlurRef.current();
    });

    const position = editorInstance.getPosition();
    if (position) {
      onCursorChange({ line: position.lineNumber, column: position.column });
    }
  };

  useEffect(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }

    editorInstance.updateOptions({ tabSize: indentation });
  }, [indentation]);

  useEffect(() => {
    return () => {
      cursorListenerRef.current?.dispose();
      scrollListenerRef.current?.dispose();
      blurListenerRef.current?.dispose();
      if (restoreCursorFrameRef.current !== null) {
        cancelAnimationFrame(restoreCursorFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!restoreRequest || !modelPath) {
      return;
    }

    if (lastRestoredRequestIdRef.current === restoreRequest.requestId) {
      return;
    }

    let attempts = 0;

    const applyRestore = () => {
      const editorInstance = editorRef.current;
      const model = editorInstance?.getModel();

      if (!editorInstance || !model) {
        attempts += 1;
        if (attempts <= 20) {
          restoreCursorFrameRef.current = requestAnimationFrame(applyRestore);
        }
        return;
      }

      lastRestoredRequestIdRef.current = restoreRequest.requestId;
      const { cursor, reason, scroll } = restoreRequest;

      editorInstance.layout();

      try {
        if (reason === 'file-switch' && scroll) {
          editorInstance.setScrollTop(Math.max(0, scroll.top));
          editorInstance.setScrollLeft(Math.max(0, scroll.left));
        }

        if (cursor) {
          const lineNumber = clamp(cursor.line, 1, model.getLineCount());
          const column = clamp(cursor.column, 1, model.getLineMaxColumn(lineNumber));
          editorInstance.setPosition({ lineNumber, column });
          editorInstance.setSelection({
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column,
          });

          if (reason === 'format' || reason === 'history-jump') {
            editorInstance.revealPositionInCenter({ lineNumber, column });
          } else if (!scroll) {
            editorInstance.revealPositionInCenterIfOutsideViewport({ lineNumber, column });
          } else {
            editorInstance.setScrollTop(Math.max(0, scroll.top));
            editorInstance.setScrollLeft(Math.max(0, scroll.left));
          }
        } else if (scroll) {
          editorInstance.setScrollTop(Math.max(0, scroll.top));
          editorInstance.setScrollLeft(Math.max(0, scroll.left));
        }

        editorInstance.focus();
      } catch (error) {
        console.warn('恢复编辑器视图失败:', error);
      }

      onViewStateRestored(restoreRequest.requestId);
    };

    restoreCursorFrameRef.current = requestAnimationFrame(() => {
      restoreCursorFrameRef.current = requestAnimationFrame(applyRestore);
    });

    return () => {
      if (restoreCursorFrameRef.current !== null) {
        cancelAnimationFrame(restoreCursorFrameRef.current);
      }
    };
  }, [modelPath, onViewStateRestored, restoreRequest, value]);

  if (!modelPath) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-editor)] px-6 text-center text-sm text-[var(--text-muted)]">
        <div>
          <p className="text-lg font-semibold text-[var(--text-main)]">请选择左侧 JSON 文件</p>
          <p className="mt-1">支持实时校验、格式化与直接保存到本地。</p>
        </div>
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      path={modelPath}
      language="json"
      value={value}
      theme={monacoThemeId}
      beforeMount={registerMonacoThemes}
      onMount={handleEditorMount}
      onChange={(content, event) => {
        // `isFlush === true` 才是 setValue 等程序写入；其余情况按用户输入处理
        const source = event?.isFlush === true ? 'programmatic' : 'user';
        onChange(content ?? '', source);
      }}
      onValidate={(markers) => {
        const errors = markers.filter((marker) => marker.severity === 8);

        if (errors.length === 0) {
          onValidation(0, 'JSON 格式正确');
          return;
        }

        const firstError = errors[0];
        const message = `第 ${firstError.startLineNumber} 行: ${firstError.message}`;
        onValidation(errors.length, message);
      }}
      options={{
        minimap: { enabled: false },
        automaticLayout: true,
        fontFamily: 'IBM Plex Mono',
        fontSize: 14,
        lineNumbersMinChars: 3,
        renderValidationDecorations: 'editable',
        scrollBeyondLastLine: false,
        tabSize: indentation,
        // 避免 EditContext + 富屏读 DOM 与模型更新竞态时出现 Range.setStart IndexSizeError
        editContext: false,
        renderRichScreenReaderContent: false,
      }}
    />
  );
}

function registerMonacoThemes(monaco: Monaco): void {
  defineMonacoThemes(monaco);
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
