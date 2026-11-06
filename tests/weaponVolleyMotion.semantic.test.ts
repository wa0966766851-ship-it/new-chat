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
console.log('六劍出發、逐劍命中、收回、兩側鏡射、閉合待機與動態目標通過');
