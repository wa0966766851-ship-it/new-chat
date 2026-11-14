import type {Elf} from '../types';
import {MODIS_SOURCE} from './modisSource';
import {MODIS_SOUL_KIT} from './modisSoulKit';
import {MODIS_SKILLS} from './modisSkills';
/** 原稿與可執行積木共用資料；四普通技能在前，第五技能在後。 */
export const MODIS_SEED={id:'5039',seerId:2205,name:'毀滅之神.莫迪西斯',type:'神秘',level:100,height:142,weight:39,
 baseStats:{hp:177,atk:70,def:116,spatk:157,spdef:116,speed:141},skills:MODIS_SKILLS,skillPool:MODIS_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:MODIS_SOURCE.split('魂印:')[1].split('技能:')[0].trim(),effectType:'none',effectValue:0,effectMode:'kit',kit:MODIS_SOUL_KIT},
 description:'依正式來源與使用者語義裁定實裝；身高體重依SeerAPI原版2205。',
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
