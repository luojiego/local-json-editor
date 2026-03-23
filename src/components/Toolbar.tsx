import { FolderOpen, IndentIncrease, Menu, Save } from 'lucide-react';

import { THEME_LIST } from '../lib/themes';

interface ToolbarProps {
  fileName: string;
  canSave: boolean;
  saveLabel: string;
  indentSize: 2 | 4;
  themeId: string;
  onOpenDirectory: () => void;
  onSave: () => void;
  onFormat: () => void;
  onIndentSizeChange: (indentSize: 2 | 4) => void;
  onThemeChange: (themeId: string) => void;
  onToggleSidebar: () => void;
}

export function Toolbar({
  fileName,
  canSave,
  saveLabel,
  indentSize,
  themeId,
  onOpenDirectory,
  onSave,
  onFormat,
  onIndentSizeChange,
  onThemeChange,
  onToggleSidebar,
}: ToolbarProps) {
  return (
    <header className="editor-toolbar relative z-20 grid gap-3 border-b border-[var(--border)] bg-[var(--bg-toolbar)] px-4 py-3 shadow-[var(--shadow)] md:grid-cols-[auto_1fr_auto]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          onClick={onToggleSidebar}
          title="折叠/展开文件树"
        >
          <Menu size={16} className="md:hidden" />
          <span className="hidden md:inline">目录</span>
        </button>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          onClick={onOpenDirectory}
        >
          <FolderOpen size={16} />
          打开目录
        </button>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSave}
          disabled={!canSave}
          title="Ctrl+S"
        >
          <Save size={16} />
          保存 (Ctrl+S)
        </button>
      </div>

      <div className="min-w-0 self-center truncate text-sm font-medium text-[var(--text-main)]">
        {fileName || '未打开文件'}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-toolbar)_88%,black_12%)] px-1 py-1">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-semibold text-[var(--text-main)] transition hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]"
            onClick={onFormat}
            title="Ctrl+Shift+F"
          >
            <IndentIncrease size={14} />
            格式化
          </button>
        </div>

        <label className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]">
          缩进
          <select
            className="bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none"
            value={indentSize}
            onChange={(event) => onIndentSizeChange(Number(event.target.value) as 2 | 4)}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]">
          主题
          <select
            className="max-w-[140px] truncate bg-transparent text-sm font-semibold text-[var(--text-main)] outline-none"
            value={themeId}
            onChange={(event) => onThemeChange(event.target.value)}
          >
            {THEME_LIST.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>

        <span className="min-w-[56px] text-right text-xs font-semibold text-[var(--text-muted)]">{saveLabel}</span>
      </div>
    </header>
  );
}
