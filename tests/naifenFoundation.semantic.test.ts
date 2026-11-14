import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
try{
 const {NAIFEN_SOURCE}=await h.server.ssrLoadModule('/src/data/naifenSource.ts');
 assert.equal(NAIFEN_SOURCE,readFileSync('../elf_source_files/elf_files/月鈴極樂·奈尼芬多.txt','utf8'));
 const {NAIFEN_READY_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/naifenSkills.ts');
 const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 defineCustomBlocks();
 assert.deepEqual(skills.map((s:any)=>[s.name,s.category,s.power]),[['殘響','特殊',90],['安眠調','物理',90],['極樂序曲','物理',0],['踩踏音','特殊',0],['塞壬·極樂終章','屬性',0]]);
 for(const s of skills){h.assertKitOnly(s);for(const entry of s.kit){
  assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,JSON.stringify(entry));
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(ws as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{ws.dispose();reload.dispose();}
 }}
 const [echo,lullaby,overture,stomp]=skills;
 const only=(s:any,prefix:string)=>({...s,category:'屬性',power:0,kit:s.kit.filter((e:any)=>e.params?.clause?.raw.startsWith(prefix))});
 for(const side of ['p1','p2'] as const){
  for(const [hp,want] of [[1000,500],[5000,250]]){
   const [r]=await h.play(side,{self:h.unit('S',hp,[only(echo,'吸取對手250')],{maxHp:10000}),opp:h.unit('E',3000,[h.wait()])});
   assert.equal(r.self.currentHp,hp+want,r.logs.join('\n'));assert.equal(r.opp.currentHp,3000-want);
  }
  const [stolen]=await h.play(side,{self:h.unit('S',10000,[only(echo,'吸取並反轉')]),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2,def:1}})});
  assert.equal(stolen.self.statStages.atk,2);assert.equal(stolen.opp.statStages.atk,-2);assert.equal(stolen.opp.statStages.def,-1);
  const [reverse]=await h.play(side,{self:h.unit('S',10000,[only(echo,'反轉自身')],{statStages:{atk:-2}}),opp:h.unit('E',5000,[h.healSkill(1000)],{maxHp:10000})});
  assert.equal(reverse.self.statStages.atk,2);assert.equal(reverse.opp.currentHp,5000,'反轉成功令下一次屬性技能無效，不能回血');
  const powerOnly={...echo,kit:echo.kit.filter((e:any)=>e.params?.clause?.raw.startsWith('自身體力高於'))};
  const attack=(hp:number,status=false)=>h.play(side,{self:h.unit('S',hp,[powerOnly],{maxHp:10000,extra:status?{battleStatuses:{星佑:3}}:{}}),opp:h.unit('E',100000,[h.wait()])});
  const [plain]=await attack(4000),[boosted]=await attack(6000),[doubled]=await attack(6000,true);
  assert.ok(plain.opp.currentHp>boosted.opp.currentHp&&boosted.opp.currentHp>doubled.opp.currentHp,'半血／異常條件須改變真正攻擊傷害');
  const boost=h.turnEffectSkill();boost.priority=10;
  const [cleared]=await h.play(side,{self:h.unit('S',10000,[only(lullaby,'消除對手回合類')]),opp:h.unit('E',10000,[boost,{...h.wait(),name:'未選攻擊',category:'物理',power:20,pp:7,maxPp:7}])});
  assert.equal(cleared.opp.skills[1].pp,0,cleared.logs.join('\n'));assert.ok(!h.statuses(cleared.opp).includes('睡眠'),'原本有回合效果時不能誤走無效果睡眠分支');
  const [sleep]=await h.play(side,{self:h.unit('S',10000,[only(lullaby,'消除對手回合類')]),opp:h.unit('E',10000,[h.wait()])});
  assert.ok(h.statuses(sleep.opp).includes('睡眠'),sleep.logs.join('\n'));
  const [fullSleep]=await h.play(side,{self:h.unit('S',10000,[lullaby]),opp:h.unit('E',10000,[h.wait()])});
  assert.ok(h.statuses(fullSleep.opp).includes('睡眠'),'原技能主攻擊傷害後仍須保留剛附加的睡眠：'+fullSleep.logs.join('\n'));
  const ppDrain=only(lullaby,'吸取對手所有技能1');
  const [stopped]=await h.play(side,{self:h.unit('S',10000,[{...ppDrain,pp:5,maxPp:20},h.wait()]),opp:h.unit('E',10000,[{...h.wait(),name:'最後一點PP',pp:1,maxPp:20}])});
  assert.equal(stopped.opp.skills[0].pp,0);assert.equal(stopped.self.skills[0].pp,5,'消耗一次再吸取補回一點');
  assert.ok(!stopped.logs.some((l:string)=>l.includes('使用了【最後一點PP】')),stopped.logs.join('\n'));
  const invalidate=h.kitSkill('封鎖一次攻擊',[{op:'invalid_next',p:{kind:'攻擊',uses:1}}],{priority:10});
  const [invalid]=await h.play(side,{self:h.unit('S',10000,[lullaby]),opp:h.unit('E',10000,[invalidate])});
  const {StatusRegistry}=await h.server.ssrLoadModule('/src/effects/statusRegistry.ts');
  assert.ok(h.statuses(invalid.opp).some((name:string)=>StatusRegistry[name]?.categories.includes('CONTROL')),'技能無效後仍從正式控制類全集隨機附加：'+invalid.logs.join('\n'));
  for(const [pp,damage] of [[1,500],[2,250]]){
   const [r]=await h.play(side,{self:h.unit('S',10000,[only(lullaby,'吸取對手250')],{maxHp:20000}),opp:h.unit('E',10000,[h.wait(),{...h.wait(),name:'檢查槽',pp,maxPp:20}])});
   assert.equal(r.opp.currentHp,10000-damage);assert.equal(r.self.currentHp,10000+damage);
  }
  // 每次用技能，首次命中取得後也結算；第六回合不得延續。
  const timed=only(overture,'5回合內使用技能');
  const five=await h.play(side,{self:h.unit('S',10000,[timed,h.wait()]),opp:h.unit('E',10000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},6);
  assert.deepEqual(five.map((r:any)=>r.opp.currentHp),[9910,9820,9730,9640,9550,9550]);
  const miss={...timed,isSureHit:false,accuracy:0};
  const missed=await h.play(side,{self:h.unit('S',10000,[miss,h.wait()]),opp:h.unit('E',10000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.deepEqual(missed.map((r:any)=>r.opp.currentHp),[10000,10000],'首次未命中不得取得後續使用級效果');
  for(const abnormal of [false,true]){
   const [cured]=await h.play(side,{self:h.unit('S',1000,[only(overture,'解除自身所有異常')],{maxHp:10000,extra:abnormal?{battleStatuses:{流血:3}}:{}}),opp:h.unit('E',10000,[h.wait()])});
   assert.equal(cured.self.currentHp,abnormal?10000:1000,'只有解除成功才回滿');assert.ok(!h.statuses(cured.self).includes('流血'));
  }
  const statuses=h.kitSkill('控制與弱化測試',[{op:'status',p:{side:'opp',status:'睡眠',chance:100}},{op:'status',p:{side:'opp',status:'流血',chance:100}}]);
  const [reflected]=await h.play(side,{self:h.unit('S',10000,[only(overture,'5回合內免疫')],{speed:200}),opp:h.unit('E',10000,[statuses],{speed:50})});
  assert.ok(!h.statuses(reflected.self).includes('睡眠'));assert.ok(h.statuses(reflected.opp).includes('睡眠'),'控制狀態反彈給對手');assert.ok(h.statuses(reflected.self).includes('流血'),'只免控，不能擅自擴大成免疫弱化類');
  const cappedStages={atk:-6,def:-6,spatk:-6,spdef:-6,speed:-6,accuracy:-6};
  const shield=h.kitSkill('百分比上限',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'百分比',cap:1,turns:5}}],{priority:10});
  const [failed]=await h.play(side,{self:h.unit('S',10000,[timed]),opp:h.unit('E',10000,[shield],{statStages:cappedStages})});
  assert.equal(failed.opp.currentHp,9910,'下降失敗改真實傷害，不受百分比傷害上限1影響');
  const [success]=await h.play(side,{self:h.unit('S',10000,[timed]),opp:h.unit('E',10000,[shield])});
  assert.equal(success.opp.currentHp,9999,'下降成功走百分比傷害，受上限1限制');
  const steps=await h.play(side,{self:h.unit('S',10000,[stomp]),opp:h.unit('E',100000,[h.wait()])},2);
  assert.equal(steps[0].self.maxHp,10000);assert.equal(steps[1].self.maxHp,10025,'第二次使用前已持有星佑，才增加上限25');
  assert.equal(steps[0].self.statStages.atk,2,'剛取得星佑後，強化以異常條件翻倍');
 }
 console.log('naifenFoundation passed: five skills with strict contracts and Blockly save/reload');
}finally{await h.close();}
