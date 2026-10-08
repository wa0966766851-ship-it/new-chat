import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';

/** gzip串流可隨zlib版本改變；校驗的是完整還原資料，不是某個平台的壓縮bytes。 */
export function assertPackedDescriptions(text: string, expected: unknown): void {
  const packed = JSON.parse(text);
  assert.ok(packed && typeof packed === 'object' && !Array.isArray(packed), '描述壓縮容器格式錯誤');
  assert.deepEqual(Object.keys(packed).sort(), ['gzip', 'schemaVersion'], '描述壓縮容器欄位錯誤');
  assert.equal(packed.schemaVersion, 1, '描述壓縮版本不支援');
  assert.ok(typeof packed.gzip === 'string' && packed.gzip.length > 0 && packed.gzip.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(packed.gzip), '描述壓縮base64錯誤');
  const restored = JSON.parse(gunzipSync(Buffer.from(packed.gzip, 'base64')).toString('utf8'));
  assert.deepEqual(restored, expected, '描述去重資料過期或內容遭改動');
}
