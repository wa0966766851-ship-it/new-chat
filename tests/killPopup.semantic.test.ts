// 擊殺跳字語意：確定性對戰（固定 __BATTLE_SEED__），驗證致命一擊與「出招前已被擊敗」的跳字類型、數值、時序，
// 以及傷害帳本在同一擊記到的 hpLost 與類型。通用層測試，不含任何精靈專屬判斷。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
(globalThis as any).__BATTLE_SEED__ = 20261012;
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { getBattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');
const { liurenSurvivalRule } = await server.ssrLoadModule('/src/battle/survivalRules.ts');
const R = getBattleSkillRegistry(), S = getSoulMarkRegistry();
const quiet = console.error; console.error = process.env.DBG ? quiet : () => {};
let count = 0, failed = 0;
const check = async (name: string, run: () => Promise<void>) => {
  try { await run(); count++; console.log(`✓ ${name}`); }
  catch (e: any) { failed++; console.log(`✗ ${name}\n    ${String(e.message).split('\n')[0]}`); }
};

const skill = (name: string, power = 0) => ({ name, category: power ? '物理' : '屬性', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '' });
const elf = (id: string, hp: number, skills: any[], speed = 100, extra: any = {}): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: extra.maxHp ?? hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills, ...extra });

R['前置固傷'] = (c: any) => { c.applyFixedDamage(c.targetSide, 999, '前置固傷'); };
R['前置真傷'] = (c: any) => { c.applyTrueDamage(c.targetSide, 999, '前置真傷'); };
R['前置調整'] = (c: any) => { c.adjustHp(c.targetSide, -999); };
S['零調整魂'] = ((c: any, ev: any) => { if (ev === EffectTiming.AFTER_DAMAGE && c.actor === 'p2') c.adjustHp('p2', 0); }) as any;
S['追擊魂'] = ((c: any, ev: any) => { if (ev === EffectTiming.AFTER_ATTACK_HIT && c.actor === 'p1') { c.applyFixedDamage(c.targetSide, 50, '魂印追擊'); c.applyTrueDamage(c.targetSide, 30, '魂印真傷'); } }) as any;
S['前傷魂'] = ((c: any, ev: any) => { if (ev === EffectTiming.BEFORE_DAMAGE && c.actor === 'p1') c.applyTrueDamage(c.targetSide, 999, '前傷真傷'); }) as any;
S['反殺魂'] = ((c: any, ev: any) => { if (ev === EffectTiming.ON_DAMAGED && c.actor === 'p2') c.applyTrueDamage('p1', 999, '反殺'); }) as any;
S['免死回滿'] = ((c: any, ev: any) => { if (ev === EffectTiming.FATAL_RESIST) { c.self.currentHp = c.self.maxHp; return true; } }) as any;
S['免死更新回滿'] = ((c: any, ev: any) => { if (ev === EffectTiming.FATAL_RESIST) { c.updateElf(c.actor, { currentHp: 100 }); return true; } }) as any;
S['免死一血'] = ((c: any, ev: any) => { if (ev === EffectTiming.FATAL_RESIST) { c.self.currentHp = 1; return true; } }) as any;

type Frame = { side: string; type: string; text: string; elfId: string };
function setup(p1: any[], p2: any[], onNode?: (id: string, e: any) => void) {
  const engine: any = createBattleEngine({ onNode: onNode ? (id: string) => onNode(id, engine) : undefined, initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].id, p2StarterId: p2[0].id, battleMode: 'PVP', preparedTeams: true, isFast: () => true });
  const frames: Frame[] = [];
  const pr = engine.presentation;
  pr.notify = () => { for (const p of pr.popups) frames.push({ side: p.side, type: p.type, text: p.text, elfId: p.elfId }); };
  engine.mount(); engine.start();
  return { engine, frames };
}
async function oneTurn(engine: any, i1 = 0, i2 = 0) {
  await engine.idle();
  engine.onSkillSelect('p1', engine.getState().p1.skills[i1]); engine.onSkillSelect('p2', engine.getState().p2.skills[i2]);
  await engine.idle();
}
const p2hit = (frames: Frame[]) => frames.filter(f => f.side === 'p2');
const noAdjustOrZero = (frames: Frame[]) => {
  assert.ok(!frames.some(f => f.type.startsWith('adjust')), '不得出現體力調整跳字：' + JSON.stringify(frames));
  assert.ok(!frames.some(f => /^[-+]?0$/.test(f.text)), '不得出現 0 的跳字：' + JSON.stringify(frames));
};
const entries = (engine: any, side: string) => engine.ledger.entries.filter((e: any) => e.targetSide === side);

// 基準：同一組合下非擊殺的一擊，取得技能傷害的實際算出值 D。
const base = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 5000, [skill('打', 60)], 100)]);
await oneTurn(base.engine);
const D = Number(p2hit(base.frames)[0].text.replace('-', ''));
assert.ok(D > 0);

await check('致命一擊（傷害 > 剩餘體力）：紅色技能傷害＝算出的傷害值，不是體力調整、不是 0；帳本 hpLost＝實扣', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 10, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)]);
  await oneTurn(engine);
  const f = p2hit(frames);
  assert.deepEqual(f.map(x => [x.type, x.text]), [['skill', `-${D}`]]);
  noAdjustOrZero(frames);
  assert.equal(engine.getState().p2Team[0].currentHp, 0);
  const e = entries(engine, 'p2');
  assert.equal(e.length, 1); assert.equal(e[0].hpLost, 10); assert.equal(e[0].damageType, 'skill_attack'); assert.equal(e[0].sourceKind, 'skill'); assert.equal(e[0].sourceLabel, '打');
});

await check('致命一擊（傷害剛好等於剩餘體力）', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', D, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)]);
  await oneTurn(engine);
  assert.deepEqual(p2hit(frames).map(x => [x.type, x.text]), [['skill', `-${D}`]]);
  noAdjustOrZero(frames);
  const e = entries(engine, 'p2'); assert.equal(e.length, 1); assert.equal(e[0].hpLost, D); assert.equal(e[0].damageType, 'skill_attack');
});

await check('擊殺後仍有魂印追擊（固傷＋真傷）：紅字先、追擊各依類型，帳本逐筆是實扣', async () => {
  const { engine, frames } = setup([elf('追擊魂', 5000, [skill('打', 60)], 200)], [elf('X', D + 1, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)]);
  await oneTurn(engine);
  const f = p2hit(frames);
  assert.deepEqual(f.map(x => x.type), ['skill', 'fixed'], JSON.stringify(f));
  assert.equal(f[0].text, `-${D}`);
  noAdjustOrZero(frames);
  const e = entries(engine, 'p2');
  assert.equal(e.reduce((a: number, x: any) => a + x.hpLost, 0), D + 1);
  assert.equal(e[0].damageType, 'skill_attack'); assert.equal(e[0].hpLost, D); assert.equal(e[1].damageType, 'fixed'); assert.equal(e[1].hpLost, 1);
});

await check('對手有護盾：擊殺時紅字是護盾後的算出傷害，帳本記 hpLost 與吸收量', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 10, [skill('打', 60)], 100, { shield: 30 }), elf('Y', 5000, [skill('打', 60)], 50)]);
  await oneTurn(engine);
  assert.deepEqual(p2hit(frames).map(x => [x.type, x.text]), [['skill', `-${D - 30}`]]);
  const e = entries(engine, 'p2'); assert.equal(e[0].hpLost, 10); assert.equal(e[0].shieldAbsorbed, 30);
});

await check('出招前已被技能自身的前置固傷／真傷／體力調整擊敗：不出現「紅字 0」，致死跳字依自己的類型', async () => {
  for (const [name, expectType] of [['前置固傷', 'fixed'], ['前置真傷', 'true'], ['前置調整', 'fixed']] as const) {
    const { engine, frames } = setup([elf('A', 5000, [skill(name, 60)], 200)], [elf('X', 10, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)]);
    await oneTurn(engine);
    const f = p2hit(frames);
    assert.deepEqual(f.map(x => x.type), ['skill', expectType], `${name}：${JSON.stringify(f)}`);
    assert.equal(f[0].text, `-${D}`, `${name}：主技能紅字顯示算出的傷害（前置效果已擊敗目標時管線照算、體力不落地）`);
    noAdjustOrZero(frames);
    assert.equal(engine.getState().p2Team[0].currentHp, 0);
    assert.equal(entries(engine, 'p2').filter((x: any) => x.damageType === 'skill_attack').length, 0, '沒有發生的技能傷害不入帳');
  }
});

await check('前置傷害已佇列的擊殺（造成傷害前的真傷）：主技能傷害被跳過時仍顯示算出的紅字，不是 0；帳本只記實際造成的真傷', async () => {
  const { engine, frames } = setup([elf('前傷魂', 5000, [skill('打', 60)], 200)], [elf('X', 10, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)]);
  await oneTurn(engine);
  const f = p2hit(frames);
  assert.deepEqual(f.map(x => x.type), ['skill', 'true'], JSON.stringify(f));
  assert.equal(f[0].text, `-${D}`, '紅字＝主技能算出的傷害');
  noAdjustOrZero(frames);
  const e = entries(engine, 'p2'); assert.equal(e.length, 1); assert.equal(e[0].damageType, 'true'); assert.equal(e[0].hpLost, 10);
  assert.equal(engine.getState().p2Team[0].currentHp, 0, '紅字不改體力');
});

await check('雙方同回合互殺：先手紅字擊殺，後手被反殺的真傷依類型顯示', async () => {
  const { engine, frames } = setup([elf('A', 50, [skill('打', 60)], 200), elf('B', 5000, [skill('打', 60)], 10)], [elf('反殺魂', 10, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)]);
  await oneTurn(engine);
  assert.deepEqual(p2hit(frames).map(x => [x.type, x.text]), [['skill', `-${D}`]]);
  assert.deepEqual(frames.filter(f => f.side === 'p1').map(x => x.type), ['true']);
  noAdjustOrZero(frames);
  assert.equal(engine.getState().p1Team[0].currentHp, 0);
});

await check('6V6：擊殺後換人，下一擊的跳字與帳本仍正確（沒有殘留的體力調整／0）', async () => {
  const mk = (pre: string, n: number, hp: number, sp: number) => Array.from({ length: n }, (_, i) => elf(`${pre}${i}`, hp, [skill('打', 60)], sp - i));
  const { engine, frames } = setup(mk('A', 6, 5000, 200), mk('X', 6, 10, 100));
  for (let t = 0; t < 10; t++) {
    await engine.idle();
    const st = engine.getState();
    if (st.phase === 'forced_switch_p2') { engine.onSwitchElf('p2', st.p2Team.findIndex((e: any) => e.currentHp > 0)); continue; }
    await oneTurn(engine);
  }
  await engine.idle();
  noAdjustOrZero(frames);
  assert.ok(p2hit(frames).filter(f => f.type === 'skill').length >= 3, JSON.stringify(frames));
  assert.ok(p2hit(frames).every(f => f.type === 'skill' && /^-[1-9]\d*$/.test(f.text)), JSON.stringify(frames));
  const e = entries(engine, 'p2'); assert.ok(e.length >= 3); assert.ok(e.every((x: any) => x.hpLost === 10 && x.damageType === 'skill_attack'), JSON.stringify(e.map((x: any) => [x.damageType, x.hpLost])));
});

await check('擊殺後對已倒下目標的 0 體力調整：不得把「最近一次傷害」洗成體力調整', async () => {
  const seen: any[] = [];
  const { engine } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('零調整魂', 10, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 50)],
    (id, e) => { if (id === '3.10' && !seen.length) seen.push({ ...e.getState().p2TurnStats }); });
  await oneTurn(engine);
  assert.equal(seen[0].lastType, 'skill'); assert.equal(seen[0].lastAmount, 10);
});

await check('六刃式存活規則：打到 0 仍存活，紅字照常', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 10, [skill('打', 60)], 100, { survivalRule: liurenSurvivalRule() })]);
  await oneTurn(engine);
  assert.deepEqual(p2hit(frames).map(x => [x.type, x.text]), [['skill', `-${D}`]]);
  assert.equal(entries(engine, 'p2')[0].hpLost, 10);
});

await check('免死類效果在受擊中回滿體力：跳字仍是紅色技能傷害，不被改成體力調整；之後的回升另計', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('免死回滿', 50, [skill('打', 60)], 100, { maxHp: 100 })]);
  await oneTurn(engine);
  const f = p2hit(frames);
  assert.equal(f[0].type, 'skill', JSON.stringify(f)); assert.equal(f[0].text, `-${D}`);
  assert.ok(!f.some(x => x.type === 'adjust_up' && f.indexOf(x) === 0));
});

await check('免死類效果經 updateElf 回升體力：紅字仍是技能傷害（不被換成綠色體力調整），回升以獨立跳字另計', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('免死更新回滿', 50, [skill('打', 60)], 100, { maxHp: 100 })]);
  await oneTurn(engine);
  const f = p2hit(frames);
  assert.equal(f[0].type, 'skill', JSON.stringify(f)); assert.equal(f[0].text, `-${D}`);
  assert.equal(engine.getState().p2Team[0].currentHp, 100);
});

await check('免死類效果在受擊中直接改體力：帳本 hpBefore 取受擊前的值，不被就地修改污染', async () => {
  const { engine, frames } = setup([elf('A', 5000, [skill('打', 60)], 200)], [elf('免死一血', 50, [skill('打', 60)], 100, { maxHp: 100 })]);
  await oneTurn(engine);
  assert.equal(p2hit(frames)[0].type, 'skill'); assert.equal(p2hit(frames)[0].text, `-${D}`);
  const e = entries(engine, 'p2'); assert.equal(e[0].hpLost, 49, '50→1 實扣 49');
});

console.error = quiet;
console.log(`killPopup: ${count} passed, ${failed} failed`);
await server.close();
process.exit(failed ? 1 : 0);
