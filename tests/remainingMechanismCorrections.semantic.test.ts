import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {MIGRATED_5016_MECH_SOUL_KIT:mars}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
  const {MIGRATED_5019_TIWAZ_SOUL_KIT:odin}=await h.server.ssrLoadModule('/src/data/migrated5019TiwazSoulKit.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {resourceDefenseOperations}=await h.server.ssrLoadModule('/src/blocks/ops/resourceDefenses.ts');
  const {evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
  const guard=mars.kit.find((e:any)=>e.order===102),runes=odin.kit.filter((e:any)=>[1,2].includes(e.order));
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{
    const archive=mars.kit.filter((e:any)=>[4,8,103].includes(e.order));
    for(const e of [guard,...runes,...archive]){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(w as any,e));}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),[guard,...runes,...archive]);
  }finally{w.dispose();r.dispose();}
  for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    const soul={...mars,name:'可編輯首次防護',effectMode:'kit',kit:[structuredClone(guard)]};
    const hit=h.kitSkill('多筆傷害',[{op:'dmg',p:{flat:1000,type:'固定'}},{op:'dmg',p:{flat:1000,type:'固定'}},{op:'dmg',p:{flat:1000,type:'真實'}}]);
    const run=async(guarded:boolean,barrier:number)=>h.play(side,{self:h.unit('防護方',100000,[h.wait()],{extra:{shield:10000,barrier,...(guarded?{soulMark:soul}:{})}}),opp:h.unit('攻擊方',100000,[hit])});
    const [base]=await run(false,10000),[protectedHit]=await run(true,10000);
    const total=(e:any)=>e.currentHp+(e.shield||0)+(e.barrier||0);
    assert.equal(total(protectedHit.self)-total(base.self),500,'兩筆固定傷害僅首筆減半，真傷不減');
    const [missing]=await run(true,0),[noResource]=await run(false,0);
    assert.equal(total(missing.self),total(noResource.self),'缺護罩不得減傷');
    const again=await h.play(side,{self:h.unit('防護方',100000,[h.wait()],{extra:{shield:10000,barrier:10000,soulMark:soul}}),opp:h.unit('攻擊方',100000,[hit])},2);
    assert.equal(total(again[0].self)-total(again[1].self),2500,'下回合重新提供一次減傷');
    const skillList=()=>Array.from({length:5},(_,i)=>({...h.wait(),name:'槽'+i}));
    const runeSoul={...odin,name:'可編輯槽符文',effectMode:'kit',kit:structuredClone(runes)};
    const snapshots:any[]=[];
    const history=await h.play(side,{self:h.unit('符文來源',100000,skillList(),{extra:{soulMark:runeSoul}}),opp:h.unit('符文對手',100000,skillList()),turns:(engine:any,t:number)=>{
      const st=engine.getState();snapshots.push(structuredClone({self:st[side].skills,opp:st[other].skills}));
      if(t===3){st[side].skills[4].skillRune=undefined;st[other].skills[4].skillRune=undefined;}
      return [t===1?0:1,t===1?0:1];
    }},3);
    // 引擎回合開始在雙方選招後，第一輪附加不能追溯激活已完成的選招。
    assert.deepEqual(snapshots[1].self.map((s:any)=>s.skillRune),['ᚨ','ᛉ','ᚱᚷ','ᛇ','ᛖ']);
    assert.deepEqual(snapshots[1].opp.map((s:any)=>s.skillRune),['ᛈ','ᛁ','ᚦᚺ','ᚾ','ᛃ']);
    assert.ok(snapshots[1].self.every((s:any)=>s.isRuneActive===false));
    assert.ok(snapshots[1].opp.every((s:any)=>s.isRuneActive===false));
    assert.equal(history[1].self.skills[1].isRuneActive,true,'附加後合法選招才激活自身所選槽');
    assert.equal(history[1].opp.skills[1].isRuneActive,true,'敵方所選槽於敵方選招激活');
    assert.equal(history[1].self.skills[0].isRuneActive,false,'未再次選擇的槽不能提前激活');
    assert.equal(history[2].self.skills[4].skillRune,undefined,'第三回合不補符文');
    assert.equal(history[2].opp.skills[4].skillRune,undefined);
    for(const first of [side,other,undefined])for(const neg of [false,true])assert.equal(evalCond({actor:side,getPlayerState:()=>first} as any,{c:'first_move',p:{neg}} as any,{} as any),!!first&&((first===side)!==neg));
    const archiveSoul={...mars,name:'可編輯異常檔案',effectMode:'kit',kit:structuredClone(mars.kit.filter((e:any)=>[4,8,103].includes(e.order)))};
    const statusHit=h.kitSkill('依序異常',[{op:'status',p:{side:'opp',status:'凍傷',turns:3,chance:100}},{op:'status',p:{side:'opp',status:'燒傷',turns:3,chance:100}}]);
    const owner=()=>h.unit('解析持有者',100000,[{...h.wait(),charge:5}],{extra:{soulMark:archiveSoul}});
    const ar=await h.play(side,{self:owner(),selfBench:[h.unit('接替者',100000,[h.wait()])],opp:h.unit('異常來源',100000,[statusHit]),turns:(_e:any,t:number)=>[t===2?{switch:1}:0,0]},2);
    assert.ok(!h.statuses(ar[0].self).includes('凍傷'),'第一種異常即解析免疫');
    assert.ok(h.statuses(ar[0].self).includes('燒傷'),'每回合第二種新異常不能解析');
    assert.equal(ar[0].self.skills[0].charge,6,'一種記錄恢復一點充能');
    assert.ok(!h.statuses(ar[1].self).includes('凍傷'),'場下記錄持有者免疫己方在場隊員');
    const bench=ar[1].state[side+'Team'].find((e:any)=>e.id==='解析持有者');
    assert.equal(bench.skills[0].charge,7,'場下原持有者仍獲得充能，不加給接替者');
    for(const def of [mars,odin])for(const hp of [900,2900,3000]){
      const order=def===mars?7:5;
      const healing={...def,name:'等量恢復',effectMode:'kit',kit:structuredClone(def.kit.filter((e:any)=>e.order===order))};
      const [result]=await h.play(side,{self:h.unit('恢復持有者',hp,[h.wait()],{maxHp:3000,extra:{soulMark:healing}}),opp:h.unit('不同上限對手',9000,[h.wait()])});
      const actual=Math.min(1000,3000-hp);
      assert.equal(result.self.currentHp,hp+actual);
      assert.equal(result.opp.currentHp,9000-actual,'等量採實際恢復，不能改用對手最大體力或溢出請求量');
    }
  }
  // 完全免疫不得消耗首次；同回合多次注入亦只能實際使用一次。
  const state:any={},elf:any={id:'owner',shield:10,barrier:10};
  const ctx:any={actor:'p1',self:elf,roundNumber:1,getFullTeam:()=>[elf],getPlayerState:(k:string)=>state[k],setPlayerState:(k:string,v:any)=>state[k]=v};
  const op=resourceDefenseOperations(()=>{}).damage_reduce_first,p={id:'editable',ratio:.5,types:['non_true'],resources:['shield','barrier']};
  const comp:any={isIncoming:true,damageCategory:'fixed',base:100,multiplier:1,decreasePercent:0};
  op(ctx,p,{event:{data:comp}} as any);comp.decreasePercent=1;comp.beforeFinalDamage.forEach((f:any)=>f());assert.deepEqual(state,{});
  console.log('首次減傷、敵我符文附加/選招激活/期限、先後手反向與Blockly往返通過');
}finally{await h.close();}
