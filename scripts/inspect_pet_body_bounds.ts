/** 唯讀：比較待機整段聯集與逐幀身體，避免把擺動／透明圖塊當成本體尺寸。 */
import fs from 'node:fs';
import path from 'node:path';
import {parseBundleCore,loadMaterialBundle} from '@seer-pet-anim/swf-bundle/parse';
import {MaterialResolver} from '@seer-pet-anim/swf-bundle';
import {PET_ANIMATION_ASSETS,PET_MATERIAL_BUNDLE} from '../src/battle/petAnimationAssets';
import {bodyTiles,nativeBodyBounds} from '../src/battle/petAnimationGeometry';
const root=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const resolver=new MaterialResolver(),mh=PET_MATERIAL_BUNDLE.hash;
const material=fs.readFileSync(path.join(root,mh.slice(0,2),mh,'__data'));
await loadMaterialBundle(material.buffer.slice(material.byteOffset,material.byteOffset+material.byteLength),resolver);
for(const id of process.argv.slice(2)){
 const a=PET_ANIMATION_ASSETS[id as keyof typeof PET_ANIMATION_ASSETS];if(!a)throw Error(id);
 const local=path.join(root,a.hash.slice(0,2),a.hash,'__data');
 const fallback=path.join('.seer-cache/pet-animations',a.hash);
 const data=fs.readFileSync(fs.existsSync(local)?local:fallback);
 const clip=await parseBundleCore(data,a.clip,resolver,{needAtlas:false});
 const frames=clip.sequences.find(s=>s.name==='standby')!.frames;
 const tiles=bodyTiles(frames.map(f=>f.mesh));
 const boxes=frames.map(f=>nativeBodyBounds(f.mesh,tiles)!);
 const heights=boxes.map(b=>b.bottom-b.top).sort((a,b)=>a-b);
 const solid=frames.map(f=>{const m=f.mesh;const positions=m.subMeshes.filter(s=>['normal','layer'].includes(s.material.blendMode)&&s.material.shaderKind==='simple').flatMap(s=>Array.from(m.positions.slice(s.startVertex*2,(s.startVertex+s.indexCount/6*4)*2)));return nativeBodyBounds({positions,uvs:[]});}).filter(Boolean);
 console.log(JSON.stringify({id,frames:frames.length,min:heights[0],median:heights[Math.floor(heights.length/2)],max:heights.at(-1),union:Math.max(...boxes.map(b=>b.bottom))-Math.min(...boxes.map(b=>b.top)),solidUnion:solid.length?Math.max(...solid.map(b=>b!.bottom))-Math.min(...solid.map(b=>b!.top)):null,first:boxes[0],materials:[...new Set(frames.flatMap(f=>f.mesh.subMeshes.map(s=>s.material.blendMode+':'+s.material.shaderKind)))]}));
}
