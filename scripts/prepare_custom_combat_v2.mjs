import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {chromaSprite} from './lib/chromaSprite.mjs';
import {alignPose} from './lib/alignPose.mjs';

// Reviewed whole replacement drawings. Originals and v1 specifications retained.
const root='docs/custom-anim/drafts/20261105-combat-v2';fs.mkdirSync(root,{recursive:true});
const generated='C:/Users/lazya/.codex/generated_images/01a1652d-6534-7c73-a337-a86be71d710f/';
const explosion='exec-0c5a8137-cc93-4434-9b01-81129f399ecc.png';
fs.copyFileSync(generated+explosion,path.join(root,'orbital-explosion-source.png'));
fs.mkdirSync('public/elf-fx/custom-v2',{recursive:true});
fs.writeFileSync('public/elf-fx/custom-v2/orbital-explosion.png',chromaSprite(fs.readFileSync(generated+explosion),{hardKey:true}));
const input={
 emperor_dixin:{file:'exec-160911e8-1257-4856-bf9b-8f8892d1a6d3.png',scale:.54,offset:[40,530]},
 wuxu_liuren:{file:'exec-cbbf834c-f1eb-493b-a2ca-78101a55aace.png',scale:650/880,offset:[450-450*650/880,1040-1290*650/880]},
};
for(const [id,folder] of Object.entries({wuxu_zhuixing:'20261105-upward-aim',wuxu_liuren:'20261105-liuren',wuxu_shiyan:'20261105-shiyan',emperor_dixin:'20261105-dixin'})){
 const spec=JSON.parse(fs.readFileSync('docs/custom-anim/drafts/'+folder+'/poses.json','utf8'));
 // The original crossed-arm Liuren faces right. New action drawings face left.
 // Normalize that drawing once at import; never mirror the battle container.
 if(id==='wuxu_liuren'){
  const pose=spec.poses.ready,src=PNG.sync.read(fs.readFileSync(pose.file));
  const dst=new PNG({width:src.width,height:src.height});
  for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++)src.data.copy(dst.data,(y*src.width+x)*4,(y*src.width+src.width-1-x)*4,(y*src.width+src.width-x)*4);
  const bytes=PNG.sync.write(dst),file=path.join(root,'wuxu_liuren-ready-left.png').replaceAll('\\','/');fs.writeFileSync(file,bytes);
  pose.file=file;pose.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  pose.anchors=Object.fromEntries(Object.entries(pose.anchors??{}).map(([key,p])=>[key,[src.width-1-p[0],p[1]]]));
  pose.review={accepted:true,note:'使用者指出原抱胸待機朝右；匯入時整張鏡射為朝左，統一新出招方向，靜態原圖不改檔。'};
 }
 spec.sequences.standby={loop:true,drawings:[{pose:'ready',hold:96}],hits:[]};
 const gun=id==='wuxu_zhuixing';
 const styles={wuxu_zhuixing:{style:'railgun',trajectory:'orbital',color:'#38bdf8',secondary:'#d9f7ff',muzzle:[.22,.2],impactSheet:'/elf-fx/custom-v2/orbital-explosion.png'},
  wuxu_liuren:{style:'vortex',color:'#22c55e',secondary:'#b9ffc9',melee:true,contactDepth:.40},
  emperor_dixin:{style:'slash',color:'#f59e0b',secondary:'#fff1bd',melee:true,contactDepth:.40},
  wuxu_shiyan:{style:'sigil',color:'#a855f7',secondary:'#f0d9ff',focusExtra:true}};
 spec.presentation={...styles[id],ambient:true};spec.physicalMotion=input[id]?'approach':'stationary';
 spec.idleZones=gun?[
  {kind:'breath',x:.61,y:.48,rx:.12,ry:.13,dy:-1.6},
  {kind:'cloth',x:.76,y:.71,rx:.15,ry:.17,dx:2.8,dy:.5,delay:.4},
 ]:[
  {kind:'breath',x:.5,y:.50,rx:.12,ry:.11,dy:-1.8},
  {kind:'cloth',x:.30,y:.75,rx:.13,ry:.14,dx:3.2,dy:.6,delay:.5},
  {kind:'cloth',x:.71,y:.77,rx:.13,ry:.14,dx:-2.8,dy:.5,delay:1},
 ];
 if(input[id]){
  const source=fs.readFileSync(generated+input[id].file);fs.writeFileSync(path.join(root,id+'-melee-source.png'),source);
  const clean=chromaSprite(source,{hardKey:true});fs.writeFileSync(path.join(root,id+'-melee-clean.png'),clean);
  const bytes=alignPose(clean,{canvas:spec.canvas,scale:input[id].scale,offset:input[id].offset});
  const file=path.join(root,id+'-melee-aligned.png').replaceAll('\\','/');fs.writeFileSync(file,bytes);
  spec.poses.melee={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),anchors:{muzzle:id==='emperor_dixin'?[51,849]:[129,516]},review:{accepted:true,note:'完整近戰姿勢；持劍手、頭冠／面具、雙腳與武器完整，來源朝左；待對戰實播檢查接觸點。'}};
  spec.sequences.attack={drawings:[{pose:'ready',hold:3},{pose:'anticipation',hold:7},{pose:'melee',hold:10},{pose:'anticipation',hold:4},{pose:'ready',hold:8}],hits:[13],events:{launch:10,recover:20}};
 }
 if(id==='wuxu_shiyan')spec.sequences.extra={drawings:[{pose:'ready',hold:3},{pose:'anticipation',hold:6},{pose:'cast',hold:32},{pose:'anticipation',hold:4},{pose:'ready',hold:8}],hits:[],events:{}};
 for(const pose of Object.values(spec.poses))pose.facing=spec.facing;
 fs.writeFileSync(path.join(root,id+'.json'),JSON.stringify(spec,null,2)+'\n');
 console.log(id+' combat v2 spec prepared');
}
