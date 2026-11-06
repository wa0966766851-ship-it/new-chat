import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {alignPose} from '../scripts/lib/alignPose.mjs';
import {rigidAttachmentQuad} from '../scripts/lib/rigidAttachments.mjs';
import {compilePoseAnimation} from '../scripts/lib/poseAnimation.mjs';
const root='docs/custom-anim/drafts/20261106-original-motion';
const spec=JSON.parse(fs.readFileSync(root+'/wuxu_zhuixing.json','utf8'));
assert.equal(spec.idleZones.length,0,'Rejected elliptic deformation must not remain active');
const source=PNG.sync.read(alignPose(fs.readFileSync('docs/custom-anim/drafts/20261105-zhuixing-original/original-color-matte-v3.png'),{canvas:spec.canvas,scale:1,offset:[57,76]}));
const parts=['ready',...spec.rigidAttachments.map(p=>p.pose)].map(id=>PNG.sync.read(fs.readFileSync(spec.poses[id].file)));
const review=JSON.parse(fs.readFileSync(root+'/source-review.json','utf8'));
const inside=(x,y,poly)=>{let v=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)v=!v;}return v;};
for(let i=0;i<source.data.length;i+=4){
 const coat=parts[1],body=parts[0],upper=parts.at(-1),originalProp=parts.slice(1).filter(p=>p.data[i+3]>0);
 assert.ok(originalProp.length<=1,'No original pixel duplicated across moving parts');
 if(coat.data[i+3]>0){
  for(let c=0;c<4;c++)assert.equal(coat.data[i+c],source.data[i+c],'Cloth foreground uses original pixels');
  if(coat.data[i+3]<255)assert.equal(body.data[i+3],0,'Repair cannot show through antialiased or translucent cloth edges');
 }else if(upper.data[i+3]>0){
  for(let c=0;c<4;c++)assert.equal(upper.data[i+c],source.data[i+c],'Upper body, face, arms and cannon use exact source RGBA');
  if(body.data[i+3]>0){
   const pixel=i/4,x=pixel%source.width-57,y=Math.floor(pixel/source.width)-76;
   assert.equal(body.data[i+3],255,'Belt overlap must be opaque');
   assert.ok(inside(x,y,review.beltCover),'Duplicate pixels are restricted to authored waist occlusion');
   for(let c=0;c<4;c++)assert.equal(body.data[i+c],source.data[i+c],'Belt is original foreground, not generated anatomy');
  }
 }else{
  const present=parts.filter(p=>p.data[i+3]>0);
  assert.equal(present.length,source.data[i+3]>0?1:0,'Repair cannot escape removed cloth pixels');
  if(present.length)for(let c=0;c<4;c++)assert.equal(present[0].data[i+c],source.data[i+c],'Face, cannon, limbs and props retain exact source RGBA');
 }
 if(!source.data[i+3])assert.equal(body.data[i+3],0,'Repair must not expand the rest silhouette');
}
assert.deepEqual(spec.poses.ready.anchors.muzzle,[229,286],'Splitting must preserve the original muzzle anchor');
const c=[1,10,4,10,4,8,1,8],uv=[0,0,.5,.5],canvas=[1200,1600],ppu=100;
const distance=(p,a,b)=>Math.hypot(p[a]-p[b],p[a+1]-p[b+1]);
for(const part of spec.rigidAttachments){
 const start=rigidAttachmentQuad(c,uv,canvas,ppu,part,0);
 const end=rigidAttachmentQuad(c,uv,canvas,ppu,part,1);
 for(let phase=0;phase<=96;phase++){
  const q=rigidAttachmentQuad(c,uv,canvas,ppu,part,phase/96);
  for(const [a,b] of [[0,2],[2,4],[4,6],[6,0],[0,4],[2,6]])assert.ok(Math.abs(distance(q.p,a,b)-distance(c,a,b))<1e-10,'Metal props preserve all edge and diagonal lengths');
  assert.deepEqual(q.u,start.u,'Original prop texture coordinates stay fixed');
 }
 for(let i=0;i<8;i++)assert.ok(Math.abs(start.p[i]-end.p[i])<1e-10,'No jump at loop boundary');
 if(part.pose==='coatTail'){
  const point=[part.pivot[0]/ppu,(canvas[1]-part.pivot[1])/ppu];
  const root=rigidAttachmentQuad([...point,...point,...point,...point],uv,canvas,ppu,part,.25);
  assert.ok(Math.hypot(root.p[0]-point[0],root.p[1]-point[1])<1e-10,'Cloth must swing around its fixed attachment, not slide across the body');
 }
}
const {manifest}=compilePoseAnimation(spec,file=>fs.readFileSync(file));
const idle=manifest.sequences.standby.quads;
assert.ok(!manifest.idleMotion,'No rejected displacement field in the shipped draft manifest');
for(const q of idle){
 assert.equal(q.g.length,5,'Rigid upper torso behind fixed waist/legs, rooted coat and two floating props');
 assert.deepEqual(q.g[1],idle[0].g[1],'Legs and waist retain their fixed geometry/texture');
 for(const i of [0,2,3,4])for(const [a,b] of [[0,2],[2,4],[4,6],[6,0],[0,4],[2,6]])assert.ok(Math.abs(distance(q.g[i].p,a,b)-distance(idle[0].g[i].p,a,b))<1e-9,'Body and parts retain all proportions, no refraction');
}
assert.notDeepEqual(idle[24].anchors.muzzle,idle[0].anchors.muzzle,'Muzzle follows the cannon during torso motion');
for(const [name,seq] of Object.entries(manifest.sequences))if(name!=='standby')for(const q of seq.quads)if(q.g)assert.deepEqual(q.g,idle[0].g,'Returning ready drawing must contain the same intact props');
console.log('Rooted cloth/rigid props: protected original RGBA, confined repair, retained muzzle, fixed cloth root, unchanged shape/UVs and closed loops passed. Natural motion remains visual review.');
