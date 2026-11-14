import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fxSheetCell} from '../src/battle/customBattleFx';
// Candidate gate: support replacements must retain the reviewed body and finish
// inside the original action, rather than extending battle settlement timers.
const root=process.argv[2]??'build/custom-animation-candidate-20261108';
for(const id of ['emperor_dixin','wuxu_liuren','wuxu_shiyan','wuxu_zhuixing']){
 const folder=path.join(root,id),m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 const live=JSON.parse(fs.readFileSync(`public/elf-anim/${id}/manifest.json`,'utf8'));
 assert.equal(m.sha256,live.sha256,'support revision must not replace the reviewed drawing');
 assert.deepEqual(m.sequences,live.sequences,'support revision must not change action or damage timing');
 for(const name of id==='wuxu_shiyan'?['cp']:['cp','extra']){
  const s=m.presentation.fxSheets[name],r=m.production.effectSheets[name],n=m.sequences[name].frames;
  assert.ok(s.src.endsWith('/fx/cp.jpg')&&!s.src.includes('custom-v3'));
  assert.equal(s.anchor,'caster');assert.equal(m.sequences[name].hits.length,0);
  assert.ok(r.sources?.every((l:any)=>l.layerMode==='add-only'),'support effect must exclude ordinary body/mask layers');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,r.file))).digest('hex'),r.sha256);
  assert.equal(fxSheetCell(s,0,{hit:0,launch:0}),0);
  assert.equal(fxSheetCell(s,n-1,{hit:0,launch:0}),s.frames-1,'tail must finish before recovery');
  assert.ok(s.size<=1.15,'support must not obscure the entire body');
 }
 if(id==='wuxu_liuren'){
  const s=m.presentation.fxSheets.sa,seq=m.sequences.sa,hit=seq.hits[0];
  assert.ok(s.src.endsWith('/fx/sa.jpg')&&!s.src.includes('custom-v3'));
  assert.equal(fxSheetCell(s,hit,{hit,launch:0}),s.peak);
  const last=fxSheetCell(s,seq.frames-1,{hit,launch:0});
  assert.ok(last===-1||last===s.frames-1,'special effect must finish by recovery');
 }
 console.log(id+': support source, body preservation and timing passed');
}
