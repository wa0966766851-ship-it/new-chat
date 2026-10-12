import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import { skillDisplayType, skillDisplayTypeLabel } from '../src/utils/skillPresentation';
import { SkillTypeIcon } from '../src/components/SeerImages';

for (const type of ['火', '神秘電', '聖靈', '水', '--', '無屬性']) {
  const skill = { category: '屬性' as const, type };
  const before = structuredClone(skill);
  assert.equal(skillDisplayType(skill), '無屬性');
  assert.equal(skillDisplayTypeLabel(skill), '無屬性');
  const markup = renderToStaticMarkup(React.createElement(SkillTypeIcon, { skill }));
  assert.match(markup, /src="\/seer\/type\/prop.png"/);
  assert.match(markup, /alt="無屬性"/);
  assert.deepEqual(skill, before, '顯示不得改寫來源技能或轉化系別');
}
assert.equal(skillDisplayType({ category: '物理', type: '水' }), '水');
assert.equal(skillDisplayType({ category: '特殊', type: '神秘電' }), '神秘電');
assert.equal(skillDisplayTypeLabel({ category: '特殊', type: '火系' }), '火系');
for (const type of ['', '--', '無', '无属性']) {
  assert.equal(skillDisplayType({ category: '特殊', type }), '無屬性');
}
assert.ok(existsSync(new URL('../public/seer/type/prop.png', import.meta.url)), '無屬性圖標必須實際存在');
// 防止已修正的畫面日後繞過共用判定，再直接使用過期type。
for (const name of ['BattleScreen.ui', 'StartScreen', 'ElfEditor', 'ElfReadOnlyProfile', 'DestinyIntroRuleTable', 'DestinyWheelScreen']) {
  const source = readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8');
  assert.match(source, /SkillTypeIcon/);
  assert.doesNotMatch(source, /<TypeIcon\s+type=\{(?:skill|sk|s|original|hoveredSkill)\.type\}/, name);
}
console.log('屬性技能圖標：6種舊系別、攻擊／轉化系別、來源不變與6個UI入口通過');
