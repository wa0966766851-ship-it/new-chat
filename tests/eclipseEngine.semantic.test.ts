import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import * as E from '../src/modes/interstellar/v2/engine';
import { EVENT_BY_ID } from '../src/modes/interstellar/v2/content';
import { RELIC_BY_ID } from '../src/modes/interstellar/v2/relics';

const pool = DEFAULT_ELVES;
function play(seed: number) {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed });
  assert.equal(run.scene.kind, 'draft');
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  assert.equal(run.team.length, 3);
  const trail: string[] = [];
  for (let step = 0; step < 400 && run.scene.kind !== 'end'; step++) {
    const sc = run.scene;
    trail.push(sc.kind);
    if (sc.kind === 'map') { const moves = E.movesFrom(run); assert.ok(moves.length, `act ${run.act} 有路可走`); run = E.moveTo(run, moves[0].id, pool); }
    else if (sc.kind === 'event') {
      if (sc.outcome) { run = E.backToMap(run); continue; }
      const ev = EVENT_BY_ID[sc.eventId]; const idx = ev.choices.findIndex(c => !c.require?.(run));
      run = E.chooseEvent(run, idx, pool);
    }
    else if (sc.kind === 'shop') { run = E.shopBuy(run, 0, pool); run = E.backToMap(run); }
    else if (sc.kind === 'rest') { run = sc.done ? E.backToMap(run) : E.restAction(run, 'mend'); }
    else if (sc.kind === 'treasure') { run = sc.done ? E.backToMap(run) : E.takeTreasure(run, sc.offer[0]); }
    else if (sc.kind === 'altar') { run = sc.done ? E.backToMap(run) : E.altarPact(run, 'dark'); }
    else if (sc.kind === 'recruit') { run = E.recruitFromOffer(run, sc.offer[0] ?? null, pool); }
    else if (sc.kind === 'prelude') {
      const b = E.startBattle(run, pool, `b${step}`); assert.ok(b, '可開戰');
      assert.ok(b!.p2.length >= 1 && b!.p2.every(e => e.calculatedStats.hp > 0));
      run = E.settleBattleV2(b!.run, `b${step}`, 'p1', b!.p1, pool);
      assert.equal(run.scene.kind, 'reward');
    }
    else if (sc.kind === 'reward') {
      if (sc.reward.relicChoices[0] && !sc.reward.relicTaken) run = E.takeRewardRelic(run, sc.reward.relicChoices[0]);
      run = E.leaveReward(run, pool);
    }
  }
  return { run, trail };
}
const a = play(12345), b = play(12345), c = play(999);
assert.equal(a.run.scene.kind, 'end'); assert.equal((a.run.scene as any).result, 'victory', '全勝路線可通關六章');
assert.equal(a.run.act, 6);
assert.deepEqual(a.trail, b.trail, '同種子同路線完全重現');
assert.notDeepEqual(a.trail, c.trail, '不同種子不同局');
assert.ok(a.run.relics.every(id => RELIC_BY_ID[id]), '遺物皆有定義');
assert.ok(a.run.stats.bosses === 6);
// 失敗首領＝滅團
let r = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: ['no_potions'], startingShards: 0, seed: 7 });
assert.equal(r.potions, 1, '禁藥令藥劑 −2');
if (r.scene.kind === 'draft') for (const id of r.scene.offer.slice(0, 3)) r = E.toggleDraft(r, id);
r = E.confirmDraft(r, pool);
const first = E.movesFrom(r).find(n => n.kind === 'combat')!; r = E.moveTo(r, first.id, pool); assert.equal(r.scene.kind, 'prelude');
const bt = E.startBattle(r, pool, 'x')!;
assert.ok(Math.min(...bt.p2.map(e => e.maxHp)) > 2 * Math.max(...bt.p1.map(e => e.maxHp)), '一般遭遇體力 >2 倍玩家');
const maps = [1, 2, 3, 4].map(s => E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 0, seed: s }).map);
assert.ok(new Set(maps.map(m => m.nodes.length)).size > 1, '每局路網不同');
assert.ok(maps.every(m => m.nodes.length >= 30), '路網夠複雜');
const dead = bt.p1.map(e => ({ ...e, currentHp: 0 }));
const lost = E.settleBattleV2(bt.run, 'x', 'p2', dead, pool);
assert.equal((lost.scene as any).result, 'wiped');
assert.equal(E.settleBattleV2(lost, 'x', 'p1', dead, pool), lost, '已結算不重複');
console.log(`星蝕回廊引擎：六章通關、種子重現、滅團結算通過（${a.trail.length} 步，遺物 ${a.run.relics.length}）`);
