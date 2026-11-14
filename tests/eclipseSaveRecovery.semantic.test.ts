import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import * as E from '../src/modes/interstellar/v2/engine';
// 2026-11-14：版本更新後的舊存檔不得讓回廊卡死（失效場景／遺物／隊員、儲存空間不足、舊局備份累積）。
class MemStorage { m = new Map<string, string>(); quota = Infinity;
  get length() { return this.m.size; } key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; } removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { const used = [...this.m.entries()].reduce((n, [a, b]) => n + (a === k ? 0 : a.length + b.length), 0); if (used + k.length + v.length > this.quota) throw new Error('QuotaExceededError'); this.m.set(k, v); } }
const pool = DEFAULT_ELVES;
let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 42 });
if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
run = E.confirmDraft(run, pool);
const s = new MemStorage();
// 1) 舊版：引用已移除的事件與遺物、壞掉的隊員、不存在的節點
s.setItem(E.RUN_KEY_V2, JSON.stringify({ ...run, scene: { kind: 'event', eventId: '已移除的事件' }, relics: ['已移除的遺物', ...run.relics], team: [...run.team, null, { name: '壞資料' }], at: 'missing-node' }));
const loaded = E.loadRunV2(s)!;
assert.ok(loaded, '舊存檔仍能讀取');
assert.equal(loaded.scene.kind, 'map', '失效事件回到地圖');
assert.ok(!loaded.relics.includes('已移除的遺物'), '移除失效遺物');
assert.equal(loaded.team.length, run.team.length, '移除壞掉的隊員、保留原隊伍');
assert.ok(loaded.map.nodes.some(n => n.id === loaded.at), '位置修正到合法節點');
// 2) 舊局備份累積：恢復時只保留目前這局的備份
s.setItem(E.definitionSyncBackupKey('old-run-1'), 'x'.repeat(100)); s.setItem(E.definitionSyncBackupKey('old-run-2'), 'x'.repeat(100));
E.pruneRunBackups(s, loaded.runId);
assert.ok(![...s.m.keys()].some(k => k.includes('old-run')), '舊局備份被清除');
// 3) 儲存空間不足：寫入失敗不拋錯，局面仍回傳；清掉舊備份後能寫入就寫入
s.setItem(E.definitionSyncBackupKey('old-run-3'), 'x'.repeat(5000));
s.quota = JSON.stringify(loaded).length * 1.5 + 2000;
const saved = E.saveRunV2(s as any, { ...loaded, beans: loaded.beans + 1 });
assert.equal(saved.beans, loaded.beans + 1, '回傳新局面');
assert.equal(E.loadRunV2(s)!.beans, loaded.beans + 1, '清掉舊備份後成功寫入');
s.quota = 10;
assert.doesNotThrow(() => E.saveRunV2(s as any, { ...saved, beans: saved.beans + 1 }), '空間耗盡也不拋錯');
// 4) 恢復時定義同步失敗不卡死
const badPool = new Proxy([] as any[], { get(t, p) { if (p === 'find') throw new Error('新版資料不相容'); return (t as any)[p]; } });
s.quota = Infinity;
assert.ok(E.resumeRunV2(s as any, badPool as any), '同步失敗時沿用原存檔');
console.log('星蝕迴廊存檔容錯：失效引用修復、舊備份清理、空間不足、同步失敗 通過');
