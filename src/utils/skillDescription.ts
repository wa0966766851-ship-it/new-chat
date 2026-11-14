import type {Skill} from '../types';
import {plainDescription} from './descFormat';

export type SkillEffectRole='innate'|'attached'|'carried';
const markers={innate:'■',attached:'🎯',carried:'◇'};
const clean=(text:string)=>plainDescription(text).replace(/^[■◆◇🎯]\s*/u,'').trim().replace(/[；;。]+$/,'');
const sure=/^(?:必中|必定命中)$/;
/** 無條件必中與命中率是兩種資料，不以「100%命中」或條件句推定必中。 */
export function hasInnateSureHit(skill:Partial<Skill>):boolean {
 return !!skill.isSureHit||!!skill.kit?.some(e=>e.codeId==='skill_property'&&e.params.property==='sure_hit'&&e.params.value===true&&!(e.params.conditions||[]).length)
  ||String(skill.description||'').split(/\r?\n/).some(line=>sure.test(clean(line)));
}
/** 只投影描述，不回寫原文、Kit、存檔指紋或執行模式。舊技能未指定分類時依協定預設附加。 */
export function skillDescriptionText(skill:Partial<Skill>):string {
 const roles=new Map<string,SkillEffectRole>();
 for(const e of skill.kit||[]){
  const role=e.role||(e.codeId==='skill_property'?'innate':'attached');
  if(!['innate','attached','carried'].includes(role))continue;
  const text=e.customText||e.params?.clause?.raw||'';
  for(const line of [text,...text.split(/\r?\n/)])if(clean(line))roles.set(clean(line),role as SkillEffectRole);
 }
 const out:string[]=[];let seenSure=false;
 for(const raw of String(skill.description||'').replace(/\r/g,'').split('\n')){
  if(!raw.trim()||/^\s*(?:#{1,6}\s|【[^】]+】\s*$|---+\s*$)/.test(raw)){out.push(raw);continue;}
  const prefix=raw.match(/^(\s*(?:[>＞]\s*)*)/)?.[0]||'';
  const text=raw.slice(prefix.length);
  const explicit=text.match(/^([■◇🎯◆])\s*/u);
  const source=clean(text);
  const display=text.replace(/^[■◇🎯◆]\s*/u,'').trim().replace(/[；;。]+$/,'');
  // 同一條件的分支不拆成互不相干的效果；已有積木分類／標記的整條原文保持一起。
  const parts=explicit||roles.has(source)?[display]:display.split(/[；;]/).map(x=>x.trim()).filter(Boolean);
  for(let part of parts){
   const normalized=clean(part);
   const combined=normalized.match(/^(?:必中|必定命中)[（(](?:命中率[：:]?\s*)?(\d+(?:\.\d+)?)%[）)]$/);
   if(combined){if(!seenSure){out.push(`${prefix}■ 必中`);seenSure=true;}out.push(`${prefix}■ 命中率${combined[1]}%`);continue;}
   if(sure.test(normalized)&&!prefix.trim()){if(seenSure)continue;seenSure=true;part='必中';}
   const role=explicit?({ '■':'innate','◇':'carried','🎯':'attached'} as Record<string,SkillEffectRole>)[explicit[1]]:
    roles.get(normalized)||(sure.test(normalized)||/^先制[+＋-]?\d+$|^命中率[：:]?\s*\d+(?:\.\d+)?%$/.test(normalized)?'innate':skill.isCarrying?'carried':skill.isInherent?'innate':'attached');
   // 只有明確指回同一操作的成功分支才縮排；「未觸發／若」等不明指代不猜父節點。
   const branch=!prefix.trim()?part.match(/，(?=(?:消除成功|反轉成功|複製成功|吸取成功|恢復成功))/):null;
   const label=explicit?.[1]==='◆'?'◆ ':prefix.trim()?'':`${markers[role||'attached']} `;
   if(branch?.index!==undefined){out.push(`${prefix}${label}${part.slice(0,branch.index+1)}`);out.push(`${prefix}> ${part.slice(branch.index+1)}`);}
   else out.push(`${prefix}${label}${part}`);
  }
 }
 // 先制寫在欄位而描述漏寫時補一行（只看無條件基礎先制；條件先制留在原句）。
 const prio=Number(skill.priority)||0;
 if(prio>0&&!out.some(l=>/先制\s*[:：]?\s*[+＋]\s*\d/.test(l)))out.unshift(`■ 先制+${prio}`);
 if(hasInnateSureHit(skill)&&!seenSure)out.unshift('■ 必中');
 return out.join('\n').trim();
}
