import React from 'react';
import type {Elf} from '../../types';
import {ElfAvatar} from '../../components/SeerImages';
import {animationModeFor,readAnimationSettings,BATTLE_ANIMATION_EVENT} from '../../battle/animationSettings';
import {petAnimationBinding,isPetDegraded,onPetDegraded} from '../../battle/petAnimationRegistry';
const HomePetActionLayer=React.lazy(()=>import('./HomePetActionLayer'));
/** 只用於新版首頁；不改動共用 ElfAvatar，圖鑑／背包／編輯器不會啟動播放器。動態層（量測、對位、播放器）延後載入，靜態模式完全不下載。 */
export function HomePetFigure({elf,style}:{elf:Elf;style:React.CSSProperties}){
 const host=React.useRef<HTMLDivElement>(null);
 const [settings,setSettings]=React.useState(readAnimationSettings),[ready,setReady]=React.useState(false),[visible,setVisible]=React.useState(false);
 const [size,setSize]=React.useState({w:0,h:0});
 const [,setDegradedTick]=React.useState(0);
 React.useEffect(()=>onPetDegraded(()=>setDegradedTick(n=>n+1)),[]);
 React.useEffect(()=>{const refresh=()=>setSettings(readAnimationSettings());window.addEventListener(BATTLE_ANIMATION_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(BATTLE_ANIMATION_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
 React.useEffect(()=>{if(!host.current||typeof ResizeObserver==='undefined'||typeof IntersectionObserver==='undefined')return;const el=host.current;const resize=new ResizeObserver(()=>setSize({w:el.clientWidth,h:el.clientHeight}));resize.observe(el);const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(el);return()=>{resize.disconnect();observer.disconnect();};},[]);
 const enabled=visible&&animationModeFor(settings,elf)==='actions'&&!!petAnimationBinding(elf)&&!isPetDegraded('p2',elf)&&size.w>0&&size.h>0;
 return <div ref={host} className="absolute inset-0 pointer-events-none" data-animation-surface="home">
  <ElfAvatar elf={elf} kind="body" className="absolute inset-0 w-full h-full" style={{...style,visibility:enabled&&ready?'hidden':undefined}}/>
  {enabled&&<React.Suspense fallback={null}><HomePetActionLayer elf={elf} style={style} host={host} width={size.w} height={size.h} onReady={setReady}/></React.Suspense>}
 </div>;
}
