import {PET_ANIMATION_ASSETS,type PetAnimationAssetId} from './petAnimationAssets';
import type {PetAction} from './petAnimationRegistry';

/** 素材登記的絕招序列名；必須同時列在該素材的 sequences 清單，否則視為未登記（回到既有 sa/attack/cp 對應）。 */
export function ultimateSequenceOf(assetId:PetAnimationAssetId|string|null|undefined):string|null{
 if(!assetId)return null;
 const meta=(PET_ANIMATION_ASSETS as Record<string,unknown>)[assetId] as {fullscreen?:{ultimate?:string};sequences:readonly {name:string}[]}|undefined;
 const name=meta?.fullscreen?.ultimate;
 return name&&meta!.sequences.some(s=>s.name===name)?name:null;
}
/** 出招動畫物件是否來自第五技能（旗標由戰鬥引擎寫入；只認資料旗標，不以名稱／格位推定）。 */
export function isFifthSkillAnim(anim:unknown):boolean{
 return !!anim&&typeof anim==='object'&&(anim as {isFifthSkill?:unknown}).isFifthSkill===true;
}
/** 第五技能且素材有登記絕招序列 → 'ultimate'；其餘（含額外行動、受擊）維持原對應。 */
export function routeUltimate(base:PetAction,anim:unknown,hasUltimate:boolean):PetAction{
 return hasUltimate&&isFifthSkillAnim(anim)&&(base==='attack'||base==='sa'||base==='cp')?'ultimate':base;
}
/** 切換片段會先送出舊片段 cancel；只有新片段本身的事件才能改名為額外行動／第五技。 */
export function playbackEventForAction<T extends {sequence:string}>(event:T,action:string,actualSequence:string):T{
 return (action==='extra'||action==='ultimate')&&event.sequence===actualSequence?{...event,sequence:action}:event;
}
