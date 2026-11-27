import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createP2PSignalRouter } from './p2pSignal';

const app = express();
app.disable('x-powered-by');
const webRoot = path.resolve(process.env.SEER_P2P_WEB_ROOT || (fs.existsSync('online.html') && fs.existsSync('signal.cjs') ? '.' : 'dist-online'));
const buildFile=path.join(webRoot,'build-complete.json');
const build=fs.existsSync(buildFile)?JSON.parse(fs.readFileSync(buildFile,'utf8')).builtAt:'development';
app.get('/api/p2p/identity', (_req,res)=>res.json({app:'seer-online',pid:process.pid,root:webRoot,build}));
app.use('/api/p2p', createP2PSignalRouter(process.env, req => process.env.SEER_P2P_PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`));
app.use('/api', (_req, res) => { res.status(404).json({ error: '找不到連線服務' }); });
if (fs.existsSync(path.join(webRoot, 'online.html'))) {
  app.use((req, res, next) => {
    if (/\.cjs$/i.test(req.path)) { res.sendStatus(404); return; }
    next();
  });
  app.use(express.static(webRoot, { index: false, dotfiles: 'deny' }));
  app.get('/', (_req, res) => res.sendFile(path.join(webRoot, 'online.html')));
}
const port = Number(process.env.SEER_P2P_PORT || 3091);
app.listen(port, process.env.SEER_P2P_HOST || '127.0.0.1', () => {
  console.log(`雙人連線服務已啟動（連接埠 ${port}）`);
});
