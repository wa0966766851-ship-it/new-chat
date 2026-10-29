import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {kitEntryIssue} from '../src/effects/effectConnection';
import {createHarness} from './helpers/migrationHarness';

// 正式封裝技能的數值驗收。反事實基準只移除差值傷害，保留普通攻擊、記憶、狀態及反彈。
const h=await createHarness();let checks=0;
const check=async(name:string,run:()=>void|Promise<void>)=>{await run();checks++;console.log('✓ '+name);};
try{
  const meteor=structuredClone(h.find('5032','殞星衝擊'));
  const {MIGRATED_ASTRAL_AESFIA_SKILLS_2}=await h.server.ssrLoadModule('/src/data/migratedAstralAesfiaKits.ts');
  assert.equal(meteor.description,MIGRATED_ASTRAL_AESFIA_SKILLS_2.find((x:any)=>x.name===meteor.name).description);
  assert.equal(meteor.effectMode,'kit');
  const damageStep=(s:any)=>s.kit.find((e:any)=>e.order===1).params.clause.body[1];
  const withoutDamage=structuredClone(meteor);
  withoutDamage.kit.find((e:any)=>e.order===1).params.clause.body.splice(1,1);
  const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const registry=getBattleSkillRegistry(),old=registry[meteor.name];let legacyCalls=0;
  registry[meteor.name]=()=>{legacyCalls++;throw new Error('Kit不得重播舊殞星衝擊');};
  try{
    defineCustomBlocks();const edited=structuredClone(meteor);
    await check('正式殞星衝擊全條目Blockly保存往返；改差值倍率後仍有嚴格合約',()=>{
      edited.kit=meteor.kit.map((entry:any)=>{
        assert.equal(kitEntryIssue(entry),null);
        const w=new Blockly.Workspace(),r=new Blockly.Workspace();
        try{
          const b=buildEntryBlock(w as any,entry)!;assert.ok(b);
          Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
          assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,entry.node,entry.order),entry);
          if(entry.order===1){
            const action=r.getAllBlocks(false).find((x:any)=>x.type==='sequence_action'&&x.getFieldValue('OP')==='dmg_from_last')!;
            const p=JSON.parse(action.getFieldValue('PARAMS'));p.ratio=0.5;action.setFieldValue(JSON.stringify(p),'PARAMS');
          }
          const saved=Blockly.serialization.workspaces.save(r);w.clear();Blockly.serialization.workspaces.load(saved,w);
          const copy=createKitBlockParser('skill')(w.getBlockById(b.id)!,entry.node,entry.order)!;
          assert.equal(kitEntryIssue(copy),null);return copy;
        }finally{w.dispose();r.dispose();}
      });
      assert.equal(damageStep(edited).acts[0].p.ratio,0.5);
    });
    for(const side of ['p1','p2'] as const){
      const other=side==='p1'?'p2':'p1';
      const selfStats={hp:10000,atk:300,def:300,spatk:300,spdef:300,speed:200};
      const highStats={hp:10200,atk:350,def:290,spatk:320,spdef:400,speed:100};
      const lowerStats={hp:10000,atk:290,def:290,spatk:290,spdef:290,speed:100};
      const run=async(skill:any,stats:any=highStats,prevent=false,turns=1)=>h.play(side,{
        self:h.unit('S',10000,[structuredClone(skill)],{speed:200,extra:{calculatedStats:{...selfStats}}}),
        opp:h.unit('E',stats.hp,[prevent?h.kitSkill('固定免疫',[
          {op:'dmg_mod_turns',p:{side:'self',dir:'in',kind:'固定',reduce:1,turns:5}},
        ],{priority:10}):h.wait()],{speed:stats.speed,extra:{calculatedStats:{...stats}}}),
      },turns);
      await check(`${side} 只加正差值200+50+20+100=370，實際固定扣血370一次`,async()=>{
        const [base]=await run(withoutDamage),[actual]=await run(meteor);
        assert.deepEqual(actual.self.calculatedStats,{hp:10200,atk:350,def:300,spatk:320,spdef:400,speed:200});
        assert.equal(actual.self.maxHp,10200);assert.equal(base.opp.currentHp-actual.opp.currentHp,370,actual.logs.join('\n'));
        const fixed=(r:any)=>r.state[`${other}RegistryState`]?.battleDamageCounts?.fixed||0;
        assert.equal(fixed(actual)-fixed(base),1,'差值固定傷害只執行一次');
      });
      await check(`${side} 無正差值不附加固定傷害，第二次拉平失敗不重用上次差值`,async()=>{
        const [base]=await run(withoutDamage,lowerStats),[actual]=await run(meteor,lowerStats);
        assert.equal(actual.opp.currentHp,base.opp.currentHp);assert.deepEqual(actual.self.calculatedStats,selfStats);
        const full=await run(meteor,highStats,false,2),control=await run(withoutDamage,highStats,false,2);
        assert.equal(full[0].opp.currentHp-full[1].opp.currentHp,control[0].opp.currentHp-control[1].opp.currentHp);
        assert.equal(control[1].opp.currentHp-full[1].opp.currentHp,370);
      });
      await check(`${side} 固定免疫攔370差值傷害，能力提升仍成功`,async()=>{
        const [base]=await run(withoutDamage,highStats,true),[actual]=await run(meteor,highStats,true);
        assert.equal(actual.opp.currentHp,base.opp.currentHp,actual.logs.join('\n'));
        assert.equal(actual.self.calculatedStats.def,300);assert.equal(actual.self.calculatedStats.spdef,400);
      });
      await check(`${side} Blockly倍率改為0.5實扣185，技能改名仍執行通用積木`,async()=>{
        const renamed={...structuredClone(edited),name:'自訂差值技能'};
        const [base]=await run(withoutDamage),[actual]=await run(renamed);
        assert.equal(base.opp.currentHp-actual.opp.currentHp,185,actual.logs.join('\n'));
      });
    }
    assert.equal(legacyCalls,0);console.log(`${checks} 殞星衝擊正式來源／P1P2／Blockly檢查通過`);
  }finally{if(old===undefined)delete registry[meteor.name];else registry[meteor.name]=old;}
}finally{await h.close();}
