import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';

const h=await createHarness();
try {
  const {ELF_GROUPS,ELF_GROUP_CODES,ELF_GROUP_EFFECTS,activeAlienTrait,elfGroupCondition,hasElfGroup}=
    await h.server.ssrLoadModule('/src/data/elfGroups.ts');
  const {opByCode,opCode}=await h.server.ssrLoadModule('/src/data/opCatalog.ts');
  const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const {isAlienElf}=await h.server.ssrLoadModule('/src/battle/advancedDamageModifiers.ts');
  const {matchesElfQuery}=await h.server.ssrLoadModule('/src/utils/elfSearch.ts');
  assert.equal(ELF_GROUPS.length,Object.keys(ELF_GROUP_CODES).length);
  assert.equal(new Set(Object.values(ELF_GROUP_CODES)).size,ELF_GROUPS.length);
  for(const group of ELF_GROUPS)assert.match(ELF_GROUP_CODES[group.id],/^EG-[0-9]{3}$/);
  for(const effect of Object.values(ELF_GROUP_EFFECTS) as {ops:string[]}[])
    for(const op of effect.ops)assert.ok(opCode(op,'condition') ?? opCode(op),op);
  assert.equal(opByCode('Q-106'),'elf_group');
  assert.ok(matchesElfQuery({id:'5035'},'tag:EG-005'));
  assert.ok(hasElfGroup({id:'5015'},'EG-005'));
  assert.ok(hasElfGroup({id:'arena_14'},'EG-006'));
  assert.ok(hasElfGroup({id:'extra',isExtra:true},'EG-031'));
  assert.equal(hasElfGroup({id:'5015',groupIds:[]},'elf-king'),false);
  assert.equal(hasElfGroup({id:'custom_n',isAlienElf:true,groupIds:[]},'EG-001'),false);
  const alienTrait={name:'測試異能特質'};
  assert.equal(activeAlienTrait({id:'custom_n',isAlienElf:true,groupIds:[],alienTraits:{alienTrait}}),undefined);
  assert.equal(activeAlienTrait({id:'custom_n',groupIds:['alien'],alienTraits:{alienTrait}}),alienTrait);
  assert.equal(isAlienElf({id:'custom_n',groupIds:['alien']}),true);
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const apostle=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5026');
  const apostleTrait=[apostle.alienTraits.exclusiveTrait,...(apostle.alienTraits.exclusiveTraits||[])].find(t=>t?.name==='無序星魂使徒');
  assert.equal(apostleTrait?.effectMode,'kit');
  const hit={...h.wait(),name:'使徒測試攻擊',power:80,category:'物理'};
  const damage=async (groupIds:string[])=>{
    const [r]=await h.play('p1',{self:h.unit('S',100000,[hit],{extra:{alienTraits:{exclusiveTrait:apostleTrait}}}),
      opp:h.unit('E',100000,[h.wait()],{extra:{groupIds}})});
    return 100000-r.opp.currentHp;
  };
  const plainDamage=await damage([]);
  assert.ok(plainDamage>0);
  assert.ok(Math.abs(await damage(['alien'])-plainDamage*2)<=1);
  console.log('✓ 團體序號、既有積木連接、異能條件與精靈王標籤覆寫');

  const group='custom:group:測試同盟';
  const attack=h.kitSkill('依團體判定',[{op:'stat',p:{side:'self',stats:['攻擊'],v:1}}]);
  const entry=attack.kit[0];
  entry.params.clause.body[0].cond=[elfGroupCondition(group,'opp')];
  assert.equal(sequenceIssue(entry.params.clause),null);
  assert.ok(sequenceIssue({...entry.params.clause,cond:[elfGroupCondition('EG-999')]}));
  assert.ok(sequenceIssue({...entry.params.clause,cond:[elfGroupCondition('EG-006','defeated')]}));
  const kill={...entry,node:'on_kill',source:'mechanic',role:'innate',params:{clause:{...entry.params.clause,trig:'kill',
    body:[{acts:[{op:'stat',p:{side:'self',stats:['攻擊'],v:2},label:'命中擊敗者的團體'}],
      cond:[elfGroupCondition('EG-006','defeated')]}]}}};
  assert.equal(sequenceIssue(kill.params.clause),null);
  defineCustomBlocks();
  const work=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try {
    buildEntryBlock(work as any,entry);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(work),reload);
    const restored=createKitBlockParser('skill')(reload.getTopBlocks(false)[0],entry.node,entry.order);
    assert.deepEqual(restored?.params.clause.body[0].cond,entry.params.clause.body[0].cond);
  } finally {work.dispose();reload.dispose();}

  for(const side of ['p1','p2'] as const) {
    const tagged={groupTags:[{id:group,kind:'group',name:'測試同盟'}],groupIds:['dragon-soul']};
    const plain={groupIds:['battle-alliance']};
    for(const [tags,expected] of [[tagged,1],[plain,0]] as const){
      const [r]=await h.play(side,{self:h.unit('S',10000,[attack]),opp:h.unit('E',500,[h.wait()],{extra:tags})});
      assert.equal(r.self.statStages.atk??0,expected);
    }
    const finisher={...h.wait(),name:'擊敗',power:10000,category:'物理'};
    const [r]=await h.play(side,{self:h.unit('S',10000,[finisher],{extra:{trait:{name:'團體擊敗',effectMode:'kit',kit:[kill]}}}),
      opp:h.unit('E',500,[h.wait()],{extra:tagged})});
    assert.equal(r.opp.currentHp,0);
    assert.equal(r.self.statStages.atk,2);
  }
  console.log('✓ Blockly 保存重載，P1／P2 自訂團體與實際擊敗對象結算');
} finally { await h.close(); }
