/** Candidate only: match physical-action drawings to the original faceted armor. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261108-detail-revision/wuxu_liuren';
const spec=JSON.parse(fs.readFileSync(dir+'/spec-recovery-v1.json','utf8'));
for(const [name,scale,offset,muzzle] of [
 ['take',.6,[390,620],[690,900]],
 ['lower',.66,[350,550],[680,965]],
 ['windup',.85,[25,680],[85,965]],
 ['melee',.74,[25,890],[40,1118]],
 ['recover',.85,[25,680],[85,1060]],
 ['command',.633,[310,700],[410,880]],
]){
 const source=dir+'/'+name+'-source-v2.png';
 const data=alignPose(fs.readFileSync(source),{canvas:spec.canvas,scale,offset});
 const file=dir+'/'+name+'-aligned-v2.png';fs.writeFileSync(file,data);
 spec.poses[name]={file,sha256:crypto.createHash('sha256').update(data).digest('hex'),facing:'left',anchors:{muzzle},
  review:{accepted:true,note:'只准候選試播：以原始角面黑甲為主參考補畫，尚待和待機／取劍及雙側連續性驗收。'}};
}
spec.poses.cut=structuredClone(spec.poses.windup);
// Allocate genuine intermediate drawings within the original 64-frame timing.
// Main contact stays at 32; do not stretch the battle timeline to hide a cut.
for(const name of ['attack','ultimate'])spec.sequences[name].drawings=[
 {pose:'ready',hold:4},{pose:'take',hold:4},{pose:'lower',hold:4},
 {pose:'windup',hold:8},{pose:'cut',hold:6},{pose:'melee',hold:10},
 {pose:'recover',hold:8},{pose:'windup',hold:4},{pose:'lower',hold:4},
 {pose:'take',hold:4},{pose:'ready',hold:8},
];
// An empty-handed command allows all six prop swords to remain visible.
// No reuse of a held-sword pose, which would accidentally introduce a seventh.
// Missing art is a failed build, never a silent return to a fixed-body clip.
{
 const source=dir+'/gather-source-v2.png';
 const data=alignPose(fs.readFileSync(source),{canvas:spec.canvas,scale:.633,offset:[310,700]});
 const file=dir+'/gather-aligned-v2.png';fs.writeFileSync(file,data);
 spec.poses.gather={file,sha256:crypto.createHash('sha256').update(data).digest('hex'),facing:'left',
  review:{accepted:true,note:'僅准候選：空手解開抱臂的中間姿勢，待腳底／畫風與雙側銜接驗收。'}};
 spec.sequences.cp.drawings=[{pose:'ready',hold:6},{pose:'gather',hold:8},{pose:'command',hold:16},{pose:'gather',hold:8},{pose:'ready',hold:10}];
 spec.sequences.extra.drawings=[{pose:'ready',hold:4},{pose:'gather',hold:6},{pose:'command',hold:20},{pose:'gather',hold:8},{pose:'ready',hold:10}];
}
fs.writeFileSync(dir+'/spec-detail-v2.json',JSON.stringify(spec,null,2)+'\n');
console.log(dir+'/spec-detail-v2.json');
