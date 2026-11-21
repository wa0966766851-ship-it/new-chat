import type {Elf} from '../types';
import {DARK_BLAKE_SOURCE} from './darkBlakeSource';
import {DARK_BLAKE_SKILLS} from './darkBlakeSkills';
import {DARK_BLAKE_SOUL_KIT} from './darkBlakeSoulKit';
/** 晻藹夜靈.布萊克（自製新型態）；使用者指定沿用混沌·布萊克 3539 的立繪與動作（同一套）。 */
export const DARK_BLAKE_SEED={id:'5053',seerId:3539,name:'晻藹夜靈.布萊克',type:'暗影',level:100,
 // Seer API pet_encyclopedia_entry/3539、pet/3539（混沌布萊克，本型態沿用其立繪）。
 height:190,weight:75,gender:'雄性',description:'即使混沌佔據身體，但正義的精神不會倒下！縱然黑暗吞噬靈魂，但永恆的心靈不會腐朽！身處黑暗，心向光明！他是光明守護者！他是布萊克！',
 baseStats:{hp:195,atk:185,def:130,spatk:60,spdef:130,speed:150},
 skills:DARK_BLAKE_SKILLS,skillPool:DARK_BLAKE_SKILLS.map(s=>structuredClone(s)),
 // 使用者指定：技能庫另含混沌·布萊克（5015）的技能（沿用其審核 Kit）。
 sharedSkillPoolFrom:['5015'],
 soulMark:{name:'夜靈',description:DARK_BLAKE_SOURCE.split('專屬特性:')[1].split('先三:')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:DARK_BLAKE_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
