/** 原生動畫播放器的效能輔助（純演出，不參與結算）。
 * swf-renderer 0.3.2 的 mountStandalone 把 Pixi 解析度寫死為 window.devicePixelRatio，且沒有選項可改；
 * 套件是 registry 依賴（非 vendored、無 patch 機制），所以掛載後用 Pixi 公開 API `renderer.resize(w,h,resolution)` 降到上限。
 * 唯一的非公開存取是 `player.app`（TS private，執行期存在）；取不到就原樣放行，不影響動畫。 */
export const MAX_PET_RESOLUTION=2;
/** 8192 級圖集（聖光普尼、咤克斯系列）的畫布降到 1.5：解析度成本是平方，2→1.5 少 44% 像素。 */
export const LARGE_ATLAS_RESOLUTION=1.5;
export const LARGE_ATLAS_SIZE=8192;

export function petResolutionCap(atlas?:{width?:number;height?:number}|null){
 const size=Math.max(atlas?.width||0,atlas?.height||0);
 return size>=LARGE_ATLAS_SIZE?LARGE_ATLAS_RESOLUTION:MAX_PET_RESOLUTION;
}

export function cappedResolution(dpr:number|undefined,cap:number){
 const ratio=Number.isFinite(dpr)&&(dpr as number)>0?(dpr as number):1;
 return Math.min(ratio,cap);
}

/** 把已掛載播放器的畫布解析度降到 min(dpr, cap)；回傳實際套用的解析度，沒有調整（或取不到 renderer）回傳 null。 */
export function capPlayerResolution(player:unknown,clip?:{atlas?:{width?:number;height?:number}}|null,dpr?:number){
 try{
  const renderer=(player as {app?:{renderer?:{resolution:number;screen:{width:number;height:number};resize:(w:number,h:number,resolution?:number)=>void}}})?.app?.renderer;
  if(!renderer||typeof renderer.resize!=='function')return null;
  const target=cappedResolution(dpr??(typeof window!=='undefined'?window.devicePixelRatio:1),petResolutionCap(clip?.atlas));
  if(!(renderer.resolution>target))return null;
  renderer.resize(renderer.screen.width,renderer.screen.height,target);
  return target;
 }catch(error){console.warn('[pet-actions] 解析度上限略過',error);return null;}
}
