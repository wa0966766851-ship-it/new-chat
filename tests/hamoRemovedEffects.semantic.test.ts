import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {removedEffectOperations:ops}=await h.server.ssrLoadModule('/src/blocks/ops/removedEffects.ts');
  for(const boundary of ['round','owner','self-clear']){
    let saved:any;const updates:any[]=[];
    const ctx:any={actor:'p1',self:{battleId:'原持有者'},roundNumber:1,p1Timers:[],p2Timers:[],effectEventData:{sourceSide:boundary==='self-clear'?'p1':'p2',removedStages:{atk:3}},getPlayerState:()=>saved,setPlayerState:(_k:string,v:any)=>saved=v,getFullTeam:()=>[{battleId:ctx.self.battleId,currentHp:1000,statStages:{}}],updateElf:(_s:string,p:any)=>updates.push(p)};
    const p={key:'testSnapshot'};
    ops.removed_effects_arm(ctx,p);ops.removed_effects_capture(ctx,p,{});
    if(boundary==='round')ctx.roundNumber=2;
    if(boundary==='owner')ctx.self.battleId='另一持有者';
    assert.equal(ops.removed_effects_restore(ctx,p),false);assert.equal(updates.length,0,'跨回合、換持有者與自身清除不得還原');
  }
  defineCustomBlocks();
  for(const [name,colour] of [['逐波','藍色'],['燼世','紅色'],['纏根','綠色']]){
    const source=structuredClone(h.find('5035',name));
    source.kit=source.kit.filter((e:any)=>JSON.stringify(e).includes('removed_effects_'));
    assert.equal(source.kit.length,4);source.name='改名恢復技能';source.power=0;source.category='屬性';source.isSureHit=true;
    const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      for(const e of source.kit){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(ws as any,e));}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
      assert.deepEqual(reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}),source.kit);
    }finally{ws.dispose();reload.dispose();}
    for(const side of ['p1','p2'] as const)for(const before of [true,false])for(const held of [true,false]){
      h.S['恢復持有者']=(c:any,event:string)=>{if(event==='ON_ENTRANCE'){
        if(held)c.setMark({id:'hamo_scale_'+colour,name:'測試色鱗',displayChar:'鱗',count:1,ownerBattleId:c.self.battleId,scope:'elf'});
        c.setPlayerState('restoreMirror',7);
        c.addTimerTo(c.actor,{id:'待恢復效果',name:'待恢復效果',remaining:4,kind:'turn_effect',source:'skill',tickAt:'round_end',payload:{mirrorRegistryKeys:['restoreMirror'],block:{immuneStatus:true}}},false);
      }};
      const clear=h.kitSkill('對手消除',[{op:'stat_clear',p:{side:'opp',kind:'up'}},{op:'clear_turn',p:{side:'opp'}}],{priority:before?10:-10});
      const [r]=await h.play(side,{self:h.unit('恢復持有者',10000,[structuredClone(source),{...structuredClone(source),name:'另一攜帶監控槽'}],{statStages:{atk:3,spatk:2,speed:-1}}),opp:h.unit('清除者',100000,[clear])});
      assert.equal(r.self.statStages.atk,held?3:0,'先後手均恢復同回合實際被清強化；無色鱗不得恢復');
      assert.equal(r.self.statStages.spatk,held?2:0);assert.equal(r.self.statStages.speed,-1);
      const timer=r.state[side+'Timers'].find((t:any)=>t.id==='待恢復效果');
      assert.equal(timer?.remaining,held?4:undefined,'回合末恢復原剩餘期限，不重建完整初始期限');
      assert.equal(r.state[side+'RegistryState'].restoreMirror,held?7:0,'鏡像讀取欄位亦須恢復');
      assert.equal(r.state[side+'RegistryState']['removedEffectSnapshot:elementalRemoval'],undefined,'恢復後快照僅消耗一次');
    }
  }
  console.log('三招移除恢復：P1/P2先後手、同回合快照、色鱗門檻、實際期限/鏡像欄位及Blockly通過');
}finally{await h.close();}
