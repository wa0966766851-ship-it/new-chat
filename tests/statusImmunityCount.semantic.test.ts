import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {kitEntryIssue} from '../src/effects/effectConnection';
import {activeEffectViews} from '../src/battle/activeEffectViews';
import {describeEffectMeta} from '../src/battle/effectViewModel';
import {statusCountClasses,statusCountAppearance} from '../src/battle/statusImmunityCount';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
let foeCtx:any,holderCtx:any,checks=0;
const snapshots:{side:'p1'|'p2';tone:string;state:any}[]=[];
h.S.foe=(ctx:any,t:any)=>{if(t===T.ON_ENTRANCE)foeCtx=ctx;};
h.S.holder=(ctx:any,t:any)=>{if(t===T.ON_ENTRANCE)holderCtx=ctx;};
// 2026-10-28 新色系：自身不保留＝黃、自身保留＝亮紅、己方全隊＝亮橘、反彈＝亮粉紅
// 純免疫（不反彈）→ 官方原色：自身切換消失＝黃、自身切換保留＝藍、己方全隊＝青
const modes=[
  {scope:'self',persistsOffField:false,tone:'yellow'},
  {scope:'self',persistsOffField:true,tone:'blue'},
  {scope:'team',persistsOffField:true,tone:'cyan'},
];
const skill=({tone,...p}:any)=>h.kitSkill('可編輯免疫',[{op:'immune_status_count',p:{count:2,...p}}]);
const views=(s:any,side:string)=>activeEffectViews(s[side],s[`${side}Marks`],s[`${side}Timers`],s[`${side}RegistryState`]).filter(v=>v.category==='count');
try{
  defineCustomBlocks();
  for(const mode of modes){
    const entry=skill(mode).kit[0];assert.equal(kitEntryIssue(entry),null);
    const w=new Blockly.Workspace(),w2=new Blockly.Workspace();
    try{const block=buildEntryBlock(w,entry)!;Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),w2);
      assert.deepEqual(createKitBlockParser('skill')(w2.getBlockById(block.id)!,entry.node,entry.order),entry);
    }finally{w.dispose();w2.dispose();}
  }
  for(const bad of [{scope:'opp'},{count:1.5},{persistsOffField:'false'},{scope:'team',persistsOffField:false}])assert.ok(kitEntryIssue(skill(bad).kit[0]));
  for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    for(const mode of modes){
      await h.play(side,{
        self:h.unit('holder',100000,[skill(mode),h.wait()]),
        selfBench:[h.unit('reserve',100000,[h.wait()])],
        opp:h.unit('foe',100000,[h.wait()]),
        turns:(e:any,t:number)=>{
          const s=e.getState();
          if(t===2){
            snapshots.push({side,tone:mode.tone,state:s});
            const v=views(s,side);assert.equal(v.length,1);assert.equal(v[0].value,2);assert.equal(v[0].tone,mode.tone);
            assert.ok(v[0].icon.startsWith('/seer/signbuff/'),'次數免疫使用專屬盾牌圖');
            assert.ok(statusCountClasses(v[0].tone).includes(`border-${mode.tone}`));
            assert.match(describeEffectMeta(v[0]),/下場後保留/);
            assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).immune,true);
            assert.equal(views(e.getState(),side)[0].value,1,'消耗即同步畫面');
            return [{switch:1},0];
          }
          if(t===3){
            assert.equal(s[side].id,'reserve');
            if(mode.scope==='team'){
              assert.equal(views(s,side)[0].value,1);assert.equal(views(s,side)[0].tone,'cyan');
              assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).immune,true);
              assert.equal(views(e.getState(),side).length,0,'全隊用完立即消失');
            }else assert.equal(views(s,side).length,0,'不把原持有者免疫借給隊友');
            assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).success,true);
          }
          if(t===4)return [{switch:0},0];
          if(t===5){
            assert.equal(s[side].id,'holder');
            if(mode.scope==='self'&&mode.persistsOffField){
              assert.equal(views(s,side)[0].value,1,'原持有者回場恢復原次數');
              assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).immune,true);
            }
            assert.equal(views(e.getState(),side).length,0);
            assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).success,true);
          }
          return [t===1||s[side].id==='reserve'?0:1,0];
        },
      },5);checks++;
      // 同一套 scoped counter 也支援反彈；被反彈者由引擎實際附加狀態。
      await h.play(side,{self:h.unit('holder',100000,[skill({...mode,reflect:true}),h.wait()]),opp:h.unit('foe',100000,[h.wait()]),
        turns:(e:any,t:number)=>{
          if(t===2){
            assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).immune,true);
            assert.ok(h.statuses(e.getState()[other]).includes('中毒'));
            assert.ok(!h.statuses(e.getState()[side]).includes('中毒'));
            assert.equal(views(e.getState(),side)[0].value,1);
            assert.equal(holderCtx.applyStatusWithImmunityCheck(side,'麻痺',3).immune,true,'自身施加也消耗免疫');
            assert.equal(views(e.getState(),side).length,0);
          }
          return [t===1?0:1,0];
        }},2);checks++;
    }
    await h.play(side,{self:h.unit('holder',100000,[skill({}),h.wait()]),opp:h.unit('foe',100000,[h.wait()]),turns:(e:any,t:number)=>{
      if(t===2){assert.equal(e.getState()[`${side}RegistryState`].blkImmuneStatusCount,2);assert.equal(views(e.getState(),side)[0].tone,'blue');}
      return [t===1?0:1,0];
    }},2);checks++;
    await h.play(side,{self:h.unit('holder',100000,[skill(modes[0]),h.wait()]),opp:h.unit('foe',100000,[h.wait()]),turns:(e:any,t:number)=>{
      if(t===3){assert.equal(views(e.getState(),side)[0].value,4,'兩次授予各2次，不能重複套用成8次');}
      return [t<3?0:1,0];
    }},3);checks++;
    const mixed=h.kitSkill('混合免疫',[
      {op:'immune_status_count',p:{count:1,reflect:true}},
      {op:'immune_status_count',p:{count:2,scope:'team'}},
    ]);
    await h.play(side,{self:h.unit('holder',100000,[mixed,h.wait()]),opp:h.unit('foe',100000,[h.wait()]),turns:(e:any,t:number)=>{
      if(t===2){
        assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).immune,true);
        assert.ok(h.statuses(e.getState()[other]).includes('中毒'),'反彈優先於純免疫');
        assert.equal(e.getState()[`${side}RegistryState`].blkReflectStatusCount,0);
        assert.equal(views(e.getState(),side).find(v=>v.tone==='cyan')?.value,2,'不多扣另一份免疫');
      }
      return [t===1?0:1,0];
    }},2);checks++;
    // 消耗順序（2026-10-28 規格，2026-11-15 補測）：反彈 → 單人 → 己方全隊最後；反彈型內也是單人先於全隊。
    const ordered=h.kitSkill('四種次數免疫',[
      {op:'immune_status_count',p:{count:1,scope:'team'}},
      {op:'immune_status_count',p:{count:1,scope:'team',reflect:true}},
      {op:'immune_status_count',p:{count:1,scope:'self',persistsOffField:false}},
      {op:'immune_status_count',p:{count:1,scope:'self',persistsOffField:true,reflect:true}},
    ]);
    await h.play(side,{self:h.unit('holder',100000,[ordered,h.wait()]),opp:h.unit('foe',100000,[h.wait()]),turns:(e:any,t:number)=>{
      if(t===2){
        const tones=()=>views(e.getState(),side).map(v=>v.tone).sort();
        assert.deepEqual(tones(),['cyan','orange','purple','yellow']);
        const spent:string[]=[];
        for(let i=0;i<4;i++){const before=tones();assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).immune,true);const after=tones();spent.push(before.find(x=>!after.includes(x))!);}
        assert.deepEqual(spent,['purple','orange','yellow','cyan'],'反彈（單人→全隊）→ 純免疫（單人→全隊）');
        assert.ok(!h.statuses(e.getState()[side]).includes('中毒'),'四次都沒中');
        assert.equal(foeCtx.applyStatusWithImmunityCheck(side,'中毒',3).success,true,'次數用完後照常附加');
      }
      return [t===1?0:1,0];
    }},2);checks++;
  }
  // 六種呈現（2026-11-16 最終更正）：純免疫三色＝原廠印記圖（60／100／179）；反彈三色＝自製換色盾牌（橘／紅／紫）。
  {
    const A=(team:boolean,retained:boolean,reflect:boolean)=>statusCountAppearance(team,retained,reflect);
    assert.deepEqual([A(true,true,false),A(false,false,false),A(false,true,false)].map(a=>[a.tone,a.icon]),[['cyan','/seer/signbuff/60.png'],['yellow','/seer/signbuff/100.png'],['blue','/seer/signbuff/179.png']]);
    const custom=[A(true,true,true),A(false,true,true),A(false,false,true)];
    assert.deepEqual(custom.map(a=>[a.tone,a.icon]),[['orange','/seer/signbuff/custom/次數免疫_盾_橘.png'],['purple','/seer/signbuff/custom/次數免疫_盾_紫.png'],['red','/seer/signbuff/custom/次數免疫_盾_紅.png']]);
    assert.ok(custom.every(a=>a.icon.startsWith('/seer/signbuff/custom/'))&&new Set(custom.map(a=>a.icon)).size===3,'反彈三型各有自製圖');
    assert.equal(new Set([true,false].flatMap(r=>[A(true,true,r),A(false,true,r),A(false,false,r)]).map(a=>a.icon)).size,6,'六張圖都不同');
    checks++;
  }
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const {StatusInspector}=await h.server.ssrLoadModule('/src/components/StatusInspector.tsx');
  const root=createRoot(document.getElementById('root')!);
  try{
    for(const {side,tone,state} of snapshots){
      await act(async()=>root.render(React.createElement(StatusInspector,{key:`${side}-${tone}`,state})));
      const click=async(text:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.firstChild?.textContent?.trim()===text);assert.ok(b,text);await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
      if(side==='p2')await click('P2');
      await click('次數類');
      const card=document.querySelector('article');assert.ok(card);
      assert.ok(card.className.includes(`border-${tone}`));
      assert.ok((card.querySelector('img')?.getAttribute('src')||'').startsWith('/seer/signbuff/'),'卡片使用專屬盾牌圖');
      assert.match(card.textContent||'',/2\s*次/);checks++;
    }
  }finally{await act(async()=>root.unmount());dom.window.close();}
  console.log(`statusImmunityCount: ${checks} P1/P2引擎情境及Blockly/合約通過`);
}finally{delete h.S.holder;delete h.S.foe;await h.close();}
