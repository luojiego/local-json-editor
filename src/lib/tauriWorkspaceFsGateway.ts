import { invoke } from '@tauri-apps/api/core';

import type { JsonFileRecord } from '../types/editor';
import type { WorkspaceFsGateway } from './workspaceFsGateway';

interface JsonFileRecordPayload {
  name: string;
  relativePath: string;
  directoryPath: string;
  depth: number;
}

const DEFAULT_SCAN_DEPTH = 5;

class TauriWorkspaceFsGateway implements WorkspaceFsGateway {
  async selectWorkspace(): Promise<string | null> {
    return invoke<string | null>('select_workspace_dir');
  }

  async scanJsonFiles(rootPath: string, maxDepth = DEFAULT_SCAN_DEPTH): Promise<JsonFileRecord[]> {
    const payload = await invoke<JsonFileRecordPayload[]>('scan_json_files', {
      rootPath,
      maxDepth,
    });

    return payload.map((entry) => ({
      id: entry.relativePath,
      name: entry.name,
      rootPath,
      relativePath: entry.relativePath,
      directoryPath: entry.directoryPath,
      depth: entry.depth,
    }));
  }

  async readFile(rootPath: string, relativePath: string): Promise<string> {
    return invoke<string>('read_text_file', {
      rootPath,
      relativePath,
    });
  }

  async writeFile(rootPath: string, relativePath: string, content: string): Promise<void> {
    await invoke('write_text_file', {
      rootPath,
      relativePath,
      content,
    });
  }

  async existsWorkspace(rootPath: string): Promise<boolean> {
    if (!rootPath.trim()) {
      return false;
    }

    try {
      await invoke<JsonFileRecordPayload[]>('scan_json_files', {
        rootPath,
        maxDepth: 0,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const workspaceFsGateway = new TauriWorkspaceFsGateway();
