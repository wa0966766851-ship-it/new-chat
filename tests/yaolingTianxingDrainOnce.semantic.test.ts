// 妖靈天性：使用後只吸取 1 次（P1/P2 × 先手/後手），並鎖定與摩哥斯魂印「埒殘銜闕」搭配時的量。
// 單獨：對手損失恰為最大體力1/3（自身體力低於½時為2/3），回合末／其他入口不再額外吸取。
// 搭配魂印：技能吸取仍只有1次（結算值 = 1/3 × 埒殘銜闕150%）；其後每道埒殘銜闕各自吸取「該結算值的50%」，
// 此吸取是印記自身的規則，數值不再被埒殘銜闕的+50%二次放大。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const FOE_HP = 10_000_000_000, THIRD = Math.floor(FOE_HP / 3);
const guard = (id: string, hp: number, speed: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });
const realSkill = () => structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5034').skills.find((s: any) => s.name === '妖靈天性'));
const realMogos = (speed: number) => { const m = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5034'));
  m.skills = [realSkill()]; m.calculatedStats = { ...m.calculatedStats, speed }; m.baseStats = { ...m.baseStats, speed }; return m; };
async function run(side: 'p1' | 'p2', first: boolean, soul: boolean, myHp?: number) {
  const other = side === 'p1' ? 'p2' : 'p1';
  // 無魂印：非摩哥斯載體，只攜帶該技能（魂印不介入）；有魂印：完整摩哥斯。
  let me: any;
  if (soul) me = realMogos(first ? 9000 : 5);
  else { me = guard('YL', 3_000_000, first ? 9000 : 5); me.skills = [realSkill()]; }
  if (myHp !== undefined) me.currentHp = myHp;
  const foe = guard('X', FOE_HP, first ? 10 : 900);
  const e: any = createBattleEngine({ [`initial${side.toUpperCase()}Team`]: [me], [`initial${other.toUpperCase()}Team`]: [foe],
    [`${side}StarterId`]: me.id, [`${other}StarterId`]: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start(); await e.idle();
  const s0 = e.getState();
  e.onSkillSelect('p1', s0.p1.skills[side === 'p1' ? 0 : 1]); e.onSkillSelect('p2', s0.p2.skills[side === 'p2' ? 0 : 1]);
  await e.idle();
  const st = e.getState(); const out = { loss: FOE_HP - st[other].currentHp, foeMarks: (st[`${other}Marks`] || []).reduce((n: number, m: any) => n + (m.id === 'mogos_residual' ? m.count : 0), 0),
    logs: (st.logs || []).map((l: any) => String(l.text || '')) };
  e.unmount(); return out;
}
let count = 0;
const check = async (nm: string, f: () => Promise<void>) => { await f(); count++; console.log('✓ ' + nm); };
for (const side of ['p1', 'p2'] as const) for (const first of [true, false]) {
  const tag = `${side}${first ? '先手' : '後手'}`;
  await check(`${tag} 單獨使用：只吸取1次，量為最大體力1/3`, async () => {
    const r = await run(side, first, false);
    assert.equal(r.loss, THIRD, '對手損失恰為1/3，回合末與其他入口不得再吸');
    assert.equal(r.logs.filter(t => /使用了【妖靈天性】/.test(t)).length, 1);
  });
  await check(`${tag} 搭配摩哥斯魂印：技能吸取1次（150%），其後每道埒殘銜闕各吸該結算值50%且不被再放大`, async () => {
    const r = await run(side, first, true);
    const settled = Math.floor(THIRD * 1.5), expected = Math.min(FOE_HP, settled + r.foeMarks * Math.floor(settled / 2));
    assert.ok(r.foeMarks >= 1 && r.foeMarks <= 3, '對手印記道數 ' + r.foeMarks);
    if (first) assert.equal(r.foeMarks, 1);
    // 350固定吸取（含150%）由魂印在戰鬥階段結束時另計，小於1e5，量級可容忍
    const soulFixed = r.loss - expected;
    assert.ok(soulFixed >= 0 && soulFixed <= 1000, `技能吸取＋印記吸取 = ${expected}，實際差 ${soulFixed}`);
    if (first) assert.equal(expected, 7_499_999_998, '先手總損失 75%（1/3×150% 再加一道印記吸取其50%）');
  });
}
await check('自身體力低於1/2：單獨使用吸取翻倍為2/3，仍只吸1次', async () => {
  const r = await run('p1', true, false, 1_000_000);
  assert.equal(r.loss, Math.floor(FOE_HP * 2 / 3));
});
await server.close();
console.log(count + ' checks');
