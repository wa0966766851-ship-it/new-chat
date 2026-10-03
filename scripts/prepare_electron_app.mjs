import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'build', 'electron-app');
const source = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
await fs.access(path.join(root, 'dist', 'server.cjs'));
await fs.access(path.join(root, 'dist', 'index.html'));
await fs.mkdir(path.join(destination, 'electron'), { recursive: true });
// A separate runtime package avoids shipping build tools, node_modules and .env.
// Server dependencies are already included in the isolated, smoke-tested bundle.
for (const filename of ['main.cjs', 'preload.cjs', 'serverProcess.cjs']) {
  await fs.copyFile(path.join(root, 'electron', filename), path.join(destination, 'electron', filename));
}
await fs.writeFile(path.join(destination, 'package.json'), JSON.stringify({
  name: source.name,
  version: source.version,
  description: '賽爾對戰模擬器桌面版',
  private: true,
  main: 'electron/main.cjs',
  dependencies: {},
}, null, 2) + '\n');
console.log('Electron runtime package prepared without project dependencies or secret files.');
