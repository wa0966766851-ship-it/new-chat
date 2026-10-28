#!/usr/bin/env node
/**
 * 精靈動作瀏覽器測試（petAnimation／petBattle）一鍵執行：
 *   0. 先跑 tests/petChunksLoad.browser.test.mjs（不需素材：dist 的 vendor-pet-* 與解析 Worker 能載入、Buffer 就緒；沒有 dist 則自行跳過）。
 *   1. 找不到瀏覽器、或沒有動作素材（本機 U 端／官方快取；雲端通常沒有）→ 明確印出「跳過」並以 0 結束。
 *      要把跳過視為失敗（例如驗收機）：設 PET_TEST_REQUIRE=1。
 *   2. 缺少或過期的預覽頁（.seer-cache/animation-preview）→ 先用 tests/fixtures/petAnimation.vite.config.ts 建置。
 *   3. 啟動 tests/servePetAnimationPreview.ts（預設埠 3013，PET_PREVIEW_PORT 可改），輪詢就緒後依序執行兩個測試，
 *      並為各測試設好 PET_TEST_URL；不論成功失敗都關閉服務。
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {findPetTestBrowser} from '../tests/helpers/petBrowserProcess.mjs';

const root=path.resolve(import.meta.dirname,'..');
const port=Number(process.env.PET_PREVIEW_PORT||3013),base=`http://127.0.0.1:${port}`;
const require_=process.env.PET_TEST_REQUIRE==='1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const skip=reason=>{console.log(`[test:pet-browser] 跳過：${reason}`);process.exit(require_?1:0);};
const run=(args,env={})=>new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,...env}});child.on('exit',code=>resolve(code??1));});

if(!findPetTestBrowser())skip('找不到 Edge／Chrome／Chromium（可用 PET_TEST_BROWSER 指定瀏覽器路徑）');

// 區塊載入檢查不需要素材（只看 dist 的模組求值順序）；先跑，失敗就不必等預覽頁建置。
{const code=await run(['tests/petChunksLoad.browser.test.mjs']);if(code)process.exit(code);}

// 預覽頁：缺少或比來源舊就重建。
const page=path.join(root,'.seer-cache/animation-preview/tests/fixtures/petAnimationPreview.html');
const newest=dir=>{let t=0;const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(tsx?|css|html)$/.test(e.name))t=Math.max(t,fs.statSync(f).mtimeMs);}};walk(dir);return t;};
const sources=['src/battle','src/components','src/data','server','tests/fixtures'].map(d=>path.join(root,d));
if(!fs.existsSync(page)||fs.statSync(page).mtimeMs<Math.max(...sources.map(newest))){
 console.log('[test:pet-browser] 建置動畫預覽頁…');
 const code=await run([path.join(root,'node_modules/vite/bin/vite.js'),'build','--config','tests/fixtures/petAnimation.vite.config.ts']);
 if(code)process.exit(code);
}

const server=spawn(process.execPath,['--import','tsx','tests/servePetAnimationPreview.ts'],{cwd:root,stdio:['ignore','inherit','inherit'],env:{...process.env,PET_PREVIEW_PORT:String(port)}});
let exited=false;server.on('exit',()=>{exited=true;});
const stop=()=>{if(!exited)server.kill();};
process.on('SIGINT',()=>{stop();process.exit(130);});process.on('SIGTERM',()=>{stop();process.exit(143);});
let code=1;
try{
 let status=null;
 for(let i=0;i<120&&!exited;i++){try{const r=await fetch(`${base}/api/pet-animations/status`);if(r.ok){status=await r.json();break;}}catch{}await sleep(500);}
 if(!status){console.error('[test:pet-browser] 預覽服務未能啟動');code=1;}
 else{
  // 沒有素材就嘗試向官方白名單取一次；仍取不到 → 跳過。
  if(!status.rey70){for(const key of ['rey70','materials']){try{await fetch(`${base}/api/pet-animations/bundle/${key}`,{signal:AbortSignal.timeout(30000)}).then(r=>r.arrayBuffer());}catch{}}
   status=await (await fetch(`${base}/api/pet-animations/status`)).json();}
  if(!status.rey70){stop();skip('沒有精靈動作素材（本機 U 端 launcher/animation-source.local.json、SEER_PET_CACHE_ROOT 或官方快取皆不可用）');}
  code=await run(['tests/petAnimation.browser.test.mjs'],{PET_TEST_URL:`${base}/tests/fixtures/petAnimationPreview.html`});
  if(code===0)code=await run(['tests/petBattle.browser.test.mjs'],{PET_TEST_URL:`${base}/tests/fixtures/petBattlePreview.html`});
 }
}finally{stop();}
process.exit(code);
