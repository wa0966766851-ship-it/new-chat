// One-time local setup, not a CI step. Git's existing login stays in memory.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sodium = require('../build/github-secret-helper/node_modules/libsodium-wrappers');
await sodium.ready;
let input = '';
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stderr.write('Ready for hidden CI setup input.\n');
const secrets = await new Promise((resolve, reject) => {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    input += chunk;
    if (input.includes('\u0003') || input.length > 20000) reject(new Error('Cancelled'));
    if (/[\r\n]/.test(input)) {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      try { resolve(JSON.parse(input)); } catch { reject(new Error('Invalid input')); }
    }
  });
});
try {
  if (!secrets.service || !secrets.publisher) throw new Error('Missing site credentials');
  const credential = spawnSync('git', ['credential', 'fill'], { encoding: 'utf8', input: 'protocol=https\nhost=github.com\npath=wa0966766851-ship-it/new-chat.git\n\n', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  const token = credential.stdout?.match(/^password=(.+)$/m)?.[1]?.trim();
  if (credential.status !== 0 || !token) throw new Error('GitHub local login unavailable');
  const api = async (path, method = 'GET', body) => {
    const r = await fetch(`https://api.github.com/repos/wa0966766851-ship-it/new-chat/${path}`, {
      method, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'seer-site-ci-setup', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error(`GitHub CI setup HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  };
  const key = await api('actions/secrets/public-key');
  const pubkey = sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL);
  for (const [name, value] of [['SEER_SITE_SERVICE_TOKEN', secrets.service], ['SEER_SITE_PUBLISH_KEY', secrets.publisher]]) {
    const encrypted_value = sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(value), pubkey), sodium.base64_variants.ORIGINAL);
    await api(`actions/secrets/${name}`, 'PUT', { encrypted_value, key_id: key.key_id });
    const saved = await api(`actions/secrets/${name}`);
    console.log(JSON.stringify({ name: saved.name, configured: true, updatedAt: saved.updated_at }));
  }
} catch (error) { console.error(error.message.startsWith('GitHub') ? error.message : 'CI setup failed; no credential was printed.'); process.exitCode = 1; }
