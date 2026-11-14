import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { BATTLE_FLAMES, drawFlameChoices, isFlameId } from '../src/data/battleFlames';
import { drawLoadoutOptions, aiChooseLoadout, defaultLoadout, loadoutLabel, LOADOUT_COUNTS } from '../src/utils/destinyLoadout';
import { SUIT_CATALOG, EYEWEAR_CATALOG } from '../src/data/suitsAndEyewears';
import { TITLE_CATALOG } from '../src/data/titles';
import { makeRng } from '../src/utils/rng';

/**
 * 戰鬥火焰與命運配裝（2026-11-07）：
 * 一、資料與抽選：四種火焰、候選互不重複、AI 選擇在候選內。
 * 二、真實引擎：battleFlames 帶入後，紫火增傷 25%、金火減傷 25%、綠火登場能力 +1、藍火回合結束回 8%；只影響持有方。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 一、資料與抽選
assert.equal(BATTLE_FLAMES.length, 4);
assert.ok(BATTLE_FLAMES.every(f => isFlameId(f.id) && f.effect && f.original));
for (let s = 1; s <= 40; s++) {
  const r = makeRng(s);
  const two = drawFlameChoices(r, 2); assert.equal(new Set(two.map(f => f.id)).size, 2);
  const { p1, p2 } = drawLoadoutOptions(r);
  assert.equal(p1.suits.length, LOADOUT_COUNTS.suits); assert.equal(p1.titles.length, LOADOUT_COUNTS.titles); assert.equal(p1.eyewears.length, LOADOUT_COUNTS.eyewears);
  for (const k of ['suits', 'eyewears', 'titles'] as const) {
    assert.equal(p1[k].filter(x => p2[k].includes(x)).length, 0, `${k} 雙方不重複（seed ${s}）`);
    assert.equal(new Set(p1[k]).size, p1[k].length);
  }
  assert.ok(p1.suits.every(id => SUIT_CATALOG[id]) && p1.eyewears.every(id => EYEWEAR_CATALOG[id]) && p1.titles.every(id => TITLE_CATALOG[id]));
  assert.equal(p1.flames.length, 2); assert.ok(p1.flames.every(isFlameId));
  const ai = aiChooseLoadout(p2);
  assert.ok(p2.suits.includes(ai.suit) && p2.eyewears.includes(ai.eyewear) && p2.titles.includes(ai.title) && p2.flames.includes(ai.flame), 'AI 只選候選內');
  const def = defaultLoadout(p1); assert.equal(def.suit, p1.suits[0]); assert.equal(def.flame, p1.flames[0]);
}
assert.equal(loadoutLabel('flame', 'flame_gold').name, '金火・庇護之焰');
assert.ok(loadoutLabel('suit', Object.keys(SUIT_CATALOG)[0]).desc.length > 0);
console.log('火焰／配裝抽選：40 組種子不重複、AI 選擇合法');

// 二、真實引擎
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', root });
const quiet = console.error; console.error = () => {};
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const skill = (name: string, over: any = {}) => ({ name, category: '物理', type: '普通', power: 100, pp: 30, maxPp: 30, isSureHit: true, description: '', ...over });
  const mkElf = (id: string, hp = 1_000_000): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: 1_000_000, critValue: 0,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, calculatedStats: { hp: 1_000_000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    statStages: {}, skills: [skill('打'), skill('等', { category: '屬性', power: 0 })] });
  async function duel(flames: { p1?: string; p2?: string }, p1Hp = 1_000_000) {
    delete (globalThis as any).__BATTLE_SEED__;
    const p1 = mkElf('A', p1Hp), p2 = mkElf('B');
    const engine = createBattleEngine({ initialP1Team: [p1], initialP2Team: [p2], p1StarterId: 'A', p2StarterId: 'B', battleMode: 'PVP', preparedTeams: true, isFast: () => true, randomSeed: 7, battleFlames: flames });
    engine.mount(); engine.start(); await engine.idle();
    const round = async (a = 0, b = 0) => { const st = engine.getState(); engine.onSkillSelect('p1', st.p1.skills[a]); engine.onSkillSelect('p2', st.p2.skills[b]); await engine.idle(); };
    return { engine, round, st: () => engine.getState(), close: () => engine.unmount() };
  }
  const lost = (e: any) => 1_000_000 - e.currentHp;
  const near = (v: number, want: number, tol: number, msg: string) => assert.ok(Math.abs(v - want) <= tol, `${msg}：${v.toFixed(3)}，預期 ${want}`);

  let d = await duel({}); await d.round(); const baseOut = lost(d.st().p2), baseIn = lost(d.st().p1); d.close();
  assert.ok(baseOut > 50 && baseIn > 50, '基準傷害');
  d = await duel({ p1: 'flame_purple' }); await d.round(); near(lost(d.st().p2) / baseOut, 1.25, 0.02, '紫火：P1 造成傷害 +25%'); near(lost(d.st().p1) / baseIn, 1, 0.01, '紫火不影響對手輸出'); d.close();
  d = await duel({ p2: 'flame_purple' }); await d.round(); near(lost(d.st().p1) / baseIn, 1.25, 0.02, '紫火在 P2 側同樣生效'); d.close();
  d = await duel({ p1: 'flame_gold' }); await d.round(); near(lost(d.st().p1) / baseIn, 0.75, 0.02, '金火：P1 受到傷害 −25%'); near(lost(d.st().p2) / baseOut, 1, 0.01, '金火不減對手'); d.close();
  d = await duel({ p1: 'flame_green' });
  for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed']) assert.equal(d.st().p1.statStages?.[k] ?? 0, 1, `綠火：登場 ${k} +1`);
  assert.equal(d.st().p2.statStages?.atk ?? 0, 0, '綠火只影響持有方'); d.close();
  d = await duel({ p1: 'flame_blue' }, 500_000); await d.round(1, 1);
  near(d.st().p1.currentHp, 580_000, 1, '藍火：回合結束回復 8% 最大體力'); d.close();
  console.log('戰鬥火焰（真實引擎）：紫火 +25%、金火 −25%、綠火登場 +1、藍火回 8%，雙側皆驗');
} finally { console.error = quiet; await server.close(); }
process.exit(0);
