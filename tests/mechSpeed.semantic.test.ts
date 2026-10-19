import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {MIGRATED_5016_MECH_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
  const entries=source.kit.filter((e:any)=>[9,10,11].includes(e.order));
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{
    for(const e of entries){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(w as any,e));}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),entries);
  }finally{w.dispose();r.dispose();}
  const soul=(mode:string,orders:number[])=>({...source,name:'任意極速持有者',effectMode:'kit',kit:[{
    codeId:'effect_sequence',source:'soulmark',role:'innate',node:'on_entered',order:0,customText:'模式測試',
    params:{clause:{raw:'模式測試',trig:'entrance',parsed:true,body:[{acts:[{op:'mech_combo',p:{mech:mode},label:'模式'}]}]}},
  },...structuredClone(entries.filter((e:any)=>orders.includes(e.order)))]});
  for(const side of ['p1','p2'] as const){
    for(const mode of ['極速','毀滅'])for(const speedStage of [0,1]){
      const [v]=await h.play(side,{
        self:h.unit('降能力持有者',100000,[{...h.wait(),category:'物理',power:30}],{speed:300,statStages:{speed:speedStage},extra:{soulMark:soul(mode,[10])}}),
        opp:h.unit('降能力受方',100000,[h.wait()],{speed:100}),
      });
      assert.equal(v.opp.statStages.atk??0,mode==='極速'?speedStage>0?-2:-1:0);
      assert.equal(v.opp.statStages.accuracy??0,mode==='極速'?speedStage>0?-2:-1:0);
    }
    // 附加固定傷害不算攻擊傷害，不能多觸發一次降能力。
    const [fixed]=await h.play(side,{
      self:h.unit('固定傷害持有者',100000,[h.kitSkill('固定測試',[{op:'dmg',p:{type:'固定',v:100}}])],{speed:300,extra:{soulMark:soul('極速',[10])}}),
      opp:h.unit('固定傷害受方',100000,[h.wait()],{speed:100}),
    });
    assert.equal(fixed.opp.statStages.atk??0,0);
    // 速度較低者靠極速+2超過對手+1；毀滅模式不能殘留加值。
    for(const mode of ['極速','毀滅']){
      const [v]=await h.play(side,{
        self:h.unit('先制持有者',100000,[h.wait()],{speed:100,extra:{soulMark:soul(mode,[9])}}),
        opp:h.unit('先制對手',100000,[{...h.wait(),priority:1}],{speed:300}),
      });
      const actions=v.logs.filter((l:string)=>l.includes('使用了'));
      assert.ok(actions.length>=2,JSON.stringify(v.logs));
      assert.ok(actions[0].includes(mode==='極速'?'先制持有者':'先制對手'),actions.join('\n'));
    }
    // 僅第一回合以第五槽帶出後手條款，其後改用不帶魂印的隊友，避免每回合刷新期限。
    const history=await h.play(side,{
      self:h.unit('後手持有者',100000,[h.wait()],{speed:100,extra:{soulMark:soul('極速',[11])}}),
      selfBench:[h.unit('期限觀測隊友',100000,[h.wait()],{speed:300})],
      opp:h.unit('先制期限對手',100000,[{...h.wait(),priority:1}],{speed:200}),
      turns:(_engine:any,turn:number)=>turn===2?[{switch:1},0]:[0,0],
    },4);
    // 觀測對手實際排序所用狀態，回合結束已扣除當回合。
    const timer=(v:any)=>v.state[`${side==='p1'?'p2':'p1'}RegistryState`]?.blkNoPosPrioTurns;
    // 引擎快照不公開 registry 時，仍以第3/4回合真實行動順序鎖定期限。
    for(const turn of [3,4]){
      const actions=history[turn-1].logs.filter((l:string)=>l.includes('使用了')).slice(-2);
      assert.ok(actions[0]?.includes(turn===3?'期限觀測隊友':'先制期限對手'),JSON.stringify({turn,actions,timer:timer(history[turn-1])}));
    }
  }
  const ctx:any={self:{statStages:{speed:1,atk:6}},target:{statStages:{speed:-1}},actor:'p1',targetSide:'p2'};
  assert.equal(evalCond(ctx,{c:'stage_value',p:{side:'self',stat:'speed',op:'高於',amount:0}},{}),true);
  assert.equal(evalCond(ctx,{c:'stage_value',p:{side:'opp',stat:'speed',op:'高於',amount:0}},{}),false);
  console.log('極速機甲：P1/P2模式限制、全屬性-1/-2、固定傷害排除、先制+2、下兩回合期限及Blockly通過');
}finally{await h.close();}
