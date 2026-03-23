import type { CursorPosition, ScrollPosition } from '../types/editor';

const LAST_OPEN_STATE_KEY = 'json-editor-last-open-state';

export interface LastOpenState {
  directoryName: string;
  fileId: string;
  cursor: CursorPosition | null;
  scroll: ScrollPosition | null;
}

export function saveLastOpenState(state: LastOpenState): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(LAST_OPEN_STATE_KEY, JSON.stringify(state));
}

export function loadLastOpenState(): LastOpenState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(LAST_OPEN_STATE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LastOpenState>;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (typeof parsed.directoryName !== 'string' || typeof parsed.fileId !== 'string') {
      return null;
    }

    if (!parsed.cursor) {
      return {
        directoryName: parsed.directoryName,
        fileId: parsed.fileId,
        cursor: null,
        scroll: parseScroll(parsed.scroll),
      };
    }

    if (
      typeof parsed.cursor.line !== 'number' ||
      typeof parsed.cursor.column !== 'number'
    ) {
      return null;
    }

    return {
      directoryName: parsed.directoryName,
      fileId: parsed.fileId,
      cursor: {
        line: parsed.cursor.line,
        column: parsed.cursor.column,
      },
      scroll: parseScroll(parsed.scroll),
    };
  } catch {
    return null;
  }
}

function parseScroll(value: unknown): ScrollPosition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ScrollPosition>;
  if (typeof candidate.top !== 'number' || typeof candidate.left !== 'number') {
    return null;
  }

  return { top: candidate.top, left: candidate.left };
}
