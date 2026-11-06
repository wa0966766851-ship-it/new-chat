// Hit guard study: retain original grounded lower body instead of trusting generated foot placement.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {alignPose} from './lib/alignPose.mjs';
const dir='docs/custom-anim/drafts/20261106-original-motion/wuxu_shiyan';
const spec=JSON.parse(fs.readFileSync(dir+'/idle-rig-spec.json','utf8'));
const original=PNG.sync.read(fs.readFileSync('public/elf-art/wuxu_shiyan_body.png'));
const belt=[[245,447],[315,443],[374,458],[398,485],[385,520],[256,523],[235,486]];
// Restrict repainting to the changed gesture. Keep the original ghost as its own layer.
const humanMasks={
 hurtGuard:[[320,158],[365,160],[394,181],[409,213],[412,246],[409,267],[436,278],[452,308],[460,355],[456,405],[439,438],[415,460],[388,480],[245,480],[219,457],[201,430],[193,389],[204,347],[225,321],[232,286],[257,267],[280,245],[294,210]],
 hurtRecover:[[320,155],[365,157],[391,178],[404,211],[407,246],[402,265],[433,277],[452,311],[460,354],[457,405],[444,444],[417,469],[390,483],[239,483],[218,460],[207,428],[211,393],[218,350],[233,312],[256,280],[287,252],[298,207]]
};
const inside=(x,y,p)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const [a,b]=p[i],[c,d]=p[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
}return hit;};
function importUpper(id,source,scale,offset){
const upper=PNG.sync.read(alignPose(fs.readFileSync(source),{canvas:[633,1000],scale,offset}));
// Generated upper-body pose is registered at the belt; original lower pixels and boots remain fixed.
for(let y=0;y<1000;y++)for(let x=0;x<633;x++){
 const at=(y*633+x)*4;
 if(y>=492||inside(x,y,belt)){original.data.copy(upper.data,at,at,at+4);continue;}
 if(!inside(x,y,humanMasks[id])){upper.data.fill(0,at,at+4);continue;}
 if(y<472)continue;
 const a=upper.data[at+3]/255*(492-y)/20,b=original.data[at+3]/255;
 const out=b+a*(1-b);
 for(let c=0;c<3;c++)upper.data[at+c]=out?Math.round((original.data[at+c]*b+upper.data[at+c]*a*(1-b))/out):0;
 upper.data[at+3]=Math.round(out*255);
}
const bytes=alignPose(PNG.sync.write(upper),{canvas:spec.canvas,scale:1,offset:[280,425]});
const file=dir+'/'+id+'.png';fs.writeFileSync(file,bytes);
spec.poses[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),facing:'left',review:{accepted:true,note:'僅受擊試播：書護胸、上身退縮。生成上半身在腰帶對位；原圖下身不變。腰部、頭高、幽魂與恢復銜接待驗收。'}};
}
const source=dir+'/hurt-guard-source.png';
importUpper('hurtGuard',source,.633,[-39,27]);
const recovery=dir+'/hurt-recover-source.png';
if(fs.existsSync(recovery))importUpper('hurtRecover',recovery,.633,[-39,27]);
for(const basePose of ['hurtGuard','hurtRecover'])if(spec.poses[basePose])
 spec.rigidAttachments.push({basePose,pose:'idleGhost',pivot:[590,800],degrees:0,behind:true});
spec.sequences.hited={drawings:[{pose:'hurtGuard',hold:5},...(spec.poses.hurtRecover?[{pose:'hurtRecover',hold:4}]:[]),{pose:'idleLower',hold:3}],hits:[],events:{recover:5}};
// Ready endpoints use the same original-pixel layers as neutral idle. Do not replace action key poses.
for(const [name,seq] of Object.entries(spec.sequences))if(name!=='standby'&&name!=='hited')
 for(const item of seq.drawings)if(item.pose==='ready')item.pose='idleLower';
fs.writeFileSync(dir+'/hurt-rig-spec.json',JSON.stringify(spec,null,2)+'\n');
fs.writeFileSync(dir+'/hurt-guard-review.json',JSON.stringify({status:'unaccepted-hit-guard-pilot',source,scale:.633,offset:[-39,27],humanMasks,beltCover:belt,ghost:'original idleGhost layer; generated ghost discarded',originalLowerFrom:492,transitionBand:[472,492],pending:['generated face identity and hair edge','belt/ghost join','both sides impact and recovery'],note:'Do not use the generated full drawing as a replacement for the original idle.'},null,2)+'\n');
console.log(dir+'/hurt-rig-spec.json');
