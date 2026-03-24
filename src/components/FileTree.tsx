import { useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileJson,
  Folder,
  FolderOpen,
  GripVertical,
  Star,
} from 'lucide-react';

import { findHighlightIndexes } from '../lib/search';
import {
  BUTTON_ICON_STYLES,
  FAVORITE_ITEM_ACTIVE_STYLES,
  FAVORITE_ITEM_BASE_STYLES,
  FAVORITE_ITEM_HOVER_STYLES,
  FILE_ITEM_ACTIVE_STYLES,
  FILE_ITEM_BASE_STYLES,
  FILE_ITEM_HOVER_STYLES,
} from '../lib/styles';
import type { DirectoryTreeNode, JsonFileRecord, TreeNode } from '../types/editor';

const DRAG_DATA_TYPE = 'application/x-favorite-file-id';

interface FileTreeProps {
  tree: DirectoryTreeNode | null;
  activeFileId: string | null;
  filesById: Map<string, JsonFileRecord>;
  searchQuery: string;
  expandedDirectories: Record<string, boolean>;
  favoriteFileIds: string[];
  onToggleDirectory: (directoryId: string) => void;
  onToggleFavoriteFile: (fileId: string) => void;
  onMoveFavoriteFile: (draggingFileId: string, targetFileId: string) => void;
  onSelectFile: (file: JsonFileRecord) => void;
  visibleFileIds: Set<string>;
}

export function FileTree({
  tree,
  activeFileId,
  filesById,
  searchQuery,
  expandedDirectories,
  favoriteFileIds,
  onToggleDirectory,
  onToggleFavoriteFile,
  onMoveFavoriteFile,
  onSelectFile,
  visibleFileIds,
}: FileTreeProps) {
  const [draggingFavoriteFileId, setDraggingFavoriteFileId] = useState<string | null>(null);
  const [dropTargetFileId, setDropTargetFileId] = useState<string | null>(null);

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

  const favoriteFileIdSet = new Set(favoriteFileIds);
  const favoriteFiles = favoriteFileIds
    .filter((fileId) => visibleFileIds.has(fileId))
    .map((fileId) => filesById.get(fileId))
    .filter((file): file is JsonFileRecord => Boolean(file));

  const handleFavoriteDragStart = (event: DragEvent<HTMLDivElement>, fileId: string) => {
    setDraggingFavoriteFileId(fileId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_DATA_TYPE, fileId);
    event.dataTransfer.setData('text/plain', fileId);
  };

  const handleFavoriteDragOver = (event: DragEvent<HTMLDivElement>, targetFileId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    if (draggingFavoriteFileId && draggingFavoriteFileId !== targetFileId) {
      setDropTargetFileId(targetFileId);
    }
  };

  const handleFavoriteDragLeave = () => {
    setDropTargetFileId(null);
  };

  const handleFavoriteDrop = (event: DragEvent<HTMLDivElement>, targetFileId: string) => {
    event.preventDefault();
    setDropTargetFileId(null);

    const draggingFileId = event.dataTransfer.getData(DRAG_DATA_TYPE) || draggingFavoriteFileId;
    
    if (!draggingFileId || draggingFileId === targetFileId) {
      setDraggingFavoriteFileId(null);
      return;
    }

    if (!favoriteFileIds.includes(draggingFileId)) {
      setDraggingFavoriteFileId(null);
      return;
    }

    try {
      onMoveFavoriteFile(draggingFileId, targetFileId);
    } catch (error) {
      console.error('移动收藏文件失败:', error);
    } finally {
      setDraggingFavoriteFileId(null);
    }
  };

  const handleFavoriteDragEnd = () => {
    setDraggingFavoriteFileId(null);
    setDropTargetFileId(null);
  };

  const handleFavoriteKeyDown = (event: KeyboardEvent<HTMLDivElement>, fileId: string) => {
    const currentIndex = favoriteFileIds.indexOf(fileId);
    if (currentIndex < 0) return;

    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    
    if (isCtrlOrCmd && event.key === 'ArrowUp' && currentIndex > 0) {
      event.preventDefault();
      const targetFileId = favoriteFileIds[currentIndex - 1];
      onMoveFavoriteFile(fileId, targetFileId);
    } else if (isCtrlOrCmd && event.key === 'ArrowDown' && currentIndex < favoriteFileIds.length - 1) {
      event.preventDefault();
      const targetFileId = favoriteFileIds[currentIndex + 1];
      const targetIndex = currentIndex + 1;
      if (targetIndex < favoriteFileIds.length - 1) {
        onMoveFavoriteFile(fileId, favoriteFileIds[targetIndex + 1]);
      }
    }
  };

  return (
    <div className="space-y-1 px-2 pb-3 pt-2">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {tree.name}
      </div>

      {favoriteFiles.length > 0 && (
        <section className="mb-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] p-1.5">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            收藏
          </div>

          <div className="space-y-0.5">
            {favoriteFiles.map((file) => {
              const isActive = activeFileId === file.id;
              const isDragging = draggingFavoriteFileId === file.id;
              const isDropTarget = dropTargetFileId === file.id;

              return (
                <div key={file.id} className="relative">
                  {isDropTarget && (
                    <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
                  )}
                  <div
                    draggable
                    tabIndex={0}
                    role="button"
                    aria-label={`收藏文件: ${file.name}，按 Ctrl+上下箭头移动位置`}
                    className={[
                      FAVORITE_ITEM_BASE_STYLES,
                      isActive ? FAVORITE_ITEM_ACTIVE_STYLES : FAVORITE_ITEM_HOVER_STYLES,
                      isDragging ? 'opacity-40' : '',
                      isDropTarget ? 'ring-2 ring-[var(--accent)] ring-opacity-50' : '',
                    ].join(' ')}
                    onDragStart={(event) => handleFavoriteDragStart(event, file.id)}
                    onDragOver={(event) => handleFavoriteDragOver(event, file.id)}
                    onDragLeave={handleFavoriteDragLeave}
                    onDrop={(event) => handleFavoriteDrop(event, file.id)}
                    onDragEnd={handleFavoriteDragEnd}
                    onKeyDown={(event) => handleFavoriteKeyDown(event, file.id)}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 bg-transparent p-0 text-left text-[var(--text-main)]"
                      onClick={() => onSelectFile(file)}
                      tabIndex={-1}
                    >
                      <GripVertical 
                        size={13} 
                        className="shrink-0 text-[var(--text-muted)]" 
                        aria-hidden="true"
                      />
                      <FileJson size={14} className="shrink-0 text-[var(--accent-strong)]" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">
                          {renderHighlightedText(file.name, searchQuery)}
                        </span>
                        <span className="truncate text-xs text-[var(--text-muted)]">
                          {renderHighlightedText(file.relativePath, searchQuery)}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className={BUTTON_ICON_STYLES}
                      aria-label="取消收藏"
                      title="取消收藏"
                      tabIndex={-1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavoriteFile(file.id);
                      }}
                    >
                      <Star size={14} className="fill-current text-[var(--warning)]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tree.children.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          filesById={filesById}
          activeFileId={activeFileId}
          expandedDirectories={expandedDirectories}
          favoriteFileIds={favoriteFileIdSet}
          onToggleDirectory={onToggleDirectory}
          onToggleFavoriteFile={onToggleFavoriteFile}
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
  favoriteFileIds: Set<string>;
  onToggleDirectory: (directoryId: string) => void;
  onToggleFavoriteFile: (fileId: string) => void;
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
  favoriteFileIds,
  onToggleDirectory,
  onToggleFavoriteFile,
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
    const isFavorite = favoriteFileIds.has(file.id);

    return (
      <div
        className={[
          FILE_ITEM_BASE_STYLES,
          FILE_ITEM_HOVER_STYLES,
          isActive ? FILE_ITEM_ACTIVE_STYLES : 'text-[var(--text-main)]',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 bg-transparent p-0 text-left text-inherit"
          onClick={() => onSelectFile(file)}
        >
          <FileJson size={14} className="shrink-0 text-[var(--accent-strong)]" />
          <span className="truncate">{renderHighlightedText(file.name, searchQuery)}</span>
        </button>

        <button
          type="button"
          className={BUTTON_ICON_STYLES}
          aria-label={isFavorite ? '取消收藏' : '收藏文件'}
          title={isFavorite ? '取消收藏' : '收藏文件'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavoriteFile(file.id);
          }}
        >
          <Star
            size={14}
            className={isFavorite ? 'fill-current text-[var(--warning)]' : 'text-[var(--text-muted)]'}
          />
        </button>
      </div>
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
              favoriteFileIds={favoriteFileIds}
              onToggleDirectory={onToggleDirectory}
              onToggleFavoriteFile={onToggleFavoriteFile}
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
