/** Native-resolution imports. Drafts only; no gameplay or published assets. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const root='docs/custom-anim/drafts/20261106-original-motion';
const entries=[
 {id:'wuxu_liuren',dir:'liuren',source:'public/elf-art/wuxu_liuren_body.png',head:[362,205],floor:995,flip:true,canvas:[1100,1400],anchor:[550,1320],actionHead:[560,354],actionFloor:1490,
  pins:[[360,250,66,72],[380,375,160,84],[270,940,70,65],[420,890,70,75]],
  zones:[['breath',355,445,155,160,0,-10,0],['cloth',130,690,150,230,-33,8,.5],['cloth',575,680,125,210,30,-6,1.4],['cloth',280,700,110,180,15,6,2]],
  melee:{scale:650/880,offset:[450-450*650/880,1040-1290*650/880]}},
 {id:'wuxu_shiyan',dir:'shiyan',source:'public/elf-art/wuxu_shiyan_body.png',head:[320,136],floor:995,canvas:[1200,1500],anchor:[600,1420],actionHead:[490,216],actionFloor:1572,
  pins:[[305,205,66,90],[175,380,145,88],[340,402,130,62],[210,949,80,60],[393,949,70,60]],
  zones:[['breath',315,480,135,180,0,-10,0],['cloth',100,700,145,200,-35,9,.5],['cloth',505,740,160,215,38,8,1.3],['cloth',355,105,150,130,12,-19,2],['cloth',390,280,95,140,16,3,.7,2]]},
 {id:'emperor_dixin',dir:'dixin',source:'docs/custom-anim/drafts/20261105-dixin/ready-clean.png',original:'public/elf-art/emperor_dixin_body.png',head:[480,128],floor:1515,canvas:[2000,2400],anchor:[1000,2280],actionHead:[494,145],actionFloor:1515,
  pins:[[480,220,85,100],[510,90,110,100],[305,650,98,180],[180,1000,140,330],[850,420,120,105],[510,1450,170,100]],
  zones:[['breath',520,560,210,230,0,-16,0],['cloth',670,285,185,175,38,8,.5,2],['cloth',835,1090,205,290,60,14,.8],['cloth',280,1130,150,290,-40,12,1.8],['cloth',820,710,150,210,25,-8,1.3]],
  melee:{scale:.54,offset:[40,530]}},
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const e of entries){
 const base=JSON.parse(fs.readFileSync(`docs/custom-anim/drafts/20261105-combat-v2/${e.id}.json`,'utf8'));
 const dir=`${root}/${e.id}`;fs.mkdirSync(dir,{recursive:true});
 const originalBytes=fs.readFileSync(e.source),src=PNG.sync.read(originalBytes),ratio=(e.floor-e.head[1])/650;
 const nativeHeadX=e.flip?src.width-1-e.head[0]:e.head[0];
 const offset=[e.anchor[0]-nativeHeadX,e.anchor[1]-e.floor];
 const mirror=bytes=>{
  const p=PNG.sync.read(bytes),out=new PNG({width:p.width,height:p.height});
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)p.data.copy(out.data,(y*p.width+x)*4,(y*p.width+p.width-1-x)*4,(y*p.width+p.width-x)*4);
  return PNG.sync.write(out);
 };
 const poses={},sourceRecords=[];
 const importPose=(id,file,scale,at,flip=false)=>{
  const raw=fs.readFileSync(file),bytes=alignPose(flip?mirror(raw):raw,{canvas:e.canvas,scale,offset:at});
  const dest=`${dir}/${id}.png`;fs.writeFileSync(dest,bytes);
  poses[id]={file:dest,sha256:hash(bytes),facing:'left',anchors:{muzzle:[e.anchor[0],e.anchor[1]-600*ratio]},review:{accepted:true,note:'允許試播匯入；保留原始來源獨立高解析姿勢，不代表待機／銜接／美術已通過。'}};
  sourceRecords.push({pose:id,file,sha256:hash(raw),scale,offset:at,flip});
 };
 importPose('ready',e.source,1,offset,!!e.flip);
 const configs={cast:{file:`docs/custom-anim/drafts/20261105-${e.dir}/action-reviewed.png`,head:e.actionHead,floor:e.actionFloor},anticipation:JSON.parse(fs.readFileSync(`docs/custom-anim/drafts/20261105-${e.dir}/alignment.json`,'utf8'))};
 for(const [id,c] of Object.entries(configs)){
  const scale=(e.floor-e.head[1])/(c.floor-c.head[1]);
  importPose(id,c.file,scale,[e.anchor[0]-c.head[0]*scale,e.anchor[1]-c.floor*scale]);
 }
 if(e.melee){
  // The older melee placement used a 900x1100 canvas; translate its landmark
  // to the new shared floor/center, without changing the pose's scale.
  const shift=[e.anchor[0]-450*ratio,e.anchor[1]-1040*ratio];
  importPose('melee',`docs/custom-anim/drafts/20261105-combat-v2/${e.id}-melee-clean.png`,e.melee.scale*ratio,e.melee.offset.map((v,i)=>v*ratio+shift[i]));
 }
 const point=(x,y)=>[(e.flip?src.width-1-x:x)+offset[0],y+offset[1]];
 const region=([x,y,rx,ry])=>{const p=point(x,y);return{x:p[0]/e.canvas[0],y:p[1]/e.canvas[1],rx:rx/e.canvas[0],ry:ry/e.canvas[1]};};
 const spec={...base,canvas:e.canvas,anchor:e.anchor,pixelsPerUnit:100*ratio,poses,margin:8,idleGrid:[28,40],
  idlePins:e.pins.map(region),idleZones:[]};
 // The elliptic displacement pilot was rejected as watery/refraction-like.
 // Retain native-resolution drawings, but do not propagate that deformation.
 // Keep established attack timings while the original-art idle is evaluated.
 // hited remains pending; do not manufacture a completed hit sequence here.
 fs.writeFileSync(`${root}/${e.id}.json`,JSON.stringify(spec,null,2)+'\n');
 fs.writeFileSync(`${dir}/source-review.json`,JSON.stringify({status:'pilot-not-accepted',id:e.id,sourceSize:[src.width,src.height],sourceRecords,original:e.original??e.source,
  pending:['局部待機待改為材質對應的關節／分層，橢圓拉伸已撤除','兩側與三圈待機實播','原圖去背能量邊緣','待機到出招姿勢銜接','受擊仍是舊版佔位，未完成']},null,2)+'\n');
 console.log(e.id+': original standby imported at native scale; public unchanged.');
}
