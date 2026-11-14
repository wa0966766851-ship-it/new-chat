import fs from 'node:fs';
import path from 'node:path';
/** Resolve all same-animation sidecars, including an already-published revision. */
export function animationResources(value,id,source){
 const files=new Map(),prefix=`/__animation-drafts/${id}/`,formal=`/elf-anim/${id}/`;
 const visit=v=>{
  if(typeof v==='string'&&(v.startsWith('/__animation-drafts/')||v.startsWith(formal))){
   if(!v.startsWith(prefix)&&!v.startsWith(formal))throw Error('Cross-animation draft resource: '+v);
   const relative=v.slice(v.startsWith(prefix)?prefix.length:formal.length),absolute=path.resolve(source,relative);
   if(!relative||!absolute.startsWith(path.resolve(source)+path.sep)||!fs.statSync(absolute).isFile())throw Error('Invalid animation resource: '+v);
   files.set(relative,absolute);return `/elf-anim/${id}/${relative.replaceAll('\\','/')}`;
  }
  if(Array.isArray(v))return v.map(visit);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x)]));
  return v;
 };
 return {value:visit(value),files};
}
