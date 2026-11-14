import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {DEFAULT_ELVES,loadImportedElves} from '../src/data/defaultElves';

// 原始檔唯讀；每行保留原文、縮排階層及行號，裁定說明不混入戰鬥描述。
const root=resolve(process.argv[2]||'../elf_source_files/elf_files');
const output=resolve('docs/data/elf-source-intake');
const normalize=(s:string)=>s.normalize('NFKC').replace(/[\s.·・．_\-]/g,'');
await loadImportedElves();
const entries=[];
for(const file of (await readdir(root)).filter(f=>f.endsWith('.txt')).sort()){
  const raw=await readFile(resolve(root,file),'utf8');
  const explicitId=file.match(/^(\d+)_/)?.[1];
  const name=file.replace(/^\d+_/,'').replace(/\.txt$/,'');
  const existing=explicitId?DEFAULT_ELVES.find(e=>e.id===explicitId):DEFAULT_ELVES.find(e=>normalize(e.name)===normalize(name));
  let adjudications=false;
  const lines=raw.split(/\r?\n/).flatMap((text,index)=>{
    if(!text.trim())return [];
    if(/需要裁定的關鍵點|^A[:：]/.test(text.trim()))adjudications=true;
    const depth=(text.match(/^\s*(>+)/)?.[1]||'').length;
    return [{line:index+1,depth,text,kind:adjudications?'adjudication':/^(害怕|狂暴|繳械|麻痺|入魔)[:：]/.test(text.trim())?'definition':'source'}];
  });
  entries.push({file,name,source:resolve(root,file),sha256:createHash('sha256').update(raw).digest('hex'),status:existing?'already_present':'pending',existingId:existing?.id,lines});
}
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'inventory.json'),JSON.stringify({sourceRoot:root,runtimeCount:DEFAULT_ELVES.length,total:entries.length,existing:entries.filter(e=>e.existingId).length,pending:entries.filter(e=>!e.existingId).length,entries},null,2)+'\n');
console.log(JSON.stringify({total:entries.length,existing:entries.filter(e=>e.existingId).length,pending:entries.filter(e=>!e.existingId).map(e=>e.name)}));
