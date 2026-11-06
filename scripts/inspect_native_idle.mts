/** Read-only comparison of actual native idle meshes. Does not alter assets. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseBundleCore,loadMaterialBundle} from '@seer-pet-anim/swf-bundle/parse';
import {MaterialResolver} from '@seer-pet-anim/swf-bundle';
import {PET_ANIMATION_ASSETS,PET_MATERIAL_BUNDLE} from '../src/battle/petAnimationAssets';
const root=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const read=(hash:string)=>{
 const candidates=[path.join(root,hash.slice(0,2),hash,'__data'),path.join('.seer-cache/pet-anim',hash+'.bundle'),path.join('.seer-cache/pet-animations',hash)];
 const p=candidates.find(p=>fs.existsSync(p));if(!p)throw Error('Missing local bundle '+hash);return fs.readFileSync(p);
};
const resolver=new MaterialResolver(),mat=read(PET_MATERIAL_BUNDLE.hash);
await loadMaterialBundle(mat.buffer.slice(mat.byteOffset,mat.byteOffset+mat.byteLength),resolver);
const hash=(v:ArrayLike<number>)=>crypto.createHash('sha256').update(JSON.stringify(Array.from(v))).digest('hex');
const results=[];
const args=process.argv.slice(2), sequenceArg=args.find(a=>a.startsWith('--sequences='));
const names=(sequenceArg?.slice('--sequences='.length)??'standby').split(',');
for(const id of args.filter(a=>!a.startsWith('--'))){
 const a=PET_ANIMATION_ASSETS[id as keyof typeof PET_ANIMATION_ASSETS];if(!a)throw Error(id);
 const clip=await parseBundleCore(read(a.hash),a.clip,resolver,{needAtlas:false});
 for(const sequence of names){
 const seq=clip.sequences.find(s=>s.name===sequence);if(!seq)throw Error(`${id}: missing ${sequence}`);
 const frames=seq.frames;
 const normal=frames.map(f=>f.mesh.subMeshes.filter(s=>['normal','layer'].includes(s.material.blendMode)&&s.material.shaderKind==='simple').map(s=>({
  p:Array.from(f.mesh.positions.slice(s.startVertex*2,(s.startVertex+s.indexCount/6*4)*2)),
  uv:Array.from(f.mesh.uvs.slice(s.startVertex*2,(s.startVertex+s.indexCount/6*4)*2))
 })));
 const result={id,sequence,clip:a.clip,fps:clip.frameRate,frames:frames.length,seconds:frames.length/clip.frameRate,atlas:[clip.atlasWidth,clip.atlasHeight],
  uniqueRenderedMeshStates:new Set(frames.map(f=>hash([...f.mesh.positions,...f.mesh.uvs,...f.mesh.mulColors,...f.mesh.addColors]))).size,
  uniqueNormalGeometry:new Set(normal.map(s=>JSON.stringify(s.map(x=>x.p)))).size,
  uniqueNormalUvLayout:new Set(normal.map(s=>JSON.stringify(s.map(x=>x.uv)))).size,
  normalDrawCallsRange:[Math.min(...normal.map(x=>x.length)),Math.max(...normal.map(x=>x.length))],
  note:'UV layout count is not the number of hand-drawn full-body images; transforms, reuse and part replacement can all change layout.'};
 results.push(result);console.log(JSON.stringify(result));
 }
}
fs.mkdirSync('docs/custom-anim/review-20261105',{recursive:true});
fs.writeFileSync('docs/custom-anim/review-20261105/'+(sequenceArg?'native-sequence-comparison.json':'native-idle-comparison.json'),JSON.stringify(results,null,2)+'\n');
