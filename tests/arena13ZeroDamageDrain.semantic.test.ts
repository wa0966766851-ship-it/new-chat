/** 龍錄天鋒魂印「造成的攻擊傷害為0時吸取對手100%最大體力」：魂印效果不需命中；技能無效／未命中／攻擊免疫／抵擋皆觸發，正常造成傷害與屬性技能不觸發。 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const tf = DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_13');
  const tfUnit = (id: string, skills: any[]) => {
    const base = structuredClone(tf);
    Object.assign(base, { id, battleId: id, name: '龍錄天鋒', maxHp: 100000, currentHp: 100000, skills, statStages: {},
      baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 200 },
      calculatedStats: { hp: 100000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 200 } });
    return base;
  };
  const attack = (o: any = {}) => ({ ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, accuracy: 100, description: '', ...o });
  const run = async (side: 'p1' | 'p2', tag: string, skill: any, setup?: (c: any) => void) => {
    const opp = h.unit(`受方_${tag}`, 1000000, [h.wait()], { speed: 100, maxHp: 1000000 });
    h.S[opp.name] = (c: any, e: string) => { if (e === 'ON_ENTRANCE' && setup) setup(c); };
    const [r] = await h.play(side, { self: tfUnit(`天鋒_${tag}`, [skill]), opp }, 1);
    return { oppHp: r.opp.currentHp, selfHp: r.self.currentHp };
  };
  for (const side of ['p1', 'p2'] as const) {
    const drained = (x: { oppHp: number }, tag: string) => assert.equal(x.oppHp, 0, `${side} ${tag}：攻傷0→吸取對手100%最大體力`);
    const normal = await run(side, '正常', attack());
    assert.ok(normal.oppHp > 0 && normal.oppHp < 1000000, `${side} 正常造成傷害不觸發`); checks++;
    drained(await run(side, '無效', attack(), c => c.addTimerTo(c.targetSide, { id: '驗收無效', name: '驗收無效', remaining: 1, kind: 'use_counter', source: 'skill', tickAt: 'never', payload: { block: { invalid: 'all' } } }, false)), '技能無效'); checks++;
    drained(await run(side, '未命中', attack({ isSureHit: false, accuracy: 0 })), '未命中'); checks++;
    drained(await run(side, '攻擊免疫', attack(), c => c.setPlayerState('blockAttackCount', 1)), '攻擊免疫'); checks++;
    drained(await run(side, '抵擋', attack(), c => c.addTimerTo(c.actor, { id: '驗收抵擋', name: '驗收抵擋', remaining: 1, kind: 'use_counter', source: 'skill', tickAt: 'never', payload: { block: { blockAttack: true } } }, false)), '抵擋攻擊傷害'); checks++;
    const status = await run(side, '屬性', h.wait());
    assert.equal(status.oppHp, 1000000, `${side} 屬性技能不觸發`); checks++;
  }
  console.log(`龍錄天鋒攻傷0吸取：${checks} 項通過`);
} finally { await h.close(); }
