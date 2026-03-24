const STORAGE_PREFIX = 'json-editor-tauri-v2';

export function getStoragePrefix(): string {
  return STORAGE_PREFIX;
}

export function createWorkspaceScope(workspacePath: string): string {
  return `ws-${fnv1aHash(workspacePath.trim().toLowerCase())}`;
}

export function extractWorkspaceName(workspacePath: string): string {
  const normalized = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? workspacePath;
}

export function buildScopedStorageKey(key: string, workspaceScope: string): string {
  return `${STORAGE_PREFIX}-${key}:${workspaceScope}`;
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
