import type {SwfPlayer} from '@seer-pet-anim/swf-renderer';
import type {SwfClipData} from '@seer-pet-anim/swf-bundle';
import {capPlayerResolution} from './petPlayerPerf';
/** 全屏底片播放器的「閒置預載」外殼。
 * 2026-11-06 決策：底片必須在第一個全屏招式之前就緒（不能晚出現），所以不再延遲到第一個全屏序列、也不再閒置銷毀。
 * 流程：外殼先頂替 `player`（與 SwfPlayer 同名方法）→ 本體就緒後（建立外殼當下）在瀏覽器閒置時預載：
 * 建立第二個 SwfPlayer、掛載（上傳圖集材質）、暖機（隱藏狀態下繪製一次，編譯 shader／上傳緩衝）→ 整場戰鬥保留，卸載（destroy）才銷毀。
 * 若全屏序列在預載完成前就開始，playSequence 會立刻建立（不再等閒置），預載與立即建立共用同一次建立，不會建兩個。
 * swf-renderer 的 mountInto 是「借用外部 renderer、host 自行 render」，底片與本體在不同 DOM 層、不同畫布尺寸，
 * 無法共用同一個 renderer／canvas，所以維持第二個播放器；解析度仍套用上限（capPlayerResolution）。 */
type Box={left:number;right:number;top:number;bottom:number};
export interface LazyFxRuntime{player:SwfPlayer;el:HTMLDivElement;sequences:Set<string>;bounds:Record<string,Box>;frames:Record<string,(Box|null)[]>;on:boolean;/** 測試／診斷：目前是否持有真的播放器 */live():boolean;/** 立即開始預載（已建立或建立中則忽略） */preload():void}
/** 沒有 requestIdleCallback（Safari）時的退路延遲。 */
export const FX_PRELOAD_FALLBACK_MS=120;
/** 瀏覽器閒置時執行 fn；回傳取消函式。requestIdleCallback 不存在就 setTimeout。 */
export function whenIdle(fn:()=>void):()=>void{
 const w=globalThis as unknown as {requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
 if(typeof w.requestIdleCallback==='function'){const id=w.requestIdleCallback(fn,{timeout:2000});return()=>w.cancelIdleCallback?.(id);}
 const id=setTimeout(fn,FX_PRELOAD_FALLBACK_MS);return()=>clearTimeout(id);
}
export function createLazyFxRuntime(o:{layerHost:HTMLElement;side:string;fxClip:SwfClipData;sequences:Iterable<string>;bounds:LazyFxRuntime['bounds'];frames:LazyFxRuntime['frames'];createPlayer:()=>SwfPlayer;signal?:AbortSignal;/** 本體目前的序列時間（秒），提前開始的全屏序列對齊用 */mainTime?:()=>number|undefined;/** false = 不自動預載（只在全屏序列開始時才建立）；預設 true */preload?:boolean;/** 注入閒置排程（測試用）；回傳取消函式 */idle?:(fn:()=>void)=>()=>void}):LazyFxRuntime{
 const el=o.layerHost.ownerDocument.createElement('div');el.dataset.petFxLayer=o.side;el.style.cssText='position:absolute;inset:0;pointer-events:none;visibility:hidden';o.layerHost.appendChild(el);
 const sequences=new Set(o.sequences);
 let real:SwfPlayer|null=null,creating=false,destroyed=false,failed=false,paused=false,want:{name:string;loop:boolean}|null=null,transform:[{x:number;y:number},{x:number;y:number}]|null=null,on=false,cancelIdle:(()=>void)|null=null;
 const apply=(p:SwfPlayer)=>{
  if(want){p.playSequence(want.name,{loop:want.loop});const t=o.mainTime?.();if(t&&t>0)(p as SwfPlayer&{seek?:(s:number)=>void}).seek?.(t);}
  if(transform)p.setFixedTransform(transform[0],transform[1]);
  if(paused)p.pause();
 };
 const ensure=()=>{
  if(real||creating||destroyed||failed)return;creating=true;
  void (async()=>{
   const p=o.createPlayer();
   try{await p.mount(el,o.fxClip,{transparent:true,mode:'fixed',clock:'manual',signal:o.signal});}
   catch(error){creating=false;p.destroy();if(destroyed||o.signal?.aborted)return;failed=true;console.warn('[pet-actions] 全屏底片層略過',error);return;}
   creating=false;if(destroyed||o.signal?.aborted){p.destroy();return;}
   capPlayerResolution(p,o.fxClip);real=p;apply(p);
   // 暖機：在隱藏狀態繪製一次，讓 shader 編譯、緩衝與材質在第一個全屏招式之前就上傳完成。
   if(!want){const first=sequences.values().next().value;if(first)p.playSequence(first,{loop:false});}
   try{p.draw();}catch(error){console.warn('[pet-actions] 全屏底片暖機略過',error);}
  })();
 };
 if(o.preload!==false)cancelIdle=(o.idle??whenIdle)(()=>{cancelIdle=null;ensure();});
 const facade={
  playSequence(name:string,opts?:{loop?:boolean}){want={name,loop:!!opts?.loop};if(real){real.playSequence(name,opts);return {} as never;}ensure();return {} as never;},
  advance(dt:number){real?.advance(dt);},draw(){real?.draw();},
  pause(){paused=true;real?.pause();},play(){paused=false;real?.play();},
  setFixedTransform(position:{x:number;y:number},scale:{x:number;y:number}){transform=[position,scale];real?.setFixedTransform(position,scale);},
  destroy(){destroyed=true;cancelIdle?.();cancelIdle=null;creating=false;const p=real;real=null;p?.destroy();},
 } as unknown as SwfPlayer;
 return {player:facade,el,sequences,bounds:o.bounds,frames:o.frames,
  get on(){return on;},set on(v:boolean){on=v;},
  live:()=>real!==null,preload:ensure};
}
