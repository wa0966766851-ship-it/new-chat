import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {compilePoseAnimation} from '../scripts/lib/poseAnimation.mjs';

const dir='docs/custom-anim/drafts/20261106-original-motion/wuxu_shiyan';
const spec=JSON.parse(fs.readFileSync(dir+'/hurt-rig-spec.json','utf8'));
const original=PNG.sync.read(fs.readFileSync('public/elf-art/wuxu_shiyan_body.png'));
for(const id of ['hurtGuard','hurtRecover']){
 const image=PNG.sync.read(fs.readFileSync(spec.poses[id].file));
 for(const [x,y] of [[50,100],[100,200],[500,300]])
  assert.equal(image.data[((y+425)*image.width+x+280)*4+3],0,'generated ghost outside the gesture mask must be absent');
 assert.ok(spec.rigidAttachments.some(p=>p.basePose===id&&p.pose==='idleGhost'&&p.behind),'hurt must share the original idle ghost layer');
 for(let y=492;y<original.height;y++)for(let x=0;x<original.width;x++){
  const a=(y*original.width+x)*4,b=((y+425)*image.width+x+280)*4;
  assert.equal(image.data[b+3],original.data[a+3],'lower body alpha must stay original');
  if(original.data[a+3])assert.deepEqual(image.data.subarray(b,b+4),original.data.subarray(a,a+4),'grounded lower body must retain original detail');
 }
}
assert.notEqual(spec.poses.hurtGuard.sha256,spec.poses.hurtRecover.sha256);
const {manifest}=compilePoseAnimation(spec,p=>fs.readFileSync(p));
assert.equal(manifest.sequences.hited.frames,12);
for(const [name,sequence] of Object.entries(spec.sequences)){
 if(name==='standby'||name==='hited')continue;
 assert.equal(sequence.drawings.at(-1).pose,'idleLower',name+' must return to the same neutral artwork');
}
assert.equal(manifest.idleMotion,undefined);
console.log('受擊草稿下身原像素、獨立回正姿勢與待機終點通過；色調／接縫仍待美術驗收');
