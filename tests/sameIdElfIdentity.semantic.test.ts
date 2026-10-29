import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// 2026-10-30：同序號精靈「一方效果丟失」的底層邏輯排查。
//
// 已修的三處：
// 1. connectedEffects.ts 的特性去重只按 name+description
// 2. battleEventRegistry.ts 的身分解析用 name 比對後回退到在場者
// 3. （另案）teamKitObservers.ts 的 seen 在 owner 迴圈內，本來就安全

const REGISTRY = 'src/effects/battleEventRegistry.ts';
const CONNECTED = 'src/effects/connectedEffects.ts';
const TEAM_OBS = 'src/effects/teamKitObservers.ts';
const read = (p: string) => readFileSync(p, 'utf8');

test('身分解析不再直接回退到在場者（同序號會誤抓）', () => {
  const src = read(REGISTRY);
  // 舊寫法：三元鏈直接回退
  const oldPattern = /const elf = \(ctx\.self && ctx\.self\.name === prop\)\s*\n\s*\? ctx\.self\s*\n\s*: \(ctx\.activeP1/;
  assert.ok(!oldPattern.test(src), '不可保留舊的裸三元鏈寫法');
  // 新寫法：同側在場者優先
  assert.match(src, /const sameSide = ctx\.actor === 'p1' \? ctx\.activeP1 : ctx\.activeP2;/, '必須先取同側在場者');
  assert.match(src, /if \(sameSide && sameSide\.name === prop\) return sameSide;/, '同側在場者優先');
});

test('兩處身分解析都改過（魂印 Proxy 與備援表）', () => {
  const src = read(REGISTRY);
  const matches = src.match(/const sameSide = ctx\.actor === 'p1' \? ctx\.activeP1 : ctx\.activeP2;/g) || [];
  assert.equal(matches.length, 2, `應有 2 處，實際 ${matches.length}`);
});

test('特性去重鍵含持有者（兩隻同序號不互相吃掉）', () => {
  const src = read(CONNECTED);
  assert.match(src, /const holderKey = String\(elf\.battleId \|\| elf\.id\)/);
  assert.match(src, /JSON\.stringify\(\[holderKey, trait\.name, trait\.description\]\)/);
});

test('teamKitObservers 的去重與執行鎖都有 owner 維度', () => {
  const src = read(TEAM_OBS);
  // seen 在 owner 迴圈內（每隻精靈各自一份）
  const seenIdx = src.indexOf('const seen = new Set<string>();');
  const forOwnerIdx = src.indexOf('for (const owner of ctx.getFullTeam(side)');
  assert.ok(forOwnerIdx > 0 && seenIdx > forOwnerIdx, 'seen 必須在 owner 迴圈內宣告');
  // 執行鎖的 key 含 side + owner id
  assert.match(src, /const key = JSON\.stringify\(\[side,idOf\(owner\),identity,event\]\)/, '執行鎖必須含 owner');
});

test('setPlayerState 寫到 self 這隻精靈，不是整側共用', () => {
  const src = read('src/battle/contextBuilders.ts');
  const i = src.indexOf('setPlayerState: (k, v, acquiredSource)');
  assert.ok(i > 0, '必須找到 setPlayerState');
  const block = src.slice(i, i + 900);
  assert.match(block, /find\(e => \(e\.battleId \|\| e\.id\) === \(self\.battleId \|\| self\.id\)\)/, '必須按 self 的 battleId 定位');
  assert.match(block, /\.map\(e => \(e\.battleId \|\| e\.id\) === \(self\.battleId \|\| self\.id\) \? nextOwner : e\)/, '只替換那一隻');
});

test('updateElf 找不到指定身分時直接返回，不退回在場者', () => {
  const src = read('src/battle/contextBuilders.ts');
  assert.match(src, /if \(foundIndex < 0\) return;/, '必須明確返回');
  assert.match(src, /明確指定的身分找不到時不可退回在場者/, '需保留該註解說明');
});

console.log('同序號身分解析與去重：底層邏輯檢查全部通過');
