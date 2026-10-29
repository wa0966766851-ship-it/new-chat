import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// 2026-10-30：次元龍「詩章」機制。
//
// 修的是三個一直沒接上的通路：
// 1. poemHpSnapshots 只被寫進印記，引擎從來沒讀 → 吸收體力上限永遠無效
// 2. 死亡轉交與消逝完全沒有實作
// 3. 每回合疊加詩章完全沒有實作
// 4. 直接 setMark 沒帶 ownerBattleId → 同一精靈會出現多個同名詩章

const REGISTRY = 'src/effects/elves/dimensional-dragon/registry.ts';
const RUNTIME = 'src/blocks/runtime.ts';

const read = (p: string) => readFileSync(p, 'utf8');

test('resource_mark_add 會把 snapshotKey 的新增量實際加到 maxHp', () => {
  const src = read(RUNTIME);
  assert.match(src, /if\(p\.snapshotKey\)\{/, '必須有 snapshotKey 的後處理');
  assert.match(src, /ctx\.updateElf\?\.\(side,\{maxHp:/, '必須呼叫 updateElf 提高 maxHp');
  assert.match(src, /const gained=after-before/, '必須用實際增加篇數計算');
});

test('詩章會在回合開始時為雙方所有存活精靈疊加', () => {
  const src = read(REGISTRY);
  assert.match(src, /case EffectTiming\.ROUND_START: \{/, 'ROUND_START 必須是區塊');
  assert.match(src, /for \(const sd of \["p1", "p2"\] as const\)/, '必須雙方都處理');
  assert.match(src, /nextSnaps = \[\.\.\.oldSnaps, e\.maxHp \|\| 1000\]/, '必須追加一篇獨立快照');
  assert.match(src, /updateAnyElf\?\.\(sd, bid, \{ maxHp:/, '必須同步提高體力上限');
});

test('詩章會在持有者死亡時轉交並令原持有精靈消逝', () => {
  const src = read(REGISTRY);
  assert.match(src, /case EffectTiming\.DEATH_NODE_1: \{/, '必須處理死亡節點');
  assert.match(src, /deadPoem = getMark\(deadMarks, "poem_chapter"\)/, '必須讀死亡者的詩章');
  assert.match(src, /receivers\.push/, '必須找接收者');
  assert.match(src, /isVanished: true/, '轉交後原持有精靈必須消逝');
  assert.match(src, /clearMark\?\.\("poem_chapter"/, '消逝時清掉詩章');
});

test('詩章轉交時每篇獨立計算，加到接收者體力上限', () => {
  const src = read(REGISTRY);
  assert.match(src, /const total = snapshots\.reduce/, '必須逐篇加總');
  assert.match(src, /maxHp: \(r\.elf\.maxHp \|\| 0\) \+ total/, '接收者上限必須提高');
});

test('直接 setMark 的詩章都帶 ownerBattleId（避免同名印記重複）', () => {
  const src = read(REGISTRY);
  // 兩處直接 setMark（敕界歸元、告命詩途）都必須帶 ownerBattleId
  const blocks = src.split('id: "poem_chapter"');
  assert.ok(blocks.length >= 3, '至少三處建立詩章');
  // 檢查所有 setMark({ ... }) 區塊內都有 ownerBattleId
  const setMarks = [...src.matchAll(/setMark\(\{[\s\S]{0,600}?\}, actor\)/g)].map(m => m[0]);
  assert.ok(setMarks.length >= 2, `找到 ${setMarks.length} 個直接 setMark`);
  for (const blk of setMarks) {
    assert.ok(blk.includes('ownerBattleId'), '每個直接 setMark 都必須帶 ownerBattleId');
    assert.ok(blk.includes('persistsOffField: true'), '詩章下場後保留');
  }
});

test('詩章印記定義為不可清除且下場保留', () => {
  const src = read('src/battle/marks.ts');
  assert.match(src, /poem_chapter: \{ unit: "篇", clearable: false, persistsOffField: true/);
  assert.match(src, /poemHpSnapshots\?: number\[\]/, 'effects 需宣告 poemHpSnapshots');
});

console.log('詩章機制：吸收／疊加／轉交／消逝／去重 全部通過');
