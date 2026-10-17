import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import * as E from '../src/modes/interstellar/v2/engine';

/**
 * 失敗判定：原 bug＝只看「整隊有沒有人活著」，出戰名單全滅但待命／倉庫還有人時，既不結算敗北，
 * 也無法再開戰（startBattle 回傳 null）——流程卡在「戰敗撤離」。這支測試只用舊 API，可對照修前版本重現。
 */
const pool = DEFAULT_ELVES;
const alive = (e: any) => e.currentHp > 0;
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

/** 地圖第一場一般遭遇的迎戰前局面；extra＝額外隊員數（進待命、倉庫） */
function setup(seed: number, extra: number, kind: 'combat' | 'boss' = 'combat') {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  const node = E.movesFrom(run).find(n => n.kind === 'combat')!; run = E.moveTo(run, node.id, pool);
  assert.equal(run.scene.kind, 'prelude');
  const more = E.bannablePool(pool).filter(e => !run.team.some(t => t.id === e.id)).slice(0, extra).map((e, i) => ({ ...e, battleId: `ex-${i}`, currentHp: e.maxHp, maxHp: e.maxHp }) as any);
  run = { ...run, team: [...run.team, ...more] };
  if (kind === 'boss' && run.scene.kind === 'prelude') run = { ...run, scene: { kind: 'prelude', encounter: { ...run.scene.encounter, kind: 'boss' } } };
  return run;
}
/** 開戰後以「p2 獲勝」結算，且出戰者全部倒下 */
function lose(run: E.RunV2, winner = 'p2') {
  const id = 'b-test', b = E.startBattle(run, pool, id); assert.ok(b, '可開戰');
  const fallen = b!.p1.map(e => ({ ...e, currentHp: 0 }));
  return { b: b!, next: E.settleBattleV2(b!.run, id, winner, fallen, pool) };
}

// 1. 原 bug：出戰名單全滅、待命／倉庫還有人 → 必須有明確結果（敗北，或補位後能再開戰），不得卡死
{
  const run = setup(21, 3);
  assert.equal(E.lineupOf(run).length, 3); assert.ok(E.storageOf(run).length + E.benchOf(run).length >= 3, '待命＋倉庫有人');
  const { next } = lose(run);
  assert.ok(next.team.some(alive), '尚有存活者');
  const decided = next.scene.kind === 'end' || (E.lineupOf(next).some(alive));
  assert.ok(decided, '失敗必須判定：出戰全滅時要由存活者補位（或結算敗北），不能留下一支打不了仗的出戰名單');
  assert.equal(next.scene.kind, 'map', '仍有存活者：戰敗撤離回地圖');
  const move = E.movesFrom(next)[0]; const afterMove = E.moveTo(next, move.id, pool);
  if (afterMove.scene.kind === 'prelude') assert.ok(E.startBattle(afterMove, pool, 'b-next'), '補位後下一場戰鬥可以開打');
}
// 2. 全隊（含待命與倉庫）陣亡 → 敗北結算，記敗因，存檔標記為結算畫面
{
  const run = setup(22, 0); // 只有 3 隻，全在出戰
  const { next } = lose(run);
  assert.equal(next.scene.kind, 'end'); assert.equal((next.scene as any).result, 'wiped');
  assert.equal((next.scene as any).cause, 'wipe', '敗因：全隊陣亡');
  assert.ok(next.chronicle[0].includes('敗北'), '紀事寫入敗北');
  // 存檔：結算畫面寫進存檔（收起殘燭才清除）
  const b = E.startBattle(run, pool, 'b-store')!; const st2 = store(); st2.setItem(E.RUN_KEY_V2, JSON.stringify({ ...b.run, revision: 1 }));
  const after = E.settleStoredBattleV2(st2, run.runId, 'b-store', 'p2', b.p1.map(e => ({ ...e, currentHp: 0 })), pool)!;
  assert.equal(after.scene.kind, 'end'); assert.equal(E.loadRunV2(st2)!.scene.kind, 'end', '敗北結算已寫入存檔');
}
// 3. 首領戰敗＝失敗（即使仍有存活者），敗因為首領戰敗
{
  const run = setup(23, 3, 'boss');
  const { next } = lose(run);
  assert.equal(next.scene.kind, 'end'); assert.equal((next.scene as any).cause, 'boss');
}
// 4. 放棄首領戰（離開戰鬥）＝失敗，敗因記為放棄
{
  const run = setup(24, 2, 'boss');
  const b = E.startBattle(run, pool, 'b-exit')!;
  const next = E.settleBattleV2(b.run, 'b-exit', 'exit', b.p1, pool);
  assert.equal(next.scene.kind, 'end'); assert.equal((next.scene as any).cause, 'exit');
}
// 5. 一般遭遇戰敗、仍有存活者：不結算，蝕度 +6
{
  const run = setup(25, 3);
  const b = E.startBattle(run, pool, 'b-part')!;
  const hurt = b.p1.map((e, i) => ({ ...e, currentHp: i === 0 ? 0 : e.currentHp }));
  const next = E.settleBattleV2(b.run, 'b-part', 'p2', hurt, pool);
  assert.equal(next.scene.kind, 'map'); assert.equal(next.eclipse, run.eclipse + 6);
}
console.log('失敗判定：出戰全滅補位、全隊陣亡、首領戰敗、放棄、存檔結算通過');
