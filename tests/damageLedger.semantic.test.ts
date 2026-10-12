// 傷害帳本語意：確定性對戰（固定 __BATTLE_SEED__），帳本必須與雙方體力實際變化逐點對帳。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
(globalThis as any).__BATTLE_SEED__ = 20261012;
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { getBattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');
const L = await server.ssrLoadModule('/src/battle/damageLedger.ts');
const R = getBattleSkillRegistry(), S = getSoulMarkRegistry();
const quiet = console.error; console.error = () => {};
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };

const skill = (name: string, power = 0) => ({ name, category: power ? '物理' : '屬性', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '' });
const elf = (id: string, hp: number, skills: any[], speed = 100, extra: any = {}): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills, ...extra });

R['附加固傷技'] = (c: any) => { c.applyFixedDamage(c.targetSide, 77, '追加灼燒'); };
R['自療技'] = (c: any) => { c.applyHeal(c.actor, 120); };
S['甲'] = ((c: any, ev: any) => { if (ev === EffectTiming.ROUND_END && c.actor === 'p2') c.applyTrueDamage('p2', 41, '【中毒】'); }) as any;
S['魂印者'] = ((c: any, ev: any) => { if (ev === EffectTiming.ROUND_END && c.actor === 'p1') c.applyFixedDamage(c.targetSide, 33, '星火'); }) as any;

async function playOut() {
  const p1 = [elf('魂印者', 1400, [skill('打', 70), skill('附加固傷技', 40), skill('打', 50), skill('自療技')], 200), elf('乙', 1400, [skill('打', 70)], 150)];
  const p2 = [elf('甲', 1500, [skill('打', 80)], 100, { shield: 500 }), elf('丙', 1500, [skill('打', 80)], 90)];
  const sum = (team: any[]) => team.reduce((a, e) => a + e.currentHp, 0);
  const start = { p1: sum(p1), p2: sum(p2) };
  const engine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: '魂印者', p2StarterId: '甲', battleMode: 'PVP', preparedTeams: true, isFast: () => true });
  engine.mount(); engine.start();
  for (let t = 0; t < 300 && !engine.getState().winner; t++) {
    await engine.idle();
    const st = engine.getState();
    if (st.phase === 'forced_switch_p1') { engine.onSwitchElf('p1', st.p1Team.findIndex((e: any) => e.currentHp > 0)); continue; }
    if (st.phase === 'forced_switch_p2') { engine.onSwitchElf('p2', st.p2Team.findIndex((e: any) => e.currentHp > 0)); continue; }
    if (st.phase !== 'p1_select') continue;
    const mk = t % 4; // 輪流用不同技能
    engine.onSkillSelect('p1', st.p1.skills[st.p1.name === '魂印者' ? mk : 0]);
    engine.onSkillSelect('p2', st.p2.skills[0]);
    if (t === 5 && st.p2Team.some((e: any, i: number) => i !== st.p2ActiveIndex && e.currentHp > 0)) { /* 換人在下方專測 */ }
  }
  await engine.idle();
  const st = engine.getState();
  return { engine, st, start, end: { p1: sum(st.p1Team), p2: sum(st.p2Team) } };
}

const reconcile = (ledger: any, start: any, end: any, side: 'p1' | 'p2') => {
  const lost = ledger.entries.filter((e: any) => e.targetSide === side).reduce((a: number, e: any) => a + e.hpLost, 0);
  const healed = ledger.heals.filter((h: any) => h.side === side).reduce((a: number, h: any) => a + h.amount, 0);
  const net = start[side] - lost + healed + ledger.adjust[side].up - ledger.adjust[side].down;
  return { lost, healed, net, actual: end[side] };
};

await check('帳本 hpLost 總和＝雙方體力實際減少（含恢復、體力調整、換人）', async () => {
  const { engine, st, start, end } = await playOut();
  assert.ok(st.winner, '對戰打完');
  const led = engine.ledger;
  assert.ok(led.entries.length > 5, '有帳');
  for (const side of ['p1', 'p2'] as const) {
    const r = reconcile(led, start, end, side);
    assert.equal(r.net, r.actual, `${side} 對帳：開局${start[side]} 扣${r.lost} 補${r.healed} → ${r.net} 實際${r.actual}`);
  }
  assert.ok(st.p1Team.some((e: any) => e.currentHp <= 0) || st.p2Team.some((e: any) => e.currentHp <= 0), '有精靈倒下並換人');
});

await check('來源種類分類：技能／魂印／異常；來源方與名稱正確', async () => {
  const { engine } = await playOut();
  const kinds = new Set(engine.ledger.entries.map((e: any) => e.sourceKind));
  for (const k of ['skill', 'soulmark', 'status']) assert.ok(kinds.has(k), `有 ${k}：${[...kinds]}`);
  const e = engine.ledger.entries;
  const soul = e.find((x: any) => x.sourceKind === 'soulmark');
  assert.equal(soul.sourceSide, 'p1'); assert.equal(soul.sourceName, '魂印者'); assert.equal(soul.targetSide, 'p2');
  const status = e.find((x: any) => x.sourceKind === 'status');
  assert.equal(status.sourceLabel, '中毒'); assert.equal(status.sourceSide, 'p1', '異常傷害記在對手（施加方）'); assert.equal(status.targetSide, 'p2'); assert.equal(status.damageType, 'true');
  // 技能效果窗口內推入的附加傷害歸屬該技能
  const extra = e.find((x: any) => x.sourceLabel === '附加固傷技' && x.damageType === 'fixed');
  assert.ok(extra, '技能附加固傷歸屬技能：' + JSON.stringify([...new Set(e.map((x: any) => x.sourceLabel))]));
  assert.equal(extra.sourceKind, 'skill');
  assert.ok(e.some((x: any) => x.sourceKind === 'skill' && x.sourceLabel === '打' && x.sourceSide === 'p2'), '對手的主技能傷害');
});

await check('護盾吸收有記，且不計入輸出', async () => {
  const { engine } = await playOut();
  const sum = L.summarizeLedger(engine.ledger, engine.getState().turnNumber);
  assert.ok(sum.absorbed.p2.shield > 0, `甲的護盾吸收 ${sum.absorbed.p2.shield}`);
  const dealtP1 = engine.ledger.entries.filter((e: any) => e.sourceSide === 'p1' && !e.selfInflicted).reduce((a: number, e: any) => a + e.hpLost, 0);
  assert.equal(sum.totalDealt.p1, dealtP1);
  assert.equal(sum.totalDealt.p1, Object.values(sum.byKind.p1).reduce((a: number, b: any) => a + b, 0), '種類分項加總＝總輸出');
  assert.equal(sum.byElf.filter((x: any) => x.side === 'p1').reduce((a: number, x: any) => a + x.dealt, 0), sum.totalDealt.p1, '精靈分項加總＝總輸出');
  assert.equal(sum.perTurn.reduce((a: number, t: any) => a + t.p1, 0), sum.totalDealt.p1, '回合分項加總＝總輸出');
  assert.equal(sum.byLabel.filter((x: any) => x.side === 'p1').reduce((a: number, x: any) => a + x.total, 0), sum.totalDealt.p1, '來源分項加總＝總輸出');
  assert.ok(sum.heal.p1 > 0, '自療有記');
});

await check('重現性：同種子兩場帳本完全相同；MVP 取輸出最高者', async () => {
  const a = await playOut(), b = await playOut();
  assert.deepEqual(a.engine.ledger, b.engine.ledger);
  const sum = L.summarizeLedger(a.engine.ledger);
  const mvp = L.pickMvp(sum, 'p1');
  assert.equal(mvp.dealt, Math.max(...sum.byElf.filter((x: any) => x.side === 'p1').map((x: any) => x.dealt)));
});

console.error = quiet;
console.log(`damageLedger: ${count} checks passed`);
await server.close();
