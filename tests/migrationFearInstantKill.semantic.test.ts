import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_INSTANT_KILL_SKILL_KITS as defs} from '../src/data/migratedInstantKillSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const name='劫數.萬念歸墟',definition=defs.find(d=>d.name===name)!;
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const legacy=getBattleSkillRegistry(),original=legacy[name];legacy[name]=(ctx:any)=>{legacyCalls++;return original(ctx);};
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const skill=()=>structuredClone(h.find('5025',name));
function reload(s:any,chance?:number,ratio?:number){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){
      const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
      if(op==='instant_kill'&&chance!==undefined)p.chance=chance;
      if(op==='drain'&&ratio!==undefined)p.ratio=ratio;
      b.setFieldValue(JSON.stringify(p),'PARAMS');
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
const guard=()=>({name:'害怕免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'害怕免疫',trig:'before_status',parsed:true,body:[{cond:[{c:'event_status',p:{statuses:['害怕']},label:'害怕'}],acts:[{op:'status_guard',p:{cls:''},label:'防護'}]}]}}}]});
const own=(chance=0)=>({...reload(skill(),chance),power:0,pp:99,maxPp:99});
const hit=(power=100)=>({...h.wait(),name:'後續攻擊',category:'物理',power,isSureHit:true});
try{
  await check('完整持有者／全文匹配、單一Kit路由、真正Blockly保存重載；不覆寫自訂來源',async()=>{
    const s=skill();assert.equal(s.effectMode,'kit');assert.equal(s.description,definition.description);assert.deepEqual(s.kit,definition.kit);assert.deepEqual(reload(s).kit,s.kit);
    const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');assert.equal(effectRoute(s,true),'kit');
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['other',raw],['5025',{...raw,description:raw.description+'改'}],['5025',{...raw,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,100,1/4);assert.deepEqual(applyReviewedSkillKits({id:'5025',skills:[edited]}).skills[0].kit,edited.kit);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 正式百分比汲取最大體力⅓，免疫失敗才害怕；禁療不把汲取當真傷`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',10000,[own()],{maxHp:50000,speed:200}),opp:h.unit('E',90000,[h.wait()])});assert.equal(r.opp.currentHp,60000);assert.equal(r.self.currentHp,40000,r.logs.join('\n'));
      const immunity={name:'免百分比',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'百分比免疫',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce:1},label:'免疫'}]}]}}}]};
      const [immune]=await h.play(side,{self:h.unit('S',10000,[own()],{maxHp:50000,speed:200}),opp:h.unit('E',90000,[h.wait()],{extra:{trait:immunity}})});assert.equal(immune.opp.currentHp,90000);assert.equal(immune.self.currentHp,10000);assert.ok(immune.logs.some((s:string)=>s.includes('害怕')));
      const ban=h.kitSkill('先禁療',[{op:'no_heal',p:{turns:2,next:false}}],{priority:5});const [blocked]=await h.play(side,{self:h.unit('S',10000,[own()],{maxHp:50000}),opp:h.unit('E',90000,[ban])});assert.equal(blocked.opp.currentHp,60000);assert.equal(blocked.self.currentHp,10000);
    });
    await check(`${side} 消除成功才害怕；清除失敗或害怕免疫提升本回合攻擊，下一回合停止`,async()=>{
      const run=(withEffect:boolean,immunity:boolean)=>h.play(side,{self:h.unit('S',100000,[{...own(),power:100},hit()],{speed:10}),opp:h.unit('E',900000,[h.turnEffectSkill(),h.wait()],{speed:300,extra:immunity?{trait:guard()}:{}}),turns:(_,t)=>[t===1?0:1,t===1&&withEffect?0:1]},2);
      const success=await run(true,false),failed=await run(false,false),guarded=await run(true,true);
      assert.ok(!success[0].state[`${side}Timers`].some((t:any)=>t.payload?.block?.dmgOutBoost===1.5));
      const loss=(r:any)=>(900000-r[0].opp.currentHp)-300000;
      assert.ok(loss(failed)>loss(success),failed[0].logs.join('\n'));assert.ok(loss(guarded)>loss(success),guarded[0].logs.join('\n'));
      const later=(r:any)=>r[0].opp.currentHp-r[1].opp.currentHp;assert.equal(later(failed),later(success));assert.equal(later(guarded),later(success));
    });
    await check(`${side} 新害怕成功不秒殺，既有害怕或免疫失敗才有一次秒殺，未命中／封附加不觸發`,async()=>{
      for(const mode of ['new','already','immune']){
        let attempts=0;h.S.E=(_:any,e:any,d:any)=>{if(e===T.BEFORE_INSTANT_KILL){attempts++;d.blocked=true;}};
        try{const extra=mode==='already'?{battleStatuses:{害怕:10},effects:[{id:'害怕',name:'害怕',duration:10}]}:mode==='immune'?{trait:guard()}:{};
          await h.play(side,{self:h.unit('S',100000,[own(100)],{speed:200}),opp:h.unit('E',900000,[h.wait()],{extra})});assert.equal(attempts,mode==='new'?0:1,mode);
        }finally{delete h.S.E;}
      }
      const [kill]=await h.play(side,{self:h.unit('S',100000,[own(100)],{speed:200}),opp:h.unit('E',900000,[h.wait()],{extra:{trait:guard(),shield:1000000}})});assert.equal(kill.opp.currentHp,0);assert.equal(kill.opp.shield,1000000);
      const [sealed]=await h.play(side,{self:h.unit('S',100000,[own(100)],{speed:200,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',900000,[h.wait()],{extra:{trait:guard()}})});assert.equal(sealed.opp.currentHp,900000);
      // 必中是固有；編輯作品移除必中才驗未命中，原圖紙不被改寫。
      const miss={...own(100),accuracy:0,isSureHit:false,kit:own(100).kit.filter((e:any)=>e.codeId!=='skill_property')};let attempts=0;h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_INSTANT_KILL)attempts++;};
      try{await h.play(side,{self:h.unit('S',100000,[miss],{speed:200}),opp:h.unit('E',900000,[h.wait()],{extra:{trait:guard()}})});assert.equal(attempts,0);}finally{delete h.S.E;}
    });
    await check(`${side} 抵擋後不立即反彈，下一攻擊才加等量真傷且只有一次；Blockly改汲取比例後改名執行`,async()=>{
      const baseline=await h.play(side,{self:h.unit('S',100000,[h.wait()]),opp:h.unit('E',900000,[hit()])});const amount=100000-baseline[0].self.currentHp;
      const hist=await h.play(side,{self:h.unit('S',100000,[own(),hit(0)],{speed:200}),opp:h.unit('E',900000,[hit()],{extra:{trait:guard()}}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.equal(hist[0].self.currentHp,100000);assert.equal(hist[0].opp.currentHp,600000);assert.equal(hist[1].opp.currentHp,600000-amount);assert.equal(hist[2].opp.currentHp,hist[1].opp.currentHp);assert.ok(hist[2].self.currentHp<hist[1].self.currentHp);
      const edited={...reload(skill(),0,1/4),name:'改名汲取',description:'',power:0};const [r]=await h.play(side,{self:h.unit('S',10000,[edited],{maxHp:50000,speed:200}),opp:h.unit('E',90000,[h.wait()])});assert.equal(r.opp.currentHp,67500);assert.equal(r.self.currentHp,32500);
    });
    await check(`${side} 原持有者魂印不重播舊技能handler或以近似真傷替代秒殺`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5025');
      await h.play(side,{self:h.unit('S',100000,[own()],{extra:{name:elf.name,soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',900000,[h.wait()])});assert.equal(legacyCalls,0);
    });
    await check(`${side} 原30%秒殺在正式亂數位置有成功與失敗，免疫失敗與既存害怕不重抽`,async()=>{
      let success=false,failure=false;
      for(let burn=0;burn<=32&&!(success&&failure);burn++){let attempts=0;
        h.S.E=(ctx:any,e:any,d:any)=>{if(e===T.ON_ENTRANCE)for(let i=0;i<burn;i++)ctx.rng();if(e===T.BEFORE_INSTANT_KILL){attempts++;d.blocked=true;}};
        try{await h.play(side,{self:h.unit('S',100000,[{...skill(),power:0}],{speed:200}),opp:h.unit('E',900000,[h.wait()],{extra:{trait:guard(),battleStatuses:{害怕:10},effects:[{id:'害怕',name:'害怕',duration:10}]}})});assert.ok(attempts<=1);success ||= attempts===1;failure ||= attempts===0;}finally{delete h.S.E;}
      }
      assert.ok(success&&failure);
    });
  }
  console.log(`劫數.萬念歸墟完整遷移：${checks}項通過，未授予全部定義全文验收`);
}finally{legacy[name]=original;await h.close();}
