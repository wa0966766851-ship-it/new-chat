import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_SEED as seed,IMMORTAL_AINS_SOUL_KIT as soulKit} from '../src/data/immortalAins';
import {IMMORTAL_AINS_SKILLS as skills,IMMORTAL_AINS_SUBDUE as subdue} from '../src/data/immortalAinsSkills';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
try{
 defineCustomBlocks();
 for(const [kind,entries] of [['soulmark',soulKit],...[...skills,subdue].map(s=>['skill',s.kit!])] as const){
  for(const e of entries as any[]){
   if(e.codeId==='effect_sequence')assert.equal(sequenceIssue(e.params.clause,e.node),null,`${e.customText}`);
   const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{buildEntryBlock(w as any,e);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser(kind as any)(r.getTopBlocks(false)[0],e.node,e.order),e);}finally{w.dispose();r.dispose();}
  }
 }
 for(const s of [...skills,subdue])h.assertKitOnly(s);
 for(const s of [...skills,subdue]){const actual=h.find('5038',s.name);assert.equal(actual.effectMode,'kit','正式資料入口使用已驗證積木');assert.equal(actual.description,s.description,'正式入口不以舊描述覆蓋新技能');assert.deepEqual(actual.kit,s.kit);}
 assert.equal(skills.filter(s=>s.isFifthSkill).length,1);assert.equal(skills[4].name,'王.焚燼世焰');
 const {makeEffectPresentation}=await h.server.ssrLoadModule('/src/battle/effectPresentation.ts');
 assert.equal(makeEffectPresentation({recoveryBacklash:200},'諸邪皆焚').polarity,'negative');
 assert.ok(makeEffectPresentation({recoveryMultiplier:2},'魂印').label.includes('×2'));
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const purge=skills[0],king=skills[3],world=skills[4];
  const heal=h.healSkill(1000);
  const result=await h.play(side,{self:h.unit('S',100000,[purge,h.wait()],{speed:200}),opp:h.unit('O',10000,[heal],{maxHp:20000}),turns:(_e,t)=>[t===1?0:1,0]},4);
  // 第一次攻擊公式獨立，後續僅恢復反噬；三回合後恢復量恢復正常。
  const hp=result.map(r=>r.opp.currentHp);
  assert.equal(hp[1],hp[0]-200);assert.equal(hp[2],hp[1]-200);assert.equal(hp[3],hp[2]+1000);
  const burnConversion=h.kitSkill('限定下一燒傷',[{op:'status_convert_uses',p:{side:'opp',count:1,fromStatus:'燒傷',status:'焚燼'}}]);
  const burns=h.kitSkill('自身燒傷',[{op:'status',p:{side:'self',status:'燒傷',chance:100}}]);
  const converted=await h.play(side,{self:h.unit('S',100000,[burnConversion],{speed:200}),opp:h.unit('O',100000,[burns])},1);
  assert.ok(h.statuses(converted[0].opp).includes('焚燼'),'對手自行附加燒傷也會轉化');
  assert.ok(!h.statuses(converted[0].opp).includes('燒傷'));
  const reversed=await h.play(side,{self:h.unit('S',100000,[king],{speed:200,statStages:{atk:-2,def:2}}),opp:h.unit('O',100000,[h.kitSkill('施加中毒',[{op:'status',p:{side:'opp',status:'中毒',chance:100}}])])},1);
  assert.equal(reversed[0].self.statStages.atk,2,'修正後只反轉自身下降');
  assert.equal(reversed[0].self.statStages.def,2,'自身既有強化不被反轉');
  assert.ok(h.statuses(reversed[0].self).includes('易燃'),'反轉成功後下一異常轉易燃');
  // 清除成功後只封下兩次屬性技能；無效附加分支不依賴主技能命中。
  const shield=h.turnEffectSkill();
  const sealed=await h.play(side,{self:h.unit('S',100000,[h.wait(),purge],{speed:200}),opp:h.unit('O',100000,[shield,h.kitSkill('強化',[{op:'stat',p:{side:'self',stats:['攻擊'],v:1}}])]),turns:(_e,t)=>[t===2?1:0,t===1?0:1]},5);
  assert.equal(sealed[1].opp.statStages.atk||0,0);assert.equal(sealed[2].opp.statStages.atk||0,0,'兩次屬性技能無效');assert.equal(sealed[3].opp.statStages.atk,1,'第三次屬性技能正常');
  const invalidate=h.kitSkill('無效對手攻擊',[{op:'invalid_turns',p:{kind:'攻擊',turns:2}}]);
  const invalid=await h.play(side,{self:h.unit('S',100000,[purge],{speed:100}),opp:h.unit('O',100000,[{...invalidate,priority:6}],{speed:300,statStages:{atk:2,def:-2}})},1);
  assert.equal(invalid[0].opp.statStages.atk,0);assert.equal(invalid[0].opp.statStages.def,0);assert.ok(h.statuses(invalid[0].opp).includes('焚燼'),'主技能無效仍執行原生失敗分支');
  // 第五技能的75%與秩序之火150%只作用技能傷害，百分比吸取不偷吃增傷。
  const attacks:number[]=[];const drains:number[]=[];let markMode=false;
  const {runAct}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
  h.S.S=(_ctx:any,event:any,d:any)=>{if(event===T.BATTLE_START&&markMode)runAct(_ctx,{op:'resource_mark_add',p:{side:'opp',scope:'elf',id:'orderFire',name:'秩序之火',amount:1,persistsOffField:true,unit:'道',displayChar:'火',description:'測試條件'}},{last:null,lastAmount:0});if(event===T.OPPONENT_DAMAGE){if(d.damageType==='skill_attack')attacks.push(d.hpReduced);if(d.damageType==='percent')drains.push(d.hpReduced);}};
  h.S.O=(_ctx:any,event:any,d:any)=>{const comp=d?.damageComp||d;if(event===T.BEFORE_DAMAGE&&comp.isIncoming&&comp.damageCategory==='skill_attack')comp.base=100;};
  for(const mode of ['none','both','mark']){markMode=mode==='mark';
   await h.play(side,{self:h.unit('S',100000,[world],{speed:200,extra:mode==='both'?{battleStatuses:{中毒:3}}:{}}),opp:h.unit('O',90000,[h.wait()],{extra:mode==='both'?{battleStatuses:{中毒:3}}:{}})},1);
  }
  assert.deepEqual(attacks,[100,175,250],'無異常100、雙方異常175、秩序之火無條件250');assert.deepEqual(drains,[30000,30000,30000],'吸取保持對手上限1/3百分比');
  delete h.S.S;delete h.S.O;
  const windowDamage:number[]=[];
  h.S.S=(_ctx:any,event:any,d:any)=>{if(event===T.OPPONENT_DAMAGE&&d.damageType==='skill_attack')windowDamage.push(d.hpReduced);};
  h.S.O=(_ctx:any,event:any,d:any)=>{const comp=d?.damageComp||d;if(event===T.BEFORE_DAMAGE&&comp.isIncoming&&comp.damageCategory==='skill_attack')comp.base=100;};
  const window=h.kitSkill('當回合及下次攻擊增傷',[{op:'damage_boost_current_or_next_attack',p:{boost:1}}]);
  const attack={...h.wait(),name:'物理測試',category:'物理',power:30};
  await h.play(side,{self:h.unit('S',100000,[window,attack],{speed:200}),opp:h.unit('O',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},3);
  assert.deepEqual(windowDamage,[200,100],'當回合沒攻擊則保留到下一次攻擊，之後消耗');
  windowDamage.length=0;
  await h.play(side,{self:h.unit('S',100000,[{...window,category:'物理',power:30},attack],{speed:200}),opp:h.unit('O',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.deepEqual(windowDamage,[200,100],'當回合命中只加一次100%，不重疊且回合末結束');
  delete h.S.S;delete h.S.O;
  const zero=h.kitSkill('百分比歸零',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'百分比',cap:0,turns:3}}]);
  const failedDrain=await h.play(side,{self:h.unit('S',100000,[world],{speed:100}),opp:h.unit('O',90000,[zero],{speed:300})},1);
  assert.ok(h.statuses(failedDrain[0].opp).includes('焚燼'),'吸取結算未扣血才焚燼');
  const first=await h.play(side,{self:h.unit('S',100000,[world,h.wait()],{speed:100}),opp:h.unit('O',100000,[{...h.wait(),priority:6}],{speed:300,statStages:{atk:1}}),turns:(_e,t)=>[t===1?0:1,0]},4);
  const actions=(i:number)=>first[i].logs.slice(i?first[i-1].logs.length:0).filter((l:string)=>l.includes('使用了'));
  assert.ok(actions(1)[0].includes('S'));assert.ok(actions(2)[0].includes('S'));assert.ok(actions(3)[0].includes('O'),'兩回合強制先手到期');
  // 較低體力分支：在對手使用技能後才取得減傷及全恢復倍率，當回合有效。
  const fragment={...seed.soulMark,kit:soulKit.filter(e=>[10,11].includes(e.order))};
  const low=await h.play(side,{self:h.unit('S',1000,[h.healSkill(100)],{maxHp:4000,speed:100,extra:{soulMark:fragment}}),opp:h.unit('O',10000,[h.wait()],{speed:300})},1);
  assert.equal(low[0].self.currentHp,700,'先恢復200，燒傷500為真實傷害，不受非真實減傷影響');assert.ok(!low[0].state[`${other}Marks`].some((m:any)=>m.id==='orderFire'));
  const snapshot=await h.play(side,{self:h.unit('S',2000,[h.wait()],{maxHp:4000,speed:100,extra:{soulMark:fragment}}),opp:h.unit('O',1000,[h.healSkill(3000)],{maxHp:10000,speed:300})},1);
  assert.equal(snapshot[0].state[`${other}Marks`].find((m:any)=>m.id==='orderFire')?.count,1,'判定用回合開始快照，不因對手先回血改分支');
  // 完整魂印：初始召喚與實戰面板快照，沒有混入舊版魂印。
  const full=await h.play(side,{self:h.unit('S',10000,[h.wait()],{speed:200,extra:{soulMark:seed.soulMark}}),opp:h.unit('O',10000,[h.wait()])},1);
  const extras=full[0].state[`${side}Team`].filter((e:any)=>e.isExtra);
  assert.equal(extras.length,1);assert.equal(extras[0].name,'不滅神焰');assert.equal(extras[0].maxHp,10000);assert.equal(extras[0].calculatedStats.atk,300);
  const fire=full[0].state[`${other}Marks`].find((m:any)=>m.id==='orderFire');assert.equal(fire?.count,1,'同體力回合開始快照走不低於分支');
  assert.ok(h.statuses(full[0].self).includes('燒傷'));assert.ok(h.statuses(full[0].opp).includes('燒傷'));
  const lethal=h.kitSkill('致命真實傷害',[{op:'dmg',p:{flat:20000,type:'真實'}}]);
  const defended=await h.play(side,{self:h.unit('S',10000,[h.wait()],{speed:200,extra:{soulMark:seed.soulMark}}),opp:h.unit('O',100000,[lethal])},2);
  assert.ok(defended.every(r=>r.self.currentHp>0),'完整魂印神焰存在且處於燒傷，可重複抵擋致命傷害');
  assert.ok(defended[1].state[`${side}Team`].some((e:any)=>e.isExtra&&e.currentHp>0));
  console.log(`✓ ${side} 艾恩斯全資料積木往返、三回合恢復反噬、限定燒傷轉化、自身下降反轉、完整魂印召喚與秩序之火`);
 }
}finally{delete h.S.S;delete h.S.O;await h.close();}


