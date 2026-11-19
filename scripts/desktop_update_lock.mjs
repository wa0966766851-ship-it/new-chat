import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** The OS releases the listener even when an update is killed before its finally block. */
export async function acquireDesktopUpdateLock(home) {
  const root = fs.realpathSync(home);
  const key = createHash('sha256').update(process.platform === 'win32' ? root.toLowerCase() : root).digest('hex');
  const endpoint = process.platform === 'win32' ? '\\\\.\\pipe\\seer-desktop-update-' + key
    : process.platform === 'linux' ? '\0seer-desktop-update-' + key
    : { host: '127.0.0.1', port: 49152 + (parseInt(key.slice(0, 4), 16) % 16384) };
  const listener = net.createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(endpoint, () => {
      listener.off('error', reject);
      resolve();
    });
  }).catch(error => {
    if (error.code === 'EADDRINUSE') throw Error('已有桌面更新進行中');
    throw error;
  });

  // Keep the marker for the workspace maintenance and rollback tools.
  const marker = path.join(root, 'update.lock');
  try {
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
  } catch (error) {
    listener.close();
    throw error;
  }
  return async () => {
    try {
      fs.rmSync(marker, { force: true });
    } finally {
      await new Promise(resolve => listener.close(resolve));
    }
  };
}
