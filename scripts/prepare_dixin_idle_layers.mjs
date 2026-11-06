// Original-pixel foreground sash study. Generated color is restricted to hidden underpaint.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/emperor_dixin';
const spec=JSON.parse(fs.readFileSync(dir+'/melee-pilot-spec.json','utf8'));
const source=PNG.sync.read(fs.readFileSync('docs/custom-anim/drafts/20261105-dixin/ready-clean.png'));
const fill=PNG.sync.read(alignPose(fs.readFileSync(dir+'/sash-underpaint-source.png'),{canvas:[1024,1536],scale:1,offset:[0,0]}));
const sash=[[595,560],[645,615],[677,713],[731,806],[798,889],[895,968],[1009,1080],[1024,1174],[1024,1295],[960,1220],[933,1165],[870,1100],[800,1045],[749,981],[711,920],[674,848],[647,772],[611,696],[590,633]];
export function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const [a,b]=p[i],[c,d]=p[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
}return hit;}
const base=PNG.sync.read(PNG.sync.write(source));
const cloth=new PNG({width:source.width,height:source.height});
for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
 if(!inside(x,y,sash))continue;
 const at=(y*source.width+x)*4;
 // Keep the belt root covered by original pixels. Only the hanging section pivots.
 if(y<620)continue;
 source.data.copy(cloth.data,at,at,at+4);
 base.data.fill(0,at,at+4);
 // Under the central robe only. Outer hanging tip reveals empty background.
 // Never put new color under translucent original edges: that changes their
 // composite even in the rest pose. Fully opaque cloth hides this underpaint.
 if(x<850&&y<1050&&source.data[at+3]===255)fill.data.copy(base.data,at,at,at+4);
}
for(const [id,png] of [['idleSashBase',base],['idleSash',cloth]]){
 const bytes=alignPose(PNG.sync.write(png),{canvas:spec.canvas,scale:1,offset:[520,765]});
 const file=dir+'/'+id+'.png';fs.writeFileSync(file,bytes);
 spec.poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:spec.poses.ready.anchors,
  review:{accepted:true,note:'僅原像素衣帶局部擺動研究；生成底圖限定在原衣帶遮擋內。根部、輪廓與兩側尚待美術驗收。'}};
}
spec.sequences.standby.drawings=[{pose:'idleSashBase',hold:120}];
// Use the assembled rest pose at action endpoints as well. The compiler applies
// attachments at their rest transform outside standby, preserving the original
// silhouette without packing a second complete copy of that same character.
for(const sequence of Object.values(spec.sequences))for(const drawing of sequence.drawings)
 if(drawing.pose==='ready')drawing.pose='idleSashBase';
delete spec.poses.ready;
// Keep the three tall drawings on the same atlas shelf. Removing a drawing
// alone does not guarantee lower memory: source insertion order affects packing.
spec.poses=Object.fromEntries(['idleSashBase','cast','anticipation','melee','idleSash'].map(id=>[id,spec.poses[id]]));
spec.rigidAttachments=[{basePose:'idleSashBase',pose:'idleSash',pivot:[1125,1370],degrees:1.6,behind:false}];
spec.idleZones=[];
fs.writeFileSync(dir+'/idle-sash-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/idle-sash-review.json',JSON.stringify({status:'unaccepted-sash-study',sash,original:'docs/custom-anim/drafts/20261105-dixin/ready-clean.png',underpaint:'sash-underpaint-source.png',offset:[520,765],underpaintScope:'inside sash mask, y>=620, x<850, y<1050 and original alpha===255 only',pending:['root seam and overlap','underpaint color visible at maximum rotation','source sash includes neighboring embroidery','hair/torso and hit action still incomplete']},null,2)+'\n');
console.log(dir+'/idle-sash-spec.json');
