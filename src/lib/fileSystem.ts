import type { DirectoryTreeNode, JsonFileRecord, TreeNode } from '../types/editor';

const JSON_EXTENSION_PATTERN = /\.jsonc?$/i;

export const DEFAULT_MAX_SCAN_DEPTH = 5;

export async function scanJsonFiles(
  directoryHandle: FileSystemDirectoryHandle,
  maxDepth = DEFAULT_MAX_SCAN_DEPTH,
): Promise<JsonFileRecord[]> {
  const files: JsonFileRecord[] = [];
  await walkDirectory(directoryHandle, '', 0, maxDepth, files);

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function walkDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  currentPath: string,
  depth: number,
  maxDepth: number,
  files: JsonFileRecord[],
): Promise<void> {
  const iterableHandle = directoryHandle as FileSystemDirectoryHandle & {
    values: () => AsyncIterable<FileSystemHandle>;
  };

  for await (const entry of iterableHandle.values()) {
    const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.kind === 'file' && JSON_EXTENSION_PATTERN.test(entry.name)) {
      const fileEntry = entry as FileSystemFileHandle;
      const directoryPath = currentPath;
      files.push({
        id: nextPath,
        name: fileEntry.name,
        relativePath: nextPath,
        directoryPath,
        depth,
        handle: fileEntry,
      });
      continue;
    }

    if (entry.kind === 'directory' && depth < maxDepth) {
      const directoryEntry = entry as FileSystemDirectoryHandle;
      await walkDirectory(directoryEntry, nextPath, depth + 1, maxDepth, files);
    }
  }
}

export function buildDirectoryTree(
  rootName: string,
  files: JsonFileRecord[],
): DirectoryTreeNode {
  const root: DirectoryTreeNode = {
    kind: 'directory',
    id: '__root__',
    name: rootName,
    path: '',
    children: [],
  };

  for (const file of files) {
    const segments = file.relativePath.split('/');
    const filename = segments.pop();

    if (!filename) {
      continue;
    }

    let currentNode = root;
    let accumulatedPath = '';

    for (const segment of segments) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;

      let nextNode = currentNode.children.find(
        (node): node is DirectoryTreeNode =>
          node.kind === 'directory' && node.path === accumulatedPath,
      );

      if (!nextNode) {
        nextNode = {
          kind: 'directory',
          id: accumulatedPath,
          name: segment,
          path: accumulatedPath,
          children: [],
        };
        currentNode.children.push(nextNode);
      }

      currentNode = nextNode;
    }

    currentNode.children.push({
      kind: 'file',
      id: file.id,
      name: filename,
      fileId: file.id,
    });
  }

  sortTree(root);
  return root;
}

function sortTree(node: DirectoryTreeNode): void {
  node.children.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  for (const child of node.children) {
    if (child.kind === 'directory') {
      sortTree(child);
    }
  }
}

export function collectDirectoryIds(root: DirectoryTreeNode): string[] {
  const directoryIds: string[] = [];
  walkTree(root, directoryIds);
  return directoryIds;
}

function walkTree(node: DirectoryTreeNode, output: string[]): void {
  output.push(node.id);

  for (const child of node.children) {
    if (child.kind === 'directory') {
      walkTree(child, output);
    }
  }
}

export async function readFileContent(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return file.text();
}

export async function saveFileContent(
  fileHandle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export function createFileMap(files: JsonFileRecord[]): Map<string, JsonFileRecord> {
  return new Map(files.map((file) => [file.id, file]));
}

export function filterTreeByFileIds(
  node: DirectoryTreeNode,
  fileIds: Set<string>,
): DirectoryTreeNode | null {
  const filteredChildren: TreeNode[] = [];

  for (const child of node.children) {
    if (child.kind === 'file') {
      if (fileIds.has(child.fileId)) {
        filteredChildren.push(child);
      }
      continue;
    }

    const filteredDirectory = filterTreeByFileIds(child, fileIds);
    if (filteredDirectory) {
      filteredChildren.push(filteredDirectory);
    }
  }

  if (node.id !== '__root__' && filteredChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
  };
}
