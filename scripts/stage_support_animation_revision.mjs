/** Revise support effects in a candidate copied from the current formal release. */
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),arg=(k,f)=>args.includes(k)?args[args.indexOf(k)+1]:f;
const out=arg('--out','build/custom-animation-candidate-20261108');
const sheets=arg('--fx-source','build/custom-fx-support-hd');
const metadata=JSON.parse(fs.readFileSync(path.join(sheets,'sheet_res.json'),'utf8'));
for(const id of ['emperor_dixin','wuxu_liuren','wuxu_shiyan','wuxu_zhuixing']){
 const dest=path.join(out,id);
 fs.cpSync(path.join('public/elf-anim',id),dest,{recursive:true});
 const file=path.join(dest,'manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
 const r=metadata[id+'/cp'];if(!r)throw Error('Missing support source '+id);
 const relative='fx/cp.jpg';fs.mkdirSync(path.join(dest,'fx'),{recursive:true});
 fs.copyFileSync(path.join(sheets,id,'cp.jpg'),path.join(dest,relative));
 // Support effects have no target hit. Their full rise and decay must finish
 // during the existing action, with the light mass anchored below the face.
 for(const name of id==='wuxu_shiyan'?['cp']:['cp','extra']){
  const seq=m.sequences[name];if(!seq)throw Error('Missing action '+id+'/'+name);
  m.presentation.fxSheets[name]={src:`/__animation-drafts/${id}/${relative}`,cols:r.cols,rows:r.rows,frames:r.frames,
   anchor:'caster',at:'start',rate:(r.frames-1)/(seq.frames-1),pivot:r.pivot,
   size:id==='emperor_dixin'?1.15:id==='wuxu_zhuixing'?.62:.95,
   y:id==='wuxu_zhuixing'?.42:.62,alpha:id==='emperor_dixin'?.65:.8};
  m.production.effectSheets[name]={file:relative,...r};
 }
 const special=metadata[id+'/sa'];
 if(special){
  const relative='fx/sa.jpg',seq=m.sequences.sa,hit=seq.hits[0];
  if(hit===undefined)throw Error('Special action needs an impact '+id);
  fs.copyFileSync(path.join(sheets,id,'sa.jpg'),path.join(dest,relative));
  const rate=Math.max(.5,special.peak/Math.max(1,hit),(special.frames-1-special.peak)/Math.max(1,seq.frames-1-hit));
  m.presentation.fxSheets.sa={...m.presentation.fxSheets.sa,src:`/__animation-drafts/${id}/${relative}`,
   cols:special.cols,rows:special.rows,frames:special.frames,at:'hit',peak:special.peak,pivot:special.pivot,
   rate,lead:special.peak/rate,size:1,alpha:.85};
  m.production.effectSheets.sa={file:relative,...special};
 }
 fs.writeFileSync(file,JSON.stringify(m));console.log(id+' support candidate ready');
}
