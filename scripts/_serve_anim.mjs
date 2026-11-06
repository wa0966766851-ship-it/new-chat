import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/影片/新增資料夾/對戰模擬器/docs/動畫方案對比';
const MIME = { '.gif':'image/gif', '.png':'image/png', '.json':'application/json', '.html':'text/html; charset=utf-8' };
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') {
    const files = fs.readdirSync(ROOT).filter(f=>/\.(gif|png)$/i.test(f));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><meta charset="utf-8"><title>墜星動畫方案對比</title>
<style>body{background:#111;color:#ddd;font-family:system-ui;margin:0;padding:24px}
h2{color:#6cf;border-bottom:1px solid #333;padding-bottom:8px}
img{max-width:100%;background:#000;border:1px solid #333;margin:8px 0 24px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}</style>
<h1>墜星動畫方案對比</h1>
<h2>A 部件骨骼（採用）</h2><img src="/A_部件骨骼.gif">
<h2>三方案並排</h2><img src="/三方案並排比較.png">
<h2>B 全圖網格</h2><img src="/B_全圖網格.gif">
<h2>C 部件剛體</h2><img src="/C_部件剛體.gif">
<h2>最終版連續幀</h2><div class="row">
<img src="/standby_sheet.png"><img src="/sa_sheet.png">
<img src="/ultimate_sheet.png"><img src="/hited_sheet.png"></div>`);
    return;
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200,{'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
srv.listen(8899, '127.0.0.1', ()=>console.log('LISTENING http://127.0.0.1:8899/'));
