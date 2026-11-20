// 2026-11-16：柯爾霍德 未暝之夜（規範文字）——下場後保留、最高6道；大於1道時每道將對手視為至少1級全屬性下降，
// 並在自身效果判定時視對手處於全屬性能力下降（資源查詢規則 oppDownFloorPerStack；只影響持有者自身的計算）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let n = 0; const ok = (s: string) => { n++; console.log('✓ ' + s); };
try {
  const { resourceOppStageFloor } = await h.server.ssrLoadModule('/src/battle/resourceQueryRules.ts');
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const k = DEFAULT_ELVES.find((e: any) => String(e.id) === '5013');
  const markAdds: any[] = [];
  const walk = (v: any) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.op === 'resource_mark_add' && v.p?.id === 'dark_night') markAdds.push(v.p); Object.values(v).forEach(walk); } };
  walk(k.soulMark.kit);
  assert.ok(markAdds.length >= 4 && markAdds.every(p => p.persistsOffField === true && p.maxCount === 6), '未暝之夜下場後保留、最高6道');
  ok('印記：下場後保留、上限6道');
  const rule = { id: 'dark_night', min: 2, oppDownFloorPerStack: 1 };
  const holder = (count: number) => ({ id: 'k', battleId: 'k', resourceQueryRules: [rule], marks: count ? [{ id: 'dark_night', count, scope: 'elf', ownerBattleId: 'k' }] : [] }) as any;
  assert.equal(resourceOppStageFloor(holder(1), []), 0, '1道不改為下降視圖');
  assert.equal(resourceOppStageFloor(holder(2), []), 2);
  assert.equal(resourceOppStageFloor(holder(6), []), 6);
  assert.equal(resourceOppStageFloor({ ...holder(3), isInherentInvalid: true }, []), 0, '魂印失效時不生效');
  ok('道數→對手全屬性至少下降N級');
  for (const side of ['p1', 'p2'] as const) {
    const self = structuredClone(k); self.battleId = 'K'; self.skills = [h.wait()];
    const [r] = await h.play(side, { self, opp: h.unit('E', 5000, [h.wait()]) }, 1);
    assert.ok((r.self.resourceQueryRules || []).some((x: any) => x.id === 'dark_night' && x.min === 2 && x.oppDownFloorPerStack === 1), '開戰登記規則');
  }
  ok('實戰：開戰登記「大於1道」規則（P1/P2）');
  const { evalCond } = await h.server.ssrLoadModule('/src/blocks/runtime.ts');
  {
    const ctx: any = { self: holder(2), target: { statStages: { atk: 2 } }, actor: 'p1', targetSide: 'p2', getMarks: () => [], getStatuses: () => ({}) };
    assert.equal(evalCond(ctx, { c: 'stage', p: { side: 'opp', kind: 'down' } }), true, '自身效果判定視對手處於能力下降');
    assert.equal(evalCond(ctx, { c: 'stage', p: { side: 'opp', kind: 'up' } }), false, '對手能力提升判定為否');
    ok('自身效果判定：對手視為全屬性下降');
  }
  console.log(`未暝之夜：${n} 項通過`);
} finally { await h.close(); }
process.exit(0);
