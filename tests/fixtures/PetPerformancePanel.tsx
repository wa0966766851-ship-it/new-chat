import React from 'react';
import {petClipDiagnostics,petClipLeaseSnapshot} from '../../src/battle/petAnimationLoader';
/** 驗收頁才啟用；觀察結果寫進可見 DOM，避免自動化讀取播放器私有狀態。 */
export function PetPerformancePanel(){
 const [sample,setSample]=React.useState<any>({});
 React.useEffect(()=>{
  let previous=performance.now(),ticket=0;const gaps:number[]=[];let longTasks=0;
  // 換出招方會重建戰場並重用 presentationId；以實際 DOM 節點去重，避免漏掉右側出招。
  const impacts:Record<string,unknown>[]=[],seen=new WeakMap<HTMLElement,string>();
  const frame=(time:number)=>{if(!document.hidden){gaps.push(time-previous);if(gaps.length>300)gaps.shift();
   for(const popup of document.querySelectorAll<HTMLElement>('[data-battle-popup]')){
    const id=popup.dataset.presentationId;if(!id||seen.get(popup)===id)continue;seen.set(popup,id);
    const receiver=popup.closest<HTMLElement>('[data-sprite-side]')?.dataset.spriteSide;
    const actor=document.querySelector<HTMLElement>('[data-sprite-side="'+(receiver==='p1'?'p2':'p1')+'"] [data-pet-source]');
    if(actor)impacts.push({atMs:Math.round(time),kind:popup.dataset.battlePopup,receiver,source:actor.dataset.petSource,sequence:actor.dataset.petSequence,frame:actor.dataset.petFrame,marker:actor.dataset.petMarker,gap:actor.dataset.petContactGap,origin:actor.dataset.petOrigin,bodyX:actor.dataset.petBodyX,nativeOffset:actor.dataset.petNativeOffset});
    if(impacts.length>20)impacts.shift();
   }
  }previous=time;ticket=requestAnimationFrame(frame);};ticket=requestAnimationFrame(frame);
  let observer:PerformanceObserver|undefined;
  try{observer=new PerformanceObserver(list=>{longTasks+=list.getEntries().length;});observer.observe({entryTypes:['longtask']});}catch{}
  const timer=setInterval(()=>{const sorted=[...gaps].sort((a,b)=>a-b);setSample({viewport:[innerWidth,innerHeight,devicePixelRatio],frameP95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]||0),longTasks,impacts:[...impacts],leases:petClipLeaseSnapshot(),cache:petClipDiagnostics(),players:[...document.querySelectorAll<HTMLElement>('[data-pet-source]')].map(e=>({source:e.dataset.petSource,ready:e.dataset.petReady,loadMs:e.dataset.petLoadMs,mountMs:e.dataset.petMountMs,drawRate:e.dataset.petDrawRate,renderMs:e.dataset.petRenderMs,renderMaxMs:e.dataset.petRenderMaxMs,sequence:e.dataset.petSequence,frame:e.dataset.petFrame,gap:e.dataset.petContactGap}))});},1000);
  return()=>{cancelAnimationFrame(ticket);clearInterval(timer);observer?.disconnect();};
 },[]);
 return <details><summary>載入與播放量測</summary><p>頁面影格間隔 P95：{sample.frameP95Ms??'—'} ms；長任務 {sample.longTasks??0} 次。重畫率應接近素材的 24／25fps，不必追求 60 次重畫。</p><pre data-pet-performance style={{fontSize:11,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(sample,null,2)}</pre></details>;
}
