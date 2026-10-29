// 2026-10-11 批次：戰士弱點傷害、星魂使徒對異能×2、玲瓏加到總增幅、恢復不會扣血、六刃臨時上限不加目前體力、
// 迪露回合開始非真實+50%、咤克斯魔王咒怨造成+5%／層、深淵凝視下2次+150%（通用次數鍵）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let count = 0;
const near = (a: number, b: number, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} ≠ ${b}`);
const check = async (name: string, run: () => void | Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let failed = false;
try {
  const P = await server.ssrLoadModule('/src/battle/damagePipeline.ts');
  const { resolveRecoveryTransition } = await server.ssrLoadModule('/src/battle/survivalRules.ts');
  const { calculateDamage } = await server.ssrLoadModule('/src/utils/damageCalculator.ts');
  const A = await server.ssrLoadModule('/src/battle/advancedDamageModifiers.ts');
  const { handleWuxuSoulMark } = await server.ssrLoadModule('/src/effects/elves/wuxu/registry.ts');
  const { handleDeluSoulMark } = await server.ssrLoadModule('/src/effects/elves/delu/registry.ts');
  const { handleAnnihilationLordSoulMark } = await server.ssrLoadModule('/src/effects/elves/zhakesi-annihilation/registry.ts');
  const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');

  const elf = (name: string, extra: any = {}): any => ({ id: name, battleId: name, name, type: '普通', level: 100, currentHp: 1000, maxHp: 1000,
    calculatedStats: { hp: 1000, atk: 400, def: 300, spatk: 400, spdef: 300, speed: 100 }, statStages: {}, skills: [], ...extra });
  const comp = (extra: any = {}) => P.createDamageComp({ base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack', isIncoming: false, ...extra });
  const mockCtx = (self: any, target: any, state: Record<string, any> = {}, extra: any = {}) => {
    const logs: string[] = [];
    const ctx: any = { self, target, actor: 'p1', targetSide: 'p2', state, logs,
      getPlayerState: (k: string) => state[k], setPlayerState: (k: string, v: any) => { state[k] = v; },
      getOpponentState: () => 0, setOpponentState() {}, addLog: (t: string) => logs.push(t), getMarks: () => [], ...extra };
    return ctx;
  };

  await check('玲瓏「可與其他來源加算」：加到其他增傷相乘後的總增幅（其他 ×2、玲瓏 +50% → ×2.5；無其他增傷時 ×1.5）', () => {
    const c = comp(); P.addDamageIncrease(c, 1); P.addDamageIncrease(c, 0.5, 'total');
    near(1 + c.increasePercent, 2.5);
    const d = comp(); P.addDamageIncrease(d, 0.5, 'total');
    near(1 + d.increasePercent, 1.5);
  });

  await check('恢復不會讓體力下降（體力已高於上限時維持原值）', () => {
    assert.equal(resolveRecoveryTransition(1500, 1000, 100).hp, 1500);
    assert.equal(resolveRecoveryTransition(900, 1000, 300).hp, 1000);
  });

  await check('六刃：臨時體力上限只提高上限，不增加目前體力；上一隻出戰精靈經恢復流程', () => {
    const self = elf('無序·六刃', { currentHp: 1000, maxHp: 1000 });
    const prev = elf('前一隻', { currentHp: 500, maxHp: 1000 });
    const updates: any[] = []; const heals: any[] = [];
    const ctx = mockCtx(self, elf('B'), { previousActiveElfId: '前一隻' }, {
      applyTrueDamage() {}, getFullTeam: () => [self, prev], updateElf: (_s: string, patch: any) => updates.push(patch),
      applyHealToElf: (_s: string, id: string, amt: number) => heals.push([id, amt]),
    });
    handleWuxuSoulMark(ctx, EffectTiming.ON_ENTRANCE, {});
    const boost = updates.find(u => u.tempMaxHpBoost);
    assert.ok(boost && boost.maxHp > 1000, '有臨時上限');
    assert.equal(boost.currentHp, undefined, '不應增加目前體力');
    assert.deepEqual(heals, [['前一隻', Math.floor(1000 / 6) * 2]]);
    assert.ok(!updates.some(u => u.id === '前一隻'), '不再直接改寫上一隻的體力');
  });

  await check('戰士：始終弱點傷害（較低雙防的60%）並取最優克制', () => {
    const skill = { name: '打', category: '物理', type: '普通', power: 100, pp: 10 } as any;
    const warrior = elf('戰', { alienTraits: { exclusiveTrait: { name: '戰士' } } });
    const plain = calculateDamage(elf('A'), elf('B'), skill, 'p1', undefined, undefined, 1, false).damage;
    const weak = calculateDamage(warrior, elf('B'), skill, 'p1', undefined, undefined, 1, false).damage;
    assert.ok(weak > plain, `弱點傷害應較高 ${weak} > ${plain}`);
  });

  await check('無序星魂使徒：對異能精靈造成傷害翻倍（獨立乘區），對一般精靈不變', () => {
    const actor = elf('使徒', { alienTraits: { exclusiveTrait: { name: '無序星魂使徒' } } });
    const c1 = comp(); A.applyAlienDoubleDamage(c1, actor, elf('異', { isAlienElf: true })); assert.equal(c1.multiplier, 2);
    const c2 = comp(); A.applyAlienDoubleDamage(c2, actor, elf('普')); assert.equal(c2.multiplier, 1);
  });

  await check('迪露：回合開始體力不低於對手 → 當回合造成非真實傷害提升50%（真實傷害不吃）', () => {
    const state: any = {};
    const self = elf('誑獅魔軀.魔獅迪露', { currentHp: 2000, maxHp: 3000000 });
    const ctx = mockCtx(self, elf('B'), state, { applyTrueDamage() {} });
    handleDeluSoulMark(ctx, EffectTiming.ROUND_START);
    assert.equal(state.DeluNonTrueDmgBoostTurns, 1);
    const c = comp({ damageCategory: 'fixed' }); handleDeluSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, c); near(c.increasePercent, 0.5);
    const t = comp({ damageCategory: 'true' }); handleDeluSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, t); near(t.increasePercent, 0);
  });

  await check('湮滅之主：魔王咒怨每層造成的攻擊傷害提升5%（只限攻擊技能）', () => {
    const self = elf('湮滅之主咤克斯');
    const marks = [{ id: 'demon_grudge', count: 3 }];
    const ctx = mockCtx(self, elf('B'), { curseCalculated: true }, { getMarks: (s: string) => s === 'p1' ? marks : [] });
    const c = comp(); handleAnnihilationLordSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, c); near(c.increasePercent, 0.15);
    const f = comp({ damageCategory: 'fixed' }); handleAnnihilationLordSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, f); near(f.increasePercent, 0);
  });

  console.log(`${count} checks`);
} catch (e) { failed = true; console.error(e); } finally { await server.close(); }
process.exit(failed ? 1 : 0);
