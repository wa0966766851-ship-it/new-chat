import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {readMarkStacks,markChancePercent}=await h.server.ssrLoadModule('/src/effects/markQueries.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(node:string,trig:string,body:any[])=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,params:{clause:{raw:'當下印記層數',trig,parsed:true,body}}});
const add=(amount:number,extra:any={})=>a('resource_mark_add',{id:'query_resource',name:'測試資源',side:'self',scope:'elf',displayChar:'層',unit:'層',description:'可編輯逐層資源',persistsOffField:true,amount,...extra});
const trait=(kit:any[])=>({name:'可編輯資源',description:'當下印記層數',effectMode:'kit',kit});
const reduction={kind:'攻擊',ratio:.1,perStack:true};
const kit=[entry('on_entered','entrance',[{acts:[add(2,{incomingDamageReduction:reduction})]}]),entry('before_damage','outgoing_attack',[{acts:[a('dmg_mod',{dir:'out',kind:'攻擊',boost:.05,perMark:{side:'self',id:'query_resource'}})]}])];
const hit=()=>({...h.wait(),name:'普通攻擊',category:'物理',power:100});
const setBase=(ctx:any,e:any,d:any)=>{const c=d?.damageComp||d;if(e===T.BEFORE_DAMAGE&&!c.isIncoming&&c.damageCategory==='skill_attack')c.base=1000;};
h.S.S=setBase;h.S.E=setBase;
try{
  await check('逐層查詢／資源減傷嚴格合約，不吞未知欄位或未讀取分類',()=>{
    for(const e of kit)assert.equal(sequenceIssue(e.params.clause,e.node),null);
    const clause=(act:any)=>entry('on_entered','entrance',[{acts:[act]}]).params.clause;
    for(const r of [{kind:'真實',ratio:.1,perStack:true},{kind:'攻擊',ratio:2,perStack:true},{kind:'攻擊',ratio:.1},{...reduction,handler:'custom'}])assert.ok(sequenceIssue(clause(add(2,{incomingDamageReduction:r}))));
    for(const q of [{side:'both',id:'x'},{side:'self',id:''},{side:'self',id:'x',callback:'x'}])assert.ok(sequenceIssue(entry('before_damage','outgoing_attack',[{acts:[a('dmg_mod',{dir:'out',kind:'攻擊',boost:.05,perMark:q})]}]).params.clause));
    for(const p of [{side:'self',id:'x',pct:-1},{side:'self',id:'x',pct:101},{side:'both',id:'x',pct:3}])assert.ok(sequenceIssue(entry('before_damage','outgoing_attack',[{cond:[{c:'mark_chance',p}],acts:[a('damage_floor',{side:'opp',base:'最大體力',ratio:1})]}]).params.clause));
  });
  await check('同名不同battleId層數不混，逐層機率0／99／102封頂100且按最新值讀取',()=>{
    let count=33;const ctx:any={actor:'p1',targetSide:'p2',self:{id:'same',battleId:'A'},target:{id:'same',battleId:'B'},getMarks:()=>[{id:'x',count,ownerBattleId:'A'},{id:'x',count:999,ownerBattleId:'B'}]};
    assert.equal(readMarkStacks(ctx,{side:'self',id:'x'}),33);assert.equal(markChancePercent(ctx,{side:'self',id:'x',pct:3}),99);count=34;assert.equal(markChancePercent(ctx,{side:'self',id:'x',pct:3}),100);count=0;assert.equal(markChancePercent(ctx,{side:'self',id:'x',pct:3}),0);
  });
  let edited:any[]=[];
  await check('同elf.id不同battleId不共用機率連敗計數；逐層機率不偷用另一持有者',async()=>{
    const {evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
    const {preservePrd,resetPrd,snapshotPrd}=await h.server.ssrLoadModule('/src/utils/prd.ts');const restore=preservePrd();
    try{resetPrd(()=>.9999);
      const ctx:any={actor:'p1',targetSide:'p2',self:{id:'same',battleId:'A'},target:{id:'E',battleId:'E'},getMarks:()=>[{id:'x',count:1,ownerBattleId:'A'},{id:'x',count:1,ownerBattleId:'B'}]};
      const c={c:'mark_chance',p:{side:'self',id:'x',pct:3}},st:any={last:null,lastAmount:0};
      assert.equal(evalCond(ctx,c,st),false);assert.equal(evalCond(ctx,c,st),false);ctx.self={id:'same',battleId:'B'};assert.equal(evalCond(ctx,c,st),false);
      const counters=snapshotPrd();assert.deepEqual(counters.map(([,n]:any)=>n),[2,1]);assert.ok(counters[0][0].includes(':A:'));assert.ok(counters[1][0].includes(':B:'));
    }finally{restore();}
  });
  await check('Blockly修改減傷比例、逐層增傷比例與印記識別碼保存重載',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{for(const e of kit){const slot=w.newBlock('custom_node_slot');slot.setFieldValue(e.node,'TARGET_NODE');const child=buildEntryBlock(w as any,e as any)!;assert.ok(child);slot.getInput('STACK')!.connection!.connect(child.previousConnection!);}
      for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));if(op==='resource_mark_add'){p.id='edited';p.incomingDamageReduction.ratio=.2;}if(op==='dmg_mod'){p.perMark.id='edited';p.boost=.1;}b.setFieldValue(JSON.stringify(p),'PARAMS');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);edited=r.getTopBlocks(false).map((slot:any,i:number)=>createKitBlockParser('soulmark')(slot.getInputTargetBlock('STACK'),slot.getFieldValue('TARGET_NODE'),i)!);for(const e of edited)assert.equal(sequenceIssue(e.params.clause,e.node),null);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 正式攻擊逐層增傷10%／受傷減20%，下一招增加層數後即時減40%`,async()=>{
      const extra=h.kitSkill('增加層數',[add(2)]);
      const hist=await h.play(side,{self:h.unit('S',100000,[hit(),extra],{speed:200,extra:{trait:trait(structuredClone(kit))}}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(hist[0].opp.currentHp,98900,hist[0].logs.join('\n'));assert.equal(hist[0].self.currentHp,99200);assert.equal(hist[1].self.currentHp,98600);assert.equal(hist[1].state[`${side}Marks`].find((m:any)=>m.id==='query_resource').count,4);
    });
    await check(`${side} 後手增加層數不提前減傷，增加後才可供下一次查詢`,async()=>{
      const extra=h.kitSkill('增加層數',[add(2)]);
      const hist=await h.play(side,{self:h.unit('S',100000,[h.wait(),extra],{speed:50,extra:{trait:trait(structuredClone(kit))}}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(hist[1].self.currentHp,98400);assert.equal(hist[1].state[`${side}Marks`].find((m:any)=>m.id==='query_resource').count,4);
    });
    await check(`${side} 對手側逐層查詢只讀当前目標，不借同id場下持有者10層`,async()=>{
      const outgoing=entry('before_damage','outgoing_attack',[{acts:[a('dmg_mod',{dir:'out',kind:'攻擊',boost:.05,perMark:{side:'opp',id:'query_resource'}})]}]);
      const setup=(count:number)=>trait([entry('battle_start','battle_start',[{acts:[add(count)]}])]);
      const [r]=await h.play(side,{self:h.unit('S',100000,[hit()],{extra:{trait:trait([outgoing])}}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:setup(3)}}),oppBench:[h.unit('E',100000,[h.wait()],{extra:{battleId:'B',trait:setup(10)}})]});assert.equal(r.opp.currentHp,98850,r.logs.join('\n'));
    });
    await check(`${side} Blockly改值後改名實行，增傷20%與受傷減40%只各算一次`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',100000,[hit()],{extra:{trait:{...trait(structuredClone(edited)),name:'改名資源'}}}),opp:h.unit('E',100000,[hit()])});assert.equal(r.opp.currentHp,98800,r.logs.join('\n'));assert.equal(r.self.currentHp,99400);
    });
    await check(`${side} 換人不借前持有者層數，場下同名副本仍維持自己的資源`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait(structuredClone(kit))}}),selfBench:[h.unit('S',100000,[hit()],{extra:{battleId:'B',trait:trait([kit[1]])}})],opp:h.unit('E',100000,[hit(),h.wait()]),turns:(_,t)=>[t===2?{switch:1}:0,t===3?1:0]},3);
      assert.equal(hist[1].self.currentHp,99000);assert.equal(hist[2].opp.currentHp,99000,hist[2].logs.join('\n'));
    });
    await check(`${side} 每層3%在34層達100%，攻擊保底仍經護盾；0層不保底，固定附加不借保底`,async()=>{
      for(const count of [0,34]){
        const floor=entry('before_damage','outgoing_attack',[{cond:[{c:'mark_chance',p:{side:'self',id:'query_resource',pct:3}}],acts:[a('damage_floor',{side:'opp',base:'最大體力',ratio:1})]}]);
        const setup=count?[entry('on_entered','entrance',[{acts:[add(count)]}])]:[];
        const atk={...hit(),effectMode:'kit',kit:h.kitSkill('附加固定',[a('dmg',{flat:200,type:'固定'})]).kit};
        const [r]=await h.play(side,{self:h.unit('S',100000,[atk],{extra:{trait:trait([...setup,floor])}}),opp:h.unit('E',100000,[h.wait()],{extra:{shield:110000}})});assert.equal(r.opp.currentHp,99800);assert.equal(r.opp.shield,count?10000:109000,r.logs.join('\n'));
      }
    });
    await check(`${side} 5層控制免疫按正式附加前查詢；4層仍可被控制、其他類型不誤攔`,async()=>{
      const guard=entry('before_status_apply','before_status',[{cond:[{c:'mark_count',p:{side:'self',id:'query_resource',op:'不低於',amount:5}}],acts:[a('status_guard',{cls:'控制類'})]}]);
      for(const count of [4,5]){
        const status=h.kitSkill('附加異常',[a('status',{side:'opp',status:'害怕',turns:2,chance:100}),a('status',{side:'opp',status:'中毒',turns:2,chance:100})]);
        const [r]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait([entry('on_entered','entrance',[{acts:[add(count)]}]),guard])}}),opp:h.unit('E',100000,[status])});assert.equal(h.statuses(r.self).includes('害怕'),count===4);assert.ok(h.statuses(r.self).includes('中毒'));
      }
    });
    await check(`${side} 既有魔王咒怨默认兩層减10%；明確新配置减40%覆蓋默认而不雙算`,async()=>{
      for(const ratio of [undefined,.2,0]){
        const start=entry('on_entered','entrance',[{acts:[add(2,{id:'demon_grudge',scope:'team',...(ratio!==undefined?{incomingDamageReduction:{kind:'攻擊',ratio,perStack:true}}:{})})]}]);
        const [r]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait([start])}}),opp:h.unit('E',100000,[hit()])});assert.equal(r.self.currentHp,ratio===undefined?99100:100000-1000*(1-ratio*2),r.logs.join('\n'));
      }
    });
    await check(`${side} 減傷分類只作用於宣告範圍，非真實範圍不減真傷；非逐層只算一次`,async()=>{
      for(const type of ['固定','百分比','真實','技能']){
        const attack=h.kitSkill('附加傷害',[a('dmg',{flat:100,type,...(type==='技能'?{elem:'普通'}:{})})]);
        const setup=entry('on_entered','entrance',[{acts:[add(4,{incomingDamageReduction:{kind:'非真實',ratio:.25,perStack:false}})]}]);
        const [r]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{trait:trait([setup])}}),opp:h.unit('E',100000,[attack])});assert.equal(r.self.currentHp,type==='真實'?99900:99925,r.logs.join('\n'));
      }
    });
  }
  console.log(`印記線性查詢及共同減傷：${checks}項通過`);
}finally{delete h.S.S;delete h.S.E;await h.close();}
