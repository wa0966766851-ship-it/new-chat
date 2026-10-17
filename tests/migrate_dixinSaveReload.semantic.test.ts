// 5017 積木化終點站驗收：五招技能＋荒魂印的 P1/P2、原文保護、Blockly 畫布保存重載不丟參數。
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});(window as any).__BATTLE_FAST__=true;
const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
let checked=0;
try {
  const {MIGRATED_SEQUENCE_SKILL_KITS}=await server.ssrLoadModule('/src/data/migratedSequenceSkillKits.ts');
  const {MIGRATED_DIXIN_SKILL_KITS}=await server.ssrLoadModule('/src/data/migratedDixinSkillKits.ts');
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElves.ts');
  const {REVIEWED_SOUL_KITS}=await server.ssrLoadModule('/src/data/reviewedSoulKits.ts');
  const {kitEntryIssue}=await server.ssrLoadModule('/src/effects/effectConnection.ts');
  defineCustomBlocks();

  const dixin=(DEFAULT_ELVES as any[]).find((e:any)=>String(e.id)==='5017');
  const skillDefs=[
    ...MIGRATED_SEQUENCE_SKILL_KITS.filter((r:any)=>r.elfIds.includes('5017')),
    ...MIGRATED_DIXIN_SKILL_KITS,
  ];
  const soulDefs=REVIEWED_SOUL_KITS.filter((r:any)=>r.elfIds?.includes('5017'));
  assert.ok(skillDefs.length>=5,`5017 應有五招 Kit（實得 ${skillDefs.length}）`);
  assert.ok(soulDefs.length===1,'5017 應有荒魂印 Kit');

  // ── A. 技能：原文保護＋合約＋畫布往返 ──
  for(const row of skillDefs){
    const selected=[...dixin.skills,...(dixin.skillPool||[])].find((s:any)=>s.name===row.name);
    assert.ok(selected,`技能 ${row.name} 存在`);
    assert.equal(selected.description,row.description,`${row.name} 原文不覆寫`);
    assert.equal(selected.effectMode,'kit',`${row.name} 已切 kit 模式`);
    assert.deepEqual(selected.kit,row.kit,`${row.name} packed 資料與源碼一致`);
    for(const e of row.kit){assert.equal(kitEntryIssue(e),null,`${row.name} 條目 ${e.order} 無待接通`);validateKit([e]);}
    const ws=new Blockly.Workspace(),copy=new Blockly.Workspace();
    const roots=row.kit.map((e:any)=>buildEntryBlock(ws as any,e)!);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
    const restored=roots.map((b:any,i:number)=>createKitBlockParser('skill')(copy.getBlockById(b.id)!,row.kit[i].node,row.kit[i].order)!);
    assert.deepEqual(restored,row.kit,`${row.name} 畫布保存重載不丟參數`);
    ws.dispose();copy.dispose();checked++;
  }

  // ── B. 荒魂印：合約＋畫布往返（soul 解析器）──
  for(const row of soulDefs){
    assert.equal(dixin.soulMark?.name,row.name,'魂印名稱一致');
    assert.equal(dixin.soulMark?.effectMode,'kit','魂印已切 kit 模式');
    assert.deepEqual(dixin.soulMark?.kit,row.kit,'魂印 packed 資料與源碼一致');
    for(const e of row.kit){assert.equal(kitEntryIssue(e),null,`荒魂印條目 ${e.order} 無待接通`);validateKit([e]);}
    const ws=new Blockly.Workspace(),copy=new Blockly.Workspace();
    const roots=row.kit.map((e:any)=>buildEntryBlock(ws as any,e)!);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),copy);
    const restored=roots.map((b:any,i:number)=>createKitBlockParser('soulmark')(copy.getBlockById(b.id)!,row.kit[i].node,row.kit[i].order)!);
    assert.deepEqual(restored,row.kit,'荒魂印畫布保存重載不丟參數');
    ws.dispose();copy.dispose();checked++;
  }

  // ── C. P1/P2 實戰：真實 BattleScreen 跑一回合，雙側都不觸發「效果待接通」──
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const dummy=(id:string):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:1_000_000_000,maxHp:1_000_000_000,
    baseStats:{hp:100000,atk:100,def:10000,spatk:100,spdef:10000,speed:50},calculatedStats:{hp:1_000_000_000,atk:200,def:20000,spatk:200,spdef:20000,speed:50},statStages:{},skills:[
      {name:'打',category:'物理',type:'普通',power:60,pp:99,maxPp:99,isSureHit:true,description:''}]});
  for(const side of ['p1','p2']){
    const self=structuredClone(dixin);self.battleId='me-'+side;
    const enemy=dummy('foe-'+side);
    let driver:any;
    await act(async()=>root.render(React.createElement(Battle,{key:`dixin/${side}`,initialP1Team:[side==='p1'?self:enemy],initialP2Team:[side==='p2'?self:enemy],
      p1StarterId:side==='p1'?self.id:enemy.id,p2StarterId:side==='p2'?self.id:enemy.id,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
    await act(async()=>{const s=driver.getSyncState();driver.onSkillSelect('p1',s.p1.skills[0]);driver.onSkillSelect('p2',s.p2.skills[0]);});
    for(let i=0;i<150&&!(driver.getSyncState().turnNumber===2&&driver.getSyncState().phase==='p1_select');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20));});
    const s=driver.getSyncState();
    assert.equal(s.turnNumber,2,`5017 ${side} 側回合推進（實際 ${s.turnNumber}/${s.phase}）`);
    assert.ok(!s.logs.some((l:any)=>String(l.message||l.text||'').includes('效果待接通')),`${side} 側無待接通`);
    checked++;await act(async()=>root.render(React.createElement('div')));
  }
  console.log(`5017 五招＋荒魂印：原文保護／packed一致／畫布保存重載／P1P2實戰，${checked} 項通過。`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
