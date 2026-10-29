import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// 2026-10-30：次元龍「詩章」機制。
//
// 正確架構（已查證）：
//   積木 snapshot_resource_rule 安裝參數（MIGRATED_FINAL_DRAGON_SOUL_KIT, elfIds 5021）
//     → src/effects/rules/snapshotResources.ts 執行（roundStart 疊加 / faint 轉交）
//     → 由 src/effects/elves/dimensional-dragon/battleRule.ts import 完成註冊
//     → 由 src/effects/battleRules.index.ts 匯入
//     → 引擎在 battleEngine.ts:2339 / 3952 呼叫 roundStart、1577 呼叫 faint
//
// 曾經的錯誤：registry.ts 手寫一套 setMark + updateAnyElf 疊加，
// 讀不到場下精靈舊詩章（層數永遠 1）、又把已改過的 maxHp 當快照相加（上限暴漲）。
// 該手寫版本已移除。

const REGISTRY = 'src/effects/elves/dimensional-dragon/registry.ts';
const SNAPSHOT = 'src/effects/rules/snapshotResources.ts';
const DRAGON_RULE = 'src/effects/elves/dimensional-dragon/battleRule.ts';
const INDEX = 'src/effects/battleRules.index.ts';
const SOUL_KIT = 'src/data/migratedFinalMarsLanDragonKits.ts';
const read = (p: string) => readFileSync(p, 'utf8');

test('詩章由積木 snapshot_resource_rule 安裝（5021）', () => {
  const src = read(SOUL_KIT);
  assert.match(src, /elfIds: \['5021'\]/, '必須掛在 5021');
  assert.match(src, /a\('snapshot_resource_rule'/, '必須用積木安裝');
  assert.match(src, /id: 'poem_chapter'/, '印記 id');
  assert.match(src, /snapshotKey: 'poemHpSnapshots'/, '快照鍵');
  assert.match(src, /perRound: 1/, '每回合 1 篇');
  assert.match(src, /receiverKey: 'poem_chapter'/, '接收者鍵');
  assert.match(src, /vanishSourceOnTransfer: true/, '轉交後原持有者消逝');
});

test('引擎規則檔已註冊（battleRules.index 有匯入）', () => {
  assert.match(read(INDEX), /import '\.\/elves\/dimensional-dragon\/battleRule';/, 'index 必須匯入次元龍規則');
  assert.match(read(DRAGON_RULE), /import '\.\.\/\.\.\/rules\/snapshotResources';/, '規則檔必須匯入 snapshotResources');
});

test('每篇快照獨立累積，不覆蓋', () => {
  const src = read(SNAPSHOT);
  assert.match(src, /snapshots = \[\.\.\.\(old\?\.effects\?\.\[cfg\.snapshotKey\] \|\| \[\]\), \.\.\.incoming\]/, '必須附加不覆蓋');
  assert.match(src, /count: snapshots\.length/, '層數＝篇數');
});

test('回合開始為雙方所有存活精靈各加 perRound 篇', () => {
  const src = read(SNAPSHOT);
  assert.match(src, /for \(const side of \['p1', 'p2'\] as const\)/, '必須雙方都處理');
  assert.match(src, /appendSnapshots\(elf, cfg, Array\.from\(\{ length: cfg\.perRound \}/, '每隻精靈都附加');
  assert.match(src, /if \(!elf \|\| checkElfDead\(elf\)\) continue;/, '跳過已死亡');
});

test('死亡時每篇獨立加總後疊加到接收者體力上限', () => {
  const src = read(SNAPSHOT);
  assert.match(src, /const total = snapshots\.reduce\(/, '必須逐篇加總');
  assert.match(src, /receiver\.maxHp \+= total/, '接收者上限 += 總和');
  assert.match(src, /receiver\.calculatedStats = \{ \.\.\.receiver\.calculatedStats, hp: receiver\.maxHp \}/, '計算值同步');
});

test('轉交後呼叫 vanishElf 令原持有精靈消逝', () => {
  const src = read(SNAPSHOT);
  assert.match(src, /if \(cfg\.vanishSourceOnTransfer\) api\.ctx\(side, true, undefined, elf\)\.vanishElf\(side, elf\)/, '必須消逝');
  assert.match(src, /先消耗原持有者，避免死亡節點重播時重複轉交/, '必須先清再轉，避免重播');
});

test('雙方次元龍都能收到（不分敵我）', () => {
  const src = read(SNAPSHOT);
  assert.match(src, /\[\.\.\.state\.p1Team, \.\.\.state\.p2Team\]/, 'owners 必須掃雙方');
  assert.match(src, /receivers = sources\.filter\(\(e: any\) => e\.snapshotResourceRules\?\.\[cfg\.id\]\?\.receiverKey === cfg\.receiverKey\)/, '接收者按 receiverKey 比對');
});

test('registry 不再手寫疊加或轉交（避免與引擎重複）', () => {
  const src = read(REGISTRY);
  assert.ok(!/nextSnaps = \[\.\.\.oldSnaps, e\.maxHp/.test(src), '不可再手寫 maxHp 快照疊加');
  assert.ok(!/updateAnyElf\?\.\(sd, bid, \{ maxHp: \(e\.maxHp/.test(src), '不可再手寫上限提高');
  assert.ok(!/isVanished: true/.test(src), '不可再手寫消逝');
  assert.match(src, /一律由積木 snapshot_resource_rule 安裝/, '需保留說明註解');
});

test('引擎確實在 roundStart 與 faint 節點呼叫規則', () => {
  const src = read('src/engine/battleEngine.ts');
  assert.match(src, /for \(const rule of battleRules\(\)\) rule\.roundStart\?\.\(ruleApi, cur\)/, 'roundStart 呼叫');
  assert.match(src, /for \(const rule of battleRules\(\)\) rule\.faint\?\.\(ruleApi, mid\)/, 'faint 呼叫');
});

console.log('詩章機制：積木安裝／引擎執行／獨立快照／死亡轉交／消逝 全部通過');
