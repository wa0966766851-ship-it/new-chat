// 效能重構護欄（黃金比對）：固定種子的重量級 6v6 整場，逐回合完整狀態雜湊必須與重構前錄製的基準完全一致。
// 基準檔 tests/fixtures/perfGolden.json 錄自效能重構（perf-1106）之前的 fix-1106 程式碼。
// 更新基準：UPDATE_PERF_GOLDEN=1 node --import tsx tests/perfGolden.semantic.test.ts（只有確定「戰鬥行為本來就該改變」時才可更新）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SEEDED_SCENARIOS, createSeededRunner } from './helpers/seededBattle';

const baselinePath = new URL('./fixtures/perfGolden.json', import.meta.url);
const runner = await createSeededRunner();
const results: any[] = [];
for (const sc of SEEDED_SCENARIOS) results.push((await runner.run(sc)).result);
await runner.close();

if (process.env.UPDATE_PERF_GOLDEN === '1') {
  fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2) + '\n');
  console.log('已更新黃金基準', results.map(r => `${r.name}:${r.turnsPlayed}回合`).join(' '));
} else {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  assert.equal(baseline.length, SEEDED_SCENARIOS.length, '基準與情境數量一致');
  for (const [i, sc] of SEEDED_SCENARIOS.entries()) {
    assert.ok(results[i].turnsPlayed >= 10, `${sc.name} 至少打滿 10 回合（實際 ${results[i].turnsPlayed}），否則基準沒有代表性`);
    assert.deepEqual(results[i], baseline[i], `${sc.name}：整場結果（逐回合完整狀態雜湊、日誌、勝負）必須與重構前一致`);
    console.log(`✓ ${sc.name}：${results[i].turnsPlayed} 回合、${results[i].logCount} 筆日誌，逐回合狀態雜湊與基準一致`);
  }
}
process.exit(0);
