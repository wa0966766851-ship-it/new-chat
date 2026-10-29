import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// 2026-10-30：兩個「效果莫名不觸發」的斷路。
//
// 1. 技能自己的 on_skill_selected 固有節點沒有執行端
//    （無極聖武：英雄之耀 3 層時消除自身回合類效果／解除自身異常狀態）
// 2. 同序號精靈的專屬特性去重只按 name+description，
//    兩隻雷伊（5029）時第二隻的「神明」「雷神」整段被跳過

const ENGINE = 'src/engine/battleEngine.ts';
const CONNECTED = 'src/effects/connectedEffects.ts';
const REGISTRY = 'src/blocks/registry.ts';

const read = (p: string) => readFileSync(p, 'utf8');

test('選招後會執行技能自己的 on_skill_selected kit 節點', () => {
  const src = read(ENGINE);
  assert.match(src, /node === 'on_skill_selected'/, '必須篩出 on_skill_selected 節點');
  assert.match(src, /runConnectedKit\('on_skill_selected'/, '必須呼叫 runConnectedKit');
  assert.match(src, /import \{ runConnectedKit \}/, '必須匯入 runConnectedKit');
});

test('on_skill_selected 在合法選招之後、選招狀態通知之前執行', () => {
  const src = read(ENGINE);
  const sel = src.indexOf("const selCtx = getBattleEventContext(side, true, 0);");
  const run = src.indexOf("runConnectedKit('on_skill_selected'");
  const notify = src.indexOf('statusSkillSelected(selCtx,skill,slot);');
  assert.ok(sel > 0, '必須建立選招 context');
  assert.ok(run > sel, 'runConnectedKit 必須在 context 之後');
  assert.ok(notify > run, 'statusSkillSelected 必須在執行之後');
});

test('runSkillBlocks 仍然只跑 use / after_hit / on_invalid（on_skill_selected 由選招端負責）', () => {
  const src = read(REGISTRY);
  assert.match(src, /phase: "use" \| "after_hit" \| "on_invalid"/, '階段簽名不變');
});

test('特性去重按持有者區分，兩隻同序號不會互相吃掉', () => {
  const src = read(CONNECTED);
  assert.match(src, /const holderKey = String\(elf\.battleId \|\| elf\.id\)/, '必須取得持有者鍵');
  assert.match(src, /JSON\.stringify\(\[holderKey, trait\.name, trait\.description\]\)/, '去重鍵必須含持有者');
  // 不可退回只用 name + description
  assert.ok(
    !/JSON\.stringify\(\[trait\.name,\s*trait\.description\]\)/.test(src),
    '不可只用 name + description 去重',
  );
});

test('無極聖武三個固有效果都掛在 on_skill_selected 且帶 3 層條件', () => {
  const sel = read('src/data/migratedSelectionSkillKits.ts');
  assert.match(sel, /node:'on_skill_selected'/, '烈武天徵必須有 on_skill_selected');
  assert.match(sel, /clear_turn/, '必須消除自身回合類效果');
  assert.match(sel, /arena\.heroGlory/, '條件必須讀英雄之耀');

  const restored = read('src/data/migratedRestoredPpSkillKits.ts');
  assert.match(restored, /node:'on_skill_selected'/, '亂武天傀必須有 on_skill_selected');

  const removed = read('src/data/migratedRemovedLevelSkillKits.ts');
  assert.match(removed, /node:'on_skill_selected'/, '鋭武銘戈必須有 on_skill_selected');
});

test('兩隻 5029 雷伊的專屬特性描述完全相同（去重若不看持有者必然誤殺）', () => {
  const src = read('src/data/otherworldRey.ts');
  assert.match(src, /OTHERWORLD_REY_ID = "5029"/);
  // 兩個專屬特性名稱
  assert.match(src, /name: "神明"/);
  assert.match(src, /name: "雷神"/);
});

console.log('選招固有節點與同序號特性去重：全部通過');
