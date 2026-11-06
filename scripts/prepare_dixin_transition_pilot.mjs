import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
import {orderPoseAtlas} from './lib/poseAtlasOrder.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/emperor_dixin';
const spec=JSON.parse(fs.readFileSync(dir+'/hurt-pilot-spec.json','utf8'));
// Re-evaluated over an actual alpha-composited dark background. No alpha cutout
// or image repaint is needed; this is the intermediate knee bend, not contact.
const scale=1.13,offset=[125,1163];
const bytes=alignPose(fs.readFileSync(dir+'/step-source-v1.png'),{canvas:spec.canvas,scale,offset});
const file=dir+'/step-aligned.png';fs.writeFileSync(file,bytes);
spec.poses.step={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:{muzzle:[221,1648]},review:{accepted:true,note:'深色實際alpha合成已檢視，無原先誤判的霧；中度蹲身且劍肘未伸直，作出劍與收劍過渡研究，整段仍待雙側實播。'}};
spec.sequences.attack.drawings=[{pose:'idleSashBase',hold:3},{pose:'anticipation',hold:4},{pose:'step',hold:4},{pose:'melee',hold:7},{pose:'step',hold:4},{pose:'anticipation',hold:4},{pose:'idleSashBase',hold:6}];
spec.sequences.ultimate.drawings=[{pose:'idleSashBase',hold:3},{pose:'anticipation',hold:4},{pose:'step',hold:5},{pose:'melee',hold:7},{pose:'step',hold:9},{pose:'anticipation',hold:6},{pose:'idleSashBase',hold:8}];
const packed=orderPoseAtlas(spec.poses,p=>fs.readFileSync(p),spec.maxAtlasSide??4096);spec.poses=packed.poses;
fs.writeFileSync(dir+'/transition-pilot-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/transition-pilot-review.json',JSON.stringify({status:'unaccepted-transition-study',source:'step-source-v1.png',scale,offset,atlasLayout:packed.layout,preserved:{attack:{frames:32,launch:10,hit:13,recover:20},ultimate:{frames:42,launch:10,hit:14,recover:30}},pending:['standing to half-crouch and thrust continuity','orb/orbit disappearance at physical action','sword-tip path and torso alignment','both sides and frame budget']},null,2)+'\n');
console.log(dir+'/transition-pilot-spec.json',packed.layout);
