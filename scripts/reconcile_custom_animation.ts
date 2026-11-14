/** Reconcile authored sheets with the actual clip, preserving gameplay timing. Dry-run by default. */
import fs from 'node:fs';
import path from 'node:path';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
const ids=['emperor_dixin','wuxu_liuren','wuxu_shiyan','wuxu_zhuixing'] as const;
const write=process.argv.includes('--write');
const results=JSON.parse(fs.readFileSync('tools/fx-extract/sheet_res.json','utf8'));
const registry='src/battle/petAnimationAssets.ts';let text=fs.readFileSync(registry,'utf8');
const backup=path.join('build/custom-animation-backups','reconcile-'+Date.now());
if(write){fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(registry,path.join(backup,'petAnimationAssets.ts'));}
for(const id of ids){
 const file=`public/elf-anim/${id}/manifest.json`,original=fs.readFileSync(file,'utf8'),m=JSON.parse(original);
 const p=structuredClone(m.presentation);
 // The fifth skill is physical for these two. Never leave its route at the ranged default.
 if(id==='wuxu_liuren'||id==='emperor_dixin')p.meleeSequences=['attack','ultimate'];
 if(id==='wuxu_liuren'){
  const a=m.sequences.attack,u=m.sequences.ultimate,hit=a.hits[0],target=u.hits[0];
  // Use the authored melee drawing path for the physical fifth; keep its frame count and hit.
  const sourceAt=(i:number)=>i<=target?Math.round(i*hit/Math.max(1,target)):hit+Math.round((i-target)*(a.frames-1-hit)/Math.max(1,u.frames-1-target));
  u.quads=Array.from({length:u.frames},(_,i)=>structuredClone(a.quads[sourceAt(i)]));
  const map=(i:number)=>i<=hit?Math.round(i*target/Math.max(1,hit)):target+Math.round((i-hit)*(u.frames-1-target)/Math.max(1,a.frames-1-hit));
  u.events={launch:map(a.events.launch),recover:map(a.events.recover)};
 }
 for(const [name,value] of Object.entries(p.fxSheets??{})){
  const seq=m.sequences[name],r=results[`${id}/${name}`];if(!seq)throw Error(`Unknown sequence ${id}/${name}`);
  for(const s of (Array.isArray(value)?value:[value]) as any[]){
   if(r&&seq.hits.length){
    const hit=seq.hits[0],tail=Math.max(1,seq.frames-1-hit);
    s.peak=r.peak;
    s.rate=Math.max(.5,r.peak/Math.max(1,hit),(s.frames-1-r.peak)/tail);
    s.lead=s.peak/s.rate;
   }else if(!seq.hits.length){s.rate=Math.max(.5,(s.frames-1)/Math.max(1,seq.frames-1));}
   if(id==='wuxu_liuren'&&name==='ultimate'){s.size=.8;s.alpha=.6;}
   if(id==='wuxu_liuren'&&name==='attack')s.alpha=.75;
  }
 }
 m.presentation=p;
 const line=text.split('\n').find(l=>l.trimStart().startsWith(id+':'))!;
 if(!line)throw Error('Missing registry '+id);
 const at=line.indexOf('presentation:')+'presentation:'.length;let end=at,depth=0;
 do{if(line[end]==='{')depth++;if(line[end]==='}')depth--;end++;}while(depth>0&&end<line.length);
 if(depth)throw Error('Invalid presentation '+id);
 text=text.replace(line,line.slice(0,at)+JSON.stringify(p)+line.slice(end));
 if(write){fs.writeFileSync(path.join(backup,id+'.json'),original);fs.writeFileSync(file,JSON.stringify(m));}
 console.log(id,JSON.stringify({melee:p.meleeSequences,sheets:Object.keys(p.fxSheets??{}),frames:m.sequences.ultimate.frames,hit:m.sequences.ultimate.hits}));
 // Import checks that this updates a registered binding rather than an unused text copy.
 if(!PET_ANIMATION_ASSETS[id].custom)throw Error('Missing live binding '+id);
}
if(write){fs.writeFileSync(registry,text);console.log('Backup: '+backup);}else console.log('Dry run; use --write after reviewing.');
