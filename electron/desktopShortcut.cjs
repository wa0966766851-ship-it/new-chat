const fs = require('node:fs');
const path = require('node:path');

/** 獨立偏好與捷徑服務；只寫固定的同名捷徑，不接收任意路徑或命令。 */
function createDesktopShortcutService({ directory, desktop, executable, writeShortcut, supported = process.platform === 'win32' }) {
  const file = path.join(directory, 'launcher-settings.json');
  const status = () => {
    try { return { supported, autoDesktopShortcut: JSON.parse(fs.readFileSync(file, 'utf8')).autoDesktopShortcut === true }; }
    catch { return { supported, autoDesktopShortcut: false }; }
  };
  const preferences = value => {
    if (!supported || typeof value !== 'boolean') throw new Error('無法儲存桌面捷徑偏好');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ autoDesktopShortcut: value }), 'utf8');
    fs.renameSync(`${file}.tmp`, file);
    return status();
  };
  const create = confirm => {
    if (!supported || confirm !== true) throw new Error('尚未確認建立桌面捷徑');
    const shortcut = path.join(desktop, '賽爾對戰模擬器.lnk');
    if (fs.existsSync(shortcut)) return { message: '桌面已有同名捷徑，未覆寫。' };
    if (!fs.existsSync(executable)) throw new Error('找不到原始EXE，未建立捷徑');
    if (!writeShortcut(shortcut, 'create', { target: executable, cwd: path.dirname(executable), icon: executable, iconIndex: 0 })) throw new Error('桌面捷徑建立失敗');
    if (!fs.existsSync(shortcut)) throw new Error('未確認桌面捷徑建立成功');
    return { message: '已建立桌面捷徑。' };
  };
  const onStartup = () => { if (status().autoDesktopShortcut) return create(true); return null; };
  return { status, preferences, create, onStartup };
}
module.exports = { createDesktopShortcutService };
