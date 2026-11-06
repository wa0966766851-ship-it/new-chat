// Isolated original-pixel idle study. Never changes the public artwork or action poses.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/wuxu_shiyan';
const spec=JSON.parse(fs.readFileSync(dir+'/../wuxu_shiyan.json','utf8'));
const original=PNG.sync.read(fs.readFileSync('public/elf-art/wuxu_shiyan_body.png'));
const human=[[270,125],[310,123],[340,136],[354,160],[358,203],[359,237],[382,258],[402,270],[410,300],[420,329],[430,354],[449,389],[455,417],[446,438],[428,450],[419,482],[200,482],[168,471],[126,475],[98,460],[80,440],[75,417],[66,400],[50,326],[90,321],[194,328],[208,292],[212,270],[237,250],[248,231],[235,210],[238,177],[250,145]];
const inside=(x,y,p)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const [a,b]=p[i],[c,d]=p[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
}return hit;};
const ghost=PNG.sync.read(alignPose(fs.readFileSync(dir+'/ghost-underpaint-source.png'),{canvas:[633,1000],scale:.633,offset:[8,-3]}));
const lower=new PNG({width:633,height:1000}),upper=new PNG({width:633,height:1000});
for(let y=0;y<1000;y++)for(let x=0;x<633;x++){
 const at=(y*633+x)*4,person=y>=480||inside(x,y,human);
 if(person){
  if(y>=472)original.data.copy(lower.data,at,at,at+4);
  if(y<492)original.data.copy(upper.data,at,at,at+4);
 }else original.data.copy(ghost.data,at,at,at+4);
 // Generated colour only fills hidden space; preserve the original visible ghost pixels.
 if(y>560)ghost.data.fill(0,at,at+4);
}
for(const [id,png] of [['idleLower',lower],['idleUpper',upper],['idleGhost',ghost]]){
 const bytes=alignPose(PNG.sync.write(png),{canvas:spec.canvas,scale:1,offset:[280,425]});
 const file=dir+'/'+id+'.png';fs.writeFileSync(file,bytes);
 spec.poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',review:{accepted:true,note:'僅允許獨立接縫研究；原人物像素保留，幽魂遮擋補底為生成素材。尚未通過美術驗收。'}};
}
spec.sequences.standby.drawings=[{pose:'idleLower',hold:120}];
spec.rigidAttachments=[
 {basePose:'idleLower',pose:'idleGhost',pivot:[590,800],degrees:2.4,dx:5,dy:-5,delay:.5,behind:true},
 {basePose:'idleLower',pose:'idleUpper',pivot:[590,905],degrees:1.15,dy:-2,behind:false}
];
spec.idleZones=[];
fs.writeFileSync(dir+'/idle-rig-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/idle-rig-review.json',JSON.stringify({status:'unaccepted-original-pixel-layer-study',humanMask:human,overlap:[472,492],notes:['Original human RGB/alpha copied without repainting','Original visible ghost pixels retained; generated underpaint only in covered region','Torso hinge and ghost have independent phases; no UV displacement','Must inspect hair, shoulder, book and belt boundaries on dark/light backgrounds','Does not replace current draft or public assets']},null,2)+'\n');
console.log(dir+'/idle-rig-spec.json');
