import type {Elf} from '../types';
import type {PetAnimationAssetId} from './petAnimationAssets';
import {petAnimationBinding} from './petAnimationRegistry';

/** 外觀讀取既有積木狀態；不改精靈身分、皮膚、能力或機制。
 *  2026-10-28：馬爾修斯（5016 變革·馬爾修斯 / 3393）雙型態正式接線。
 *  - 堅壁（wall）＝原形 marthus（3393.pet）
 *  - 毀滅（destroy）＝marthusDestroy（290003393.pet，官方 29000+原序號 慣例）
 *  - 極速（speed）＝目前沒有獨立素材，沿用原形（不推算編號、不用猜的素材）
 */
const FORM_PRESENTATIONS: Partial<Record<PetAnimationAssetId, {
  stateKey:string; variants:Record<string,PetAnimationAssetId>;
}>> = {
  marthus: {
    stateKey:'mechCombo',
    variants:{
      堅壁:'marthus',
      極速:'marthus',
      毀滅:'marthusDestroy',
    },
  },
};
export function battleFormAsset(elf:Elf,state?:Record<string,unknown>):PetAnimationAssetId|null {
  const base=petAnimationBinding(elf);
  const rule=base&&FORM_PRESENTATIONS[base];
  return rule?.variants[String(state?.[rule.stateKey])]??base;
}
/** 同一機制可能切換的來源一次預備；只限明確登記的型態，不能推算編號。
 *  回傳值一律包含 base 本身，確保原形與變身素材「兩種一起載入」，切換時不重新抓檔。 */
export function battleFormAssets(elf:Elf):PetAnimationAssetId[] {
  const base=petAnimationBinding(elf),rule=base&&FORM_PRESENTATIONS[base];
  if(!base)return [];
  if(!rule)return [];
  return [...new Set<PetAnimationAssetId>([base,...Object.values(rule.variants)])];
}
/** 出招途中先保持目前來源，收招後才換型態，避免切斷原本的命中事件。 */
export function settledFormAsset<T>(current:T,requested:T,action:string):T {
  return action==='standby'?requested:current;
}
