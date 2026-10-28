import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {activateRelease} from '../scripts/desktop_release.mjs';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'seer-release-'));
const complete=(id,buildId)=>{const d=path.join(home,id);fs.mkdirSync(d);for(const f of ['index.html','server.cjs'])fs.writeFileSync(path.join(d,f),'valid');fs.writeFileSync(path.join(d,'version.json'),JSON.stringify({buildId}));fs.writeFileSync(path.join(d,'completion.json'),JSON.stringify({version:{buildId}}));};
try{
 complete('1','first');activateRelease(home,'1');
 const before=fs.readFileSync(path.join(home,'active.json'),'utf8');
 fs.mkdirSync(path.join(home,'2'));assert.throws(()=>activateRelease(home,'2'));assert.equal(fs.readFileSync(path.join(home,'active.json'),'utf8'),before);
 assert.throws(()=>activateRelease(home,'../1'));assert.equal(fs.readFileSync(path.join(home,'active.json'),'utf8'),before);
 complete('3','next');activateRelease(home,'3');assert.equal(JSON.parse(fs.readFileSync(path.join(home,'active.json'))).previous,'1');
 activateRelease(home,'1');assert.equal(JSON.parse(fs.readFileSync(path.join(home,'active.json'))).buildId,'first');
 assert.ok(fs.existsSync(path.join(home,'3','server.cjs')));
 console.log('未完成版本拒絕啟用、失敗保留原版本、前一版本回復與舊產物保留通過');
}finally{fs.rmSync(home,{recursive:true,force:true});}
