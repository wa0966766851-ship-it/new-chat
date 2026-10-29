import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import * as Blockly from '../src/vendor/blockly/index.js';
import { defineCustomBlocks, buildEntryBlock, createKitBlockParser } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';
import type { KitEntry } from '../src/effects/effectSystem.schema';

const action=(op:string,p:any)=>({op,p,label:op});
const combination:KitEntry={codeId:'effect_sequence',node:'on_skill_use',source:'skill',role:'attached',order:0,customText:'條件／消強成敗／混合傷害／下回合恢復',params:{clause:{
  raw:'驗收複合效果，不替任何精靈捏造原文',trig:'use',parsed:true,cond:[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:0.5},label:'半血以下'}],body:[
    {acts:[action('heal_flat',{amount:70})]},
    {acts:[action('stat_clear',{side:'opp',kind:'up'})]},
    {chain:'success',acts:[action('stat',{side:'opp',stats:['防禦'],v:-1})]},
    {chain:'fail',acts:[action('heal_flat',{amount:11})]},
    {acts:[action('dmg',{flat:23,type:'固定'}),action('dmg',{base:'最大體力',of:'opp',ratio:0.1,type:'百分比'}),action('dmg',{flat:17,type:'真實'})]},
    {acts:[action('timed',{turns:2,from:'next',trig:'round_start',body:[{acts:[action('heal_flat',{amount:41})]}]})]},
  ]}}};
defineCustomBlocks();const ws=new Blockly.Workspace();const b=buildEntryBlock(ws as any,combination)!;
const reload=new Blockly.Workspace();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
const restoredKit=[createKitBlockParser('skill')(reload.getBlockById(b.id)!,'on_skill_use')!];validateKit(restoredKit);
assert.deepEqual(restoredKit,[combination]);ws.dispose();reload.dispose();
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
  const wait={name:'驗收等待',type:'普通',category:'屬性',power:0,pp:20,maxPp:20,isSureHit:true,description:''};
  const make=(id:string,hp:number,speed:number):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:hp,maxHp:20000,
    baseStats:{hp:20000,atk:100,def:1000,spatk:100,spdef:1000,speed},calculatedStats:{hp:20000,atk:100,def:1000,spatk:100,spdef:1000,speed},statStages:{},skills:[{...wait}]});
  let driver:any;
  for(const side of ['p1','p2'])for(const mode of ['normal','clear-fails','boost-guarded','condition-fails','sealed']) {
    const other=side==='p1'?'p2':'p1',active=mode!=='condition-fails'&&mode!=='sealed',startHp=mode==='condition-fails'?16000:8000;
    const self={...make('sequence-self',startHp,200),isCustom:true,isAdditionalInvalid:mode==='sealed',skills:[{...wait,name:'正式連鎖驗收',effectMode:'kit',kit:restoredKit},{...wait}]};
    const imported=parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:self})).elf;
    const battleSelf={...self,skills:imported.skills};const enemy=make('sequence-enemy',20000,100);
    enemy.statStages={atk:mode==='clear-fails'?0:2,def:0};
    const receipts:any[]=[];getSoulMarkRegistry()[enemy.name]=(ctx:any,event:string,data:any)=>{
      if(event==='ON_ENTRANCE'&&mode==='boost-guarded')ctx.setPlayerState('statBoostUnclearableTurns',9);
      if(event==='ON_DAMAGED'&&data.receipt)receipts.push(data.receipt);return false;};
    await act(async()=>root.render(React.createElement(Battle,{key:`${side}/${mode}`,initialP1Team:[side==='p1'?battleSelf:enemy],initialP2Team:[side==='p2'?battleSelf:enemy],
      p1StarterId:side==='p1'?self.id:enemy.id,p2StarterId:side==='p2'?self.id:enemy.id,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
    for(let turn=1;turn<=4;turn++) {
      await act(async()=>{const state=driver.getSyncState();driver.onSkillSelect('p1',state.p1.skills[side==='p1'&&turn>1?1:0]);driver.onSkillSelect('p2',state.p2.skills[side==='p2'&&turn>1?1:0]);});
      for(let i=0;i<150&&!(driver.getSyncState().turnNumber===turn+1&&driver.getSyncState().phase==='p1_select');i++)await act(async()=>{await new Promise(r=>setTimeout(r,20));});
      const state=driver.getSyncState();assert.equal(state.turnNumber,turn+1,`${side}/${mode}/${turn} ${state.phase};${JSON.stringify(state.logs)}`);
      const initialHeal=70+(['clear-fails','boost-guarded'].includes(mode)?11:0);
      // 回合2/3開始各恢復41；回合1不啟用，回合4已到期。
      assert.equal(state[side].currentHp,startHp+(active?initialHeal+Math.min(turn-1,2)*41:0),`${side}/${mode}/回合${turn}`);
      assert.equal(state[other].currentHp,20000-(active?2040:0));
      assert.equal(state[other].statStages.def||0,active&&!['clear-fails','boost-guarded'].includes(mode)?-1:0);
      if(mode==='boost-guarded')assert.equal(state[other].statStages.atk,2,'不能消強仍保留原提升，也不接消除成功弱化');
      if(turn===1)for(const [damageType,amount]of [['fixed',23],['percent',2000],['true',17]])assert.equal(receipts.filter(r=>r.damageType===damageType&&r.settledAmount===amount).length,active?1:0,`${side}/${mode}/${damageType}正確一次`);
      checks++;
    }
    delete getSoulMarkRegistry()[enemy.name];
  }
  console.log(`明確連鎖公開畫布→圖紙→P1/P2正式戰鬥 ${checks} 回合通過（不是隨機不崩潰測試）。`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
