import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {NAIFEN_FORMS:forms,NAIFEN_FORM_IDS:ids}=await h.server.ssrLoadModule('/src/data/naifenItems.ts');
 const {battleItemProgramIssue,heldBattleItemProgramIssue}=await h.server.ssrLoadModule('/src/effects/battleItemProgram.ts');
 const {checkElfDead}=await h.server.ssrLoadModule('/src/battle/elfAlive.ts');
 const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 for(const f of forms){assert.equal(battleItemProgramIssue(f),null,f.name);assert.equal(heldBattleItemProgramIssue(f),null,f.name);}
 const grant=(i:number)=>e('取得指定形態','battle_start',[act(a('grant_item',{side:'self',itemId:ids[i],count:1}))],0,'soulmark');
 const soul=(i:number,other:any[]=[])=>({name:'實際道具測試',effectMode:'kit',kit:[grant(i),...other]});
 const status={battleStatuses:{失明:3},effects:[{id:'失明',name:'失明',duration:3,stacks:1}]};
 for(const side of ['p1','p2'] as const){
  const grow=h.kitSkill('增加體力上限',[a('stat_value',{side:'self',stats:['hp'],amount:100,direction:'increase',floor:1})]);
  const [max]=await h.play(side,{self:h.unit('S',10000,[grow],{extra:{soulMark:soul(0)}}),opp:h.unit('E',10000,[h.wait()])});
  assert.equal(max.self.maxHp,10000,'鉤形持有期間體力能力提升無效');
  const [hook]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{statStages:{atk:1},extra:{soulMark:soul(0)}}),opp:h.unit('E',10000,[h.wait()])});
  assert.ok((getStatuses(hook.self).沉睡||0)>0,'鉤形在正式節點監控能力提升且不遞迴');
  for(const abnormal of [false,true]){
   const [circle]=await h.play(side,{self:h.unit('S',1000,[h.healSkill(1000)],{maxHp:10000,speed:200,extra:{soulMark:soul(1),...(abnormal?status:{})}}),opp:h.unit('E',10000,[h.wait()])});
   assert.equal(circle.self.currentHp,abnormal?1500:1750,JSON.stringify({abnormal,logs:circle.logs,self:circle.self.currentHp,opp:circle.opp.currentHp}));assert.equal(circle.opp.currentHp,abnormal?9750:9813);
  }
  const [wind]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(2)}}),opp:h.unit('E',1000,[h.wait()],{maxHp:10000})});
  assert.equal(wind.self.currentHp,7500);assert.equal(wind.opp.currentHp,3500,'風車由對方吸取持有方，不反向');
  for(const type of ['固定','百分比','真實']){
   const hit=h.kitSkill('指定傷害',[a('dmg',{flat:100,type})]);
   const [bow]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(3)}}),opp:h.unit('E',10000,[hit])});
   assert.equal(bow.self.currentHp,type==='真實'?9900:9870);
  }
  const physical={...h.wait(),name:'普通物理',category:'物理',power:60},special={...physical,name:'普通特殊',category:'特殊'};
  for(const attack of [physical,special]){
   const fixture=(mark:any)=>({self:h.unit('S',10000,[h.wait()],{extra:mark?{soulMark:mark}:{}}),opp:h.unit('E',10000,[attack])});
   const [base]=await h.play(side,fixture(null)),[bow]=await h.play(side,fixture(soul(3)));
   const raw=10000-base.self.currentHp;assert.equal(10000-bow.self.currentHp,Math.floor(raw*(attack.category==='特殊'?2.5:1.3)));
  }
  const reduction=e('測試60%減傷','entrance',[act(a('dmg_mod_turns',{side:'self',dir:'in',kind:'非真實',reduce:.6,turns:5,next:false}))],1,'soulmark');
  const fixed=h.kitSkill('固定100',[a('dmg',{flat:100,type:'固定'})]);
  const [triangle]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(4,[reduction])}}),opp:h.unit('E',10000,[fixed])});
  assert.equal(triangle.self.currentHp,9900,'三角取消受方減免');
  const attackFixture=(mark:any)=>({self:h.unit('S',10000,[special],{speed:200,extra:mark?{soulMark:mark}:{}}),opp:h.unit('E',10000,[h.wait()])});
  const [plain]=await h.play(side,attackFixture(null)),[half]=await h.play(side,attackFixture(soul(4)));
  assert.equal(10000-half.opp.currentHp,Math.floor((10000-plain.opp.currentHp)/2),'選特殊攻擊的當回合輸出減半');
  const cap=e('測試傷害上限','entrance',[act(a('damage_cap_turns',{side:'self',dir:'in',kind:'非真實',cap:10,turns:5,next:false}))],1,'soulmark');
  const [moon]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(5,[cap])}}),opp:h.unit('E',10000,[fixed])});
  assert.equal(moon.self.currentHp,9900,'月形只令持有方受傷限制失效');
  for(const negative of [false,true]){
   const hit=h.kitSkill('降至正死亡線',[a('dmg',{type:'真實',flat:7000})]);
   const [star]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(6),...(negative?{survivalRule:{mode:'god_descent',active:true,preserveOffField:true,minHp:-700000,floorMult:70}}:{})}}),opp:h.unit('E',10000,[hit])});
   assert.equal(star.self.currentHp,3000);assert.equal(checkElfDead(star.self),!negative,'星形正死亡線不覆蓋負體力規則');
  }
  const consume=h.kitSkill('用完星形',[a('use_items_in_order',{side:'self',ids:[ids[6]]})]);
  const [zeroFloor]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(6),survivalRule:{mode:'freeze_at_zero',active:true,preserveOffField:true,minHp:0}}}),opp:h.unit('E',10000,[h.kitSkill('降到死亡線',[a('dmg',{type:'真實',flat:7000})])])});
  assert.equal(checkElfDead(zeroFloor.self),true,'零下限仍須套用30%死亡線，只有負下限排除');
  const [used]=await h.play(side,{self:h.unit('S',3500,[consume],{maxHp:10000,speed:200,extra:{soulMark:soul(6)}}),opp:h.unit('E',10000,[h.wait()])});
  assert.equal(used.self.currentHp,3000);assert.equal(checkElfDead(used.self),false,'消耗最後一株當下就解除死亡線，無永久殘留');
 }
 console.log('naifenForms passed: all seven actual held forms on P1/P2, recovery, damage classes, reduction/limit suppression and positive death line');
}finally{await h.close();}
