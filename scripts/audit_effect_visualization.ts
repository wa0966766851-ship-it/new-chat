import { writeFileSync } from 'node:fs';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import { auditEffectVisualization } from './lib/effectVisualizationAudit';
const report = auditEffectVisualization(DEFAULT_ELVES);
if(process.argv.includes('--write')) {
  writeFileSync('docs/audits/effect-visualization.json',JSON.stringify(report,null,2)+'\n');
  writeFileSync('docs/audits/積木可視化掃描_20261021.md',`# 積木可視化掃描\n\n${report.summary.elves} 隻精靈，${report.summary.definitions} 份定義，${report.summary.kitEntries} 個積木，${report.summary.parameterFields} 個參數欄位。\n\n全部欄位呈現：${report.summary.allFieldsVisible}；未接通定義：${report.summary.incompleteDefinitions}。\n\n掃描原文／魂印／特質／攜帶與替換技能，所有陣營、數量、回合、次數、條件、否則、到期、抵擋後及規則子流程均從原資料遞迴呈現。效果工作室「節點畫布」右側新增樹狀積木編輯；既有拖曳畫布及進階 JSON 保留。修改需通過原本 validateKit／kitEntryIssue 才能套用，未接通草稿依舊禁止覆寫完整效果。\n\n此為參數樹呈現覆蓋，不是戰鬥正確率；semanticAccuracy=null。自動化 DOM 與序列化測試另見 tests/effectVisualTree.semantic.test.tsx。\n`);
}
console.log(JSON.stringify(report.summary,null,2));
if(!report.summary.allFieldsVisible || report.summary.incompleteDefinitions)process.exitCode=1;
