/** Weapon-layer study only. Does not publish or overwrite the source drawing. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const root='docs/custom-anim/drafts/20261106-original-motion',dir=root+'/liuren-weapon-pilot';
fs.mkdirSync(dir,{recursive:true});
const generated=path.resolve('C:/Users/lazya/.codex/generated_images/01a1652d-6534-7c73-a337-a86be71d710f/exec-f03740b4-ed7a-4d3e-bd99-572cf9c3d599.png');
const underFile=dir+'/body-underpainting-source.png';
if(!fs.existsSync(underFile))fs.copyFileSync(generated,underFile);
const sourceFile='public/elf-art/wuxu_liuren_body.png',source=PNG.sync.read(fs.readFileSync(sourceFile));
const under=PNG.sync.read(alignPose(fs.readFileSync(underFile),{canvas:[682,1000],scale:682/1024,offset:[0,-2]}));
// Keep the original hood, eyes, arms, armor, central cloth and legs verbatim.
// The cape behind the weapons is reconstructed as a continuous layer. An
// earlier top-half replacement produced a hard horizontal seam and was rejected.
// This is NOT an accepted matte or a claim of pixel-identical original cloth.
const protectedCore=[[294,196],[390,192],[413,264],[450,300],[476,347],[488,400],[470,440],[476,535],[498,660],[480,835],[464,960],[405,984],[352,880],[322,988],[251,1000],[219,966],[242,823],[224,664],[239,524],[223,426],[208,389],[234,307],[276,276]];
const inside=(x,y)=>{let yes=false;for(let i=0,j=protectedCore.length-1;i<protectedCore.length;j=i++){
 const [ax,ay]=protectedCore[i],[bx,by]=protectedCore[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)yes=!yes;
}return yes;};
const body=new PNG({width:682,height:1000});let originalPixels=0,reconstructedPixels=0;
for(let y=0;y<1000;y++)for(let x=0;x<682;x++){
 const at=(y*682+x)*4;
 if(inside(x,y)&&!(y<310&&x>405)){
  // The original cutout has transparent missing cloth inside this mask.
  // Protect its existing pixels, not its holes; confine repair to empty pixels.
  if(source.data[at+3]<8&&under.data[at+3]>16){under.data.copy(body.data,at,at,at+4);reconstructedPixels++;}
  else {source.data.copy(body.data,at,at,at+4);if(source.data[at+3])originalPixels++;}
 }
 else if(under.data[at+3]){under.data.copy(body.data,at,at,at+4);reconstructedPixels++;}
}
const bodyFile=dir+'/body-protected-original.png';fs.writeFileSync(bodyFile,PNG.sync.write(body));
const flip=p=>{const out=new PNG({width:p.width,height:p.height});for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
 const at=(y*p.width+x)*4,from=(y*p.width+p.width-1-x)*4;p.data.copy(out.data,at,from,from+4);
}return PNG.sync.write(out);};
const canvas=[1400,1600],anchor=[700,1520],offset=[381,525];
const aligned=alignPose(flip(body),{canvas,scale:1,offset});
const file=dir+'/ready.png';fs.writeFileSync(file,aligned);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const swordFile=root+'/liuren-sword-source.png',sword=PNG.sync.read(fs.readFileSync(swordFile));
let l=sword.width,t=sword.height,r=0,b=0;
for(let y=0;y<sword.height;y++)for(let x=0;x<sword.width;x++)if(sword.data[(y*sword.width+x)*4+3]>16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
const cropped=new PNG({width:r-l+1,height:b-t+1});
for(let y=0;y<cropped.height;y++)sword.data.copy(cropped.data,y*cropped.width*4,((t+y)*sword.width+l)*4,((t+y)*sword.width+r+1)*4);
const weapon=PNG.sync.write(cropped),weaponFile=dir+'/sword.png';fs.writeFileSync(weaponFile,weapon);
const base=JSON.parse(fs.readFileSync(root+'/wuxu_liuren.json','utf8'));
const poses={ready:{file,sha256:hash(aligned),facing:'left',review:{accepted:true,note:'僅允許六劍分層試播；人物原像素保護，背劍底圖仍待美術驗收。'}}};
const actionSources={command:'exec-413d39c9-2887-452d-891a-970f2719ca88.png',gather:'exec-05a6a5ec-a96f-4247-a958-88b4c43bdabb.png'};
for(const [id,name] of Object.entries(actionSources)){
 const sourceFile=dir+'/'+id+'-source.png';
 if(!fs.existsSync(sourceFile))fs.copyFileSync(path.join(path.dirname(generated),name),sourceFile);
 const candidate=PNG.sync.read(alignPose(fs.readFileSync(sourceFile),{canvas:[682,1000],scale:682/1024,offset:[0,-2]}));
 const drawing=PNG.sync.read(PNG.sync.write(body));
 // Replace the two-arm gesture only. Original hood/eyes, planted legs and
 // shared reconstructed cape remain identical across the three key drawings.
 for(let y=280;y<570;y++)for(let x=0;x<682;x++){
  const at=(y*682+x)*4;if(x<195||x>660)continue;
  const f=Math.min(1,(y-280)/10,(570-y)/12),aa=body.data[at+3]/255,ba=candidate.data[at+3]/255;
  const a=aa*(1-f)+ba*f;
  for(let c=0;c<3;c++)drawing.data[at+c]=a?Math.round((body.data[at+c]*aa*(1-f)+candidate.data[at+c]*ba*f)/a):0;
  drawing.data[at+3]=Math.round(a*255);
 }
 const bytes=alignPose(flip(drawing),{canvas,scale:1,offset}),dest=dir+'/'+id+'.png';fs.writeFileSync(dest,bytes);
 poses[id]={file:dest,sha256:hash(bytes),facing:'left',review:{accepted:true,note:'雙手不同發令關鍵姿勢；不是完整中間幀，肘肩與換姿銜接仍待實播。'}};
}
const meleeSources=[{id:'windup',name:'exec-9c301662-4200-4446-a596-92fdf829c70b.png',floor:1003,footCenter:810,tip:[160,23]},
 {id:'cut',name:'exec-22d60700-d2b6-48ab-94aa-d6acffd36c17.png',floor:1013,footCenter:765,tip:[1518,10]},
 {id:'melee',name:'exec-2ef8d21a-559d-4eff-98ca-7c4fe651056b.png',floor:865,footCenter:800,tip:[1760,215]}];
for(const item of meleeSources){
 const src=dir+'/'+item.id+'-source.png';if(!fs.existsSync(src))fs.copyFileSync(path.join(path.dirname(generated),item.name),src);
 const p=PNG.sync.read(fs.readFileSync(src)),scale=.64,at=[anchor[0]-(p.width-1-item.footCenter)*scale,anchor[1]-item.floor*scale];
 const bytes=alignPose(flip(p),{canvas,scale,offset:at}),dest=dir+'/'+item.id+'.png';fs.writeFileSync(dest,bytes);
 poses[item.id]={file:dest,sha256:hash(bytes),facing:'left',anchors:{muzzle:[(p.width-1-item.tip[0])*scale+at[0],item.tip[1]*scale+at[1]]},review:{accepted:true,note:'僅近身物攻試播：人物雙手握一劍，無背劍；頭甲大小與跨姿勢銜接仍待對戰驗收。'}};
}
const hurtSource=dir+'/hurt-source.png',hurt=PNG.sync.read(fs.readFileSync(hurtSource));
const hurtScale=.69,hurtBytes=alignPose(flip(hurt),{canvas,scale:hurtScale,offset:[anchor[0]-(hurt.width-1-590)*hurtScale,anchor[1]-1500*hurtScale]});
const hurtFile=dir+'/hurt.png';fs.writeFileSync(hurtFile,hurtBytes);
poses.hurt={file:hurtFile,sha256:hash(hurtBytes),facing:'left',review:{accepted:true,note:'僅受擊試播：交叉前臂抬起護面、膝部屈曲；腳位與恢復銜接待兩側驗收。'}};
const spec={...base,canvas,anchor,poses,
 physicalMotion:'approach',presentation:{...base.presentation,ambient:false,meleeSequences:['attack','ultimate'],weaponVolley:{sprite:'/__animation-drafts/wuxu_liuren/sword.png',impact:{sprite:'/__animation-drafts/wuxu_liuren/standard-impact-green.png',cols:5,rows:4,frames:17},held:{sequences:['attack','ultimate'],from:8,until:54}}},
 sequences:Object.fromEntries(Object.entries(base.sequences).map(([name,v])=>[name,{...v,drawings:['attack','sa','ultimate'].includes(name)?[{pose:'ready',hold:12},{pose:'gather',hold:8},{pose:'command',hold:24},{pose:'gather',hold:8},{pose:'ready',hold:12}]:[{pose:'ready',hold:name==='standby'?96:name==='hited'?12:48}],hits:['attack','sa','ultimate'].includes(name)?[32]:[],events:['attack','sa','ultimate'].includes(name)?{launch:18,recover:48}:{}}]))};
for(const name of ['attack','ultimate'])spec.sequences[name].drawings=[{pose:'ready',hold:8},{pose:'windup',hold:12},{pose:'cut',hold:6},{pose:'melee',hold:10},{pose:'cut',hold:4},{pose:'windup',hold:14},{pose:'ready',hold:10}];
spec.sequences.hited.drawings=[{pose:'hurt',hold:7},{pose:'ready',hold:5}];
fs.writeFileSync(dir+'/spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/source-review.json',JSON.stringify({status:'weapon-choreography-pilot-not-accepted',source:sourceFile,sha256:hash(fs.readFileSync(sourceFile)),underpainting:underFile,underpaintingSha256:hash(fs.readFileSync(underFile)),protectedCore,originalPixels,reconstructedPixels,
 sword:{file:swordFile,sha256:hash(fs.readFileSync(swordFile)),crop:[l,t,r-l+1,b-t+1],output:weaponFile,downloadBytes:weapon.length,decodedBytes:cropped.width*cropped.height*4},
 pending:['原背劍與鏈條殘留、披風補圖邊緣需放大檢查','六劍取還劍銜接仍需補圖','P1/P2揮砍與受擊已試播回位，但披風輪廓切換仍有跳變','自然局部待機仍為獨立未驗收研究','這不是四隻動畫完成版']},null,2)+'\n');
const draft='build/original-motion-v4/wuxu_liuren';fs.mkdirSync(draft,{recursive:true});fs.writeFileSync(draft+'/sword.png',weapon);
console.log({spec:dir+'/spec.json',originalPixels,reconstructedPixels,swordSize:[cropped.width,cropped.height],weaponBytes:weapon.length});
