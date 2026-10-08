import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
(window as any).__BATTLE_FAST__=true; (globalThis as any).__BATTLE_SEED__=713;
const {createRoot}=await import('react-dom/client'); const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
const wait:any={name:'技能石等待',description:'',category:'屬性',type:'普通',power:0,pp:20,maxPp:20,priority:-5,effectType:'none',effectDetail:''};
const make=(id:string):any=>({id,battleId:id,name:id,type:'普通',level:100,maxHp:100000,currentHp:80000,
  calculatedStats:{hp:100000,atk:1000,spatk:1000,def:1000,spdef:1000,speed:300},
  baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},statStages:{},effects:[],skills:[{...wait}]});
let checks=0,driver:any;
try {
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const {getSoulMarkRegistry}=await server.ssrLoadModule('/src/effects/battleEventRegistry.ts'); const souls=getSoulMarkRegistry();
  const {createSkillStone,PERFECT_SKILL_STONE_EFFECTS:effects}=await server.ssrLoadModule('/src/data/skillStones.ts');
  const {getStatuses}=await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const {getTypeMatchup}=await server.ssrLoadModule('/src/utils/statCalculator.ts');
  const {handleWuxuSoulMark}=await server.ssrLoadModule('/src/effects/elves/wuxu/registry.ts');
  const play=async(side:string,self:any,enemy:any,bench?:any)=>{
    const team=[enemy,...(bench?[bench]:[])];
    await act(async()=>root.render(React.createElement(Battle,{key:checks,initialP1Team:side==='p1'?[self]:team,
      initialP2Team:side==='p2'?[self]:team,p1StarterId:side==='p1'?self.id:enemy.id,p2StarterId:side==='p2'?self.id:enemy.id,
      battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
    const turn=driver.getSyncState().turnNumber;
    await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
    for(let i=0;i<400&&driver.getSyncState().turnNumber===turn;i++)await act(async()=>{await new Promise(r=>setTimeout(r,10));});
    assert.equal(driver.getSyncState().turnNumber,turn+1,`${side}實際回合結算`);
    checks++; return driver.getSyncState();
  };
  for(const side of ['p1','p2']) for(const fx of effects) {
    const other=side==='p1'?'p2':'p1',self=make(`技能石-${side}-${fx.id}`),enemy=make(`受擊-${side}-${fx.id}`),bench=make('場下');
    bench.type='草'; const stone=createSkillStone(fx.targetAttribute||'草','S','特殊',true,fx.id);
    stone.priority=10; stone.isSureHit=true; self.skills=[{...stone,pp:12},{...wait,pp:10}]; self.alienTraits={gen2Trait:{name:'投石者',description:''}};
    const receipts:any[]=[],main:any[]=[];
    souls[enemy.name]=(c:any,ev:string,data:any)=>{if(ev==='ON_DAMAGED')receipts.push(data.receipt);return false;};
    souls[self.name]=(_c:any,ev:string,data:any)=>{if(ev==='ON_SKILL_HIT')main.push(data);return false;};
    const state=await play(side,self,enemy,bench),final=state[side];
    assert.equal(final.skills[0].name,stone.name,'SS不覆寫原技能'); assert.equal(final.skills[0].pp,fx.detail==='restore_all_pp_1'?12:11,'PP+10只一次，沒有99');
    assert.equal(main.length,1); assert.equal(main[0].skill.power,240,'實際出手轉化為SS');
    const amount=main[0].settledDamage;
    const benchAfter=state[`${other}Team`][1]; assert.equal(benchAfter.currentHp,80000-Math.floor(amount*.25*getTypeMatchup(stone.type,bench.type)),'場下按傷害及個別克制結算');
    if(fx.type==='status') {
      const {canonicalStatusName}=await server.ssrLoadModule('/src/effects/statusIdentity.ts');
      assert.ok(getStatuses(state[other])[canonicalStatusName(fx.detail.split(':')[0])] > 0,`${side}/${fx.id}附加成功 ${JSON.stringify({ statuses: getStatuses(state[other]), effects: state[other].effects, logs: state.logs })}`);
    } else if(fx.type.startsWith('stat')) {
      const who=fx.type==='stat_up'?final:state[other];
      for(const entry of fx.detail.split(',')){const [,stat,value]=entry.match(/^(\w+)([+-]\d+)$/)!;assert.equal(who.statStages[stat],Number(value),`${fx.id}能力變化一次`);}
    } else if(fx.detail==='add_damage_200') assert.equal(receipts.find(r=>r.damageType==='fixed')?.settledAmount,200,'原版龍石固定傷害');
    else if(fx.detail==='restore_all_pp_1') assert.equal(final.skills[1].pp,11);
    else if(fx.detail==='reduce_opp_pp_1') assert.equal(state[other].skills[0].pp,18,'被削PP後正常出手再扣1');
    delete souls[enemy.name];delete souls[self.name];
  }
  // 真正墜星魂印／四石神話：檢查 PP 不扣、不疊加，並測控制與弱化免疫。
  for(const side of ['p1','p2']) {
    const other=side==='p1'?'p2':'p1',self=make(`zhuixing-${side}`),enemy=make('神話對手');self.name='無序.墜星';
    self.skills=['電','超能','神秘','自然'].map(a=>({...createSkillStone(a,'S','特殊',true,effects.find((e:any)=>e.targetAttribute===a).id,'project'),pp:12,priority:10}));
    const attack:any[]=[];
    souls[self.name]=(c:any,ev:string,data:any)=>{if(ev==='ON_SKILL_HIT')attack.push(data);return handleWuxuSoulMark(c,ev,data);};
    souls[enemy.name]=(c:any,ev:string)=>{if(ev==='ON_ENTRANCE'){c.applyStatChange(c.targetSide,{atk:-2});c.applyStatusWithImmunityCheck(c.targetSide,'中毒',3);}return false;};
    const state=await play(side,self,enemy);
    assert.deepEqual(state[side].skills.map((s:any)=>s.pp),[12,12,12,12]);assert.equal(state[side].statStages.atk||0,0);
    assert.ok(!getStatuses(state[side])['中毒']);assert.ok(getStatuses(state[side])['神話']);
    assert.equal(attack.length,1);assert.ok(state[side].currentHp>=Math.min(100000,80000+25000+attack[0].settledDamage));
    assert.ok(state[`${other}RegistryState`].utilitySkillInvalidTurns>0);
    delete souls[self.name];delete souls[enemy.name];
  }
  for(const side of ['p1','p2']) for(const failure of ['miss','invalid','ppzero']) {
    const self=make(`失敗-${side}-${failure}`),enemy=make('失敗對手'),other=side==='p1'?'p2':'p1';
    self.skills=[{...createSkillStone('火','S','特殊',true,'attr_fire_burn'),accuracy:failure==='miss'?-1:100,pp:2}];
    const hits:any[]=[]; souls[self.name]=(c:any,ev:string,data:any)=>{if(ev==='ON_ENTRANCE'&&failure==='invalid')c.updateElf(c.actor,{isAdditionalInvalid:true});if(ev==='ON_SKILL_HIT')hits.push(data);return false;};
    if(failure==='ppzero') { self.skills=[{...createSkillStone('蟲','S','特殊',true,'attr_bug_pp'),priority:10,pp:12}];self.alienTraits={gen2Trait:{name:'投石者'}};enemy.skills=[{...wait,pp:1}]; }
    const state=await play(side,self,enemy);
    assert.ok(!getStatuses(state[other])['燒傷']);
    if(failure==='miss') assert.equal(hits.length,0);
    if(failure==='ppzero') assert.equal(state[`${other}RegistryState`].actionPreventedRound,state.turnNumber-1);
    delete souls[self.name];
  }
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
console.log(`技能石實際對戰：${checks} 場通過（27效果×P1/P2、真實墜星、失敗／失效／PP歸0）`);
