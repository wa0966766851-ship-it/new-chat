import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {fxSheetCell,isMeleePresentationSequence} from '../src/battle/customBattleFx';
const results=JSON.parse(fs.readFileSync('tools/fx-extract/sheet_res.json','utf8'));
for(const id of ['emperor_dixin','wuxu_liuren','wuxu_shiyan','wuxu_zhuixing'] as const){
 const root=`public/elf-anim/${id}`,m=JSON.parse(fs.readFileSync(root+'/manifest.json','utf8')),a=PET_ANIMATION_ASSETS[id];
 const png=fs.readFileSync(root+'/atlas.png'),decoded=PNG.sync.read(png);
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),a.sha256);
 assert.equal(png.length,a.size);assert.deepEqual([decoded.width,decoded.height],[...a.atlas]);
 assert.deepEqual(a.presentation,m.presentation,'live registry and manifest must share presentation');
 assert.ok(!JSON.stringify(m).includes('/__animation-drafts/'),'release must never depend on draft routes');
 if(id==='emperor_dixin'||id==='wuxu_liuren')assert.ok(isMeleePresentationSequence(a.presentation,'ultimate'),'physical fifth must approach');
 for(const [seq,v] of Object.entries(m.presentation.fxSheets??{}))for(const s of (Array.isArray(v)?v:[v]) as any[]){
  assert.ok(fs.statSync(path.join('public',s.src)).size>0);
  const source=m.production?.effectSheets?.[seq];
  if(source?.sha256)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join('public',s.src))).digest('hex'),source.sha256,'effect must match its calibrated source');
  assert.ok(s.frames<=s.cols*s.rows);
  const frames=m.sequences[seq].frames,hit=m.sequences[seq].hits[0],r=results[id+'/'+seq];
  const peak=source?.peak??s.peak??r?.peak;
  if(hit!==undefined&&peak!==undefined)assert.equal(fxSheetCell(s,hit,{hit,launch:0}),peak,'authored peak must be on the real hit frame');
  const last=fxSheetCell(s,frames-1,{hit:hit??0,launch:0});
  assert.ok(last===-1||last===s.frames-1,'effect must reach its final drawing by action recovery');
 }
 console.log(id+': atlas, live binding, resources and impact timing passed');
}
