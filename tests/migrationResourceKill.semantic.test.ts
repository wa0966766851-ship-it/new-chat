import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_RESOURCE_KILL_SKILL_KITS as defs} from '../src/data/migratedResourceKillSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const name='絕滅・萬物哀鳴',definition=defs[0];
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const legacy=getBattleSkillRegistry(),original=legacy[name];legacy[name]=(ctx:any)=>{legacyCalls++;return original(ctx);};
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const skill=(pp=6)=>({...structuredClone(h.find('5024',name)),power:0,pp,maxPp:pp});
const resource=(r:any,side:string)=>r.state[`${side}Marks`].find((m:any)=>m.id==='demon_grudge');
function init(){h.S.S=(ctx:any,e:any)=>{if(e===T.ON_ENTRANCE)ctx.setMark({id:'demon_grudge',name:'魔王咒怨',count:1,scope:'elf',ownerBattleId:ctx.self.battleId||ctx.self.id,unit:'層',displayChar:'怨',persistsOffField:true,clearable:false},ctx.actor);};}
function reload(s:any,ratio?:number){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    if(ratio!==undefined)for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'&&b.getFieldValue('OP')==='heal_then'){const p=JSON.parse(b.getFieldValue('PARAMS'));p.ratio=ratio;b.setFieldValue(JSON.stringify(p),'PARAMS');}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
const chain={name:'同體力秒殺',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_instant_kill',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'同體力秒殺',trig:'before_instant_kill',parsed:true,body:[{acts:[{op:'instant_kill_same_hp_targets',p:{},label:'同體力'}]}]}}}]};
try{
  await check('全文／名稱／持有者精確匹配與真正Blockly往返，不覆蓋自訂圖紙或registry選擇',async()=>{
    const s=skill();assert.equal(s.description,definition.description);assert.equal(s.effectMode,'kit');assert.deepEqual(s.kit,definition.kit);assert.deepEqual(reload(s).kit,s.kit);
    const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');assert.equal(effectRoute(s,true),'kit');
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['other',raw],['5024',{...raw,description:raw.description+'改'}],['5024',{...raw,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,.5);assert.deepEqual(applyReviewedSkillKits({id:'5024',skills:[edited]}).skills[0].kit,edited.kit);
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    for(const p of [{side:'both',ratio:1,body:[]},{side:'opp',ratio:0,body:[]},{side:'opp',ratio:1,body:[{acts:[{op:'native',p:{},label:'壞'}]}]}])assert.ok(sequenceIssue(h.kitSkill('壞',[{op:'heal_then',p}]).kit[0].params.clause));
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} PP普通消耗後剩餘4，加原1恰5不秒殺；對手先恢復全體力且廢除永久`,async()=>{
      init();try{let attempts=0;h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_INSTANT_KILL)attempts++;};
        const [r]=await h.play(side,{self:h.unit('S',100000,[skill(5)]),opp:h.unit('E',10000,[h.wait()],{maxHp:30000})});assert.equal(r.opp.currentHp,30000);assert.equal(resource(r,side).count,5);assert.equal(r.self.skills[0].pp,0);assert.equal(r.self.skills[0].isAbolished,true);assert.equal(attempts,0);assert.equal(r.state[`${other}RegistryState`].nextElfStatus,undefined);
      }finally{delete h.S.S;delete h.S.E;}
    });
    await check(`${side} 超过5才正式秒殺；先恢復後取同HP快照，僅殺恢復後同體力隊員並詛咒下隻`,async()=>{
      init();try{let snapshots:number[]=[];h.S.E=(_:any,e:any,d:any)=>{if(e===T.BEFORE_INSTANT_KILL)snapshots=d.targets.map((t:any)=>t.hpSnapshot);};
        const hist=await h.play(side,{self:h.unit('S',100000,[skill(),h.wait()],{speed:200,extra:{trait:chain}}),opp:h.unit('E',10000,[h.wait()],{maxHp:30000,extra:{shield:99999}}),oppBench:[h.unit('B',30000,[h.wait()]),h.unit('C',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,t===2?{switch:2}:0]},2);
        const r=hist[0];assert.ok(snapshots.length>=1);assert.ok(snapshots.every(v=>v===30000));assert.equal(r.opp.currentHp,0);assert.equal(r.opp.shield,99999);assert.equal(r.state[`${other}Team`][1].currentHp,0);assert.equal(r.state[`${other}Team`][2].currentHp,10000);assert.equal(resource(r,side).count,6);assert.ok(h.statuses(hist[1].opp).includes('詛咒'));assert.equal(hist[1].opp.battleId,'C');
      }finally{delete h.S.S;delete h.S.E;}
    });
    await check(`${side} 禁療／滿血回復0仍消耗PP與增資源；禁療同體力目標按未恢復體力選`,async()=>{
      init();try{
        const ban=h.kitSkill('先禁療',[{op:'no_heal',p:{turns:3,next:false}}],{priority:5});
        const hist=await h.play(side,{self:h.unit('S',100000,[ban,skill()],{extra:{trait:chain}}),opp:h.unit('E',10000,[h.wait()],{maxHp:30000}),oppBench:[h.unit('B',30000,[h.wait()]),h.unit('C',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},2);
        const r=hist[1];assert.equal(resource(r,side).count,6);assert.equal(r.opp.currentHp,0);assert.equal(r.state[`${other}Team`][1].currentHp,30000);assert.equal(r.state[`${other}Team`][2].currentHp,0);assert.equal(r.self.skills[1].isAbolished,true);
        const [full]=await h.play(side,{self:h.unit('S',100000,[skill(5)]),opp:h.unit('E',30000,[h.wait()])});assert.equal(full.opp.currentHp,30000);assert.equal(resource(full,side).count,5);
      }finally{delete h.S.S;}
    });
    await check(`${side} 秒殺受防護不阻止本次攻擊保底；全隊含陣亡上限，普通攻擊經護盾且下一招不繼承`,async()=>{
      init();h.S.E=(_:any,e:any,d:any)=>{if(e===T.BEFORE_INSTANT_KILL)d.blocked=true;};
      try{const cap=h.kitSkill('上限1',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'攻擊',cap:1,turns:3,next:false}}],{priority:5});
        const hist=await h.play(side,{self:h.unit('S',100000,[{...skill(),power:1},{...h.wait(),name:'普通攻擊',category:'物理',power:1}],{speed:200}),opp:h.unit('E',10000,[cap,h.wait()],{maxHp:30000,extra:{shield:40000}}),oppBench:[h.unit('B',20000,[h.wait()]),h.unit('D',0,[h.wait()],{maxHp:10000})],turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
        assert.equal(hist[0].opp.currentHp,10000,hist[0].logs.join('\n'));assert.equal(hist[0].opp.shield,0);assert.equal(hist[1].opp.currentHp,9999);assert.equal(hist[0].state[`${other}RegistryState`].nextElfStatus,undefined);
      }finally{delete h.S.S;delete h.S.E;}
    });
    await check(`${side} Blockly改恢復比例、保存重載改名後實際執行；附加封印不廢除也不消耗額外PP`,async()=>{
      init();try{const edited={...reload(skill(5),.5),name:'改名資源技能',description:''};const [r]=await h.play(side,{self:h.unit('S',100000,[edited]),opp:h.unit('E',10000,[h.wait()],{maxHp:30000})});assert.equal(r.opp.currentHp,25000);assert.equal(resource(r,side).count,5);assert.equal(r.self.skills[0].isAbolished,true);
        const [sealed]=await h.play(side,{self:h.unit('S',100000,[skill()],{extra:{isAdditionalInvalid:true}}),opp:h.unit('E',10000,[h.wait()],{maxHp:30000})});assert.equal(sealed.opp.currentHp,10000);assert.equal(sealed.self.skills[0].pp,5);assert.ok(!sealed.self.skills[0].isAbolished);assert.equal(resource(sealed,side).count,1);
      }finally{delete h.S.S;}
    });
    await check(`${side} 原持有者魂印沿正式秒殺事件而不重播舊技能handler`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024');
      const [r]=await h.play(side,{self:h.unit('S',100000,[skill()],{extra:{name:elf.name,soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',10000,[h.wait()],{maxHp:30000}),oppBench:[h.unit('B',30000,[h.wait()]),h.unit('C',10000,[h.wait()])]});assert.equal(legacyCalls,0);assert.equal(r.opp.currentHp,0);assert.equal(r.state[`${other}Team`][1].currentHp,0);assert.equal(r.state[`${other}Team`][2].currentHp,10000);assert.ok(resource(r,side).count>=6);
    });
  }
  console.log(`絕滅・萬物哀鳴完整遷移：${checks}項通過，未授予全部定義全文驗收`);
}finally{legacy[name]=original;delete h.S.S;delete h.S.E;await h.close();}
