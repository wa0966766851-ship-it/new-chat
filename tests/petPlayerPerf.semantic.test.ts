import assert from 'node:assert/strict';
import {capPlayerResolution,cappedResolution,petResolutionCap,MAX_PET_RESOLUTION,LARGE_ATLAS_RESOLUTION} from '../src/battle/petPlayerPerf';
import {createLazyFxRuntime} from '../src/battle/petFxLayerRuntime';
// 解析度上限：min(dpr,2)；8192 級圖集 1.5；dpr 低於上限不動；取不到 renderer 不報錯。
assert.equal(petResolutionCap({width:4096,height:4096}),MAX_PET_RESOLUTION);assert.equal(petResolutionCap({width:8192,height:8192}),LARGE_ATLAS_RESOLUTION);assert.equal(petResolutionCap(undefined),MAX_PET_RESOLUTION);
assert.equal(cappedResolution(3,2),2);assert.equal(cappedResolution(1.25,2),1.25);assert.equal(cappedResolution(undefined,2),1);assert.equal(cappedResolution(NaN,2),1);assert.equal(cappedResolution(0,2),1);
const fakePlayer=(res:number)=>{const r:any={resolution:res,screen:{width:300,height:200},calls:[] as any[],resize(w:number,h:number,x?:number){this.calls.push([w,h,x]);if(x!==undefined)this.resolution=x;}};return {app:{renderer:r},r};};
{const {app,r}=fakePlayer(3);const p={app};assert.equal(capPlayerResolution(p,{atlas:{width:2048,height:2048}},3),2);assert.deepEqual(r.calls,[[300,200,2]],'沿用目前邏輯尺寸，只改解析度');assert.equal(r.resolution,2);}
{const {app,r}=fakePlayer(3);assert.equal(capPlayerResolution({app},{atlas:{width:8192,height:8192}},3),1.5);assert.equal(r.resolution,1.5);}
{const {app,r}=fakePlayer(1);assert.equal(capPlayerResolution({app},{atlas:{width:8192,height:8192}},1),null);assert.deepEqual(r.calls,[],'dpr=1 不動');}
{const {app,r}=fakePlayer(1.25);assert.equal(capPlayerResolution({app},{atlas:{width:2048,height:2048}},1.25),null);assert.deepEqual(r.calls,[]);}
assert.equal(capPlayerResolution({},null,3),null);assert.equal(capPlayerResolution(null,null,3),null);
{const bad:any={app:{renderer:{resolution:3,screen:{width:1,height:1},resize(){throw Error('destroyed');}}}};const warn=console.warn;console.warn=()=>{};try{assert.equal(capPlayerResolution(bad,null,3),null,'播放器已銷毀時吞掉例外');}finally{console.warn=warn;}}
(globalThis as any).window={devicePixelRatio:3};// 外殼內部讀 window.devicePixelRatio
// 預載底片外殼（假 DOM + 假播放器 + 手動閒置排程）。2026-11-06 契約：本體就緒後閒置時預載、整場保留、卸載才銷毀；全屏序列早於預載則立即建立。
const el=()=>{const kids:any[]=[];const d:any={ownerDocument:{createElement:()=>({dataset:{},style:{},remove(){d.removed=true;}})},appendChild:(c:any)=>kids.push(c),kids};return d;};
const idleQ=new Map<number,()=>void>();let iid=0;
const idle=(fn:()=>void)=>{const id=++iid;idleQ.set(id,fn);return()=>{idleQ.delete(id);};};
const runIdle=()=>{for(const [id,fn] of [...idleQ]){idleQ.delete(id);fn();}};
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const made:any[]=[];
const mk=(opts:any={})=>({mounts:[] as any[],calls:[] as any[],destroyed:false,seeks:[] as number[],transforms:[] as any[],advanced:0,draws:0,paused:false,order:[] as string[],...opts,
 async mount(parent:any,clip:any,options:any){this.order.push('mount');this.mounts.push({parent,clip,options});if(this.failMount)throw Error('gl');},
 playSequence(n:string,o:any){this.order.push('play');this.calls.push(['play',n,o]);return {};},seek(s:number){this.seeks.push(s);},setFixedTransform(p:any,s:any){this.transforms.push([p,s]);},advance(d:number){this.advanced+=d;},draw(){this.order.push('draw');this.draws++;},pause(){this.paused=true;},play(){this.paused=false;},destroy(){this.destroyed=true;},
 app:{renderer:{resolution:3,screen:{width:10,height:10},resize(_w:number,_h:number,r:number){this.resolution=r;}}}});
const host=el();let mainTime=0.5;
const fxClip:any={atlas:{width:8192,height:8192}};
const make=(side:string,o:any={})=>createLazyFxRuntime({layerHost:host,side,fxClip,sequences:['sa'],bounds:{},frames:{},createPlayer:()=>{const p=mk(o.mount);made.push(p);return p as any;},mainTime:()=>mainTime,idle,...o.rt});
// A) 建立外殼時不建立播放器；閒置才預載（掛載 → 暖機繪製一次），此時仍是隱藏、未進入全屏序列。
const rt=make('p1');
assert.equal(made.length,0,'建立外殼當下不建立播放器');assert.equal(rt.live(),false);assert.equal(host.kids.length,1);assert.equal(idleQ.size,1,'排了一個閒置預載');
rt.player.setFixedTransform({x:1,y:2},{x:3,y:-3});rt.player.advance(.1);rt.player.draw();rt.player.pause();assert.equal(made.length,0,'未預載前 advance／draw／pause 不會觸發建立');
runIdle();await flush();
assert.equal(made.length,1,'閒置後預載（在任何全屏序列之前）');assert.equal(rt.live(),true);const p=made[0];assert.equal(rt.on,false,'預載時不是全屏序列');
assert.deepEqual(p.mounts[0].options,{transparent:true,mode:'fixed',clock:'manual',signal:undefined});assert.equal(p.mounts[0].clip,fxClip);
assert.equal(p.app.renderer.resolution,1.5,'底片畫布也套用解析度上限（8192 → 1.5）');
assert.ok(p.draws>=1&&p.order.indexOf('draw')>p.order.indexOf('mount'),'暖機：掛載後隱藏繪製一次');assert.deepEqual(p.transforms[0],[{x:1,y:2},{x:3,y:-3}],'補套用預載前記下的變換');assert.equal(p.paused,true,'補套用暫停狀態');
rt.player.play();
// B) 整場保留：全屏序列開始／結束／再開始都不銷毀、不重建；沒有任何閒置銷毀計時。
const warm=p.draws;rt.player.playSequence('sa',{loop:false});rt.on=true;assert.equal(made.length,1,'預載完成後全屏序列不再建立');assert.deepEqual(p.calls.at(-1),['play','sa',{loop:false}]);
rt.player.advance(.2);rt.player.draw();assert.equal(p.advanced,.2);assert.equal(p.draws,warm+1);
rt.on=false;assert.equal(idleQ.size,0,'沒有任何閒置銷毀計時');await new Promise(r=>setTimeout(r,20));assert.equal(p.destroyed,false,'序列結束後不閒置銷毀');
rt.on=true;rt.player.playSequence('sa',{loop:false});rt.on=false;assert.equal(made.length,1);assert.equal(p.destroyed,false);
// C) 卸載才銷毀，之後不再建立。
rt.player.destroy();assert.equal(p.destroyed,true,'卸載銷毀');rt.player.playSequence('sa');await flush();assert.equal(made.length,1,'destroy 後不再建立');rt.player.advance(1);rt.player.draw();
// D) 全屏序列早於預載：立刻建立（不等閒置），與本體時間對齊；之後閒置回呼不會再建第二個。
made.length=0;
const rt2=make('p2');rt2.player.playSequence('sa',{loop:false});rt2.on=true;await flush();
assert.equal(made.length,1,'預載未完成就開始全屏序列 → 立即建立');assert.deepEqual(made[0].calls[0],['play','sa',{loop:false}]);assert.deepEqual(made[0].seeks,[.5],'提前開始時與本體序列時間對齊');
runIdle();await flush();assert.equal(made.length,1,'預載回呼與立即建立共用同一次建立，不重複');
// E) 預載途中卸載：取消排程；掛載完成時已卸載 → 立即銷毀剛建好的播放器；沒有殘留排程。
made.length=0;
const rt3=make('p1');assert.equal(idleQ.size,1);rt3.player.destroy();assert.equal(idleQ.size,0,'卸載取消尚未執行的預載');runIdle();await flush();assert.equal(made.length,0,'已卸載不預載');
const rt4=make('p1');runIdle();rt4.player.destroy();await flush();assert.equal(made.at(-1).destroyed,true,'掛載完成時已卸載 → 立即銷毀');
// F) preload:false（不排閒置）仍可由全屏序列觸發建立；手動 preload() 與預設相同。
made.length=0;
const rt5=make('p1',{rt:{preload:false}});assert.equal(idleQ.size,0,'preload:false 不排程');rt5.preload();await flush();assert.equal(made.length,1,'手動 preload()');rt5.preload();await flush();assert.equal(made.length,1,'重複 preload 不重建');rt5.player.destroy();
// G) 掛載失敗：只警告一次、不重試、不影響本體。
const warns:any[]=[];const w=console.warn;console.warn=(...a:any[])=>{warns.push(a);};
try{const rt6=make('p1',{mount:{failMount:true}});const before=made.length;runIdle();await flush();rt6.player.playSequence('sa');await flush();assert.equal(made.length,before+1,'失敗後不重試');assert.equal(warns.length,1);assert.equal(made.at(-1).destroyed,true);}
finally{console.warn=w;}
// H) 預設閒置排程：有 requestIdleCallback 就用它；沒有就 setTimeout 退路；兩者都可取消。
{const {whenIdle,FX_PRELOAD_FALLBACK_MS}=await import('../src/battle/petFxLayerRuntime');const g=globalThis as any;
 let ran=0;const c=whenIdle(()=>{ran++;});c();await new Promise(r=>setTimeout(r,FX_PRELOAD_FALLBACK_MS+40));assert.equal(ran,0,'退路 setTimeout 可取消');
 whenIdle(()=>{ran++;});await new Promise(r=>setTimeout(r,FX_PRELOAD_FALLBACK_MS+40));assert.equal(ran,1,'沒有 requestIdleCallback → setTimeout 退路執行');
 const calls:any[]=[];g.requestIdleCallback=(cb:()=>void,o:any)=>{calls.push(o);cb();return 7;};g.cancelIdleCallback=(id:number)=>calls.push(['cancel',id]);
 try{whenIdle(()=>{ran++;})();assert.equal(ran,2,'有 requestIdleCallback 就使用');assert.deepEqual(calls,[{timeout:2000},['cancel',7]],'帶 timeout 上限、可取消');}finally{delete g.requestIdleCallback;delete g.cancelIdleCallback;}}
console.log('解析度上限、底片外殼（閒置預載＋暖機／整場保留不閒置銷毀／卸載銷毀／早於預載立即建立／失敗）通過');
