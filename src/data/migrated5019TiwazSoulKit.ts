// 符文定義為可攜技能槽程式；激活、查詢與剝離由共用事件處理。
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
 mark('ᚨ','激活後免疫異常；回合開始將對手弱化類異常延長至至少3回合',{statusImmune:true},[rule('round_start',[a('status_duration_floor',{side:'opp',cls:'弱化類',turns:3})])],ownStrip),
 mark('ᛉ','對手能力提升效果失效；阻止己方場下精靈支援場上',{opponentBoostDisabled:true,suppressBenchEffects:true},[],ownStrip),
 mark('ᚱᚷ','所有技能必中、強制執行命中效果；選招不受PP限制',{sureHit:true,forceHitEffects:true,ppUnrestricted:true},[],ownStrip),
 mark('ᛇ','激活時同槽PP上限同步，超出部分每點附加100真傷',{},[rule('skill_selected',[a('skill_mark_pp_match',{perPp:100})],true)],ownStrip),
 mark('ᛖ','對手正先制至多+1；對手擊敗效果失效',{priorityCeiling:1,opponentKillDisabled:true},[],ownStrip),
];
export const TIWAZ_ENEMY_MARKS=[
 mark('ᛈ','選擇該槽時改用自身與對手原所選技能同位序的技能',{mirrorOpponentSlot:true},[],enemyStrip),
 mark('ᛁ','本槽固有效果失效；持有者非真實傷害減半',{innateDisabled:true,nonTrueOutputMultiplier:.5},[],enemyStrip),
 mark('ᚦᚺ','無法附加護盾護罩；回合末受到兩者總和20%真傷',{shieldsBlocked:true},[rule('round_end',[a('held_resources_damage',{resources:['shield','barrier'],ratio:.2})])],enemyStrip),
 mark('ᚾ','直到下場前五項能力點數降低20%',{statMultiplier:.8},[],enemyStrip),
 mark('ᛃ','未擊敗效果失效；對手使用技能時被對手吸取最大體力40%',{notKilledDisabled:true},[rule('opp_skill',[a('drain_to_opponent',{ratio:.4})])],enemyStrip),
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
