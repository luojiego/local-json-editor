import Fuse from 'fuse.js';
import { pinyin } from 'pinyin-pro';

import type { JsonFileRecord, SearchResult } from '../types/editor';

export function searchFiles(files: JsonFileRecord[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return files.map((file) => ({ file, score: 0 }));
  }

  if (shouldPreferDirectMatch(query)) {
    const directMatches = getDirectMatches(files, query);
    if (directMatches.length > 0) {
      return directMatches;
    }
  }

  const index = files.map((file) => ({
    file,
    initials: buildInitials(file.relativePath),
    pinyinInitials: buildPinyinInitials(file.relativePath),
  }));

  const fuse = new Fuse(index, {
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
    keys: [
      { name: 'file.name', weight: 0.55 },
      { name: 'file.relativePath', weight: 0.35 },
      { name: 'initials', weight: 0.05 },
      { name: 'pinyinInitials', weight: 0.05 },
    ],
  });

  const ranked = new Map<string, SearchResult>();

  for (const result of fuse.search(query)) {
    ranked.set(result.item.file.id, {
      file: result.item.file,
      score: result.score ?? 1,
    });
  }

  if (shouldUseSubsequenceFallback(query)) {
    for (const item of index) {
      const initialsMatched = isSubsequence(query, item.initials);
      const pinyinMatched = isSubsequence(query, item.pinyinInitials);

      if ((initialsMatched || pinyinMatched) && !ranked.has(item.file.id)) {
        ranked.set(item.file.id, {
          file: item.file,
          score: 0.35,
        });
      }
    }
  }

  return [...ranked.values()].sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.file.relativePath.localeCompare(right.file.relativePath);
  });
}

export function findHighlightIndexes(text: string, rawQuery: string): number[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const lower = text.toLowerCase();
  const directStart = lower.indexOf(query);
  if (directStart >= 0) {
    return Array.from({ length: query.length }, (_, offset) => directStart + offset);
  }

  const indices: number[] = [];
  let cursor = 0;

  for (const queryChar of query) {
    const foundAt = lower.indexOf(queryChar, cursor);
    if (foundAt < 0) {
      return [];
    }

    indices.push(foundAt);
    cursor = foundAt + 1;
  }

  return indices;
}

function buildInitials(path: string): string {
  const withoutExtension = path.replace(/\.[^./]+$/, '');
  const normalized = withoutExtension
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\s/_\-.]+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized
    .split(/\s+/)
    .map((segment) => segment[0]?.toLowerCase() ?? '')
    .join('');
}

function buildPinyinInitials(path: string): string {
  try {
    return pinyin(path, {
      pattern: 'first',
      toneType: 'none',
    })
      .replace(/\s+/g, '')
      .toLowerCase();
  } catch {
    return '';
  }
}

function isSubsequence(query: string, target: string): boolean {
  if (!query || !target) {
    return false;
  }

  let queryCursor = 0;

  for (const current of target) {
    if (query[queryCursor] === current) {
      queryCursor += 1;
      if (queryCursor === query.length) {
        return true;
      }
    }
  }

  return false;
}

function shouldUseSubsequenceFallback(query: string): boolean {
  if (!query || query.length > 8) {
    return false;
  }

  return /^[a-z0-9]+$/.test(query);
}

function shouldPreferDirectMatch(query: string): boolean {
  return /[./\\]/.test(query);
}

function getDirectMatches(files: JsonFileRecord[], query: string): SearchResult[] {
  const matched: SearchResult[] = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    const lowerPath = file.relativePath.toLowerCase();
    const indexInName = lowerName.indexOf(query);
    const indexInPath = lowerPath.indexOf(query);

    if (indexInName < 0 && indexInPath < 0) {
      continue;
    }

    // 名称命中优先于路径命中，位置越靠前越优先
    const score = indexInName >= 0 ? indexInName : 100 + indexInPath;
    matched.push({ file, score });
  }

  return matched.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.file.relativePath.localeCompare(right.file.relativePath);
  });
}
