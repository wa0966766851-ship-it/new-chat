import assert from 'node:assert/strict';
import { DEFAULT_ELVES, loadImportedElves } from '../src/data/defaultElves';
import { filterShellElves, newestElfKeys, newestFirst } from '../src/shell/elfPool';
import type { Elf } from '../src/types';

await loadImportedElves();
const all = DEFAULT_ELVES as Elf[];

// 新增精靈必須出現在新版清單（不被截斷、不被搜尋規則排除）。
for (const key of ['5036', '7070', '707070', 'wiki_4937']) {
  const hit = all.find(e => String(e.id) === key);
  assert.ok(hit, `資料中應有 ${key}`);
  assert.ok(filterShellElves(all, '').includes(hit!), `${key} 應在未搜尋的清單內`);
  assert.ok(filterShellElves(all, hit!.name).includes(hit!), `${key} 可用名稱搜尋`);
}
// 與舊版全站搜尋契約一致：簡繁、標點正規化與 ID 精確比對。
assert.ok(filterShellElves(all, '星光雷納多').some(e => e.id === 'wiki_4937'), '省略間隔號也能搜到');
assert.ok(filterShellElves(all, '7070').every(e => String(e.id) === '7070' || String(e.seerId) === '7070'), '數字為精確 ID，不誤中 707070');
assert.ok(filterShellElves(all, '7070').length >= 1);

// 清單變長也不截斷（舊挑選器 slice(0,120)）。
const many: Elf[] = Array.from({ length: 300 }, (_, i) => ({ ...all[0], id: `x${i}`, name: `測試${i}` }) as Elf);
assert.equal(filterShellElves(many, '').length, 300);
assert.equal(filterShellElves(many, '測試299').length, 1);

// 新精靈：清單尾端的內建精靈；自訂與階段競技場精靈不算。
const pool = [{ ...all[0], id: 'custom_1', name: '自訂' }, ...all] as Elf[];
const fresh = newestElfKeys(pool, 4);
assert.equal(fresh.size, 4);
assert.ok(!fresh.has('custom_1'));
assert.ok([...fresh].every(k => !k.startsWith('arena_')));
assert.ok(fresh.has('wiki_4937'));
const ordered = newestFirst(pool);
assert.equal(ordered.length, pool.length);
assert.equal(ordered[0].id, 'wiki_4937', '新到舊：最新匯入的排最前');
assert.equal(ordered.at(-1)!.id, 'custom_1', '自訂精靈排最後');
assert.deepEqual(new Set(ordered.map(e => e.id)), new Set(pool.map(e => e.id)), '重排不得增減精靈');
console.log('新版精靈清單：搜尋契約、不截斷、新精靈排序通過');
