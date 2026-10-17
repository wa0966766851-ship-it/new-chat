import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createHarness} from './helpers/migrationHarness';
import {activeEffectViews} from '../src/battle/activeEffectViews';
import {kitEntryIssue} from '../src/effects/effectConnection';
const h=await createHarness();
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {grantStatusImmunity}=await h.server.ssrLoadModule('/src/effects/elves/staged-arena/shared.ts');
const snapshots:any[]=[];let checks=0;
h.S.holder=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)grantStatusImmunity(ctx,ctx.actor,3);};
try{
  for(const side of ['p1','p2'] as const){
    const calm=h.kitSkill('施加平靜',[{op:'status',p:{side:'opp',status:'平靜',chance:100,turns:3}}]);
    assert.equal(kitEntryIssue(calm.kit[0]),null);
    const hist=await h.play(side,{self:h.unit('holder',100000,[calm,h.wait()]),opp:h.unit('foe',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},3);
    for(let i=0;i<3;i++){
      const s=hist[i].state,elf=s[side],reg=s[`${side}RegistryState`];
      assert.equal(elf.statusImmuneTurns,3,'重現舊顯示鏡像沒有遞減');
      assert.equal(reg.immuneStatusTurns,2-i,'真正判定欄位正常遞減');
      const guard=activeEffectViews(elf,s[`${side}Marks`],s[`${side}Timers`],reg).find(v=>v.semanticId==='status_guard');
      assert.equal(guard?.value,i===2?undefined:2-i,'畫面不再讀舊鏡像');
      assert.equal(h.statuses(hist[i].opp).includes('平靜'),i<2,'異常本身按期限移除');checks++;
    }
    const other=side==='p1'?'p2':'p1';
    snapshots.push({免疫:hist.map(r=>({elf:r.self,registryState:r.state[`${side}RegistryState`]})),平靜:hist.map(r=>({elf:r.opp,registryState:r.state[`${other}RegistryState`]}))});
  }
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const {StatusBadgePanel}=await h.server.ssrLoadModule('/src/components/StatusBadgePanel.tsx');
  const root=createRoot(document.getElementById('root')!);
  try{
    for(let i=0;i<snapshots.length;i++)for(const label of ['免疫','平靜']){
      const frames=snapshots[i][label];
      const render=async(index:number)=>act(async()=>root.render(React.createElement(StatusBadgePanel,{...frames[index],key:`${i}:${label}`})));
      await render(0);
      const badge=[...document.querySelectorAll('span[title]')].find(n=>n.textContent?.includes(label));assert.ok(badge,label);
      await act(async()=>badge.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
      assert.match(document.querySelector('.fixed.inset-0')?.textContent||'',/2回合/);
      await render(1);
      const text=document.querySelector('.fixed.inset-0')?.textContent||'';
      assert.match(text,/1回合/);assert.ok(!text.includes('2回合'),'詳情不能凍結在點擊當下');
      await render(2);assert.equal(document.querySelector('.fixed.inset-0'),null,'到期後詳情自動關閉');checks++;
    }
  }finally{await act(async()=>root.unmount());dom.window.close();}
  console.log(`effectCountdownDisplay: ${checks} P1/P2引擎及真實元件DOM情境通過`);
}finally{delete h.S.holder;await h.close();}
