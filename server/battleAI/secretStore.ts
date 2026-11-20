import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

/** DPAPI CurrentUser；秘密只經 stdin，不出現在程序參數或專案目錄。 */
export async function protectSecret(value: string, decrypt = false): Promise<string> {
  if (process.platform !== 'win32') throw Error('REMEMBER_UNSUPPORTED');
  const operation = decrypt
    ? '[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'
    : '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))';
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile','-NonInteractive','-Command', `Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); [Console]::Out.Write(${operation})`], {windowsHide:true,stdio:['pipe','pipe','pipe']});
    let result = '';
    const timer = setTimeout(() => { child.kill(); reject(Error('VAULT_TIMEOUT')); }, 10000);
    child.stdout.on('data', d => { result += d; });
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(Error('VAULT_FAILED')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(result.trim()) : reject(Error('VAULT_FAILED')); });
    child.stdin.on('error', () => {});
    child.stdin.end(value);
  });
}
export function createSecretStore(root: string) {
  const installation = createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,20);
  const file = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'.config'), 'SeerBattle', installation, 'decision-key.dpapi');
  let key: string | undefined, remembered = false;
  let queue = Promise.resolve();
  const loaded = (async () => { try { key = await protectSecret(await fs.readFile(file,'utf8'),true); remembered = !!key; } catch { /* 空白配置或憑證不可用 */ } })();
  return {
    async get() { await loaded; return key; },
    async status() { await loaded; return {configured:!!key,remembered,canRemember:process.platform === 'win32'}; },
    set(value?: string, remember = false) {
      const task = queue.then(async () => {
        await loaded;
        if (value && remember) {
          const encrypted = await protectSecret(value);
          await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
          await fs.writeFile(file+'.tmp',encrypted,{mode:0o600}); await fs.rename(file+'.tmp',file);
        } else await fs.rm(file,{force:true});
        key = value; remembered = !!value && remember;
      });
      queue = task.catch(() => {}); return task;
    },
  };
}
