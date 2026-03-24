import type { CursorPosition, ScrollPosition } from '../types/editor';

const LAST_OPEN_STATE_KEY = 'json-editor-last-open-state';

export interface FileEditorState {
  cursor: CursorPosition;
  scroll: ScrollPosition;
  cursorOffset: number;
  formatted: boolean;
}

export interface LastOpenState {
  directoryName: string;
  activeFileId: string;
  files: Record<string, FileEditorState>;
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

    if (
      typeof parsed.directoryName !== 'string' ||
      typeof parsed.activeFileId !== 'string' ||
      !parsed.files ||
      typeof parsed.files !== 'object' ||
      Array.isArray(parsed.files)
    ) {
      return null;
    }

    const files: Record<string, FileEditorState> = {};
    for (const [fileId, state] of Object.entries(parsed.files as Record<string, unknown>)) {
      const parsedState = parseFileEditorState(state);
      if (parsedState) {
        files[fileId] = parsedState;
      }
    }

    return {
      directoryName: parsed.directoryName,
      activeFileId: parsed.activeFileId,
      files,
    };
  } catch {
    return null;
  }
}

export function pruneFileEditorStates(
  fileStates: Record<string, FileEditorState>,
  fileIds: Set<string>,
): Record<string, FileEditorState> {
  const pruned: Record<string, FileEditorState> = {};

  for (const [fileId, fileState] of Object.entries(fileStates)) {
    if (fileIds.has(fileId)) {
      pruned[fileId] = fileState;
    }
  }

  return pruned;
}

function parseFileEditorState(value: unknown): FileEditorState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const cursor = parseCursor(candidate.cursor);
  const scroll = parseScroll(candidate.scroll);
  const cursorOffset =
    typeof candidate.cursorOffset === 'number' && Number.isFinite(candidate.cursorOffset)
      ? Math.max(0, Math.floor(candidate.cursorOffset))
      : null;
  const formatted = typeof candidate.formatted === 'boolean' ? candidate.formatted : null;

  if (!cursor || !scroll || cursorOffset === null || formatted === null) {
    return null;
  }

  return {
    cursor,
    scroll,
    cursorOffset,
    formatted,
  };
}

function parseCursor(value: unknown): CursorPosition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<CursorPosition>;
  if (
    typeof candidate.line !== 'number' ||
    !Number.isFinite(candidate.line) ||
    typeof candidate.column !== 'number' ||
    !Number.isFinite(candidate.column)
  ) {
    return null;
  }

  return {
    line: Math.max(1, Math.floor(candidate.line)),
    column: Math.max(1, Math.floor(candidate.column)),
  };
}

function parseScroll(value: unknown): ScrollPosition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ScrollPosition>;
  if (
    typeof candidate.top !== 'number' ||
    !Number.isFinite(candidate.top) ||
    typeof candidate.left !== 'number' ||
    !Number.isFinite(candidate.left)
  ) {
    return null;
  }

  return {
    top: Math.max(0, candidate.top),
    left: Math.max(0, candidate.left),
  };
}
