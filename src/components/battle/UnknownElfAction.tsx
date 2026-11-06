import React from 'react';
import type {Elf} from '../../types';
import {createCustomBattleFx} from '../../battle/customBattleFx';
import {getFxHost} from '../../battle/fullscreenFx';
import {getVisibleBox,getRestVisibleBox} from '../../battle/visibleBox';
import {registerPetPlayer,registerPetTimings,reportPetPlayback,type PetAction} from '../../battle/petAnimationRegistry';
import {animationSpeed,readAnimationSettings,BATTLE_ANIMATION_EVENT} from '../../battle/animationSettings';

// 共用占位演出：不讀真實來源、身高、技能系別或專屬特效，所有出招類型完全一致。
const FRAMES=48,HIT=26,FPS=24;
export function UnknownElfAction({elf,side,action,actionToken}:{elf:Elf;side:'p1'|'p2';action:PetAction;actionToken?:unknown}){
 const speed=React.useRef(animationSpeed(readAnimationSettings().speed));
 React.useEffect(()=>{const sync=()=>{speed.current=animationSpeed(readAnimationSettings().speed);};window.addEventListener(BATTLE_ANIMATION_EVENT,sync);return()=>window.removeEventListener(BATTLE_ANIMATION_EVENT,sync);},[]);
 React.useEffect(()=>{
  const off=registerPetPlayer(side,elf),timings=Object.fromEntries(['attack','sa','cp','extra','ultimate'].map(a=>[a,{duration:FRAMES/FPS*1000,hit:HIT/FPS*1000}]));
  const untiming=registerPetTimings(side,elf,timings);return()=>{off();untiming();};
 },[side,elf.id,elf.battleId,elf.name,elf.skinId]);
 React.useEffect(()=>{
  if(action==='standby'||action==='hited')return;
  const host=getFxHost();if(!host)return;
  const fx=createCustomBattleFx(host,{style:'sigil',color:'#94a3b8',secondary:'#e2e8f0'},side);
  let ticket=0,frame=0,last=performance.now(),hit=false,complete=false;
  const draw=(now:number)=>{
   frame+=(now-last)/1000*FPS*speed.current;last=now;
   const own=getVisibleBox(side);
   if(own)fx.draw({sequence:'sa',frame:Math.min(FRAMES-1,Math.floor(frame)),frames:FRAMES,hits:[HIT],caster:own,target:getRestVisibleBox(side==='p1'?'p2':'p1'),mirrored:side==='p2'});
   if(!hit&&frame>=HIT){hit=true;reportPetPlayback(side,elf,{sequence:action,type:'marker',marker:{name:'action_hit'}});}
   if(frame>=FRAMES){complete=true;fx.destroy();reportPetPlayback(side,elf,{sequence:action,type:'complete'});return;}
   ticket=requestAnimationFrame(draw);
  };
  ticket=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(ticket);fx.destroy();if(!complete)reportPetPlayback(side,elf,{sequence:action,type:'cancel'});};
 },[side,action,actionToken,elf.id,elf.battleId,elf.name,elf.skinId]);
 return <span hidden data-unknown-elf-action={side} data-unknown-sequence={action}/>;
}
