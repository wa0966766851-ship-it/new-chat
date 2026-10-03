/** 圖標素材盤點；不改動註冊表、圖片或戰鬥程式。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { STATUS_NAMES_MAP } from '../src/effects/statusAliases';
import { statusVisual } from '../src/battle/effectIcons';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs/status-artwork');
const source = JSON.parse(fs.readFileSync(path.join(root, 'src/data/seerEffects.json'), 'utf8'));
const entries = new Map<string, { keys: string[]; entry: (typeof StatusRegistry)[string] }>();
for (const [key, entry] of Object.entries(StatusRegistry)) {
  const group = entries.get(entry.name) || { keys: [], entry };
  group.keys.push(key);
  entries.set(entry.name, group);
}
function pngInfo(file: string) {
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return { validPng: false };
  return {
    validPng: true, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
    bitDepth: bytes[24], colorType: bytes[25], bytes: bytes.length,
    alphaChannel: bytes[25] === 4 || bytes[25] === 6,
  };
}
const rows = [...entries].map(([name, { keys, entry }]) => {
  const icon = statusVisual(name)?.icon || null;
  const asset = icon ? path.join(root, 'public', icon.replace(/^\//, '')) : null;
  const candidates = [path.join(root, '異常圖標', `${name}.png`), path.join(root, 'public/status-icons', `${name}.png`)].filter(fs.existsSync);
  return {
    name, registryKeys: keys,
    aliases: Object.entries(STATUS_NAMES_MAP).filter(([, target]) => keys.includes(target) || target === name).map(([alias]) => alias).filter(alias => !keys.includes(alias)),
    categories: entry.categories, description: entry.description,
    icon, asset: asset ? path.relative(root, asset).replaceAll('\\', '/') : null,
    image: asset ? pngInfo(asset) : null,
    coverage: icon && asset && fs.existsSync(asset) ? 'mapped_existing' : candidates.length ? 'unmapped_local' : 'missing',
    localCandidates: candidates.map(file => path.relative(root, file).replaceAll('\\', '/')),
  };
});
const extraSourceRows = Object.entries(source.status).filter(([name]) => !rows.some(row => row.registryKeys.includes(name) || row.name === name)).map(([name, value]) => ({ name, data: value }));
const unresolvedAliases = [...new Set(Object.values(STATUS_NAMES_MAP))].filter(name => !StatusRegistry[name]);
const manifest = {
  schemaVersion: 1,
  scope: 'StatusRegistry unique entry.name; excludes marks, shields and timed effects; artwork coverage is not mechanic correctness',
  counts: { registryKeys: Object.keys(StatusRegistry).length, uniqueStatuses: rows.length, mappedExisting: rows.filter(row => row.coverage === 'mapped_existing').length, missing: rows.filter(row => row.coverage === 'missing').length, unmappedLocal: rows.filter(row => row.coverage === 'unmapped_local').length },
  rows, extraSourceRows, unresolvedAliases,
};
if (process.argv.includes('--write')) {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(manifest, null, 2) + '\n');
}
console.log(JSON.stringify({ counts: manifest.counts, missing: rows.filter(row => row.coverage !== 'mapped_existing'), extraSourceRows, unresolvedAliases }, null, 2));
