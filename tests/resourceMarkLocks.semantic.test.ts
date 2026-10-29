import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {resourceMarkLocked}=await h.server.ssrLoadModule('/src/effects/resourceMarkLocks.ts');
const {OPS}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(node:string,trig:string,acts:any[])=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,params:{clause:{raw:'印記遞減鎖測試',trig,parsed:true,body:[{acts}]}}});
const add=(side='self',id='resource',amount=4)=>a('resource_mark_add',{side,id,amount,name:'資源',displayChar:'層',unit:'層',scope:'elf',persistsOffField:true,description:'測試資源'});
const subtract=(side='self',id='resource')=>a('resource_mark_subtract',{side,id,scope:'elf',amount:1});
const lock=(turns:number,id='resource')=>a('mark_lock_turns',{id,turns});
const soul=(kit:any[])=>({name:'改名資源鎖',description:'印記遞減鎖測試',effectMode:'kit',kit});
const count=(r:any,side:string,id='resource',owner='S')=>r.state[`${side}Marks`].find((m:any)=>m.id===id&&m.ownerBattleId===owner)?.count||0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
try{
  await check('嚴格合約拒絕空識別碼、非正整數期限／減量、未知持有者或作用域',()=>{
    for(const act of [lock(1),subtract(),a('resource_mark_remove',{id:'resource',side:'self',scope:'elf'})])assert.equal(sequenceIssue(entry('on_entered','entrance',[act]).params.clause),null);
    for(const act of [lock(0),lock(1.5),lock(Infinity),lock(1,''),subtract('both'),{...subtract(),p:{...subtract().p,scope:'any'}},{...subtract(),p:{...subtract().p,amount:.5}},a('resource_mark_remove',{id:'resource',side:'self'})])assert.ok(sequenceIssue(entry('on_entered','entrance',[act]).params.clause));
  });
  await check('到期／尚未生效／同id不同battleId不能借鎖，全隊作用域明確共用',()=>{
    const ctx:any={actor:'p1',targetSide:'p2',self:{id:'same',battleId:'A'},target:{id:'same',battleId:'B'},p1Timers:[],p2Timers:[]};
    const timer={remaining:2,payload:{block:{markLock:{id:'resource'}}},scope:'elf',ownerBattleId:'A'};
    for(const t of [{...timer,remaining:0},{...timer,pendingActivation:true},{...timer,ownerBattleId:'C'}]){ctx.p1Timers=[t];assert.equal(resourceMarkLocked(ctx,'p1','resource'),false);}
    ctx.p1Timers=[timer];assert.equal(resourceMarkLocked(ctx,'p1','resource'),true);assert.equal(resourceMarkLocked(ctx,'p1','other'),false);assert.equal(resourceMarkLocked(ctx,'p2','resource'),false);
    ctx.p2Timers=[{...timer,scope:'team'}];assert.equal(resourceMarkLocked(ctx,'p2','resource'),true);
  });
  await check('清空發出一次真實變動事件，再清空不重播',()=>{
    let mark:any={id:'resource',ownerBattleId:'S',count:4,name:'資源'};const events:any[]=[];
    const ctx:any={actor:'p1',targetSide:'p2',self:{id:'S'},target:{id:'E'},getFullTeam:(s:string)=>[{id:s==='p1'?'S':'E'}],getMarks:()=>mark?[mark]:[],clearMark:()=>{mark=null;},addLog:()=>{},emitElfEvent:(...e:any[])=>events.push(e)};
    assert.equal(OPS.resource_mark_remove(ctx,{id:'resource',side:'self',scope:'elf'}),true);assert.equal(events.length,1);assert.equal(events[0][3].before,4);assert.equal(events[0][3].after,0);
    assert.equal(OPS.resource_mark_remove(ctx,{id:'resource',side:'self',scope:'elf'}),false);assert.equal(events.length,1);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 一／二／九回合鎖包含當回合，期限結束後下一回合才遞減`,async()=>{
      for(const turns of [1,2,9]){
        const trait=soul([entry('on_entered','entrance',[add()]),entry('round_end','round_end',[subtract()])]);
        const rounds=Math.max(3,turns+1);
        const rows=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('可改名鎖',[lock(turns)]),h.wait()],{speed:50,extra:{trait}}),opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},rounds);
        assert.deepEqual(rows.map(r=>count(r,side)),Array.from({length:rounds},(_,i)=>Math.max(0,4-Math.max(0,i+1-turns))));
      }
    });
    await check(`${side} 對手側遞減也讀取鎖，另一資源照常減少，增加不被封鎖`,async()=>{
      const trait=soul([entry('on_entered','entrance',[add(),add('self','other')])]);
      const own=h.kitSkill('鎖並增加',[lock(1),add('self','resource',2)]),enemy=h.kitSkill('嘗試減少',[subtract('opp'),subtract('opp','other')]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[own],{speed:200,extra:{trait}}),opp:h.unit('E',10000,[enemy])});assert.equal(count(r,side),6);assert.equal(count(r,side,'other'),3);
    });
    await check(`${side} 換人後不借前一持有者的鎖，同名副本各自保有原層數`,async()=>{
      const trait=soul([entry('battle_start','battle_start',[add()]),entry('round_end','round_end',[subtract()])]);
      const rows=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('兩回合鎖',[lock(2)])],{extra:{trait}}),selfBench:[h.unit('S',10000,[h.wait()],{extra:{battleId:'B',trait}})],opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},2);
      assert.equal(count(rows[0],side),4);assert.equal(count(rows[1],side,'resource','B'),3);assert.equal(count(rows[1],side),4);
    });
  }
  console.log(`${checks} resource mark lock checks passed`);
}finally{await h.close();}
