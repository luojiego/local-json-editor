import { ChevronDown, ChevronRight, FileJson, Folder, FolderOpen } from 'lucide-react';

import { findHighlightIndexes } from '../lib/search';
import type { DirectoryTreeNode, JsonFileRecord, TreeNode } from '../types/editor';

interface FileTreeProps {
  tree: DirectoryTreeNode | null;
  activeFileId: string | null;
  filesById: Map<string, JsonFileRecord>;
  searchQuery: string;
  expandedDirectories: Record<string, boolean>;
  onToggleDirectory: (directoryId: string) => void;
  onSelectFile: (file: JsonFileRecord) => void;
  visibleFileIds: Set<string>;
}

export function FileTree({
  tree,
  activeFileId,
  filesById,
  searchQuery,
  expandedDirectories,
  onToggleDirectory,
  onSelectFile,
  visibleFileIds,
}: FileTreeProps) {
  if (!tree) {
    return (
      <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
        请选择目录，开始浏览 JSON 文件。
      </div>
    );
  }

  if (visibleFileIds.size === 0) {
    return (
      <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
        没有匹配的 JSON 文件，请调整搜索关键词。
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 pb-3 pt-2">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {tree.name}
      </div>
      {tree.children.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          filesById={filesById}
          activeFileId={activeFileId}
          expandedDirectories={expandedDirectories}
          onToggleDirectory={onToggleDirectory}
          onSelectFile={onSelectFile}
          visibleFileIds={visibleFileIds}
          searchQuery={searchQuery}
          depth={0}
        />
      ))}
    </div>
  );
}

interface TreeRowProps {
  node: TreeNode;
  filesById: Map<string, JsonFileRecord>;
  activeFileId: string | null;
  expandedDirectories: Record<string, boolean>;
  onToggleDirectory: (directoryId: string) => void;
  onSelectFile: (file: JsonFileRecord) => void;
  visibleFileIds: Set<string>;
  searchQuery: string;
  depth: number;
}

function TreeRow({
  node,
  filesById,
  activeFileId,
  expandedDirectories,
  onToggleDirectory,
  onSelectFile,
  visibleFileIds,
  searchQuery,
  depth,
}: TreeRowProps) {
  if (node.kind === 'file') {
    if (!visibleFileIds.has(node.fileId)) {
      return null;
    }

    const file = filesById.get(node.fileId);
    if (!file) {
      return null;
    }

    const isActive = activeFileId === file.id;

    return (
      <button
        type="button"
        className={[
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
          'hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]',
          isActive
            ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--text-main)]'
            : 'text-[var(--text-main)]',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        onClick={() => onSelectFile(file)}
      >
        <FileJson size={14} className="shrink-0 text-[var(--accent-strong)]" />
        <span className="truncate">{renderHighlightedText(file.name, searchQuery)}</span>
      </button>
    );
  }

  const visibleChildren = node.children.filter((child) => {
    if (child.kind === 'file') {
      return visibleFileIds.has(child.fileId);
    }

    return containsVisibleFile(child, visibleFileIds);
  });

  if (visibleChildren.length === 0) {
    return null;
  }

  const expanded = expandedDirectories[node.id] ?? true;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => onToggleDirectory(node.id)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span className="truncate">{node.name}</span>
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {visibleChildren.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              filesById={filesById}
              activeFileId={activeFileId}
              expandedDirectories={expandedDirectories}
              onToggleDirectory={onToggleDirectory}
              onSelectFile={onSelectFile}
              visibleFileIds={visibleFileIds}
              searchQuery={searchQuery}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function containsVisibleFile(directory: DirectoryTreeNode, visibleFileIds: Set<string>): boolean {
  for (const child of directory.children) {
    if (child.kind === 'file' && visibleFileIds.has(child.fileId)) {
      return true;
    }

    if (child.kind === 'directory' && containsVisibleFile(child, visibleFileIds)) {
      return true;
    }
  }

  return false;
}

function renderHighlightedText(text: string, query: string): JSX.Element {
  const highlightIndexes = new Set(findHighlightIndexes(text, query));

  if (highlightIndexes.size === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {text.split('').map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={highlightIndexes.has(index) ? 'font-semibold text-[var(--accent-strong)]' : undefined}
        >
          {char}
        </span>
      ))}
    </>
  );
}
