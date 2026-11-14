/** Combine reviewed original-pixel studies with current official-effect sheets. No publish. */
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const base=arg('--source','build/original-motion-v4'),out=arg('--out','build/custom-animation-candidate-20261108');
for(const id of ['emperor_dixin','wuxu_liuren','wuxu_shiyan','wuxu_zhuixing']){
 const revised=id==='emperor_dixin'?arg('--dixin-source',base):id==='wuxu_liuren'?arg('--liuren-source',base):base;
 const source=path.join(revised,id),dest=path.join(out,id);fs.mkdirSync(dest,{recursive:true});
 for(const folder of [...new Set([path.join(base,id),source])])for(const name of fs.readdirSync(folder))if(/\.(png|json)$/.test(name))fs.copyFileSync(path.join(folder,name),path.join(dest,name));
 const m=JSON.parse(fs.readFileSync(path.join(dest,'manifest.json'),'utf8'));
 // A second whole body is not a drawn in-between. Keep the detailed pose readable.
 m.poseBlend=false;
 const live=JSON.parse(fs.readFileSync(`public/elf-anim/${id}/manifest.json`,'utf8'));
 m.presentation.fxSheets=structuredClone(live.presentation.fxSheets);
 const p=m.presentation;
 if(id==='wuxu_liuren'){
  // A blade impact belongs to the physical fifth; the old giant beam obscured its sword work.
  p.fxSheets.ultimate=structuredClone(p.fxSheets.attack);p.fxSheets.ultimate.alpha=.72;p.fxSheets.ultimate.size=1.1;
  if(p.weaponVolley?.held){p.weaponVolley.held.from=4;p.weaponVolley.held.until=56;}
 }
 if(id==='emperor_dixin'){p.fxSheets.ultimate.size=1.25;p.fxSheets.ultimate.alpha=.6;p.fxSheets.sa.alpha=.7;}
 if(id==='wuxu_zhuixing'){p.fxSheets.ultimate.size=1.35;p.fxSheets.ultimate.alpha=.65;}
 // Copy high-resolution sheets into the candidate, never overwrite live resources here.
 const hd=arg('--fx-source','build/custom-fx-hd-alpha'),hdMeta=path.join(hd,'sheet_res.json');
 if(fs.existsSync(hdMeta)){
  const metadata=JSON.parse(fs.readFileSync(hdMeta,'utf8'));
  for(const [name,v] of Object.entries(p.fxSheets??{}))for(const s of Array.isArray(v)?v:[v]){
   const effect=id==='wuxu_liuren'&&name==='ultimate'?'attack':name,r=metadata[id+'/'+effect];if(!r)continue;
   const relative='fx/'+effect+'.jpg';fs.mkdirSync(path.join(dest,'fx'),{recursive:true});
   fs.copyFileSync(path.join(hd,id,effect+'.jpg'),path.join(dest,relative));
   Object.assign(s,{src:`/__animation-drafts/${id}/${relative}`,cols:r.cols,rows:r.rows,frames:r.frames,peak:r.peak,...(r.pivot?{pivot:r.pivot}:{})});
   m.production.effectSheets??={};m.production.effectSheets[name]={file:relative,...r};
  }
  // The legacy six-cell blast is a flat smoke drawing. Do not cover the newly
  // authored official-effect explosion with it in the same frame.
  if(id==='wuxu_zhuixing'&&m.production.effectSheets?.ultimate)delete p.impactSheet;
 }
 for(const [name,v] of Object.entries(p.fxSheets??{}))for(const s of Array.isArray(v)?v:[v]){
  const seq=m.sequences[name],hit=seq.hits[0];
  if(hit!==undefined){s.rate=Math.max(.5,(s.peak??0)/Math.max(1,hit),(s.frames-1-(s.peak??0))/Math.max(1,seq.frames-1-hit));s.lead=(s.peak??0)/s.rate;}
  else s.rate=Math.max(.5,(s.frames-1)/Math.max(1,seq.frames-1));
 }
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(m));
 console.log(id,m.size,m.atlas.width*m.atlas.height*4);
}
console.log('Candidate only: '+out);
