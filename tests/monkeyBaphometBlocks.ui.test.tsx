import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { BlockProgramView } from '../src/components/BlockProgramView';
import { MIGRATED_MONKEY_BAPHOMET_SKILL_KITS as definitions } from '../src/data/migratedMonkeyBaphometSkillKits';
import { sequenceActionLabel } from '../src/effects/sequencePresentation';
import { validateKit } from '../src/effects/kitValidation';
import { distillEffect } from '../src/effects/distillEffect';
defineCustomBlocks();
let entries = 0;
for (const definition of definitions) {
  const before = JSON.stringify(definition);
  validateKit(definition.kit);
  const workspace = new Blockly.Workspace();
  try {
    for (const entry of definition.kit) {
      const block = buildEntryBlock(workspace as any, entry);
      assert.ok(block, `${definition.name}/${entry.order}不能只有保留機制`);
      assert.notEqual(block.type, 'native_effect_reference');
      assert.deepEqual(createKitBlockParser('skill')(block, entry.node, entry.order), entry, `${definition.name}: 畫布讀寫必須完整一致`);
      entries++;
    }
    const saved = Blockly.serialization.workspaces.save(workspace);
    const restored = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(saved, restored);
      const actual = restored.getTopBlocks(false).map(block => {
        const entry = JSON.parse(block.data!).entry;
        return createKitBlockParser('skill')(block, entry.node, entry.order);
      }).sort((a, b) => a!.order - b!.order);
      assert.deepEqual(actual, [...definition.kit].sort((a, b) => a.order - b.order), '正式Blockly存檔再載入不丟失巢狀效果');
    } finally { restored.dispose(); }
  } finally { workspace.dispose(); }
  const markup = renderToStaticMarkup(<BlockProgramView program={{ title: definition.name, kind: 'skill', clauses: definition.kit
    .filter(e => e.codeId === 'effect_sequence').map(e => e.params.clause) }} source="kit" />);
  const dom = new JSDOM(markup);
  const text = dom.window.document.body.textContent!;
  if (definition.name === '星光·冥想') {
    assert.ok(text.includes('當回合起3回合')); assert.ok(text.includes('攻擊和特攻×50%的百分比傷害'));
    assert.ok(text.includes('下2回合')); assert.ok(text.includes('免疫並反彈所有異常'));
  }
  if (definition.name === '贖魂讚詩') assert.ok(text.includes('現有異常轉化為害怕（3回合）'));
  if (definition.name === '引魂咏') assert.ok(text.includes('每次使用+10%，最高50%'));
  dom.window.close();
  assert.equal(JSON.stringify(definition), before, '渲染與畫布不能改寫定義');
}
assert.equal(sequenceActionLabel({ op: 'dmg', p: { flat: 300, type: '固定' }, label: '保留使用者名稱' }), '保留使用者名稱');
assert.equal(sequenceActionLabel({ op: 'boost', p: { power: true, add: 10, per: 'self_up_kinds' }, label: 'boost' }), '技能威力+10（每項自身能力提升）');
assert.ok(!sequenceActionLabel({ op: 'status', p: { side: 'opp', status: '神話' }, label: 'status' }).includes('3回合'), '不能造出BOSS期限');
const converted = distillEffect({ name: '改名的自訂轉化', description: '🎯 將對手所處的異常狀態轉化為害怕' }, 'skill');
assert.equal(converted.complete, true, JSON.stringify(converted.issues));
validateKit(converted.kit);
assert.equal(converted.kit[0].params.clause.body[0].acts[0].p.turns, 3, '自訂文本使用同一明確期限合約');
console.log(`6份技能／${entries}個積木畫布往返、中文可讀顯示與定義不變通過（無前台）`);
