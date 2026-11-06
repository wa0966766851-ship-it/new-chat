// Original-pixel torso hinge study. Separate spec; never overwrite the art.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/liuren-weapon-pilot';
const spec=JSON.parse(fs.readFileSync(dir+'/spec.json','utf8'));
const source=PNG.sync.read(fs.readFileSync(dir+'/body-protected-original.png'));
const torso=[[281,197],[394,193],[415,270],[454,299],[480,342],[489,405],[472,453],[467,496],[405,512],[280,500],[235,453],[217,415],[210,381],[235,310],[275,278]];
const cover=[[254,475],[343,463],[429,470],[477,483],[476,529],[391,538],[273,525],[247,507]];
const inside=(x,y,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
}return hit;};
const base=PNG.sync.read(PNG.sync.write(source)),upper=new PNG({width:source.width,height:source.height});
for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
 if(!inside(x,y,torso))continue;const p=(y*source.width+x)*4;
 source.data.copy(upper.data,p,p,p+4);
 if(!inside(x,y,cover))base.data.fill(0,p,p+4);
}
const flip=p=>{const out=new PNG({width:p.width,height:p.height});for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
 const at=(y*p.width+x)*4,from=(y*p.width+p.width-1-x)*4;p.data.copy(out.data,at,from,from+4);
}return PNG.sync.write(out);};
for(const [id,p] of [['idleBase',base],['idleTorso',upper]]){
 const bytes=alignPose(flip(p),{canvas:spec.canvas,scale:1,offset:[381,525]}),file=dir+'/'+id+'.png';fs.writeFileSync(file,bytes);
 spec.poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',review:{accepted:true,note:'僅原像素腰部鉸接試播，腰帶覆蓋接縫；須檢查肩側與腰部有無露洞，尚未通過美術驗收。'}};
}
spec.sequences.standby.drawings=[{pose:'idleBase',hold:96}];
spec.rigidAttachments=[{basePose:'idleBase',pose:'idleTorso',pivot:[381+681-350,525+480],degrees:1.8,behind:true}];
spec.idleZones=[];
fs.writeFileSync(dir+'/idle-rig-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/idle-rig-review.json',JSON.stringify({status:'unaccepted-joint-study',source:'body-protected-original.png',torso,cover,pivotNative:[350,480],degrees:1.8,notes:['Original pixels copied without resampling before alignment','No per-pixel warping or body-wide translation','Belt stays in front of torso','Shoulder edge and waist gap require close-up dark/light inspection','Action drawings unchanged']},null,2)+'\n');
console.log(dir+'/idle-rig-spec.json');
