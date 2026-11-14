/** Keep the original idle body; replace physical drawings with versioned detailed art. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261108-detail-revision/wuxu_liuren';
fs.mkdirSync(dir,{recursive:true});
const previous='docs/custom-anim/drafts/20261106-original-motion/liuren-weapon-pilot';
const spec=JSON.parse(fs.readFileSync(previous+'/idle-rig-spec.json','utf8'));
const take=JSON.parse(fs.readFileSync(previous+'/take-pilot-spec.json','utf8'));
spec.poses.take=take.poses.take;
for(const name of ['attack','ultimate'])spec.sequences[name]=take.sequences[name];
const inputs={windup:[.85,[25,680],[100,980]],melee:[.74,[25,890],[55,1130]]};
for(const [name,[scale,offset,muzzle]] of Object.entries(inputs)){
 const source=dir+'/'+name+'-source-v1.png';if(!fs.existsSync(source))throw Error('缺少已保存的姿勢原圖：'+source);
 const data=alignPose(fs.readFileSync(source),{canvas:spec.canvas,scale,offset});
 const file=dir+'/'+name+'-aligned-v1.png';fs.writeFileSync(file,data);
 spec.poses[name]={file,sha256:crypto.createHash('sha256').update(data).digest('hex'),facing:'left',anchors:{muzzle},review:{accepted:true,note:'僅准試播：保留黑甲綠紋的持劍姿勢，已檢視淺底透明度；仍需對戰兩側與回劍銜接驗收。'}};
}
// The cut is the same preparatory drawing, not a claimed extra hand-painted frame.
spec.poses.cut=structuredClone(spec.poses.windup);
// End the hit on the actual layered standby assembly, not its older flattened copy.
spec.sequences.hited.drawings.at(-1).pose=spec.sequences.standby.drawings[0].pose;
fs.writeFileSync(dir+'/spec.json',JSON.stringify(spec,null,2)+'\n');
console.log(dir+'/spec.json');
