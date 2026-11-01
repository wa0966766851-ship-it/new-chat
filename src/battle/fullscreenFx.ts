import React from 'react';
import type {NativeBounds} from './petAnimationGeometry';

/** 全屏演出層（BattleFxLayer）與各精靈動畫畫布之間的小型登記表；純演出，不參與結算。
 * - 全屏層掛載時登記自己的 host；PetActionSprite 載入完成後把「全屏底片專用」的第二個播放器掛進去。
 * - 某側正在播全屏序列時標記 active：全屏層顯示、精靈提高層級到全屏層之上（兩隻都看得到），HUD／指令列仍在最上。
 * 沒有登記 host（首頁、預覽、測試）時完全不啟用，行為與舊版相同。 */
let host:HTMLElement|null=null;
const active=new Set<string>();
const listeners=new Set<()=>void>();
const emit=()=>{for(const l of [...listeners])l();};
export function registerFxHost(el:HTMLElement){host=el;return()=>{if(host===el)host=null;};}
export function getFxHost(){return host;}
export function setFullscreenFxActive(key:string,on:boolean){const had=active.has(key);if(on===had)return;if(on)active.add(key);else active.delete(key);emit();}
export function isFullscreenFxActive(){return active.size>0;}
export function subscribeFullscreenFx(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function useFullscreenFxActive():boolean{return React.useSyncExternalStore(subscribeFullscreenFx,isFullscreenFxActive,()=>false);}
export function resetFullscreenFx(){active.clear();emit();}

/** 全屏底片的縮放：底片聯集框若已覆蓋整層就沿用角色比例（與本體對位）；
 * 不足時改用「cover」等比放大並置中到整層，確保真的鋪滿畫面。不改本體與一般光效，只影響全屏層裡的底片。 */
export function fullscreenFit(bounds:NativeBounds|undefined|null,layer:{width:number;height:number},baseScale:number):{scale:number;centered:boolean}{
 if(!bounds||!(baseScale>0)||!(layer.width>0)||!(layer.height>0))return {scale:baseScale,centered:false};
 const bw=bounds.right-bounds.left,bh=bounds.bottom-bounds.top;
 if(!(bw>0)||!(bh>0))return {scale:baseScale,centered:false};
 if(bw*baseScale>=layer.width&&bh*baseScale>=layer.height)return {scale:baseScale,centered:false};
 return {scale:Math.max(layer.width/bw,layer.height/bh),centered:true};
}
