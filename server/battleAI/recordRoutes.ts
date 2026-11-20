import type {Express,Request} from 'express';
import {spawn} from 'node:child_process';
import {BattleRecordStore,battleRecordDirectory,validRecordId} from './recordStore';
import {validRecordEvents} from '../../src/battle/records/schema';
export function registerBattleRecords(app:Express,root:string,authorized:(req:Request)=>unknown,store=new BattleRecordStore(battleRecordDirectory(root)),openFolder=()=>new Promise<void>((resolve,reject)=>{
  if(process.platform!=='win32')return reject(Error('UNSUPPORTED'));
  const child=spawn('explorer.exe',[store.directory],{windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
})) {
  const base='/api/battle-ai/records';
  app.get(base,async(_req,res)=>{try{res.json({directory:store.directory,files:await store.list(),limit:10});}catch{res.status(500).json({error:'RECORD_READ_FAILED'});}});
  app.get(base+'/:id',async(req,res)=>{if(!validRecordId(req.params.id))return res.status(400).end();try{res.setHeader('Content-Disposition',`attachment; filename="battle-${req.params.id}.txt"`);res.type('text/plain').send(await store.read(req.params.id));}catch{res.status(404).end();}});
  app.post(base,async(req,res)=>{
    if(!authorized(req))return res.status(403).json({error:'LOCAL_ONLY'});
    const {id,events,create,batch}=req.body || {};
    if(!validRecordId(id)||!validRecordEvents(events)||typeof create!=='boolean'||(batch!==undefined&&(!Number.isSafeInteger(batch)||batch<1)))return res.status(400).json({error:'INVALID_RECORD'});
    try{await store.append(id,events,create,batch);res.json({saved:true});}
    catch(error){res.status(error?.code==='ENOENT'||error?.message==='RECORD_EXPIRED'?410:409).json({error:error?.message==='RECORD_SIZE_LIMIT'?'RECORD_SIZE_LIMIT':'RECORD_NOT_SAVED'});}
  });
  app.post(base+'/delete',async(req,res)=>{if(!authorized(req))return res.status(403).end();const {id,all}=req.body||{};if(!validRecordId(id)&&all!==true)return res.status(400).end();try{await store.delete(all===true?undefined:id);res.json({deleted:true});}catch{res.status(500).json({error:'RECORD_DELETE_FAILED'});}});
  app.post(base+'/open',async(req,res)=>{if(!authorized(req))return res.status(403).end();try{await store.list();await openFolder();res.json({opened:true});}catch{res.status(500).json({error:'FOLDER_OPEN_FAILED'});}});
}
