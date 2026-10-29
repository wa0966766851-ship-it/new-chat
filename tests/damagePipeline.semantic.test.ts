// 傷害分層規則（使用者確認 2026-10-11）：增傷各自相乘、同組加法、減傷相乘／同組加總最高100%、
// 公式替換不吃暴擊與連擊、致命抗性只套一次、真傷不受上限與保底、固定加值進公式、六刃倍率。
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let count = 0;
const near = (a: number, b: number, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} ≠ ${b}`);
const check = async (name: string, run: () => void | Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const P = await server.ssrLoadModule('/src/battle/damagePipeline.ts');
  const R = await server.ssrLoadModule('/src/battle/damageReduction.ts');
  const { calculateDamage } = await server.ssrLoadModule('/src/utils/damageCalculator.ts');
  const { buildDamageAPIs } = await server.ssrLoadModule('/src/battle/contextBuilders.ts');
  const { handleWuxuSoulMark } = await server.ssrLoadModule('/src/effects/elves/wuxu/registry.ts');
  const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');
  const comp = () => P.createDamageComp({ base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack' });

  await check('多個「提升X%」各自相乘；舊寫法 += 自動視為獨立來源', () => {
    const c = comp(); c.increasePercent += 0.5; c.increasePercent += 0.7;
    assert.equal(P.floorDamage(c.base * (1 + c.increasePercent)), 255);
    const d = comp(); P.addDamageIncrease(d, 1); P.addDamageIncrease(d, 1);
    near(1 + d.increasePercent, 4, '兩個提升100%＝×4');
  });
  await check('描述寫「加法結算」的同組先加總（銀翼騎士 30%＋先出手 30%＝60%）', () => {
    const c = comp(); P.addDamageIncrease(c, 0.3, 'suit:silver_knight'); P.addDamageIncrease(c, 0.3, 'suit:silver_knight'); P.addDamageIncrease(c, 0.5);
    near(1 + c.increasePercent, 1.6 * 1.5);
  });
  await check('減傷各自相乘；同組加總最高 100%，不溢出也不歸零', () => {
    const c = comp(); R.addDamageReduction(c, 0.3); R.addDamageReduction(c, 0.5);
    near(c.decreasePercent, 1 - 0.7 * 0.5);
    const g = comp(); P.addGroupedReduction(g, 0.6, 'x'); P.addGroupedReduction(g, 0.6, 'x');
    near(g.decreasePercent, 1, '加總 120% 夾在 100%');
    const m = comp(); P.addGroupedReduction(m, 0.2, 'x'); P.addGroupedReduction(m, 0.2, 'x'); R.addDamageReduction(m, 0.5);
    near(m.decreasePercent, 1 - 0.6 * 0.5);
  });
  const elf = (name: string, extra: any = {}): any => ({ id: name, battleId: name, name, type: '普通', level: 100, currentHp: 1000, maxHp: 1000,
    calculatedStats: { hp: 1000, atk: 400, def: 300, spatk: 400, spdef: 300, speed: 100 }, statStages: {}, skills: [], ...extra });
  await check('公式替換（蝕言）：結果即總傷，不吃暴擊、不乘連擊', () => {
    const shiyan = elf('無序·蝕言', { calculatedStats: { hp: 1000, atk: 1, def: 1, spatk: 1, spdef: 50, speed: 1 } });
    const skill = { name: '特攻', category: '特殊', type: '普通', power: 100, pp: 10 } as any;
    const one = calculateDamage(elf('A'), elf('B'), skill, 'p1', undefined, undefined, 1, true, [], [elf('B'), shiyan], { hitCount: 1 });
    const three = calculateDamage(elf('A'), elf('B'), skill, 'p1', undefined, undefined, 1, true, [], [elf('B'), shiyan], { hitCount: 3 });
    assert.equal(one.damage, 200); assert.equal(three.damage, 200); assert.equal(three.isCrit, false); assert.equal(three.formulaReplaced, true);
  });
  await check('致命抗性只在公式套用一次：35% 抗性暴擊為 ×1.3', () => {
    const skill = { name: '打', category: '物理', type: '水', power: 100, pp: 10 } as any;
    const base = calculateDamage(elf('A'), elf('B'), skill, 'p1', undefined, undefined, 1, false).damage;
    const crit = calculateDamage(elf('A'), elf('B', { resistances: { damageResist: { crit: 35 } } }), skill, 'p1', undefined, undefined, 1, true).damage;
    assert.equal(crit, Math.floor(base * 1.3));
  });
  await check('真實傷害不受傷害上限與保底影響', () => {
    const s: any = { p1: elf('a'), p2: elf('b'), p1Marks: [], p2Marks: [], p1Timers: [], p2Timers: [], p1RegistryState: {}, p2RegistryState: {} };
    const events: any[] = [];
    const context = (side: 'p1' | 'p2'): any => {
      const other = side === 'p1' ? 'p2' : 'p1';
      return { actor: side, targetSide: other, self: s[side], target: s[other], activeP1: s.p1, activeP2: s.p2,
        p1Timers: s.p1Timers, p2Timers: s.p2Timers, getFullTeam: (which: string) => [s[which]],
        getMarks: () => [], getStatuses: () => ({}), getPlayerState: () => 0, getOpponentState: () => 0, addLog() {} };
    };
    const api = buildDamageAPIs({ side: 'p1', self: s.p1, opp: s.p2, syncStateRef: { current: s }, pushEffect: (e: any) => events.push(e), getBattleEventContext: context } as any);
    s.p2Timers = [{ id: 'cap', remaining: 3, kind: 'turn_effect', payload: { applyMode: 'gate', wraps: 'damage_limit', params: { limit: 10 } } }];
    const errors: unknown[][] = [], originalError = console.error;
    console.error = (...args) => { errors.push(args); originalError(...args); };
    try { assert.equal(api.applyTrueDamage('p2', 500), 500); }
    finally { console.error = originalError; }
    assert.deepEqual(errors, [], '雙方正式積木傷害掛鉤不得報錯後仍當通過');
  });
  await check('六刃：滿血造成非真實傷害 ×2.2（過去 ×1.2）；損失 0.1% 體力後 ×3.4', () => {
    const run = (hp: number) => {
      const c = P.createDamageComp({ base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack', isIncoming: false });
      const self = elf('無序·六刃', { currentHp: hp, maxHp: 1000 });
      const ctx: any = { self, actor: 'p1', targetSide: 'p2', target: elf('B'), getPlayerState: () => 0, setPlayerState() {}, addLog() {}, applyTrueDamage() {} };
      handleWuxuSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, { damageComp: c });
      return c.multiplier;
    };
    assert.ok(Math.abs(run(1000) - 2.2) < 1e-9);
    assert.ok(Math.abs(run(999) - 3.4) < 1e-9);
  });
  console.log(`${count} checks`);
} finally { await server.close(); }
process.exit(0);
