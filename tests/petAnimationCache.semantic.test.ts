import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import {createPetAnimationCache,PET_BUNDLES,PET_REMOTE_BASE} from '../server/petAnimationCache';
import {registerPetAnimations} from '../server/petAnimations';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'pet-download-test-'));
const data=Buffer.from('verified-animation-test'),sha256=crypto.createHash('sha256').update(data).digest('hex');
const bundles={...PET_BUNDLES,rey70:{...PET_BUNDLES.rey70,size:data.length,sha256}};
let downloads=0;
const fetcher:typeof fetch=async(input,init)=>{downloads++;assert.equal(String(input),PET_REMOTE_BASE+PET_BUNDLES.rey70.hash);assert.ok(init?.signal);await new Promise(r=>setTimeout(r,5));return new Response(data,{headers:{'content-length':String(data.length)}});};
try{
 const directory=path.join(root,'cache');const cache=createPetAnimationCache({directory,fetcher,bundles});
 const files=await Promise.all(Array.from({length:6},()=>cache.acquire('rey70')));assert.equal(downloads,1,'同素材同時請求合併下載');assert.equal(new Set(files).size,1);assert.deepEqual(await fs.readFile(files[0]),data);
 const offline=createPetAnimationCache({directory,remote:false,bundles});assert.equal(await offline.acquire('rey70'),files[0],'重建服務後仍可離線讀取已驗證快取');
 await fs.writeFile(files[0],Buffer.alloc(data.length));assert.equal(await cache.cached('rey70'),null,'同大小損毀亦拒絕');await cache.acquire('rey70');assert.equal(downloads,2);
 const bad=createPetAnimationCache({directory:path.join(root,'bad'),bundles,cooldownMs:10000,fetcher:async()=>new Response(Buffer.alloc(data.length))});await assert.rejects(bad.acquire('rey70'),/完整性/);await assert.rejects(bad.acquire('rey70'),/稍後/);assert.equal(await bad.cached('rey70'),null);
 const oversized=createPetAnimationCache({directory:path.join(root,'oversized'),bundles,fetcher:async()=>new Response(Buffer.alloc(data.length+1))});await assert.rejects(oversized.acquire('rey70'),/超出/);
 const truncated=createPetAnimationCache({directory:path.join(root,'truncated'),bundles,fetcher:async()=>new Response(data.subarray(1))});await assert.rejects(truncated.acquire('rey70'),/完整性/);
 const timeout=createPetAnimationCache({directory:path.join(root,'timeout'),bundles,timeoutMs:10,fetcher:async(_url,init)=>new Promise((_r,reject)=>init!.signal!.addEventListener('abort',()=>reject(Error('timed out')),{once:true}))});await assert.rejects(timeout.acquire('rey70'),/timed out/);
 const lruDir=path.join(root,'lru');await fs.mkdir(lruDir);const old=path.join(lruDir,'a'.repeat(32)+'.bundle');await fs.writeFile(old,Buffer.alloc(20));await fs.writeFile(path.join(lruDir,'keep.txt'),'untouched');
 const lru=createPetAnimationCache({directory:lruDir,fetcher,bundles,limit:data.length+10});await lru.acquire('rey70');assert.ok((await lru.status()).bytes<=data.length+10);await assert.rejects(fs.stat(old));assert.equal(await fs.readFile(path.join(lruDir,'keep.txt'),'utf8'),'untouched');
 const app=express();let count=0;registerPetAnimations(app,root,{directory:path.join(root,'route'),bundles,fetcher:async(...args)=>{count++;return fetcher(...args);}});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const base=`http://127.0.0.1:${(server.address() as any).port}/api/pet-animations`;assert.equal((await(await fetch(base+'/status')).json()).remote,true);assert.equal((await fetch(base+'/bundle/unregistered')).status,404);assert.equal(count,0);const r=await fetch(base+'/bundle/rey70');assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);assert.equal(count,1);}finally{await new Promise<void>(r=>server.close(()=>r()));}
 console.log('遠端去重、重啟離線、SHA校驗、截斷／超量／逾時拒絕、失敗冷卻、快取上限與白名單路由通過');
}finally{await fs.rm(root,{recursive:true,force:true});}
