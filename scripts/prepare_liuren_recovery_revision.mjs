/** Optional drawn recovery study. Never overwrites the reviewed baseline spec. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261108-detail-revision/wuxu_liuren';
const spec=JSON.parse(fs.readFileSync(dir+'/spec.json','utf8'));
const bytes=fs.readFileSync(dir+'/recover-source-v1.png');
const aligned=alignPose(bytes,{canvas:spec.canvas,scale:.85,offset:[25,680]});
fs.writeFileSync(dir+'/recover-aligned-v1.png',aligned);
spec.poses.recover={file:dir+'/recover-aligned-v1.png',sha256:crypto.createHash('sha256').update(aligned).digest('hex'),
 facing:'left',anchors:{muzzle:[94,1067]},review:{accepted:true,note:'只准候選試播：新畫的屈肘收劍，尚未完成對戰雙側連續性驗收，不准直接發佈。'}};
for(const name of ['attack','ultimate']){
 const a=spec.sequences[name].drawings;
 // Replace 4 reused cut + 10 windup frames with a true 8-frame drawn recovery
 // and 6-frame guard. Total duration, impact and return markers remain intact.
 if(a[5].pose!=='cut'||a[6].pose!=='windup')throw Error('Unexpected baseline action');
 a[5]={pose:'recover',hold:8};a[6]={pose:'windup',hold:6};
}
fs.writeFileSync(dir+'/spec-recovery-v1.json',JSON.stringify(spec,null,2)+'\n');
console.log('Recovery study only: '+dir+'/spec-recovery-v1.json');
