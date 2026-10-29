import type {SwfClipData} from '@seer-pet-anim/swf-bundle';
import {PET_ANIMATION_ASSETS,type PetAnimationAssetId} from './petAnimationAssets';
import {createPetClipPool} from './petClipPool';

// 原始畫質；共用的是 CPU 圖集，不能當成各 WebGL 畫布的總顯示記憶體。
let parsing:Promise<unknown>=Promise.resolve();
const pool=createPetClipPool<PetAnimationAssetId,SwfClipData>({
 limitBytes:512*1024*1024,idleBytes:32*1024*1024,idleMs:15000,handoffMs:250,
 bytes:id=>{const [w,h]=PET_ANIMATION_ASSETS[id].atlas;return w*h*4;},
 load:async(id,signal,stage)=>{
  stage('載入模組與素材');
  const [{parseBundleInWorker,MaterialResolver},{loadMaterialBundle}]=await Promise.all([import('@seer-pet-anim/swf-bundle'),import('@seer-pet-anim/swf-bundle/parse')]);
  const get=async(key:string)=>{const r=await fetch('/api/pet-animations/bundle/'+key,{signal});if(!r.ok)throw Error('動作素材未就緒');return r.arrayBuffer();};
  const [bundle,materials]=await Promise.all([get(id),get('materials')]);
  const resolver=new MaterialResolver();await loadMaterialBundle(materials,resolver);stage('等待解碼');
  const parse=parsing.then(async()=>{
   signal.throwIfAborted();stage('解析原生動作與圖集');
   // 0.3.2 自行在閒置時回收 Worker；不可終止別的元件正在使用的 Worker。
   return parseBundleInWorker(bundle,PET_ANIMATION_ASSETS[id].clip,resolver.snapshot(),{signal});
  });
  parsing=parse.catch(()=>{});return parse;
 },
 dispose:async clip=>{const {disposeSwfClipData}=await import('@seer-pet-anim/swf-bundle');disposeSwfClipData(clip);},
});
export const acquirePetClip=(id:PetAnimationAssetId='rey70')=>pool.acquire(id);
export const petClipLeaseSnapshot=()=>pool.snapshot();
export const petClipDiagnostics=()=>pool.diagnostics();
