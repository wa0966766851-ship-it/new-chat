import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusVisual, buffIconFor } from '../src/battle/effectIcons';
import { StatusRegistry } from '../src/effects/statusRegistry';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approved = ['眩暈', '神悔', '腐朽', '失溫', '遲鈍', '窒息', '平靜', '入魔'];
for (const name of approved) {
  assert.ok(StatusRegistry[name], `registered status: ${name}`);
  assert.equal(statusVisual(name)?.icon, `/status-icons/${name}.png`);
  const bytes = fs.readFileSync(path.join(root, 'public/status-icons', `${name}.png`));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 256);
  assert.equal(bytes.readUInt32BE(20), 256);
  assert.equal(bytes[25], 6, `${name}: RGBA, including transparent frame corners`);
}

// Cover every registered display name, not only the new eight.
const names = [...new Set(Object.values(StatusRegistry).map(entry => entry.name))];
for (const name of names) {
  const icon = statusVisual(name)?.icon;
  assert.ok(icon, `${name}: missing shared icon mapping`);
  assert.ok(fs.existsSync(path.join(root, 'public', icon)), `${name}: mapped image missing`);
}

// Keep existing artwork and boss/status-resistance distinctions intact.
assert.equal(statusVisual('沉睡')?.icon, '/status-icons/沉睡.png');
assert.equal(statusVisual('繳械')?.icon, '/status-icons/繳械.png');
assert.equal(statusVisual('魘昧')?.icon, '/seer/abnormal/44.png');
assert.equal(statusVisual('魘味')?.icon, statusVisual('魘昧')?.icon);
assert.equal(statusVisual('神話')?.icon, '/seer/abnormal/17.png');
assert.equal(statusVisual('免疫')?.icon, '/seer/abnormal/18.png');
assert.equal(statusVisual('異常抵抗')?.icon, '/seer/abnormal/21.png');
assert.equal(buffIconFor('精靈護盾'), '/status-icons/精靈護盾.png');
assert.equal(buffIconFor('精靈護罩'), '/status-icons/精靈護罩.png');
console.log(`異常圖標驗收：8 張 256×256 RGBA、${names.length} 個名稱素材完整、既有/BOSS/抵抗/護盾圖標隔離通過。`);
