// 幻化「指定背包內精靈」：以當前這場戰鬥的實際雙方背包（battleId／開局位數）解析，不靠陣列索引或預設陣容。
// 涵蓋 6V6、1V1、3V3、換人後、星蝕回廊背包、目標消逝／被禁用、P1/P2 兩側。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-illusion-bag' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const kit: any = await server.ssrLoadModule('/src/data/migratedAstralAesfigSoulKit.ts');
const { bindBag, correspondingBagElf, pickByBagSlot, benchOfTeam } = await server.ssrLoadModule('/src/battle/bagTargets.ts');
const E = await server.ssrLoadModule('/src/modes/interstellar/v2/engine.ts');
const { DEFAULT_ELVES: POOL } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');

let count = 0;
const check = async (nm: string, run: () => void | Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };
const guard = (id: string, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: 1e9, maxHp: 1e9,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp: 1e9, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });
const aesfig = (): any => {
  const e = structuredClone((DEFAULT_ELVES as any[]).find((x: any) => String(x.id) === '5033'));
  e.soulMark.effectMode = 'kit'; e.soulMark.kit = structuredClone(kit.MIGRATED_ASTRAL_AESFIG_SOUL_KIT.kit); return e;
};
/** 出戰名單（5033 位於 slot）＋待命名單，建立與首頁相同的背包。 */
const bag = (slot: number, activeCount: number, standby: string[]) => {
  const active = Array.from({ length: activeCount }, (_, i) => i === slot ? aesfig() : guard(`A${i}`));
  return bindBag([...active, ...standby.map(id => guard(id))], activeCount).slice(0, activeCount);
};
async function enter(side: 'p1' | 'p2', team: any[], starter: string, then?: (e: any) => Promise<void>) {
  const foe = [guard('FOE', 40)];
  const e: any = createBattleEngine({ initialP1Team: side === 'p1' ? team : foe, initialP2Team: side === 'p2' ? team : foe,
    p1StarterId: side === 'p1' ? starter : 'FOE', p2StarterId: side === 'p2' ? starter : 'FOE', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start(); await e.idle();
  if (then) await then(e);
  const own = e.getState()[side]; const result = { target: own.illusion?.target?.name, ppOffset: own.globalPpMaxOffset };
  e.unmount(); return result;
}
const names = (xs: any[]) => xs.map(x => x.name);

// ── 純函式：位數、壓緊、順延 ──
await check('bindBag：出戰第 i 位對應待命第 i 位；待命快照共享於所有出戰精靈', () => {
  const r = bag(2, 6, ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
  assert.equal(r[2].initialCounterpart.name, 'S2'); assert.equal(r[0].initialCounterpart.name, 'S0');
  assert.deepEqual(names(benchOfTeam(r.slice(3))), ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
  assert.ok(r.every((e: any, i: number) => e.initialBagSlot === i && e.initialBagGroup === 'active'));
});
await check('待命不足（禁用後壓緊）時以循環位數對應，不落空', () => {
  const r = bag(4, 6, ['S0', 'S1', 'S2']);                 // slot 4 % 3 = 1
  assert.equal(correspondingBagElf(r, r[4])?.name, 'S1');
  assert.equal(pickByBagSlot(['a', 'b', 'c'], 5), 'c');
  assert.equal(pickByBagSlot([], 0), undefined);
});
await check('對應規則：偏好位置不合法時保持相對順序往後順延，到尾端接回開頭', () => {
  const standby = ['x0', 'x1', 'x2', 'x3'];
  assert.equal(pickByBagSlot(standby, 1, e => e !== 'x1'), 'x2');
  assert.equal(pickByBagSlot(standby, 3, e => e !== 'x3'), 'x0');
  assert.equal(pickByBagSlot(standby, 2, e => e === 'x1'), 'x1');
  assert.equal(pickByBagSlot(standby, 0, () => false), undefined);
});
await check('出戰隊伍換人重排後仍用開局位數，不用當前陣列索引', () => {
  const r = bag(1, 3, ['S0', 'S1', 'S2']); const self = r[1];
  const reordered = [r[2], r[0], self];                    // 換人後陣列索引改變
  assert.equal(correspondingBagElf(reordered, self)?.name, 'S1');
});
await check('待命來源者幻化為出戰區對應位；該位消逝則順延，全部消逝則無目標', () => {
  const roster = bindBag([guard('F0'), guard('F1'), guard('F2'), guard('B0'), guard('B1')], 3);
  const standbyElf = { ...roster[4], initialBench: undefined };    // B1：待命 slot 1
  const live = roster.slice(0, 3).map((e: any) => ({ ...e }));
  const team = [...live, standbyElf];
  assert.equal(correspondingBagElf(team, standbyElf)?.name, 'F1');
  live[1].isVanished = true; assert.equal(correspondingBagElf(team, standbyElf)?.name, 'F2', '消逝者跳過，往後順延');
  live[2].isVanished = true; assert.equal(correspondingBagElf(team, standbyElf)?.name, 'F0', '尾端接回開頭');
  live[0].isVanished = true; assert.equal(correspondingBagElf(team, standbyElf), undefined);
});
await check('召喚物與額外精靈不算背包位數', () => {
  const r = bag(0, 2, ['S0', 'S1']); const extra = { ...guard('EXTRA'), isExtra: true, summonerId: 'x' };
  const roster = bindBag([guard('F0'), guard('F1'), guard('B0')], 2);
  const standbyElf = { ...roster[2] };
  assert.equal(correspondingBagElf([extra, ...roster.slice(0, 2), standbyElf], standbyElf)?.name, 'F0');
  assert.equal(correspondingBagElf(r, r[0])?.name, 'S0');
});

// ── 引擎：登場時 思維固化 實際指向當前背包（兩側） ──
for (const side of ['p1', 'p2'] as const) {
  await check(`${side} 一般 6V6：登場幻化為待命區相同位數`, async () => {
    const team = bag(2, 6, ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
    const r = await enter(side, team, '5033');
    assert.equal(r.target, 'S2'); assert.equal(r.ppOffset, 10);
  });
  await check(`${side} 單挑 1V1：只剩首發仍保留待命背包`, async () => {
    const full = bag(3, 6, ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
    const solo = full.filter((e: any) => e.name === full[3].name);        // 首頁單挑會在綁定後只留首發
    assert.equal((await enter(side, solo, '5033')).target, 'S3');
  });
  await check(`${side} 3V3（位數從 0 起，待命被禁用後壓緊）`, async () => {
    const team = bag(1, 3, ['S0', 'S1']);                                  // 原 3 隻待命被禁 1 隻
    assert.equal((await enter(side, team, '5033')).target, 'S1');
    assert.equal((await enter(side, bag(2, 3, ['S0', 'S1']), '5033')).target, 'S0', '位數 2 超過待命人數：循環到第 0 位');
  });
  await check(`${side} 換人後登場：首發不是 5033，換上後才幻化，目標仍依開局位數`, async () => {
    const team = bag(2, 6, ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
    const r = await enter(side, team, 'A0', async e => {
      const idx = e.getState()[`${side}Team`].findIndex((x: any) => x.name === team[2].name);
      const foe = side === 'p1' ? 'p2' : 'p1', pick = () => e.onSkillSelect(foe, e.getState()[foe].skills[1]);
      if (side === 'p1') { e.onSwitchElf(side, idx); pick(); } else { pick(); e.onSwitchElf(side, idx); }
      await e.idle();
    });
    assert.equal(r.target, 'S2');
  });
  await check(`${side} 沒有任何待命精靈：不假造目標、不拿預設陣容湊數`, async () => {
    assert.equal((await enter(side, bag(0, 3, []), '5033')).target, undefined);
  });
}

// ── 星蝕回廊：以回廊背包（出戰名單＋待命）為準 ──
await check('星蝕回廊：startBattle 以出戰名單位數＋待命綁定背包（含倒下者的位置）', () => {
  let r = E.createRun({ pool: POOL, equipType: 'suit', equipId: '', modifiers: [], startingShards: 0, seed: 7 });
  if (r.scene.kind === 'draft') for (const id of r.scene.offer.slice(0, 3)) r = E.toggleDraft(r, id);
  r = E.confirmDraft(r, POOL);
  const extra = POOL.slice(10, 16).map((e: any, i: number) => ({ ...e, battleId: `ex-${i}`, currentHp: e.maxHp }));
  r = { ...r, scene: { kind: 'map' }, team: [...r.team, ...extra], bench: extra.slice(0, 3).map((e: any) => e.battleId) };
  const first = E.movesFrom(r).find((n: any) => n.kind === 'combat');       // 第 1 章：出戰 3 隻、待命 3 隻、其餘在倉庫
  r = E.moveTo(r, first.id, POOL);
  const dead = E.lineupOf(r)[0]; r = { ...r, team: r.team.map((e: any) => e === dead ? { ...e, currentHp: 0 } : e) };
  const b = E.startBattle(r, POOL, 'bag')!;
  const lu = E.lineupOf(r), bn = E.benchOf(r);
  assert.ok(bn.length >= 1, '需有待命');
  const alive = lu.filter((e: any) => e.currentHp > 0);
  assert.equal(b.p1.length, alive.length);
  b.p1.forEach((e: any, k: number) => {
    const slot = lu.indexOf(alive[k]);
    assert.equal(e.initialBagSlot, slot, '位數取自完整出戰名單，倒下者仍占位');
    assert.deepEqual(benchOfTeam(b.p1).map((x: any) => x.battleId), bn.map((x: any) => x.battleId));
    assert.equal(correspondingBagElf(b.p1, e)?.battleId, bn[slot % bn.length].battleId);
  });
});

await server.close();
console.log(count + ' checks');
