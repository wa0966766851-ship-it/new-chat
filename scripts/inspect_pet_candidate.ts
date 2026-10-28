/** 只讀指定素材包的片段與圖集資料；不自動核准方向或登記精靈。 */
import fs from 'node:fs';
import path from 'node:path';
import {parseBundleCore,loadMaterialBundle} from '@seer-pet-anim/swf-bundle/parse';
import {MaterialResolver} from '@seer-pet-anim/swf-bundle';
import {PET_MATERIAL_BUNDLE} from '../src/battle/petAnimationAssets';
const [file,clipName]=process.argv.slice(2);
if(!file||!clipName)throw Error('需要素材檔與 clip 名稱');
const root=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const resolver=new MaterialResolver(),hash=PET_MATERIAL_BUNDLE.hash;
const material=fs.readFileSync(path.join(root,hash.slice(0,2),hash,'__data'));
await loadMaterialBundle(material.buffer.slice(material.byteOffset,material.byteOffset+material.byteLength),resolver);
const clip=await parseBundleCore(fs.readFileSync(file),clipName,resolver,{needAtlas:false});
console.log(JSON.stringify({fps:clip.frameRate,atlas:[clip.atlasWidth,clip.atlasHeight],sequences:clip.sequences.map(s=>({name:s.name,frames:s.frames.length,hits:s.frames.flatMap((f,i)=>f.labels.includes('action_hit')?[i]:[])}))},null,2));
