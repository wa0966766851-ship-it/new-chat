import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {initialLibrary,validateLibrary,type AtlasLibrary} from '../model';

export function createAtlasStorage(directory:string){
 const dir=path.resolve(directory),file=path.join(dir,'library.json'),images=path.join(dir,'images');
 fs.mkdirSync(images,{recursive:true});
 const read=():AtlasLibrary=>fs.existsSync(file)?validateLibrary(JSON.parse(fs.readFileSync(file,'utf8'))):(()=>{const value=initialLibrary();if(process.env.ATLAS_BLANK==='1'){value.edition='blank';value.books[0].name='我的自製圖鑑';value.books[0].builtinIds=[];}return value;})();
 const write=(input:unknown)=>{
  const value=validateLibrary(input),current=read();
  if((value.revision||0)!==(current.revision||0))throw Error('圖鑑已在另一個視窗更新，請重新讀取後再儲存');
  const next={...value,revision:(current.revision||0)+1};const tmp=file+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(next,null,2),'utf8');
  if(fs.existsSync(file))fs.copyFileSync(file,file+'.previous');
  fs.renameSync(tmp,file);return next;
 };
 const image=(bytes:Buffer,mime:string)=>{
  if(!bytes.length||bytes.length>12*1024*1024)throw Error('圖片須小於12 MB');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  const gif=['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6));
  const ext=png?'png':jpg?'jpg':webp?'webp':gif?'gif':'';
  if(!ext||!/^image\/(png|jpeg|webp|gif)(?:;|$)/.test(mime))throw Error('請上傳PNG、JPG、WebP或GIF圖片');
  const name=createHash('sha256').update(bytes).digest('hex')+'.'+ext;
  if(!fs.existsSync(path.join(images,name)))fs.writeFileSync(path.join(images,name),bytes);
  return '/atlas-images/'+name;
 };
 return {dir,file,images,read,write,image};
}
