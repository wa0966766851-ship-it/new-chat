import type { Elf, Skill, StatType } from '../types';
import { skillPropertyIssue } from '../effects/sequenceContract';

/** 計算用的「視為」不改動真實能力等級，也不需要命中後才開啟。 */
export function skillStageView(elf: Pick<Elf, 'statStages' | 'isInherentInvalid'>, skill: Pick<Skill, 'description'> & Partial<Pick<Skill,'kit'|'effectMode'>> | null | undefined, stat: StatType, opponent = false): number {
  const original = elf.statStages?.[stat] || 0;
  if (!skill || elf.isInherentInvalid) return original;
  if(skill.effectMode==='kit') {
    const modes=(skill as any).resolvedStageViews ?? (skill.kit?.filter(e=>e.codeId==='skill_property'&&e.params.property==='stage_view'&&!skillPropertyIssue(e)&&e.params.conditions.every((c:any)=>{
      const full=Number((skill as any).pp)>=Number((skill as any).maxPp);
      return c.c==='pp_full'&&(c.p?.neg?!full:full);
    })).map(e=>e.params.value)||[]);
    if(opponent&&modes.includes('opp_up_as_down')&&original>0)return -original;
    if(!opponent&&modes.includes('self_down_ignore')&&original<0)return 0;
    if(!opponent&&modes.includes('self_down_as_up')&&original<0)return -original;
    if(!opponent&&modes.includes('self_down_as_double_up')){
      const negatives=Object.values(elf.statStages||{}).filter(v=>v<0);
      if(negatives.length)return Math.max(original,Math.min(6,-2*Math.min(...negatives)));
    }
    return original; // 積木模式不偷偷再解析原文，修改圖紙後立即按參數生效。
  }
  const text = skill.description || '';
  if (opponent) return /(?:將)?對手能力提升(?:狀態|效果)?視為(?:同等級)?能力下降/.test(text) && original > 0 ? -original : original;
  const negatives = Object.values(elf.statStages || {}).filter(v => v < 0);
  if (/自身任意能力下降狀態視為至少2倍同等級的全屬性能力提升/.test(text) && negatives.length) return Math.max(original, Math.min(6, -2 * Math.min(...negatives)));
  if (/自身能力下降(?:狀態|效果)?視為(?:同等級)?能力提升/.test(text) && original < 0) return -original;
  return original;
}
