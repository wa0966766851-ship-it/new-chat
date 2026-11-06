// High-resolution original-art pilot. No resampling of the authoritative idle.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const root='docs/custom-anim/drafts/20261106-original-motion';
fs.mkdirSync(root+'/aligned',{recursive:true});
const canvas=[1200,1600],offset=[57,76],poses={};
const input={
 ready:{file:'docs/custom-anim/drafts/20261105-zhuixing-original/original-color-matte-v3.png',muzzle:[172,210],note:'原圖 RGB 待機試作；保留原臉、服裝與完整光環。透明邊緣仍須深淺背景複驗。'},
 raise:{file:root+'/zhuixing-raise-source.png',muzzle:[149,224],note:'單張高解析中途抬砲；完整頭腳與持砲手。能量邊緣雜點與姿勢接續尚未驗收。'},
 aim:{file:root+'/zhuixing-aim-source.png',muzzle:[256,147],note:'單張高解析朝上瞄準；完整頭腳與砲身。能量邊緣雜點尚未驗收。'},
 hit:{file:root+'/zhuixing-hit-source.png',muzzle:[271,185],note:'單張高解析受擊後仰；雙手持砲。與待機的腳位、頭部風格接續尚未驗收。'},
};
for(const [id,d] of Object.entries(input)){
 const src=fs.readFileSync(d.file),png=PNG.sync.read(src);
 if(png.width!==1086||png.height!==1448)throw Error('Unexpected full-resolution source '+id);
 const bytes=alignPose(src,{canvas,scale:1,offset}),file=root+'/aligned/'+id+'.png';fs.writeFileSync(file,bytes);
 poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:{muzzle:d.muzzle.map((v,i)=>v+offset[i])},
  review:{accepted:true,note:'僅允許匯入試播，不代表動畫美術通過。'+d.note}};
}
// These props are separate floating objects in the source art. Partition their
// existing pixels; do not cut a limb or invent hidden body pixels.
const propShapes=[
 {id:'coatTail',polygon:[[751,716],[828,726],[985,772],[1085,794],[1085,1154],[988,1134],[950,1052],[879,997],[826,943],[803,885],[773,842],[752,786]],pivot:[761,748],dx:0,dy:0,degrees:3.5,delay:0},
 {id:'droneLeft',polygon:[[0,910],[0,690],[120,670],[280,610],[390,625],[390,690],[300,770],[210,860],[80,910]],pivot:[210,735],dx:8,dy:-27,degrees:1.4,delay:.8},
 {id:'droneRight',polygon:[[823,572],[928,535],[1042,550],[1085,590],[1085,688],[1003,684],[891,644]],pivot:[970,609],dx:-7,dy:23,degrees:-1.2,delay:2.2},
 {id:'upperBody',polygon:[[0,0],[1086,0],[1086,710],[0,710]],pivot:[577,690],dx:0,dy:0,degrees:1.25,delay:0,behind:true,anchors:['muzzle']},
];
// Keep the waist belt in front of the moving torso. This narrow opaque overlap
// hides the joint; it is not a soft displacement of the face, arms or cannon.
const beltCover=[[425,660],[510,640],[630,660],[714,700],[690,743],[578,708],[505,702],[455,732]];
const inside=(x,y,poly)=>{
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;
 }return yes;
};
const composite=PNG.sync.read(fs.readFileSync(poses.ready.file)),body=new PNG({width:canvas[0],height:canvas[1]});
composite.data.copy(body.data);
const repairFile=root+'/zhuixing-coat-underpainting-source.png';
const repair=PNG.sync.read(alignPose(fs.readFileSync(repairFile),{canvas,scale:1,offset}));
const propImages=propShapes.map(()=>new PNG({width:canvas[0],height:canvas[1]}));
for(let y=0;y<canvas[1];y++)for(let x=0;x<canvas[0];x++){
 const which=propShapes.findIndex(p=>inside(x-offset[0],y-offset[1],p.polygon));if(which<0)continue;
 const at=(y*canvas[0]+x)*4;composite.data.copy(propImages[which].data,at,at,at+4);body.data.fill(0,at,at+4);
 if(propShapes[which].id==='upperBody'&&composite.data[at+3]===255&&inside(x-offset[0],y-offset[1],beltCover))
  composite.data.copy(body.data,at,at,at+4);
 // Repair is strictly confined to the removed cloth, behind the untouched body.
 // Never use the generated face, arms, cannon or other visible redesigns.
 if(propShapes[which].id==='coatTail'&&composite.data[at+3]===255&&repair.data[at+3]>0)
  repair.data.copy(body.data,at,at,at+4);
}
const savePart=(id,png)=>{
 const bytes=PNG.sync.write(png),file=root+'/aligned/'+id+'.png';fs.writeFileSync(file,bytes);
 poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',anchors:poses[id]?.anchors??{},review:{accepted:true,note:'原圖分層試播。衣襬繞根部轉動，遮擋區限域補底；身體與金屬不拉伸。分層邊界仍需深淺底目視驗收。'}};
};
savePart('ready',body);propShapes.forEach((p,i)=>savePart(p.id,propImages[i]));
const hold=(...parts)=>parts.map(([pose,hold])=>({pose,hold}));
const base=JSON.parse(fs.readFileSync('docs/custom-anim/drafts/20261105-combat-v2/wuxu_zhuixing.json','utf8'));
const spec={...base,canvas,anchor:[870,1507],pixelsPerUnit:167,poses,margin:8,
 idleZones:[],
 rigidAttachments:propShapes.map(({id,pivot,dx,dy,degrees,delay,behind,anchors})=>({basePose:'ready',pose:id,pivot:pivot.map((v,i)=>v+offset[i]),dx,dy,degrees,delay,...(behind?{behind:true}:{}),...(anchors?{anchors}:{})})),
 sequences:{
  standby:{loop:true,drawings:hold(['ready',96]),hits:[]},
  attack:{drawings:hold(['ready',3],['raise',4],['aim',19],['raise',5],['ready',9]),hits:[23],events:{launch:12,recover:26}},
  sa:{drawings:hold(['ready',4],['raise',5],['aim',28],['raise',5],['ready',10]),hits:[34],events:{launch:23,recover:37}},
  ultimate:{drawings:hold(['ready',4],['raise',6],['aim',44],['raise',6],['ready',8]),hits:[47],events:{launch:32,recover:54}},
  cp:{drawings:hold(['ready',36]),hits:[]},extra:{drawings:hold(['ready',32]),hits:[]},
  hited:{drawings:hold(['hit',3],['raise',2],['ready',5]),hits:[]},
 },
};
fs.writeFileSync(root+'/wuxu_zhuixing.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(root+'/source-review.json',JSON.stringify({status:'pilot-not-accepted',canvas,scale:1,offset,
 sourceFiles:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,{file:v.file,sha256:crypto.createHash('sha256').update(fs.readFileSync(v.file)).digest('hex')}])),
 underpainting:{file:repairFile,sha256:crypto.createHash('sha256').update(fs.readFileSync(repairFile)).digest('hex'),usage:'Only hidden pixels within authored coatTail polygon; not a replacement body',generator:'builtin imagegen',source:'exec-5ec84537-be5e-4fe3-a5fd-6b8dd0130287'},
 partition:propShapes,
 beltCover,
 pending:['能量邊緣雜點','抬砲中間張不足','待機與受擊腳位一致性','對戰畫面三圈待機與兩側技能實播','其他三隻未完成']},null,2)+'\n');
console.log('Original-art pilot prepared; no public assets replaced.');
