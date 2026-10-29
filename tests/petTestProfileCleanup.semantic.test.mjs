import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {petTestProfile,removeClosedPetTestProfile,findPetTestBrowser,launchPetTestBrowser,closePetTestBrowser} from './helpers/petBrowserProcess.mjs';

const owned=petTestProfile();
const foreign=fs.mkdtempSync(path.join(os.tmpdir(),'seer-profile-cleanup-guard-'));
try {
 fs.mkdirSync(path.join(owned,'Default','Cache'),{recursive:true});
 fs.writeFileSync(path.join(owned,'Default','Cache','synthetic-test'),'temporary');
 fs.writeFileSync(path.join(foreign,'keep'),'not owned');
 assert.throws(()=>removeClosedPetTestProfile(foreign),/拒絕/);
 assert.equal(fs.readFileSync(path.join(foreign,'keep'),'utf8'),'not owned');
 assert.throws(()=>removeClosedPetTestProfile(path.join(owned,'..')),/拒絕/);
 assert.equal(removeClosedPetTestProfile(owned),true);
 assert.equal(fs.existsSync(owned),false);
 assert.throws(()=>removeClosedPetTestProfile(owned),/拒絕/);
 console.log('PASS: owned temporary profile removed; foreign and parent paths refused');
} finally {
 // Resolved fixture targets are checked before native removal.
 for(const target of [owned,foreign])if(path.dirname(path.resolve(target))===path.resolve(os.tmpdir())||path.dirname(path.resolve(target))===path.resolve(process.env.TEMP||os.tmpdir()))fs.rmSync(target,{recursive:true,force:true});
}

if(process.argv.includes('--browser')) {
 const browser=findPetTestBrowser();
 assert.ok(browser,'browser integration requested but no browser found');
 const profile=petTestProfile(),proc=launchPetTestBrowser(browser,0,profile);
 let ready=false;
 try {
  for(let i=0;i<40;i++) {
   if(fs.existsSync(path.join(profile,'Local State'))){ready=true;break;}
   if(proc.exitCode!==null)break;
   await new Promise(resolve=>setTimeout(resolve,250));
  }
 } finally {closePetTestBrowser(proc,profile);}
 assert.equal(ready,true,'isolated test browser must create its profile');
 assert.equal(fs.existsSync(profile),false,'closed browser profile must be reclaimed');
 console.log('PASS: real isolated browser closed and its temporary profile reclaimed');
}
