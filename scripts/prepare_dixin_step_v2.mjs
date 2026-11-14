/** Drawn push-off step; candidate only, preserve all timing and game rules. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261108-detail-revision/emperor_dixin';
const spec=JSON.parse(fs.readFileSync(dir+'/spec.json','utf8'));
const drawings=[['step','step-source-v2.png',1.2,[140,1108],[164,1648]]];
for(const [name,source,scale,offset,muzzle] of drawings){
 const bytes=alignPose(fs.readFileSync(dir+'/'+source),{canvas:spec.canvas,scale,offset});
 const file=dir+'/'+name+'-aligned-v2.png';fs.writeFileSync(file,bytes);
 spec.poses[name]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:{muzzle},
  review:{accepted:true,note:'僅准候選：真實踏步／輪廓清理補畫，需逐姿勢對齊與雙側畫風驗收，不代表正式採用。'}};
}
fs.writeFileSync(dir+'/spec-step-v2.json',JSON.stringify(spec,null,2)+'\n');
console.log(dir+'/spec-step-v2.json');
