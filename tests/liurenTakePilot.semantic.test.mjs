import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compilePoseAnimation} from '../scripts/lib/poseAnimation.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/liuren-weapon-pilot';
const old=JSON.parse(fs.readFileSync(dir+'/spec.json','utf8'));
const next=JSON.parse(fs.readFileSync(dir+'/take-pilot-spec.json','utf8'));
const {manifest}=compilePoseAnimation(next,p=>fs.readFileSync(p));
for(const name of ['attack','ultimate']){
 const seq=next.sequences[name];
 assert.equal(manifest.sequences[name].frames,64);
 assert.deepEqual(seq.hits,old.sequences[name].hits);
 assert.deepEqual(seq.events,old.sequences[name].events);
 const poses=seq.drawings.flatMap(x=>Array(x.hold).fill(x.pose));
 for(let f=0;f<poses.length;f++){
  const drawnWeapon=['take','windup','cut','melee'].includes(poses[f]);
  const held=next.presentation.weaponVolley.held;
  const hiddenProp=held.sequences.includes(name)&&f>=held.from&&f<held.until;
  assert.equal(hiddenProp,drawnWeapon,'external lead sword must match the hand-held drawing at frame '+f);
 }
 assert.deepEqual(seq.drawings.filter(x=>x.pose==='take').map(x=>x.hold),[6,6]);
}
assert.deepEqual(next.sequences.sa,old.sequences.sa,'physical transition cannot replace the special casting performance');
console.log('六刃取還劍過渡：出傷時點／64幀不變，手持＋外部劍總量一致；不代表動作美術完成');
