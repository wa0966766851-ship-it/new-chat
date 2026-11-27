import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {catalogFingerprint,catalogIsCurrent} from '../encyclopedia/catalogFreshness';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'seer-atlas-freshness-'));
try{
 fs.mkdirSync(path.join(root,'src/data'),{recursive:true});
 fs.writeFileSync(path.join(root,'src/data/elf.ts'),'export const name="舊版"');
 const before=catalogFingerprint(root);
 fs.mkdirSync(path.join(root,'library'));
 fs.writeFileSync(path.join(root,'library/library.json'),'personal');
 assert.equal(catalogFingerprint(root),before,'個人圖鑑不會使內建快取失效');
 fs.writeFileSync(path.join(root,'src/data/elf.ts'),'export const name="新版"');
 assert.notEqual(catalogFingerprint(root),before,'精靈內容變更會被發現');
 const catalog=path.join(root,'catalog');fs.mkdirSync(catalog);
 const fingerprint=catalogFingerprint(root);
 fs.writeFileSync(path.join(catalog,'index.json'),JSON.stringify([{id:'5000'}]));
 fs.writeFileSync(path.join(catalog,'version.json'),JSON.stringify({fingerprint,count:1}));
 assert.equal(catalogIsCurrent(catalog,fingerprint),false,'缺少介紹時重新同步');
 fs.writeFileSync(path.join(catalog,'5000.json'),'{}');
 assert.equal(catalogIsCurrent(catalog,fingerprint),true);
 assert.equal(catalogIsCurrent(catalog,before),false);
 fs.writeFileSync(path.join(catalog,'version.json'),'invalid');
 assert.equal(catalogIsCurrent(catalog,fingerprint),false,'損壞快取不會誤認已同步');
 console.log('圖鑑來源更新辨識、個人資料隔離與不完整快取恢復通過');
}finally{fs.rmSync(root,{recursive:true,force:true});}
