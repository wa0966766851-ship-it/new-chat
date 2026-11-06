/** Detect placeholder body sequences; this is not a visual-quality score. */
import fs from 'node:fs';
import path from 'node:path';
const ids=['wuxu_liuren','wuxu_zhuixing','wuxu_shiyan','emperor_dixin'];
const rows=ids.map(id=>{
 const m=JSON.parse(fs.readFileSync(`public/elf-anim/${id}/manifest.json`,'utf8'));
 const sequences=Object.fromEntries(['standby','hited'].map(name=>{
  const seq=m.sequences[name],unique=new Set(seq?.quads.map(q=>JSON.stringify([q.c,q.buv,q.g]))??[]).size;
  return [name,{frames:seq?.frames??0,distinctAuthoredBodyStates:unique,
   runtimeLocalDeformation:name==='standby'&&!!m.idleMotion,
   assessment:unique<2?(name==='standby'&&m.idleMotion?'single-drawing-with-local-deformation':'placeholder-no-body-motion'):'different-body-drawings-or-geometry-not-yet-a-quality-verdict'}];
 }));
 return {id,downloadBytes:m.size,decodedBytes:m.atlas.width*m.atlas.height*4,sequences};
});
const report={note:'Counts describe body data only. Repeated frames, alpha flicker and external FX do not prove character animation quality. Local mesh deformation can animate a single drawing; its visual quality requires playback.',rows};
const out='docs/custom-anim/review-20261105/custom-motion-audit.json';fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
for(const row of rows)console.log(row.id+': idle='+row.sequences.standby.assessment+', hit='+row.sequences.hited.assessment);
if(process.argv.includes('--strict')&&rows.some(r=>Object.values(r.sequences).some(s=>s.assessment==='placeholder-no-body-motion')))process.exitCode=1;
