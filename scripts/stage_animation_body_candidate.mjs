/** Replace one candidate body while preserving the current reviewed FX. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
if(!args.includes('--id')||!args.includes('--source'))throw Error('Use --id <asset> --source <build directory>');
const id=get('--id');if(!/^[a-z][a-z0-9_]*$/.test(id))throw Error('Invalid asset id');
const source=path.resolve(get('--source'),id),formal=path.resolve('public/elf-anim',id);
const destination=path.resolve('build/custom-animation-candidate-20261108',id);
const m=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
const current=JSON.parse(fs.readFileSync(path.join(formal,'manifest.json'),'utf8'));
assert.deepEqual(Object.keys(m.sequences).sort(),Object.keys(current.sequences).sort());
for(const [name,sequence] of Object.entries(current.sequences)){
 assert.equal(m.sequences[name].frames,sequence.frames,name+' duration');
 assert.deepEqual(m.sequences[name].hits,sequence.hits,name+' damage timing');
 assert.deepEqual(m.sequences[name].events,sequence.events,name+' presentation timing');
}
assert.equal(m.facing,current.facing,'source facing');
assert.equal(m.physicalMotion,current.physicalMotion,'physical travel');
m.presentation=structuredClone(current.presentation);
m.poseBlend=current.poseBlend;
m.production.effectSheets=structuredClone(current.production.effectSheets);
m.production.bodyStudy={status:'candidate-only',source:path.relative(process.cwd(),source)};
fs.mkdirSync(destination,{recursive:true});
fs.cpSync(formal,destination,{recursive:true});
fs.copyFileSync(path.join(source,'atlas.png'),path.join(destination,'atlas.png'));
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(m));
console.log('Staged one body candidate: '+id+'; other elves, formal assets and desktop untouched.');
