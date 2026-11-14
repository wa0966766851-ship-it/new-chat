import type {Elf} from '../types';
import type {KitEntry} from '../effects/effectSystem.schema';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';
import {action as a} from './reviewedSequenceSkillKits';
import {IMMORTAL_AINS_SOURCE as source} from './immortalAinsSource';
import {IMMORTAL_AINS_FLAME_LIFECYCLE_KIT,IMMORTAL_AINS_FLAME_STATUS_KIT,IMMORTAL_AINS_FLAME_ACTION_KIT,IMMORTAL_AINS_FLAME_ENEMY_KIT} from './immortalAinsFlameKit';
import {IMMORTAL_AINS_ROUND_END_KIT} from './immortalAinsRoundEndKit';
import {grantOrderFire} from './immortalAinsOrderFire';
import {IMMORTAL_AINS_SKILLS,IMMORTAL_AINS_SUBDUE} from './immortalAinsSkills';

export const AINS_HP_SNAPSHOT='roundStartHpNotLower';
const c=(id:string,p:any)=>({c:id,p,label:id});
const raw=(prefix:string)=>source.split(/\r?\n/).find(line=>line.startsWith(prefix))!;
const e=(text:string,trig:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node:SEQUENCE_TRIGGERS[trig] as KitEntry['node'],order,customText:text,params:{clause:{raw:text,trig,parsed:true,body}}});
const soulText=source.split('加強後:')[1].split('舊版技能:')[0].trim();
export const IMMORTAL_AINS_SOUL_KIT:KitEntry[]=[
 ...IMMORTAL_AINS_FLAME_LIFECYCLE_KIT,...IMMORTAL_AINS_FLAME_STATUS_KIT,...IMMORTAL_AINS_FLAME_ACTION_KIT,...IMMORTAL_AINS_FLAME_ENEMY_KIT,
 e(raw('>若回合開始時自身體力不低於對手')+'\n'+raw('>若回合開始時自身體力低於對手'),'round_start',[
  {cond:[c('hp_cmp',{side:'self',op:'不低於'})],acts:[a('flag_set',{key:AINS_HP_SNAPSHOT,value:true,thisRound:true})],elseActs:[a('flag_set',{key:AINS_HP_SNAPSHOT,value:false,thisRound:true})]},
 ],10),
 e(raw('>100%令敵我雙方同時')+'\n'+raw('>若回合開始時自身體力不低於對手')+'\n'+raw('>>附加給對手1道')+'\n'+raw('>若回合開始時自身體力低於對手')+'\n'+raw('>>自身當回合受到非真實'),'opp_after_skill',[
  {acts:[a('status',{side:'self',status:'燒傷',chance:100})]},
  {acts:[a('status',{side:'opp',status:'燒傷',chance:100})]},
  {chain:'any_fail',acts:[a('clear_turn',{side:'opp'})]},
  {cond:[c('has_status',{side:'opp',status:'燒傷'})],acts:[a('clear_turn',{side:'opp'})]},
  {cond:[c('player_state',{key:AINS_HP_SNAPSHOT,equals:true,thisRound:true})],acts:[grantOrderFire(),a('status_convert_uses',{side:'opp',count:1,fromStatus:'燒傷',status:'焚燼'})]},
  {cond:[c('player_state',{key:AINS_HP_SNAPSHOT,equals:false,thisRound:true})],acts:[a('dmg_mod_turns',{side:'self',dir:'in',kind:'非真實',reduce:.6,turns:1}),a('recovery_scale_turns',{side:'self',multiplier:2,turns:1})]},
 ],11),
 ...IMMORTAL_AINS_ROUND_END_KIT,
];
/** 魂印只採強化版；舊版原文保存在來源檔，不疊加舊版致死限一次等規則。 */
export const IMMORTAL_AINS_SEED={id:'5038',seerId:3467,name:'不滅.艾恩斯',type:'火',level:100,height:181,weight:75,
 baseStats:{hp:182,atk:153,def:120,spatk:80,spdef:120,speed:135},
 skills:IMMORTAL_AINS_SKILLS,skillPool:[...IMMORTAL_AINS_SKILLS,IMMORTAL_AINS_SUBDUE].map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:soulText,effectType:'none',effectValue:0,effectMode:'kit',kit:IMMORTAL_AINS_SOUL_KIT},
 description:'依正式來源強化版實裝；身高體重依SeerAPI 3467。',
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
