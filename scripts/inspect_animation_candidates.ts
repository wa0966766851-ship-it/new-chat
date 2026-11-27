import fs from 'node:fs';
import path from 'node:path';
import {parseBundleCore,loadMaterialBundle} from '@seer-pet-anim/swf-bundle/parse';
import {MaterialResolver} from '@seer-pet-anim/swf-bundle';
import {PET_MATERIAL_BUNDLE} from '../src/battle/petAnimationAssets';
const file='docs/audits/2026-11-26-animation-candidates.json';
const rows=JSON.parse(fs.readFileSync(file,'utf8'));
const root=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const mat=fs.readFileSync(path.join(root,PET_MATERIAL_BUNDLE.hash.slice(0,2),PET_MATERIAL_BUNDLE.hash,'__data'));
const resolver=new MaterialResolver();await loadMaterialBundle(mat.buffer.slice(mat.byteOffset,mat.byteOffset+mat.byteLength),resolver);
for(const row of rows){
 const clip=await parseBundleCore(fs.readFileSync(row.localFile),`${row.id}.pet`,resolver,{needAtlas:false});
 row.parsed={clip:`${row.id}.pet`,fps:clip.frameRate,atlas:[clip.atlasWidth,clip.atlasHeight],sequences:clip.sequences.map(s=>({name:s.name,frames:s.frames.length,hits:s.frames.flatMap((f,i)=>f.labels.includes('action_hit')?[i]:[])}))};
 console.log(JSON.stringify({id:row.id,...row.parsed}));
}
fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');
