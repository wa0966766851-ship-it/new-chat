import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Only presentation source participates. Personal libraries and images never do.
export function catalogFingerprint(root=process.cwd()){
 const hash=createHash('sha256');
 const visit=(relative:string)=>{
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute))return;
  if(fs.statSync(absolute).isDirectory()){
   for(const name of fs.readdirSync(absolute).sort())visit(path.join(relative,name));
  }else if(/\.(ts|tsx|json)$/.test(relative)){
   hash.update(relative.replaceAll('\\','/')).update('\0').update(fs.readFileSync(absolute)).update('\0');
  }
 };
 for(const relative of ['src/data','src/battle','src/utils','src/effects','src/types.ts','encyclopedia/sync-catalog.ts','encyclopedia/catalogFreshness.ts'])visit(relative);
 return hash.digest('hex');
}

export function catalogIsCurrent(directory:string,fingerprint:string){
 try{
  const version=JSON.parse(fs.readFileSync(path.join(directory,'version.json'),'utf8'));
  const index=JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8'));
  return version.fingerprint===fingerprint&&version.count===index.length&&index.every((e:{id:string})=>/^[\w-]+$/.test(e.id)&&fs.existsSync(path.join(directory,e.id+'.json')));
 }catch{return false;}
}
