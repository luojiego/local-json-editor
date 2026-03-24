export type HistoryTrigger = 'manual' | 'auto';

export interface HistoryAnchor {
  line: number;
  column: number;
}

export interface HistoryEntry {
  id: string;
  workspaceScope: string;
  workspaceName: string;
  fileId: string;
  fileRelativePath: string;
  trigger: HistoryTrigger;
  savedAt: number;
  beforeContent: string;
  afterContent: string;
  anchor: HistoryAnchor;
}
