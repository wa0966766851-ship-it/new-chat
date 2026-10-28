import React from 'react';
import {animationSpeed,readAnimationSettings,writeAnimationSettings,BATTLE_ANIMATION_EVENT} from '../../battle/animationSettings';

export function useAnimationSpeed(){
 const [speed,setSpeed]=React.useState(()=>animationSpeed(readAnimationSettings().speed));
 React.useEffect(()=>{const sync=()=>setSpeed(animationSpeed(readAnimationSettings().speed));window.addEventListener(BATTLE_ANIMATION_EVENT,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(BATTLE_ANIMATION_EVENT,sync);window.removeEventListener('storage',sync);};},[]);
 return speed;
}
export function AnimationSpeedControl(){
 const speed=useAnimationSpeed();
 const [draft,setDraft]=React.useState(String(speed));
 React.useEffect(()=>setDraft(String(speed)),[speed]);
 const apply=(n:number)=>{const value=animationSpeed(n);writeAnimationSettings({...readAnimationSettings(),speed:value});setDraft(String(value));};
 return <div className="flex items-center gap-1 text-xs text-cyan-100 flex-wrap" aria-label="動畫速度控制">
  <span className="hidden sm:inline">動畫速度</span>
  {[1,2,5,10].map(n=><button key={n} type="button" aria-label={`動畫 ${n} 倍速`} aria-pressed={speed===n} onClick={()=>apply(n)} className={`rounded border px-1.5 py-1 ${speed===n?'border-cyan-400 bg-cyan-500/25':'border-white/15 bg-black/25'}`}>×{n}</button>)}
  <input aria-label="自訂動畫倍速" type="number" min={1} max={10} step={0.1} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>apply(Number(draft))} onKeyDown={e=>{if(e.key==='Enter'){apply(Number(draft));e.currentTarget.blur();}}} className="w-14 rounded border border-white/20 bg-slate-950 px-1 py-1"/><span>倍</span>
 </div>;
}
