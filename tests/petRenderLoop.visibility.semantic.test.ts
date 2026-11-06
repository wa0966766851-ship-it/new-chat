import assert from 'node:assert/strict';
import {startPetRenderLoop} from '../src/battle/petRenderLoop';
// 背景分頁停止排程、回前景續跑；動畫時間（advance 累積秒數）不因背景暫停而跳動；待機仍是每次 rAF 推進、換影格才繪製。
let now=0,hidden=false,pending:FrameRequestCallback|undefined,requests=0,cancels=0,advanced=0,draws=0,listener:(()=>void)|undefined,subs=0,unsubs=0;
const loop=startPetRenderLoop({now:()=>now,visible:()=>!hidden,request:fn=>{pending=fn;requests++;return requests;},cancel:()=>{cancels++;pending=undefined;},
 advance:s=>{advanced+=s;const f=Math.floor(now/1000*24+1e-8);if(f!==(advance as any).f){(advance as any).f=f;loop.invalidate();}},draw:()=>{draws++;},
 subscribeVisibility:l=>{listener=l;subs++;return()=>{listener=undefined;unsubs++;};}});
function advance(){}
const frame=(ms:number)=>{now+=ms;const f=pending;pending=undefined;f!(now);};
assert.equal(subs,1);for(let i=0;i<60;i++)frame(1000/60);
assert.ok(Math.abs(advanced-1)<1e-6,'前景 1 秒 = 推進 1 秒動畫時間');assert.ok(draws>=24&&draws<=25,'待機繪製頻率不變（約 24fps，不隨 rAF 變）');
// 轉背景：下一個 tick 偵測到隱藏後不再排程。
hidden=true;const reqAtHide=requests;frame(1000/60);assert.equal(requests,reqAtHide,'隱藏後不再請求下一幀');assert.equal(loop.idle(),true);assert.equal(pending,undefined);
const advBg=advanced,drawBg=draws;now+=60000;// 背景 60 秒
assert.equal(advanced,advBg);assert.equal(draws,drawBg,'背景不推進、不繪製');
listener!();assert.equal(pending,undefined,'仍隱藏時 visibilitychange 不喚醒');
hidden=false;loop.invalidate();listener!();assert.ok(pending,'回前景立即續排程');assert.equal(loop.idle(),false);
frame(1000/60);assert.ok(advanced-advBg<.05,'回前景第一幀 dt 只是一幀，背景 60 秒不計入（動畫時間不跳）');assert.equal(draws,drawBg+1,'補畫背景期間累積的 dirty');
listener!();const r=requests;listener!();assert.equal(requests,r,'重複事件不重複排程');
loop.stop();assert.equal(unsubs,1,'stop 取消訂閱');assert.equal(pending,undefined);
// 無事件來源（舊呼叫端）：維持舊行為，背景仍持續排程。
{let n=0,h=false,p:FrameRequestCallback|undefined,reqs=0;const l=startPetRenderLoop({now:()=>n,visible:()=>!h,request:f=>{p=f;reqs++;return reqs;},cancel:()=>{},advance:()=>{},draw:()=>{}});
 // node 測試環境沒有全域 document；若有，預設訂閱會接管，這裡只驗證沒有 document 時的相容行為。
 if(typeof document==='undefined'){h=true;const before=reqs;n+=16;p!(n);assert.equal(reqs,before+1,'沒有可見性事件來源時仍持續排程（相容）');}l.stop();}
console.log('渲染迴圈：背景停止排程、回前景續跑、動畫時間不跳、待機節奏不變通過');
