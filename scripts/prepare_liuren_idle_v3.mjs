/** Import the reviewed offline interpolation at half source resolution, same world size. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261105-liuren-v3';
const spec=JSON.parse(fs.readFileSync(`${dir}/wuxu_liuren.json`,'utf8'));
const out='build/custom-idle-v3-poses';fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const [name,pose] of Object.entries(spec.poses)){
 const bytes=alignPose(fs.readFileSync(pose.file),{canvas:[450,550],scale:.5,offset:[0,0]}),file=`${out}/${name}.png`;
 fs.writeFileSync(file,bytes);pose.file=file;pose.sha256=sha(bytes);
 if(pose.anchors)pose.anchors=Object.fromEntries(Object.entries(pose.anchors).map(([k,p])=>[k,p.map(v=>v*.5)]));
}
const drawings=[];
for(let i=0;i<47;i++){
 const bytes=alignPose(fs.readFileSync(`build/custom-idle-flow-v3/frames/${String(i).padStart(2,'0')}.png`),{
  canvas:[450,550],scale:.87,offset:[7.5,113.5],
 }),file=`${out}/idle-${i}.png`,id=`idle_${i}`;
 fs.writeFileSync(file,bytes);spec.poses[id]={file,sha256:sha(bytes),facing:'left',anchors:spec.poses.ready.anchors,
  review:{accepted:true,note:'六張完整待機關鍵畫面經離線雙向光流補過渡；背景去霧、完整頭腳與刀鏈，已檢視候選雙方；對戰尺寸仍須複驗。'}};
 drawings.push({pose:id,hold:2});
}
// Return to the same artwork, never crossfade the whole character in the game.
drawings.push({pose:'idle_0',hold:2});
spec.poses.ready=structuredClone(spec.poses.idle_0);
spec.canvas=[450,550];spec.anchor=spec.anchor.map(v=>v*.5);spec.pixelsPerUnit=50;spec.margin=4;
delete spec.idleZones;
spec.sequences.standby={loop:true,drawings,hits:[]};
fs.writeFileSync(`${out}/wuxu_liuren.json`,JSON.stringify(spec,null,2)+'\n');
console.log(`${out}/wuxu_liuren.json`);
