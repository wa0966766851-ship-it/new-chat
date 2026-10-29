import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_IMMUNITY_FALLBACK_SKILL_KITS as definitions} from '../src/data/migratedImmunityFallbackSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>structuredClone(h.find('5015','蒼茫幽魂舞'));
// 分支數值測試隔離附加傷害條目；完整技能另跑命中／PP／異常的組合案例。
const damageOnly=()=>({...skill(),power:0,category:'屬性',kit:skill().kit.filter((e:any)=>[0,4].includes(e.order))});
const trait=(op:string,p:any)=>({name:'防禦設定',description:'測試',effectMode:'kit',kit:[{codeId:'effect_sequence',node:op==='damage_cap_turns'?'on_entered':'before_damage',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'防禦設定',trig:op==='damage_cap_turns'?'entrance':'incoming',parsed:true,body:[{acts:[{op,p,label:op}]}]}}}]});
function roundtrip(active:any,edit?:(b:any)=>void){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of active.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))edit?.(b);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...active,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('完整原文、持有者、單一Kit路徑及Blockly保存重載；錯誤原文不套入',async()=>{
    const active=skill();h.assertKitOnly(active);assert.equal(active.description,definitions[0].description);assert.deepEqual(active.kit,definitions[0].kit);assert.deepEqual(roundtrip(active).kit,active.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');
    const source={...active,effectMode:undefined,kit:undefined};
    for(const [id,s] of [['wrong',source],['5015',{...source,description:source.description+'自訂'}],['5015',{...source,effectMode:'registry'}]] as any){assert.equal(applyReviewedSkillKits({id,skills:[s]}).skills[0].kit,undefined);}
    const {readBasePriority}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');assert.equal(readBasePriority(active,{actor:'p1',targetSide:'p2',self:{},target:{},getPlayerState:()=>0,getOpponentState:()=>0}),1);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 完整命中：隨機一槽PP歸零、害怕、攻擊值30%傷害與等量回復`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',40000,[skill()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[0,1,2].map(i=>({...h.wait(),name:'槽'+i,pp:9,maxPp:9})))});
      assert.equal(r.opp.skills.filter((s:any)=>s.pp===0).length,1);assert.ok(h.statuses(r.opp).includes('害怕'),r.logs.join('\n'));assert.equal(r.self.currentHp,40090,r.logs.join('\n'));
    });
    await check(`${side} 害怕被免疫才改狂暴；未命中不觸發PP與異常`,async()=>{
      const immune={name:'異常免疫',description:'測試',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'免疫',trig:'entrance',parsed:true,body:[{acts:[{op:'immune_status_turns',p:{turns:2,cls:'',reflect:false},label:'免疫'}]}]}}}]};
      const [r]=await h.play(side,{self:h.unit('S',40000,[skill()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:immune}})});
      assert.ok(!h.statuses(r.opp).includes('害怕'));assert.ok(h.statuses(r.self).includes('狂暴'),r.logs.join('\n'));
      const miss={...skill(),accuracy:0,isSureHit:false};
      const [m]=await h.play(side,{self:h.unit('S',40000,[miss],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[h.wait()])});
      assert.ok(m.opp.skills[0].pp>0,m.logs.join('\n'));assert.ok(!h.statuses(m.opp).includes('害怕'));assert.ok(!h.statuses(m.self).includes('狂暴'));
    });
    await check(`${side} 先手只封當回合屬性技能；後手不封`,async()=>{
      const firstOnly={...skill(),power:0,category:'屬性',kit:skill().kit.filter((e:any)=>[0,1].includes(e.order))};
      for(const first of [true,false]){
        const heal={...h.healSkill(1000),priority:first?0:2};
        const [r]=await h.play(side,{self:h.unit('S',50000,[firstOnly],{speed:200}),opp:h.unit('E',40000,[heal],{maxHp:50000})});
        assert.equal(r.opp.currentHp,first?40000:41000,r.logs.join('\n'));
      }
    });
    await check(`${side} 傷害免疫才轉等量真傷，減傷與滿血不誤判；可編輯比例重載後生效`,async()=>{
      for(const mode of ['normal','full','immune','reduced','cap']){
        const defense=mode==='immune'?trait('dmg_mod',{dir:'in',kind:'百分比',reduce:1}):mode==='reduced'?trait('dmg_mod',{dir:'in',kind:'百分比',reduce:.5}):mode==='cap'?trait('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:0,turns:2}):undefined;
        const [r]=await h.play(side,{self:h.unit('S',mode==='full'?50000:40000,[damageOnly()],{maxHp:50000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:defense}})});
        assert.equal(r.opp.currentHp,100000-(mode==='cap'?0:mode==='reduced'?45:90),mode+'\n'+r.logs.join('\n'));
        assert.equal(r.self.currentHp,mode==='full'?50000:40000+(mode==='normal'?90:mode==='reduced'?45:0),mode+'\n'+r.logs.join('\n'));
      }
      let edits=0;
      const edited=roundtrip(damageOnly(),b=>{if(b.type==='sequence_action'&&b.getFieldValue('OP')==='dmg'){const p=JSON.parse(b.getFieldValue('PARAMS'));p.ratio=.1;b.setFieldValue(JSON.stringify(p),'PARAMS');edits++;}});assert.equal(edits,1);
      const [r]=await h.play(side,{self:h.unit('S',40000,[edited],{maxHp:50000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:trait('dmg_mod',{dir:'in',kind:'百分比',reduce:1})}})});
      assert.equal(r.opp.currentHp,99970,r.logs.join('\n'));assert.equal(r.self.currentHp,40000);
    });
  }
  console.log(`傷害免疫分支整份遷移：${checks}項通過，未授予全部定義全文語意驗收`);
}finally{await h.close();}
