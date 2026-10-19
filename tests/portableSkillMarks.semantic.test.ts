import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const source=await h.server.ssrLoadModule('/src/data/migrated5019TiwazSoulKit.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {hasPortableDuel,portableSkillCapabilities}=await h.server.ssrLoadModule('/src/battle/portableSkillMarks.ts');
  for(const entry of source.MIGRATED_5019_TIWAZ_SOUL_KIT.kit)assert.equal(kitEntryIssue(entry),null);
  defineCustomBlocks();const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
  try{
    for(const entry of source.MIGRATED_5019_TIWAZ_SOUL_KIT.kit)assert.ok(buildEntryBlock(workspace as any,entry));
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
    assert.deepEqual(restored.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),source.MIGRATED_5019_TIWAZ_SOUL_KIT.kit);
  }finally{workspace.dispose();restored.dispose();}
  const marked=(s:any,m:any)=>({...s,skillRune:m.symbol,isRuneActive:false,portableSkillMark:structuredClone(m)});
  for(const side of ['p1','p2'] as const){
    // ᚾ only activates on its selected slot, applies once, and restores when switched out.
    const holder=h.unit('槽持有者',5000,[h.wait(),marked({...h.wait(),name:'弱化槽'},source.TIWAZ_ENEMY_MARKS[3])]);
    holder.calculatedStats.atk=301;
    const snapshots:any[]=[];
    const history=await h.play(side,{self:holder,opp:h.unit('槽對手',5000,[h.wait()]),selfBench:[h.unit('後備',5000,[h.wait()])],turns:(engine:any,t:number)=>{
      snapshots.push(structuredClone(engine.getState()[side]));return t===1?[0,0]:t===4?[{switch:1},0]:[1,0];
    }},4);
    assert.equal(snapshots[1].calculatedStats.atk,301,'未選附文槽不得降低能力');
    assert.equal(snapshots[2].calculatedStats.atk,240,'選招立即降低20%');
    assert.equal(snapshots[3].calculatedStats.atk,240,'重複選招不能複利降低');
    const original=history[3].state[`${side}Team`][0];
    assert.equal(original.calculatedStats.atk,301,'下場恢復倍率');assert.ok(!original.skills[1].portableSkillMark);
    // ᛇ uses its own skill slot, not another skill with the same name.
    const ppSelf=[h.wait(),{...h.wait(),name:'同步槽',pp:5,maxPp:5}];
    ppSelf[1]=marked(ppSelf[1],source.TIWAZ_ALLY_MARKS[3]);
    const [pp]=await h.play(side,{self:h.unit('同步持有者',5000,ppSelf),opp:h.unit('同步對手',5000,[h.wait(),{...h.wait(),name:'對手同步槽',pp:9,maxPp:9}]),turns:()=>[1,0]});
    assert.equal(pp.opp.skills[1].maxPp,5);assert.equal(pp.opp.currentHp,4600,'4點超額PP轉400真傷');
    // ᛁ reduces every non-true category, without changing true damage.
    const hit=h.kitSkill('分類攻擊',[{op:'dmg',p:{flat:100,type:'固定'}},{op:'dmg',p:{flat:100,type:'百分比'}},{op:'dmg',p:{flat:100,type:'真實'}}]);
    const [damage]=await h.play(side,{self:h.unit('減傷持有者',5000,[marked(hit,source.TIWAZ_ENEMY_MARKS[1])]),opp:h.unit('減傷對手',5000,[h.wait()])});
    assert.equal(damage.opp.currentHp,4800,'固定50、百分比50、真實100');
    // ᚦᚺ blocks new shield/barrier and damages from the actual remaining sum.
    const shield=h.kitSkill('新增護盾',[{op:'shield',p:{flat:100,kind:'shield'}},{op:'shield',p:{flat:100,kind:'barrier'}}]);
    const [guard]=await h.play(side,{self:h.unit('盾持有者',5000,[marked(shield,source.TIWAZ_ENEMY_MARKS[2])],{extra:{shield:300,barrier:200}}),opp:h.unit('盾對手',5000,[h.wait()])});
    assert.equal(guard.self.shield,300);assert.equal(guard.self.barrier,200);assert.equal(guard.self.currentHp,4900);
    // ᛃ drain belongs to the opponent; it must not heal the rune holder.
    const [drain]=await h.play(side,{self:h.unit('被吸取持有者',5000,[marked(h.wait(),source.TIWAZ_ENEMY_MARKS[4])]),opp:h.unit('吸取對手',1000,[h.wait()],{maxHp:5000})});
    assert.equal(drain.self.currentHp,3000);assert.equal(drain.opp.currentHp,3000);
    // ᛈ chooses OUR skill at the opponent's original selected slot.
    const redirect=h.kitSkill('自身二槽',[{op:'dmg',p:{flat:123,type:'真實'}}]);
    const [mirror]=await h.play(side,{self:h.unit('轉換持有者',5000,[marked(h.wait(),source.TIWAZ_ENEMY_MARKS[0]),redirect]),opp:h.unit('轉換對手',5000,[h.wait(),{...h.wait(),name:'對方二槽'}]),turns:()=>[0,1]});
    assert.equal(mirror.opp.currentHp,4877);assert.equal(mirror.self.skills[1].pp,98,'扣轉換後自身槽PP');
    const status=h.kitSkill('控制附加',[{op:'status',p:{side:'opp',status:'麻痺',turns:3,chance:100}}]);
    const [immune]=await h.play(side,{self:h.unit('免疫持有者',5000,[marked(h.wait(),source.TIWAZ_ALLY_MARKS[0])]),opp:h.unit('異常對手',5000,[status])});
    assert.deepEqual(h.statuses(immune.self),[],'選招激活的免疫立即有效');
    const boost=h.kitSkill('能力提升',[{op:'stat',p:{side:'self',stats:['攻擊'],v:2}}]);
    const [up]=await h.play(side,{self:h.unit('封鎖持有者',5000,[marked(h.wait(),source.TIWAZ_ALLY_MARKS[1])]),opp:h.unit('提升對手',5000,[boost])});
    assert.equal(up.opp.statStages.atk||0,0,'封鎖新能力提升，不能反轉現有等級');
    const rg=marked({...h.kitSkill('零PP命中',[{op:'dmg',p:{flat:37,type:'真實'}}]),pp:0,currentPp:0,maxPp:0,accuracy:0,isSureHit:false},source.TIWAZ_ALLY_MARKS[2]);
    const [zeroPp]=await h.play(side,{self:h.unit('零PP持有者',5000,[rg]),opp:h.unit('零PP對手',5000,[h.wait()])});
    assert.equal(zeroPp.opp.currentHp,4963,'激活槽0PP仍能選招且必中');
    assert.equal(zeroPp.self.skills[0].pp,0,'不受PP限制並不把PP補回');
    const [priority]=await h.play(side,{self:h.unit('上限持有者',5000,[marked({...h.wait(),priority:2},source.TIWAZ_ALLY_MARKS[4])],{speed:50}),opp:h.unit('高先制對手',5000,[{...h.wait(),priority:4}],{speed:300})});
    assert.ok(priority.logs.filter((l:string)=>l.includes('使用了'))[0].includes('上限持有者'),'對手+4限制為+1，自身+2先行');
    const eventSoul=(trig:string,node:string)=>({name:'任意事件魂印',description:'語意測試',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'soulmark',role:'innate',node,order:0,customText:'結算恢復',params:{clause:{raw:'結算恢復',trig,parsed:true,body:[{acts:[{op:'heal_flat',p:{amount:77},label:'恢復'}]}]}}}]});
    for(const blocked of [false,true]){
      const damage=h.kitSkill('未擊敗攻擊',[{op:'dmg',p:{flat:10,type:'真實'}}]);
      const [notKilled]=await h.play(side,{self:h.unit('未擊敗持有者',1000,[blocked?marked(damage,{...source.TIWAZ_ENEMY_MARKS[4],rules:[]}):damage],{maxHp:5000,extra:{soulMark:eventSoul('not_killed','on_not_killed')}}),opp:h.unit('未擊敗對手',5000,[h.wait()])});
      assert.equal(notKilled.self.currentHp,blocked?1000:1077,'未擊敗效果依持有者符文封鎖');
      const [onKill]=await h.play(side,{self:h.unit('擊敗封鎖持有者',100,[blocked?marked({...h.wait(),priority:2},source.TIWAZ_ALLY_MARKS[4]):h.wait()],{speed:500}),opp:h.unit('擊敗事件對手',1000,[h.kitSkill('擊敗持有者',[{op:'dmg',p:{flat:200,type:'真實'}}])],{maxHp:5000,extra:{soulMark:eventSoul('kill','on_kill')}})});
      assert.equal(onKill.opp.currentHp,blocked?1000:1077,'持有者對手擊敗效果失效');
    }
    // Stored stripping contract must work without Odin remaining on the field.
    const strip=h.kitSkill('剝離',[{op:'skill_marks_strip',p:{side:'opp',restorePp:false,hpRatio:0,damageRatio:0,nonlethal:true,zeroHighestMaxPp:false}}]);
    const [stripped]=await h.play(side,{self:h.unit('剝離執行者',5000,[strip],{speed:50}),opp:h.unit('敵方符文持有者',500,[marked({...h.wait(),maxPp:120},source.TIWAZ_ENEMY_MARKS[3])],{maxHp:5000,speed:100})});
    assert.equal(stripped.opp.currentHp,1,'激活敵方符文剝離造成20%最大體力真傷並保留1血');
    assert.equal(stripped.opp.skills[0].maxPp,0);assert.equal(stripped.opp.skills[0].pp,0);
    assert.equal(stripped.opp.calculatedStats.atk,300,'剝離同步解除能力倍率');
    // A permanent battle mark starts an individual duel and does not repeatedly multiply stats.
    const grant=h.kitSkill('授予決鬥',[{op:'battle_mark_grant',p:{side:'self',id:'test-duel',name:'決鬥',displayChar:'決',statRatio:1.2,duel:true}}]);
    const [duel]=await h.play(side,{self:h.unit('決鬥持有者',5000,[grant]),opp:h.unit('決鬥對手',5000,[h.wait()])});
    assert.equal(duel.self.calculatedStats.atk,360);assert.equal(hasPortableDuel(duel.self,duel.opp),true);
    const defeatArm=h.kitSkill('預備轉贈',[{op:'skill_mark_inherit_arm',p:{when:'defeated',mode:'runes'}}]);
    const kill=h.kitSkill('擊倒',[{op:'dmg',p:{flat:200,type:'真實'}}]);
    const inherited=await h.play(side,{
      self:h.unit('原符文持有者',100,[marked(defeatArm,source.TIWAZ_ENEMY_MARKS[3])],{speed:300}),
      selfBench:[h.unit('符文繼承者',5000,[h.wait()])],opp:h.unit('繼承對手',5000,[kill]),
      turns:async(engine:any,t:number)=>{if(t===2){engine.onSwitchElf(side,1);await engine.idle();}return [0,0];},
    },2);
    assert.equal(inherited[1].self.id,'符文繼承者');
    assert.equal(inherited[1].self.skills[0].isRuneActive,true,'被擊敗後同槽轉贈並保持激活');
    assert.equal(inherited[1].self.skills[0].portableSkillMark.symbol,'ᚾ');
    assert.equal(inherited[1].self.calculatedStats.atk,240,'繼承激活只套用一次能力倍率');
    const transferActivation=h.kitSkill('預備激活繼承',[{op:'skill_mark_inherit_arm',p:{when:'kill',mode:'activation'}},{op:'dmg',p:{flat:200,type:'真實'}}]);
    const incomingMarks=eventSoul('entrance','on_entered');
    incomingMarks.kit[0].params.clause.body=[{acts:[{op:'skill_marks_assign',p:{side:'self',withinRounds:2,marks:[source.TIWAZ_ALLY_MARKS[0],source.TIWAZ_ALLY_MARKS[4]]},label:'新取得槽印記'}]}] as any;
    const activeDefeated={...marked(h.wait(),source.TIWAZ_ENEMY_MARKS[3]),isRuneActive:true};
    const activationHistory=await h.play(side,{
      self:h.unit('激活同步施加者',5000,[transferActivation],{speed:300}),opp:h.unit('原激活敵方',100,[h.wait(),activeDefeated]),
      oppBench:[h.unit('新激活敵方',5000,[h.wait(),h.wait()],{extra:{soulMark:incomingMarks}})],
      turns:async(engine:any,t:number)=>{if(t===2){engine.onSwitchElf(side==='p1'?'p2':'p1',1);await engine.idle();}return [0,0];},
    },2);
    assert.equal(activationHistory[1].opp.skills[1].portableSkillMark.symbol,'ᛖ','只同步激活狀態，不能複製被擊敗者符文');
    assert.equal(activationHistory[1].opp.skills[1].isRuneActive,true,'未選該槽也從前一隻繼承激活');
    assert.equal(activationHistory[1].opp.calculatedStats.atk,300,'激活同步不得繼承原符文的能力降低');
    // No unconditional Tiwaz stat boost or duel before receiving a battle mark.
    assert.equal(portableSkillCapabilities(h.unit('無印記',1000,[h.wait()])).statusImmune,undefined);
    assert.equal(hasPortableDuel(h.unit('甲',1000,[]),h.unit('乙',1000,[])),false);
  }
  console.log('技能槽符文 P1/P2：持有者、激活、重複、下場、同槽PP、零PP、先制上限、傷害分類、盾罩、反向吸取、轉換、繼承及Blockly通過');
}finally{await h.close();}
