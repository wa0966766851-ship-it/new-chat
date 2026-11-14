import type {Elf} from '../types';
import {NAIFEN_SOURCE} from './naifenSource';
import {NAIFEN_READY_SKILLS} from './naifenSkills';
import {NAIFEN_SOUL_KIT} from './naifenSoulKit';
export const NAIFEN_SEED={id:'5045',seerId:264,name:'月鈴極樂·奈尼芬多',type:'超能',level:100,
 baseStats:{hp:170,atk:110,def:115,spatk:110,spdef:115,speed:130},
 skills:NAIFEN_READY_SKILLS,skillPool:NAIFEN_READY_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:NAIFEN_SOURCE.split('專屬特性:')[1].split('技能:')[0].replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:NAIFEN_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
