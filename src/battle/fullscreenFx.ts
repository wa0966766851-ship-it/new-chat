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

/** 全屏底片的最終擺位（供每影格呼叫）：先看「沿用角色比例、與本體對位」的擺法是否真的蓋住整層（尺寸夠且位置也蓋到四邊）；
 * 沒蓋滿就改用 cover：等比放大到至少鋪滿 layer 的整個 client 矩形，並把底片框置中（P2 鏡射時只翻 x 縮放，置中不變）。
 * layer 必須是 BattleFxLayer 的整層矩形（= 戰鬥畫面根節點），不是精靈畫布或場地。座標系同 setFixedTransform：螢幕 y = y - 原生y × scale。 */
export function fullscreenPlacement(bounds:NativeBounds|undefined|null,layer:{width:number;height:number},aligned:{scale:number;mirrored:boolean;x:number;y:number}):{scale:number;sx:number;x:number;y:number;centered:boolean}{
 const keep={scale:aligned.scale,sx:aligned.mirrored?-aligned.scale:aligned.scale,x:aligned.x,y:aligned.y,centered:false};
 if(!bounds||!(aligned.scale>0)||!(layer.width>0)||!(layer.height>0))return keep;
 const bw=bounds.right-bounds.left,bh=bounds.bottom-bounds.top;
 if(!(bw>0)||!(bh>0))return keep;
 const eps=.5,xa=aligned.x+bounds.left*keep.sx,xb=aligned.x+bounds.right*keep.sx,ya=aligned.y-bounds.bottom*aligned.scale,yb=aligned.y-bounds.top*aligned.scale;
 if(Math.min(xa,xb)<=eps&&Math.max(xa,xb)>=layer.width-eps&&Math.min(ya,yb)<=eps&&Math.max(ya,yb)>=layer.height-eps)return keep;
 const scale=Math.max(layer.width/bw,layer.height/bh),sx=aligned.mirrored?-scale:scale;
 return {scale,sx,x:layer.width/2-(bounds.left+bounds.right)/2*sx,y:layer.height/2+(bounds.top+bounds.bottom)/2*scale,centered:true};
}
