import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.local-archives','20261029');
const read=name=>{const file=path.join(root,'.cleanup-audit',name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;};
const profiles=read('archive-result.json'),releases=read('release-archive-result.json');
fs.mkdirSync(output,{recursive:true});
const index={generatedAt:new Date().toISOString(),archives:profiles?.completed||[],errors:profiles?.errors||[],
  protectedDesktop:profiles?.protectedDesktop,protectedReleaseVersions:releases?.protectedVersions,
  historicalReleases:releases?{moved:releases.moved,deduplicated:releases.deduplicated}:null};
fs.writeFileSync(path.join(output,'INDEX.json'),JSON.stringify(index,null,2));
const lines=['# 本機封存與還原','','此目錄不加入 Git，包含舊測試瀏覽器資料、實驗副本與歷史成品。保留此索引與各 ZIP，勿只留下捷徑。',
  '',`目前已有 ${index.archives.length} 個完整壓縮備份；詳見 INDEX.json 的來源、容量及核對紀錄。`,
  '', '## 還原測試資料與實驗','','在專案根目錄執行（需要 Python）：','',
  '```powershell','python scripts/archive_workspace_artifacts.py --restore ".local-archives/20261029/browser-profiles/檔名.zip"','```',
  '', '工具會逐檔驗證後還原到新的 build/restored/ 目錄，保留原本的相對路徑，不覆蓋目前專案。也能使用支援 ZIP64 的解壓工具查看；時間等中繼資料另存於 ZIP 內 _archive/manifest.json。',
  '', '## 歷史 EXE','','releases/ 按版本保留原安裝器與 ZIP。INDEX.json 的 historicalReleases.deduplicated 記錄被去除的重複 EXE、保留 ZIP、其中的檔名與 SHA-256。從對應 ZIP 解壓即可取回；網路安裝器與 payload 同版保存。',
  '', '完整測試瀏覽器備份保留檔案內容；Windows 加密憑證及權限不保證能跨電腦還原。封存是本機復原用途，不能把其中的瀏覽器個人資料放到公開網站或版本庫。',''];
fs.writeFileSync(path.join(output,'README.md'),lines.join('\n'));
console.log(JSON.stringify({archives:index.archives.length,historicalFiles:index.historicalReleases?.moved.length||0}));
