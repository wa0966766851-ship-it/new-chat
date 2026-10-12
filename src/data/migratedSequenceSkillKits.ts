import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { property, sequence, action } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { MIGRATED_SKILL_STONE_KITS } from './migratedSkillStoneKits';
import { MIGRATED_RECURRING_SKILL_KITS } from './migratedRecurringSkillKits';
import { MIGRATED_MONKEY_BAPHOMET_SKILL_KITS } from './migratedMonkeyBaphometSkillKits';
import { REMAINING_SIMPLE_SKILL_KITS } from './remainingSimpleSkillKits';
import { MIGRATED_CLOSURE_SKILL_KITS } from './migratedClosureSkillKits';
import { MIGRATED_SHARED_SKILL_KITS } from './migratedSharedSkillKits';
import { MIGRATED_EVENT_SKILL_KITS } from './migratedEventSkillKits';
/** 「技能使用後」：成功行動結束（after_action）才觸發的附加連鎖。 */
const afterSkill=(raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',node:'after_action',source:'skill',role:'attached',order,customText:raw,
  params:{clause:{raw,marker:'🎯',trig:'self_after_skill',parsed:true,body}}});

/** 「命中後」：命中結算後（on_hit）觸發的附加連鎖。 */
const afterHit=(raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order,customText:raw,
  params:{clause:{raw,marker:'🎯',trig:'after_hit',parsed:true,body}}});

/** P4 遷移：逐隻核對 TXT 後的整份技能定義。原文完全相同才套入；每份都有 tests/migrate_<ID>.semantic.test.ts。 */
export const MIGRATED_SEQUENCE_SKILL_KITS: ReviewedSequenceSkill[] = [
  ...MIGRATED_CLOSURE_SKILL_KITS,
  ...MIGRATED_SHARED_SKILL_KITS,
  ...MIGRATED_EVENT_SKILL_KITS,
  // 5005 布萊克
  {elfIds:['5005'],name:'狂夜屠戮',description:'（無特殊效果）',kit:[
    sequence('（無特殊效果）',[{acts:[action('noop',{})]}],0),
  ]},
  {elfIds:['5005'],name:'夜魔神襲',description:'■ 必中\n🎯 解除自身能力下降狀態\n🎯 造成技能傷害的50%恢復自身體力',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 解除自身能力下降狀態',[{acts:[action('stat_clear',{side:'self',kind:'down'})]}],1),
    sequence('🎯 造成技能傷害的50%恢復自身體力',[{acts:[action('vampire',{ratio:0.5,kind:'技能'})]}],2),
  ]},

  // 5004 皮特薩拉羅
  {elfIds:['5004'],name:'翎封禁之羽',description:'■ 先制+3\n■ 必中\n🎯 消除對手能力提升狀態，消除成功則對手全屬性-1\n🎯 消除對手回合類效果，消除成功則令對手麻痺',kit:[
    property('■ 先制+3','base_priority',3,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 消除對手能力提升狀態，消除成功則對手全屬性-1',[{acts:[action('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[action('stat',{chance:100,side:'opp',stats:['全屬性'],v:-1})]}],2),
    sequence('🎯 消除對手回合類效果，消除成功則令對手麻痺',[{acts:[action('clear_turn',{side:'opp'})]},{chain:'success',acts:[action('status',{chance:100,side:'opp',status:'麻痺'})]}],3),
  ]},
  {elfIds:['5004'],name:'翎羽風暴',description:'■ 必中\n🎯 4回合內免疫並反彈所有非附屬類異常狀態\n🎯 消除對手回合類效果，消除成功則對手2回合內屬性技能無效\n🎯 免疫下1次受到的攻擊\n🎯 100%令對手害怕',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 4回合內免疫並反彈所有非附屬類異常狀態',[{acts:[action('immune_status_turns',{turns:4,reflect:true,cls:'非附屬類'})]}],1),
    sequence('🎯 消除對手回合類效果，消除成功則對手2回合內屬性技能無效',[{acts:[action('clear_turn',{side:'opp'})]},{chain:'success',acts:[action('invalid_turns',{turns:2,kind:'屬性'})]}],2),
    sequence('🎯 免疫下1次受到的攻擊',[{acts:[action('immune_attack_count',{count:1})]}],3),
    sequence('🎯 100%令對手害怕',[{acts:[action('status',{chance:100,side:'opp',status:'害怕'})]}],4),
  ]},
  {elfIds:['5004'],name:'千翎破陣',description:'■ 先制+1\n■ 必中\n🎯 消除對手回合類效果，消除成功則對手2回合內攻擊技能無效\n🎯 對手處於異常狀態時本技能威力提升100%',kit:[
    property('■ 先制+1','base_priority',1,0),property('■ 必中','sure_hit',true,1),
    sequence('🎯 消除對手回合類效果，消除成功則對手2回合內攻擊技能無效',[{acts:[action('clear_turn',{side:'opp'})]},{chain:'success',acts:[action('invalid_turns',{turns:2,kind:'攻擊'})]}],2),
    sequence('🎯 對手處於異常狀態時本技能威力提升100%',[{cond:[{c:'abnormal',p:{side:'opp',neg:false},label:'對手處於異常'}],acts:[action('boost',{mult:2,kind:'攻擊',power:true})]}],3),
  ]},
  // 5003 天蓬元帥八戒（魂印 B）
  {elfIds:["5003"],name:"天河衝擊",description:"■ 先制+3\n■ 必中\n🎯 消除對手能力提升狀態，消除成功則對手全屬性-1\n🎯 消除對手回合類效果，消除成功則對手2回合內無法恢復體力",kit:[
    property("■ 先制+3","base_priority",3,0),
    property("■ 必中","sure_hit",true,1),
    sequence("🎯 消除對手能力提升狀態，消除成功則對手全屬性-1",[{"acts":[{"op":"stat_clear","p":{"side":"opp","kind":"up"},"label":"消除對手能力提升"}]},{"chain":"success","acts":[{"op":"stat","p":{"chance":100,"side":"opp","stats":["全屬性"],"v":-1},"label":"對手 全屬性 -1"}]}],2),
    sequence("🎯 消除對手回合類效果，消除成功則對手2回合內無法恢復體力",[{"acts":[{"op":"clear_turn","p":{"side":"opp"},"label":"消除對手回合類效果"}]},{"chain":"success","acts":[{"op":"no_heal","p":{"turns":2},"label":"2回合 對手無法恢復體力"}]}],3),
  ]},
  {elfIds:["5003"],name:"萬鈞鎮魂",description:"■ 必中\n🎯 造成傷害的40%恢復自身體力\n🎯 對手體力高於自身時附加對手最大體力1/4固定傷害\n🎯 未擊敗對手則對手全屬性-1",kit:[
    property("■ 必中","sure_hit",true,0),
    sequence("🎯 造成傷害的40%恢復自身體力",[{"acts":[{"op":"vampire","p":{"ratio":0.4,"kind":"攻擊"},"label":"吸血 40%"}]}],1),
    sequence("🎯 對手體力高於自身時附加對手最大體力1/4固定傷害",[{"cond":[{"c":"hp_cmp","p":{"side":"opp","op":"高於"},"label":"對手體力高於自身"}],"acts":[{"op":"dmg","p":{"base":"最大體力","of":"opp","ratio":0.25,"type":"固定"},"label":"【固定傷害】對手最大體力 25%"}]}],2),
    afterHit("🎯 未擊敗對手則對手全屬性-1",[{"cond":[{"c":"nokill","p":{},"label":"未擊敗對手"}],"acts":[{"op":"stat","p":{"chance":100,"side":"opp","stats":["全屬性"],"v":-1},"label":"對手 全屬性 -1"}]}],3),
  ]},
  {elfIds:["5003"],name:"混元護體",description:"■ 必中\n🎯 4回合內免疫並反彈所有非附屬類異常狀態\n🎯 命中後100%令對手害怕\n🎯 3回合內自身受到的單次攻擊傷害不超過280點\n🎯 下2回合自身所有攻擊技能先制+2",kit:[
    property("■ 必中","sure_hit",true,0),
    sequence("🎯 4回合內免疫並反彈所有非附屬類異常狀態",[{"acts":[{"op":"immune_status_turns","p":{"turns":4,"reflect":true,"cls":"非附屬類"},"label":"4回合 免疫並反彈非附屬類異常"}]}],1),
    afterHit("🎯 命中後100%令對手害怕",[{"acts":[{"op":"status","p":{"chance":100,"side":"opp","status":"害怕"},"label":"對手 害怕"}]}],2),
    sequence("🎯 3回合內自身受到的單次攻擊傷害不超過280點",[{"acts":[{"op":"dmg_cap_turns","p":{"turns":3,"cap":280},"label":"3回合 受到【攻擊傷害】上限 280"}]}],3),
    sequence("🎯 下2回合自身所有攻擊技能先制+2",[{"acts":[{"op":"prio_turns","p":{"turns":2,"attackOnly":true,"v":2},"label":"下2回合 攻擊技能先制 +2"}]}],4),
  ]},
  {elfIds:["5003"],name:"淨·天河倒懸",description:"■ 必中\n■ 先制+1\n🎯 消除對手回合類效果，消除成功則對手3回合內無法恢復體力且屬性技能無效\n🎯 自身體力低於對手時造成傷害提升100%並恢復等量體力",kit:[
    property("■ 必中","sure_hit",true,0),
    property("■ 先制+1","base_priority",1,1),
    sequence("🎯 消除對手回合類效果，消除成功則對手3回合內無法恢復體力且屬性技能無效",[{"acts":[{"op":"clear_turn","p":{"side":"opp"},"label":"消除對手回合類效果"}]},{"chain":"success","acts":[{"op":"no_heal","p":{"turns":3},"label":"3回合 對手無法恢復體力"},{"op":"invalid_turns","p":{"turns":3,"kind":"屬性"},"label":"3回合 對手屬性技能無效"}]}],2),
    sequence("🎯 自身體力低於對手時造成傷害提升100%並恢復等量體力",[{"cond":[{"c":"hp_cmp","p":{"side":"self","op":"低於"},"label":"自身體力低於對手"}],"acts":[{"op":"boost","p":{"mult":2,"kind":"攻擊","power":false},"label":"本次【攻擊傷害】×2"},{"op":"heal_equal","p":{},"label":"恢復等量體力"}]}],3),
  ]},
  // 5003 殘軀鎖命（使用者決定 2026-10-12）：「恢復量的50%轉化為附加對手等量戰鬥系傷害」＝戰鬥系技能傷害（applySkillTypeDamage）；
  // 恢復量＝實際結算恢復量（禁療／體力已滿＝0 → 不附加傷害）。「4回合內每回合」含使用當回合結束（與舊文字路徑一致）。
  {elfIds:['5003'],name:'殘軀鎖命',description:'■ 必中\n■ 先制+2\n🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍\n🎯 4回合內自身體力受到攻擊傷害不超過200點\n🎯 4回合內每回合恢復自身最大體力1/3，恢復量的50%轉化為附加對手等量戰鬥系傷害\n🎯 下2回合對手受到攻擊傷害提升100%',kit:[
    property('■ 必中','sure_hit',true,0),property('■ 先制+2','base_priority',2,1),
    sequence('🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍',[{acts:[action('stat',{chance:100,side:'auto',stats:['全屬性'],v:1,x2If:{c:'stage',p:{side:'self',kind:'up',neg:false},label:'自身處於能力提升'}})]}],2),
    sequence('🎯 4回合內自身體力受到攻擊傷害不超過200點',[{acts:[action('dmg_cap_turns',{turns:4,cap:200})]}],3),
    sequence('🎯 4回合內每回合恢復自身最大體力1/3，恢復量的50%轉化為附加對手等量戰鬥系傷害',[{acts:[action('timed',{turns:4,from:'now',trig:'round_end',body:[{acts:[action('heal',{side:'self',ratio:1/3}),action('dmg_from_last',{ratio:0.5,type:'技能',elem:'戰鬥'})]}]})]}],4),
    sequence('🎯 下2回合對手受到攻擊傷害提升100%',[{acts:[action('dmg_mod_turns',{side:'opp',dir:'taken',kind:'攻擊',boost:1,turns:2,next:true})]}],5),
  ]},
  // 5002 帝皇之盾（帝永壁令／盾碎同歸：custom 動作 B；魂印 B）
  {elfIds:["5002"],name:"盾先鋒制裁",description:"■ 先制+3\n■ 必中\n🎯 消除對手能力提升狀態，消除成功則對手全屬性-1\n🎯 消除對手回合類效果，消除成功則對手2回合內屬性技能無效",kit:[
    property("■ 先制+3","base_priority",3,0),
    property("■ 必中","sure_hit",true,1),
    sequence("🎯 消除對手能力提升狀態，消除成功則對手全屬性-1",[{"acts":[{"op":"stat_clear","p":{"side":"opp","kind":"up"},"label":"消除對手能力提升"}]},{"chain":"success","acts":[{"op":"stat","p":{"chance":100,"side":"opp","stats":["全屬性"],"v":-1},"label":"對手 全屬性 -1"}]}],2),
    sequence("🎯 消除對手回合類效果，消除成功則對手2回合內屬性技能無效",[{"acts":[{"op":"clear_turn","p":{"side":"opp"},"label":"消除對手回合類效果"}]},{"chain":"success","acts":[{"op":"invalid_turns","p":{"turns":2,"kind":"屬性"},"label":"2回合 對手屬性技能無效"}]}],3),
  ]},
  {elfIds:["5002"],name:"聖盾裁決",description:"■ 必中\n🎯 造成傷害的40%恢復自身體力\n🎯 自身擁有護盾時附加護盾值70%的百分比傷害\n🎯 自身不處於護盾狀態時本技能威力提升100%",kit:[
    property("■ 必中","sure_hit",true,0),
    sequence("🎯 造成傷害的40%恢復自身體力",[{"acts":[{"op":"vampire","p":{"ratio":0.4,"kind":"攻擊"},"label":"吸血 40%"}]}],1),
    sequence("🎯 自身擁有護盾時附加護盾值70%的百分比傷害",[{"cond":[{"c":"shield","p":{"side":"self","neg":false},"label":"自身擁有護盾"}],"acts":[{"op":"dmg","p":{"base":"護盾值","of":"self","ratio":0.7,"type":"百分比"},"label":"【百分比傷害】自身護盾值 70%"}]}],2),
    sequence("🎯 自身不處於護盾狀態時本技能威力提升100%",[{"cond":[{"c":"shield","p":{"side":"self","neg":true},"label":"自身不擁有護盾"}],"acts":[{"op":"boost","p":{"mult":2,"kind":"攻擊","power":true},"label":"本次【攻擊威力】×2"}]}],3),
  ]},
  {elfIds:["5002"],name:"帝·永恆守護",description:"■ 必中\n■ 先制+1\n🎯 消除對手回合類效果，消除成功則對手下1次技能無效\n🎯 自身擁有護盾時附加護盾值等量真實傷害\n🎯 附加對手最大體力1/3百分比傷害，未擊敗對手時恢復自身等量體力",kit:[
    property("■ 必中","sure_hit",true,0),
    property("■ 先制+1","base_priority",1,1),
    sequence("🎯 消除對手回合類效果，消除成功則對手下1次技能無效",[{"acts":[{"op":"clear_turn","p":{"side":"opp"},"label":"消除對手回合類效果"}]},{"chain":"success","acts":[{"op":"invalid_next","p":{"uses":1,"kind":""},"label":"對手下1次技能無效"}]}],2),
    sequence("🎯 自身擁有護盾時附加護盾值等量真實傷害",[{"cond":[{"c":"shield","p":{"side":"self","neg":false},"label":"自身擁有護盾"}],"acts":[{"op":"dmg","p":{"base":"護盾值","of":"self","ratio":1,"type":"真實"},"label":"【真實傷害】自身護盾值 100%"}]}],3),
    afterHit("🎯 附加對手最大體力1/3百分比傷害，未擊敗對手時恢復自身等量體力",[{"acts":[{"op":"dmg","p":{"base":"最大體力","of":"opp","ratio":0.3333333333333333,"type":"百分比"},"label":"【百分比傷害】對手最大體力 33.33%"}]},{"cond":[{"c":"nokill","p":{},"label":"未擊敗對手"}],"acts":[{"op":"heal_equal","p":{},"label":"恢復等量體力"}]}],4),
  ]},
  // 5020 皮皮（手下留情、同生共死 B；其餘為資料庫測試技能，不在 TXT）
  {elfIds:["5020"],name:"撞擊",description:"（無特殊效果）",kit:[{"codeId": "effect_sequence", "params": {"clause": {"raw": "（無特殊效果）", "trig": "use", "body": [{"acts": [{"op": "noop", "p": {}, "label": "無特殊效果"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 0, "customText": "（無特殊效果）", "role": "attached"}]},
  {elfIds:["5020"],name:"飛翼拍擊",description:"（無特殊效果）",kit:[{"codeId": "effect_sequence", "params": {"clause": {"raw": "（無特殊效果）", "trig": "use", "body": [{"acts": [{"op": "noop", "p": {}, "label": "無特殊效果"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 0, "customText": "（無特殊效果）", "role": "attached"}]},
  // 300／5000 譜尼
  {elfIds:["300","5000"],name:"極光",description:"（無特殊效果）",kit:[{"codeId": "effect_sequence", "params": {"clause": {"raw": "（無特殊效果）", "trig": "use", "body": [{"acts": [{"op": "noop", "p": {}, "label": "無特殊效果"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 0, "customText": "（無特殊效果）", "role": "attached"}]},
  {elfIds:["300","5000"],name:"神聖之光",description:"■ 必中\n（無特殊效果）",kit:[{"codeId": "skill_property", "node": "before_skill", "source": "skill", "role": "innate", "order": 0, "customText": "■ 必中", "params": {"property": "sure_hit", "value": true, "conditions": []}}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "（無特殊效果）", "trig": "use", "body": [{"acts": [{"op": "noop", "p": {}, "label": "無特殊效果"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 1, "customText": "（無特殊效果）", "role": "attached"}]},
  {elfIds:["300","5000"],name:"永恆",description:"■ 必中\n🎯 回復自身所有PP值",kit:[{"codeId": "skill_property", "node": "before_skill", "source": "skill", "role": "innate", "order": 0, "customText": "■ 必中", "params": {"property": "sure_hit", "value": true, "conditions": []}}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 回復自身所有PP值", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "pp_op", "p": {"side": "self", "mode": "recover"}, "label": "恢復自身所有 PP"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 1, "customText": "🎯 回復自身所有PP值", "role": "attached"}]},
  // 5001 悲歌.索比拉特（魂印 B；其餘技能不在候選）
  {elfIds:["5001"],name:"黯索魂噬",description:"■ 先制+3\n■ 必中\n🎯 消除對手回合類效果\n  > 消除成功則令對手害怕\n🎯 消除對手能力提升狀態\n  > 消除成功則對手全屬性-1",kit:[
    property("■ 先制+3","base_priority",3,0),
    property("■ 必中","sure_hit",true,1),
    sequence("🎯 消除對手回合類效果，消除成功則令對手害怕",[{"acts":[{"op":"clear_turn","p":{"side":"opp"},"label":"消除對手回合類效果"}]},{"chain":"success","acts":[{"op":"status","p":{"chance":100,"side":"opp","status":"害怕"},"label":"對手 害怕"}]}],2),
    sequence("🎯 消除對手能力提升狀態，消除成功則對手全屬性-1",[{"acts":[{"op":"stat_clear","p":{"side":"opp","kind":"up"},"label":"消除對手能力提升"}]},{"chain":"success","acts":[{"op":"stat","p":{"chance":100,"side":"opp","stats":["全屬性"],"v":-1},"label":"對手 全屬性 -1"}]}],3),
  ]},

  // 使用者決定（2026-10-12）：5004 翎萬羽歸宗／300・5000 旋滅裂空陣・落芳天華／5000 神靈之觸／5020 鳴叫・誘惑
  // 翎萬羽歸宗：第二、三句的「處於異常」即時判斷（含第一句剛令對手疲憊），故 live:true。
  {elfIds:['5004'],name:'翎萬羽歸宗',description:'■ 必中\n■ 先制+1\n🎯 消除對手回合類效果，消除成功則令對手疲憊\n🎯 對手處於異常狀態時造成傷害提升100%並恢復等量體力\n🎯 對手不處於異常狀態時附加對手最大體力1/3百分比傷害',kit:[
    property('■ 必中','sure_hit',true,0),property('■ 先制+1','base_priority',1,1),
    sequence('🎯 消除對手回合類效果，消除成功則令對手疲憊',[{acts:[action('clear_turn',{side:'opp'})]},{chain:'success',acts:[action('status',{chance:100,side:'opp',status:'疲憊'})]}],2),
    sequence('🎯 對手處於異常狀態時造成傷害提升100%並恢復等量體力',[{live:true,cond:[{c:'abnormal',p:{side:'opp',neg:false},label:'對手處於異常'}],acts:[action('boost',{mult:2,kind:'攻擊',power:false}),action('heal_equal',{})]}],3),
    sequence('🎯 對手不處於異常狀態時附加對手最大體力1/3百分比傷害',[{live:true,cond:[{c:'abnormal',p:{side:'opp',neg:true},label:'對手不處於異常'}],acts:[action('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]}],4),
  ]},
  // 旋滅裂空陣：初次命中啟動，當回合算第1次；後續使用級触發，共5回合窗口。
  {elfIds:['300','5000'],name:'旋滅裂空陣',description:'🎯 5回合每回合使用技能則附加30點固定傷害',kit:[
    afterHit('🎯 5回合每回合使用技能則附加30點固定傷害',[{acts:[action('timed',{turns:5,from:'now',trig:'self_after_use',body:[{acts:[action('dmg',{flat:30,type:'固定',both:false})]}]})]}],0),
  ]},
  // 落芳天華：「天敵」＝能克制自身當前屬性的屬性（enemy 條件，屬性相剋表＋當前屬性）；每次使用都累計。
  {elfIds:['300','5000'],name:'落芳天華',description:'■ 先制+3\n🎯 吸取對手能力提升狀態\n🎯 附加對手100點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍',kit:[
    property('■ 先制+3','base_priority',3,0),
    sequence('🎯 吸取對手能力提升狀態',[{acts:[action('stat_steal',{mode:'吸取',double:false})]}],1),
    sequence('🎯 附加對手100點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍',[{acts:[action('dmg',{flat:100,type:'固定',both:false,rampInc:100,rampStreak:false,rampCap:400,x2If:{c:'enemy',p:{},label:'遇到天敵'}})]}],2),
  ]},
  // 神靈之觸：每次使用都累計（不需連續），下場後重置。
  {elfIds:['5000'],name:'神靈之觸',description:'■ 先制+3\n🎯 消除對手能力提升狀態，消除成功則對手下1次攻擊技能無效\n🎯 附加對手最大體力值15%的百分比傷害，每次使用增加10%，最高45%',kit:[
    property('■ 先制+3','base_priority',3,0),
    sequence('🎯 消除對手能力提升狀態，消除成功則對手下1次攻擊技能無效',[{acts:[action('stat_clear',{side:'opp',kind:'up'})]},{chain:'success',acts:[action('invalid_next',{uses:1,kind:'攻擊'})]}],1),
    sequence('🎯 附加對手最大體力值15%的百分比傷害，每次使用增加10%，最高45%',[{acts:[action('dmg',{base:'最大體力',of:'opp',ratio:0.15,type:'百分比',rampInc:10,rampStreak:false,rampCap:45,rampReset:'switch'})]}],2),
  ]},
  // 5020 鳴叫／誘惑：「技能使用後」＝技能使用成功後（成功行動結束；無效／未命中不觸發）。
  {elfIds:['5020'],name:'鳴叫',description:'🎯 技能使用後100%改變對方攻擊等級-1',kit:[
    afterSkill('🎯 技能使用後100%改變對方攻擊等級-1',[{acts:[action('stat',{chance:100,side:'opp',stats:['攻擊'],v:-1})]}],0),
  ]},
  {elfIds:['5020'],name:'誘惑',description:'🎯 技能使用後100%改變對方命中等級-1',kit:[
    afterSkill('🎯 技能使用後100%改變對方命中等級-1',[{acts:[action('stat',{chance:100,side:'opp',stats:['命中'],v:-1})]}],0),
  ]},
  // 5012 冰魄·柯爾德：傲視千川（其餘四招含 B 缺口，見交接單 §4）。「下2回合」一律 next:true；全屬性含命中（與舊 handler 一致）。
  {elfIds:['5012'],name:'傲視千川',description:'■ 必中\n🎯 全屬性+1，對手處於冰封狀態時強化效果翻倍\n🎯 下2回合對手受到的傷害提高100%\n🎯 下2回合自身所有技能先制+2\n🎯 下2回合對手無法主動切換精靈',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 全屬性+1，對手處於冰封狀態時強化效果翻倍',[{acts:[action('stat',{chance:100,side:'auto',stats:['全屬性'],v:1,x2If:{c:'has_status',p:{side:'opp',status:'冰封'},label:'對手處於冰封'}})]}],1),
    sequence('🎯 下2回合對手受到的傷害提高100%',[{acts:[action('dmg_mod_turns',{turns:2,kind:'攻擊',boost:1,dir:'taken',next:true,side:'opp'})]}],2),
    sequence('🎯 下2回合自身所有技能先制+2',[{acts:[action('prio_turns',{turns:2,attackOnly:false,v:2})]}],3),
    sequence('🎯 下2回合對手無法主動切換精靈',[{acts:[action('no_switch',{turns:2,next:true})]}],4),
  ]},
  // 5013 柯爾霍德：寒淵之殤（其餘四招含 B 缺口）。「受到傷害提升100%」未指明類型＝只算攻擊傷害（使用者全域規則 2026-10-12）。
  {elfIds:['5013'],name:'寒淵之殤',description:'■ 必中\n🎯 4回合免疫並反彈所有異常\n🎯 命中後100%令對手害怕，若未觸發則減少對手最大體力1/3\n🎯 下2回合對手受到傷害提升100%',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 4回合免疫並反彈所有異常',[{acts:[action('immune_status_turns',{turns:4,reflect:true,cls:''})]}],1),
    afterHit('🎯 命中後100%令對手害怕，若未觸發則減少對手最大體力1/3',[{acts:[action('status',{chance:100,side:'opp',status:'害怕'})]},{chain:'fail',acts:[action('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]}],2),
    sequence('🎯 下2回合對手受到傷害提升100%',[{acts:[action('dmg_mod_turns',{turns:2,kind:'攻擊',boost:1,dir:'taken',next:true,side:'opp'})]}],3),
  ]},
  // 5019 眾神之父·奧丁：ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ（岡格尼爾；其餘兩招與魂印含 B 缺口，ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ 見下）。
  {elfIds:["5019"],name:"ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ",description:"■ 先制+3\n■ 必中\n🎯 解除自身能力下降狀態，解除成功則恢復自身全部體力\n🎯 消除對手能力提升狀態，消除成功則100%令對手害怕\n🎯 吸取對手最大體力¼，自身體力低於最大體力½時吸取效果翻倍",kit:[{"codeId": "skill_property", "node": "modify_priority", "source": "skill", "role": "innate", "order": 0, "customText": "■ 先制+3", "params": {"property": "base_priority", "value": 3, "conditions": []}}, {"codeId": "skill_property", "node": "before_skill", "source": "skill", "role": "innate", "order": 1, "customText": "■ 必中", "params": {"property": "sure_hit", "value": true, "conditions": []}}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 解除自身能力下降狀態，解除成功則恢復自身全部體力", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "stat_clear", "p": {"side": "self", "kind": "down"}, "label": "解除自身能力下降"}]}, {"chain": "success", "acts": [{"op": "heal", "p": {"side": "self", "ratio": 1}, "label": "恢復全部體力"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 2, "customText": "🎯 解除自身能力下降狀態，解除成功則恢復自身全部體力", "role": "attached"}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 消除對手能力提升狀態，消除成功則100%令對手害怕", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "stat_clear", "p": {"side": "opp", "kind": "up"}, "label": "消除對手能力提升"}]}, {"chain": "success", "acts": [{"op": "status", "p": {"chance": 100, "side": "opp", "status": "害怕"}, "label": "對手 害怕"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 3, "customText": "🎯 消除對手能力提升狀態，消除成功則100%令對手害怕", "role": "attached"}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 吸取對手最大體力¼，自身體力低於最大體力½時吸取效果翻倍", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "drain", "p": {"ratio": 0.25, "true": false, "x2If": {"c": "hp_ratio", "p": {"side": "self", "op": "低於", "ratio": 0.5}, "label": "自身體力低於½"}}, "label": "吸取對手最大體力 25%（自身體力低於½時×2）"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 4, "customText": "🎯 吸取對手最大體力¼，自身體力低於最大體力½時吸取效果翻倍", "role": "attached"}]},
  // 世界樹：初次命中啟動，當回合起算5回合；後續使用技能後吸取（包含miss／無效，不含出手前中斷）。
  // 被打斷沒出招的回合不吸取，但回合計數照走、效果不終止。timed{from:'now'} 與旋滅裂空陣同做法。「2回合內…恢復量降低100%」含當回合（= 禁療 2 回合）。
  {elfIds:['5019'],name:'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ',description:'■ 必中\n🎯 使自身全屬性+1，自身體力高於對手時強化效果翻倍\n🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害\n🎯 2回合內對手體力恢復量降低100%\n🎯 下2回合自身所有技能先制+2',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 使自身全屬性+1，自身體力高於對手時強化效果翻倍',[{acts:[action('stat',{chance:100,side:'self',stats:['全屬性'],v:1,x2If:{c:'hp_cmp',p:{side:'self',op:'高於'},label:'自身體力高於對手'}})]}],1),
    afterHit('🎯 5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害',[{acts:[action('timed',{turns:5,from:'now',trig:'self_after_use',body:[
      {acts:[action('drain',{ratio:1/3,true:false,x2If:{c:'hp_ratio',p:{side:'self',op:'低於',ratio:0.5},label:'自身體力低於½'}})]},
      {cond:[{c:'last_no_dmg',p:{},label:'對手體力未減少'}],acts:[action('dmg',{flat:300,type:'真實',both:false})]}]})]}],2),
    sequence('🎯 2回合內對手體力恢復量降低100%',[{acts:[action('no_heal',{turns:2,next:false})]}],3),
    sequence('🎯 下2回合自身所有技能先制+2',[{acts:[action('prio_turns',{turns:2,attackOnly:false,v:2})]}],4),
  ]},
  // 5024 湮滅之主・咤克斯：無限・虛數湮滅（其餘八招與魂印含 B 缺口／待確認）。附加「等量」＝本招實際恢復量（舊 handler 誤用對手最大體力 100%）。
  {elfIds:["5024"],name:"無限・虛數湮滅",description:"■ 先制+1\n■ 必中\n🎯 消除對手回合類效果，消除成功則令對手疲憊，未觸發則100%令對手詛咒\n🎯 消除對手能力提升狀態，消除成功則令對手害怕，未觸發則100%令對手詛咒\n🎯 2回合內令對手使用的屬性技能無效\n🎯 恢復自身最大體力1/1並附加對手等量百分比傷害",kit:[{"codeId": "skill_property", "node": "modify_priority", "source": "skill", "role": "innate", "order": 0, "customText": "■ 先制+1", "params": {"property": "base_priority", "value": 1, "conditions": []}}, {"codeId": "skill_property", "node": "before_skill", "source": "skill", "role": "innate", "order": 1, "customText": "■ 必中", "params": {"property": "sure_hit", "value": true, "conditions": []}}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 消除對手回合類效果，消除成功則令對手疲憊，未觸發則100%令對手詛咒", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "clear_turn", "p": {"side": "opp"}, "label": "消除對手回合類效果"}]}, {"chain": "success", "acts": [{"op": "status", "p": {"chance": 100, "side": "opp", "status": "疲憊"}, "label": "對手 疲憊"}]}, {"chain": "fail", "acts": [{"op": "status", "p": {"chance": 100, "side": "opp", "status": "詛咒"}, "label": "對手 詛咒"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 2, "customText": "🎯 消除對手回合類效果，消除成功則令對手疲憊，未觸發則100%令對手詛咒", "role": "attached"}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 消除對手能力提升狀態，消除成功則令對手害怕，未觸發則100%令對手詛咒", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "stat_clear", "p": {"side": "opp", "kind": "up"}, "label": "消除對手能力提升"}]}, {"chain": "success", "acts": [{"op": "status", "p": {"chance": 100, "side": "opp", "status": "害怕"}, "label": "對手 害怕"}]}, {"chain": "fail", "acts": [{"op": "status", "p": {"chance": 100, "side": "opp", "status": "詛咒"}, "label": "對手 詛咒"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 3, "customText": "🎯 消除對手能力提升狀態，消除成功則令對手害怕，未觸發則100%令對手詛咒", "role": "attached"}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 2回合內令對手使用的屬性技能無效", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "invalid_turns", "p": {"turns": 2, "kind": "屬性"}, "label": "2回合 對手屬性技能無效"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 4, "customText": "🎯 2回合內令對手使用的屬性技能無效", "role": "attached"}, {"codeId": "effect_sequence", "params": {"clause": {"raw": "🎯 恢復自身最大體力1/1並附加對手等量百分比傷害", "marker": "🎯", "trig": "use", "body": [{"acts": [{"op": "heal", "p": {"side": "self", "ratio": 1}, "label": "恢復自身最大體力 100%"}, {"op": "dmg_equal", "p": {"type": "百分比"}, "label": "【百分比傷害】等量"}]}], "parsed": true}}, "node": "on_skill_use", "source": "skill", "order": 5, "customText": "🎯 恢復自身最大體力1/1並附加對手等量百分比傷害", "role": "attached"}]},
  // 5011 星光·麗莎布布：附加傷害取主傷害結算後的已損失體力（使用者已確認）。
  {elfIds:['5011'],name:'星光·飛葉風暴',description:'■ 必中\n🎯 解除自身能力下降狀態，解除成功則恢復自身所有體力\n🎯 1回合內受到物理攻擊和特殊攻擊傷害減少50%\n🎯 附加對手已損失體力35%的百分比傷害',kit:[
    property('■ 必中','sure_hit',true,0),
    sequence('🎯 解除自身能力下降狀態，解除成功則恢復自身所有體力',[{acts:[action('stat_clear',{side:'self',kind:'down'})]},{chain:'success',acts:[action('heal',{side:'self',ratio:1})]}],1),
    sequence('🎯 1回合內受到物理攻擊和特殊攻擊傷害減少50%',[{acts:[action('dmg_mod_turns',{turns:1,kind:'攻擊',reduce:0.5,dir:'in'})]}],2),
    afterHit('🎯 附加對手已損失體力35%的百分比傷害',[{acts:[action('dmg',{base:'已損失體力',of:'opp',ratio:0.35,type:'百分比'})]}],3),
  ]},
  // 5011 星光·花草護體：技能庫（skillPool）的技能，不在 TXT 內，以資料庫描述為準（使用者 2026-10-12 點名轉換）。「技能使用成功時」＝命中成功後的附加效果（未命中／無效／附加失效不執行）。
  {elfIds:['5011'],name:'星光·花草護體',description:'技能使用成功時，100%改變自身防禦等級+2；技能使用成功時，100%改變自身特防等級+2；技能使用成功時，100%改變對手攻擊等級-1；技能使用成功時，100%改變對手特攻等級-1。',kit:[
    sequence('技能使用成功時，100%改變自身防禦等級+2；技能使用成功時，100%改變自身特防等級+2；技能使用成功時，100%改變對手攻擊等級-1；技能使用成功時，100%改變對手特攻等級-1。',[
      {acts:[action('stat',{chance:100,side:'self',stats:['防禦'],v:2})]},{acts:[action('stat',{chance:100,side:'self',stats:['特防'],v:2})]},
      {acts:[action('stat',{chance:100,side:'opp',stats:['攻擊'],v:-1})]},{acts:[action('stat',{chance:100,side:'opp',stats:['特攻'],v:-1})]}],0),
  ]},
  // 5026 無序.墜星 的 21 份石之力-S（各自一筆，見 migratedSkillStoneKits.ts）
  ...MIGRATED_SKILL_STONE_KITS,
  ...MIGRATED_RECURRING_SKILL_KITS,
  ...MIGRATED_MONKEY_BAPHOMET_SKILL_KITS,
  ...REMAINING_SIMPLE_SKILL_KITS,
];
