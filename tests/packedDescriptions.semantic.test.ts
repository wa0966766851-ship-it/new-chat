import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { assertPackedDescriptions } from '../scripts/lib/packedDescriptions';

const source = { elfSourceText: { soul: '吸取20%體力；汲取70點體力', skills: ['原技能', '轉化技能'] },
  skillReferences: { power: 120, enabled: true, optional: null }, newElves: Array.from({ length: 100 }, (_, n) => ({ n, text: '完整描述保留' })) };
const pack = (value: unknown, level = 9) => JSON.stringify({ schemaVersion: 1, gzip: gzipSync(JSON.stringify(value), { level }).toString('base64') });
const fast = pack(source, 1), dense = pack(source, 9);
assert.notEqual(fast, dense, '不同壓縮串流是真實存在，不用同份fixture假測相容');
assertPackedDescriptions(fast, source);
assertPackedDescriptions(dense, source);
assertPackedDescriptions(dense + '\r\n', source);
const corrupt = Buffer.from(JSON.parse(dense).gzip, 'base64');
corrupt[corrupt.length - 8] ^= 1; // gzip CRC損壞，即使解壓資料未變也不能通過。
assert.throws(() => assertPackedDescriptions(JSON.stringify({ schemaVersion: 1, gzip: corrupt.toString('base64') }), source));
for (const changed of [
  { ...source, skillReferences: { ...source.skillReferences, power: 121 } },
  { ...source, elfSourceText: { ...source.elfSourceText, soul: '汲取20%體力；吸取70點體力' } },
  { ...source, elfSourceText: { ...source.elfSourceText, skills: [...source.elfSourceText.skills].reverse() } },
]) assert.throws(() => assertPackedDescriptions(pack(changed), source), /過期|改動/);
for (const invalid of ['{', 'null', '[]', '{}',
  JSON.stringify({ schemaVersion: 2, gzip: JSON.parse(dense).gzip }),
  JSON.stringify({ schemaVersion: 1, gzip: JSON.parse(dense).gzip, ignored: true }),
  JSON.stringify({ schemaVersion: 1, gzip: '!!!!' }),
  JSON.stringify({ schemaVersion: 1, gzip: Buffer.from('not gzip').toString('base64') }),
  JSON.stringify({ schemaVersion: 1, gzip: gzipSync('not json').toString('base64') }),
]) assert.throws(() => assertPackedDescriptions(invalid, source));
console.log('描述壓縮校驗：不同gzip串流還原同值通過；數值／吸取汲取／順序改動、損壞及非法容器拒絕。');
