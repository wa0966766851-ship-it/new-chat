import type {Skill} from '../types';
import {skillDisplayType} from '../utils/skillPresentation';

/** 相對立繪腳底往上；限制在場地範圍，避免提示落進下方技能面板。 */
export function skillBannerBottom(visibleHeight:number,stageHeight:number):number {
 return Math.max(88,Math.min(Math.max(0,visibleHeight)*.72,Math.max(88,stageHeight-110)));
}
export function skillBannerType(name:string,animation:any,popup:any,skills:Skill[],concealed:boolean):string|undefined {
 if(concealed||!name)return undefined;
 const snapshot=animation?.skillName===name&&animation?.skillType?animation:popup?.skillName===name&&popup?.skillType?popup:undefined;
 if(snapshot)return snapshot.skillType;
 const skill=skills.find(s=>s.name===name);return skill?skillDisplayType(skill):undefined;
}
