// 被反彈過來的異常（2026-11-15）：不可再次反彈，但受方的「免疫異常」仍須生效。
// 情境：我方 A 對 X 用藥附加中毒 → X 反彈 → 中毒回到 A；A 身上各種免疫來源都要擋下，且不會再彈回 X。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0; const ok = (label: string) => { checks++; console.log('✓ ' + label); };
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { BATTLE_ITEMS, getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const potion = BATTLE_ITEMS.find((i: any) => i.id === 'inflict_poison'); assert.ok(potion);
  const wait = { name: '等', category: '屬性', type: '普通', power: 0, pp: 10, maxPp: 20, isSureHit: true, description: '' };
  const noResist = { damageResist: { crit: 0, fixed: 0, percent: 0 }, statusResist: { allImmune: false, selectedStatuses: [], slots: [] } };
  const mk = (id: string, speed: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: 5000, maxHp: 10000,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp: 10000, atk: 100, def: 100, spatk: 100, spdef: 100, speed },
    statStages: {}, skills: [{ ...wait }], resistances: noResist });
  const R = getSoulMarkRegistry();
  /** A 用藥附加中毒；X 帶反彈；A 帶 aReg 與 A 魂印 aMark。 */
  const run = async (aReg: any, aMark?: (ctx: any, ev: string, d: any) => void) => {
    if (aMark) R['A'] = aMark; else delete R['A'];
    const en = createBattleEngine({ initialP1Team: [mk('A', 200)], initialP2Team: [mk('X', 100)], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, randomSeed: 3 });
    en.mount(); en.start(); await en.idle();
    en.dispatch({ type: 'UPDATE_REGISTRY_STATE', side: 'p2', state: { reflectStatusTurns: 3 } });
    if (aReg) en.dispatch({ type: 'UPDATE_REGISTRY_STATE', side: 'p1', state: aReg });
    await en.idle();
    en.onUseItem('p1', potion); en.onSkillSelect('p2', en.getState().p2.skills[0]); await en.idle();
    const st = en.getState(); en.unmount(); delete R['A'];
    return { a: getStatuses(st.p1)['中毒'] || 0, x: getStatuses(st.p2)['中毒'] || 0, logs: st.logs.map((l: any) => String(l.text)).join('\n') };
  };

  let r = await run(null);
  assert.ok(r.a > 0 && r.x === 0, '基準：無免疫時被反彈的中毒落在使用方');
  ok('基準：反彈成立');

  r = await run({ immuneStatusTurns: 3 });
  assert.equal(r.a, 0, '回合型免疫異常擋下被反彈的異常'); assert.equal(r.x, 0);
  ok('回合型免疫異常');

  r = await run({ reflectStatusTurns: 3 });
  assert.equal(r.a, 0, '雙方都有反彈：被反彈的異常改為免疫'); assert.equal(r.x, 0, '不得再彈回對手');
  ok('雙方反彈：免疫、不再反彈');

  // 魂印型免疫（例：譜尼【聖】天生免疫）：過去整段魂印附加前防護被跳過 → 免疫失效
  let seen: any = null;
  r = await run(null, (_ctx, ev, d) => { if (ev === 'BEFORE_STATUS_APPLY' && d) { seen = { ...d }; d.prevented = true; d.prevent = true; } });
  assert.equal(r.a, 0, '魂印免疫擋下被反彈的異常'); assert.equal(r.x, 0);
  assert.equal(seen?.reflected, true, '附加前防護收到 reflected 標記');
  ok('魂印免疫');

  // 魂印型「免疫並反彈」（例：索比拉特幽冥噬魂）：收到被反彈的異常時只能免疫，不能再次反彈
  r = await run(null, (ctx, ev, d) => {
    if (ev === 'BEFORE_STATUS_APPLY' && d) { ctx.applyStatusWithImmunityCheck(ctx.targetSide, d.status, d.duration); d.prevented = true; d.prevent = true; }
  });
  assert.equal(r.a, 0, '魂印反彈型：免疫'); assert.equal(r.x, 0, '魂印反彈型：不得再彈回');
  ok('魂印免疫並反彈：只免疫');

  console.log(`被反彈異常的免疫 ${checks} 項通過`);
} finally { await server.close(); }
process.exit(0);
