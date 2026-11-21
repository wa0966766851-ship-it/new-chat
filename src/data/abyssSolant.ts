import type {Elf} from '../types';
import {ABYSS_SOLANT_SOURCE} from './abyssSolantSource';
import {ABYSS_SOLANT_SKILLS} from './abyssSolantSkills';
import {ABYSS_SOLANT_SOUL_KIT} from './abyssSolantSoulKit';
/** 虯螭淵玄.索蘭特（自製新型態）；立繪與動作借用暗之龍裔·索蘭特 3536。 */
export const ABYSS_SOLANT_SEED={id:'5054',seerId:3536,name:'虯螭淵玄.索蘭特',type:'暗影.龍',level:100,
 // Seer API pet_encyclopedia_entry/3536、pet/3536（暗之龍裔·索蘭特）。
 height:290,weight:180,gender:'雄性',description:'索蘭特的完全體形態，他是布萊克最忠誠的摯友，總是在危難關頭幫助布萊克！',
 baseStats:{hp:185,atk:60,def:120,spatk:142,spdef:120,speed:133},
 skills:ABYSS_SOLANT_SKILLS,skillPool:ABYSS_SOLANT_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'淵',description:ABYSS_SOLANT_SOURCE.split('專屬特性:')[1].replace(/^”淵”/,'').split('**銜燭令**')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:ABYSS_SOLANT_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
