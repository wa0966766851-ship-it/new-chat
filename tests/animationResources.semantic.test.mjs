import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {animationResources} from '../scripts/lib/animationResources.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'seer-animation-resources-'));
try{
 fs.mkdirSync(path.join(root,'art'));
 fs.writeFileSync(path.join(root,'art','sword.png'),'fixture');
 const input={weapon:{sprite:'/__animation-drafts/test/art/sword.png'},layers:[{src:'/elf-fx/shared.png'}]};
 const out=animationResources(input,'test',root);
 assert.equal(out.value.weapon.sprite,'/elf-anim/test/art/sword.png');
 assert.equal(out.value.layers[0].src,'/elf-fx/shared.png');
 assert.equal(out.files.get('art/sword.png'),path.join(root,'art','sword.png'));
 assert.equal(input.weapon.sprite,'/__animation-drafts/test/art/sword.png','source study stays untouched');
 const revision=animationResources({sprite:'/elf-anim/test/art/sword.png'},'test',root);
 assert.equal(revision.files.get('art/sword.png'),path.join(root,'art/sword.png'),'republish must retain unchanged formal sidecars');
 assert.equal(revision.value.sprite,'/elf-anim/test/art/sword.png');
 assert.throws(()=>animationResources({src:'/elf-anim/test/missing.png'},'test',root));
 assert.throws(()=>animationResources({src:'/elf-anim/test/../outside.png'},'test',root),/Invalid/);
 assert.throws(()=>animationResources({src:'/__animation-drafts/other/a.png'},'test',root),/Cross-animation/);
 assert.throws(()=>animationResources({src:'/__animation-drafts/test/../outside.png'},'test',root),/Invalid/);
 assert.throws(()=>animationResources({src:'/__animation-drafts/test/missing.png'},'test',root));
 console.log('Animation sidecars: nested rewrite, copy list, isolation and missing-resource rejection passed');
}finally{fs.rmSync(root,{recursive:true,force:true});}
