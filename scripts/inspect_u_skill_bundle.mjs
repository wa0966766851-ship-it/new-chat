/** Read installed U-client metadata only; do not decode/copy the whole atlas. */
import fs from 'node:fs';
import path from 'node:path';
import {loadAssetBundle,AssetType} from '@arkntools/unity-js';
const cache=JSON.parse(fs.readFileSync('launcher/animation-source.local.json','utf8')).cacheRoot;
const hash='9f11a8d80681d9fdd54e793a57d5b4cc'; // Installed manifest bundle #1, game_prefabs_swf_skill.
const file=path.join(cache,'../..','DefaultPackage/CacheBundleFiles',hash.slice(0,2),hash,'__data');
const bytes=fs.readFileSync(file),bundle=await loadAssetBundle(bytes);
const types={},clips=[],textures=[],scripts={};
const requested=new Set(process.argv.slice(2));
for(const obj of bundle.objects){
 types[obj.type]=(types[obj.type]??0)+1;
 if(obj.type===AssetType.Texture2D)textures.push({name:obj.name,width:obj.width,height:obj.height});
 if(obj.type!==AssetType.MonoBehaviour)continue;
 const name=obj.script?.object?.className??'unknown';scripts[name]=(scripts[name]??0)+1;
 if(name!=='SwfClipAsset')continue;
 const tree=obj.getTypeTree();
 const id=/\/skill\/(\d+)\//.exec(obj.container)?.[1];
 if(id&&requested.has(id)){
  const sprite=bundle.objects.find(v=>v.type===AssetType.Sprite&&String(v.pathId)===String(tree.Sprite.m_PathID));
  const texture=sprite?.spriteRenderData?.texture?.object;
  if(!texture)throw Error('No local atlas for '+id);
  const out='docs/custom-anim/review-20261106/standard-fx-'+id;
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(out+'/atlas.png',await texture.getImage());
  fs.writeFileSync(out+'/clip.json',JSON.stringify(tree,(_k,v)=>typeof v==='bigint'?String(v):v));
  console.log('Selected FX',id,{texture:texture.name,dimensions:[texture.width,texture.height],frames:tree.Sequences?.map(s=>s.Frames.length)});
 }
 clips.push({name:tree.Name,container:obj.container,objectName:obj.name,pathId:String(obj.pathId),fps:tree.FrameRate,sprite:tree.Sprite,
  sequences:tree.Sequences?.map(s=>({name:s.Name,frames:s.Frames.length,
   labels:s.Frames.flatMap((f,i)=>(f.Labels??[]).map(label=>({frame:i,label})))}))});
}
const report={source:file,bytes:bytes.length,types,scripts,textures,clips};
const json=v=>JSON.stringify(v,(_key,value)=>typeof value==='bigint'?String(value):value,2);
fs.mkdirSync('docs/custom-anim/review-20261106',{recursive:true});
fs.writeFileSync('docs/custom-anim/review-20261106/u-standard-skill-clips.json',json(report)+'\n');
console.log(json({bytes:bytes.length,types,scripts,textures:textures.length,clipCount:clips.length,first:clips.slice(0,4)}));
