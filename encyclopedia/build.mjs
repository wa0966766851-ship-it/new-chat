import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const home=path.join(root,'encyclopedia/.releases');fs.mkdirSync(home,{recursive:true});
const run=(file,args)=>{const r=spawnSync(process.execPath,[file,...args],{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('圖鑑建置檢查失敗：'+file);};
const lock=path.join(home,'update.lock'),fd=fs.openSync(lock,'wx');
try{
 if(process.argv.includes('--sync'))run('node_modules/tsx/dist/cli.mjs',['encyclopedia/sync-catalog.ts']);

 run('node_modules/typescript/bin/tsc',['--noEmit','-p','encyclopedia/tsconfig.json']);
 const id=Date.now().toString(),dir=path.join(home,id);fs.mkdirSync(dir);
 run('node_modules/vite/bin/vite.js',['build','--config','encyclopedia/vite.config.ts','--outDir',dir]);
 fs.cpSync(path.join(root,'encyclopedia/catalog'),path.join(dir,'catalog'),{recursive:true});
 await build({entryPoints:['encyclopedia/server.ts'],bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',outfile:path.join(dir,'server.mjs')});
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const tempData=path.join(root,'.seer-cache/atlas-build-smoke');
 const child=spawn(process.execPath,[path.join(dir,'server.mjs')],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,ATLAS_DIST:dir,ATLAS_BUILD_ID:id,ATLAS_PORT:String(port),ATLAS_DATA_DIR:tempData}});
 try{
  let ready=false;
  for(let i=0;i<100;i++){try{const identity=await(await fetch(`http://127.0.0.1:${port}/api/atlas/identity`)).json();const html=await(await fetch(`http://127.0.0.1:${port}/`)).text();if(identity.app==='seer-encyclopedia'&&identity.build===id&&identity.pid===child.pid&&html.includes('/assets/')){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw Error('圖鑑正式版本未通過啟動與身分檢查');
  const index=await(await fetch(`http://127.0.0.1:${port}/catalog/index.json`)).json();
  if(!Array.isArray(index)||!index.length)throw Error('圖鑑展示索引未包含於版本內');
  const elf=await(await fetch(`http://127.0.0.1:${port}/catalog/${index[0].id}.json`)).json();
  if(elf.id!==index[0].id||!Array.isArray(elf.skills))throw Error('圖鑑個別資料不完整');
 }finally{child.kill();}
 fs.writeFileSync(path.join(dir,'completion.json'),JSON.stringify({id,completedAt:new Date().toISOString(),checks:'types, production HTTP and frontend identity'}));
 const previous=fs.existsSync(path.join(home,'active.json'))?JSON.parse(fs.readFileSync(path.join(home,'active.json'),'utf8')).id:undefined;
 const temp=path.join(home,'active.json.tmp');fs.writeFileSync(temp,JSON.stringify({id,previous}));fs.renameSync(temp,path.join(home,'active.json'));
 console.log('精靈圖鑑版本已就緒：'+id);
}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
