import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAtlasContent} from '../encyclopedia/content';
import {createAtlasStorage} from '../encyclopedia/server/storage';
import os from 'node:os';
import path from 'node:path';
const input=JSON.parse(fs.readFileSync('encyclopedia/templates/content.example.json','utf8'));
const lib=parseAtlasContent(input);
assert.equal(lib.activeBookId,lib.books[0].id);
assert.deepEqual(lib.books[0].sources,input.sources);
assert.equal(lib.books[0].custom[0].skills[0].description,input.elves[0].skills[0].description);
assert.equal(lib.books[0].custom[0].skills[0].accuracy,95);
assert.notEqual(lib.books[0].custom[0].id,parseAtlasContent(input).books[0].custom[0].id);
const bad=structuredClone(input);delete bad.elves[0].baseStats.speed;
assert.throws(()=>parseAtlasContent(bad),/種族/);
assert.throws(()=>parseAtlasContent({...input,sources:undefined}),/sources/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-blank-test-'));
const previous=process.env.ATLAS_BLANK;
try{
 process.env.ATLAS_BLANK='1';const blank=createAtlasStorage(dir).read();
 assert.equal(blank.edition,'blank');assert.deepEqual(blank.books[0].builtinIds,[]);assert.deepEqual(blank.books[0].custom,[]);
 const saved=createAtlasStorage(dir).write({...blank,books:[...blank.books,...lib.books]});
 assert.equal(saved.books.length,2);assert.equal(saved.books[1].custom[0].name,input.elves[0].name);
 assert.equal(createAtlasStorage(dir).read().edition,'blank');
 console.log('AI內容驗證、來源保留、缺失數值拒絕、空白版預設與匯入保存通過');
}finally{
 if(previous===undefined)delete process.env.ATLAS_BLANK;else process.env.ATLAS_BLANK=previous;
 if(path.dirname(dir)===path.resolve(os.tmpdir()))fs.rmSync(dir,{recursive:true,force:true});
}
