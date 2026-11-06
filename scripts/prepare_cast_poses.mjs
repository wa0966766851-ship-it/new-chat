import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {alignPose} from './lib/alignPose.mjs';
const entries=[
 {id:'wuxu_liuren',elfId:'5022',elfName:'無序.六刃',dir:'liuren',source:'wuxu_liuren_body.png',head:[362,205],floor:995,actionHead:[560,354],actionFloor:1490},
 {id:'wuxu_shiyan',elfId:'5023',elfName:'無序·蝕言',dir:'shiyan',source:'wuxu_shiyan_body.png',head:[320,136],floor:995,actionHead:[490,216],actionFloor:1572},
 {id:'emperor_dixin',elfId:'5017',elfName:'人皇·帝辛',dir:'dixin',source:'emperor_dixin_body.png',head:[480,128],floor:1515,actionHead:[494,145],actionFloor:1515},
];
const holds=(...items)=>items.map(([pose,hold])=>({pose,hold}));
for(const e of entries){
 const dir='docs/custom-anim/drafts/20261105-'+e.dir,aligned=path.join(dir,'aligned');fs.mkdirSync(aligned,{recursive:true});
 const cleanReady=path.join(dir,'ready-clean.png');
 const configs={ready:{file:fs.existsSync(cleanReady)?cleanReady:'public/elf-art/'+e.source,head:e.head,floor:e.floor},
  cast:{file:path.join(dir,'action-reviewed.png'),head:e.actionHead,floor:e.actionFloor}};
 // Anticipation art is reviewed separately and entered into alignment.json.
 const reviewFile=path.join(dir,'alignment.json');
 if(fs.existsSync(reviewFile))configs.anticipation=JSON.parse(fs.readFileSync(reviewFile,'utf8'));
 const poses={},canvas=[900,1100],floor=1040,bodyHeight=650;
 for(const [name,p] of Object.entries(configs)){
  const source=fs.readFileSync(p.file),s=bodyHeight/(p.floor-p.head[1]);
  const offset=[450-p.head[0]*s,floor-p.floor*s];
  const bytes=alignPose(source,{canvas,scale:s,offset});
  const file=path.join(aligned,name+'.png').replaceAll('\\','/');fs.writeFileSync(file,bytes);
  poses[name]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
   anchors:{muzzle:[450,440]},review:{accepted:true,note:name==='ready'&&!fs.existsSync(cleanReady)?'保留原始立繪；只作整張等比縮放與留白。':'目視核對完整姿勢，頭腳不裁切；需實播驗收銜接與方向。'}};
 }
 const anticipation=poses.anticipation?'anticipation':'ready';
 const seq=(windup,hold,finish,hit=true)=>({drawings:holds(['ready',3],[anticipation,windup],['cast',hold],[anticipation,4],['ready',finish]),
  hits:hit?[3+windup+4]:[],events:hit?{launch:3+windup,recover:3+windup+hold}: {}});
 const spec={id:e.id,elfId:e.elfId,elfName:e.elfName,fps:24,facing:'left',canvas,anchor:[450,floor],margin:8,pixelsPerUnit:100,poses,
  sequences:{standby:{loop:true,drawings:holds(['ready',24])},attack:seq(3,12,6),sa:seq(5,15,7),
   ultimate:seq(7,20,8),cp:seq(5,12,6,false),extra:seq(6,e.dir==='shiyan'?22:12,8,false),hited:{drawings:holds(['ready',8])}}};
 fs.writeFileSync(path.join(dir,'poses.json'),JSON.stringify(spec,null,2)+'\n');
 console.log(e.id+': '+Object.keys(poses).length+' whole drawings, 650px body, no per-frame translation.');
}
