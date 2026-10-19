import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {applyFormulaProperties}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
  const {skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const {getTypeMatchup}=await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
  defineCustomBlocks();
  for(const [name,colour,element] of [['逐波','藍色','水'],['燼世','紅色','火'],['纏根','綠色','草']]){
    const full=structuredClone(h.find('5035',name));
    const entries=full.kit.filter((e:any)=>e.codeId==='skill_property');
    for(const e of entries)assert.equal(skillPropertyIssue(e),null);
    const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      for(const e of entries){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
      assert.deepEqual(reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}),entries);
    }finally{ws.dispose();reload.dispose();}
    const skill={...full,name:'改名公式技能',kit:entries,power:100};
    for(const side of ['p1','p2'] as const){
      const other=side==='p1'?'p2':'p1';
      const self=h.unit('公式持有者',10000,[skill]);const target=h.unit('公式受方',100000,[h.wait()],{type:'火'});
      const ctx:any={actor:side,targetSide:other,self,target,p1Timers:[],p2Timers:[],getPlayerState:()=>0,setPlayerState:()=>{},getMarks:()=>[]};
      const plain=applyFormulaProperties(skill,ctx);
      assert.deepEqual(plain.resolvedAttackStats,['atk','spatk']);assert.equal(plain.resolvedForceStab,true);assert.equal(plain.type,skill.type);
      for(const owner of ['另一持有者',self.battleId]){
        ctx.getMarks=(s:string)=>s===side?[{id:'hamo_scale_'+colour,count:1,ownerBattleId:owner,scope:'elf'}]:[];
        const view=applyFormulaProperties(skill,ctx);
        if(owner!==self.battleId){assert.equal(view.resolvedForceStab,true);continue;}
        assert.equal(view.resolvedForceStab,false);
        assert.equal(getTypeMatchup(view.type,target.type),Math.max(getTypeMatchup(element,target.type),getTypeMatchup('龍',target.type)));
      }
      self.isInherentInvalid=true;
      const sealed=applyFormulaProperties(skill,ctx);assert.equal(sealed.resolvedAttackStats,undefined);assert.equal(sealed.resolvedForceStab,false);assert.equal(sealed.type,skill.type);
      self.isInherentInvalid=false;ctx.getMarks=()=>[];
      const reference={...skill,name:'面板對照',kit:entries.filter((e:any)=>['sure_hit','base_priority'].includes(e.params.property))};
      const referenceSelf=h.unit('面板對照者',10000,[reference],{type:skill.type});referenceSelf.calculatedStats.spatk=600;
      const [actual]=await h.play(side,{self,opp:target});
      const [expected]=await h.play(side,{self:referenceSelf,opp:h.unit('公式受方',100000,[h.wait()],{type:'火'})});
      assert.equal(actual.opp.currentHp,expected.opp.currentHp,'正式引擎雙攻總和及本系加成等於實際面板600的對照公式');
      const edited=structuredClone(skill);
      edited.kit.find((e:any)=>e.params.property==='attack_stat_sum').params.value=['atk'];
      const [changed]=await h.play(side,{self:h.unit('編輯公式者',10000,[edited]),opp:h.unit('公式受方',100000,[h.wait()],{type:'火'})});
      assert.ok(changed.opp.currentHp>actual.opp.currentHp,'編輯能力加總參數會改變正式傷害，不能只是顯示積木');
    }
    const sum=structuredClone(entries.find((e:any)=>e.params.property==='attack_stat_sum'));
    sum.params.value=['atk','atk'];assert.ok(skillPropertyIssue(sum),'重複能力不可重算兩次');
    sum.params.value=['speed'];assert.ok(skillPropertyIssue(sum),'不接受未知公式能力');
  }
  console.log('三招固有公式：P1/P2正式傷害、改名、龍鱗持有者隔離、固有失效及Blockly保存通過');
}finally{await h.close();}
