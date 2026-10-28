import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
try {
 const {getSoulMarkRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 for(const name of ['5016','1013','變革·馬爾修斯','馬爾修斯','mars_reform']) assert.equal(getSoulMarkRegistry()[name],undefined,'馬爾修斯不得依賴空殼登記');
 checks++;
 const {MIGRATED_5028_LAN_SOUL_KIT:lan}=await h.server.ssrLoadModule('/src/data/migrated5028LanSoulKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 defineCustomBlocks();const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
 try{
  for(const e of lan.kit){assert.equal(kitEntryIssue(e),null,e.customText);buildEntryBlock(workspace as any,e);}
  Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
  const restored=reload.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,e.node,e.order)}).sort((a,b)=>a!.order-b!.order);
  assert.deepEqual(restored,[...lan.kit].sort((a,b)=>a.order-b.order));checks++;
 }finally{workspace.dispose();reload.dispose();}
 const {markCapability,retainShield}=await h.server.ssrLoadModule('/src/battle/markCapabilities.ts');
 const {markRecoveryReduction}=await h.server.ssrLoadModule('/src/battle/markRecovery.ts');
 const {reductionPolicy,effectiveReduction}=await h.server.ssrLoadModule('/src/battle/damageReduction.ts');
 const {resolveDamageBlocking}=await h.server.ssrLoadModule('/src/battle/damageBlocking.ts');
 const water='blk_永恆之水',tears='blk_千秋一淚';
 const mark=(id:string,count:number,ownerBattleId='S')=>({id,name:id,count,scope:'elf',ownerBattleId});
 const elf=h.unit('S',1000,[h.wait()],{extra:{shield:1000,marks:[mark(water,1)]}});
 assert.equal(retainShield(elf,0),300);assert.equal(markCapability(elf,'statusChanceFloor'),100);
 elf.marks.push(mark(tears,3));assert.equal(retainShield(elf,0),0);checks++;
 for(let count=1;count<=4;count++){
  const marks=[mark(tears,count)];assert.equal(markRecoveryReduction(marks,elf),.25*count);
  const policy=reductionPolicy({p1Timers:[],p2Timers:[],p1Marks:marks,p2Marks:[]},'p1',elf,'skill_attack');
  assert.equal(policy.attenuation,.5**Math.floor(count/2));
  assert.equal(effectiveReduction({damageCategory:'skill_attack',reductionPolicy:policy},1),count===4?0:.5**Math.floor(count/2));
  let consumed=false;const comp:any={damageCategory:'skill_attack',reductionPolicy:policy,damageBlocks:new Map([['b',()=>consumed=true]])};
  assert.equal(resolveDamageBlocking(comp,100),count===4?100:0);assert.equal(consumed,count!==4);checks++;
 }
 const source=(orders:number[],shield=0)=>h.unit('S',10000,[h.wait()],{extra:{shield,soulMark:{name:'瀾',effectMode:'kit',kit:structuredClone(lan.kit).filter((e:any)=>orders.includes(e.order))}}});
 const {MIGRATED_REY_SKILL_KITS:reySkills}=await h.server.ssrLoadModule('/src/data/migratedReySkillKits.ts');
 const {MIGRATED_REY_THUNDER_KIT:thunder}=await h.server.ssrLoadModule('/src/data/migratedReyKits.ts');
 const {MIGRATED_FINAL_MARS_SKILL_KITS:marsSkills}=await h.server.ssrLoadModule('/src/data/migratedFinalMarsLanDragonKits.ts');
 for(const side of ['p1','p2'] as const){
  const fifth=reySkills.find((s:any)=>s.name==='霆·禁雷敕令');
  const lossSkill={...h.wait(),name:fifth.name,effectMode:'kit',kit:structuredClone(fifth.kit).filter((e:any)=>e.order===2)};
  let [loss]=await h.play(side,{self:h.unit('R',600,[lossSkill],{maxHp:1000}),opp:h.unit('E',5000,[h.wait()],{maxHp:10000})});
  assert.equal(loss.opp.currentHp,4720,'自身損失400×70%，不取對手已損失5000');checks++;
  const hit={...h.wait(),name:'物理',category:'物理',power:1,isSureHit:true};
  const healer=h.unit('R',500,[hit],{maxHp:1000,extra:{soulMark:{name:'雷神測試',effectMode:'kit',kit:structuredClone(thunder.kit).filter((e:any)=>e.order===9)}}});
  const [heal]=await h.play(side,{self:healer,selfBench:[h.unit('B',20,[h.wait()],{maxHp:1000})],opp:h.unit('E',10000,[h.kitSkill('減少恢復',[{op:'heal_reduce_turns',p:{ratio:.5,turns:2}}])],{speed:500})});
  assert.equal(heal.self.currentHp,570,'恢復量降低後仍至少70');
  assert.equal(heal.state[side+'Team'][1].currentHp,90,'場下隊友按實際增加70恢復');checks++;
  const core=marsSkills.find((s:any)=>s.name==='核心重構');
  const cure={...h.wait(),name:core.name,effectMode:'kit',kit:structuredClone(core.kit).filter((e:any)=>e.order===1)};
  const [archive]=await h.play(side,{self:h.unit('M',1000,[cure],{extra:{battleStatuses:{燒傷:3}}}),opp:h.unit('E',10000,[h.wait()])});
  assert.ok(archive.state[side+'RegistryState'].mechArchivedStatuses?.includes('燒傷'),'核心解除異常寫進魂印共享紀錄');checks++;

  let [r]=await h.play(side,{self:source([1],100),opp:h.unit('E',10000,[h.wait()],{extra:{shield:200}})});
  assert.equal(r.self.shield,1000,'600固定盾＋登場前雙方300＋原有100');checks++;
  const statusSelf=source([]);statusSelf.marks=[mark(water,1)];
  statusSelf.skills=[h.kitSkill('低機率狀態',[{op:'status',p:{side:'opp',status:'中毒',chance:0,turns:3}}])];
  [r]=await h.play(side,{self:statusSelf,opp:h.unit('E',10000,[h.wait()])});
  assert.ok(h.statuses(r.opp).includes('中毒'),'水將低於100%的狀態附加升至100%');checks++;
  const guardedStatus=h.unit('E',10000,[h.wait()]);
  // 免疫以正式積木建立，避免自行猜測精靈種子旗標。
  guardedStatus.skills=[h.kitSkill('免疫',[{op:'immune_status_turns',p:{turns:3,cls:'',reflect:false}}])];
  guardedStatus.calculatedStats.speed=500;
  [r]=await h.play(side,{self:statusSelf,opp:guardedStatus});
  assert.ok(!h.statuses(r.opp).includes('中毒'),'提升機率不繞過正式免疫');checks++;
  const shield=(n:number)=>h.kitSkill('加盾'+n,[{op:'shield',p:{flat:n}}]);
  const self=source([0]);self.skills=[shield(99),shield(100)];
  let hist=await h.play(side,{self,opp:h.unit('E',10000,[h.wait()]),turns:(_e:any,t:number)=>[t===3?1:0,0]},3);
  assert.equal((hist[1].opp.marks||[]).find((m:any)=>m.id===tears)?.count||0,0,'99+99不可累計冒充單次100');
  assert.equal(hist[2].opp.marks.find((m:any)=>m.id===tears)?.count,1,'第三次100增加1道');checks++;
  const muted=source([]);muted.marks=[mark(tears,3)];muted.calculatedStats.speed=500;
  muted.skills=[h.kitSkill('帶附加護盾',[
   {op:'shield',p:{flat:100}},
   {op:'watch',p:{trig:'shield_broken',body:[{acts:[{op:'dmg',p:{flat:400,type:'固定'},label:'破盾附加'}]}]}},
  ]),shield(100)];
  const breaker=h.unit('E',10000,[h.kitSkill('破盾',[{op:'clear_shield',p:{side:'opp',kind:'shield'}}])]);
  const mutedHistory=await h.play(side,{self:muted,opp:breaker,turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.equal(mutedHistory[0].opp.currentHp,10000,'3淚停用破盾附加');
  assert.equal(mutedHistory[1].opp.currentHp,10000,'下一面盾不復活舊附加監看');checks++;
  const guarded=source([3],100);[r]=await h.play(side,{self:guarded,opp:h.unit('E',10000,[h.kitSkill('固定',[{op:'dmg',p:{flat:1000,type:'固定'}}])])});
  assert.equal(r.self.currentHp,9967,'100點盾快照減半後仍受當前盾總和三分之一上限');checks++;
  [r]=await h.play(side,{self:source([3]),opp:h.unit('E',10000,[h.kitSkill('無盾固定',[{op:'dmg',p:{flat:1000,type:'固定'}}])])});
  assert.equal(r.self.currentHp,9000,'不足100點盾不產生0上限假免傷');checks++;
  const reborn=source([10]);reborn.maxHp=reborn.currentHp=1000;
  reborn.skills=[h.kitSkill('準備印記',[
   {op:'resource_mark_add',p:{id:water,name:'永恆之水',description:'測試',displayChar:'水',unit:'道',side:'self',scope:'elf',persistsOffField:true,amount:4,maxCount:8}},
   {op:'resource_mark_add',p:{id:tears,name:'千秋一淚',description:'測試',displayChar:'淚',unit:'道',side:'opp',scope:'elf',persistsOffField:true,amount:2,maxCount:4}},
  ]),h.wait()];reborn.calculatedStats.speed=500;
  hist=await h.play(side,{self:reborn,opp:h.unit('E',10000,[h.kitSkill('致死',[{op:'dmg',p:{flat:2000,type:'真實'}}])]),turns:(_e:any,t:number)=>[t===1?0:1,0]},3);
  assert.equal(hist[0].self.currentHp,1000);assert.equal(hist[1].self.currentHp,1000,'仍有配對資源時可再次重生');assert.equal(hist[2].self.currentHp,0,'消耗完畢不再重生');checks++;
 }
 console.log('G4 resolution '+checks+' checks passed');
}finally{await h.close();}
