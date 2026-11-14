// 命運之輪 AI 選禁（2026-11-07）：實戰分數優先於等級、依雙方池子屬性對位禁用與選角、新精靈無紀錄時用等級先驗。
import assert from 'node:assert/strict';
import { aiBan, aiPick, draftValue } from '../src/utils/destinyDraftAi';
const e = (id: string, rank: string, type: string, extra: any = {}): any => ({ id, instanceId: `i_${id}`, name: id, destinyRank: rank, type, skills: [], ...extra });
const S = (rows: any[]) => new Map(rows.map(r => [r.id, r]));
// 一、實戰分數：場數多時以實戰為主；無紀錄用等級先驗
const strong = e('b1', 'B', '普通'), weakS = e('s1', 'S', '普通');
const stats = S([{ id: 'b1', games: 60, wins: 45, score: 0.72 }, { id: 's1', games: 60, wins: 15, score: 0.27 }]);
assert.ok(draftValue(strong, stats) > draftValue(weakS, stats), '實戰勝率高的 B 級價值高於勝率低的 S 級');
assert.equal(draftValue(e('new', 'A', '火'), stats), 64, '新精靈無紀錄：等級先驗');
// 二、禁用：對方池中最剋我方的精靈優先被禁（同價值時）
const own = [e('o1', 'A', '草'), e('o2', 'A', '草'), e('o3', 'A', '草')];
const theirs = [e('t1', 'A', '火'), e('t2', 'A', '水'), e('t3', 'A', '電'), e('t4', 'A', '普通')];
assert.equal(aiBan(theirs, own, 1, S([]))[0], 'i_t1', '火剋草：先禁火系');
// 三、選角：對方剩下草系多 → 優先選火系；屬性重複扣分
const mine = [e('m1', 'A', '火'), e('m2', 'A', '水'), e('m3', 'A', '普通'), e('m4', 'A', '普通'), e('m5', 'A', '普通'), e('m6', 'A', '普通'), e('m7', 'A', '普通')];
const foes = [e('f1', 'A', '草'), e('f2', 'A', '草'), e('f3', 'A', '草')];
const r = aiPick(mine, foes, 6, S([]));
assert.equal(r.pickedIds.length, 6); assert.ok(r.pickedIds.includes('i_m1'), '選入剋制對方的火系');
assert.equal(r.starterId, 'i_m1', '首發選對位最有利者');
// 四、被禁的不選
const r2 = aiPick(mine.map(x => x.id === 'm1' ? { ...x, isBanned: true } : x), foes, 6, S([]));
assert.ok(!r2.pickedIds.includes('i_m1'));
console.log('命運之輪 AI 選禁：實戰分數、等級先驗、對位禁用、剋制選角、首發、被禁排除 通過');
