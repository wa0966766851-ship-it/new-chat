import React from 'react';
import type {Elf} from '../../types';
import type {SwfPlayer} from '@seer-pet-anim/swf-renderer';
import {acquirePetClip} from '../../battle/petAnimationLoader';
import {petAnimationBinding,petExtraSequence,registerPetPlayer,registerPetTimings,reportPetPlayback,degradePet,type PetAction,type PetSequenceTiming} from '../../battle/petAnimationRegistry';
import {getRestVisibleBox,registerVisibleBox,notifyVisibleBoxChanged,boxCenterX,boxCenterY} from '../../battle/visibleBox';
import type {VisibleBox} from '../../battle/spriteMetrics';
import {actionApproach,retargetAttack,bodyTiles,nativeBodyBounds,nativeRestBounds,petCanvasFrame} from '../../battle/petAnimationGeometry';
import {shouldMirrorBattleSprite} from '../../battle/seerAssets';
import {PET_ANIMATION_ASSETS,type PetAnimationAsset,type PetAnimationAssetId} from '../../battle/petAnimationAssets';
import {overrideTint,petColorVariant} from '../../battle/petColorVariants';
import {animationSpeed,readAnimationSettings,BATTLE_ANIMATION_EVENT} from '../../battle/animationSettings';
import {startPetRenderLoop} from '../../battle/petRenderLoop';
import {preparePetFx} from '../../battle/petFxPolicy';
/** 純播放元件；所有動作由既有播放時間軸驅動，動畫標記不觸發傷害或魂印。 */
export function PetActionSprite({elf,side,action,actionToken,width,height,onReady,context='battle',viewport,sink=0,assetId:overrideAsset,enterTransform=false,onTransitionEnd,sizeRefHeight}:{elf:Elf;side:'p1'|'p2';action:PetAction;actionToken?:unknown;width:number;height:number;onReady:(ready:boolean)=>void;context?:'battle'|'home';viewport?:{width:number;height:number;anchorX:number;targetX?:number};sink?:number;assetId?:PetAnimationAssetId;enterTransform?:boolean;onTransitionEnd?:()=>void;sizeRefHeight?:number}){
 const speed=React.useRef(animationSpeed(readAnimationSettings().speed));
 React.useEffect(()=>{const sync=()=>{speed.current=animationSpeed(readAnimationSettings().speed);};window.addEventListener(BATTLE_ANIMATION_EVENT,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(BATTLE_ANIMATION_EVENT,sync);window.removeEventListener('storage',sync);};},[]);
 const playbackAction=React.useRef<string>('standby');
 const host=React.useRef<HTMLDivElement>(null);
 const player=React.useRef<SwfPlayer|null>(null);
 const [ready,setReady]=React.useState(false);
 const [activated,setActivated]=React.useState(false);
 const readyCallback=React.useRef(onReady);readyCallback.current=onReady;
 // 2026-10-28：battleScale 會把本體畫高拉大；畫布高度必須跟著長，否則頂端會被 canvas 邊界裁掉（次元龍被切頭）。
 const __assetForFrame=overrideAsset??petAnimationBinding(elf);
 const __boost=(__assetForFrame&&(PET_ANIMATION_ASSETS as any)[__assetForFrame]?.battleScale)||1;
 const __frame0=petCanvasFrame(viewport?.height??height,height,context==='battle');
 const resolvedAsset=overrideAsset??petAnimationBinding(elf);
 const canvasFrame=__boost>1?{...__frame0,height:Math.max(__frame0.height,height*__boost+__frame0.footroom)}:__frame0;
 const dimensions=React.useRef({width,height,viewport,footroom:canvasFrame.footroom});dimensions.current={width,height,viewport,footroom:canvasFrame.footroom};
 const refit=React.useRef<(()=>void)|null>(null);
 const currentSequence=React.useRef<PetAction|'transform'>('standby');
 const frameIndex=React.useRef(0);
 const sequenceTimings=React.useRef<Partial<Record<PetAction,PetSequenceTiming>>>({});
 const transformPending=React.useRef(enterTransform);
 const flight=React.useRef<HTMLDivElement>(null);
 const frameBox=React.useRef<(()=>VisibleBox|null)|null>(null);
 const restBox=React.useRef<(()=>VisibleBox|null)|null>(null);
 React.useEffect(()=>{refit.current?.();},[width,height,viewport?.width,viewport?.height,viewport?.anchorX]);
 React.useEffect(()=>{
  setReady(false);setActivated(false);const loadStarted=performance.now();
  let alive=true;let instance:SwfPlayer|undefined;let stopListen:(()=>void)|undefined;
  let renderLoop:ReturnType<typeof startPetRenderLoop>|undefined;
  const assetId=resolvedAsset;if(!assetId){readyCallback.current(false);return;}
  const lease=acquirePetClip(assetId);const abort=new AbortController();
  const deadline=setTimeout(()=>{if(!player.current){alive=false;abort.abort();lease.release();degradePet(side,elf,'load-timeout');onTransitionEnd?.();readyCallback.current(false);}},(import.meta as ImportMeta & {env?:{DEV?:boolean}}).env?.DEV?90000:45000);
  void (async()=>{
   const [source,{SwfPlayer}]=await Promise.all([lease.clip,import('@seer-pet-anim/swf-renderer')]);
   const {clip,report:fxReport}=context==='battle'?preparePetFx(source):{clip:source,report:null};
   if(!alive||!host.current)return;
   host.current.dataset.petFxPolicy=fxReport?'large-add-only':'original';
   host.current.dataset.petFxRemoved=String(fxReport?.removedQuads??0);
   const mountStarted=performance.now();
   instance=new SwfPlayer();await instance.mount(host.current,clip,{transparent:true,mode:'fixed',clock:'manual',signal:abort.signal});
   host.current?.setAttribute('data-pet-mount-ms',(performance.now()-mountStarted).toFixed(0));
   host.current?.setAttribute('data-pet-load-ms',(performance.now()-loadStarted).toFixed(0));
   instance.setOnFrameChange(frame=>{frameIndex.current=frame;host.current?.setAttribute('data-pet-frame',String(frame));refit.current?.();});
   if(!alive){instance.destroy();return;}
   // 原廠影格自帶 mulColor／addColor（逐幀調色）。同一段出招裡亮度會在多組數值間跳動
   // （咤克斯 attack 有 0.80 / 0.76 / 0.52 三種），整隻播出來就像三種顏色的分身疊在一起。
   // 使用者要「一種顏色就好」，但也說原廠顏色有價值 —— 所以改成每段序列只留一個代表色。
   // A 方案（使用者 2026-10-27 決定）：保留原廠材質色，不再把整隻統一成一個顏色。
   // 只有具名形態（例如咤克斯三化身）才整隻覆寫成指定的形態色。
   const variant=petColorVariant(elf.name,assetId);
   if(variant.mul||variant.add)overrideTint(clip.sequences.flatMap(s=>s.frames),variant);
   const frames=clip.sequences.find(s=>s.name==='standby')?.frames||[];
   const tiles=bodyTiles(frames.map(f=>f.mesh));
   const bounds=new Map(clip.sequences.map(s=>[s.name,s.frames.map(f=>nativeBodyBounds(f.mesh,tiles)??nativeBodyBounds(f.mesh))]));
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const frame of frames)for(let i=0;i<frame.mesh.positions.length;i+=2){const p=frame.mesh.positions;minX=Math.min(minX,p[i]);maxX=Math.max(maxX,p[i]);minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1]);}
   // 尺寸基準必須是「待機的身體框」，不能是整段待機的原始網格邊界：原始邊界含光暈／翅膀／背景片等大圖塊，
   // 拿它當分母會把整隻精靈縮小好幾倍，連帶讓招式特效永遠構不到對手、背景替換只剩一點點（使用者回報的「動態比靜態小很多」）。
   const reference=nativeRestBounds(frames.map(f=>f.mesh));
   if(reference){minX=reference.left;maxX=reference.right;minY=reference.top;maxY=reference.bottom;}
   if(!Number.isFinite(minX)||maxY<=minY)throw Error('動作邊界無效');
   const sequences=instance.getSequences();
   sequenceTimings.current=Object.fromEntries(sequences.map(s=>[s.name,{duration:s.duration*1000,hit:(s.markers.find(m=>m.name==='action_hit')?.time??s.duration)*1000}]));
   const extraName=petExtraSequence(sequences.map(s=>s.name),(PET_ANIMATION_ASSETS[assetId] as PetAnimationAsset).extraSequence);
   sequenceTimings.current.extra=sequenceTimings.current[extraName as PetAction];
   const fit=()=>{if(!instance||!host.current)return;const config=dimensions.current,w=host.current.clientWidth,h=host.current.clientHeight-config.footroom;// 地平線不隨畫布底部留白移動；角色大小仍由原場地決定。
    // 尺寸只由「高度」決定：靜態立繪與原生動畫必須同高，否則切換演出模式就會跳大小。
    // 待機影格的 mesh 比靜態不透明框寬（含武器、披風擺動），若讓寬度也參與 min()，
    // 場地變寬變矮時（1920×1080）動畫就會被壓矮 30–50px —— 譜尼／聖光斯嘉麗 的症狀。
    // 寬度溢出是允許的（canvas 不裁切），高度不一致才是錯。
    const meta:PetAnimationAsset=PET_ANIMATION_ASSETS[assetId];
    const refH=sizeRefHeight&&sizeRefHeight>0?sizeRefHeight:(maxY-minY);
     const scale=Math.min(config.height,h)/refH*(context==='battle'?(meta.battleScale??1):1);
    // 原生動畫與靜態立繪各自核對方向；只在播放器根節點鏡射一次。
    const sx=shouldMirrorBattleSprite(elf.name,side,false,`/api/pet-animations/bundle/${assetId}`)?-scale:scale;
    const origin=config.viewport?.anchorX??w/2,fallbackTarget=config.viewport?.targetX??origin;
    const sequence=currentSequence.current,timing=sequenceTimings.current[sequence as PetAction];
    const hitFrame=(timing?.hit??0)*clip.frameRate/1000,endFrame=(timing?.duration??0)*clip.frameRate/1000-1;
    const approach=context==='battle'?actionApproach(frameIndex.current,hitFrame,endFrame):0;
    // 對位：讀對手「實際可見框」的近側邊緣；讀不到才退回舊的場域中心。
    const dir=side==='p1'?1:-1,bodyW=(maxX-minX)*scale,rest=host.current.getBoundingClientRect();
    const opponent=context==='battle'?getRestVisibleBox(side==='p1'?'p2':'p1'):null;
    const near=opponent?(dir>0?opponent.left:opponent.right)-rest.left:fallbackTarget;
    const front=origin+dir*bodyW/2,overlap=Math.min(14,bodyW*.05);
    const body=bounds.get(sequence)?.[frameIndex.current]??{left:minX,right:maxX,top:minY,bottom:maxY};
    const rootOffset=((body.left+body.right-minX-maxX)/2)*sx;
    const poseHalfWidth=(body.right-body.left)*scale/2;
    const attack=retargetAttack(origin,near,dir,bodyW/2,rootOffset,poseHalfWidth,approach,overlap);
    const advances=sequence==='attack'&&context==='battle'&&PET_ANIMATION_ASSETS[assetId].physicalMotion==='approach';
    const contact=attack.contact,x=advances?attack.translation:origin;
    const tx=x-(minX+maxX)/2*sx,ty=h+minY*scale;
    // 當前影格包圍框（client px），供對手對位、飄字與特效讀取。
    frameBox.current=()=>{const r=host.current?.getBoundingClientRect();if(!r)return null;
     const {left:x0,right:x1,top:y0,bottom:y1}=body;
     const ax=tx+x0*sx,bx=tx+x1*sx;return {left:r.left+Math.min(ax,bx),right:r.left+Math.max(ax,bx),top:r.top+ty-y1*scale,bottom:r.top+ty-y0*scale};};
    restBox.current=()=>{const r=host.current?.getBoundingClientRect();return r?{left:r.left+origin-bodyW/2,right:r.left+origin+bodyW/2,top:r.top+h-refH*scale,bottom:r.top+h}:null;};
    const currentFront=x+rootOffset+dir*poseHalfWidth;
    host.current.setAttribute('data-pet-origin',String(origin));host.current.setAttribute('data-pet-target',String(near));host.current.setAttribute('data-pet-contact',String(contact));host.current.setAttribute('data-pet-body-x',String(x+rootOffset));host.current.setAttribute('data-pet-body-front',String(currentFront));host.current.setAttribute('data-pet-native-offset',String(rootOffset));host.current.setAttribute('data-pet-body-height',String(refH*scale));host.current.setAttribute('data-pet-contact-gap',String(((near-currentFront)*dir).toFixed(1)));
     // 驗收用：待機框相對外層 div 的幾何，必須與靜態立繪的不透明區域重合。
     const sinkPx=sink||0,restHalf=bodyW/2;
     host.current.setAttribute('data-pet-rest',`${(-restHalf).toFixed(1)},${restHalf.toFixed(1)},${(-sinkPx).toFixed(1)},${(-sinkPx+refH*scale).toFixed(1)}`);
    if(flight.current){const travelling=sequence==='sa'&&frameIndex.current<=hitFrame&&context==='battle'&&near!==origin;
     const aim=opponent?{x:boxCenterX(opponent)-rest.left,y:boxCenterY(opponent)-rest.top}:{x:near,y:h-config.height*.5};
     const t=Math.min(1,frameIndex.current/Math.max(1,hitFrame)),startX=front,startY=h-refH*scale*.5;
     flight.current.style.opacity=travelling?'1':'0';flight.current.style.left=`${startX+(aim.x-startX)*t}px`;flight.current.style.bottom=`${h-(startY+(aim.y-startY)*t)}px`;}
    instance.setFixedTransform({x:tx,y:ty},{x:sx,y:-scale});renderLoop?.invalidate();notifyVisibleBoxChanged();};
   refit.current=fit;
   const resize=new ResizeObserver(fit);resize.observe(host.current);fit();
   instance.playSequence('standby',{loop:true});
   const animation=instance;
   renderLoop=startPetRenderLoop({advance:seconds=>animation.advance(seconds*(context==='battle'?speed.current:1)),draw:()=>animation.draw(),request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),now:()=>performance.now(),visible:()=>!document.hidden});
   const metrics=setInterval(()=>{const stats=renderLoop?.stats();if(host.current&&stats){host.current.dataset.petDrawRate=stats.drawsPerSecond.toFixed(1);host.current.dataset.petRenderMs=stats.averageWorkMs.toFixed(2);host.current.dataset.petRenderMaxMs=stats.maxWorkMs.toFixed(2);}},1000);
   const visibility=()=>{renderLoop?.resetTime();if(document.hidden)instance?.pause();else instance?.play();};document.addEventListener('visibilitychange',visibility);visibility();
   stopListen=()=>{renderLoop?.stop();clearInterval(metrics);resize.disconnect();document.removeEventListener('visibilitychange',visibility);};
   player.current=instance;setReady(true);clearTimeout(deadline);
  })().catch(error=>{clearTimeout(deadline);stopListen?.();renderLoop?.stop();instance?.destroy();lease.release();if(alive){console.warn('[pet-actions] 沿用簡易演出',error);degradePet(side,elf,'load-failed');onTransitionEnd?.();setReady(false);readyCallback.current(false);}});
  return()=>{alive=false;onTransitionEnd?.();clearTimeout(deadline);if(context==='battle')reportPetPlayback(side,elf,{sequence:playbackAction.current,type:'cancel'});abort.abort();stopListen?.();refit.current=null;frameBox.current=null;restBox.current=null;player.current=null;instance?.destroy();lease.release();readyCallback.current(false);};
 },[side,context,elf.id,elf.battleId,elf.name,elf.skinId,resolvedAsset]);
 // 載入完成時若正在出招，等下一個待機邊界才切入，避免半招突然換播放器。
 React.useEffect(()=>{if(ready&&action==='standby')setActivated(true);},[ready,action]);
 React.useEffect(()=>{if(!activated||context!=='battle')return;const stopFrame=registerVisibleBox(side,'animation',()=>frameBox.current?.()??null),stopRest=registerVisibleBox(side,'rest',()=>restBox.current?.()??null);return()=>{stopFrame();stopRest();};},[activated,side,context]);
 React.useEffect(()=>{if(!activated)return;const unregister=context==='battle'?registerPetPlayer(side,elf):undefined;const untiming=context==='battle'?registerPetTimings(side,elf,sequenceTimings.current):undefined;readyCallback.current(true);return()=>{unregister?.();untiming?.();readyCallback.current(false);};},[activated,side,context,elf.id,elf.battleId,elf.name,elf.skinId]);
 React.useEffect(()=>{const p=player.current;if(!p||!activated)return;
  const play=(sequence:PetAction|'transform')=>{playbackAction.current=sequence;const actual=sequence==='extra'?petExtraSequence(p.getSequences().map(s=>s.name),resolvedAsset?(PET_ANIMATION_ASSETS[resolvedAsset] as PetAnimationAsset).extraSequence:undefined):sequence;currentSequence.current=actual;frameIndex.current=0;p.playSequence(actual,{loop:sequence==='standby'});host.current?.setAttribute('data-pet-sequence',actual);if(sequence==='extra')host.current?.setAttribute('data-pet-extra-sequence',actual);if(sequence==='transform')host.current?.setAttribute('data-pet-transform-source',resolvedAsset??'');refit.current?.();notifyVisibleBoxChanged();};
  const unsub=p.subscribe(event=>{if(context==='battle')reportPetPlayback(side,elf,playbackAction.current==='extra'?{...event,sequence:'extra'}:event);if(event.type==='marker')host.current?.setAttribute('data-pet-marker',`${event.sequence}:${event.marker?.name}:${event.playbackId}`);if(event.type==='complete'&&event.sequence!=='standby'){if(event.sequence==='transform')onTransitionEnd?.();play('standby');}});
  if(action==='standby'&&currentSequence.current==='transform')return unsub;
  if(action==='standby'&&transformPending.current&&p.getSequences().some(s=>s.name==='transform')){transformPending.current=false;play('transform');}
  else {transformPending.current=false;onTransitionEnd?.();play(action);}return unsub;
 },[activated,action,actionToken]);
 return <><div ref={host} aria-label={`${elf.name}動作`} data-pet-source={resolvedAsset} data-pet-ready={activated} data-pet-action={action} data-pet-footroom={canvasFrame.footroom.toFixed(1)} style={{position:'absolute',width:viewport?.width??width,height:canvasFrame.height,left:viewport?-viewport.anchorX:-width/2,bottom:-sink-canvasFrame.footroom,visibility:activated?'visible':'hidden',pointerEvents:'none',overflow:'visible'}}/><div aria-hidden="true" style={{position:'absolute',left:viewport?-viewport.anchorX:-width/2,bottom:-sink,pointerEvents:'none',visibility:activated?'visible':'hidden'}}><div ref={flight} data-pet-projectile="presentation" style={{position:'absolute',width:28,height:12,borderRadius:'50%',background:'#fff7ae',boxShadow:'0 0 16px 7px #eab308',transform:'translate(-50%,50%)',opacity:0}}/></div></>;
}
