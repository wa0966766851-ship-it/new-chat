import type {Elf} from '../types';
import {NADOLE_SOURCE} from './nadoleSource';
import {NADOLE_SKILLS} from './nadoleSkills';
import {NADOLE_SOUL_KIT} from './nadoleSoulKit';
export const NADOLE_SEED={id:'5042',seerId:88,name:'滄桑移壤·納多雷',type:'地面',level:100,
 baseStats:{hp:183,atk:137,def:130,spatk:70,spdef:130,speed:100},skills:NADOLE_SKILLS,skillPool:NADOLE_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'納',description:NADOLE_SOURCE.split('魂印:納')[1].split('技能組:')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:NADOLE_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
