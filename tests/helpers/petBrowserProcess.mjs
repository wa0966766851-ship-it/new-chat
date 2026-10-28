import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 找可用的 Chromium 系瀏覽器：PET_TEST_BROWSER → Windows Edge／Chrome → Linux/Mac 常見位置 → Playwright 內建 Chromium。找不到回 null（呼叫端應跳過，不是失敗）。 */
export function findPetTestBrowser() {
 const candidates=[process.env.PET_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
 const playwright=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';
 try{for(const dir of fs.readdirSync(playwright).filter(d=>/^chromium(_headless_shell)?-\d+$/.test(d)))for(const rel of ['chrome-linux/chrome','chrome-linux/headless_shell','chrome-win/chrome.exe','chrome-mac/Chromium.app/Contents/MacOS/Chromium'])candidates.push(path.join(playwright,dir,rel));}catch{}
 return candidates.find(file=>file&&fs.existsSync(file))||null;
}
/** 每次測試唯一的 user-data-dir；Windows 用 %TEMP%，其他平台用系統暫存目錄。 */
export function petTestProfile() {return path.join(process.env.TEMP||os.tmpdir(),'seer-pet-test-'+Date.now()+'-'+Math.floor(Math.random()*1e6));}
/** 啟動 headless 瀏覽器並開 DevTools 埠。root 帳號下的 Chromium 需 --no-sandbox。 */
export function launchPetTestBrowser(browser,port,profile) {
 const sandbox=process.platform!=='win32'&&typeof process.getuid==='function'&&process.getuid()===0?['--no-sandbox']:[];
 // 軟體繪圖只供無 GPU 的 CI；不能拿它的逾時／速度推論使用者顯卡表現。
 const softwareGpu=process.env.PET_TEST_SOFTWARE_GPU==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
 return spawn(browser,['--edge-skip-compat-layer-relaunch','--headless=new','--no-first-run','--no-default-browser-check',...softwareGpu,...sandbox,`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
}
/** Edge 可重新啟動為另一 PID；只終止本次唯一測試 profile，不碰一般瀏覽器。 */
export function closePetTestBrowser(proc,profile) {
 if(process.platform!=='win32'){proc.kill();try{fs.rmSync(profile,{recursive:true,force:true});}catch{}return;}
 spawnSync('powershell.exe',['-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:SEER_TEST_PROFILE) -and $_.CommandLine -notlike '*--type=*' } | ForEach-Object { & taskkill.exe /PID $_.ProcessId /T /F | Out-Null }"],{windowsHide:true,stdio:'ignore',env:{...process.env,SEER_TEST_PROFILE:profile}});
}
