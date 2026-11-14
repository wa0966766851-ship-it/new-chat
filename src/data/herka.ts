import type {Elf} from '../types';
import {HERKA_SOURCE} from './herkaSource';
import {HERKA_SKILLS} from './herkaSkills';
import {HERKA_SOUL_KIT} from './herkaSoulKit';
/** 原稿與正式積木共用資料；未知原版尺寸不偽造。 */
export const HERKA_SEED={id:'5040',seerId:2824,name:'赫爾卡星魂',type:'電.次元',level:100,
 baseStats:{hp:172,atk:70,def:112,spatk:154,spdef:112,speed:140},skills:HERKA_SKILLS,skillPool:HERKA_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:HERKA_SOURCE.split('魂印:')[1].split('\r\n雷罰')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:HERKA_SOUL_KIT},
 description:'來源原稿保留；身高體重與原版素材待取得可靠資料。',
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
