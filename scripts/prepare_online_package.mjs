import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist-online');
const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!fs.existsSync(path.join(output, 'signal.cjs')) || !fs.existsSync(path.join(output, 'online.html'))) {
  throw Error('缺少連線版本的網頁或服務建置');
}
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({
  name: 'seer-online', private: true, version, type: 'commonjs',
  engines: {node: '>=22'}, scripts: {start: 'node signal.cjs'},
}, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'server/p2p.env.example'), path.join(output, '.env.example'));
fs.writeFileSync(path.join(output,'build-complete.json'),JSON.stringify({version,builtAt:new Date().toISOString()}));
console.log('獨立連線版本已加入啟動資訊及環境設定範例');
