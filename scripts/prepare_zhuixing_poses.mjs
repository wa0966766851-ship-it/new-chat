// Pack reviewed whole drawings onto one fixed canvas. No cut-up limbs, warping,
// body translation or automatic per-pose fitting. The original static art stays intact.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
const dir='docs/custom-anim/drafts/20261105-upward-aim';
const output=path.join(dir,'aligned');fs.mkdirSync(output,{recursive:true});
const canvas=[736,864],scale=.6,offset=[18,24];
const drawings={
 ready:{file:'ready-generated.png',muzzle:[182,354],note:'完整備戰姿勢，兩手持砲；足部未裁切。'},
 raise:{file:'raise-generated.png',muzzle:[244,218],note:'中途抬砲，手臂與武器一體重繪；無拆件。'},
 aim:{file:'upward-aim-generated-draft.png',muzzle:[274,171],note:'向上瞄準，砲身未穿過面部，完整頭部與雙足。'},
 recoil:{file:'recoil-generated.png',muzzle:[306,207],note:'彎肘承受後座力；雙腳位置與備戰大致一致，須以實播再驗收。'},
};
const poses={};
for(const [id,d] of Object.entries(drawings)){
 const input=PNG.sync.read(fs.readFileSync(path.join(dir,d.file)));
 if(input.width!==1168||input.height!==1346)throw Error('Unexpected generated canvas: '+id);
 const result=new PNG({width:canvas[0],height:canvas[1]});
 // Alpha-aware bilinear resampling prevents dark fringes on transparent edges.
 for(let y=0;y<Math.round(input.height*scale);y++)for(let x=0;x<Math.round(input.width*scale);x++){
  const sx=Math.min(input.width-1,Math.max(0,(x+.5)/scale-.5)),sy=Math.min(input.height-1,Math.max(0,(y+.5)/scale-.5));
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;let alpha=0,rgb=[0,0,0];
  for(let j=0;j<2;j++)for(let k=0;k<2;k++){
   const i=(Math.min(iy+j,input.height-1)*input.width+Math.min(ix+k,input.width-1))*4;
   const w=(j?fy:1-fy)*(k?fx:1-fx),a=input.data[i+3]/255;alpha+=a*w;
   for(let c=0;c<3;c++)rgb[c]+=input.data[i+c]*a*w;
  }
  const o=((y+offset[1])*result.width+x+offset[0])*4;
  for(let c=0;c<3;c++)result.data[o+c]=alpha?Math.round(rgb[c]/alpha):0;
  result.data[o+3]=Math.round(alpha*255);
 }
 const bytes=PNG.sync.write(result),file=path.join(output,id+'.png').replaceAll('\\','/');fs.writeFileSync(file,bytes);
 poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  anchors:{muzzle:d.muzzle.map((n,i)=>n*scale+offset[i])},review:{accepted:true,note:d.note}};
}
const holds=(...items)=>items.map(([pose,hold])=>({pose,hold}));
const spec={id:'wuxu_zhuixing',elfId:'5026',elfName:'無序.墜星',facing:'left',fps:24,canvas,
 anchor:[550,816],margin:8,pixelsPerUnit:100,poses,
 sequences:{
  standby:{loop:true,drawings:holds(['ready',24])},
  attack:{drawings:holds(['ready',3],['raise',3],['aim',7],['recoil',3],['aim',12],['raise',3],['ready',5]),hits:[23],events:{launch:13,recover:28}},
  sa:{drawings:holds(['ready',4],['raise',4],['aim',15],['recoil',4],['aim',14],['raise',4],['ready',7]),hits:[34],events:{launch:23,recover:41}},
  ultimate:{drawings:holds(['ready',4],['raise',5],['aim',23],['recoil',5],['aim',19],['raise',5],['ready',7]),hits:[47],events:{launch:32,recover:56}},
  cp:{drawings:holds(['ready',36])},extra:{drawings:holds(['ready',32])},hited:{drawings:holds(['ready',8])},
 }};
fs.writeFileSync(path.join(dir,'poses.json'),JSON.stringify(spec,null,2)+'\n');
console.log('Prepared '+Object.keys(poses).length+' reviewed whole drawings on '+canvas.join(' × '));
