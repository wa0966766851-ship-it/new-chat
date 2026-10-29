import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import * as Blockly from '../src/vendor/blockly/index.js';
import { defineCustomBlocks, buildEntryBlock, createKitBlockParser } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { kitEntryIssue } from '../src/effects/effectConnection';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';
import type { KitEntry } from '../src/effects/effectSystem.schema';

// 自訂組合：低於半血才執行整组；不是替任何既存精靈捏造技能。
const combination: KitEntry[] = [{codeId:'condition_gate',node:'on_skill_use',source:'skill',role:'attached',order:0,
  customText:'體力低於一半：恢復70、降防1、中毒3；固定70、百分比10%、真實30；兩回合非真實減傷50%；全技能恢復7PP。',
  params:{hp_below:0.5,innerItems:[
    {atom:'heal',params:{target:'self',amount:70}},
    {atom:'stat_change',params:{target:'opponent',def:-1}},
    {atom:'apply_status',params:{target:'opponent',status:'中毒',duration:3,chance:100}},
    {atom:'extra_damage',params:{target:'opponent',amount:70,damageType:'fixed'}},
    {atom:'extra_damage',params:{target:'opponent',ratio:0.1,damageType:'percent'}},
    {atom:'extra_damage',params:{target:'opponent',amount:30,damageType:'true'}},
    {atom:'turn_effect_apply',params:{target:'self',duration:2,timerId:'combo-guard',timerName:'組合保護',tickAt:'round_end',applyMode:'gate',clearable:true,
      wrapItems:[{atom:'damage_reduce',params:{percent:50,damageTypes:['non_true']}}]}},
    {atom:'pp_op',params:{target:'self',op:'add',amount:7}},
  ]}}];
defineCustomBlocks();const ws=new Blockly.Workspace();const block=buildEntryBlock(ws as any,combination[0])!;
const loaded=new Blockly.Workspace();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),loaded);
const restoredKit=[createKitBlockParser('skill')(loaded.getBlockById(block.id)!,'on_skill_use')!];
validateKit(restoredKit);assert.equal(kitEntryIssue(restoredKit[0]),null);assert.equal(restoredKit[0].params.innerItems.length,8);
ws.dispose();loaded.dispose();
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(fn:any)=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});(window as any).__BATTLE_FAST__=true;
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
let checks=0;
try {
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const {getSoulMarkRegistry}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const {resetPrd}=await server.ssrLoadModule('/src/utils/prd.ts');
  const {getStatuses}=await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const wait={name:'組合驗收等待',type:'普通',category:'屬性',power:0,pp:10,maxPp:20,isSureHit:true,description:''};
  const make=(id:string,hp:number,speed:number):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:hp,maxHp:20000,
    baseStats:{hp:20000,atk:100,def:1000,spatk:100,spdef:1000,speed},calculatedStats:{hp:20000,atk:100,def:1000,spatk:100,spdef:1000,speed},statStages:{},skills:[{...wait}]});
  let driver:any;
  for(const side of ['p1','p2']) for(const mode of ['normal','condition-fails','sealed']) {
    const other=side==='p1'?'p2':'p1';const active=mode==='normal';const startHp=mode==='condition-fails'?16000:8000;
    const self={...make('combo-self',startHp,200),isCustom:true,isAdditionalInvalid:mode==='sealed',skills:[{...wait,name:'複合驗收技能',effectMode:'kit',kit:restoredKit},{...wait}]};
    // 真正圖紙匯出／匯入，確定巢狀參數仍進入戰鬥，而非只測記憶體物件。
    const restored=parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:self})).elf;assert.deepEqual(restored.skills[0].kit,restoredKit);
    // 圖紙匯入依法重算訓練能力；測傷害時另用固定戰鬥快照，避免把重算差異當成積木錯誤。
    const battleSelf={...self,skills:restored.skills};
    const enemy=make('combo-enemy',20000,100);enemy.skills=[{...wait,name:'混合反擊',effectMode:'kit',kit:[
      {codeId:'extra_damage',node:'on_skill_use',source:'skill',role:'attached',order:0,params:{amount:1000,damageType:'fixed',target:'opponent'}},
      {codeId:'extra_damage',node:'on_skill_use',source:'skill',role:'attached',order:1,params:{amount:100,damageType:'true',target:'opponent'}},
    ]}];
    const receipts:any[]=[];
    getSoulMarkRegistry()[enemy.name]=(_ctx:any,event:string,data:any)=>{if(event==='ON_DAMAGED'&&data.receipt)receipts.push(data.receipt);return false;};
    await act(async()=>root.render(React.createElement(Battle,{key:`${side}/${mode}`,initialP1Team:[side==='p1'?battleSelf:enemy],initialP2Team:[side==='p2'?battleSelf:enemy],
      p1StarterId:side==='p1'?battleSelf.id:enemy.id,p2StarterId:side==='p2'?battleSelf.id:enemy.id,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
    for(let turn=1;turn<=3;turn++) {
      resetPrd(()=>0);
      await act(async()=>{const state=driver.getSyncState();driver.onSkillSelect('p1',state.p1.skills[side==='p1'&&turn>1?1:0]);driver.onSkillSelect('p2',state.p2.skills[side==='p2'&&turn>1?1:0]);});
      for(let i=0;i<150&&!(driver.getSyncState().turnNumber===turn+1&&driver.getSyncState().phase==='p1_select');i++) await act(async()=>{await new Promise(r=>setTimeout(r,20));});
      const state=driver.getSyncState();assert.equal(state.turnNumber,turn+1,`${side}/${mode}/${turn} phase=${state.phase}; logs=${JSON.stringify(state.logs)}`);assert.equal(state.phase,'p1_select');
      const expected=startHp+(active?70:0)-(active?(turn===1?600:turn===2?1200:2300):1100*turn);
      assert.equal(state[side].currentHp,expected,`${side}/${mode}/回合${turn}：固定傷害前兩回合500、第三回合1000；真傷始終100，回血70只一次。`);
      assert.equal(state[other].statStages.def||0,active?-1:0);
      if(turn===1) {
        assert.equal(Number(getStatuses(state[other])['中毒']||0)>0,active);
        assert.equal(state[side].skills[0].pp,active?16:9,'本次出招消耗1，成功條件才給所有技能增加7');
        assert.equal(state[side].skills[1].pp,active?17:10);
        for(const [damageType,amount] of [['fixed',70],['percent',2000],['true',30]]) assert.equal(receipts.filter(r=>r.damageType===damageType&&r.settledAmount===amount).length,active?1:0,`${side}/${mode} ${damageType}不能換傷害類型或重播`);
      }
      checks++;
    }
    delete getSoulMarkRegistry()[enemy.name];
  }
  console.log(`八原子／巢狀條件／混合傷害／持續閘門：公開畫布存檔→圖紙→P1/P2正式戰鬥 ${checks} 回合情境通過。`);
} finally {await act(async()=>root.unmount());await server.close();dom.window.close();}
