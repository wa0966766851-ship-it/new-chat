import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  defineCustomBlocks();
  for(const [id,name] of [['5034','王·墮落絕語'],['5035','逐波'],['5035','燼世'],['5035','纏根']]){
    const original=h.find(id,name).kit;
    const ws=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try{
      for(const e of original){const block=buildEntryBlock(ws as any,e);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),restored);
      const parsed=restored.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(parsed,[...original].sort((a:any,b:any)=>a.order-b.order),'新操作必須可存檔、重載為相同積木及參數');
    }finally{ws.dispose();restored.dispose();}
  }
  const entry=(node:string,trig:string,role:string,acts:any[],order:number)=>({codeId:'effect_sequence',source:'skill',role,node,order,customText:'強制命中測試',params:{clause:{raw:'強制命中測試',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}});
  const flag=(key:string)=>({op:'pending_counter',p:{key,amount:1,label:key}});
  for(const side of ['p1','p2'] as const){
    const run=async(mode:'plain'|'attached'|'external'|'baseline'|'sealed',basePower=100)=>{
      const receipts:number[]=[];
      const sk:any={...h.wait(),name:'強制命中樣本',category:'特殊',power:mode==='baseline'?basePower+50:basePower,pp:20,maxPp:20,accuracy:100,effectMode:'kit',kit:[
        entry('on_skill_use','use','attached',[flag('attachedExecutions'),...(mode==='attached'?[{op:'boost',p:{power:true,add:50,mult:1}}]:[])],0),
        entry('on_skill_use','use','innate',[flag('innateExecutions')],1),
        entry('on_hit','after_hit','attached',[flag('afterHitExecutions')],2),
        entry('on_hit','after_hit','innate',[flag('innateAfterHitExecutions')],3),
      ]};
      h.S['強制施放者']=(c:any,event:string)=>{
        if(event==='BEFORE_SKILL'&&mode!=='baseline'){
          c.setPlayerState('forceHitEffectsThisAction',true);
          if(mode==='external')c.setPlayerState('powerAddThisAction',50);
        }
      };
      h.S['強制受方']=(c:any,event:string,data:any)=>{
        if(event==='ON_ENTRANCE'&&!['baseline','sealed'].includes(mode))c.addTimerTo(c.targetSide,{id:'強制驗收無效',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{invalid:'all'}}},false);
        if(event==='AFTER_DAMAGE'&&data?.damageType==='skill_attack')receipts.push(data.receipt.settledAmount);
      };
      const [r]=await h.play(side,{self:h.unit('強制施放者',10000,[sk],{speed:300,extra:mode==='sealed'?{isAdditionalInvalid:true}:{}}),opp:h.unit('強制受方',100000,[{...h.wait(),priority:-10}])});
      assert.equal(r.self.skills[0].pp,19);
      const reg=r.state[side+'RegistryState'];
      assert.equal(reg.attachedExecutions,1,JSON.stringify({mode,logs:r.logs}));
      assert.equal(reg.afterHitExecutions,1);
      if(!['baseline','sealed'].includes(mode)){
        assert.equal(reg.innateExecutions,undefined,'強制命中不重播固有使用效果');
        assert.equal(reg.innateAfterHitExecutions,undefined,'重算後也不重播固有命中效果');
      }
      return {r,receipts};
    };
    const plain=await run('plain');assert.deepEqual(plain.receipts,[],'沒有附加固定威力時只執行效果');
    const baseline=await run('baseline');assert.equal(baseline.receipts.length,1);
    assert.deepEqual((await run('attached')).receipts,baseline.receipts,'命中效果自身+50須走正式150威力公式');
    assert.deepEqual((await run('external')).receipts,baseline.receipts,'其他來源+50同樣須重算');
    assert.deepEqual((await run('attached',0)).receipts,(await run('baseline',0)).receipts,'基礎威力0附加50仍要進50威力公式');
    assert.equal((await run('sealed')).receipts.length,1,'附加失效時仍強制執行命中積木，正常傷害只結算一次');

    // 真實摩哥斯技能啟動全隊規則；後續改用獨立隊友，確認不依賴摩哥斯魂印。
    const root=structuredClone(h.find('5034','王·墮落絕語'));
    const endName='王·潰墮妖族';
    const fifth:any=h.kitSkill(endName,[{op:'resource_mark_add',p:{id:'mogos_residual',name:'埒殘銜闕',displayChar:'闕',unit:'道',side:'opp',scope:'elf',persistsOffField:false,amount:1,maxCount:3,description:'測試前置命中效果增加印記'}}],{category:'特殊',power:100,isFifthSkill:true});
    const ally=h.unit('共享隊友',100000,[h.kitSkill('隊友命中效果',[flag('allyForced')],{category:'特殊',power:100})]);
    h.S['共享受方']=(c:any,event:string)=>{
      if(event==='ON_ENTRANCE'){
        c.addTimerTo(c.targetSide,{id:'共享驗收無效',remaining:3,kind:'use_counter',source:'skill',tickAt:'never',scope:'team',payload:{block:{invalid:'all'}}},false);
        c.setMark({id:'mogos_residual',name:'埒殘銜闕',count:2,scope:'elf',ownerBattleId:c.self.battleId||c.self.id},c.actor);
      }
    };
    const history=await h.play(side,{self:h.unit('原施加者',100000,[root,fifth],{speed:300}),selfBench:[ally],opp:h.unit('共享受方',1000000,[{...h.wait(),priority:-10}]),turns:(_e:any,t:number)=>t===2?[{switch:1},0]:t===4?[{switch:0},0]:[t>=5?1:0,0]},6);
    const reg=(i:number)=>history[i].state[side+'RegistryState'];
    assert.ok(reg(0).teamForcedHitRule,'原文無效啟動全隊共享');
    assert.ok(reg(1).teamForcedHitRule,'施加者下場仍保留');
    assert.equal(reg(2).allyForced,1,'隊友技能無效仍執行自己的命中積木');
    assert.ok(reg(2).teamForcedHitRule,'隊友使用技能不解除');
    assert.ok(reg(4).teamForcedHitRule,'第五技能失敗且重算傷害仍不算成功使用');
    assert.ok(history[4].opp.currentHp<history[3].opp.currentHp,'第五技能由共享規則附加50威力後真正重算傷害');
    assert.equal(history[5].logs.filter((s:string)=>s.includes('本次攻擊威力 +125')).length,2,'公式讀取前置命中效果新增後的3道印記，各加一次50+3×25，不讀舊快照或重複疊加');
    assert.equal(reg(5).teamForcedHitRule,undefined,'原施加者成功使用第五技能後解除');
  }
  console.log('強制命中積木：P1/P2附加與固有隔離、內外固定威力重算、摩哥斯全隊跨換人及第五技能解除通過');
}finally{await h.close();}
