/** Geometry envelope from verified local bundles, not a claim about drawn pixels. */
import fs from 'node:fs';
import path from 'node:path';
import {parseBundleCore,loadMaterialBundle} from '@seer-pet-anim/swf-bundle/parse';
import {MaterialResolver} from '@seer-pet-anim/swf-bundle';
import {PET_ANIMATION_ASSETS,PET_MATERIAL_BUNDLE} from '../src/battle/petAnimationAssets';
const root=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const read=(hash:string)=>{
 const candidates=[path.join(root,hash.slice(0,2),hash,'__data'),path.join('.seer-cache/pet-anim',hash+'.bundle'),path.join('.seer-cache/pet-animations',hash)];
 const file=candidates.find(p=>fs.existsSync(p));if(!file)throw Error('Missing verified local bundle '+hash);return fs.readFileSync(file);
};
const resolver=new MaterialResolver(),mat=read(PET_MATERIAL_BUNDLE.hash);
await loadMaterialBundle(mat.buffer.slice(mat.byteOffset,mat.byteOffset+mat.byteLength),resolver);
const results=[];
for(const id of process.argv.slice(2)){
 const asset=PET_ANIMATION_ASSETS[id as keyof typeof PET_ANIMATION_ASSETS];if(!asset)throw Error(id);
 const clip=await parseBundleCore(read(asset.hash),asset.clip,resolver,{needAtlas:false});
 const seq=clip.sequences.find(s=>s.name==='standby');if(!seq)throw Error('Missing standby '+id);
 const bounds=seq.frames.map(f=>{
  const xs:number[]=[],ys:number[]=[];
  for(const s of f.mesh.subMeshes){
   if(!['normal','layer'].includes(s.material.blendMode)||s.material.shaderKind!=='simple')continue;
   // Bundled SWF geometry consists of four vertices per six-index quad.
   const end=(s.startVertex+s.indexCount/6*4)*2;
   for(let i=s.startVertex*2;i<end;i+=2){xs.push(f.mesh.positions[i]);ys.push(f.mesh.positions[i+1]);}
  }
  if(!xs.length)throw Error('No normal geometry '+id);
  return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
 });
 const range=(v:number[])=>Math.max(...v)-Math.min(...v);
 const medianHeight=bounds.map(b=>b.bottom-b.top).sort((a,b)=>a-b)[Math.floor(bounds.length/2)];
 const at420=(v:number[])=>range(v)/medianHeight*420;
 results.push({id,source:asset.clip,frames:seq.frames.length,seconds:seq.frames.length/clip.frameRate,
  normalizedToVisibleHeight:420,geometryEnvelopeTravelPx:{left:at420(bounds.map(b=>b.left)),right:at420(bounds.map(b=>b.right)),top:at420(bounds.map(b=>b.top)),bottom:at420(bounds.map(b=>b.bottom))},
  caveat:'Geometry envelope only: transparent texture padding and frame replacement can change this. Not a face/hair landmark measurement.',bounds});
}
const out='docs/custom-anim/review-20261106/native-idle-envelope.json';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({bounds,...rest})=>rest),null,2));
