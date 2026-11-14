// Screenshot regression (2026-11-11): Rey pinned at -70/1 on round 33.
// Pure headless engine: NO React, NO JSDOM, NO DOM, NO sprites / portraits.
// P1 = Gaia (left), P2 = Otherworld Thunder Rey (right); both sides are driven
// by this test (PvP). Verifies the god-descent death line actually ends the
// battle instead of locking it, and that the negative HP value remains in the
// state data (so the HUD can still show -70/1) up to the moment of death.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import type { BattleEngine } from '../src/engine/battleEngine';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  assert.equal(typeof (globalThis as any).window, 'undefined', 'no DOM at all');
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { reyGodDescentRule, godDescentFloor } = await server.ssrLoadModule('/src/battle/survivalRules.ts');
  const { checkElfDead } = await server.ssrLoadModule('/src/battle/elfAlive.ts');
  const R = getBattleSkillRegistry();
  const quiet = console.error;
  console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) quiet(...a); };

  // Controlled true-damage skill; both sides get a wait skill too.
  const HIT = '真傷測試';
  R[HIT] = (c: any) => { c.applyTrueDamage('p2', 10, HIT); };
  const waitSkill = (name: string) => ({ name, category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' });
  const hitSkill = () => ({ ...waitSkill(HIT), category: '特殊', power: 10 });

  // Screenshot state: maxHp compressed to 1, currentHp = -70 = the death line.
  const maxHp = 1;
  const rule = reyGodDescentRule(maxHp);
  const floor = godDescentFloor(rule, maxHp);
  assert.equal(floor, -70 * maxHp, 'formula-derived death line');

  const rey: any = {
    id: '5029', battleId: 'rey', name: '異境神霆·雷伊', type: '神秘.電', level: 100,
    currentHp: floor, maxHp, survivalRule: rule, isAlienElf: true,
    baseStats: { hp: 120, atk: 170, def: 125, spatk: 170, spdef: 125, speed: 140 },
    calculatedStats: { hp: maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 140 },
    statStages: {}, effects: [], skills: [waitSkill('等待')],
  };

  // P1 = screenshot Gaia, fully synthetic (no sprite / profile lookups).
  const gaia: any = {
    id: 'gaia', battleId: 'gaia', name: '終焉戰神.蓋亞', type: '戰鬥', level: 100,
    currentHp: 233, maxHp: 233,
    baseStats: { hp: 190, atk: 200, def: 125, spatk: 60, spdef: 125, speed: 150 },
    calculatedStats: { hp: 233, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 300 },
    statStages: {}, effects: [], skills: [hitSkill()],
  };

  // Healthy bench member so forced-switch has a destination.
  const bench: any = { ...structuredClone(rey), id: 'bench', battleId: 'bench', name: '候補',
    currentHp: 100, maxHp: 100, survivalRule: undefined,
    calculatedStats: { ...rey.calculatedStats, hp: 100, speed: 10 }, skills: [waitSkill('等待')] };

  // Data-layer assertions: the raw negative value must survive (HUD shows -70/1).
  assert.equal(rey.currentHp, -70, 'screenshot value -70 is preserved as data');
  assert.equal(checkElfDead(rey), true, 'at the death line the elf is dead');

  const nodes: { id: string; d?: any }[] = [];
  const engine: BattleEngine = createBattleEngine({
    initialP1Team: [gaia], initialP2Team: [rey, bench],
    p1StarterId: 'gaia', p2StarterId: 'rey', battleMode: 'PVP', preparedTeams: true,
    isFast: () => true, onNode: (id, d) => nodes.push({ id, d }),
  });
  engine.mount(); engine.start();
  await engine.idle();

  const s0 = engine.getState();
  console.log('setup:', 'turn', s0.turnNumber, 'phase', s0.phase,
    '| P1', s0.p1.name, s0.p1.currentHp, '| P2', s0.p2.name, s0.p2.currentHp + '/' + s0.p2.maxHp);

  // The engine re-evaluates death from state; -70/1 must not leave it in select.
  assert.equal(s0.p2.currentHp, -70, 'negative HP value still present in state');
  assert.equal(checkElfDead(s0.p2), true, 'engine state marks Rey dead');
  assert.ok(s0.phase.startsWith('forced_switch'), `expected forced switch, got ${s0.phase}`);

  // Drive BOTH sides: P1 picks its hit, P2 resolves the forced switch.
  const st = engine.getState();
  engine.onSkillSelect('p1', st.p1.skills[0]);
  const next = st.p2Team.findIndex((e: any, i: number) => i !== st.p2ActiveIndex && !e.isExtra && !checkElfDead(e));
  assert.ok(next >= 0, 'a living bench member must be available');
  engine.onSwitchElf('p2', next);
  await engine.idle();

  const s1 = engine.getState();
  console.log('after forced switch:', 'turn', s1.turnNumber, 'phase', s1.phase,
    '| P2 active', s1.p2.name, s1.p2.currentHp + '/' + s1.p2.maxHp);
  assert.notEqual(s1.p2.name, '異境神霆·雷伊', 'dead Rey must be replaced');
  assert.equal(s1.p2.name, '候補');

  // Death node was actually emitted (normal death pipeline, not a silent clamp).
  assert.ok(nodes.some(n => n.id.startsWith('6.')), 'death node emitted');
  assert.ok(nodes.some(n => n.id === '6.2' || n.id === '6.3' || n.id.startsWith('6.')),
    'a 6.x death-phase node ran');

  engine.unmount();
  console.log('God-descent headless PvP (-70/1) passed: no sprites, no DOM, no lock.');
  delete R[HIT];
  console.error = quiet;
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await server.close(); process.exit(process.exitCode ?? 0); }
