import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { parseRelease } = createRequire(import.meta.url)('../electron/update/releaseClient.cjs');

/** Input is GitHub's published release response, after both EXEs were uploaded. */
export function prepareUpdateManifest(release) {
  if (release.draft !== false || release.prerelease !== false) throw new Error('僅接受已發布的穩定版本');
  const assets = ['portable', 'installer'].map(kind => {
    const item = parseRelease(release, '0.0.0', kind);
    if (item.status !== 'available') throw new Error('版本必須高於 0.0.0');
    return { name: item.fileName, size: item.size, digest: `sha256:${item.sha256}`, browser_download_url: item.url };
  });
  return { schemaVersion: 1, tag_name: release.tag_name, draft: false, prerelease: false, body: String(release.body || '').slice(0, 3000), assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('用法：node scripts/prepare_update_manifest.mjs release.json update-manifest.json');
  const release = JSON.parse((await readFile(input, 'utf8')).replace(/^\uFEFF/, ''));
  await writeFile(output, JSON.stringify(prepareUpdateManifest(release), null, 2) + '\n', { flag: 'wx' });
  console.log(`已驗證 ${release.tag_name} 兩種 EXE 的版本、大小與 SHA-256；清單已另存。`);
}
