/** 全來源工作清單。分類僅供排程，不把 regex 分類、handler 或 parsed 當語意驗收。 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { digest, isPresentationOnly, clauseIdentity, normalizeSourceText } from './lib/effectAudit';

const families: Array<{id:string;name:string;pattern:RegExp;deliverable:string}> = [
  {id:'events',name:'時點／成功失敗／事件',pattern:/時|每次|未觸發|觸發成功|消除成功|命中|結束|無效|擊敗/,deliverable:'明確事件、成敗因果與前置／即時快照；正式節點雙側測試'},
  {id:'duration',name:'期限／次數／場下',pattern:/回合|下\s*\d+次|背包|場下|下隻|登場|出戰|下場/,deliverable:'當回合／下回合、消耗、清除、持有者與場下銀行測試'},
  {id:'marks',name:'印記／狀態定義',pattern:/印記|層|每道|之禁|之浸|持有者|星護|星佑|星哲|星賜/,deliverable:'持有者自帶程式、查詢及生命周期；不得靠原精靈名稱回找'},
  {id:'damage',name:'傷害／吸取／公式',pattern:/傷害|威力|吸取|汲取|體力|反彈|抵擋|護盾|護罩|秒殺/,deliverable:'基數、傷害類別、公式、實際結算量、護盾與致死數值測試'},
  {id:'status',name:'異常／免疫／衍化',pattern:/異常|免疫|狀態|冰封|害怕|詛咒|睡眠|麻痺|疲憊|燒傷|中毒/,deliverable:'分類、命中／施加／免疫結果、期限、衍化及BOSS分支測試'},
  {id:'stats',name:'能力／視為／固有查詢',pattern:/能力|全屬性|攻擊|防禦|特攻|特防|速度|先制|必中|命中率|視為/,deliverable:'固有／附加／攜帶分離；查詢與AI預估一致；強化快照測試'},
  {id:'pp',name:'PP／攜帶／物品',pattern:/PP|攜帶|物品|道具/,deliverable:'實際扣除／恢復、槽身份、因果鏈、攜帶事件與保護測試'},
  {id:'advanced',name:'召喚／幻化／額外行動',pattern:/召喚|幻化|額外行動|鄰位|額外精靈|連續攻擊|連擊|重生|消逝/,deliverable:'獨立動作、身份、目標集合、死亡與重生正式引擎測試'},
];
const check=process.argv.includes('--check');
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try {
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {describeExecution}=await server.ssrLoadModule('/src/blocks/audit.ts');
  const {effectDefinitionEntries}=await server.ssrLoadModule('/src/battle/effectSources.ts');
  const {distillEffect}=await server.ssrLoadModule('/src/effects/distillEffect.ts');
  const {sequenceIssue}=await server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const {kitEntryIssue}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const definitions:any[]=[];
  const before=JSON.stringify(DEFAULT_ELVES);
  for(const elf of DEFAULT_ELVES) {
    const defs=[...effectDefinitionEntries(elf).map((d:any)=>({kind:'soul',category:d.kind,
      definition:d.soul?{...d,kit:d.kit??elf.kit}:d,args:d.soul?{elf}:{trait:d}})),
      ...[...(elf.skills||[]),...(elf.skillPool||[])].filter((s:any,i:number,all:any[])=>all.findIndex(t=>t.name===s.name&&t.description===s.description)===i)
        .map((s:any)=>({kind:'skill',category:'技能',definition:s,args:{elf,skill:s}}))];
    for(const {kind,category,definition,args} of defs) {
      const current=describeExecution(args),converted=distillEffect(definition,kind),seen=new Map<string,number>();
      const sourceHash=digest(definition.description||'');
      const clauses=current.program.clauses.map((c:any)=>{
        const normalized=normalizeSourceText(c.raw),occurrence=(seen.get(normalized)||0)+1;seen.set(normalized,occurrence);
        const id=clauseIdentity(String(elf.id),category,definition.name,c.raw,occurrence);
        const contextOnly=c.marker==='§'||isPresentationOnly(c.raw);
        const directIssue=c.parsed?sequenceIssue(c):'未完整分詞';
        const matching=converted.kit.filter((k:any)=>k.customText===c.raw);
        const contractIssue=matching.length&&matching.every((k:any)=>!kitEntryIssue(k))?null:directIssue;
        const tags=families.filter(f=>f.pattern.test(c.raw)).map(f=>f.id);
        const parentheses=[...c.raw.matchAll(/[（(]([^）)]*)[）)]/g)].map(m=>m[1]).filter(t=>/公式|\d|[+*×÷]|上限|下場|回合|每|傷害/.test(t));
        return {id,raw:c.raw,contextOnly,trigger:c.trig,conditions:c.cond||[],body:c.body,
          syntaxParsed:c.parsed,editableContract:!contextOnly&&c.parsed&&!contractIssue,contractIssue:contractIssue||null,
          unresolved:c.rest||[],families:tags.length?tags:['unclassified'],parentheticalSemanticsToReview:parentheses,
          verification:'pending',requiredCases:['精確觸發與數值','成敗／免疫／封印','P1與P2','期限／下場／清除','Blockly保存重載']};
      });
      definitions.push({id:`${elf.id}:${category}:${definition.name}:${sourceHash.slice(0,12)}`,elfId:String(elf.id),elfName:elf.name,
        name:definition.name,category,sourceText:definition.description||'',sourceSha256:sourceHash,currentRoute:current.route,
        conversionCandidate:converted.complete,conversionIssues:converted.issues,clauses,
        stage:current.route==='kit'?'connected-needs-verification':converted.complete?'ready-for-authored-migration':'needs-capability-or-grammar'});
    }
  }
  assert.equal(JSON.stringify(DEFAULT_ELVES),before,'規劃不得修改原始資料');
  const records=definitions.flatMap(d=>d.clauses),effects=records.filter(c=>!c.contextOnly);
  assert.equal(new Set(records.map(c=>c.id)).size,records.length,'每條來源必須有唯一身份');
  const unresolved=effects.filter(c=>!c.syntaxParsed);
  const groups=new Map<string,{fragment:string;clauseIds:string[]}>();
  for(const c of unresolved)for(const fragment of new Set<string>(c.unresolved.length?c.unresolved:[c.raw])){
    const key=normalizeSourceText(fragment);const group=groups.get(key)||{fragment,clauseIds:[]};group.clauseIds.push(c.id);groups.set(key,group);
  }
  const summary={elves:DEFAULT_ELVES.length,definitions:definitions.length,effectClauses:effects.length,contextRecords:records.length-effects.length,
    syntaxParsed:effects.filter(c=>c.syntaxParsed).length,syntaxUnparsed:unresolved.length,
    editableClauseContracts:effects.filter(c=>c.editableContract).length,
    activeKitDefinitions:definitions.filter(d=>d.currentRoute==='kit').length,
    unconnectedDefinitions:definitions.filter(d=>d.currentRoute!=='kit').length,
    uniqueUnresolvedFragments:groups.size,verifiedDefinitions:0};
  const familyTasks=families.map(f=>({id:f.id,name:f.name,deliverable:f.deliverable,
    unresolvedClauses:unresolved.filter(c=>c.families.includes(f.id)).length,
    affectedDefinitions:definitions.filter(d=>d.clauses.some((c:any)=>!c.contextOnly&&!c.syntaxParsed&&c.families.includes(f.id))).map(d=>d.id)}));
  const result={schemaVersion:1,note:'全來源規劃；分類可重疊且僅供排程，parsed與合約接受均不是語意驗收。0代表本清單不授予驗收，非戰鬥正確率。',summary,familyTasks,
    repeatedFragments:[...groups.values()].sort((a,b)=>b.clauseIds.length-a.clauseIds.length),definitions};
  const json=JSON.stringify(result,null,2)+'\n',file='docs/audits/semantic-completion-plan.json';
  mkdirSync('docs/audits',{recursive:true});
  if(check)assert.equal(readFileSync(file,'utf8'),json,'語意工作清單已過期，請重產');else writeFileSync(file,json);
  const md=['# 全來源語意完成計畫','',
    '本計畫包含魂印、特質、攜帶與預備技能。完整原文、稳定身份、每句Tokens、缺口與驗證清單見同名JSON。',
    '目標：所有有效原句均有無遺失的結構化語意；所有需要执行的語意均有等價通用入口、可編輯圖紙及情境證據。未支援仍明確阻擋。','',
    `來源：${summary.elves}隻／${summary.definitions}份定義／${summary.effectClauses}有效子句；${summary.syntaxParsed}已分詞，${summary.syntaxUnparsed}未完整分詞；${summary.uniqueUnresolvedFragments}種未解片段。`,
    `入口：${summary.activeKitDefinitions}份Kit，${summary.unconnectedDefinitions}份未完整遷移。此數字不是語意正確率。`,'',
    '## 執行順序','',
    '1. 先修資訊遺失與合約放行風險：括號公式、固有／附加分界、成敗快照、無讀取端鍵與印記外部回查。',
    '2. 拆解重複未解片段；只擴充有明確等價語意的句型，建立正例、反例與實際值測試。',
    '3. 按下面共用機制逐一補查詢、事件與容器；每機制驗完再擴到其他持有者。',
    '4. 整份定義全部句子閉合後才精確匹配來源並切換Kit；檢查舊路徑不重播與使用者自訂不受覆蓋。',
    '5. 雙側正式引擎、期限、場下、免疫／BOSS、封印及Blockly修改保存重載驗證；重產工作清單和稽核，保留所有剩餘分支。','',
    '| 工作族群 | 未解子句 | 涉及定義 | 交付條件 |','|---|---:|---:|---|',
    ...familyTasks.map(t=>`| ${t.name} | ${t.unresolvedClauses} | ${t.affectedDefinitions.length} | ${t.deliverable} |`),'',
    '族群可重疊，不能加總當作來源數；不分類的原句仍在JSON並必須個別處理。','',
    '## 成本與協作','',
    '整合者維護共用檔案；免費模型一次只接一個機制或兩份完整技能，先交具名Tokens與最小差異。優先使用既有DSH工具，工具不相容就回到本機實作，不反覆建橋接服務。',
    '代理輸出一律再核對來源和真實測試；只讀取、草稿、候選及失敗測試不計完成。','',
    '## 完成判準','',
    '- 全來源身份與原文指紋保持一致；每個有效子句可追溯到結構化Tokens；不靠note/noop/custom文字包裝清空未解析。',
    '- 通用合約只接受有真正執行或查詢端的參數，無未處理分支；純版式與說明單獨記錄。',
    '- 所有397份定義逐份關閉缺口，測試證據附覆蓋分支；在全部完成以前，計畫保持未完成。','',
    '更新：node --import tsx scripts/plan_semantic_completion.ts；核對：加 --check。',''].join('\n');
  if(check)assert.equal(readFileSync('docs/audits/semantic-completion-plan.md','utf8'),md);else writeFileSync('docs/audits/semantic-completion-plan.md',md);
  console.log(JSON.stringify(summary));
}finally{await server.close();}
