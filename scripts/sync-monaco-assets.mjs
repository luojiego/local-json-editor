import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const sourceVsDir = path.join(projectRoot, 'node_modules', 'monaco-editor', 'min', 'vs');
const targetRootDir = path.join(projectRoot, 'public', 'monaco-editor');
const targetVsDir = path.join(targetRootDir, 'vs');

await assertDirectoryExists(sourceVsDir, 'Monaco 静态资源不存在，请先执行 `pnpm install`。');
await mkdir(targetRootDir, { recursive: true });
await rm(targetVsDir, { recursive: true, force: true });
await cp(sourceVsDir, targetVsDir, { recursive: true });

console.log(`[sync:monaco-assets] synced: ${path.relative(projectRoot, sourceVsDir)} -> ${path.relative(projectRoot, targetVsDir)}`);

async function assertDirectoryExists(directoryPath, message) {
  try {
    const targetStat = await stat(directoryPath);
    if (!targetStat.isDirectory()) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  }
}
