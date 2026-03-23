import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import type { CursorPosition, ValidationState } from '../types/editor';

interface StatusBarProps {
  validation: ValidationState;
  cursor: CursorPosition;
  saveText: string;
  isDirty: boolean;
}

export function StatusBar({ validation, cursor, saveText, isDirty }: StatusBarProps) {
  const hasError = validation.errorCount > 0;

  return (
    <footer className="flex h-10 items-center justify-between border-t border-[var(--border)] bg-[var(--bg-status)] px-4 text-xs text-[var(--text-main)]">
      <div className="flex items-center gap-4">
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold',
            hasError
              ? 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]'
              : 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]',
          ].join(' ')}
          title={validation.message}
        >
          {hasError ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          {hasError ? `错误 ${validation.errorCount}` : 'JSON 正确'}
        </span>
        <span className="text-[var(--text-muted)]">{validation.message}</span>
      </div>

      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <span>
          第 {cursor.line} 行 {cursor.column} 列
        </span>
        <span>UTF-8</span>
        <span className={isDirty ? 'font-semibold text-[var(--warning)]' : 'text-[var(--success)]'}>
          {saveText}
        </span>
      </div>
    </footer>
  );
}
