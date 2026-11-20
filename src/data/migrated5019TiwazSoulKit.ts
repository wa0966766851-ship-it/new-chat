// 符文定義為可攜技能槽程式；激活、查詢與剝離由共用事件處理。
// 2026-11-16：符文說明一律取原文（不再改寫）；狀態以 isRuneActive 區分（未激活不生效）。
import type {KitEntry} from '../effects/effectSystem.schema';
import {action as a} from './reviewedSequenceSkillKits';
import odinText from './odinTiwazSoulText.json';
const c=(id:string,p:any,label?:string)=>({c:id,p,label:label||id});
const e=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
const rule=(trig:string,acts:any[],activationOnly=false)=>({raw:'槽印記持有者規則',trig,parsed:true,body:[{acts}],...(activationOnly?{activationOnly:true}:{})});
const ownStrip={restorePp:true,hpRatio:.2,damageRatio:0,nonlethal:true,zeroHighestMaxPp:false};
const enemyStrip={restorePp:false,hpRatio:0,damageRatio:.2,nonlethal:true,zeroHighestMaxPp:true};
const mark=(symbol:string,description:string,capabilities:any,rules:any[],strip:any)=>({symbol,description,capabilities,rules,strip});
export const TIWAZ_ALLY_MARKS=[
 mark('ᚨ','激活後直到下場前持有者免疫所有異常狀態且每回合開始時將對手所處的弱化類異常延長至3回合',{statusImmune:true},[rule('round_start',[a('status_duration_floor',{side:'opp',cls:'弱化類',turns:3})])],ownStrip),
 mark('ᛉ','激活後直到下場前對手能力提升效果失效且無法觸發場下精靈對場上精靈的支援效果(只針對精靈對精靈效果)',{opponentBoostDisabled:true,suppressBenchEffects:true},[],ownStrip),
 mark('ᚱᚷ','激活後直到下場前持有者所有技能必定命中、強制執行命中效果且選擇技能時不受PP值限制',{sureHit:true,forceHitEffects:true,ppUnrestricted:true},[],ownStrip),
 mark('ᛇ','激活後令持有者的對手相同位置技能PP值上限與該技能相同，超出部分的PP值每有1點轉化為附加對手100點真實傷害',{},[rule('skill_selected',[a('skill_mark_pp_match',{perPp:100})],true)],ownStrip),
 mark('ᛖ','激活後直到下場前持有者的對手正先制效果無法高於先制+1且擊敗效果失效',{priorityCeiling:1,opponentKillDisabled:true},[],ownStrip),
];
export const TIWAZ_ENEMY_MARKS=[
 mark('ᛈ','激活後直到下場前持有者每次選擇該技能轉化為使用自身技能中與對手所選擇使用技能相同位置技能',{mirrorOpponentSlot:true},[],enemyStrip),
 mark('ᛁ','激活後則直到下場前持有者此技能固有效果失效且造成非真實傷害減半',{innateDisabled:true,nonTrueOutputMultiplier:.5},[],enemyStrip),
 mark('ᚦᚺ','激活後則直到下場前持有者護盾與護罩附加效果失效且回合結束時受到等同於護盾與護罩總和20%的真實傷害',{shieldsBlocked:true},[rule('round_end',[a('held_resources_damage',{resources:['shield','barrier'],ratio:.2})])],enemyStrip),
 mark('ᚾ','激活後則直到下場前持有者失去能力值20%',{statMultiplier:.8},[],enemyStrip),
 mark('ᛃ','持有者無法觸發未擊敗對手時效果且對手每次使用技能時被對手吸取最大體力40%',{notKilledDisabled:true},[rule('opp_skill',[a('drain_to_opponent',{ratio:.4})])],enemyStrip),
];
export const MIGRATED_5019_TIWAZ_SOUL_KIT={kind:'soul' as const,elfIds:['5019'],name:'ᛏ',description:odinText.soul,kit:[
 e('on_entered','entrance','登場時為己方末位尚無ᛏ的精靈附加永久戰神符文',[{acts:[a('battle_mark_to_last_ally',{id:'tiwaz_rune',name:'ᛏ 戰神符文',displayChar:'ᛏ',statRatio:1.2,duel:true})]}],0),
 e('round_start','round_start','對手在場前2回合為無符文技能按槽附加符文',[{acts:[a('skill_marks_assign',{side:'opp',withinRounds:2,marks:TIWAZ_ENEMY_MARKS})]}],1),
 e('round_start','round_start','自身在場前2回合為無符文技能按槽附加符文',[{acts:[a('skill_marks_assign',{side:'self',withinRounds:2,marks:TIWAZ_ALLY_MARKS})]}],2),
    // 回合結束：恢復⅓並附加等量百分比傷害
    e('round_end', 'round_end', '回合結束時：恢復自身最大體力⅓並附加對手等量百分比傷害', [
      { acts: [
        a('heal_then', { side: 'self', ratio: 1 / 3,body:[{acts:[a('dmg_from_last',{ratio:1,type:'百分比'})]}] }),
      ] },
    ], 5),
    // 回合結束：恢復前體力低於對手→下次對手所有技能先制-2且技能傷害-50%
    e('round_end', 'round_end', '恢復前自身體力低於對手則下次對手所有技能先制-2且造成技能傷害降低50%', [
      { cond: [c('hp_cmp', { side: 'self', op: '低於' }, '恢復前體力低於對手')], acts: [
        a('next_skill_prio', { side: 'opp', v: -2, dmgMod: -0.5 }),
      ] },
    ], 6),
    // 回合結束：恢復後體力高於對手→下次所有技能先制+2且技能傷害+50%
    e('round_end', 'round_end', '恢復後自身體力高於對手則下次所有技能先制+2且造成技能傷害提升50%', [
      { live:true,cond: [c('hp_cmp', { side: 'self', op: '高於' }, '恢復後體力高於對手')], acts: [
        a('next_skill_prio', { side: 'self', v: 2, dmgMod: 0.5 }),
      ] },
    ], 7),

   // 2026-10-30：下場剝離（官方：「自身附加的符文於選擇技能階段時激活直到該精靈下場後剝離」）。
   // 原本完全沒有這個節點，符文換人後永久殘留，造成全程生效與類兩命效果。
   e('on_switch_out','switch_out','下場時剝離自身符文：恢復該技能全部PP值；每剝離1道激活符文則增加等同最大體力20%的體力值',[{acts:[a('skill_marks_strip',{side:'self',restorePp:true,hpRatio:.2,damageRatio:0,nonlethal:true,zeroHighestMaxPp:false})]}],90),
  ]};
