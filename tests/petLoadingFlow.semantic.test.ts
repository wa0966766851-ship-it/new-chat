import assert from 'node:assert/strict';
import {createPetClipPool} from '../src/battle/petClipPool';
import {startPetRenderLoop} from '../src/battle/petRenderLoop';

let time=0,nextId=0;const timers=new Map<number,{at:number;fn:()=>void}>(),disposed:string[]=[];
let loads=0;const pool=createPetClipPool<string,string>({bytes:id=>id==='large'?256:8,limitBytes:272,idleBytes:32,idleMs:15000,handoffMs:250,load:async id=>{loads++;return id;},dispose:clip=>{disposed.push(clip);},now:()=>time,schedule:(fn,ms)=>{const id=++nextId;timers.set(id,{at:time+ms,fn});return id;},cancel:id=>{timers.delete(id as number);}});
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
const advance=async(ms:number)=>{time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}await flush();};
const p1=pool.acquire('rey'),p2=pool.acquire('rey');assert.equal(p1.clip,p2.clip);await p1.clip;assert.equal(loads,1,'雙側共用一次解碼');
p1.release();p1.release();assert.equal(pool.snapshot()[0].users,1,'釋放冪等');p2.release();
await advance(100);const third=pool.acquire('rey');await third.clip;assert.equal(loads,1,'三種雷伊皮膚切換重用小圖');third.release();
const large=pool.acquire('large');await large.clip;large.release();await advance(100);const remount=pool.acquire('large');await remount.clip;assert.equal(loads,2,'整場重掛在緩衝期內重用大圖');
remount.release();await advance(251);assert.ok(disposed.includes('large'),'大圖閒置迅速釋放');assert.ok(!disposed.includes('rey'));
await advance(15000);assert.ok(disposed.includes('rey'),'小圖也有保留期限，不常駐整庫');
let attempts=0;const retry=createPetClipPool<string,string>({bytes:()=>1,limitBytes:2,idleBytes:1,load:async()=>{if(!attempts++)throw Error('網路失敗');return 'ok';},dispose:()=>{}});
const failed=retry.acquire('asset');await assert.rejects(failed.clip);failed.release();const recovered=retry.acquire('asset');assert.equal(await recovered.clip,'ok','失敗不污染快取');recovered.release();
// 取消後即使解碼器忽略 signal、稍後才完成，也必須釋放結果。
let finish!:(value:string)=>void,signal!:AbortSignal;const cancelled=createPetClipPool<string,string>({bytes:()=>1,limitBytes:1,idleBytes:0,load:async(_,s)=>{signal=s;return new Promise(resolve=>finish=resolve);},dispose:x=>{disposed.push(x);},now:()=>time,schedule:(fn,ms)=>{const id=++nextId;timers.set(id,{at:time+ms,fn});return id;},cancel:id=>{timers.delete(id as number);}});
const gone=cancelled.acquire('pending');await flush();gone.release();await advance(251);assert.ok(signal.aborted);finish('late');await gone.clip;await flush();assert.ok(disposed.includes('late'));

let now=0,raf:FrameRequestCallback|undefined,dirtyFrame=-1,draws=0,visible=true;
const loop=startPetRenderLoop({now:()=>now,visible:()=>visible,request:fn=>{raf=fn;return 1;},cancel:()=>{raf=undefined;},advance:seconds=>{const frame=Math.floor(now/1000*24+1e-8);if(frame!==dirtyFrame){dirtyFrame=frame;loop.invalidate();}assert.ok(seconds>=0);},draw:()=>{draws++;}});
for(let i=1;i<=60;i++){now=i*1000/60;raf!(now);}assert.ok(draws>=24&&draws<=25,'60 次螢幕刷新只繪製約 24 張原生影格');
const before=draws;visible=false;for(let i=61;i<=120;i++){now=i*1000/60;raf!(now);}assert.equal(draws,before,'背景不繪製');
visible=true;loop.resetTime();loop.invalidate();now+=16.7;raf!(now);assert.equal(draws,before+1);loop.stop();assert.equal(raf,undefined);
console.log('原生解碼共用、有限保溫、錯誤重試、取消回收、24fps 單次繪製及背景暫停通過');
