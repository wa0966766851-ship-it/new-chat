const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async ({ appDir }) => {
  const metadata = JSON.parse(await fs.readFile(path.join(appDir, 'package.json'), 'utf8'));
  if (Object.keys(metadata.dependencies || {}).length !== 0) {
    throw new Error('桌面執行套件應使用已打包的伺服器，不可攜帶專案依賴。');
  }
  await fs.access(path.join(appDir, 'electron', 'main.cjs'));
  // Public electron-builder hook: false means node_modules are handled externally.
  // In this project the server bundle already includes every runtime dependency.
  return false;
};
