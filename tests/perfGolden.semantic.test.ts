// 效能重構護欄（黃金比對）：固定種子的重量級 6v6 整場，逐回合完整狀態雜湊必須與重構前錄製的基準完全一致。
// 基準檔 tests/fixtures/perfGolden.json 錄自效能重構（perf-1106）之前的 fix-1106 程式碼。
// 2026-11-14 重錄：11/06 之後已確認的行為修正（預設抗性、異常回合、存活窗口、符文激活等）使舊基準失效；以目前行為重錄，之後的效能重構仍以此為護欄。
// 2026-11-20 整合重錄：符文選招、珀妮額外行動與攻擊無效／抵擋改變對戰；測試內統一種子及時鐘。
// 2026-11-21 重錄：道具庫存新增共生循環／純粹暗影兩鍵、下次攻擊增傷計時器補顯示名稱；日誌雜湊、回合數與勝負皆不變，只有狀態形狀改變。
// 2026-11-21 第二次重錄：異常附加日誌改寫實際結果（被抗性擋下時寫「抵抗了【X】」，不再寫成陷入）；回合數、勝負與行為不變，只有該類日誌文字改變。
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
