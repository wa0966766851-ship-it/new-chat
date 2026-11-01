// 額外行動演出時序（擁有者裁定）：同一行動窗口內連續的額外行動合併為「一次」演出；動畫先於傷害跳字；
// 演出者是在場的主戰精靈（額外精靈沿用其額外序列，沒有則退回屬性技 cp 序列）；致死不搶在動畫前；下一個行動等收招。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { BattlePresentation } from '../src/battle/presentation';
import { DEFAULT_BATTLE_ANIMATION } from '../src/battle/animationSettings';
import { registerPetPlayer, registerPetTimings, reportPetPlayback } from '../src/battle/petAnimationRegistry';

let checks = 0;
const ok = (name: string) => { checks++; console.log(`✓ ${name}`); };
const ticks = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const skillEvent = (over: any = {}) => ({ side: 'p2' as const, elfId: 'target', sourceSide: 'p1' as const, type: 'skill' as const, amount: 15, delta: -15, before: 1000, after: 985, maxHp: 1000, ...over });

// ───── 播放層（BattlePresentation）─────
const host: any = { id: 'host', battleId: 'host', name: '主戰精靈' };
const extraElf: any = { id: 'x_shancaishen', battleId: 'x_shancaishen', name: '炫彩山神', isExtra: true };
const shown: any[][] = [];
const mk = () => { shown.length = 0; const p: BattlePresentation = new BattlePresentation(() => { if (p.popups.length) shown.push([...p.popups]); }, () => false, () => ({ ...DEFAULT_BATTLE_ANIMATION, speed: 10 })); return p; };
const stageTeam = (p: BattlePresentation) => p.stage({ p1Team: [host, extraElf], p1ActiveIndex: 0, p2Team: [], p2ActiveIndex: 0 });

{ // 額外精靈沿用主戰精靈的額外序列：放行只看主戰精靈的播放事件
  const offHost = registerPetPlayer('p1', host), tHost = registerPetTimings('p1', host, { extra: { duration: 2000, hit: 500 } });
  const offExtra = registerPetPlayer('p1', extraElf), tExtra = registerPetTimings('p1', extraElf, { extra: { duration: 2000, hit: 500 } });
  const p = mk();
  try {
    await stageTeam(p);
    const anim = p.animate({ side: 'p1', category: 'extra', skillName: '額外行動' }, 400);
    await ticks();
    assert.equal(p.skillAnim?.category, 'extra');
    let released = false; void anim.then(() => { released = true; });
    reportPetPlayback('p1', extraElf, { sequence: 'extra', type: 'marker', marker: { name: 'action_hit' } }); await ticks();
    assert.equal(released, false, '額外精靈自己的播放事件不放行：演出者是主戰精靈');
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'marker', marker: { name: 'action_hit' } }); await anim;
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'complete' }); await p.wait();
    ok('額外精靈使用主戰精靈的額外行動序列（放行只認主戰精靈）');
  } finally { p.dispose(); offHost(); tHost(); offExtra(); tExtra(); }
}
{ // 主戰精靈沒有額外序列時退回屬性技(cp)序列：仍走時間軸（等命中），而不是靜態停留
  const offHost = registerPetPlayer('p1', host), tHost = registerPetTimings('p1', host, { cp: { duration: 2000, hit: 500 } });
  const p = mk();
  try {
    await stageTeam(p);
    const anim = p.animate({ side: 'p1', category: 'extra', skillName: '額外行動' }, 400);
    await sleep(120); // 無序列時只停 400ms/10 倍速＝40ms 就結束；仍卡住代表採用了 cp 時間軸
    assert.equal(p.skillAnim?.category, 'extra', '退回 cp 序列，等待命中標記');
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'marker', marker: { name: 'action_hit' } }); await anim;
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'complete' }); await p.wait();
    assert.equal(p.skillAnim, null);
    ok('沒有額外序列時退回屬性技(cp)序列');
  } finally { p.dispose(); offHost(); tHost(); }
}
{ // 動畫先於跳字；致死不搶在動畫前；兩筆額外行動合併為一筆
  const offHost = registerPetPlayer('p1', host), tHost = registerPetTimings('p1', host, { extra: { duration: 2000, hit: 500 } });
  const p = mk();
  try {
    await stageTeam(p);
    // 引擎先排動畫、再結算額外行動（致死）
    const anim = p.animate({ side: 'p1', category: 'extra', skillName: '額外行動' }, 400);
    p.beginExtra();
    await p.record(skillEvent({ amount: 700, delta: -700, after: 300 }));
    const lethal = p.record(skillEvent({ amount: 400, delta: -400, before: 300, after: 0 }));
    await ticks();
    assert.equal(p.popups.length, 0, '動畫命中前沒有跳字'); assert.equal(p.hp.get('p2:target'), 1000, '動畫命中前目標體力不動（不會先倒下）');
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'marker', marker: { name: 'action_hit' } });
    await anim; await ticks();
    assert.equal(shown.length, 1, '兩筆額外行動合併為一次跳字'); assert.equal(shown[0].length, 1); assert.equal(shown[0][0].amount, 1100); assert.equal(shown[0][0].channel, 'extra');
    assert.equal(p.hp.get('p2:target'), 0, '命中後目標才倒下');
    await lethal;
    void p.endExtra();
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'complete' }); await p.wait();
    ok('動畫先於跳字；致死額外行動不搶在動畫前；連續兩筆合併為一筆');
  } finally { p.dispose(); offHost(); tHost(); }
}
{ // 下一個行動等額外行動收招完成才開始（動畫與跳字皆然）；額外行動自己的紅字仍在命中時播出
  const offHost = registerPetPlayer('p1', host), tHost = registerPetTimings('p1', host, { extra: { duration: 2000, hit: 500 }, attack: { duration: 2000, hit: 500 } });
  const p = mk();
  try {
    await stageTeam(p);
    const first = p.animate({ side: 'p1', category: 'extra', skillName: '額外行動' }, 400);
    await ticks(); // 先讓播放器訂閱
    p.beginExtra(); await p.record(skillEvent()); const red = p.endExtra();
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'marker', marker: { name: 'action_hit' } }); await first; await ticks();
    assert.equal(shown[0]?.[0]?.channel, 'extra', '額外行動紅字在命中時播出'); await red;
    const next = p.animate({ side: 'p1', category: 'attack', skillName: '下一個行動' }, 400);
    const nextRed = p.record(skillEvent({ type: 'skill', amount: 50, delta: -50, before: 985, after: 935, label: '下一擊' }));
    await sleep(60);
    assert.equal(p.skillAnim?.category, 'extra', '收招未完成：下一個行動的動畫還沒開始');
    assert.ok(!shown.flat().some((e: any) => e.amount === 50), '收招未完成：下一個行動的跳字還沒出現');
    reportPetPlayback('p1', host, { sequence: 'extra', type: 'complete' }); await ticks(); await sleep(60);
    assert.equal(p.skillAnim?.category, 'attack', '收招完成後下一個行動才開始');
    reportPetPlayback('p1', host, { sequence: 'attack', type: 'marker', marker: { name: 'action_hit' } }); await next; await nextRed;
    reportPetPlayback('p1', host, { sequence: 'attack', type: 'complete' }); await p.wait();
    ok('額外行動收招完成前，下一個行動的動畫與跳字都等待');
  } finally { p.dispose(); offHost(); tHost(); }
}

// ───── 引擎（headless）：動畫先於額外行動結算、同一窗口只播一次（P1／P2；出手後與回合收尾兩個窗口）─────
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const quiet = console.error; console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) quiet(...a); };
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { getBattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');
  const R = getBattleSkillRegistry(), S = getSoulMarkRegistry();
  const unit = (id: string, skills: any[], speed: number): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: 100_000, maxHp: 100_000,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp: 100_000, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills });
  const skill = (name: string) => ({ name, category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' });
  const settings = () => ({ skill: true, damage: true, extra: true, potion: true, roundEnd: true, speed: 1 }) as any;

  for (const site of ['出手後', '回合收尾'] as const) for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    R['雙額外'] = (c: any) => { if (site === '出手後' && c.actor === side) for (let i = 0; i < 2; i++) c.queueExtraAction(side, { amount: 15, label: `額外${i}` }); };
    S[`收尾額外${side}`] = ((c: any, ev: any) => { if (site === '回合收尾' && ev === EffectTiming.ROUND_END && c.actor === side) for (let i = 0; i < 2; i++) c.queueExtraAction(side, { amount: 15, label: `額外${i}` }); }) as any;
    const A = unit(`${side}甲`.replace('p', 'x'), [skill('雙額外')], 200), B = unit('乙', [skill('等待')], 100);
    A.name = `收尾額外${side}`; A.id = A.battleId = `A_${side}`;
    const teams = side === 'p1' ? [[A], [B]] : [[B], [A]];
    const engine = createBattleEngine({ initialP1Team: teams[0], initialP2Team: teams[1], p1StarterId: teams[0][0].id, p2StarterId: teams[1][0].id, battleMode: 'PVP', preparedTeams: true,
      isFast: () => true, animationSettings: settings });
    const log: string[] = [], pres = engine.presentation;
    const animate = pres.animate.bind(pres), record = pres.record.bind(pres), endExtra = pres.endExtra.bind(pres), beginExtra = pres.beginExtra.bind(pres);
    pres.animate = (anim: any, d: number, en?: boolean) => { log.push(`animate:${anim.category}:${anim.side}`); return animate(anim, d, en); };
    pres.record = (e: any) => { log.push(`record:${e.skillName || e.label || e.type}`); return record(e); };
    pres.beginExtra = () => { log.push('beginExtra'); return beginExtra(); };
    pres.endExtra = () => { log.push('endExtra'); return endExtra(); };
    engine.mount(); engine.start(); await engine.idle();
    engine.onSkillSelect('p1', engine.getState().p1.skills[0]); engine.onSkillSelect('p2', engine.getState().p2.skills[0]); await engine.idle();
    const extraAnims = log.filter(x => x === `animate:extra:${side}`);
    assert.equal(extraAnims.length, 1, `${site}/${side}：同一窗口兩筆額外行動只播一次動畫：${log.join(' | ')}`);
    assert.equal(log.filter(x => x === 'beginExtra').length, 1); assert.equal(log.filter(x => x === 'endExtra').length, 1, '整個窗口只開關一次');
    const animIndex = log.indexOf(`animate:extra:${side}`), firstDamage = log.findIndex(x => /^record:額外\d/.test(x));
    assert.ok(firstDamage >= 0, `有額外行動傷害紀錄：${log.join(' | ')}`);
    assert.ok(animIndex >= 0 && animIndex < firstDamage, `${site}/${side}：動畫先於第一筆額外行動傷害：${log.join(' | ')}`);
    assert.ok(log.indexOf('beginExtra') < animIndex, '先開視窗再排動畫');
    assert.equal(engine.getState()[other].currentHp, 100_000 - 30, '兩筆額外行動結算不受演出影響');
    engine.unmount(); delete R['雙額外']; delete S[`收尾額外${side}`];
    ok(`引擎 ${site}／${side}：動畫先於額外行動傷害，兩筆合併為一次演出`);
  }
} finally { console.error = quiet; await server.close(); }
console.log(`額外行動演出時序：${checks} 組通過。`);
