export interface JsonFileRecord {
  id: string;
  name: string;
  relativePath: string;
  directoryPath: string;
  depth: number;
  handle: FileSystemFileHandle;
}

export interface DirectoryTreeNode {
  kind: 'directory';
  id: string;
  name: string;
  path: string;
  children: TreeNode[];
}

export interface FileTreeNode {
  kind: 'file';
  id: string;
  name: string;
  fileId: string;
}

export type TreeNode = DirectoryTreeNode | FileTreeNode;

export interface CursorPosition {
  line: number;
  column: number;
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export interface ValidationState {
  errorCount: number;
  message: string;
}

export type ViewRestoreReason = 'file-switch' | 'format' | 'history-jump';

export interface ViewRestoreRequest {
  requestId: number;
  reason: ViewRestoreReason;
  cursor: CursorPosition | null;
  scroll: ScrollPosition | null;
}

export interface SearchResult {
  file: JsonFileRecord;
  score: number;
}
