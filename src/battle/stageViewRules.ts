import type {Elf} from '../types';
/**
 * 能力視圖規則（2026-11-21，趙雲）：「自身處於能力提升時，將自身能力提升等級額外視為對手能力下降」。
 * 同一項對同一項：持有者某項能力提升 n 級 → 持有者看對手的同一項能力時額外 -n。
 * 只影響持有者自己的計算（傷害雙向、出手順序、自身效果判定），不改對手真實等級。
 */
export const selfUpAsOppDown=(elf:Elf|undefined|null)=>!!(elf as any)?.stageViewRules?.selfUpAsOppDown&&!elf?.isInherentInvalid;
/** 持有者看對手某項能力時的額外下降等級（0＝無）。 */
export function viewedOppExtraDown(viewer:Elf|undefined|null,stat:string):number{
  if(!selfUpAsOppDown(viewer))return 0;
  const n=Number((viewer!.statStages as any)?.[stat])||0;
  return n>0?n:0;
}
/** 持有者自身有任一項能力提升：效果判定時對手視為處於能力下降。 */
export const viewsOppAsDown=(viewer:Elf|undefined|null)=>selfUpAsOppDown(viewer)&&Object.values(viewer!.statStages||{}).some(v=>Number(v)>0);
