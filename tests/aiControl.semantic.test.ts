// AI 控場（2026-11-07）：開控／續控／趁控輸出／免疫不控；巔峰 50 回合上限的領先保命與落後搶擊倒。
import assert from 'node:assert/strict';
import { scoreActions, AI_DEFAULT } from '../src/battle/ai/legacyScoring';
import { skillControl, CONTROL_WORDS } from '../src/battle/ai/controlPlanning';
const isControl = (n: string) => CONTROL_WORDS.includes(n);
const sk = (name: string, over: any = {}) => ({ name, category: '物理', type: '普通', power: 80, pp: 10, maxPp: 10, description: '', ...over });
const ctlSkill = sk('麻痺打擊', { kit: [{ codeId: 'effect_sequence', params: { clause: { body: [{ acts: [{ op: 'status', p: { side: 'opp', status: '麻痺', turns: 2, chance: 100 } }] }] } } }] });
const hit = sk('重擊');
const mk = (id: string, hp: number, extra: any = {}): any => ({ id, battleId: id, name: id, type: '普通', currentHp: hp, maxHp: 1000, statStages: {}, skills: [ctlSkill, hit], ...extra });
const deps = (toFoe: number, toSelf: number): any => ({ estimateDamage: (a: any) => (a.id === 'F' ? toSelf : toFoe), getTypeMatchup: () => 1,
  getStatuses: (e: any) => e.battleStatuses || {}, isSkillUsable: () => true, isControlStatus: isControl, rng: () => .5 });
const ctx = (self: any, foe: any, extra: any = {}): any => ({ self, opponent: foe, team: [self], activeIndex: 0, items: [], canSwitch: false, canUseItem: false, turnNumber: 5, ...extra });
const best = (c: any, d: any) => scoreActions(c, d, { ...AI_DEFAULT, randomness: 0, noise: 0 }).sort((a, b) => b.score - a.score)[0];
const name = (a: any) => a.action.kind === 'skill' ? a.action.skill.name : a.action.kind;

// 控制能力辨識：積木與說明文字；排除「若對手處於」「免疫」
assert.deepEqual(skillControl(ctlSkill as any, isControl), { statuses: ['麻痺'], chance: 100 });
assert.deepEqual(skillControl(sk('x', { description: '🎯 30%令對手害怕' }) as any, isControl), { statuses: ['害怕'], chance: 30 });
assert.equal(skillControl(sk('y', { description: '🎯 若對手處於麻痺則威力翻倍' }) as any, isControl), null);
assert.equal(skillControl(sk('z', { description: '■ 自身免疫麻痺' }) as any, isControl), null);
// 一、對手未受控 → 開控（同等傷害下優先控制技）
assert.equal(name(best(ctx(mk('S', 900), mk('F', 900)), deps(150, 100))), '麻痺打擊');
// 二、對手仍受控 ≥2 回合 → 不浪費控制，趁控輸出
const ctrlScores = (left: number) => { const all = scoreActions(ctx(mk('S', 900), mk('F', 900, { battleStatuses: { '麻痺': left } })), deps(150, 100), { ...AI_DEFAULT, randomness: 0, noise: 0 }); return { ctl: all.find(a => name(a) === '麻痺打擊')!.score, hit: all.find(a => name(a) === '重擊')!.score }; };
let s = ctrlScores(3); assert.ok(s.hit >= s.ctl, `受控 3 回合：輸出優先（${s.hit} vs ${s.ctl}）`);
// 三、控制只剩 1 回合 → 續控
s = ctrlScores(1); assert.ok(s.ctl > s.hit, `剩 1 回合：續控（${s.ctl} vs ${s.hit}）`);
// 四、對手免疫異常（神話）→ 控制不加分
s = (() => { const all = scoreActions(ctx(mk('S', 900), mk('F', 900, { battleStatuses: { '神話': 99 } })), deps(150, 100), { ...AI_DEFAULT, randomness: 0, noise: 0 }); return { ctl: all.find(a => name(a) === '麻痺打擊')!.score, hit: all.find(a => name(a) === '重擊')!.score }; })();
assert.equal(s.ctl, s.hit, '免疫異常：兩招同分');
// 五、能擊倒就擊倒（擊殺優先於控制）
assert.ok(best(ctx(mk('S', 900), mk('F', 100)), deps(150, 100)).score > 150);
// 六、危急時控制類屬性技能不被「危急不鋪場」扣分
const statusCtl = sk('催眠', { category: '屬性', power: 0, description: '令對手睡眠' });
const danger = scoreActions(ctx(mk('S', 300, { skills: [statusCtl, hit] }), mk('F', 900)), deps(50, 900), { ...AI_DEFAULT, randomness: 0, noise: 0 });
assert.equal(name(danger.sort((a, b) => b.score - a.score)[0]), '催眠', '危急：先控住對手阻止斬殺');
// 七、巔峰 50 回合：落後時越接近上限越重擊倒；領先且危急時換下保命
const team = (n: number) => Array.from({ length: n }, (_, i) => mk(`T${i}`, 900));
const killScore = (turn: number, mine: number, theirs: number) => scoreActions(ctx(mk('S', 900), mk('F', 100), { turnNumber: turn, turnLimit: 50, team: [mk('S', 900), ...team(mine - 1)], opponentTeam: team(theirs) }), deps(150, 100), AI_DEFAULT).find(a => name(a) === '重擊')!.score;
assert.ok(killScore(49, 2, 3) > killScore(10, 2, 3), '接近上限時擊倒加權');
const benchSafe = mk('B', 900);
const sw = (turn: number) => scoreActions({ ...ctx(mk('S', 200), mk('F', 900), { turnNumber: turn, turnLimit: 50, opponentTeam: team(2) }), team: [mk('S', 200), benchSafe, mk('C', 900)], canSwitch: true }, deps(50, 500), { ...AI_DEFAULT, randomness: 0, noise: 0 }).filter(a => a.action.kind === 'switch').map(a => a.score);
assert.ok(Math.max(...sw(49)) > Math.max(...sw(10)), '回合將盡且領先：換下保住存活數');
console.log('AI 控場：辨識、開控、趁控輸出、續控、免疫不控、擊殺優先、危急控場、巔峰回合上限 通過');
