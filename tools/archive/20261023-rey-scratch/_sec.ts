import { CORRUPTED_REY_SOUL_TEXT } from './src/data/corruptedReyDescriptions.ts';
for(const id of ['7070','707070']){
  const d=CORRUPTED_REY_SOUL_TEXT[id];
  const secs=d.split(/\n{2,}/).map((x:string)=>x.trim()).filter(Boolean);
  console.log('=== '+id+' 段落數: '+secs.length+' ===');
  secs.forEach((s:string,i:number)=>console.log(`[${i}] ${s.split('\n')[0].slice(0,50)}`));
  console.log('');
}
