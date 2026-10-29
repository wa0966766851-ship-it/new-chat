import type {Elf} from '../types';
import {selectedElfSkin} from '../data/elfSkins';
import {PET_ANIMATION_ASSETS,type PetAnimationAssetId} from './petAnimationAssets';
/** 名稱→素材；只認 PET_ANIMATION_ASSETS 已逐檔登記的名稱，不以序號推算。 */
const BY_NAME=new Map<string,PetAnimationAssetId>(
 Object.entries(PET_ANIMATION_ASSETS).map(([id,meta])=>[meta.name,id as PetAnimationAssetId]),
);
/** 外觀對應必須明確核對；自訂 ID 絕不直接推導官方 ppets 編號。 */
export function petAnimationBinding(elf:Pick<Elf,'id'|'name'|'skinId'|'path'>):PetAnimationAssetId|null {
 const skin=selectedElfSkin(elf);
 if(elf.skinId) return skin?.animationAssetId||null;
 // 已核對的官方完整 URL 僅開放該素材本身，不讓自繪圖誤接同名動畫。
 const named=BY_NAME.get(elf.name);
 if(named){const meta=PET_ANIMATION_ASSETS[named];if('body' in meta&&elf.path===meta.body)return named;}
 // 咤克斯三化身：名稱本身就是素材來源，且路徑必須是該化身的立繪（或未指定）才套用，
 // 避免自繪／自訂外觀被硬套官方動作。
 const zhakesi=/^(憤怒|貪婪|恐懼)的化身[·.]咤克斯$/.exec(elf.name||'');
 if(zhakesi){
  const key=({憤怒:'wrath',貪婪:'greed',恐懼:'fear'} as const)[zhakesi[1] as '憤怒'|'貪婪'|'恐懼'];
  const allowed=!elf.path||elf.path===`zhakesi_${key}`||elf.path===`/elf-art/zhakesi_${key}_body.png`;
  if(allowed)return ({wrath:'zhakesi15008',greed:'zhakesi15009',fear:'zhakesi15010'} as const)[key];
 }
 // 自訂圖址（含自繪立繪）一律不套用官方動作，避免外觀與動作不同來源。
 if(elf.path && /^(\/|https?:|data:)/.test(elf.path) && elf.path!=='/seer/body/70.png') return null;
 if(String(elf.id)==='70' && elf.name==='雷伊') return 'rey70';
 return BY_NAME.get(elf.name)??null;
}
export type PetAction='standby'|'attack'|'sa'|'cp'|'hited'|'extra';
/** 額外行動序列：優先使用登記的 extraSequence；否則依序找 add1/add2/extra；最後才退回 cp。
 *  2026-10-28：次元龍 4586.pet 實際帶 add1(60)/add2(69)，舊邏輯只找 extra 會誤退成 cp。 */
export function petExtraSequence(available:readonly string[],preferred?:string):string {
 if(preferred&&available.includes(preferred))return preferred;
 for(const name of ['add1','add2','extra'])if(available.includes(name))return name;
 return 'cp';
}
/** 已核對 70.pet：24fps；只供播放時間軸，不參與結算。 */
export const PET_SEQUENCE_MS:Record<PetAction,number>={extra:3125,standby:29/24*1000,attack:3125,sa:3125,cp:3125,hited:8/24*1000};
const ready=new Map<string,number>();
export type PetSequenceTiming={duration:number;hit:number};
const timings=new Map<string,Partial<Record<PetAction,PetSequenceTiming>>>();
const listeners=new Map<string,Set<(event:{sequence:string;type:string;marker?:{name:string}})=>void>>();
const playerKey=(side:string,elf?:Pick<Elf,'id'|'name'|'skinId'|'battleId'>)=>`${side}:${elf?`${elf.battleId||elf.id}:${elf.name}:${elf.skinId||''}`:'test'}`;
export function registerPetPlayer(side:string,elf?:Pick<Elf,'id'|'name'|'skinId'|'battleId'>) {const key=playerKey(side,elf);ready.set(key,(ready.get(key)||0)+1);return ()=>{const n=(ready.get(key)||1)-1;n?ready.set(key,n):ready.delete(key);};}
export function readyPetActionDuration(side:string, fallback:number,elf?:Pick<Elf,'id'|'name'|'skinId'|'battleId'>) {return ready.has(playerKey(side,elf))&&!isPetDegraded(side,elf)?timings.get(playerKey(side,elf))?.attack?.duration??(elf?fallback:PET_SEQUENCE_MS.attack):fallback;}
export function registerPetTimings(side:string,elf:Elf,value:Partial<Record<PetAction,PetSequenceTiming>>) {
 const key=playerKey(side,elf);timings.set(key,value);return()=>{if(timings.get(key)===value)timings.delete(key);};
}
export function readyPetTiming(side:string,elf:Elf,action:PetAction) {return ready.has(playerKey(side,elf))&&!isPetDegraded(side,elf)?timings.get(playerKey(side,elf))?.[action]:undefined;}
export function observePetPlayback(side:string,elf:Elf,listener:(event:{sequence:string;type:string;marker?:{name:string}})=>void) {
 const key=playerKey(side,elf);let set=listeners.get(key);if(!set)listeners.set(key,set=new Set());set.add(listener);
 return()=>{set!.delete(listener);if(!set!.size)listeners.delete(key);};
}
export function reportPetPlayback(side:string,elf:Elf,event:{sequence:string;type:string;marker?:{name:string}}) {for(const listener of listeners.get(playerKey(side,elf))||[])listener(event);}

/** 片段播放停住或載入失敗時降級為靜態圖並繼續戰鬥；只影響演出，記錄供檢查。 */
export const PET_RECOVERY_GRACE_MS_DEFAULT=1500;
let recoveryGrace=PET_RECOVERY_GRACE_MS_DEFAULT;
/** 收招等待上限 = 片段長度 + 寬限。 */
export function petRecoveryTimeout(durationMs:number){return Math.max(0,durationMs)+recoveryGrace;}
export function setPetRecoveryGrace(ms:number){recoveryGrace=ms>=0?ms:PET_RECOVERY_GRACE_MS_DEFAULT;}
export interface PetDegradeRecord{side:string;key:string;reason:'timeout'|'load-failed'|'load-timeout';at:number}
const degraded=new Set<string>();
const degradeLog:PetDegradeRecord[]=[];
const degradeListeners=new Set<()=>void>();
export function degradePet(side:string,elf:Pick<Elf,'id'|'name'|'skinId'|'battleId'>|undefined,reason:PetDegradeRecord['reason']){
 const key=playerKey(side,elf);degraded.add(key);degradeLog.push({side,key,reason,at:Date.now()});if(degradeLog.length>50)degradeLog.shift();
 try{console.warn('[pet-actions] 降級為靜態圖',key,reason);}catch{}
 for(const l of [...degradeListeners])l();
}
export function isPetDegraded(side:string,elf?:Pick<Elf,'id'|'name'|'skinId'|'battleId'>){return degraded.has(playerKey(side,elf));}
export function getPetDegradeLog():readonly PetDegradeRecord[]{return degradeLog;}
export function clearPetDegrade(){degraded.clear();degradeLog.length=0;}
export function onPetDegraded(listener:()=>void){degradeListeners.add(listener);return()=>{degradeListeners.delete(listener);};}
