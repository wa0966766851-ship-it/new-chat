import type {Elf} from '../types';
import {PEGASUS_SOURCE} from './pegasusSource';
import {PEGASUS_READY_SKILLS} from './pegasusSkills';
import {PEGASUS_SOUL_KIT} from './pegasusSoulKit';
export const PEGASUS_SEED={id:'5046',seerId:999,name:'聖光天馬.珀伽索斯',type:'光.飛行',level:100,
 baseStats:{hp:185,atk:70,def:120,spatk:165,spdef:120,speed:140},
 skills:PEGASUS_READY_SKILLS,skillPool:PEGASUS_READY_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'專屬特性',description:PEGASUS_SOURCE.split('魂印:')[1].split('眩暈:')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:PEGASUS_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
