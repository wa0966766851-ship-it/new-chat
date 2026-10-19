import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {EffectTiming:E}=await h.server.ssrLoadModule('/src/effects/types.ts');
  const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const original=structuredClone(DEFAULT_ELVES.find((e:any)=>String(e.id)==='5035').soulMark);
  const selected=original.kit.filter((e:any)=>/stat_drop_guard|damage_immunity_now|resource_resolve_pending|reset_hp_pp_on_clear/.test(JSON.stringify(e)));
  assert.equal(selected.length,4);
  for(const e of selected)assert.equal(sequenceIssue(e.params.clause,e.node),null,JSON.stringify(e));
  const entry=(node:string,trig:string,acts:any[])=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,customText:'測試資源',params:{clause:{raw:'測試資源',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}});
  const soul=(colour:string,count=1,lock=0)=>({...original,kit:[entry('on_entered','entrance',[
    {op:'resource_mark_add',p:{id:'hamo_scale_'+colour,name:colour+'龍鱗',displayChar:'鱗',unit:'枚',description:'測試持有者資源',side:'self',scope:'elf',persistsOffField:false,amount:count,maxCount:3}},
    ...(lock?[{op:'mark_lock_turns',p:{id:'hamo_scale_'+colour,turns:lock}}]:[]),
  ]),...structuredClone(selected)]});
  const held=(state:any,side:string,id:string)=>state[side+'Marks'].filter((m:any)=>m.id===id&&m.ownerBattleId==='防護持有者').reduce((n:number,m:any)=>n+m.count,0);
  defineCustomBlocks();const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{
    for(const e of selected){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
    assert.deepEqual(reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),selected);
  }finally{ws.dispose();reload.dispose();}
  h.S['混合能力測試者']=(c:any,event:any)=>{if(event===E.BEFORE_SKILL){c.applyStatChange(c.targetSide,{atk:-1,def:1});c.applyStatChange(c.targetSide,{speed:-1});}};
  h.S['持續能力測試者']=(c:any,event:any,data:any)=>{if(event===E.BEFORE_STATUS_APPLY)data.prevented=true;else h.S['混合能力測試者'](c,event,data);};
  for(const side of ['p1','p2'] as const){
    const [blue]=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:soul('藍色',2)}}),opp:h.unit('混合能力測試者',100000,[h.wait()],{extra:{shield:500,barrier:600}})});
    assert.equal(blue.self.statStages.atk||0,0,JSON.stringify(blue.logs));assert.equal(blue.self.statStages.speed||0,0);
    assert.equal(blue.self.statStages.def,1,'同一次能力變更保留正向項');
    assert.equal(held(blue.state,side,'hamo_scale_藍色'),1,'同回合兩次免疫只消耗一次');
    assert.equal(blue.opp.shield,0);assert.equal(blue.opp.barrier,0);
    assert.ok(h.statuses(blue.opp).includes('凍傷'),'藍色只觸發自己的消失副作用');
    assert.ok(!h.statuses(blue.opp).includes('燒傷'));assert.equal(blue.opp.maxHp,100000);
    const positive=h.kitSkill('只有提升',[{op:'stat',p:{side:'opp',stats:['防禦'],v:1}}]);
    const [noDrop]=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:soul('藍色')}}),opp:h.unit('正向能力者',100000,[positive],{extra:{shield:500,barrier:600}})});
    assert.equal(held(noDrop.state,side,'hamo_scale_藍色'),1);assert.equal(noDrop.opp.shield,500,'沒有負向變更不排消失');
    const [locked]=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:soul('藍色',1,2)}}),opp:h.unit('混合能力測試者',100000,[h.wait()],{extra:{shield:500,barrier:600}})});
    assert.equal(held(locked.state,side,'hamo_scale_藍色'),1,'保護期間保留鱗片');
    assert.equal(locked.opp.shield,0);assert.ok(h.statuses(locked.opp).includes('凍傷'),'保護不吞消失副作用');
    const expiry=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:soul('藍色',1,2)}}),opp:h.unit('持續能力測試者',100000,[h.wait()])},3);
    assert.deepEqual(expiry.map((r:any)=>held(r.state,side,'hamo_scale_藍色')),[1,1,0],'兩回合保護到期後真正消耗，不永久殘留');
    for(const [type,blocked] of [['固定',true],['百分比',true],['真實',false],['技能',false]] as const){
      const hit=h.kitSkill('分類傷害-'+type,[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'技能',cap:10000,turns:4}},{op:'dmg',p:{flat:1000,type,elem:'普通'}}]);
      const [red]=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:soul('紅色')}}),opp:h.unit('分類攻方',100000,[hit])});
      assert.equal(10000-red.self.currentHp,blocked?0:1000,type+'依原分類免疫');
      assert.equal(held(red.state,side,'hamo_scale_紅色'),blocked?0:1,'只在實際免疫成功後消耗');
      assert.equal(h.statuses(red.opp).includes('燒傷'),blocked);
      const other=side==='p1'?'p2':'p1';
      assert.equal(red.state[other+'Timers'].some((t:any)=>t.remaining>0&&t.payload?.block?.damageCap===10000),!blocked,'紅鱗消失消除對手真實回合類效果');
    }
    const [attack]=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:soul('紅色')}}),opp:h.unit('公式攻方',100000,[{...h.wait(),name:'公式攻擊',power:100,category:'物理'}])});
    assert.equal(attack.self.currentHp,10000,'紅鱗免疫真正公式攻擊');assert.equal(held(attack.state,side,'hamo_scale_紅色'),0);
    for(const mode of ['zero','reduce'] as const){
      const clear=h.kitSkill('PP變化-'+mode,[{op:'no_heal',p:{turns:3}},{op:'pp_op',p:{side:'opp',mode,amount:1000}}]);
      const [green]=await h.play(side,{self:h.unit('防護持有者',5000,[{...h.wait(),priority:10,pp:10,maxPp:20}],{maxHp:10000,extra:{soulMark:soul('綠色')}}),opp:h.unit('PP攻方',100000,[clear])});
      assert.equal(green.self.currentHp,mode==='zero'?10000:5000,'清除是重置體力，削PP不觸發；禁療不阻止重置');
      assert.equal(green.self.skills[0].pp,mode==='zero'?20:0,'清除重置到正式PP上限，普通削PP到0不觸發');
      assert.equal(held(green.state,side,'hamo_scale_綠色'),mode==='zero'?0:1);
      assert.equal(green.opp.maxHp,mode==='zero'?80000:100000,'只有綠鱗成功消失才削減對手體力上限');
      assert.equal(h.statuses(green.opp).includes('中毒'),mode==='zero');
    }
    const clearEmpty=h.kitSkill('清空已空槽',[{op:'pp_op',p:{side:'opp',mode:'zero',kind:'攻擊'}}]);
    const [empty]=await h.play(side,{self:h.unit('防護持有者',5000,[h.wait(),{...h.wait(),name:'空攻擊槽',category:'物理',pp:0,maxPp:20}],{maxHp:10000,extra:{soulMark:soul('綠色')}}),opp:h.unit('空槽攻方',100000,[clearEmpty])});
    assert.equal(empty.self.currentHp,5000);assert.equal(held(empty.state,side,'hamo_scale_綠色'),1,'原本0PP的槽被清除不算成功');
    const renamed=JSON.parse(JSON.stringify(soul('藍色')).replaceAll('hamo_scale_藍色','可編輯防護資源'));renamed.name='任意魂印名稱';
    const [edited]=await h.play(side,{self:h.unit('防護持有者',10000,[h.wait()],{extra:{soulMark:renamed}}),opp:h.unit('混合能力測試者',100000,[h.wait()])});
    assert.equal(edited.self.statStages.atk||0,0);assert.equal(held(edited.state,side,'可編輯防護資源'),0,'改名與資源ID後依積木執行');
  }
  const invalid=structuredClone(selected.find((e:any)=>e.node==='round_end').params.clause);
  invalid.body[0].acts[0].p.body=[{acts:[{op:'unknown_handler',p:{}}]}];
  assert.ok(sequenceIssue(invalid),'資源副作用不接受專屬handler或未知操作');
  console.log('哈莫三色鱗：P1/P2真實免疫／PP清除重置／分類隔離／單次消耗／保護期限副作用／改名及Blockly往返通過');
}finally{delete h.S['混合能力測試者'];delete h.S['持續能力測試者'];await h.close();}
