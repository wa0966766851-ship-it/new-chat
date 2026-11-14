/** A drawn firing recoil, retaining the original skill and hit timeline. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261108-detail-revision/wuxu_zhuixing';
const spec=JSON.parse(fs.readFileSync('docs/custom-anim/drafts/20261106-original-motion/wuxu_zhuixing.json','utf8'));
const source=fs.readFileSync(dir+'/recoil-source-v1.png'),png=PNG.sync.read(source);
assert.deepEqual([png.width,png.height],[1086,1448],'Keep source foot registration before adopting another canvas');
const bytes=alignPose(source,{canvas:spec.canvas,scale:1,offset:[57,76]});
fs.writeFileSync(dir+'/recoil-aligned-v1.png',bytes);
spec.poses.recoil={file:dir+'/recoil-aligned-v1.png',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:{muzzle:[297,232]},review:{accepted:true,note:'候選限定：朝上開砲後座力；原圖細節、腳位、抬砲銜接與雙側需實播。'}};
for(const name of ['attack','sa','ultimate']){
 const sequence=spec.sequences[name],before=sequence.drawings.reduce((n,d)=>n+d.hold,0);
 let cursor=0,inserted=false;
 sequence.drawings=sequence.drawings.flatMap(d=>{
  const start=cursor;cursor+=d.hold;
  if(d.pose!=='aim'||sequence.events.launch<start||sequence.events.launch>=cursor)return[d];
  const lead=sequence.events.launch-start,recoil=4,tail=d.hold-lead-recoil;
  assert.ok(tail>0,name+' recoil must fit the existing aim hold');inserted=true;
  return [{pose:'aim',hold:lead},{pose:'recoil',hold:recoil},{pose:'aim',hold:tail}].filter(x=>x.hold>0);
 });
 assert.ok(inserted,name+' firing pose inserted');
 assert.equal(sequence.drawings.reduce((n,d)=>n+d.hold,0),before,name+' duration unchanged');
}
spec.poseBlend=false;
fs.writeFileSync(dir+'/spec-recoil-v1.json',JSON.stringify(spec,null,2)+'\n');
console.log(dir+'/spec-recoil-v1.json');
