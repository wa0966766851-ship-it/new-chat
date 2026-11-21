import React from 'react';
import type {Elf} from '../../types';
import type {SwfPlayer} from '@seer-pet-anim/swf-renderer';
import {acquirePetClip} from '../../battle/petAnimationLoader';
import {petAnimationBinding,petExtraSequence,registerPetPlayer,registerPetTimings,reportPetPlayback,degradePet,type PetAction,type PetSequenceTiming} from '../../battle/petAnimationRegistry';
import {getRestVisibleBox,registerVisibleBox,notifyVisibleBoxChanged,boxCenterX,boxCenterY} from '../../battle/visibleBox';
import type {VisibleBox} from '../../battle/spriteMetrics';
import {actionApproach,retargetAttack,petCanvasFrame,physicalContactOffset,anchorPhysicalImpact} from '../../battle/petAnimationGeometry';
import {shouldMirrorBattleSprite} from '../../battle/seerAssets';
import {PET_ANIMATION_ASSETS,type PetAnimationAsset,type PetAnimationAssetId} from '../../battle/petAnimationAssets';
import {overrideTint,petColorVariant} from '../../battle/petColorVariants';
import {animationSpeed,readAnimationSettings,BATTLE_ANIMATION_EVENT,qualityStandbyFrameMs,qualityAllowsFullscreenFx,type AnimationQuality} from '../../battle/animationSettings';
import {hasForegroundPetPlayback,setForegroundPetPlayback,startPetRenderLoop} from '../../battle/petRenderLoop';
import {PERF_EVENT,readPerfPreference} from '../../shell/perfMode';
import {preparePetFxAsync} from '../../battle/petFxPolicy';
import {preparePetGeometry} from '../../battle/petAnimation/preparedGeometry';
import {mountPetPlayer} from '../../battle/petAnimation/playerMount';
import {getFxHost,setFullscreenFxActive,fullscreenPlacement} from '../../battle/fullscreenFx';
import {ultimateSequenceOf,playbackEventForAction} from '../../battle/petActionRouting';
import {createCustomBattleFx,isMeleePresentationSequence} from '../../battle/customBattleFx';
import {customFramePresentation} from '../../battle/customPetClip';
import {capPlayerResolution} from '../../battle/petPlayerPerf';
import {createLazyFxRuntime} from '../../battle/petFxLayerRuntime';
/** 純播放元件；所有動作由既有播放時間軸驅動，動畫標記不觸發傷害或魂印。 */
export function PetActionSprite({elf,side,action,actionToken,width,height,onReady,context='battle',viewport,sink=0,assetId:overrideAsset,active=true,enterTransform=false,onTransitionEnd,onLoadError}:{elf:Elf;side:'p1'|'p2';action:PetAction;actionToken?:unknown;width:number;height:number;onReady:(ready:boolean)=>void;context?:'battle'|'home';viewport?:{width:number;height:number;anchorX:number;targetX?:number};sink?:number;assetId?:PetAnimationAssetId;active?:boolean;enterTransform?:boolean;onTransitionEnd?:()=>void;onLoadError?:()=>void}){
 const speed=React.useRef(1);
 const quality=React.useRef<AnimationQuality|undefined>(readAnimationSettings().quality);
 React.useEffect(()=>{const sync=()=>{const s=readAnimationSettings();speed.current=animationSpeed(s.speed);quality.current=s.quality;};sync();window.addEventListener(BATTLE_ANIMATION_EVENT,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(BATTLE_ANIMATION_EVENT,sync);window.removeEventListener('storage',sync);};},[]);
 const playbackAction=React.useRef<string>('standby');
 const playbackOwner=React.useRef({}).current;
 const prioritizeAction=React.useRef(true);
 React.useEffect(()=>{
  const update=()=>{prioritizeAction.current=readPerfPreference()!=='off';};
  update();window.addEventListener(PERF_EVENT,update);window.addEventListener('storage',update);
  return()=>{window.removeEventListener(PERF_EVENT,update);window.removeEventListener('storage',update);};
 },[]);
 const host=React.useRef<HTMLDivElement>(null);
 const player=React.useRef<SwfPlayer|null>(null);
 const [ready,setReady]=React.useState(false);
 const [activated,setActivated]=React.useState(false);
 const readyCallback=React.useRef(onReady);readyCallback.current=onReady;
 const loadError=React.useRef(onLoadError);loadError.current=onLoadError;
 const shown=active&&activated;
 const shownRef=React.useRef(shown);shownRef.current=shown;
 const activeRef=React.useRef(active);activeRef.current=active;
 const setRendering=React.useRef<((enabled:boolean)=>void)|null>(null);
 // 2026-10-28：battleScale 會把本體畫高拉大；畫布高度必須跟著長，否則頂端會被 canvas 邊界裁掉（次元龍被切頭）。
 const resolvedAsset=overrideAsset??petAnimationBinding(elf);
 const sizeBoost=resolvedAsset?(PET_ANIMATION_ASSETS[resolvedAsset] as PetAnimationAsset).battleScale??1:1;
 const baseFrame=petCanvasFrame(viewport?.height??height,height,context==='battle');
 const canvasFrame=sizeBoost>1?{...baseFrame,height:Math.max(baseFrame.height,height*sizeBoost+baseFrame.footroom)}:baseFrame;
 const dimensions=React.useRef({width,height,viewport,footroom:canvasFrame.footroom,sink});dimensions.current={width,height,viewport,footroom:canvasFrame.footroom,sink};
 const refit=React.useRef<((frameOnly?:boolean)=>void)|null>(null);
 // 全屏底片專用的第二個播放器（掛在 BattleFxLayer 裡，與本播放器同序列、同 dt 同步推進；不是全屏序列時隱藏且不繪製）。
 const fxRuntime=React.useRef<{player:SwfPlayer;el:HTMLDivElement;sequences:Set<string>;bounds:Record<string,{left:number;right:number;top:number;bottom:number}>;frames:Record<string,({left:number;right:number;top:number;bottom:number}|null)[]>;on:boolean}|null>(null);
 const currentSequence=React.useRef<PetAction|'transform'>('standby');
 const frameIndex=React.useRef(0);
 const sequenceTimings=React.useRef<Partial<Record<PetAction,PetSequenceTiming>>>({});
 const flight=React.useRef<HTMLDivElement>(null);
 const frameBox=React.useRef<(()=>VisibleBox|null)|null>(null);
 const restBox=React.useRef<(()=>VisibleBox|null)|null>(null);
 React.useEffect(()=>{refit.current?.();},[width,height,viewport?.width,viewport?.height,viewport?.anchorX,viewport?.targetX,canvasFrame.footroom,sink]);
 React.useEffect(()=>{
  setReady(false);setActivated(false);const loadStarted=performance.now();
  let alive=true;let instance:SwfPlayer|undefined;let stopListen:(()=>void)|undefined;let customFx:ReturnType<typeof createCustomBattleFx>|undefined;
  let renderLoop:ReturnType<typeof startPetRenderLoop>|undefined;
  const assetId=resolvedAsset;if(!assetId){readyCallback.current(false);return;}
  const lease=acquirePetClip(assetId);const abort=new AbortController();
  const fail=(reason:'load-failed'|'load-timeout')=>{readyCallback.current(false);loadError.current?.();if(activeRef.current)degradePet(side,elf,reason);};
  const deadline=setTimeout(()=>{if(!player.current){alive=false;abort.abort();lease.release();fail('load-timeout');}},(import.meta as ImportMeta & {env?:{DEV?:boolean}}).env?.DEV?90000:45000);
  void (async()=>{
   const [source,{SwfPlayer}]=await Promise.all([lease.clip,import('@seer-pet-anim/swf-renderer')]);
   if(!alive||abort.signal.aborted)return;
   const {clip,fxClip,report:fxReport}=context==='battle'?await preparePetFxAsync(source,(PET_ANIMATION_ASSETS[assetId] as PetAnimationAsset).fullscreen,abort.signal):{clip:source,fxClip:null,report:null};
   if(!alive||!host.current)return;
   host.current.dataset.petFxPolicy=fxReport?'large-add-only':'original';
   host.current.dataset.petFxRemoved=String(fxReport?.removedQuads??0);
   host.current.dataset.petFxFullscreen=(fxReport?.fullscreen.sequences??[]).join(',');
   const mountStarted=performance.now();
    instance=new SwfPlayer();await mountPetPlayer(instance,host.current,clip,abort.signal);
   capPlayerResolution(instance,clip);
   host.current?.setAttribute('data-pet-mount-ms',(performance.now()-mountStarted).toFixed(0));
   host.current?.setAttribute('data-pet-load-ms',(performance.now()-loadStarted).toFixed(0));
    instance.setOnFrameChange(frame=>{frameIndex.current=frame;host.current?.setAttribute('data-pet-frame',String(frame));refit.current?.(true);});
   if(!alive){instance.destroy();return;}
   // 原廠影格自帶 mulColor／addColor（逐幀調色）。同一段出招裡亮度會在多組數值間跳動
   // （咤克斯 attack 有 0.80 / 0.76 / 0.52 三種），整隻播出來就像三種顏色的分身疊在一起。
   // 使用者要「一種顏色就好」，但也說原廠顏色有價值 —— 所以改成每段序列只留一個代表色。
   // A 方案（使用者 2026-10-27 決定）：保留原廠材質色，不再把整隻統一成一個顏色。
   // 只有具名形態（例如咤克斯三化身）才整隻覆寫成指定的形態色。
   const variant=petColorVariant(elf.name,assetId);
   if(variant.mul||variant.add)overrideTint(clip.sequences.flatMap(s=>s.frames),variant);
   const {bounds,rest:reference,contactWindows}=await preparePetGeometry(clip,abort.signal);
   if(!alive||abort.signal.aborted)return;
   const {left:minX,right:maxX,top:minY,bottom:maxY}=reference??{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
   if(!Number.isFinite(minX)||maxY<=minY)throw Error('動作邊界無效');
   const sequences=instance.getSequences();
   sequenceTimings.current=Object.fromEntries(sequences.map(s=>[s.name,{duration:s.duration*1000,hit:(s.markers.find(m=>m.name==='action_hit')?.time??s.duration)*1000}]));
   const extraName=petExtraSequence(sequences.map(s=>s.name),(PET_ANIMATION_ASSETS[assetId] as PetAnimationAsset).extraSequence);
   sequenceTimings.current.extra=sequenceTimings.current[extraName as PetAction];
   const ultimateName=ultimateSequenceOf(assetId);
   if(ultimateName&&sequenceTimings.current[ultimateName as PetAction])sequenceTimings.current.ultimate=sequenceTimings.current[ultimateName as PetAction];
   const presentation=(PET_ANIMATION_ASSETS[assetId] as PetAnimationAsset).presentation,stage=getFxHost();
   if(context==='battle'&&presentation&&stage)customFx=createCustomBattleFx(stage,presentation,side);
   const meta:PetAnimationAsset=PET_ANIMATION_ASSETS[assetId];
   const refH=maxY-minY,dir=side==='p1'?1:-1;
   const restBounds={left:minX,right:maxX,top:minY,bottom:maxY};
   const mirrored=shouldMirrorBattleSprite(elf.name,side,false,`/api/pet-animations/bundle/${assetId}`);
   const diagnostics=new Map<string,string>();
   let widthPx=0,heightPx=0,lastX=NaN,lastY=NaN,lastScale=NaN,projectileVisible=false;
   const fit=(frameOnly=false)=>{
    const element=host.current;
    if(!instance||!element)return;
    const config=dimensions.current;
    if(!frameOnly||!widthPx||!heightPx){widthPx=element.clientWidth;heightPx=element.clientHeight;}
    const w=widthPx,h=heightPx-config.footroom;
    const report=(key:string,value:string)=>{
      if(diagnostics.get(key)===value)return;
      diagnostics.set(key,value);
      element.setAttribute('data-pet-'+key,value);
    };
    // 尺寸只由「高度」決定：靜態立繪與原生動畫必須同高，否則切換演出模式就會跳大小。
    // 待機影格的 mesh 比靜態不透明框寬（含武器、披風擺動），若讓寬度也參與 min()，
    // 場地變寬變矮時（1920×1080）動畫就會被壓矮 30–50px —— 譜尼／聖光斯嘉麗 的症狀。
    // 寬度溢出是允許的（canvas 不裁切），高度不一致才是錯。
    const scale=Math.min(config.height,h)/refH*(context==='battle'?(meta.battleScale??1):1);
    const sx=mirrored?-scale:scale;
    const origin=config.viewport?.anchorX??w/2,fallbackTarget=config.viewport?.targetX??origin;
    const sequence=currentSequence.current,timing=sequenceTimings.current[sequence as PetAction];
    const hitFrame=(timing?.hit??0)*clip.frameRate/1000,endFrame=(timing?.duration??0)*clip.frameRate/1000-1;
    const contactWindow=meta.custom?undefined:contactWindows.get(sequence)?.[meta.facing==='left'?'left':'right'];
    const approach=context==='battle'?actionApproach(frameIndex.current,contactWindow?.arrival??hitFrame,endFrame,contactWindow?.departure??hitFrame):0;
    // 對位：讀對手「實際可見框」的近側邊緣；讀不到才退回舊的場域中心。
    const bodyW=(maxX-minX)*scale;
    const physical=isMeleePresentationSequence(meta.presentation,sequence)||sequence==='attack';
    const drawCustom=shownRef.current&&customFx;
    const flightActive=!customFx&&sequence==='sa'&&frameIndex.current<=hitFrame&&context==='battle';
    const fx=fxRuntime.current;
    const tracksOpponent=context==='battle'&&(physical||flightActive||drawCustom);
    const rest=tracksOpponent||drawCustom||fx?.on?element.getBoundingClientRect():null;
    const opponent=tracksOpponent?getRestVisibleBox(side==='p1'?'p2':'p1'):null;
    // 原生物攻以對手本體中線接觸，避免只碰到外圍武器／披風；自製演出保留已校準的深度。
    const depth=physical?Math.max(0,Math.min(.6,meta.presentation?.contactDepth??(meta.custom?0:.5))):0;
    const near=opponent?(dir>0?opponent.left+(opponent.right-opponent.left)*depth:opponent.right-(opponent.right-opponent.left)*depth)-(rest?.left??0):fallbackTarget;
    const front=origin+dir*bodyW/2,overlap=Math.min(14,bodyW*.05);
    const frames=bounds.get(sequence);
    const body=frames?.[frameIndex.current]??restBounds;
    const rootOffset=((body.left+body.right-minX-maxX)/2)*sx;
    const poseHalfWidth=(body.right-body.left)*scale/2;
    const contactOffset=physicalContactOffset(poseHalfWidth,meta.physicalContact?.[sequence]);
    const attack=retargetAttack(origin,near,dir,bodyW/2,rootOffset,contactOffset,approach,overlap);
    const advances=physical&&context==='battle'&&PET_ANIMATION_ASSETS[assetId].physicalMotion==='approach';
    let x=advances?attack.translation:origin;
    if(advances&&meta.stablePhysicalImpact&&frames&&timing){
      const impactFrame=Math.min(frames.length-1,Math.max(0,Math.round(hitFrame)));
      const point=(b:typeof restBounds)=>((b.left+b.right-minX-maxX)/2)*sx+
        dir*physicalContactOffset((b.right-b.left)*scale/2,meta.physicalContact?.[sequence]);
      const impactBounds=frames[impactFrame]??restBounds;
      const velocity=(point(frames[impactFrame+1]??impactBounds)-point(frames[impactFrame-1]??impactBounds))/2;
      const limit=refH*scale*.14;
      x=anchorPhysicalImpact(origin,near+dir*overlap,point(impactBounds),Math.max(-limit,Math.min(limit,velocity)),
        frameIndex.current-impactFrame,approach);
    }
    const contact=attack.contact;
    if(meta.stablePhysicalImpact)report('placement-x',String(x));
    const tx=x-(minX+maxX)/2*sx,ty=h+minY*scale;
    // 當前影格包圍框（client px），供對手對位、飄字與特效讀取。
    const toVisibleBox=(r:{left:number;top:number})=>{
     const {left:x0,right:x1,top:y0,bottom:y1}=body;
     const ax=tx+x0*sx,bx=tx+x1*sx;return {left:r.left+Math.min(ax,bx),right:r.left+Math.max(ax,bx),top:r.top+ty-y1*scale,bottom:r.top+ty-y0*scale};
    };
    frameBox.current=()=>{const r=host.current?.getBoundingClientRect();return r?toVisibleBox(r):null;};
    restBox.current=()=>{const r=host.current?.getBoundingClientRect();return r?{left:r.left+origin-bodyW/2,right:r.left+origin+bodyW/2,top:r.top+h-refH*scale,bottom:r.top+h}:null;};
    const currentFront=x+rootOffset+dir*poseHalfWidth;
    const contactPoint=x+rootOffset+dir*contactOffset;
    report('contact-window',`${contactWindow?.arrival??hitFrame},${contactWindow?.departure??hitFrame}`);
    report('origin',String(origin));report('target',String(near));report('contact',String(contact));report('body-x',String(x+rootOffset));report('body-front',String(currentFront));report('native-offset',String(rootOffset));report('body-height',String(refH*scale));report('contact-gap',((near-contactPoint)*dir).toFixed(1));report('contact-point',String(contactPoint));
     // 驗收用：待機框相對外層 div 的幾何，必須與靜態立繪的不透明區域重合。
     const sinkPx=config.sink,restHalf=bodyW/2;
     report('rest',`${(-restHalf).toFixed(1)},${restHalf.toFixed(1)},${(-sinkPx).toFixed(1)},${(-sinkPx+refH*scale).toFixed(1)}`);
    if(drawCustom&&rest){const seq=clip.sequences.find(s=>s.name===sequence);const declared=meta.sequences.find(s=>s.name===sequence);
     const ownBox=toVisibleBox(rest);
     const authored=customFramePresentation(clip,sequence,frameIndex.current),r=rest;
     const muzzlePoint=authored?.muzzle?{x:r.left+tx+authored.muzzle[0]/clip.pixelsPerUnit*sx,y:r.top+ty-authored.muzzle[1]/clip.pixelsPerUnit*scale}:undefined;
     customFx.draw({sequence,frame:frameIndex.current,frames:seq?.frames.length??1,hits:declared?.hits??[],caster:ownBox,target:opponent,mirrored:sx<0,launch:authored?.launch,muzzlePoint});}
    if(flight.current){
     const travelling=flightActive&&near!==origin;
     if(projectileVisible!==travelling){projectileVisible=travelling;flight.current.style.opacity=travelling?'1':'0';}
     if(travelling&&rest){
      const aim=opponent?{x:boxCenterX(opponent)-rest.left,y:boxCenterY(opponent)-rest.top}:{x:near,y:h-config.height*.5};
      const t=Math.min(1,frameIndex.current/Math.max(1,hitFrame)),startX=front,startY=h-refH*scale*.5;
      flight.current.style.left=`${startX+(aim.x-startX)*t}px`;flight.current.style.bottom=`${h-(startY+(aim.y-startY)*t)}px`;
     }
    }
    if(lastX!==tx||lastY!==ty||lastScale!==sx){
     lastX=tx;lastY=ty;lastScale=sx;instance.setFixedTransform({x:tx,y:ty},{x:sx,y:-scale});
    }
    // 全屏層：同一個鏡射與本體比例；底片不跟著出招位移（origin 為準）。底片沒蓋滿整層（BattleFxLayer 全矩形）時改 cover 並置中（fullscreenPlacement）。
    if(fx?.on&&rest){const lr=fx.el.getBoundingClientRect();if(lr.width>0&&lr.height>0){
     const b=fx.frames[sequence]?.[frameIndex.current]??fx.bounds[sequence],f=fullscreenPlacement(b,{width:lr.width,height:lr.height},{scale,mirrored:sx<0,x:(origin-(minX+maxX)/2*sx)+(rest.left-lr.left),y:(h+minY*scale)+(rest.top-lr.top)});
     fx.player.setFixedTransform({x:f.x,y:f.y},{x:f.sx,y:-f.scale});}}
    renderLoop?.invalidate();notifyVisibleBoxChanged();};
   refit.current=fit;
   const resize=new ResizeObserver(()=>fit());resize.observe(host.current);fit();
   instance.playSequence('standby',{loop:true});
   const animation=instance;
   // Each mounted form has one painted standby frame. Only the visible form schedules frames.
   animation.draw();
   const syncRendering=(enabled:boolean)=>{
    if(!enabled){
     setForegroundPetPlayback(playbackOwner,false);
     renderLoop?.stop();renderLoop=undefined;animation.pause();
     const fx=fxRuntime.current;
     if(fx?.on){fx.on=false;fx.el.style.visibility='hidden';fx.player.pause();setFullscreenFxActive(side,false);}
     return;
    }
    if(renderLoop)return;
    if(!document.hidden)animation.play();
    renderLoop=startPetRenderLoop({advance:seconds=>{const dt=seconds*(context==='battle'?speed.current:1);animation.advance(dt);const fx=fxRuntime.current;if(fx?.on)fx.player.advance(dt);},draw:()=>{animation.draw();const fx=fxRuntime.current;if(fx?.on)fx.player.draw();},request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),now:()=>performance.now(),visible:()=>!document.hidden,
     minimumFrameIntervalMs:()=>Math.max(context==='battle'&&prioritizeAction.current&&currentSequence.current==='standby'&&hasForegroundPetPlayback()?50:0,currentSequence.current==='standby'?qualityStandbyFrameMs(quality.current):0)});
   };
   setRendering.current=syncRendering;
   syncRendering(shownRef.current);
   const metrics=setInterval(()=>{const stats=renderLoop?.stats();if(host.current&&stats){host.current.dataset.petDrawRate=stats.drawsPerSecond.toFixed(1);host.current.dataset.petRenderMs=stats.averageWorkMs.toFixed(2);host.current.dataset.petRenderMaxMs=stats.maxWorkMs.toFixed(2);}},1000);
   const visibility=()=>{if(!shownRef.current)return;renderLoop?.resetTime();if(document.hidden){instance?.pause();fxRuntime.current?.player.pause();}else{instance?.play();fxRuntime.current?.player.play();}};document.addEventListener('visibilitychange',visibility);
   stopListen=()=>{syncRendering(false);clearInterval(metrics);resize.disconnect();document.removeEventListener('visibilitychange',visibility);};
   // 全屏層第二播放器：只有素材有底片序列、且戰鬥畫面掛了 BattleFxLayer 才建立；失敗只失去全屏底片，不影響本體。
   // 省效能畫質不建立全屏底片層（省一個 WebGL context 與大型圖集上傳）。
   const layerHost=context==='battle'&&fxClip&&fxReport&&qualityAllowsFullscreenFx(quality.current)?getFxHost():null;
   if(layerHost&&fxClip&&fxReport)fxRuntime.current=createLazyFxRuntime({layerHost,side,fxClip,sequences:fxReport.fullscreen.sequences,bounds:fxReport.backdropBounds,frames:fxReport.backdropFrames,createPlayer:()=>new SwfPlayer(),signal:abort.signal,mainTime:()=>(instance as SwfPlayer&{getTime?:()=>number})?.getTime?.()});// 底片播放器在本體就緒後的瀏覽器閒置時預載、整場保留（petFxLayerRuntime）
   player.current=instance;setReady(true);clearTimeout(deadline);
  })().catch(error=>{clearTimeout(deadline);stopListen?.();renderLoop?.stop();instance?.destroy();customFx?.destroy();lease.release();if(alive){console.warn('[pet-actions] 沿用簡易演出',error);setReady(false);fail('load-failed');}});
  return()=>{alive=false;clearTimeout(deadline);if(shownRef.current&&context==='battle')reportPetPlayback(side,elf,{sequence:playbackAction.current,type:'cancel'});abort.abort();stopListen?.();setRendering.current=null;refit.current=null;frameBox.current=null;restBox.current=null;player.current=null;const fx=fxRuntime.current;fxRuntime.current=null;fx?.player.destroy();fx?.el.remove();customFx?.destroy();instance?.destroy();lease.release();readyCallback.current(false);};
 },[side,context,elf.id,elf.battleId,elf.name,elf.skinId,resolvedAsset]);
 // 載入完成時若正在出招，等下一個待機邊界才切入，避免半招突然換播放器。
 React.useEffect(()=>{if(ready&&action==='standby')setActivated(true);},[ready,action]);
 React.useLayoutEffect(()=>{setRendering.current?.(shown);},[shown]);
 React.useLayoutEffect(()=>{if(!shown||context!=='battle')return;const stopFrame=registerVisibleBox(side,'animation',()=>frameBox.current?.()??null),stopRest=registerVisibleBox(side,'rest',()=>restBox.current?.()??null);return()=>{stopFrame();stopRest();};},[shown,side,context]);
 React.useLayoutEffect(()=>{if(!activated)return;readyCallback.current(true);return()=>readyCallback.current(false);},[activated]);
 React.useLayoutEffect(()=>{if(!shown||context!=='battle')return;const unregister=registerPetPlayer(side,elf);
  const untiming=registerPetTimings(side,elf,sequenceTimings.current);
  return()=>{unregister();untiming();};
 },[shown,side,context,elf.id,elf.battleId,elf.name,elf.skinId]);
 React.useLayoutEffect(()=>{const p=player.current;if(!p||!shown)return;
  const play=(sequence:PetAction|'transform')=>{setForegroundPetPlayback(playbackOwner,context==='battle'&&sequence!=='standby');playbackAction.current=sequence;const names=p.getSequences().map(s=>s.name);const declared=sequence==='ultimate'?ultimateSequenceOf(resolvedAsset):null;const actual=sequence==='extra'?petExtraSequence(names,resolvedAsset?(PET_ANIMATION_ASSETS[resolvedAsset] as PetAnimationAsset).extraSequence:undefined):sequence==='ultimate'?(declared&&names.includes(declared)?declared:'sa'):sequence;currentSequence.current=actual;frameIndex.current=0;p.playSequence(actual,{loop:sequence==='standby'});
   const fx=fxRuntime.current;if(fx){const wanted=fx.sequences.has(actual);fx.on=wanted;fx.el.style.visibility=wanted?'visible':'hidden';if(wanted)fx.player.playSequence(actual,{loop:false});setFullscreenFxActive(side,wanted);}host.current?.setAttribute('data-pet-sequence',actual);if(sequence==='extra')host.current?.setAttribute('data-pet-extra-sequence',actual);if(sequence==='transform')host.current?.setAttribute('data-pet-transform-source',resolvedAsset??'');refit.current?.();notifyVisibleBoxChanged();};
  const unsub=p.subscribe(event=>{
   if(context==='battle'&&playbackAction.current!=='transform')reportPetPlayback(side,elf,playbackEventForAction(event,playbackAction.current,currentSequence.current));
   if(event.type==='marker')host.current?.setAttribute('data-pet-marker',`${event.sequence}:${event.marker?.name}:${event.playbackId}`);
   if(event.type!=='complete'||event.sequence==='standby')return;
   if(event.sequence==='transform'){setForegroundPetPlayback(playbackOwner,false);onTransitionEnd?.();return;}
   play('standby');
  });
  if(action==='standby'&&enterTransform){
   if(currentSequence.current!=='transform'){
    if(p.getSequences().some(s=>s.name==='transform'))play('transform');
    else onTransitionEnd?.();
   }
  } else {
   play(action);
   p.draw();
  }
  return ()=>{unsub();setForegroundPetPlayback(playbackOwner,false);};
 },[shown,action,actionToken,enterTransform,onTransitionEnd,playbackOwner]);
 return <><div ref={host} aria-label={`${elf.name}動作`} data-pet-source={resolvedAsset} data-pet-ready={shown} data-pet-prepared={activated} data-pet-action={action} data-pet-footroom={canvasFrame.footroom.toFixed(1)} style={{position:'absolute',width:viewport?.width??width,height:canvasFrame.height,left:viewport?-viewport.anchorX:-width/2,bottom:-sink-canvasFrame.footroom,visibility:shown?'visible':'hidden',pointerEvents:'none',overflow:'visible'}}/><div aria-hidden="true" style={{position:'absolute',left:viewport?-viewport.anchorX:-width/2,bottom:-sink,pointerEvents:'none',visibility:shown?'visible':'hidden'}}><div ref={flight} data-pet-projectile="presentation" style={{position:'absolute',width:28,height:12,borderRadius:'50%',background:'#fff7ae',boxShadow:'0 0 16px 7px #eab308',transform:'translate(-50%,50%)',opacity:0}}/></div></>;
}
