import type {Elf} from '../types';
import {DIFU_SOURCE} from './difuSource';
import {DIFU_READY_SKILLS} from './difuSkills';
import {DIFU_SOUL_KIT} from './difuSoulKit';
export const DIFU_SEED={id:'5044',seerId:3590,name:'炫彩山之神.迪符特',type:'普通',level:100,
 baseStats:{hp:176,atk:70,def:117,spatk:143,spdef:117,speed:137},
 skills:DIFU_READY_SKILLS,skillPool:DIFU_READY_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:DIFU_SOURCE.split('魂印:')[1].split('\r\n山神裁決\r\n')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:DIFU_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
