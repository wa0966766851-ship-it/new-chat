import type {Elf} from '../types';
import {ZHAOYUN_SOURCE} from './zhaoyunSource';
import {ZHAOYUN_SKILLS} from './zhaoyunSkills';
import {ZHAOYUN_SOUL_KIT} from './zhaoyunSoulKit';
/** 趙雲（官方 4421 赤膽游龍·趙雲）；屬性、種族值、立繪與動作取自 SeerAPI。 */
export const ZHAOYUN_SEED={id:'5052',seerId:4421,name:'趙雲',type:'光.次元',level:100,
 // Seer API pet_encyclopedia_entry/4421、pet/4421（赤膽遊龍·趙雲）。
 height:191,weight:82,gender:'雄性',description:'龍膽天神的完全體形態，赤心天鑄，萬邪不侵，當陽龍魂佑，破敵膽氣豪！',
 baseStats:{hp:168,atk:150,def:112,spatk:70,spdef:112,speed:138},
 skills:ZHAOYUN_SKILLS,skillPool:ZHAOYUN_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'赤膽',description:ZHAOYUN_SOURCE.split('專屬特性:')[1].split('第五技能')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:ZHAOYUN_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
