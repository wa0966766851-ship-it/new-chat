/** Isolate the drawn recovery while retaining the current reviewed FX resources. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const id='wuxu_liuren';
const args=process.argv.slice(2),at=args.indexOf('--body-source');
const source=path.join(at<0?'build/liuren-recovery-pilot':args[at+1],id);
const formal=path.join('public/elf-anim',id);
const dest=path.join('build/custom-animation-candidate-20261108',id);
const m=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
const current=JSON.parse(fs.readFileSync(path.join(formal,'manifest.json'),'utf8'));
for(const name of Object.keys(current.sequences)){
 assert.equal(m.sequences[name].frames,current.sequences[name].frames,name+' duration');
 assert.deepEqual(m.sequences[name].hits,current.sequences[name].hits,name+' impacts');
}
assert.equal(m.facing,current.facing);
m.presentation=structuredClone(current.presentation);
m.poseBlend=current.poseBlend;
if(at>=0){
 m.presentation.weaponVolley.edgeLight={color:'#398552',radius:2};
 m.presentation.weaponVolley.travelOrigin='standby';
 const cue=(strikeOffset,targetY,swingTilt,arc)=>({strikeOffset,targetY,swingTilt,arc});
 // Body-held lead sword + five individually readable support cuts. The fifth
 // has wider cross cuts and a later finisher, but keeps the same damage node.
 m.presentation.weaponVolley.patterns={
  attack:[cue(0,.5,0,0),cue(-6,.25,-.8,.24),cue(-3,.75,.8,-.24),cue(2,.38,.6,.16),cue(5,.63,-.6,-.16),cue(9,.51,0,.06)],
  ultimate:[cue(0,.5,0,0),cue(-8,.22,-1,.30),cue(-4,.78,1,-.30),cue(2,.36,.85,.22),cue(6,.65,-.85,-.22),cue(10,.5,0,.08)],
 };
 const form=(x,y,angle,delay)=>({x,y,angle,delay});
 // Guarding fan and a short paired command: all six stay with the caster.
 // This is visual choreography, not a shield or an additional attack.
 m.presentation.weaponVolley.formations={
  cp:[form(-.68,.48,-.68,0),form(-.45,.35,-.4,.04),form(-.19,.29,-.14,.08),form(.19,.29,.14,.08),form(.45,.35,.4,.04),form(.68,.48,.68,0)],
  extra:[form(-.38,.38,-.4,.12),form(-.22,.31,-.26,.06),form(-.06,.29,-.1,0),form(.16,.29,.1,0),form(.32,.31,.26,.06),form(.48,.38,.4,.12)],
 };
}
m.production.effectSheets=current.production.effectSheets;
m.production.recoveryStudy={status:'candidate-only',bodySource:source};
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(formal,dest,{recursive:true});
fs.copyFileSync(path.join(source,'atlas.png'),path.join(dest,'atlas.png'));
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(m));
console.log('Recovery candidate staged; formal body, gameplay and desktop untouched.');
