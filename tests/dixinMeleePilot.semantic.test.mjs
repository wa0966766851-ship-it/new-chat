import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/custom-anim/drafts/20261106-original-motion';
const base=JSON.parse(fs.readFileSync(dir+'/emperor_dixin.json','utf8'));
const pilot=JSON.parse(fs.readFileSync(dir+'/emperor_dixin/melee-pilot-spec.json','utf8'));
const seq=pilot.sequences.ultimate;
const frames=seq.drawings.flatMap(d=>Array(d.hold).fill(d.pose));
assert.equal(frames.length,42);
assert.equal(frames[seq.hits[0]],'melee','physical fifth must contact with a sword pose');
assert.equal(frames.at(-1),'ready');
assert.deepEqual(seq.events,base.sequences.ultimate.events);
assert.deepEqual(seq.hits,base.sequences.ultimate.hits);
assert.deepEqual(pilot.presentation.meleeSequences,['attack','ultimate']);
for(const [name,pose] of Object.entries(pilot.poses)){
 assert.equal(pose.file,base.poses[name].file);
 assert.equal(pose.sha256,base.poses[name].sha256,'keep original image pixels/colors');
 assert.notDeepEqual(pose.anchors,base.poses[name].anchors,'remove shared placeholder');
}
for(const name of ['standby','attack','sa','cp','extra','hited'])
 assert.deepEqual(pilot.sequences[name],base.sequences[name]);
assert.equal(pilot.presentation.color,base.presentation.color);
assert.equal(pilot.presentation.secondary,base.presentation.secondary);
console.log('Dixin physical fifth: contact pose, event timing, palette and other actions preserved.');
