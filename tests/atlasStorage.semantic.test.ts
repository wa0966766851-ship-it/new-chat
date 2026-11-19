import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createAtlasStorage} from '../encyclopedia/server/storage';
import {newCustomElf,initialLibrary,bookElves} from '../encyclopedia/model';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-storage-test-'));
try{
 const store=createAtlasStorage(dir),lib=initialLibrary(),elf=newCustomElf();
 lib.books.push({id:'test',name:'自訂圖鑑',builtinIds:[],custom:[elf]});lib.activeBookId='test';
 const saved=store.write(lib);assert.equal(saved.revision,1);assert.deepEqual(createAtlasStorage(dir).read(),saved);
 assert.deepEqual(bookElves(saved.books[1],[]),[elf]);assert.throws(()=>store.write(lib),/另一個視窗/);
 const bad=structuredClone(saved);bad.books[1].custom[0].path='javascript:bad';assert.throws(()=>store.write(bad));assert.deepEqual(store.read(),saved);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 assert.equal(store.image(png,'image/png'),store.image(png,'image/png'));assert.throws(()=>store.image(Buffer.from('bad'),'image/png'));
 console.log('圖鑑：多本隔離、重開保存、衝突及損壞保護、圖片去重通過');
}finally{if(path.dirname(dir)===path.resolve(os.tmpdir()))fs.rmSync(dir,{recursive:true,force:true});}
