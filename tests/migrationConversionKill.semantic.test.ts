import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_CONVERSION_KILL_SKILL_KITS as definitions} from '../src/data/migratedConversionKillSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>structuredClone(h.find('5006','星光·絕命火焰'));
function reload(s:any,normal?:number,burn?:number,turns?:number,pp?:number){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){
      const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
      if(op==='instant_kill')p.chance=p.chance===30?(burn??30):(normal??15);
      if(op==='damage_to_heal_turns'&&turns!==undefined)p.turns=turns;
      if(op==='pp_op'&&pp!==undefined)p.amount=pp;
      b.setFieldValue(JSON.stringify(p),'PARAMS');
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
const utility=(s:any)=>({...s,category:'屬性',power:0,pp:5,maxPp:10});
const burnExtra={battleStatuses:{燒傷:10},effects:[{id:'燒傷',name:'燒傷',duration:10}]};
try{
  await check('完整來源／持有者／Kit唯一入口與Blockly重載，來源不符及自訂圖紙保留',async()=>{
    const s=skill();h.assertKitOnly(s);assert.equal(s.description,definitions[0].description);assert.deepEqual(s.kit,definitions[0].kit);assert.deepEqual(reload(s).kit,s.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['other',raw],['5006',{...raw,description:raw.description+'改'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,0,100,1,3);assert.deepEqual(applyReviewedSkillKits({id:'5006',skills:[edited]}).skills[0].kit,edited.kit);
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 反轉全下降但保持提升；PP條件读出手前、全技能槽各補2並封頂`,async()=>{
      const own=utility(reload(skill(),0,0)),otherSlot={...h.wait(),pp:1,maxPp:10},full={...h.wait(),name:'滿PP',pp:10,maxPp:10};
      const [down]=await h.play(side,{self:h.unit('S',100000,[own,otherSlot,full],{statStages:{atk:-2,def:-1,speed:1}}),opp:h.unit('E',100000,[h.wait()])});
      assert.deepEqual(down.self.statStages,{atk:2,def:1,speed:1});assert.deepEqual(down.self.skills.map((s:any)=>s.pp),[4,1,10]);
      const [clean]=await h.play(side,{self:h.unit('S',100000,[own,otherSlot,full]),opp:h.unit('E',100000,[h.wait()])});assert.deepEqual(clean.self.skills.map((s:any)=>s.pp),[6,3,10]);
      const [edit]=await h.play(side,{self:h.unit('S',100000,[utility(reload(skill(),0,0,1,3)),otherSlot,full]),opp:h.unit('E',100000,[h.wait()])});assert.deepEqual(edit.self.skills.map((s:any)=>s.pp),[7,4,10]);
    });
    await check(`${side} 完整圖紙兩回合轉攻擊療，第三回合失效；Blockly一回合改名後期限真的變更`,async()=>{
      const hit={...h.wait(),name:'攻擊',category:'物理',power:100,isSureHit:true};
      const run=(s:any)=>h.play(side,{self:h.unit('S',10000,[utility(s),h.wait()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[hit]),turns:(_,t)=>[t===1?0:1,0]},3);
      const hist=await run(reload(skill(),0,0));assert.ok(hist[0].self.currentHp>10000);assert.ok(hist[1].self.currentHp>hist[0].self.currentHp);assert.ok(hist[2].self.currentHp<hist[1].self.currentHp);
      const edit=await run({...reload(skill(),0,0,1),name:'改名轉療',description:''});assert.ok(edit[0].self.currentHp>10000);assert.ok(edit[1].self.currentHp<edit[0].self.currentHp);
    });
    await check(`${side} 燒傷30／非燒傷15為二擇一；Blockly獨立0／100分支即時生效`,async()=>{
      for(const [normal,burn,hasBurn,killed] of [[0,100,false,false],[0,100,true,true],[100,0,false,true],[100,0,true,false]] as const){
        const [r]=await h.play(side,{self:h.unit('S',100000,[{...reload(skill(),normal,burn),name:'分支改名',description:'',power:0}],{speed:200}),opp:h.unit('E',100000,[h.wait()],{extra:hasBurn?burnExtra:{}})});
        assert.equal(r.opp.currentHp===0,killed,r.logs.join('\n'));
      }
    });
    await check(`${side} 原15%／燒傷30%均有成功失敗，不提高原文機率`,async()=>{
      const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
      for(const hasBurn of [false,true]){let attempts=0;
        h.S.E=(_:any,e:any,data:any)=>{if(e===T.BEFORE_INSTANT_KILL){attempts++;data.blocked=true;}};
        try{await h.play(side,{self:h.unit('S',100000,[{...skill(),power:0,pp:99,maxPp:99}]),opp:h.unit('E',1000000,[h.wait()],{extra:hasBurn?burnExtra:{}})},8);assert.ok(attempts>0&&attempts<8,`${hasBurn}:${attempts}`);}finally{delete h.S.E;}
      }
    });
    await check(`${side} 下次擊敗監控跨回合而且僅一次；下一隻正式登場才焚燼`,async()=>{
      const kill=h.kitSkill('後續擊敗',[{op:'dmg',p:{flat:200000,type:'真實'}}]);
      const hist=await h.play(side,{self:h.unit('S',100000,[utility(reload(skill(),0,0)),kill,h.wait()],{speed:200}),opp:h.unit('E',100000,[h.wait()]),oppBench:[h.unit('B',100000,[h.wait()]),h.unit('C',100000,[h.wait()])],turns:(_,t)=>[t===1?0:t===2||t===4?1:2,t===3?{switch:1}:t===5?{switch:2}:0]},5);
      assert.ok(!h.statuses(hist[1].state[`${other}Team`][1]).includes('焚燼'));
      assert.ok(h.statuses(hist[2].state[`${other}Team`][1]).includes('焚燼'),hist[2].logs.join('\n'));
      assert.ok(!h.statuses(hist[4].state[`${other}Team`][2]).includes('焚燼'),hist[4].logs.join('\n'));
    });
    await check(`${side} 焚燼登場仍沿異常免疫；附加封印不能建立轉療或擊敗監控`,async()=>{
      const guard={name:'拒絕異常',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',order:0,params:{clause:{raw:'異常防護',trig:'before_status',parsed:true,body:[{acts:[{op:'status_guard',p:{cls:''},label:'防護'}]}]}}}]};
      const hist=await h.play(side,{self:h.unit('S',100000,[{...reload(skill(),100,100),power:0},h.wait()],{speed:200}),opp:h.unit('E',100000,[h.wait()]),oppBench:[h.unit('B',100000,[h.wait()],{extra:{soulMark:guard}})],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:0]},2);
      assert.ok(!h.statuses(hist[1].opp).includes('焚燼'),hist[1].logs.join('\n'));
      const hit={...h.wait(),name:'攻擊',category:'物理',power:100,isSureHit:true};
      const [r]=await h.play(side,{self:h.unit('S',10000,[utility(reload(skill(),100,100))],{maxHp:50000,speed:200,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',100000,[hit])});
      assert.ok(r.self.currentHp<10000);assert.ok(r.opp.currentHp>0);assert.ok(!r.state[`${side}Timers`].some((t:any)=>t.payload?.block?.convertDamageToHeal||t.payload?.block?.trig==='kill'));
    });
    await check(`${side} 原持有者魂印仍保留，反轉與出手前PP條件不重播`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5006');
      const [r]=await h.play(side,{self:h.unit('S',100000,[utility(reload(skill(),0,0)),{...h.wait(),pp:1,maxPp:10}],{statStages:{atk:-2},extra:{name:elf.name,soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(r.self.statStages.atk,2);assert.deepEqual(r.self.skills.map((s:any)=>s.pp),[4,1]);assert.deepEqual(r.self.soulMark,elf.soulMark);
    });
  }
  console.log(`星光·絕命火焰完整遷移：${checks}項通過，尚非全部定義全文驗收`);
}finally{await h.close();}
