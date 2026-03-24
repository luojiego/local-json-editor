import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PACKAGE_NAME = 'json-online-editor-win10';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const templateDir = path.join(projectRoot, 'qa', 'win10');
const releaseRoot = path.join(projectRoot, 'release', 'qa-win10');
const packageDir = path.join(releaseRoot, PACKAGE_NAME);

await assertDirectoryExists(distDir, 'dist directory is missing. Run `pnpm build` first.');
await assertDirectoryExists(templateDir, 'qa/win10 template directory is missing.');

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

await cp(distDir, path.join(packageDir, 'dist'), { recursive: true });
await cp(path.join(templateDir, 'start-editor.bat'), path.join(packageDir, 'start-editor.bat'));
await cp(path.join(templateDir, 'start-local-server.ps1'), path.join(packageDir, 'start-local-server.ps1'));
await cp(path.join(templateDir, 'README_QA_WIN10.txt'), path.join(packageDir, 'README_QA_WIN10.txt'));

const zipFileName = `${PACKAGE_NAME}.zip`;
const zipResult = spawnSync('zip', ['-rq', zipFileName, PACKAGE_NAME], {
  cwd: releaseRoot,
  stdio: 'inherit',
});

if (zipResult.status !== 0) {
  console.warn('[package:qa-win10] zip command failed. Folder package was still generated.');
} else {
  console.log(`[package:qa-win10] zip generated: ${path.join(releaseRoot, zipFileName)}`);
}

console.log(`[package:qa-win10] folder generated: ${packageDir}`);

async function assertDirectoryExists(target, message) {
  try {
    const targetStat = await stat(target);
    if (!targetStat.isDirectory()) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  }
}
