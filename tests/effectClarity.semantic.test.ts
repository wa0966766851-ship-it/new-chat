import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { createDamageEntry, suggestDamageTypes } from '../src/effects/damageChoices';
import { normalizeBlockAtom } from '../src/effects/blockParams';
import { ATOMS, runNode } from '../src/effects/effectRunner';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';
import { canonicalStatusName, sameStatus, statusOptionsFor } from '../src/effects/statusIdentity';
import { isControlAilment, getAilmentCategory } from '../src/effects/ailmentEngine';
import { getActiveEffects } from '../src/components/StatusInspector';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { describeExecution, auditProgram } from '../src/blocks/audit';
import { SOUL_MODE } from '../src/blocks/specs';
import { TraitsEngine } from '../src/utils/traitsEngine';
import { BoundedCache } from '../src/utils/boundedCache';
import { STATUS_NAMES_MAP, isControlStatus, isStatusActive as helperStatusActive } from '../src/utils/battleHelpers';
import { isStatusActive as managerStatusActive } from '../src/utils/statusManager';
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`); }
check('數值預設固定、% 預設百分比，但明寫技能／真實優先', () => {
  assert.equal(createDamageEntry({ amount: 150, unit: 'points' }).params.damageType, 'fixed');
  assert.equal(createDamageEntry({ amount: 25, unit: 'percent' }).params.damageType, 'percent');
  assert.deepEqual(suggestDamageTypes('附加150點傷害')?.types, ['fixed']);
  assert.deepEqual(suggestDamageTypes('附加最大體力25%的真實傷害')?.types, ['true']);
  assert.deepEqual(suggestDamageTypes('附加技能傷害的70%技能傷害')?.types, ['skill']);
  assert.deepEqual(suggestDamageTypes('造成傷害提升70%')?.types, []);
  assert.deepEqual(suggestDamageTypes('50%機率附加10點傷害')?.types, ['fixed']);
  assert.deepEqual(suggestDamageTypes('造成攻擊傷害')?.types, ['attack']);
  assert.deepEqual(suggestDamageTypes('令自身體力歸1')?.types, ['hp_adjust']);
});
check('非真實傷害不誤判真傷；同句額外真傷仍分別列出', () => {
  assert.deepEqual(suggestDamageTypes('出手時令對手本次受到非真實傷害提升70%')?.types, ['non_true']);
  assert.deepEqual(suggestDamageTypes('非真實傷害減半，額外附加210點真實傷害')?.types, ['true', 'non_true']);
  assert.deepEqual(suggestDamageTypes('非真傷提升50%')?.types, ['non_true']);
});
check('追加傷害走四種明確管線，0% 不變成10倍體力', () => {
  for (const type of ['fixed', 'percent', 'true', 'skill'] as const) {
    for (const amount of [0, 25]) {
      const entry = createDamageEntry({ amount, unit: type === 'percent' ? 'percent' : 'points', type, elem: '電' });
      const atom = normalizeBlockAtom(entry.codeId, entry.params), calls: any[] = [];
      const ctx = { actor: 'p1', targetSide: 'p2', activeP1: { maxHp: 800 }, activeP2: { maxHp: 1000 }, applyTrueDamage: (...a: any[]) => calls.push(['true', ...a]), applyFixedDamage: (...a: any[]) => calls.push(['fixed', ...a]), applyPercentDamage: (...a: any[]) => calls.push(['percent', ...a]), applySkillTypeDamage: (...a: any[]) => calls.push(['skill', ...a]) };
      ATOMS.extra_damage(atom.params, atom.target, ctx);
      assert.equal(calls.length, 1); assert.equal(calls[0][0], type); assert.equal(calls[0][1], 'p2');
      assert.equal(calls[0][2], type === 'percent' ? amount / 100 : amount);
      if (type === 'skill') assert.deepEqual(calls[0][4], { elem: '電', node: 'attack_damage' });
    }
  }
});
check('百分比取值可以搭配真實傷害，類別不受數值單位覆蓋', () => {
  const entry = createDamageEntry({ amount: 25, unit: 'percent', type: 'true' });
  const atom = normalizeBlockAtom(entry.codeId, entry.params); let actual = -1;
  ATOMS.extra_damage(atom.params, atom.target, { actor: 'p1', targetSide: 'p2', activeP2: { maxHp: 1000 }, applyTrueDamage: (_s: string, a: number) => { actual = a; } });
  assert.equal(actual, 250); assert.match(entry.customText!, /真實傷害/);
});
check('技能直接附加與回合延遲傷害使用不同節點，不憑類別產生額外行動', () => {
  const calls: any[] = [], ctx: any = { actor: 'p1', applySkillTypeDamage: (...args: any[]) => calls.push(args) };
  for (const node of ['on_hit', 'round_end'] as const) {
    const entry = createDamageEntry({ amount: 150, unit: 'points', type: 'skill', elem: '電', node });
    runNode(node, [entry], {}, ctx);
  }
  assert.equal(calls[0][3].node, 'attack_damage'); assert.equal(calls[1][3].node, 'skill_effect');
  assert.equal(ctx.effectNode, undefined);
});
check('未定傷害不偷用粉傷，非法數值／未指定技能屬性拒絕建立', () => {
  let damage = 0, log = '';
  ATOMS.extra_damage({ dmgType: 'unknown', amount: 100 }, 'opponent', { actor: 'p1', targetSide: 'p2', applyPinkDamage: () => damage++, addLog: (message: string) => log = message });
  assert.equal(damage, 0); assert.match(log, /未確認/);
  assert.throws(() => createDamageEntry({ amount: NaN, unit: 'points' }));
  assert.throws(() => createDamageEntry({ amount: 5001, unit: 'percent' }));
  assert.equal(createDamageEntry({ amount: 210, unit: 'percent' }).params.amount, 210);
  assert.throws(() => createDamageEntry({ amount: 10, unit: 'points', type: 'skill' }));
});
check('所有37隻精靈均能取得魂印／攜帶／預備技能積木與待確認清單', () => {
  assert.equal(DEFAULT_ELVES.length, 37);
  const handlers = { skill: () => true, soul: () => true };
  for (const elf of DEFAULT_ELVES) {
    const soul = describeExecution({ elf }, handlers);
    assert.equal(soul.route, SOUL_MODE[String(elf.id)] === 'blocks' ? 'blocks' : 'handler');
    for (const sk of [...elf.skills, ...(elf.skillPool || [])]) {
      const rows = auditProgram(describeExecution({ skill: sk }, handlers).program);
      assert.ok(rows.every(c => c.semanticVerification === 'pending'));
    }
    assert.ok(auditProgram(soul.program).every(c => c.raw && c.semanticVerification === 'pending'));
  }
});
check('新版完整圖紙保留雷伊特質與訓練，不接收神降／印記等戰鬥狀態', () => {
  const rey = DEFAULT_ELVES.find(e => String(e.id) === '5029')!;
  const result = parseElfBlueprint(JSON.stringify({ schemaVersion: 2, manualElf: { ...rey, currentHp: -100, marks: [{ id: 'old' }], deathImmunity: true } }));
  assert.deepEqual(result.elf.alienTraits, rey.alienTraits);
  assert.deepEqual(result.elf.baseStats, rey.baseStats);
  assert.equal(result.elf.currentHp, result.elf.calculatedStats.hp);
  assert.equal(result.elf.marks, undefined); assert.equal(result.elf.deathImmunity, undefined);
  assert.ok(result.warnings.some(w => w.includes('marks')));
});
check('大量描述修改不無限累积解析快取，最近使用者保留', () => {
  const cache = new BoundedCache<string, number>(3);
  cache.set('keep', 1); cache.set('old', 2); cache.set('new', 3); assert.equal(cache.get('keep'), 1);
  cache.set('four', 4); assert.equal(cache.get('old'), undefined); assert.equal(cache.get('keep'), 1);
  for (let i = 0; i < 2000; i++) cache.set(String(i), i);
  assert.equal(cache.size, 3); assert.equal(cache.get('1999'), 1999);
});
check('舊版圖紙明示缺項，未來版本／損毀／原型／錯誤資料拒絕匯入', () => {
  const base = DEFAULT_ELVES[0];
  const old = parseElfBlueprint(JSON.stringify({ manualStats: { elfName: '舊版', elfType: base.type, baseStats: base.baseStats, skills: base.skills } }));
  assert.equal(old.version, 1); assert.ok(old.warnings.some(w => w.includes('舊版')));
  for (const bad of ['[]', '{', '{"schemaVersion":3}', '{"__proto__":{}}', JSON.stringify({ schemaVersion: 2, manualElf: { ...base, skills: 'bad' } }), JSON.stringify({ schemaVersion: 2, manualElf: { ...base, baseStats: { ...base.baseStats, hp: '120' } } })]) assert.throws(() => parseElfBlueprint(bad));
});
check('抗性類別逐項來自登記表且不含BOSS／附屬，歷史麻痹等同麻痺', () => {
  assert.ok(sameStatus('麻痹', '麻痺')); assert.ok(!sameStatus('麻痺', '癱瘓'));
  for (const category of ['CONTROL', 'WEAKENING'] as const) for (const key of statusOptionsFor(category)) assert.ok(StatusRegistry[key].categories.includes(category));
  assert.ok(!statusOptionsFor('CONTROL').includes('束縛'));
  assert.ok(statusOptionsFor('WEAKENING').includes('束縛'));
});
check('全部登記異常的控制分類一致；混亂／束縛不是控制，魘味是弱化', () => {
  for (const [key, entry] of Object.entries(StatusRegistry)) assert.equal(isControlStatus(key), entry.categories.includes('CONTROL'), key);
  assert.equal(isControlStatus('confused'), false); assert.equal(isControlStatus('shackled'), false);
  assert.equal(isControlStatus('paralyzed'), true); assert.equal(isControlStatus('魘味'), false);
});
check('歷史英文別名抗性與兩個狀態查詢入口逐項匹配登記主名', () => {
  for (const [alias, name] of Object.entries(STATUS_NAMES_MAP).filter(([alias, name]) => alias !== name && StatusRegistry[name])) {
    const elf: any = { ...DEFAULT_ELVES[0], alienTraits: undefined, battleStatus: name, battleStatusDuration: 2, battleStatuses: { [name]: 2 }, effects: [], resistances: { statusResist: { allImmune: false, slots: [{ status: name, rate: 100 }] } } };
    assert.ok(managerStatusActive(elf, alias), alias); assert.ok(helperStatusActive(elf, alias), alias);
    const ctx: any = { actor: 'p1', self: elf, activeP1: elf, activeP2: elf, getMarks: () => [], getPlayerState: () => 0, setPlayerState: () => {}, rng: () => 0.99, addLog: () => {}, applyTrueDamage: () => {} };
    const exempt = StatusRegistry[name].categories.some(c => ['AUXILIARY', 'BOSS_ONLY', 'NO_EFFECT'].includes(c));
    assert.equal(TraitsEngine.filterStatusInflict(ctx, 'p1', alias, 2).handled, !exempt, alias);
  }
  assert.ok(!sameStatus('神話', '免疫')); assert.ok(!sameStatus('異常抵抗', '免疫'));
});
check('實際抗性骰同時匹配兩種麻痺 key，BOSS異常不走抗性骰', () => {
  for (const [stored, incoming] of [['麻痹', '麻痺'], ['麻痺', '麻痹']]) {
    const elf = { ...DEFAULT_ELVES[0], alienTraits: undefined, resistances: { statusResist: { allImmune: false, slots: [{ status: stored, rate: 100 }] } } };
    const ctx: any = { actor: 'p1', self: elf, activeP1: elf, activeP2: elf, getMarks: () => [], getPlayerState: () => 0, setPlayerState: () => {}, rng: () => 0.99, addLog: () => {} };
    const result = TraitsEngine.filterStatusInflict(ctx, 'p1', incoming, 2);
    assert.equal(result.handled, true); assert.equal(result.overrideStatus, '異常抵抗');
    elf.resistances.statusResist.slots = [{ status: '神話', rate: 100 }];
    assert.equal(TraitsEngine.filterStatusInflict(ctx, 'p1', '神話', 2).handled, false);
  }
});
check('冰封結束轉凍傷，石化不衍化；舊代號分類與顯示不混用', () => {
  for (const alias of ['冰封', 'ice_sealed', '凍結', '冰凍']) {
    const name = canonicalStatusName(alias);
    const transform = StatusRegistry[name].mechanics?.find(m => m.type === 'EVOLUTION_TRANSFORM');
    assert.equal(transform?.params.nextStatus, '凍傷');
    assert.equal(transform?.params.nextDuration, 3);
    assert.deepEqual(transform?.params.statDebuff, { speed: -1 });
    assert.ok(isControlAilment(alias)); assert.equal(getAilmentCategory(alias), 'CONTROL');
  }
  for (const alias of ['石化', 'petrified', 'frozen']) {
    assert.equal(canonicalStatusName(alias), '石化');
    assert.ok(!StatusRegistry[canonicalStatusName(alias)].mechanics?.some(m => m.type === 'EVOLUTION_TRANSFORM'));
    const effects = getActiveEffects('p1', { p1: { battleStatus: alias, battleStatusDuration: 2 } });
    assert.equal(effects.find(e => e.category === '異常')?.name, '石化');
  }
  assert.ok(!sameStatus('frostbite', 'ice_sealed')); assert.ok(!sameStatus('frozen', 'ice_sealed'));
});
console.log(`效果明確化語意測試：${checks} 項通過`);
