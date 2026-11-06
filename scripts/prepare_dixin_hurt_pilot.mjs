// Separate reaction drawing study. Does not publish assets or alter battle rules.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/emperor_dixin';
const spec=JSON.parse(fs.readFileSync(dir+'/idle-sash-spec.json','utf8'));
const file=dir+'/hurt-aligned.png';
const bytes=alignPose(fs.readFileSync(dir+'/hurt-source-v1.png'),{canvas:spec.canvas,scale:1,offset:[520,771]});
fs.writeFileSync(file,bytes);
spec.poses.hurt={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',
 anchors:{muzzle:[820,1455]},review:{accepted:true,note:'完整受擊單張已以深色底檢視：無大片背景霧、冠劍裙擺完整；與原圖的姿勢切換仍待實播驗收。'}};
spec.poses=Object.fromEntries(['idleSashBase','cast','anticipation','hurt','melee','idleSash'].map(id=>[id,spec.poses[id]]));
spec.sequences.hited={...spec.sequences.hited,drawings:[{pose:'hurt',hold:6},{pose:'idleSashBase',hold:6}]};
fs.writeFileSync(dir+'/hurt-pilot-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/hurt-pilot-review.json',JSON.stringify({status:'unaccepted-reaction-study',source:'hurt-source-v1.png',offset:[520,771],pending:['identity and ornament continuity','abrupt transition without middle recovery drawing','both sides in actual battle','long ribbons and crown framing'],note:'The generated preview showed hidden RGB haze; actual alpha composition on dark background did not. No alpha threshold was applied.'},null,2)+'\n');
console.log(dir+'/hurt-pilot-spec.json');
