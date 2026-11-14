import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {sequenceIssue} from '../src/effects/sequenceContract';
const h=await createHarness();
try{
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const seed=DEFAULT_ELVES.find((e:any)=>e.id==='5037');
 assert.ok(seed,'精靈必須來自正式資料入口');
 assert.equal(DEFAULT_ELVES.filter((e:any)=>e.id==='5037').length,1,'不得與現有精靈重複序號');
 assert.equal(seed.name,'魔化.瑞爾斯');
 assert.equal(seed.skills.length,5);
 assert.deepEqual(seed.skills.filter((s:any)=>s.isFifthSkill).map((s:any)=>s.name),['何逢萬古·噬']);
 for(const s of seed.skills){h.assertKitOnly(s);for(const e of s.kit)if(e.codeId==='effect_sequence')assert.equal(sequenceIssue(e.params.clause,e.node),null,s.name);}
 const get=(name:string)=>structuredClone(seed.skills.find((s:any)=>s.name===name));
 for(const side of ['p1','p2'] as const){
  // 先手成功消強後才封鎖「使用技能」恢復；先出手吸取300而非150。
  const bite={...get('偏執噬咬'),power:0};
  const [r]=await h.play(side,{self:h.unit('S',500,[bite],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.healSkill(200)],{maxHp:2000,statStages:{atk:1}})});
  assert.equal(r.opp.currentHp,700,r.logs.join('\n'));assert.equal(r.self.currentHp,800);assert.equal(r.opp.statStages.atk,0);
  const [noClear]=await h.play(side,{self:h.unit('S',500,[bite],{maxHp:2000,speed:200}),opp:h.unit('E',1000,[h.healSkill(200)],{maxHp:2000})});
  assert.equal(noClear.opp.currentHp,900,'未消強不能禁止技能回血');

  // 下次技能受傷的一次性逐份吸取：固定傷害不消耗，第一發技能傷害才消耗。
  const fog={...get('黑霧崩墮擊'),power:0};
  const fixed=h.kitSkill('固定30',[{op:'dmg',p:{flat:30,type:'固定'}}]);
  const typed=h.kitSkill('技能30',[{op:'dmg',p:{flat:30,type:'技能',elem:'普通'}}],{category:'物理'});
  const hits=await h.play(side,{self:h.unit('S',500,[fog,h.wait()],{maxHp:1000,speed:200}),opp:h.unit('E',1000,[fixed,typed]),turns:(_e:any,t:number)=>[t===1?0:1,t===1?0:1]},3);
  assert.equal(hits[0].self.currentHp,470);
  assert.equal(hits[1].self.currentHp,470,'受到30技能傷害後逐份吸取30回血');
  assert.equal(hits[1].opp.currentHp,970);
  assert.equal(hits[2].self.currentHp,440,'下次監控消耗後不能再次吸取');
  assert.equal(hits[2].opp.currentHp,970);

  // 解除弱化成功才清空屬性技能PP，攻擊槽不受影響。
  const [cleared]=await h.play(side,{self:h.unit('S',1000,[fog],{statStages:{atk:-1},speed:200}),opp:h.unit('E',1000,[{...h.wait(),pp:5},{...h.wait(),category:'物理',pp:8}]),turns:()=>[0,1]});
  assert.equal(cleared.self.statStages.atk,0);assert.equal(cleared.opp.skills[0].pp,0);assert.equal(cleared.opp.skills[1].pp,7);

  // 屬性技造成的是有屬性的技能傷害；命中後持續回血依實際恢復量追加粉傷。
  const stance=get('墮武極意');
  const [stanceResult]=await h.play(side,{self:h.unit('S',500,[stance],{maxHp:1000,speed:200}),opp:h.unit('E',2000,[h.wait()])});
  assert.equal(stanceResult.self.currentHp,1000);
  assert.equal(stanceResult.opp.currentHp,1250,stanceResult.logs.join('\n'));
  const invalid=h.kitSkill('使下次攻擊無效',[{op:'invalid_next',p:{kind:'攻擊',uses:1}}],{priority:5});
  const [doubleTyped]=await h.play(side,{self:h.unit('S',500,[stance],{maxHp:1000}),opp:h.unit('E',2000,[invalid],{speed:200})});
  assert.equal(doubleTyped.opp.currentHp,1000,'在場有技能無效效果時有屬性傷害250翻倍500，再加實際恢復500');

  const powers:number[]=[];
  h.S.E=(_:any,e:string,d:any)=>{if(e==='MODIFY_POWER'&&d?.isIncoming)powers.push(d.powerComp.power);};
  const fifth=get('何逢萬古·噬');
  await h.play(side,{self:h.unit('S',1000,[fifth],{statStages:{atk:1},speed:200}),opp:h.unit('E',10000,[h.wait()])});
  assert.deepEqual(powers,[380],'先於攻擊公式將190威力翻倍');
  delete h.S.E;
  const buff=get('不滅惡念');
  const probe=h.kitSkill('技能30',[{op:'dmg',p:{flat:30,type:'技能',elem:'普通'}}],{category:'物理'});
  const delayed=await h.play(side,{self:h.unit('S',1000,[buff,probe],{maxHp:5000,speed:200}),opp:h.unit('E',6000,[h.healSkill(2000)]),turns:(_e:any,t:number)=>[t===1?0:1,0]},5);
  assert.equal(delayed[0].opp.currentHp,6000,'下三回合不能在施放當回合提前吸取');
  assert.equal(delayed[1].opp.currentHp,5940,'下回合技能傷害60，再吸取2000；對手回血2000');
  assert.equal(delayed[2].opp.currentHp,5880,'第二回合仍有技能增傷與吸取');
  assert.equal(delayed[3].opp.currentHp,5850,'第三回合只剩吸取，技能傷害恢復為30');
  assert.equal(delayed[4].opp.currentHp,6000,'第四回合兩種效果均已結束');

  const immunePoison=h.kitSkill('自身免疫再施毒',[{op:'immune_status_turns',p:{turns:3}},{op:'status',p:{side:'opp',status:'中毒',turns:3}}]);
  const [failedReflect]=await h.play(side,{self:h.unit('S',1000,[stance],{speed:200}),opp:h.unit('E',3000,[immunePoison])});
  assert.ok(!h.statuses(failedReflect.opp).includes('害怕'),'反彈被免疫時不能轉化其他異常');

  // 正式魂印：對手屬性技後，下一次攻擊無效；每次使用技能的當回合末逐槽吸取。
  const soul=structuredClone(seed.soulMark);
  const [soulResult]=await h.play(side,{self:h.unit('S',500,[{...h.wait(),pp:10,maxPp:20}],{maxHp:1000,speed:200,extra:{soulMark:soul}}),opp:h.unit('E',1000,[{...h.wait(),pp:10,maxPp:20}])});
  assert.equal(soulResult.self.skills[0].pp,11);assert.equal(soulResult.opp.skills[0].pp,7);
  assert.equal(soulResult.self.currentHp,500);
  const [blockedNext]=await h.play(side,{self:h.unit('S',500,[h.wait()],{maxHp:1000,speed:200,extra:{soulMark:soul}}),opp:h.unit('E',1000,[h.wait(),typed]),turns:(_e:any,t:number)=>[0,t===1?0:1]},2).then(rows=>[rows[1]]);
  assert.equal(blockedNext.self.currentHp,833,'對手先前使用屬性技，下一次攻擊無效；按選擇攻擊技能仍回血333');
  assert.equal(blockedNext.opp.currentHp,667,'階段末只附加實際恢復333');
  const tiny=h.kitSkill('技能9',[{op:'dmg',p:{flat:9,type:'技能',elem:'普通'}}],{category:'物理'});
  const [small]=await h.play(side,{self:h.unit('S',500,[tiny],{maxHp:1000,speed:200,extra:{soulMark:soul}}),opp:h.unit('E',1000,[h.wait()])});
  assert.equal(small.opp.currentHp,991,'不足一份不能多吸取');
  assert.equal(small.self.statStages.atk,1);
  assert.ok(h.statuses(small.self).includes('狂暴'),'不足1%技能傷害才強化並狂暴');
  console.log(`✓ ${side} 瑞爾斯逐招與魂印實際結算`);
 }
}finally{await h.close();}
