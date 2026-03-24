import type { HistoryAnchor } from '../types/history';

export function calculateHistoryAnchor(beforeContent: string, afterContent: string): HistoryAnchor {
  const firstChangeOffset = findFirstChangeOffset(beforeContent, afterContent);
  return calculateCursorFromOffset(afterContent, firstChangeOffset);
}

export function createHistoryChangeSummary(beforeContent: string, afterContent: string): string {
  if (beforeContent === afterContent) {
    return '无内容变化';
  }

  const beforeLines = beforeContent.split('\n');
  const afterLines = afterContent.split('\n');

  const sharedPrefix = countSharedPrefixLines(beforeLines, afterLines);
  const sharedSuffix = countSharedSuffixLines(beforeLines, afterLines, sharedPrefix);
  const removedLines = Math.max(0, beforeLines.length - sharedPrefix - sharedSuffix);
  const addedLines = Math.max(0, afterLines.length - sharedPrefix - sharedSuffix);

  if (addedLines === 0) {
    return `删除 ${removedLines} 行`;
  }

  if (removedLines === 0) {
    return `新增 ${addedLines} 行`;
  }

  return `修改 ${removedLines} -> ${addedLines} 行`;
}

function findFirstChangeOffset(beforeContent: string, afterContent: string): number {
  const maxCommonLength = Math.min(beforeContent.length, afterContent.length);
  let offset = 0;

  while (offset < maxCommonLength && beforeContent[offset] === afterContent[offset]) {
    offset += 1;
  }

  return clamp(offset, 0, afterContent.length);
}

function calculateCursorFromOffset(content: string, offset: number): HistoryAnchor {
  if (content.length === 0) {
    return { line: 1, column: 1 };
  }

  const safeOffset = clamp(offset, 0, content.length);
  let line = 1;
  let column = 1;

  for (let index = 0; index < safeOffset; index += 1) {
    if (content[index] === '\n') {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }

  return { line, column };
}

function countSharedPrefixLines(beforeLines: string[], afterLines: string[]): number {
  const maxCommonLength = Math.min(beforeLines.length, afterLines.length);
  let sharedCount = 0;

  while (sharedCount < maxCommonLength && beforeLines[sharedCount] === afterLines[sharedCount]) {
    sharedCount += 1;
  }

  return sharedCount;
}

function countSharedSuffixLines(
  beforeLines: string[],
  afterLines: string[],
  sharedPrefix: number,
): number {
  const maxCommonLength = Math.min(beforeLines.length, afterLines.length) - sharedPrefix;
  let sharedCount = 0;

  while (
    sharedCount < maxCommonLength &&
    beforeLines[beforeLines.length - 1 - sharedCount] === afterLines[afterLines.length - 1 - sharedCount]
  ) {
    sharedCount += 1;
  }

  return sharedCount;
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
