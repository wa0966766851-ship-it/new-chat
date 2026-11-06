import assert from 'node:assert/strict';
import {drawExtraSeal,extraSealPhase} from '../src/battle/extraSealFx';

// A clock contract, not an art-quality assertion: source -> target -> seal -> clear.
const first=extraSealPhase(0,72),middle=extraSealPhase(37,72),last=extraSealPhase(71,72);
assert.ok(first.pages.every(p=>p.alpha===0));
assert.equal(first.bind,0);
assert.ok(middle.pages[0].travel>.95);
assert.ok(middle.bind>0);
assert.ok(extraSealPhase(55,72).fracture>.95);
assert.equal(last.fade,0);
assert.ok(last.pages.every(p=>p.alpha===0));
for(let f=0;f<72;f++)for(const v of Object.values(extraSealPhase(f,72))){
 if(typeof v==='number')assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
}
// Record geometry to check side symmetry without touching gameplay or requiring a GPU.
function render(side:'p1'|'p2'){
 const points:number[][]=[];let saves=0;
 const ctx=new Proxy({}, {get:(_t,key)=>{
  if(key==='save')return ()=>saves++;
  if(key==='restore')return ()=>saves--;
  if(key==='translate')return (x:number,y:number)=>points.push([x,y]);
  return ()=>{};
 },set:()=>true}) as CanvasRenderingContext2D;
 const own={left:100,right:300,top:100,bottom:600},target={left:800,right:1000,top:100,bottom:600};
 drawExtraSeal(ctx,{frame:37,frames:72,caster:side==='p1'?own:target,target:side==='p1'?target:own},
  {left:0,top:0},side,{color:'#a855f7',secondary:'#f0d9ff'});
 assert.equal(saves,0,'render must not leak canvas transforms or blend state');
 return points;
}
const left=render('p1'),right=render('p2');
assert.equal(left.length,9);assert.equal(right.length,9);
// Identical target-centred ring layout, source travels from the opposite side.
assert.ok(left.every(([x])=>x>700));assert.ok(right.every(([x])=>x<400));
const crops:unknown[][]=[];
const artCtx=new Proxy({}, {get:(_t,key)=>key==='drawImage'?(...args:unknown[])=>crops.push(args):()=>{},set:()=>true}) as CanvasRenderingContext2D;
drawExtraSeal(artCtx,{frame:55,frames:72,caster:{left:100,right:300,top:100,bottom:600},target:{left:800,right:1000,top:100,bottom:600}},
 {left:0,top:0},'p1',{color:'#a855f7',secondary:'#f0d9ff'},
 {impact:{image:{complete:true,naturalWidth:1280,naturalHeight:1536} as HTMLImageElement,cols:5,rows:6,frames:26}});
assert.equal(crops.length,1);
assert.equal(crops[0][7],crops[0][8],'square source cells must keep their aspect ratio');
assert.ok(Number(crops[0][7])<=256,'low-resolution effects cannot expand to full body height');
// The two hand poses share one scale; no side may stretch or enlarge the hand into a full-screen bar.
for(const side of ['p1','p2'] as const){
 const hands:unknown[][]=[];let balance=0;
 const ctx=new Proxy({}, {get:(_t,key)=>{
  if(key==='save')return ()=>balance++;
  if(key==='restore')return ()=>balance--;
  if(key==='drawImage')return (...a:unknown[])=>hands.push(a);
  return ()=>{};
 },set:()=>true}) as CanvasRenderingContext2D;
 const open={complete:true,naturalWidth:512,naturalHeight:256} as HTMLImageElement;
 const closed={complete:true,naturalWidth:512,naturalHeight:256} as HTMLImageElement;
 drawExtraSeal(ctx,{frame:50,frames:72,caster:{left:100,right:300,top:100,bottom:600},target:{left:800,right:1000,top:100,bottom:600}},
  {left:0,top:0},side,{color:'#a855f7',secondary:'#f0d9ff'},{claw:{open,closed}});
 assert.equal(balance,0);
 assert.equal(hands.length,4);
 assert.ok(hands.every(a=>Number(a[3])<=240&&Number(a[4])===Number(a[3])/2));
 assert.equal(hands.filter(a=>a[0]===open).length,2);
 assert.equal(hands.filter(a=>a[0]===closed).length,2);
}
console.log('額外咒書時序、收尾、兩側目標定位與畫布狀態通過（不代表美術驗收）');
