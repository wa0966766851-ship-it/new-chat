import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { createSkillStone, equipSkillStone, isStoneThrower, skillConfigurationKey, validateSkillStoneLoadout } from '../src/data/skillStones';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';

let count = 0;
const stone = createSkillStone('火', 'S');
for (const seed of DEFAULT_ELVES) {
  const elf = structuredClone(seed);
  const one = equipSkillStone(elf, stone, 0);
  assert.equal(one.skills[0].skillStoneGrade, 'S');
  assert.ok(one.skillPool.some(s => s.name === elf.skills[0].name));
  if (!isStoneThrower(elf)) assert.throws(() => equipSkillStone({ ...elf, ...one }, createSkillStone('水', 'A'), 1), /最多/);
  assert.throws(() => equipSkillStone(elf, createSkillStone('火', 'SS'), 0), /SS/);
  count++;
}
const thrower = structuredClone(DEFAULT_ELVES.find(e => e.id === '5026')!);
thrower.skills = ['火', '水', '電', '普通'].map(t => createSkillStone(t, 'S'));
validateSkillStoneLoadout(thrower, thrower.skills);
assert.throws(() => validateSkillStoneLoadout(thrower, [stone, stone]), /重複/);
const plain = structuredClone(DEFAULT_ELVES.find(e => e.id === '5029')!);
const importStone = (skills: typeof plain.skills) => parseElfBlueprint(JSON.stringify({ schemaVersion: 2, manualElf: { ...plain, skills } }));
assert.throws(() => importStone([createSkillStone('火', 'SS'), ...plain.skills.slice(1)]), /SS/);
assert.throws(() => importStone([stone, createSkillStone('水', 'S'), ...plain.skills.slice(2)]), /最多/);
assert.throws(() => validateSkillStoneLoadout(plain, [{ ...stone, isSkillStone: false }, createSkillStone('水', 'D')]), /最多/);
assert.throws(() => validateSkillStoneLoadout(plain, [{ ...stone, name: '火石之力-SS', isSkillStone: false, skillStoneGrade: undefined }]), /SS/);
assert.throws(() => validateSkillStoneLoadout(plain, [{ ...stone, isPerfectSkillStone: true, skillStoneEffect: '錯誤特效' }]), /完美/);
assert.throws(() => validateSkillStoneLoadout(plain, [createSkillStone('火', 'D'), createSkillStone('火', 'S', '物理', true, 'attr_fire_burn')]), /最多/);

const perfect = createSkillStone('火', 'S', '物理', true, 'attr_fire_burn');
const special = createSkillStone('火', 'S', '特殊');
const variants = equipSkillStone({ ...plain, skills: [perfect, ...plain.skills.slice(1)], skillPool: [stone, special] }, stone, 0);
assert.equal(variants.skillPool.filter(s => s.name === stone.name).length, 3, '同名普通／完美／物特版本不得互相覆蓋');
assert.equal(new Set(variants.skillPool.map(skillConfigurationKey)).size, variants.skillPool.length);
assert.notEqual(skillConfigurationKey(perfect), skillConfigurationKey(createSkillStone('火', 'S', '物理', true, 'gen_atk_up')));
assert.notEqual(skillConfigurationKey(perfect), skillConfigurationKey({ ...perfect, skillStoneRuleset: 'project' }));

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const { default: Picker } = await import('../src/components/SkillStonePicker');
const root = createRoot(document.getElementById('root')!);
try {
  const elf = structuredClone(DEFAULT_ELVES.find(e => e.id === '5029')!);
  let saved: typeof elf | undefined;
  await act(async () => root.render(React.createElement(Picker, { elf, slot: 0, onEquip: next => saved = next })));
  await act(async () => document.querySelector('button')!.click());
  assert.deepEqual([...document.querySelectorAll('[aria-label="技能石等級"] option')].map(o => o.getAttribute('value')), ['D', 'C', 'B', 'A', 'S']);
  const equip = () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('替換第'))!;
  await act(async () => equip().click());
  assert.equal(saved!.skills[0].skillStoneGrade, 'S');
  assert.ok(saved!.skillPool?.some(s => s.name === elf.skills[0].name));
  const equipped = saved!; saved = undefined;
  await act(async () => root.render(React.createElement(Picker, { elf: equipped, slot: 1, onEquip: next => saved = next })));
  await act(async () => equip().click());
  assert.equal(saved, undefined); assert.match(document.querySelector('[role="alert"]')!.textContent!, /最多/);
  await act(async () => root.render(React.createElement(Picker, { elf, slot: 4, onEquip: () => {} })));
  assert.equal(document.querySelector('[aria-label="技能石配置"]'), null);
  console.log(`技能石入口：${count}隻內建精靈規則、實際配置／保留原招式／超量拒絕／第五槽隱藏通過`);
} finally { await act(async () => root.unmount()); dom.window.close(); }
