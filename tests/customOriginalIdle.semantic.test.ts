import assert from 'node:assert/strict';
import fs from 'node:fs';
import {customIdleMesh} from '../src/battle/customIdleMesh';
const zones=[{kind:'cloth' as const,x:.5,y:.5,rx:.5,ry:.5,dx:12,dy:3,delay:.5}];
const options={grid:[24,36] as const,pins:[{x:.5,y:.5,rx:.15,ry:.15}]};
const make=(phase:number)=>customIdleMesh([0,0,1200,1600],[0,0,1,1],[1200,1600],100,phase,zones,options);
const rest=make(0),motion=make(.25),end=make(1);
assert.equal(rest.length,24*36);
let moving=0,pinned=0;
for(let i=0;i<rest.length;i++)for(let p=0;p<8;p+=2){
 const x=rest[i].p[p]*100,y=1600-rest[i].p[p+1]*100;
 const delta=Math.hypot((motion[i].p[p]-rest[i].p[p])*100,(motion[i].p[p+1]-rest[i].p[p+1])*100);
 if(delta>.01)moving++;
 if(Math.hypot((x/1200-.5)/.15,(y/1600-.5)/.15)<.7){assert.ok(delta<1e-9,'Face/weapon inner pin must remain rigid');pinned++;}
 assert.ok(Math.abs(rest[i].p[p]-end[i].p[p])<1e-10,'Loop must close without drift');
 assert.ok(Math.abs(rest[i].p[p+1]-end[i].p[p+1])<1e-10);
 assert.deepEqual(rest[i].u,motion[i].u,'Local motion must sample the same original pixels');
}
assert.ok(moving>0&&pinned>0,'Both living cloth and rigid landmarks must be exercised');
for(let row=0;row<36;row++)for(let col=0;col<23;col++){
 const a=motion[row*24+col],b=motion[row*24+col+1];
 assert.deepEqual(a.p.slice(2,4),b.p.slice(0,2),'No seam at top shared vertex');
 assert.deepEqual(a.p.slice(4,6),b.p.slice(6,8),'No seam at bottom shared vertex');
}
assert.equal(customIdleMesh([0,0,100,100],[0,0,1,1],[100,100],100,0,[]).length,352,'Existing assets keep their original grid');
// The enlarged authored idle must stay a connected, non-folding surface over
// the whole cycle. A more visible displacement is not permission to invert it.
const spec=JSON.parse(fs.readFileSync('docs/custom-anim/drafts/20261106-original-motion/wuxu_zhuixing.json','utf8'));
const area=(p:number[],a:number,b:number,c:number)=>(p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]);
const authored=(phase:number)=>customIdleMesh([0,0,...spec.canvas],[0,0,1,1],spec.canvas,spec.pixelsPerUnit,phase,spec.idleZones,{grid:spec.idleGrid,pins:spec.idlePins});
const initial=authored(0);
let minAreaRatio=Infinity,maxPixelTravel=0;
for(let f=0;f<=96;f++){
 const frame=authored(f/96);
 for(let i=0;i<frame.length;i++){
  const p=frame[i].p,base=initial[i].p;
  for(const triangle of [[0,2,4],[0,4,6]]){
   const [a,b,c]=triangle,ratio=area(p,a,b,c)/area(base,a,b,c);
   minAreaRatio=Math.min(minAreaRatio,ratio);
   assert.ok(ratio>.2,'Cloth must not fold or collapse into an inverted triangle');
  }
  for(let j=0;j<8;j+=2)maxPixelTravel=Math.max(maxPixelTravel,Math.hypot(p[j]-base[j],p[j+1]-base[j+1])*spec.pixelsPerUnit);
 }
}
console.log(JSON.stringify({authoredIdle:{minAreaRatio,maxSourcePixelTravel:maxPixelTravel},note:'Geometry only; visible textured regions still require player review.'}));
console.log('Original texture UVs, rigid landmarks, continuous cloth mesh and closed idle loop passed. Visual quality remains a browser acceptance item.');
