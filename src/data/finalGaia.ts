import type {Elf} from '../types';
import {FINAL_GAIA_SOURCE} from './finalGaiaSource';
import {FINAL_GAIA_SKILLS} from './finalGaiaSkills';
import {FINAL_GAIA_SOUL_KIT} from './finalGaiaSoulKit';
export const FINAL_GAIA_SEED={id:'5043',seerId:261,name:'終焉戰神.蓋亞',type:'戰鬥',level:100,
 baseStats:{hp:190,atk:200,def:125,spatk:60,spdef:125,speed:150},skills:FINAL_GAIA_SKILLS,skillPool:FINAL_GAIA_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'',description:FINAL_GAIA_SOURCE.split('魂印:')[1].split('技能:')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:FINAL_GAIA_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
