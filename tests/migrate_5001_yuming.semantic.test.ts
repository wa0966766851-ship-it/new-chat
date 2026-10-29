// 5001 幽冥噬魂 Kit 引擎驗收：免疫反彈5回合＋三個監看計時器（害怕/束縛/無效消除）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');

const sobirat = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5001'));
const dummy = (id: string, hp: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 50 }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed: 50 }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

const e: any = createBattleEngine({ initialP1Team: [sobirat], initialP2Team: [dummy('X', 1_000_000_000)], p1StarterId: '5001', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
e.mount(); e.start();
await e.idle();
const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '幽冥噬魂');
e.onSkillSelect('p1', e.getState().p1.skills[idx]);
e.onSkillSelect('p2', e.getState().p2.skills[0]);
await e.idle();
const st = e.getState();

// 1) 三個監看計時器（id 內含 trig 名）
const timers = (st.p1Timers || []).map((t: any) => String(t.id));
const fearWatch = timers.some(t => t.includes('幽冥噬魂_持續效果_self_skill'));
const bindWatch = timers.some(t => t.includes('幽冥噬魂_持續效果_opp_attack'));
const invalidWatch = timers.some(t => t.includes('幽冥噬魂_持續效果_self_invalid'));
console.log('fear:', fearWatch, '| bind:', bindWatch, '| invalid:', invalidWatch);
console.log('timers:', timers.filter(t => t.includes('幽冥')).join(' | ').slice(0, 500));
assert.ok(fearWatch, '應有「自身使用技能→害怕」監看計時器');
assert.ok(bindWatch, '應有「對手攻擊→束縛」監看計時器');
assert.ok(invalidWatch, '應有「攻擊無效→消除回合類」監看計時器');

// 2) 免疫反彈5回合：registry 鍵或計時器
const reg = st.p1RegistryState || {};
const reflect = (st.p1Timers || []).some((t: any) => String(t.id).includes('免疫') || (t.payload?.block?.statusGuard?.reflect));
console.log('reflect timer/registry:', reflect, '| sobiratStatusReflectTurns:', reg.sobiratStatusReflectTurns);
assert.ok(reflect || reg.sobiratStatusReflectTurns === 5, '免疫反彈5回合應生效');

// 3) 害怕監看的 initial:true 當回合就觸發（幽冥噬魂自身是屬性技——self_skill 當回合觸發）
const logs = (st.logs || []).map((l: any) => String(l.text || ''));
const feared = logs.some((t: string) => t.includes('害怕'));
console.log('feared log:', feared, '| last logs:', logs.slice(-4).join(' / ').slice(0, 300));
assert.ok(feared, '當回合使用技能應已令對手害怕（initial:true）');

await server.close();
console.log('幽冥噬魂 3 checks PASSED');
