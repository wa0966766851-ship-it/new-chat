import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OTHERWORLD_REY_SEED, OTHERWORLD_REY_SKILL_LIST } from '../src/data/otherworldRey';
import { OTHERWORLD_REY_TEXT, syncOtherworldReyDescriptions } from '../src/data/otherworldReyDescriptions';
import { applyElfOverrides } from '../src/data/elfRegistry';
import { plainDescription, formatEffectText } from '../src/utils/descFormat';

const txt = readFileSync(new URL('../elf_source_files/elf_files/5029_異境神霆雷伊.txt', import.meta.url), 'utf8').replace(/\r/g, '');
const block = (a: string, b: string) => txt.split(a)[1].split(b)[0].trim();
assert.equal(OTHERWORLD_REY_SEED.soulMark.description, block('◆ 專屬特性/魂印：異', '---'));
assert.equal(OTHERWORLD_REY_SEED.alienTraits?.gen2Trait?.description, block('◆ 特質2.0：電氣纏繞', '---'));
for (const [name, until] of [['神明', '◆ 專屬特質：雷神'], ['雷神', '---']]) {
  assert.equal(OTHERWORLD_REY_SEED.alienTraits?.exclusiveTraits?.find(t => t.name === name)?.description, block('◆ 專屬特質：' + name, until));
}
for (const s of OTHERWORLD_REY_SKILL_LIST) {
  const section = txt.split('▸ ' + s.name + ' [')[1].split('▸ ')[0].split('---')[0];
  assert.equal(s.description, section.slice(section.indexOf('\n') + 1).trim());
}
assert.ok(OTHERWORLD_REY_TEXT.rulings.includes('本次實際技能傷害的70%'));
const old: any = { ...structuredClone(OTHERWORLD_REY_SEED), evs: { atk: 252 }, shield: 333,
  soulMark: { name: '異', description: '舊摘要' }, alienTraits: { exclusiveTrait: { name: '神明 / 雷神', description: '非滿體力啟動雷神' } },
  skills: [{ ...OTHERWORLD_REY_SKILL_LIST[2], pp: 4, currentPp: 2, description: '舊技能文字' }], skillPool: [] };
const migrated = syncOtherworldReyDescriptions(old);
assert.equal(migrated.soulMark.description, OTHERWORLD_REY_TEXT.soul);
assert.equal(migrated.alienTraits.exclusiveTraits.length, 2);
assert.equal(migrated.alienTraits.exclusiveTrait, undefined);
assert.equal(migrated.skills.length, 1); assert.equal(migrated.skills[0].pp, 4); assert.equal(migrated.skills[0].currentPp, 2);
assert.deepEqual(migrated.evs, old.evs); assert.equal(migrated.shield, 333);
assert.equal(old.soulMark.description, '舊摘要', '不直接修改存檔物件');
assert.deepEqual(syncOtherworldReyDescriptions(migrated), migrated, '重載不重複添加特質');
const custom = { ...old, isCustom: true }; assert.equal(syncOtherworldReyDescriptions(custom), custom);
assert.equal(applyElfOverrides(custom, [OTHERWORLD_REY_SEED]).updated.soulMark.description, '舊摘要');
assert.equal(applyElfOverrides(old, [OTHERWORLD_REY_SEED]).updated.skills[0].description, OTHERWORLD_REY_TEXT.skills['同塵祭']);
const source = '# 魂印\n> **回合開始時：**\n>> 吸取體力總和*70，1/3；-1。\n---\n- `神降`下場後保留';
assert.equal(plainDescription(source), '魂印\n回合開始時：\n吸取體力總和*70，1/3；-1。\n\n• 神降下場後保留');
assert.ok(!formatEffectText(source).includes('**')); assert.ok(formatEffectText(source).includes('總和*70'));
console.log('雷伊TXT四段與五技能、舊存檔／自訂隔離、Markdown显示語意通過。');
