import type {MaterialResolver,SwfClipData} from '@seer-pet-anim/swf-bundle';
import {PET_ANIMATION_ASSETS,type PetAnimationAssetId} from './petAnimationAssets';
import {createPetClipPool} from './petClipPool';
import {perfLiteActive,readPerfPreference} from '../shell/perfMode';


async function prepareClipForPlayback(clip:SwfClipData,id:PetAnimationAssetId,compact:boolean,signal:AbortSignal,stage:(name:string)=>void){
   try{
    if(compact){stage('準備精簡圖集');await compactAtlas(clip,signal);}
    stage('載入演出模組');
    const [{preparePetFxAsync},{preparePetGeometry,sharePetGeometry}]=await Promise.all([import('./petFxPolicy'),import('./petAnimation/preparedGeometry')]);
    stage('分批準備特效');
    const fx=await preparePetFxAsync(clip,(PET_ANIMATION_ASSETS[id] as import('./petAnimationAssets').PetAnimationAsset).fullscreen,signal);
    stage('分批準備對位');
    await preparePetGeometry(clip,signal);sharePetGeometry(clip,fx.clip);return clip;
   }catch(error){const {disposeSwfClipData}=await import('@seer-pet-anim/swf-bundle');disposeSwfClipData(clip);throw error;}
}

// 精簡模式只縮小播放用圖集。來源檔、影格座標、UV、時序及命中標記維持原資料。
const MAX_LITE_ATLAS_SIDE=4096;
type PlaybackKey=PetAnimationAssetId | `${PetAnimationAssetId}:lite`;
const playbackAsset=(key:PlaybackKey)=>key.split(':')[0] as PetAnimationAssetId;
const isCompact=(key:PlaybackKey)=>key.endsWith(':lite');
const compactDimensions=(width:number,height:number)=>{
 const scale=Math.min(1,MAX_LITE_ATLAS_SIDE/Math.max(width,height));
 return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))] as const;
};
function resizeOnWorker(atlas:ImageBitmap,width:number,height:number,signal:AbortSignal){
 if(typeof Worker==='undefined')return;
 let worker:Worker;
 try {worker=new Worker(new URL('./petAnimation/compactPetAtlas.worker.ts',import.meta.url),{type:'module'});}
 catch {return;}
 return new Promise<{atlas:ImageBitmap;resized:boolean}>((resolve,reject)=>{
  const close=()=>{signal.removeEventListener('abort',abort);worker.terminate();};
  const abort=()=>{close();reject(signal.reason);};
  worker.onmessage=(event:MessageEvent<{atlas:ImageBitmap;resized:boolean}>)=>{close();resolve(event.data);};
  worker.onerror=event=>{event.preventDefault();close();reject(Error('背景圖集縮放失敗'));};
  worker.onmessageerror=()=>{close();reject(Error('背景圖集無法傳回'));};
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  try {worker.postMessage({atlas,width,height},[atlas]);}
  catch {close();resolve({atlas,resized:false});}
 });
}

async function compactAtlas(clip:SwfClipData,signal:AbortSignal){
 const [width,height]=compactDimensions(clip.atlasWidth,clip.atlasHeight);
 if(width===clip.atlasWidth&&height===clip.atlasHeight)return;
 const fromWorker=await resizeOnWorker(clip.atlas,width,height,signal);
 const source=fromWorker?.atlas??clip.atlas;
 if(signal.aborted){source.close();signal.throwIfAborted();}
 clip.atlas=source;
 if(!fromWorker?.resized){
  clip.atlas=await createImageBitmap(source,{resizeWidth:width,resizeHeight:height,resizeQuality:'high',premultiplyAlpha:'none'});
  source.close();
 }
 signal.throwIfAborted();
 if(clip.atlas.width!==width||clip.atlas.height!==height)throw Error('精簡圖集尺寸不符');
 clip.atlasWidth=width;clip.atlasHeight=height;
}

async function fetchBundle(key:string,signal:AbortSignal){
 const result=await fetch('/api/pet-animations/bundle/'+key,{signal});
 if(!result.ok)throw Error('動作素材未就緒');
 return result.arrayBuffer();
}

let materialsRequest:Promise<ReturnType<MaterialResolver['snapshot']>>|undefined;
function loadSharedMaterials(){
 return materialsRequest??=Promise.all([
  fetchBundle('materials',AbortSignal.timeout(15000)),
  import('@seer-pet-anim/swf-bundle'),
  import('@seer-pet-anim/swf-bundle/parse'),
 ]).then(async ([buffer,{MaterialResolver},{loadMaterialBundle}])=>{
  const resolver=new MaterialResolver();
  await loadMaterialBundle(buffer,resolver);
  return resolver.snapshot();
 }).catch(error=>{materialsRequest=undefined;throw error;});
}

// 共用的是 CPU 圖集，各個 WebGL 畫布仍需各自上傳。
let parsing:Promise<unknown>=Promise.resolve();
const pool=createPetClipPool<PlaybackKey,SwfClipData>({
 limitBytes:512*1024*1024,idleBytes:128*1024*1024,maxIdleEntryBytes:64*1024*1024,idleMs:15000,handoffMs:250,
 bytes:key=>{const size=PET_ANIMATION_ASSETS[playbackAsset(key)].atlas;const [w,h]=isCompact(key)?compactDimensions(size[0],size[1]):size;return w*h*4;},
 load:async(key,signal,stage)=>{
  const id=playbackAsset(key);
  // 自製素材：manifest + 單張圖集，不走官方 bundle 解析。
  const custom=(PET_ANIMATION_ASSETS[id] as {custom?:string}).custom;
  if(custom){
   stage('載入自製動作素材');
   const {loadCustomClip}=await import('./customPetClip');
   return prepareClipForPlayback(await loadCustomClip(custom,signal,PET_ANIMATION_ASSETS[id].sha256),id,isCompact(key),signal,stage);
  }
  stage('載入模組與素材');
  const [bundle,{parseBundleInWorker},materials]=await Promise.all([
   fetchBundle(id,signal),import('@seer-pet-anim/swf-bundle'),loadSharedMaterials(),
  ]);
  stage('等待解碼');
  const parse=parsing.then(async()=>{
   signal.throwIfAborted();stage('解析原生動作與圖集');
   // 0.3.2 自行在閒置時回收 Worker；不可終止別的元件正在使用的 Worker。
   const clip=await parseBundleInWorker(bundle,PET_ANIMATION_ASSETS[id].clip,materials,{signal});
   return prepareClipForPlayback(clip,id,isCompact(key),signal,stage);
  });
  parsing=parse.catch(()=>{});return parse;
 },
 dispose:async clip=>{const {disposeSwfClipData}=await import('@seer-pet-anim/swf-bundle');disposeSwfClipData(clip);},
});
export function acquirePetClip(id:PetAnimationAssetId='rey70'){
 const preference=readPerfPreference();
 const memory=typeof navigator==='undefined'?0:Number((navigator as Navigator&{deviceMemory?:number}).deviceMemory);
 const lowMemory=preference==='auto'&&memory>0&&memory<=8;
 const atlas=PET_ANIMATION_ASSETS[id].atlas;
 const compact=typeof createImageBitmap==='function'&&Math.max(...atlas)>MAX_LITE_ATLAS_SIDE&&(perfLiteActive(preference)||lowMemory);
 return pool.acquire(compact?`${id}:lite`:id);
}
export const petClipLeaseSnapshot=()=>pool.snapshot().map(view=>({...view,id:playbackAsset(view.id),compact:isCompact(view.id)}));
export const petClipDiagnostics=()=>pool.diagnostics();
