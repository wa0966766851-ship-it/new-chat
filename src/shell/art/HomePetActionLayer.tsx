import React from 'react';
import type {Elf} from '../../types';
import {measureOpaqueBox} from '../../battle/opaqueMeasure';
import {homeStaticVisibleRect,type OpaqueBox} from '../../battle/spriteMetrics';
import {PetActionSprite} from '../../components/battle/PetActionSprite';
/**
 * 新版首頁動態立繪層（只在「精靈動作」模式且該精靈有動作素材時才載入）。
 * 依靜態圖的不透明區域定位與定大小（同一張圖、同一條腳底線）：
 * 先前直接填滿整個容器，動畫比靜態圖大、位置偏下，切換瞬間會跳動；靜態圖缺檔時才退回整個容器。
 */
export default function HomePetActionLayer({elf,style,host,width,height,onReady}:{elf:Elf;style:React.CSSProperties;host:React.RefObject<HTMLDivElement|null>;width:number;height:number;onReady:(ready:boolean)=>void}){
 const [box,setBox]=React.useState<{src:string;box:OpaqueBox}|null>(null),[imageFailed,setImageFailed]=React.useState(false);
 // 量測靜態立繪的可見範圍；換圖（備援鏈切換、換精靈）時重量，未載入前不沿用上一張。
 React.useEffect(()=>{
  const root=host.current;if(!root||typeof MutationObserver==='undefined')return;let alive=true;const pending=new Map<HTMLImageElement,()=>void>();
  const check=()=>{
   if(!alive)return;const img=root.querySelector('img');if(!img){setBox(null);setImageFailed(true);return;}
   const source=img.currentSrc||img.src;setBox(prev=>prev&&prev.src!==source?null:prev);setImageFailed(false);
   const done=()=>{if(!alive||!root.contains(img)||!img.naturalWidth)return;const src=img.currentSrc||img.src;setImageFailed(false);setBox(prev=>prev&&prev.src===src?prev:{src,box:measureOpaqueBox(img)});};
   const fail=()=>{if(alive&&root.contains(img))setImageFailed(true);};
   const old=pending.get(img);if(old)img.removeEventListener('load',old);
   if(img.complete&&img.naturalWidth)done();else if(img.complete)fail();else{pending.set(img,done);img.addEventListener('load',done,{once:true});img.addEventListener('error',fail,{once:true});}
  };
  check();const mo=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||(r.target as Element).tagName==='IMG'))check();});
  mo.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  return()=>{alive=false;mo.disconnect();pending.forEach((h,img)=>img.removeEventListener('load',h));};
 },[host,elf.id,elf.name,elf.skinId,elf.path]);
 const fit=style.objectFit==='cover'?'cover':'contain';
 const rect=box?homeStaticVisibleRect(box.box,width,height,fit):imageFailed?{width,height,centerX:width/2,bottomOffset:0}:null;
 if(!rect)return null;
 return <div className="absolute inset-0" style={style}><div data-home-pet-box={`${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`} style={{position:'absolute',left:rect.centerX,bottom:rect.bottomOffset}}><React.Fragment key={`${elf.id}:${elf.skinId||''}`}><PetActionSprite elf={elf} side="p2" context="home" action="standby" width={rect.width} height={rect.height} onReady={onReady}/></React.Fragment></div></div>;
}
