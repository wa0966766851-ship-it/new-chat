#!/usr/bin/env node
/**
 * 以專案內 .tmp-esbuild 當暫存目錄執行指令（跨平台）。
 *
 * 為什麼：Windows 上 esbuild 會把原生執行檔／工作檔放進 %TEMP%，遇到防毒、權限或受控資料夾時
 * 出現「esbuild Access is denied」而建置失敗。把 TEMP／TMP／TMPDIR 指到專案內可寫目錄即可避開，
 * 且不需要使用者改系統設定。目錄已列入 .gitignore，不會被提交或打包。
 *
 * 用法：node scripts/with_tmp.mjs <指令> [參數…]   例：node scripts/with_tmp.mjs npm run build:steps
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir=path.resolve(import.meta.dirname,'..','.tmp-esbuild');
fs.mkdirSync(dir,{recursive:true});
// 只清掉超過一天的殘留檔；不碰這次可能同時使用中的檔案。
try{for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);if(Date.now()-fs.statSync(file).mtimeMs>86_400_000)fs.rmSync(file,{recursive:true,force:true});}}catch{}
const [command,...args]=process.argv.slice(2);
if(!command){console.error('用法：node scripts/with_tmp.mjs <指令> [參數…]');process.exit(2);}
const child=spawn(command,args,{stdio:'inherit',shell:true,env:{...process.env,TEMP:dir,TMP:dir,TMPDIR:dir}});
child.on('exit',(code,signal)=>process.exit(code??(signal?1:0)));
child.on('error',error=>{console.error(error);process.exit(1);});
