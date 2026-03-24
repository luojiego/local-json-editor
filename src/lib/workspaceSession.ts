import { getStoragePrefix } from './workspaceScope';

const LAST_WORKSPACE_PATH_STORAGE_KEY = `${getStoragePrefix()}-last-workspace-path`;

export function saveLastWorkspacePath(workspacePath: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextPath = workspacePath.trim();
  if (!nextPath) {
    return;
  }

  window.localStorage.setItem(LAST_WORKSPACE_PATH_STORAGE_KEY, nextPath);
}

export function loadLastWorkspacePath(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(LAST_WORKSPACE_PATH_STORAGE_KEY) ?? '';
}

export function clearLastWorkspacePath(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LAST_WORKSPACE_PATH_STORAGE_KEY);
}
