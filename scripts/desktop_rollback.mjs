import fs from 'node:fs';
import path from 'node:path';
import {activateRelease} from './desktop_release.mjs';
const home=path.join(process.cwd(),'.desktop-releases');
if(fs.existsSync(path.join(home,'update.lock')))throw Error('桌面更新進行中，不能同時回復');
const current=JSON.parse(fs.readFileSync(path.join(home,'active.json'),'utf8'));
if(!current.previous)throw Error('沒有可回復的前一完成版本');
activateRelease(home,current.previous);
console.log('已選回前一完成版本；結束目前戰鬥並關閉舊視窗後，使用原捷徑開啟。');
