import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {PET_ANIMATION_ASSETS,PET_MATERIAL_BUNDLE} from '../src/battle/petAnimationAssets';

export const PET_BUNDLES={...PET_ANIMATION_ASSETS,materials:PET_MATERIAL_BUNDLE} as const;
export type PetBundleKey=keyof typeof PET_BUNDLES;
export const PET_REMOTE_BASE='https://newseer.61.com/Assets/StandaloneWindows64/PetAnimPackage/';
export const PET_CACHE_LIMIT=512*1024*1024;
export interface PetCacheOptions {directory?:string;remote?:boolean;fetcher?:typeof fetch;limit?:number;timeoutMs?:number;cooldownMs?:number;bundles?:Partial<Record<PetBundleKey,{hash:string;size:number;sha256:string}>>}
/** 快取只管理自己的 hash.bundle；來源只由已核對的白名單決定。 */
export function createPetAnimationCache(options:PetCacheOptions={}) {
 const directory=path.resolve(options.directory||process.env.SEER_PET_DOWNLOAD_CACHE||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.cache'),'SeerBattleSim','pet-animation-cache'));
 const remote=options.remote??process.env.SEER_PET_REMOTE!=='0',limit=options.limit??PET_CACHE_LIMIT;
 const bundles={...PET_BUNDLES,...options.bundles};
 for(const meta of Object.values(bundles))if(!/^[a-f0-9]{32}$/.test(meta.hash)||!/^[a-f0-9]{64}$/.test(meta.sha256)||!Number.isSafeInteger(meta.size)||meta.size<=0||meta.size>64*1024*1024)throw Error('無效的動畫素材白名單');
 const fetcher=options.fetcher??fetch,inFlight=new Map<PetBundleKey,Promise<string>>(),failures=new Map<PetBundleKey,number>();
 const validated=new Map<string,string>();
 const file=(key:PetBundleKey)=>path.join(directory,bundles[key].hash+'.bundle');
 let commits=Promise.resolve();
 const digest=(data:Buffer)=>crypto.createHash('sha256').update(data).digest('hex');
 async function cached(key:PetBundleKey) {
  const target=file(key),meta=bundles[key];
  try{const stat=await fs.lstat(target);if(!stat.isFile())return null;
   const stamp=`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
   if(stat.size!==meta.size||validated.get(target)!==stamp&&digest(await fs.readFile(target))!==meta.sha256){await fs.unlink(target);validated.delete(target);return null;}
   validated.set(target,stamp);return target;
  }catch{return null;}
 }
 async function entries(){try{const names=await fs.readdir(directory);const files=await Promise.all(names.filter(n=>/^[a-f0-9]{32}\.bundle$/.test(n)).map(async name=>{const target=path.join(directory,name),stat=await fs.lstat(target);return {target,size:stat.isFile()?stat.size:0,used:stat.atimeMs};}));return files;}catch{return [];}}
 async function prune(incoming:number,keep:string){let total=0;const files=await entries();for(const f of files)total+=f.size;
  for(const f of files.sort((a,b)=>a.used-b.used)){if(total+incoming<=limit)break;if(f.target===keep||[...inFlight.keys()].some(k=>file(k)===f.target))continue;await fs.unlink(f.target);validated.delete(f.target);total-=f.size;}
  if(total+incoming>limit)throw Error('動畫快取空間不足');
 }
 async function acquire(key:PetBundleKey):Promise<string> {
  const hit=await cached(key);if(hit){const now=new Date();await fs.utimes(hit,now,now).catch(()=>{});return hit;}
  const pending=inFlight.get(key);if(pending)return pending;
  if(!remote)throw Error('已關閉遠端動畫下載');
  if(Date.now()<(failures.get(key)||0))throw Error('動畫來源暫時不可用，稍後再試');
  const work=(async()=>{
   const meta=bundles[key],target=file(key),part=target+'.'+crypto.randomUUID()+'.part';
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),options.timeoutMs??20000);
   try{
    if(meta.size>limit)throw Error('動畫素材超過快取上限');
    const res=await fetcher(PET_REMOTE_BASE+meta.hash,{signal:abort.signal,redirect:'error'});
    if(!res.ok||!res.body)throw Error(`動畫來源回應 ${res.status}`);
    const declared=res.headers.get('content-length');if(declared!==null&&Number(declared)!==meta.size){await res.body.cancel();throw Error('動畫檔案大小不符');}
    const reader=res.body.getReader(),chunks:Buffer[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>meta.size)throw Error('動畫檔案超出白名單大小');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const data=Buffer.concat(chunks);if(size!==meta.size||digest(data)!==meta.sha256)throw Error('動畫檔案完整性不符');
    const commit=commits.then(async()=>{await fs.mkdir(directory,{recursive:true});await prune(data.length,target);await fs.writeFile(part,data,{flag:'wx'});await fs.rename(part,target);});
    commits=commit.catch(()=>{});await commit;validated.delete(target);failures.delete(key);return target;
   }catch(error){failures.set(key,Date.now()+(options.cooldownMs??30000));throw error;}
   finally{clearTimeout(timer);await fs.unlink(part).catch(()=>{});}
  })();
  inFlight.set(key,work);try{return await work;}finally{inFlight.delete(key);}
 }
 return {acquire,cached,remote,directory,async status(){const files=await entries();return {bytes:files.reduce((n,f)=>n+f.size,0),limitBytes:limit,downloading:inFlight.size};}};
}
