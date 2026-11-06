import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {compilePoseAnimation} from '../scripts/lib/poseAnimation.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/emperor_dixin';
const spec=JSON.parse(fs.readFileSync(dir+'/idle-sash-spec.json','utf8'));
const before=JSON.parse(fs.readFileSync(dir+'/melee-pilot-spec.json','utf8'));
const source=PNG.sync.read(fs.readFileSync('docs/custom-anim/drafts/20261105-dixin/ready-clean.png'));
const base=PNG.sync.read(fs.readFileSync(spec.poses.idleSashBase.file));
const cloth=PNG.sync.read(fs.readFileSync(spec.poses.idleSash.file));
let moving=0,underpaint=0;
for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
 const at=(y*source.width+x)*4, dest=((y+765)*base.width+x+520)*4;
 const a=source.data[at+3],b=base.data[dest+3],c=cloth.data[dest+3];
 if(c){
  moving++;
  assert.ok(y>=620,'the belt root must stay fixed, without duplicate alpha');
  assert.deepEqual(cloth.data.subarray(dest,dest+4),source.data.subarray(at,at+4),'moving cloth uses original pixels');
  if(b){underpaint++;assert.equal(a,255,'underpaint must not change translucent edges');assert.ok(x<850&&y<1050,'underpaint stays inside central occlusion');}
  // Original opaque cloth hides underpaint; translucent cloth has no underpaint.
  assert.equal(Math.round(c+b*(1-c/255)),a,'rest composition preserves original opacity');
 }else{
  assert.equal(b,a,'all untouched pixels preserve original opacity');
  if(a)assert.deepEqual(base.data.subarray(dest,dest+4),source.data.subarray(at,at+4),'face, hair, armor, hands and fixed cloth preserve original RGBA');
 }
}
assert.ok(moving>1000&&underpaint>1000,'test must exercise both moving cloth and hidden fill');
assert.equal(spec.poses.ready,undefined,'do not pack a duplicate complete rest drawing');
for(const [name,sequence] of Object.entries(before.sequences)){
 if(name==='standby')continue;
 const expected=structuredClone(sequence);
 for(const drawing of expected.drawings)if(drawing.pose==='ready')drawing.pose='idleSashBase';
 assert.deepEqual(spec.sequences[name],expected,'action timing and all non-rest poses must stay unchanged');
}
const {manifest:m}=compilePoseAnimation(spec,p=>fs.readFileSync(p));
const q=m.sequences.standby.quads;
assert.deepEqual(q[0].g,q.at(-1).g,'all idle layers close the loop');
assert.deepEqual(q[0].g[0].p,q[30].g[0].p,'body remains fixed');
assert.notDeepEqual(q[0].g[1].p,q[30].g[1].p,'sash moves independently');
assert.equal(m.idleMotion,undefined,'no water-like displacement');
assert.equal(m.production.uniqueDrawings,5);
assert.ok(m.production.rgbaBytes<39324528,'remove the duplicated full rest drawing from the atlas');
console.log('Dixin original pixel/alpha protection, independent sash, loop, action timing and duplicate removal passed; artistic acceptance remains pending.');
