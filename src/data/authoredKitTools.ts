import type {KitEntry} from '../effects/effectSystem.schema';
import type {Skill} from '../types';
import {SEQUENCE_TRIGGERS} from '../effects/sequenceTriggers';
export const condition=(c:string,p:any={})=>({c,p,label:c});
export const actions=(...acts:any[])=>({acts});
export const operation=(op:string,p:any={})=>({op,p,label:op});
export function authoredEntry(text:string,trig:string,body:any[],order:number,source:'skill'|'soulmark'='skill',innate=false,cond:any[]=[]):KitEntry{
 if(!SEQUENCE_TRIGGERS[trig])throw Error(`沒有接線的時點：${trig}`);
 return {codeId:'effect_sequence',node:SEQUENCE_TRIGGERS[trig] as KitEntry['node'],source,role:source==='soulmark'||innate?'innate':'attached',order,customText:text,
 params:{clause:{raw:text,trig,parsed:true,body,...(cond.length?{cond}:{})}}};
}
export function authoredSkill(name:string,type:string,category:Skill['category'],power:number,pp:number,priority:number,kit:KitEntry[],options:{accuracy?:number;sure?:boolean;fifth?:boolean;labelEffects?:boolean}={}):Skill{
 return {name,type,category,power,pp,currentPp:pp,maxPp:pp,priority,accuracy:options.accuracy??100,isSureHit:options.sure??false,isFifthSkill:options.fifth??false,
 effectMode:'kit',effectType:'none',effectDetail:'',description:[...new Set(kit.filter(k=>k.customText).map(k=>options.labelEffects?`${k.role==='innate'?'■':k.role==='carried'?'◇':'🎯'} ${k.customText}`:k.customText))].join('\n'),kit};
}
