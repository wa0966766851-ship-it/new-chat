// 藥劑反噬實戰（引擎）：回復藥劑改為藥劑反噬傷害；無視護盾／護罩／抗性／傷害上限；百分比藥劑；禁止用藥計時器擋下使用。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { BATTLE_ITEMS } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const potion = (id: string) => BATTLE_ITEMS.find((i: any) => i.id === id);
  const wait = { name: '等', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' };
  const mk = (id: string, speed: number, extra: any = {}): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: 5000, maxHp: 10000,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp: 10000, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, statStages: {}, skills: [wait], ...extra });
  const run = async (p1Extra: any, act: (en: any) => void) => {
    const engine = createBattleEngine({ initialP1Team: [mk('A', 200, p1Extra)], initialP2Team: [mk('X', 100)], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVE', preparedTeams: true, isFast: () => true, randomSeed: 3 });
    engine.mount(); engine.start(); await engine.idle(); act(engine); await engine.idle(); const st = engine.getState(); engine.unmount(); return st;
  };
  const useAndWait = (id: string) => (en: any) => { en.onUseItem('p1', potion(id)); en.onSkillSelect('p2', en.getState().p2.skills[0]); };

  // 基準：一般回復
  let st = await run({}, useAndWait('hp_300'));
  assert.equal(st.p1.currentHp, 5300, '一般藥劑回復 300');
  // 藥劑反噬：改為受到 300 點藥劑反噬傷害；護盾、護罩、抗性一律無視
  st = await run({ potionBacklashTurns: 3, shield: 999, barrier: 999, resistances: { damageResist: { crit: 35, fixed: 35, percent: 35 }, statusResist: { slots: [], allImmune: false } } }, useAndWait('hp_300'));
  assert.equal(st.p1.currentHp, 4700, '藥劑反噬傷害 300（無視護盾／護罩／抗性）');
  assert.equal(st.p1.shield, 999); assert.equal(st.p1.barrier, 999);
  assert.ok(st.logs.some((l: any) => /藥劑反噬傷害/.test(l.text)), '日誌記錄藥劑反噬傷害');
  // 百分比藥劑
  st = await run({}, useAndWait('hp_pct_20'));
  assert.equal(st.p1.currentHp, 7000, '20% 最大體力');
  st = await run({ potionBacklashTurns: 2 }, useAndWait('hp_pct_10'));
  assert.equal(st.p1.currentHp, 4000, '反噬中 10% 改為扣除');
  // 禁止用藥：繳械時使用被擋下（不消耗、不結算）
  st = await run({ battleStatuses: { '繳械': 3 } }, en => { en.onUseItem('p1', potion('hp_300')); });
  assert.equal(st.p1.currentHp, 5000);
  assert.ok(st.logs.some((l: any) => /繳械：無法使用藥劑/.test(l.text)), '擋下時列出原因');
  console.log('藥劑反噬實戰：反轉、無視減免、百分比藥劑、禁止用藥 通過');
} finally { await server.close(); }
process.exit(0);
