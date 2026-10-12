/** 只產生遷移候選清單，不修改卡牌、執行來源或測試證據。 */
import { createServer } from 'vite';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { describeExecution } = await server.ssrLoadModule('/src/blocks/audit.ts');
  const { effectDefinitionEntries } = await server.ssrLoadModule('/src/battle/effectSources.ts');
  const { distillEffect } = await server.ssrLoadModule('/src/effects/distillEffect.ts');
  const baseline = JSON.stringify(DEFAULT_ELVES);
  const rows = DEFAULT_ELVES.map((elf: any) => {
    const definitions = [
      ...effectDefinitionEntries(elf).map((definition: any) => ({ definition: definition.soul ? {...definition,kit:definition.kit ?? elf.kit} : definition,
        kind: 'soul', category:definition.kind, routeArgs: definition.soul ? {elf} : {trait:definition} })),
      ...[...(elf.skills || []),...(elf.skillPool || [])].filter((s,i,all)=>all.findIndex(t=>t.name===s.name && t.description===s.description)===i)
        .map((skill:any)=>({definition:skill,kind:'skill',category:'技能',routeArgs:{elf,skill}})),
    ];
    return { id:elf.id,name:elf.name,entries:definitions.map(({definition,kind,category,routeArgs}:any) => {
      const current = describeExecution(routeArgs), distilled = distillEffect(definition,kind);
      return { name:definition.name, category, original:definition.description || '',
        sourceSha256:createHash('sha256').update(definition.description || '').digest('hex'),
        currentSource:current.source,currentRoute:current.route,semanticVerification:'pending',
        conversionCandidate:distilled.complete, candidateKit:distilled.complete ? distilled.kit : [],
        partialDraftKit:distilled.complete ? [] : distilled.kit,
        convertedClauses:distilled.kit.length,unresolved:distilled.issues,
        requiredCases:['觸發及精確數值','條件／成功與失敗分支','雙側／持有者／場下','期限／清除／BOSS','傷害分類／免疫／護盾'],
      };
    }) };
  });
  assert.equal(JSON.stringify(DEFAULT_ELVES),baseline,'稽核不得改寫精靈');
  const entries=rows.flatMap((r:any)=>r.entries), summary={elves:rows.length,effectDefinitions:entries.length,
    activeAuthoredKitDefinitions:entries.filter((e:any)=>e.currentRoute === 'kit').length,
    conversionCandidates:entries.filter((e:any)=>e.conversionCandidate).length,
    blockedDefinitions:entries.filter((e:any)=>!e.conversionCandidate).length,
    unconnectedDefinitions:entries.filter((e:any)=>e.currentRoute!=='kit').length,
    unconnectedCandidates:entries.filter((e:any)=>e.currentRoute!=='kit'&&e.conversionCandidate).length,
    unconnectedBlockedDefinitions:entries.filter((e:any)=>e.currentRoute!=='kit'&&!e.conversionCandidate).length,
    semanticallyAccepted:0};
  assert.equal(summary.activeAuthoredKitDefinitions+summary.unconnectedDefinitions,summary.effectDefinitions);
  assert.equal(summary.unconnectedCandidates+summary.unconnectedBlockedDefinitions,summary.unconnectedDefinitions);
  // 同一份定義同一原因只計一次；一份可有多種阻擋，因此不能把原因筆數相加成精靈數。
  const reasonCounts = new Map<string, number>();
  for (const entry of entries.filter((e:any)=>!e.conversionCandidate)) {
    for (const reason of new Set<string>(entry.unresolved.map((issue:any)=>issue.reason)))
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const blockers = [...reasonCounts.entries()].map(([reason,definitions])=>({reason,definitions}))
    .sort((a,b)=>b.definitions-a.definitions || a.reason.localeCompare(b.reason));
  const cell=(text:string)=>text.replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
  writeFileSync('docs/audits/block-migration.json',JSON.stringify({schemaVersion:1,summary,blockers,elves:rows},null,2)+'\n');
  const taskBaseline=JSON.parse(readFileSync('docs/audits/block-migration-baseline-342.json','utf8'));
  assert.equal(taskBaseline.items.length,342);
  const queue=taskBaseline.items.map((item:any,index:number)=>{
    const elf=rows.find((row:any)=>row.id===item.elfId);
    const current=elf?.entries.find((entry:any)=>entry.name===item.name&&entry.category===item.category);
    const status=!current?'missing-source':current.sourceSha256!==item.sourceSha256?'source-changed':current.conversionCandidate?'candidate-unverified':'needs-definition';
    return {...item,index:index+1,status,currentRoute:current?.currentRoute,
      convertedClauses:current?.convertedClauses ?? 0,unresolved:current?.unresolved ?? [],requiredCases:current?.requiredCases ?? [],
      // 已接通入口不等於逐句驗收；這個腳本不能自行生成通過證據。
      semanticVerification:'pending'};
  });
  const queueSummary={total:342,needsDefinition:queue.filter((i:any)=>i.status==='needs-definition').length,
    candidateUnverified:queue.filter((i:any)=>i.status==='candidate-unverified').length,
    sourceChanged:queue.filter((i:any)=>i.status==='source-changed').length,missingSource:queue.filter((i:any)=>i.status==='missing-source').length,semanticallyAccepted:0};
  writeFileSync('docs/audits/block-migration-queue-342.json',JSON.stringify({schemaVersion:1,summary:queueSummary,items:queue},null,2)+'\n');
  writeFileSync('docs/audits/block-migration-queue-342.md',[
    '# 本批342份效果定義追蹤','',
    '固定任務開始時的342份來源；新增可轉換候選不移出本表，不將解析率當成實裝率。正常／失敗／P1P2／場下／期限及傷害分類均須有情境證據才可驗收。',
    `待補定義${queueSummary.needsDefinition}，候選待驗${queueSummary.candidateUnverified}，原文已變${queueSummary.sourceChanged}，來源缺失${queueSummary.missingSource}；本表未授予整份語意通過。`,'',
    '| # | ID | 精靈 | 效果 | 狀態 | 未解分支數 |','|---:|---|---|---|---|---:|',
    ...queue.map((item:any)=>`| ${item.index} | ${item.elfId} | ${cell(item.elfName)} | ${cell(item.name)} | ${item.status} | ${item.unresolved.length} |`),'',
    '逐句原文及問題詳見同名JSON，完整原文及部分積木草稿在block-migration.json；不將只有日誌或借用專屬handler的資料算成可用原子。','',
  ].join('\n'));
  writeFileSync('docs/audits/block-migration.md',[
    '# 全精靈積木遷移候選清單','',
    '本清單覆蓋魂印、所有特質、攜帶及去重後預備技能。只讀現行來源並產生候選資料；此腳本不改原文或切換執行來源。已遷移項目由reviewedSkillKits及測試證據另行控管。',
    '「可轉換」代表嚴格轉換器能表達整份效果，不等於與TXT相符、已逐句測試或戰鬥正確。專屬註冊表與未解析分支保留。詳見同名JSON的原句、來源、候選Kit與每一個阻擋原因。','',
    '| ID | 精靈 | 定義 | 可轉換候選 | 待補語意／原子 |','|---|---|---:|---:|---:|',
    ...rows.map((r:any)=>`| ${r.id} | [${cell(r.name)}](elves/${r.id}.md) | ${r.entries.length} | ${r.entries.filter((e:any)=>e.conversionCandidate).length} | ${r.entries.filter((e:any)=>!e.conversionCandidate).length} |`),'',
    `統計：${summary.elves}隻，${summary.effectDefinitions}份定義；候選${summary.conversionCandidates}，待補${summary.blockedDefinitions}；現行手動Kit定義${summary.activeAuthoredKitDefinitions}。候選與現行Kit可能重疊，不相加成進度；本清單不新增任何語意通過證據。`,'',
    '## 集中阻擋清單','',
    '同一份定義可有多個原因，下列數量不能相加作為完成率。既有handler可能已實作；這裡記錄的是未能完整轉成可編輯Kit，不等同未實裝。','',
    '| 阻擋原因 | 涉及定義 |','|---|---:|',
    ...blockers.map(({reason,definitions})=>`| ${cell(reason)} | ${definitions} |`),'',
    '## 遷移順序','',
    '1. 原文／TXT與持有者對照，拆成觸發、條件、目標、行為、固有／附加／攜帶及傷害分類。',
    '2. 完整候選先做正常、失效、雙側、下場、期限數值測試；不能靠候選數量推算正確率。',
    '3. 未完整候選先補通用容器／查詢／事件；專屬機制留在各精靈註冊表，不塞入BattleScreen。',
    '4. 所有原句有等價Kit與語意證據後才切換單一來源；保留原文與圖紙相容，驗證無重複執行。','',
  ].join('\n'));
  console.log(JSON.stringify(summary));
} finally {await server.close();}
