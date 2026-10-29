import type {VisibleBox} from './spriteMetrics';
/**
 * 對手立繪「實際可見範圍」登錄處（純演出，不參與結算）。座標一律為瀏覽器視窗座標（client px）。
 * 靜態立繪登錄 'image'（DOM 包圍框扣除透明邊）；動作播放器就緒後登錄 'animation'（當前影格包圍框），優先使用。
 * 接觸點、投射物、飄字、特效起訖都從 getVisibleBox 取座標。
 */
export type VisibleBoxSide='p1'|'p2';
export type VisibleBoxKind='image'|'animation'|'rest';
type Getter=()=>VisibleBox|null;
const sources=new Map<string,Getter>();
const listeners=new Set<()=>void>();
const key=(side:VisibleBoxSide,kind:VisibleBoxKind)=>`${side}:${kind}`;
const valid=(b:VisibleBox|null|undefined):b is VisibleBox=>!!b&&[b.left,b.right,b.top,b.bottom].every(Number.isFinite)&&b.right>b.left&&b.bottom>b.top;
export function registerVisibleBox(side:VisibleBoxSide,kind:VisibleBoxKind,getter:Getter){
 const k=key(side,kind);sources.set(k,getter);notifyVisibleBoxChanged();
 return()=>{if(sources.get(k)===getter){sources.delete(k);notifyVisibleBoxChanged();}};
}
export function getVisibleBox(side:VisibleBoxSide):VisibleBox|null{
 for(const kind of ['animation','image'] as const){
  let box:VisibleBox|null=null;
  try{box=sources.get(key(side,kind))?.()??null;}catch{box=null;}
  if(valid(box))return box;
 }
 return null;
}
/** 攻擊對位只讀固定站位；不可追著受擊、跳躍、光束的當前影格跑。 */
export function getRestVisibleBox(side:VisibleBoxSide):VisibleBox|null{
 const box=sources.get(key(side,'rest'))?.();return valid(box)?box:getVisibleBox(side);
}
/** 版面、換人、圖片載入、動畫切換時呼叫；訂閱者重算位置。 */
export function notifyVisibleBoxChanged(){for(const l of [...listeners])l();}
export function subscribeVisibleBox(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const boxCenterX=(b:VisibleBox)=>(b.left+b.right)/2;
export const boxCenterY=(b:VisibleBox)=>(b.top+b.bottom)/2;
/** 飄字錨點：可見框水平中心、垂直從上緣往下 28% 處（所有尺寸一致）。 */
export function popupAnchor(box:VisibleBox){return {x:boxCenterX(box),y:box.top+(box.bottom-box.top)*.28};}
