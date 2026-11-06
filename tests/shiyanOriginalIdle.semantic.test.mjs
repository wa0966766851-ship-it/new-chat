import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {compilePoseAnimation} from '../scripts/lib/poseAnimation.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/wuxu_shiyan';
const spec=JSON.parse(fs.readFileSync(dir+'/idle-rig-spec.json','utf8'));
const src=PNG.sync.read(fs.readFileSync('public/elf-art/wuxu_shiyan_body.png'));
const upper=PNG.sync.read(fs.readFileSync(spec.poses.idleUpper.file));
const lower=PNG.sync.read(fs.readFileSync(spec.poses.idleLower.file));
// Identity and detail must come from the original, not the generated ghost underpainting.
for(const [image,box] of [[upper,[267,155,335,230]],[upper,[100,335,220,400]],[lower,[235,870,410,999]]]){
 for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++){
  const from=(y*src.width+x)*4,to=((y+425)*image.width+x+280)*4;
  assert.equal(image.data[to+3],src.data[from+3],'face/book/boots must preserve original alpha');
  if(src.data[from+3]>0)assert.deepEqual(image.data.subarray(to,to+4),src.data.subarray(from,from+4),'visible face/book/boots must preserve original RGBA');
 }
}
const {manifest:m}=compilePoseAnimation(spec,p=>fs.readFileSync(p));
const q=m.sequences.standby.quads;
assert.deepEqual(q[0].g,q.at(-1).g,'all idle layers must close their loop');
assert.deepEqual(q[0].c,q[30].c,'feet and lower body cannot drift');
assert.notDeepEqual(q[0].g[0].p,q[30].g[0].p,'ghost must move independently');
assert.notDeepEqual(q[0].g[2].p,q[30].g[2].p,'torso must move independently');
assert.equal(m.idleMotion,undefined,'no legacy water-like displacement');
assert.equal(m.sequences.extra.frames,72);
assert.equal(m.sequences.hited.frames,8,'placeholder hurt remains explicitly unfinished');
console.log('蝕言原圖臉／書／靴RGBA、固定雙腳、獨立動作與循環通過；不代表美術完成');
