/** Tool integration: partial transparency must survive the actual export build. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(path.resolve('.seer-cache/fx-tools/node_modules/sharp'));
const temp=fs.mkdtempSync(path.resolve('build/fx-alpha-test-'));
const dir=path.join(temp,'sources/1/fx');fs.mkdirSync(dir,{recursive:true});
const rgba=Buffer.alloc(16*16*4);for(let i=0;i<rgba.length;i+=4){rgba[i+2]=255;rgba[i+3]=64;}
await sharp(rgba,{raw:{width:16,height:16,channels:4}}).png().toFile(path.join(dir,'sa_000.png'));
const spec=path.join(temp,'spec.json'),out=path.join(temp,'out');
fs.writeFileSync(spec,JSON.stringify({'test/sa':{layers:[{src:1,seq:'sa',from:0,to:0}]}}));
const result=spawnSync(process.execPath,['tools/fx-extract/build_sheets_hd.mjs','--spec',spec,'--frames',path.join(temp,'sources'),'--out',out,'--cell','128'],{encoding:'utf8',windowsHide:true});
assert.equal(result.status,0,result.stderr);
const pixels=await sharp(path.join(out,'test/sa.jpg')).raw().toBuffer();
const max=Math.max(...pixels);assert.ok(max>=55&&max<=75,'25% opacity blue must remain about 64, not become opaque 255');
const meta=JSON.parse(fs.readFileSync(path.join(out,'sheet_res.json')));
const {cell:[w,h],cols,frames}=meta['test/sa'];
const tail=await sharp(path.join(out,'test/sa.jpg')).extract({left:(frames-1)%cols*w,top:Math.floor((frames-1)/cols)*h,width:w,height:h}).raw().toBuffer();
assert.ok(Math.max(...tail)<4,'final fade frame must be black');
console.log('Actual effect build preserves partial alpha and fades to transparent black.');
