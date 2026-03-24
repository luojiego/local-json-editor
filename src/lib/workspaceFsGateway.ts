import type { JsonFileRecord } from '../types/editor';

export interface WorkspaceFsGateway {
  selectWorkspace(): Promise<string | null>;
  scanJsonFiles(rootPath: string, maxDepth?: number): Promise<JsonFileRecord[]>;
  readFile(rootPath: string, relativePath: string): Promise<string>;
  writeFile(rootPath: string, relativePath: string, content: string): Promise<void>;
  existsWorkspace(rootPath: string): Promise<boolean>;
}
