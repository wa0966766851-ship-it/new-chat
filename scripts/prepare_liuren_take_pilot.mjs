// Add an intermediate grip pose without changing impact or total action duration.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/liuren-weapon-pilot';
const spec=JSON.parse(fs.readFileSync(dir+'/spec.json','utf8'));
const source=dir+'/take-source.png';
const bytes=alignPose(fs.readFileSync(source),{canvas:spec.canvas,scale:1.2,offset:[12,-11]});
const file=dir+'/take.png';fs.writeFileSync(file,bytes);
spec.poses.take={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',review:{accepted:true,note:'只允許取還劍過渡草稿試播；頭身與地平線人工對位。手柄銜接、披風跳變及雙側尚待視覺驗收。'}};
for(const name of ['attack','ultimate'])spec.sequences[name].drawings=[
 {pose:'ready',hold:4},{pose:'take',hold:6},{pose:'windup',hold:10},
 {pose:'cut',hold:6},{pose:'melee',hold:10},{pose:'cut',hold:4},
 {pose:'windup',hold:10},{pose:'take',hold:6},{pose:'ready',hold:8}
];
spec.presentation.weaponVolley.held={sequences:['attack','ultimate'],from:4,until:56};
fs.writeFileSync(dir+'/take-pilot-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/take-review.json',JSON.stringify({status:'unaccepted-take-transition-pilot',source,scale:1.2,offset:[12,-11],floor:1520,frames:64,unchangedEvents:{launch:18,hit:32,recover:48},pending:['hand-to-prop handoff still needs a reach drawing','head size and cloak contour across drawings','P1/P2 actual playback','ordinary idle and skill speed/resolution coverage']},null,2)+'\n');
console.log(dir+'/take-pilot-spec.json');
