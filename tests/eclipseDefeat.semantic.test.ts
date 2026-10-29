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
// 2. 規則改變（2026-10-24 生命制：失敗＝生命歸 0，不再是全隊陣亡）：全隊倒下但生命夠 → 扣生命、全員 30% 體力復甦；生命不夠 → 敗北
{
  const run = setup(22, 0); // 只有 3 隻，全在出戰
  const { next: soft } = lose(run);
  assert.equal(soft.scene.kind, 'map'); assert.equal(soft.lives, run.lives - 3, '倒下 3 隻扣 3 命'); assert.ok(soft.team.every(alive), '全隊倒下但生命未歸 0：全員復甦');
  const { next } = lose({ ...run, lives: 3 });
  assert.equal(next.scene.kind, 'end'); assert.equal((next.scene as any).result, 'wiped');
  assert.equal((next.scene as any).cause, 'lives', '敗因：生命耗盡');
  assert.ok(next.chronicle[0].includes('敗北'), '紀事寫入敗北');
  // 存檔：結算畫面寫進存檔（收起殘燭才清除）
  const r3 = { ...run, lives: 3 };
  const b = E.startBattle(r3, pool, 'b-store')!; const st2 = store(); st2.setItem(E.RUN_KEY_V2, JSON.stringify({ ...b.run, revision: 1 }));
  const after = E.settleStoredBattleV2(st2, run.runId, 'b-store', 'p2', b.p1.map(e => ({ ...e, currentHp: 0 })), pool)!;
  assert.equal(after.scene.kind, 'end'); assert.equal(E.loadRunV2(st2)!.scene.kind, 'end', '敗北結算已寫入存檔');
}
// 3. 首領戰敗：依倒下數扣生命，回到迎戰前（不再直接失敗）；生命不夠才敗北
{
  const run = setup(23, 3, 'boss');
  const { next } = lose(run);
  assert.equal(next.scene.kind, 'prelude', '首領戰敗只扣生命，回迎戰前'); assert.equal(next.lives, run.lives - 3); assert.ok(next.team.some(alive), '尚有存活者');
  const fatal = lose({ ...run, lives: 3 }).next;
  assert.equal(fatal.scene.kind, 'end'); assert.equal((fatal.scene as any).cause, 'lives');
}
// 4. 放棄首領戰（離開戰鬥）：照扣倒下數（無人倒下則不扣），回迎戰前；生命歸 0 才失敗
{
  const run = setup(24, 2, 'boss');
  const b = E.startBattle(run, pool, 'b-exit')!;
  const next = E.settleBattleV2(b.run, 'b-exit', 'exit', b.p1, pool);
  assert.equal(next.scene.kind, 'prelude'); assert.equal(next.lives, run.lives, '無人倒下不扣生命');
  const hurt = b.p1.map((e, i) => ({ ...e, currentHp: i < 2 ? 0 : e.currentHp }));
  const next2 = E.settleBattleV2(b.run, 'b-exit', 'exit', hurt, pool);
  assert.equal(next2.scene.kind, 'prelude'); assert.equal(next2.lives, run.lives - 2, '放棄時倒下 2 隻扣 2 命');
  const dead = E.settleBattleV2({ ...b.run, lives: 2 }, 'b-exit', 'exit', hurt, pool);
  assert.equal(dead.scene.kind, 'end'); assert.equal((dead.scene as any).cause, 'lives');
}
// 5. 一般遭遇戰敗、仍有存活者：不結算，蝕度 +6，倒下 1 隻扣 1 命
{
  const run = setup(25, 3);
  const b = E.startBattle(run, pool, 'b-part')!;
  const hurt = b.p1.map((e, i) => ({ ...e, currentHp: i === 0 ? 0 : e.currentHp }));
  const next = E.settleBattleV2(b.run, 'b-part', 'p2', hurt, pool);
  assert.equal(next.scene.kind, 'map'); assert.equal(next.eclipse, run.eclipse + 6); assert.equal(next.lives, run.lives - 1);
}
console.log('失敗判定（生命制）：出戰全滅補位、全隊倒下復甦、首領戰敗／放棄只扣生命、生命歸 0 敗北、存檔結算通過');
