import type {Express} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createPetAnimationCache,PET_BUNDLES,type PetCacheOptions} from './petAnimationCache';
export {PET_BUNDLES} from './petAnimationCache';
/** 本機 U 端優先；缺少時透過同源後端按需取得官方白名單並驗證快取。 */
export function registerPetAnimations(app:Express,root:string,options:PetCacheOptions={}) {
 const cache=createPetAnimationCache(options);
 const bundles={...PET_BUNDLES,...options.bundles};
 const verified=new Map<string,string>();
 const source=()=>{try{return process.env.SEER_PET_CACHE_ROOT||JSON.parse(fs.readFileSync(path.join(root,'launcher/animation-source.local.json'),'utf8')).cacheRoot||'';}catch{return '';}};
 const file=(key:keyof typeof PET_BUNDLES)=>{const {hash}=bundles[key];return path.join(source(),hash.slice(0,2),hash,'__data');};
 const available=async(key:keyof typeof PET_BUNDLES)=>{if(!source())return false;try{const target=file(key),stat=await fs.promises.stat(target),meta=bundles[key];if(!stat.isFile()||stat.size!==meta.size)return false;const stamp=`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;if(verified.get(target)!==stamp){if(crypto.createHash('sha256').update(await fs.promises.readFile(target)).digest('hex')!==meta.sha256)return false;verified.set(target,stamp);}return true;}catch{return false;}};
 app.get('/api/pet-animations/status',async(_req,res)=>{const keys=Object.keys(bundles) as (keyof typeof PET_BUNDLES)[];const ready=Object.fromEntries(await Promise.all(keys.map(async key=>[key,await available(key)||!!await cache.cached(key)])));const storage=await cache.status();res.setHeader('Cache-Control','no-store');res.json({rey70:ready.rey70&&ready.materials,assets:ready,remote:cache.remote,source:'local-or-official-cache',cache:storage});});
 app.get('/api/pet-animations/bundle/:key',async(req,res)=>{
  const key=req.params.key as keyof typeof PET_BUNDLES;
  if(!Object.hasOwn(PET_BUNDLES,key)) return res.status(404).end();
  let target:string;
  try{target=await available(key)?file(key):await cache.acquire(key);}catch(error){return res.status(cache.remote?503:404).json({error:'動作素材暫時無法取得，沿用簡易演出'});}
  if(res.destroyed)return;
  res.setHeader('Content-Type','application/octet-stream');
  // 端點名稱固定但版本會更新；每次重驗 ETag，避免新版本仍拿到舊內容。
  res.setHeader('Cache-Control','private, no-cache');
  res.setHeader('ETag',`"${(options.bundles?.[key]??PET_BUNDLES[key]).sha256}"`);
  return res.sendFile(target);
 });
}
