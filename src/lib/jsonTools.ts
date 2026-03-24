import { applyEdits, format, modify, type Edit } from 'jsonc-parser';

export interface JsonValidationResult {
  valid: boolean;
  message: string;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface JsonChange {
  path: (string | number)[];
  type: 'set' | 'delete';
  value?: JsonValue;
}

export function validateJsonContent(content: string): JsonValidationResult {
  try {
    JSON.parse(content);
    return { valid: true, message: 'JSON 格式正确' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON 格式错误';
    return { valid: false, message };
  }
}

export function formatJson(content: string, indentation: number): string {
  const parsed = JSON.parse(content);
  return JSON.stringify(parsed, null, indentation) + '\n';
}

export function formatJsonWithCursorOffset(
  content: string,
  indentation: number,
  cursorOffset: number,
): { formattedContent: string; mappedCursorOffset: number } {
  JSON.parse(content);

  const edits = format(content, undefined, {
    insertSpaces: true,
    tabSize: indentation,
    eol: '\n',
    insertFinalNewline: true,
  });
  const formattedContent = applyEdits(content, edits);

  return {
    formattedContent,
    mappedCursorOffset: mapOffsetThroughEdits(content.length, cursorOffset, edits),
  };
}

export function hasSemanticDifference(leftContent: string, rightContent: string): boolean {
  try {
    const leftJson = JSON.parse(leftContent) as JsonValue;
    const rightJson = JSON.parse(rightContent) as JsonValue;
    return !deepEqual(leftJson, rightJson);
  } catch {
    return leftContent !== rightContent;
  }
}

export function mergeJsonWithOriginalFormatting(
  originalText: string,
  nextText: string,
  indentation: number,
): string {
  const originalValue = JSON.parse(originalText) as JsonValue;
  const nextValue = JSON.parse(nextText) as JsonValue;

  if (deepEqual(originalValue, nextValue)) {
    return originalText;
  }

  if (
    !isCompoundJson(originalValue) ||
    !isCompoundJson(nextValue)
  ) {
    return nextText;
  }

  const changes = diffJsonValue(originalValue, nextValue, []);
  if (changes.length === 0) {
    return originalText;
  }

  let merged = originalText;
  for (const change of changes) {
    const edits = modify(
      merged,
      change.path,
      change.type === 'delete' ? undefined : change.value,
      {
        formattingOptions: {
          insertSpaces: true,
          tabSize: indentation,
          eol: '\n',
        },
      },
    );
    merged = applyEdits(merged, edits);
  }

  return merged;
}

function diffJsonValue(
  oldValue: JsonValue,
  newValue: JsonValue,
  path: (string | number)[],
): JsonChange[] {
  if (deepEqual(oldValue, newValue)) {
    return [];
  }

  const oldArray = Array.isArray(oldValue);
  const newArray = Array.isArray(newValue);

  if (oldArray && newArray) {
    const changes: JsonChange[] = [];
    const maxCommonLength = Math.min(oldValue.length, newValue.length);

    for (let index = 0; index < maxCommonLength; index += 1) {
      changes.push(...diffJsonValue(oldValue[index], newValue[index], [...path, index]));
    }

    if (newValue.length > oldValue.length) {
      for (let index = oldValue.length; index < newValue.length; index += 1) {
        changes.push({
          path: [...path, index],
          type: 'set',
          value: newValue[index],
        });
      }
    }

    if (oldValue.length > newValue.length) {
      for (let index = oldValue.length - 1; index >= newValue.length; index -= 1) {
        changes.push({
          path: [...path, index],
          type: 'delete',
        });
      }
    }

    return changes;
  }

  if (oldArray || newArray) {
    return [{ path, type: 'set', value: newValue }];
  }

  if (isObjectLike(oldValue) && isObjectLike(newValue)) {
    const changes: JsonChange[] = [];
    const oldKeys = Object.keys(oldValue);
    const newKeys = Object.keys(newValue);

    for (const key of oldKeys) {
      if (!(key in newValue)) {
        changes.push({ path: [...path, key], type: 'delete' });
      }
    }

    for (const key of newKeys) {
      if (!(key in oldValue)) {
        changes.push({ path: [...path, key], type: 'set', value: newValue[key] });
        continue;
      }

      changes.push(...diffJsonValue(oldValue[key], newValue[key], [...path, key]));
    }

    return changes;
  }

  return [{ path, type: 'set', value: newValue }];
}

function isObjectLike(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompoundJson(value: JsonValue): boolean {
  return typeof value === 'object' && value !== null;
}

function deepEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!(key in right)) {
        return false;
      }
      if (!deepEqual(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function mapOffsetThroughEdits(
  originalLength: number,
  offset: number,
  edits: Edit[],
): number {
  if (edits.length === 0) {
    return clampOffset(offset, 0, originalLength);
  }

  const sortedEdits = edits.slice().sort((left, right) => {
    const diff = left.offset - right.offset;
    if (diff !== 0) {
      return diff;
    }

    return left.length - right.length;
  });

  let mappedOffset = clampOffset(offset, 0, originalLength);
  for (let index = sortedEdits.length - 1; index >= 0; index -= 1) {
    const edit = sortedEdits[index];
    const start = edit.offset;
    const end = edit.offset + edit.length;
    const delta = edit.content.length - edit.length;

    if (edit.length === 0) {
      if (mappedOffset >= start) {
        mappedOffset += edit.content.length;
      }
      continue;
    }

    if (mappedOffset < start) {
      continue;
    }

    if (mappedOffset >= end) {
      mappedOffset += delta;
      continue;
    }

    mappedOffset = start + edit.content.length;
  }

  return clampOffset(mappedOffset, 0, Number.MAX_SAFE_INTEGER);
}

function clampOffset(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}
