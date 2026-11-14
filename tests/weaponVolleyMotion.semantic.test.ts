import assert from 'node:assert/strict';
import {weaponVolleyPoses} from '../src/battle/weaponVolleyMotion';
const a={left:100,right:400,top:160,bottom:660},b={left:790,right:1110,top:150,bottom:660};
const reflect=(box:typeof a)=>({...box,left:1210-box.right,right:1210-box.left});
const input={caster:a,target:b,side:'p1' as const,sequence:'attack',frames:64,hit:32,launch:18};
const start=weaponVolleyPoses({...input,frame:0}),end=weaponVolleyPoses({...input,frame:63});
assert.equal(start.length,6);
for(let i=0;i<6;i++)for(const k of ['x','y','angle'] as const)assert.ok(Math.abs(start[i][k]-end[i][k])<1e-8,'收尾回到各自原位，無瞬移');
const reached=new Set<number>(),returning=new Set<number>();
for(let frame=0;frame<64;frame++){
 const poses=weaponVolleyPoses({...input,frame}),opposite=weaponVolleyPoses({...input,caster:reflect(a),target:reflect(b),side:'p2',frame});
 for(let i=0;i<6;i++){
  const p=poses[i],q=opposite[i];
  assert.ok([p.x,p.y,p.angle,p.length].every(Number.isFinite));
  assert.ok(Math.abs(p.x+q.x-1210)<1e-7,'P1/P2 使用同一目標路線鏡射');
  assert.ok(Math.abs(p.y-q.y)<1e-7);
  assert.ok(Math.abs(Math.sin(p.angle)+Math.sin(q.angle))<1e-7,'劍尖方向相反');
  if(p.strike===1){assert.ok(p.x>=b.left&&p.x<=b.right);assert.ok(p.y>=b.top&&p.y<=b.bottom);reached.add(i);}
  if(p.phase==='return')returning.add(i);
 }
}
assert.equal(reached.size,6,'六劍均實際到達對手，不能只有一劍命中');assert.equal(returning.size,6);
const idle0=weaponVolleyPoses({...input,sequence:'standby',frames:96,frame:0}),idleEnd=weaponVolleyPoses({...input,sequence:'standby',frames:96,frame:95});
for(let i=0;i<6;i++)assert.ok(Math.abs(idle0[i].y-idleEnd[i].y)<1e-8);
for(const sequence of ['cp','extra']){
 const poses=weaponVolleyPoses({...input,sequence,frame:24});
 assert.ok(poses.every(p=>p.strike===0),'屬性／額外行動不偽造攻擊命中');
}
const moved=weaponVolleyPoses({...input,target:{...b,left:600,right:700},frame:28});
assert.notEqual(moved[0].x,weaponVolleyPoses({...input,frame:28})[0].x,'依目前對手位置，不使用固定螢幕座標');
// Artist-authored support cuts: upper/lower pair, cross pair, last finisher.
// The body-held sword is represented separately by the renderer.
const pattern=[
 {strikeOffset:0,targetY:.5,swingTilt:0,arc:0},
 {strikeOffset:-4,targetY:.34,swingTilt:-.8,arc:.2},
 {strikeOffset:-2,targetY:.68,swingTilt:.8,arc:-.2},
 {strikeOffset:2,targetY:.43,swingTilt:.6,arc:.13},
 {strikeOffset:4,targetY:.61,swingTilt:-.6,arc:-.13},
 {strikeOffset:6,targetY:.51,swingTilt:0,arc:.04},
];
for(let i=0;i<6;i++){
 const frame=input.hit+pattern[i].strikeOffset;
 const p=weaponVolleyPoses({...input,pattern,frame})[i];
 const q=weaponVolleyPoses({...input,pattern,caster:reflect(a),target:reflect(b),side:'p2',frame})[i];
 assert.equal(p.strike,1,'每把劍的分鏡節點真正抵達目標');
 assert.ok(Math.abs(p.y-(b.top+(b.bottom-b.top)*pattern[i].targetY))<1e-7);
 assert.ok(Math.abs(p.x+q.x-1210)<1e-7);assert.ok(Math.abs(p.y-q.y)<1e-7);
 const returned=weaponVolleyPoses({...input,pattern,frame:63})[i];
 assert.ok(Math.abs(returned.x-start[i].x)<1e-7&&Math.abs(returned.y-start[i].y)<1e-7);
}
console.log('六劍出發、逐劍命中、收回、兩側鏡射、閉合待機與動態目標通過');
// Authored non-attack formations keep all identities, mirror and close exactly.
const formation=Array.from({length:6},(_,i)=>({x:(i-2.5)*.24,y:.03+Math.abs(i-2.5)*.05,angle:(i-2.5)*.25,delay:(i%3)*.04}));
for(const sequence of ['cp','extra'])for(const frame of [0,12,24,36,47]){
 const p=weaponVolleyPoses({...input,sequence,frames:48,frame,formation});
 const q=weaponVolleyPoses({...input,sequence,frames:48,frame,formation,caster:reflect(a),target:reflect(b),side:'p2'});
 assert.equal(p.length,6);
 p.forEach((blade,i)=>{
  assert.equal(blade.strike,0,'支援陣形沒有攻擊命中');
  assert.ok(Math.abs(blade.x+q[i].x-1210)<1e-7&&Math.abs(blade.y-q[i].y)<1e-7);
  if(frame===0||frame===47)assert.ok(Math.abs(blade.x-start[i].x)<1e-7&&Math.abs(blade.y-start[i].y)<1e-7,'陣形回到同一把劍的家');
 });
}
assert.notEqual(weaponVolleyPoses({...input,sequence:'cp',frames:48,frame:24,formation})[0].x,weaponVolleyPoses({...input,sequence:'cp',frames:48,frame:24})[0].x,'候選陣形確實取代舊的整組抬升');
console.log('六劍支援陣形、無偽命中、雙側鏡射與閉合回位通過');
