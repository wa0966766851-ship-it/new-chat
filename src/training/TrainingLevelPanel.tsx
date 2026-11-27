import React from 'react';
import type {Elf} from '../types';
import {normalizeElfStats} from '../utils/elfStats';
import {MAX_LEVEL,trainingLevel} from './levelPolicy';
import './trainingLevel.css';
export function TrainingLevelPanel({elf,readonly,onChange}:{elf:Elf;readonly?:boolean;onChange:(elf:Elf)=>void}){
 const level=trainingLevel(elf.level),setup=elf.startingHp||{mode:'percent' as const,value:100};
 const change=(patch:Partial<Elf>)=>onChange(normalizeElfStats({...elf,...patch}));
 return <section className="atr-panel training-level" aria-label="等級與開戰體力"><header><b>等級與開戰體力</b><small>經驗 ∞ · 自由調整</small></header>
  <label className="training-level-row">等級 <input aria-label="精靈等級" type="number" min={1} max={MAX_LEVEL} disabled={readonly} value={level} onChange={e=>change({level:trainingLevel(Number(e.target.value))})}/><span>／{MAX_LEVEL}</span></label>
  <input aria-label="等級滑桿" type="range" min={1} max={MAX_LEVEL} disabled={readonly} value={level} onChange={e=>change({level:Number(e.target.value)})}/>
  <div className="atr-presets">{[1,50,100,120].map(n=><button type="button" className="atr-pill" disabled={readonly} key={n} onClick={()=>change({level:n})}>Lv.{n}</button>)}</div>
  <label className="training-hp-row">開戰體力 <select aria-label="開戰體力方式" disabled={readonly} value={setup.mode} onChange={e=>change({startingHp:{mode:e.target.value as 'percent'|'absolute',value:e.target.value==='percent'?100:elf.maxHp}})}><option value="percent">百分比</option><option value="absolute">指定體力</option></select><input aria-label="開戰體力值" type="number" min={1} max={setup.mode==='percent'?100:elf.maxHp} disabled={readonly} value={setup.value} onChange={e=>change({startingHp:{...setup,value:Math.max(1,Math.min(setup.mode==='percent'?100:elf.maxHp,Number(e.target.value)||1))}})}/><span>{setup.mode==='percent'?'%':'HP'}</span></label>
  <button type="button" className="atr-pill" disabled={readonly} onClick={()=>change({startingHp:{mode:'percent',value:100}})}>恢復滿血</button>
 </section>;
}
