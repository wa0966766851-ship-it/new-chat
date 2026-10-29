import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 defineCustomBlocks();
 for(const [id,name] of [['5035','龍神·御天陣'],['arena_13','鋒毫浸血雨']]){
  const source=h.find(id,name);assert.equal(source.effectMode,'kit');
  for(const entry of source.kit){
   assert.equal(kitEntryIssue(entry),null,entry.customText);
   const w=new Blockly.Workspace(),r=new Blockly.Workspace();
   try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],entry.node,entry.order),entry);
   }finally{w.dispose();r.dispose();}
  }
 }
 const rain=(orders:number[])=>{const s=structuredClone(h.find('arena_13','鋒毫浸血雨'));s.kit=s.kit.filter((e:any)=>orders.includes(e.order));s.power=1;return s;};
 const attack={...h.wait(),name:'普通攻擊',category:'物理',power:1};
 for(const side of ['p1','p2'] as const){
  for(const first of [true,false]){
   const run=async(boosted:boolean)=>{
    let settled=0;
    h.S['御天威力受方']=(c:any,ev:string,d:any)=>{if(ev==='AFTER_DAMAGE'&&d.damageType==='skill_attack')settled+=d.receipt.settledAmount;};
    const s=structuredClone(h.find('5035','龍神·御天陣'));s.kit=s.kit.filter((e:any)=>[0,1,...(boosted?[10]:[])].includes(e.order));s.power=boosted?100:first?250:400;
    await h.play(side,{self:h.unit('威力測試',9000,[s],{speed:400}),opp:h.unit('御天威力受方',100000,[{...h.wait(),priority:first?-10:10}])});
    delete h.S['御天威力受方'];return settled;
   };
   assert.equal(await run(true),await run(false),first?'先手100威力提升150%=250':'後手加成翻倍=400威力');
  }
  const hit=await h.play(side,{self:h.unit('血雨持有者',8000,[rain([0,1]),attack],{speed:400}),opp:h.unit('血雨受方',30000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},3);
  assert.equal(hit[0].self.currentHp,8000,'當次不消耗');assert.equal(hit[1].self.currentHp,4000,'下回合命中消耗目前體力半數');assert.equal(hit[2].self.currentHp,4000,'不延續至第三回合');
  const base=await h.play(side,{self:h.unit('基準',8000,[{...rain([0]),name:'基準技能'},attack],{speed:400}),opp:h.unit('基準受方',30000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.equal(base[1].opp.currentHp-hit[1].opp.currentHp,4000,'消耗等量以百分比傷害正式扣血');
  const miss={...attack,isSureHit:false,alwaysHit:false,accuracy:0};
  const missed=await h.play(side,{self:h.unit('未命中持有者',8000,[rain([0,1]),miss,attack],{speed:400}),opp:h.unit('未命中受方',30000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:t===2?1:2,0]},3);
  assert.equal(missed[2].self.currentHp,8000,'未命中不消耗且不得留到再下一回合');
  const pressure=await h.play(side,{self:h.unit('壓制持有者',9000,[rain([0,3]),h.wait()],{speed:400}),opp:h.unit('壓制受方',30000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},3);
  for(const key of ['atk','spatk','speed']){assert.equal(pressure[0].opp.statStages[key],-1);assert.equal(pressure[1].opp.statStages[key],-2);assert.equal(pressure[2].opp.statStages[key],-2);}
  const fallback=await h.play(side,{self:h.unit('後備持有者',9000,[rain([0,3]),h.wait()],{speed:400}),opp:h.unit('已達下降下限',30000,[attack],{statStages:{atk:-6,spatk:-6,speed:-6}}),turns:(_e:any,t:number)=>[t===1?0:1,0]},5);
  assert.ok(fallback[0].self.currentHp<9000,'後備不封當回合攻擊');
  assert.equal(fallback[3].self.currentHp,fallback[0].self.currentHp,'每回合失敗各延後2回合，覆蓋第二至四回合');
  assert.ok(fallback[4].self.currentHp<fallback[3].self.currentHp,'後備封印自然到期');
  h.S['未能使用者']=(ctx:any,ev:string)=>{if(ev==='ROUND_START'&&ctx.roundNumber===2)ctx.applyStatusWithImmunityCheck(ctx.actor,'疲憊',1);};
  const interrupted=await h.play(side,{self:h.unit('未能使用者',9000,[rain([0,3]),h.wait()],{speed:400}),opp:h.unit('中斷受方',30000,[attack]),turns:(_e:any,t:number)=>[t===1?0:1,0]},5);
  assert.equal(interrupted[1].opp.statStages.atk,-1,'無法使用技能時不下降');
  assert.equal(interrupted[3].self.currentHp,interrupted[1].self.currentHp,'未能使用的回合亦須在回合末建立下2回合封印');
  assert.ok(interrupted[4].self.currentHp<interrupted[3].self.currentHp);delete h.S['未能使用者'];
  const normal=await h.play(side,{self:h.unit('未擊敗測試',9000,[rain([0,5])],{speed:400}),opp:h.unit('可下降受方',30000,[h.wait()])});
  assert.equal(normal[0].opp.statStages.def,-1);
  const other=side==='p1'?'p2':'p1';assert.ok(!(normal[0].state[`${other}Timers`]||[]).some((t:any)=>t.payload?.block?.lockSwitch),'下降成功不能封鎖切換');
 }
 console.log('四個死鍵已替換：P1/P2正式威力、下回合命中消耗/等量傷害/未命中到期、2回合壓制與回合末失敗封印、未擊敗條件及Blockly保存重載通過');
}finally{await h.close();}
