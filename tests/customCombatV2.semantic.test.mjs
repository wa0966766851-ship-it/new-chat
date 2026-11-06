import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets.ts';
import {customClipFromManifest,customFramePresentation} from '../src/battle/customPetClip.ts';
import {preparePetFx} from '../src/battle/petFxPolicy.ts';
for(const id of ['wuxu_zhuixing','wuxu_liuren','wuxu_shiyan','emperor_dixin']){
 const m=JSON.parse(fs.readFileSync(`public/elf-anim/${id}/manifest.json`)),idle=m.sequences.standby;
 assert.equal(idle.frames,96);assert.ok(fs.statSync(`public/elf-anim/${id}/manifest.json`).size<150000,'idle data must stay compact');
 const clip=customClipFromManifest(m,{}),frames=clip.sequences.find(s=>s.name==='standby').frames;
 if(!m.idleMotion){
  const uv=f=>Array.from(f.mesh.uvs);
  assert.deepEqual(uv(frames[0]),uv(frames.at(-1)),'drawn loop must return to its starting artwork');
  assert.deepEqual(Array.from(frames[0].mesh.positions),Array.from(frames.at(-1).mesh.positions));
  assert.ok(new Set(frames.map(f=>JSON.stringify(uv(f)))).size>=40,'authored idle must change artwork, not repeat one drawing');
  assert.ok(frames.every(f=>f.mesh.positions.length===8),'whole drawings must not turn into cut-out body parts');
  const hit=clip.sequences.find(s=>s.name==='hited').frames;
  assert.ok(new Set(hit.map(f=>JSON.stringify(uv(f)))).size>=4,'hit must include impact, recoil, recovery and ready');
  assert.deepEqual(uv(hit.at(-1)),uv(frames[0]),'hit must return to the same standby drawing');
  assert.ok(m.production.rgbaBytes<32*1024*1024,'interpolated artwork must stay within its decoded-image budget');
 }else{
 assert.ok(m.idleMotion.zones.length);
 const cells=f=>Array.from({length:f.mesh.positions.length/8},(_,i)=>({p:Array.from(f.mesh.positions.slice(i*8,i*8+8))}));
 const a=cells(frames[0]),b=cells(frames[48]),end=cells(frames[95]);assert.equal(a.length,352);
 let moved=0,pinned=0;
 for(let i=0;i<a.length;i++)for(let j=0;j<8;j++){
  assert.ok(Math.abs(a[i].p[j]-end[i].p[j])<1e-9,'idle must close without a snap');
  const delta=Math.abs(a[i].p[j]-b[i].p[j])*m.pixelsPerUnit;
  assert.ok(delta<7,'ambient deformation exceeds restrained cloth movement');
  if(delta>.1)moved++;else pinned++;
 }
 assert.ok(moved>0&&pinned>moved,'must move local regions while most of character stays pinned');
 // Adjacent cells share identical edges: no separated body parts or mesh cracks.
 for(let i=0;i<b.length;i++)if(i%16!==15){assert.equal(b[i].p[2],b[i+1].p[0]);assert.equal(b[i].p[3],b[i+1].p[1]);}
 }
 const meta=PET_ANIMATION_ASSETS[id];assert.equal(meta.presentation.ambient,true);
 if(['wuxu_liuren','emperor_dixin'].includes(id)){
  assert.equal(meta.physicalMotion,'approach');assert.equal(meta.presentation.melee,true);
  assert.notDeepEqual(m.sequences.attack.quads[13].buv,m.sequences.sa.quads[12].buv,'melee must use a different drawing from ranged casting');
  assert.ok(m.sequences.attack.events.launch<m.sequences.attack.hits[0]);
  const source=customClipFromManifest(m,{}),prepared=preparePetFx(source,meta.fullscreen);
  assert.deepEqual(customFramePresentation(prepared.clip,'attack',13),customFramePresentation(source,'attack',13),'FX filtering must preserve authored weapon anchors');
  assert.ok(customFramePresentation(prepared.clip,'attack',13)?.muzzle,'must not silently fall back to character center');
 }
 console.log(id+': '+(m.idleMotion?'local deformation':'replacement-drawing idle and hit')+', closed loop and distinct melee passed');
}
const png=PNG.sync.read(fs.readFileSync('public/elf-fx/custom-v2/orbital-explosion.png'));
// Liuren's original crossed-arm art faces right; left-facing actions are separate.
// Check the actual normalized pixels, not only a metadata string.
const before=PNG.sync.read(fs.readFileSync('docs/custom-anim/drafts/20261105-liuren/aligned/ready.png'));
const after=PNG.sync.read(fs.readFileSync('docs/custom-anim/drafts/20261105-combat-v2/wuxu_liuren-ready-left.png'));
assert.equal(before.width,after.width);assert.equal(before.height,after.height);
for(let y=0;y<before.height;y+=5)for(let x=0;x<before.width;x+=5){
 const a=(y*before.width+x)*4,b=(y*after.width+after.width-1-x)*4;
 assert.deepEqual(before.data.subarray(a,a+4),after.data.subarray(b,b+4),'idle art normalization must mirror the pixels exactly once');
}
assert.equal(png.width%3,0);assert.equal(png.height%2,0);
const frames=[];for(let cell=0;cell<6;cell++){
 let count=0;const cw=png.width/3,ch=png.height/2;
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(png.data[((Math.floor(cell/3)*ch+y)*png.width+cell%3*cw+x)*4+3]>128)count++;
 assert.ok(count>100,'empty explosion drawing');frames.push(count);
}assert.ok(new Set(frames).size>=5,'explosion must have distinct stages');
console.log('Six-stage explosion artwork has distinct nonempty drawings');
