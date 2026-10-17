import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_INSTANT_KILL_SKILL_KITS} from '../src/data/migratedInstantKillSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const name='沉寂・永夜悼亡',definition=MIGRATED_INSTANT_KILL_SKILL_KITS.find(d=>d.name===name)!;
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const legacy=getBattleSkillRegistry(),original=legacy[name];
legacy[name]=(ctx:any)=>{legacyCalls++;return original(ctx);};
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const counterName='秒殺期限觀測';let attempts:number[]=[],rngBurn=0;
h.S[counterName]=(ctx:any,event:any,data:any)=>{
  if(event===T.ON_ENTRANCE)for(let i=0;i<rngBurn;i++)ctx.rng();
  if(event===T.BEFORE_INSTANT_KILL&&data.targetSide===ctx.actor){attempts.push(ctx.roundNumber);data.blocked=true;}
};
const check=async(n:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${n}`);};
const skill=()=>structuredClone(h.find('5024',name));
const curseGuard=()=>({name:'僅免疫詛咒',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'詛咒免疫',trig:'before_status',parsed:true,body:[{cond:[{c:'event_status',p:{statuses:['詛咒']},label:'本次詛咒'}],acts:[{op:'status_guard',p:{cls:''},label:'免疫本次'}]}]}}}]});
const hit=(mode='hit')=>h.kitSkill('後續攻擊',[],{category:'物理',power:10,...(mode==='miss'?{isSureHit:false,accuracy:0}:{})});
function reload(active:any,edit?:(op:string,p:any)=>boolean){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of active.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){
      const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));if(edit?.(op,p))b.setFieldValue(JSON.stringify(p),'PARAMS');
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...active,kit:r.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,e.node,e.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
const probability=(n:number)=>reload(skill(),(op,p)=>{if(op!=='timed')return false;p.body[0].acts[0].p.chance=n;return true;});
try{
  await check('完整全文及持有者匹配；Blockly保存重載、Kit單一路由與原文／自訂圖紙保護',async()=>{
    const s=skill();assert.equal(s.effectMode,'kit');assert.equal(s.description,definition.description);assert.deepEqual(s.kit,definition.kit);assert.deepEqual(reload(s).kit,s.kit);
    const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');assert.equal(effectRoute(s,true),'kit');
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['wrong',raw],['5024',{...raw,description:raw.description+'自訂'}],['5024',{...raw,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=probability(0);assert.deepEqual(applyReviewedSkillKits({id:'5024',skills:[edited]}).skills[0].kit,edited.kit);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 命中詛咒成功不恢復／不建立上限，免疫失敗才恢復全體力且建立三回合防護`,async()=>{
      for(const immune of [false,true]){
        const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{maxHp:20000,speed:200}),opp:h.unit('E',100000,[h.wait()],{extra:immune?{trait:curseGuard()}:{}})});
        assert.equal(h.statuses(r.opp).includes('詛咒'),!immune,r.logs.join('\n'));assert.equal(r.self.currentHp,immune?20000:10000);
        const cap=r.state[`${side}Timers`].find((t:any)=>t.payload?.block?.damageCap!==undefined);
        assert.equal(!!cap,immune);if(cap){assert.equal(cap.payload.block.damageCap,200);assert.equal(cap.remaining,2);}
      }
    });
    await check(`${side} 正式兩次異常免疫各消耗一次，第三次施加；下場不轉交下一隻`,async()=>{
      const status=h.kitSkill('附屬異常',[{op:'status',p:{side:'opp',status:'狂暴',turns:2,chance:100}}]);
      const hist=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:20000,speed:200}),opp:h.unit('E',100000,[status],{extra:{trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(hist.map(r=>Number(r.state[`${side}RegistryState`].blkImmuneStatusCount)),[1,0,0]);assert.deepEqual(hist.map(r=>h.statuses(r.self).includes('狂暴')),[false,false,true]);
      const changed=await h.play(side,{self:h.unit('S',10000,[skill()],{maxHp:20000,speed:200}),selfBench:[h.unit('B',20000,[h.wait()])],opp:h.unit('E',100000,[status],{extra:{trait:curseGuard()}}),turns:(_,t)=>[t===1?0:{switch:1},0]},2);
      assert.equal(changed[1].self.id,'B');assert.ok(h.statuses(changed[1].self).includes('狂暴'),changed[1].logs.join('\n'));
    });
    await check(`${side} 三回合上限覆蓋固定／百分比／X系技能，真傷按全域規則穿透`,async()=>{
      for(const type of ['固定','百分比','技能','真實']){
        const damage=h.kitSkill('各類傷害',[{op:'dmg',p:{flat:9000,type,...(type==='技能'?{elem:'普通'}:{})}}]);
        const hist=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[damage],{extra:{trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},4);
        assert.deepEqual(hist.map(r=>r.self.currentHp),type==='真實'?[41000,32000,23000,14000]:[49800,49600,49400,40400],type+'\n'+hist[3].logs.join('\n'));
      }
      const attack=h.kitSkill('主攻擊',[],{category:'物理',power:1000});
      const hist=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[attack],{extra:{trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(hist.slice(0,3).map(r=>r.self.currentHp),[49800,49600,49400]);assert.ok(hist[3].self.currentHp<49200);
    });
    await check(`${side} 下兩回合增傷在第二三回合生效，第四回合到期；不強化附加固定傷害`,async()=>{
      const own=probability(0),attack=h.kitSkill('主攻擊與固定',[{op:'dmg',p:{flat:100,type:'固定'}}],{category:'物理',power:10});
      const run=(first:any)=>h.play(side,{self:h.unit('S',50000,[first,attack],{speed:200}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},4);
      const hist=await run(own),base=await run(h.wait());const deltas=(a:any[])=>a.map((r,i)=>(i?a[i-1].opp.currentHp:100000)-r.opp.currentHp);
      const got=deltas(hist),plain=deltas(base);assert.equal(got[0],0);assert.ok(got[1]-100>(plain[1]-100)*2);assert.ok(got[2]-100>(plain[2]-100)*2);assert.equal(got[3],plain[3]);
    });
    await check(`${side} 改100%秒殺僅在第二三回合的成功攻擊各執行一次，屬性／對手攻擊／第四回合不觸發`,async()=>{
      attempts=[];
      const hist=await h.play(side,{self:h.unit('S',50000,[probability(100),hit()],{speed:200}),opp:h.unit('E',100000,[h.wait()],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(attempts,[2,3],hist[3].logs.join('\n'));
      attempts=[];
      const statuses=await h.play(side,{self:h.unit('S',50000,[probability(100),h.wait()],{speed:200}),opp:h.unit('E',100000,[hit()],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(attempts,[],statuses[2].logs.join('\n'));
    });
    await check(`${side} 原15%持續機率實際有成功與失敗，沒有替換原機率`,async()=>{
      let succeeded=false,failed=false;
      try{for(rngBurn=0;rngBurn<32&&!(succeeded&&failed);rngBurn++){
        attempts=[];await h.play(side,{self:h.unit('S',50000,[skill(),hit()],{speed:200}),opp:h.unit('E',100000,[h.wait()],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},3);
        succeeded||=attempts.length>0;failed||=attempts.length<2;assert.ok(attempts.every(t=>t===2||t===3));
      }}finally{rngBurn=0;}
      assert.ok(succeeded,'原15%必須在固定種子不同正式亂數位置有成功');assert.ok(failed,'原15%不可冒充100%');
    });
    await check(`${side} 既有監控不繞過後續攻擊未命中／無效／附加封印，解除後恢復秒殺`,async()=>{
      for(const mode of ['miss','invalid','seal']){
        attempts=[];const restriction=mode==='invalid'?h.kitSkill('封攻擊',[{op:'invalid_turns',p:{kind:'攻擊',turns:1,next:false}}],{priority:4})
          :mode==='seal'?h.kitSkill('封附加',[{op:'add_invalid_turns',p:{kind:'攻擊',turns:1,next:false}}],{priority:4}):h.wait();
        const hist=await h.play(side,{self:h.unit('S',50000,[probability(100),hit(mode),hit()],{speed:200}),opp:h.unit('E',100000,[h.wait(),restriction],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:t===2?1:2,t===2?1:0]},3);
        assert.deepEqual(attempts,[3],mode+'\n'+hist[2].logs.join('\n'));
      }
    });
    await check(`${side} Blockly改次數／上限／增傷／監控期限，改名圖紙仍執行；下場取消技能監控`,async()=>{
      const edited={...reload(skill(),(op,p)=>{
        if(op==='immune_status_count')p.count=1;else if(op==='damage_cap_turns')p.cap=100;else if(op==='dmg_mod_turns'){p.boost=.5;p.turns=1;}
        else if(op==='timed'){p.turns=2;p.body[0].acts[0].p.chance=100;}else return false;return true;
      }),name:'改名沉寂',description:''};
      attempts=[];const hist=await h.play(side,{self:h.unit('S',10000,[edited,hit()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[h.kitSkill('固定附加異常',[{op:'dmg',p:{flat:1000,type:'固定'}},{op:'status',p:{side:'opp',status:'狂暴',turns:2,chance:100}}])],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(attempts,[2]);assert.equal(hist[0].self.currentHp,49900);assert.equal(hist[0].state[`${side}RegistryState`].blkImmuneStatusCount,0);assert.ok(h.statuses(hist[1].self).includes('狂暴'));
      const noBoost=reload(edited,(op,p)=>{if(op!=='dmg_mod_turns')return false;p.boost=0;return true;});
      const control=await h.play(side,{self:h.unit('S',10000,[noBoost,hit()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[h.kitSkill('固定附加異常',[{op:'dmg',p:{flat:1000,type:'固定'}},{op:'status',p:{side:'opp',status:'狂暴',turns:2,chance:100}}])],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:1,0]},3);
      const boosted=hist[0].opp.currentHp-hist[1].opp.currentHp,ordinary=control[0].opp.currentHp-control[1].opp.currentHp;
      assert.ok(boosted>ordinary*1.4&&boosted<ordinary*1.6,'改50%增傷實際執行');
      assert.equal(hist[1].opp.currentHp-hist[2].opp.currentHp,control[1].opp.currentHp-control[2].opp.currentHp,'改為下1回合後第三回合已到期');
      attempts=[];const switched=await h.play(side,{self:h.unit('S',50000,[probability(100)],{speed:200}),selfBench:[h.unit('B',50000,[hit()])],opp:h.unit('E',100000,[h.wait()],{extra:{name:counterName,trait:curseGuard()}}),turns:(_,t)=>[t===1?0:t===2?{switch:1}:0,0]},3);assert.deepEqual(attempts,[],switched[2].logs.join('\n'));
    });
    await check(`${side} 原持有者魂印不重播舊技能，附加封印不能建立圖紙效果`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024');
      const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{maxHp:20000,speed:200,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:curseGuard()}})});
      assert.equal(legacyCalls,0);for(const key of ['instantKillChanceTurns','attackDamageBoostTurns','incomingSkillDmgCapTurns'])assert.equal(r.state[`${side}RegistryState`][key]||0,0,key);
      const seal=h.kitSkill('封本招附加',[{op:'add_invalid_turns',p:{kind:'屬性',turns:1,next:false}}],{priority:4});
      const [blocked]=await h.play(side,{self:h.unit('S',10000,[skill()],{maxHp:20000}),opp:h.unit('E',100000,[seal])});
      assert.equal(blocked.self.currentHp,10000);assert.equal(blocked.state[`${side}RegistryState`].blkImmuneStatusCount||0,0);assert.equal(blocked.state[`${side}Timers`].filter((t:any)=>t.payload?.block?.src===name).length,0);
    });
  }
  assert.equal(legacyCalls,0);console.log(`沉寂・永夜悼亡完整遷移：${checks}項通過，未授予全部定義全文語意驗收`);
}finally{legacy[name]=original;delete h.S[counterName];await h.close();}
