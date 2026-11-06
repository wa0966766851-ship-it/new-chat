/** Reusable offline art import. All per-character measurements live in review configs. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {chromaSprite,removeGreenSpill} from './lib/chromaSprite.mjs';
import {alignPose} from './lib/alignPose.mjs';
const configFile=process.argv[2];if(!configFile)throw Error('Usage: node scripts/prepare_drawn_motion_v3.mjs <reviewed config> [--sheet-only]');
const c=JSON.parse(fs.readFileSync(configFile,'utf8'));
if(c.review?.accepted!==true||!c.review.note)throw Error('Missing visual source review');
const spec=JSON.parse(fs.readFileSync(c.baseSpec,'utf8')),dir=c.draft,out=`build/motion-v3-${spec.id}`;
fs.mkdirSync(out,{recursive:true});
const crop=(p,cols,rows,index)=>{
 const w=Math.floor(p.width/cols),h=Math.floor(p.height/rows),dst=new PNG({width:w,height:h});
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
  const s=((Math.floor(index/cols)*h+y)*p.width+(index%cols)*w+x)*4;p.data.copy(dst.data,(y*w+x)*4,s,s+4);
 }
 return PNG.sync.write(dst);
};
if(c.combinedSheet){
 const p=PNG.sync.read(fs.readFileSync(c.combinedSheet)),w=Math.floor(p.width/3),h=Math.floor(p.height/3),idle=new PNG({width:w*3,height:h*2});
 for(let y=0;y<h*2;y++)p.data.copy(idle.data,y*w*3*4,y*p.width*4,(y*p.width+w*3)*4);
 fs.writeFileSync(`${dir}/idle-clean-source.png`,PNG.sync.write(idle));
}
if(process.argv.includes('--sheet-only')){console.log(`${dir}/idle-clean-source.png`);process.exit(0);}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),canvas=spec.canvas.map(v=>v/2);
for(const [name,pose] of Object.entries(spec.poses)){
 const bytes=alignPose(fs.readFileSync(pose.file),{canvas,scale:.5,offset:[0,0]}),file=`${out}/${name}.png`;
 fs.writeFileSync(file,bytes);pose.file=file;pose.sha256=hash(bytes);
 if(pose.anchors)pose.anchors=Object.fromEntries(Object.entries(pose.anchors).map(([k,p])=>[k,p.map(v=>v/2)]));
}
const drawing=(id,bytes,note,anchors)=>{
 if(c.matte?.despill)bytes=removeGreenSpill(bytes);
 const file=`${out}/${id}.png`;fs.writeFileSync(file,bytes);
 spec.poses[id]={file,sha256:hash(bytes),facing:spec.facing,anchors,review:{accepted:true,note}};
};
const hit=PNG.sync.read(fs.readFileSync(c.hitSheet??c.combinedSheet));
for(const [i,name] of ['impact','recoil','recover'].entries()){
 const raw=crop(hit,c.combinedSheet?3:2,c.combinedSheet?3:2,c.combinedSheet?6+i:1+i);
 drawing(`hit_${name}`,alignPose(chromaSprite(raw,{hardKey:true,...c.matte}),{canvas,...c.hitAlignment}),c.review.note,{});
}
const frames=[];
for(let i=0;i<47;i++){
 const raw=fs.readFileSync(`build/custom-idle-flow-${spec.id}/frames/${String(i).padStart(2,'0')}.png`),id=`idle_${i}`;
 drawing(id,alignPose(raw,{canvas,...c.idleAlignment}),c.review.note,{muzzle:c.idleMuzzle});frames.push({pose:id,hold:2});
}
frames.push({pose:'idle_0',hold:2});spec.poses.ready=structuredClone(spec.poses.idle_0);
spec.canvas=canvas;spec.anchor=spec.anchor.map(v=>v/2);spec.pixelsPerUnit/=2;spec.margin=4;delete spec.idleZones;
spec.sequences.standby={loop:true,drawings:frames,hits:[]};
spec.sequences.hited={drawings:[{pose:'hit_impact',hold:2},{pose:'hit_recoil',hold:2},{pose:'hit_recover',hold:2},{pose:'ready',hold:2}],hits:[]};
fs.writeFileSync(`${out}/${spec.id}.json`,JSON.stringify(spec,null,2)+'\n');
console.log(`${out}/${spec.id}.json`);
