import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {createAtlasStorage} from './server/storage';
import {renderAtlasExport} from './server/export';

const root=path.resolve(process.env.ATLAS_ROOT||process.cwd());
const data=path.resolve(process.env.ATLAS_DATA_DIR||path.join(process.env.LOCALAPPDATA||root,'SeerEncyclopedia'));
const storage=createAtlasStorage(data),app=express(),port=Number(process.env.ATLAS_PORT||3177);
app.disable('x-powered-by');
app.use('/catalog',(req,res,next)=>{if(process.env.ATLAS_BLANK==='1')return res.status(404).end();next();},express.static(process.env.ATLAS_CATALOG_DIR||path.join(process.env.ATLAS_DIST||path.join(root,'encyclopedia'),'catalog'),{index:false,maxAge:0,setHeaders:res=>res.setHeader('Cache-Control','no-store')}),(_req,res)=>{res.status(404).end();});
app.use('/api/atlas',(req,res,next)=>{if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return res.status(403).json({error:'請從圖鑑視窗進行操作'});res.setHeader('Cache-Control','no-store');next();});
app.get('/api/atlas/identity',(_req,res)=>res.json({app:'seer-encyclopedia',root,data,pid:process.pid,build:process.env.ATLAS_BUILD_ID||'development'}));
app.get('/api/atlas/library',(_req,res)=>{try{res.json(storage.read());}catch{res.status(500).json({error:'圖鑑存檔無法讀取，原檔已保留。請使用備份恢復。'});}});
app.put('/api/atlas/library',express.json({limit:'64mb'}),(req,res)=>{try{res.json(storage.write(req.body));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/atlas/images',express.raw({type:'image/*',limit:'12mb'}),(req,res)=>{try{res.json({url:storage.image(Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0),req.headers['content-type']||'')});}catch(e){res.status(400).json({error:e.message});}});
app.use('/atlas-images',express.static(storage.images,{immutable:true,maxAge:'1y'}));
let exporting=false;
app.post('/api/atlas/export',express.json({limit:'8kb'}),async(req,res)=>{
 if(exporting)return res.status(409).json({error:'目前有一份檔案正在匯出，請完成後再試'});
 const {bookId,elfId,format}=req.body||{};
 if(typeof bookId!=='string'||typeof elfId!=='string'||!['png','pdf'].includes(format)||format==='png'&&!elfId)return res.status(400).json({error:'請選擇要匯出的精靈及檔案格式'});
 if(!storage.read().books.some(b=>b.id===bookId))return res.status(404).json({error:'找不到圖鑑'});
 exporting=true;
 try{const bytes=await renderAtlasExport(`http://127.0.0.1:${port}/`,bookId,elfId,format);res.type(format==='png'?'image/png':'application/pdf').setHeader('Content-Disposition',`attachment; filename="encyclopedia.${format}"`);res.end(bytes);}catch(e){res.status(500).json({error:e.message||'匯出失敗'});}finally{exporting=false;}
});
// 沿用本專案的官方靜態素材與快取，不啟動戰鬥服務。
app.get('/seer/:kind/:file',async(req,res)=>{
 const {kind,file}=req.params;
 if(!['head','body','type','xi'].includes(kind)||!/^\d+\.png$/.test(file)&&!(kind==='type'&&file==='prop.png'))return res.status(404).end();
 const cached=path.join(root,'.seer-cache',kind,file);
 const candidates=[path.join(root,'public','seer',kind,file),cached,...(kind==='xi'?[path.join(root,'系',file)]:[])];
 for(const p of candidates)if(fs.existsSync(p))return res.sendFile(p);
 if(kind==='xi')return res.status(404).end();
 const remote=`https://raw.githubusercontent.com/SeerAPI/seer-unity-assets/main/newseer/assets/art/ui/assets/${kind==='type'?'pettype':'pet/'+kind}/${file}`;
 try{const r=await fetch(remote,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>24*1024*1024||bytes.readUInt32BE(0)!==0x89504e47)throw Error();fs.mkdirSync(path.dirname(cached),{recursive:true});fs.writeFileSync(cached,bytes);res.type('png').end(bytes);}catch{res.status(404).end();}
});
app.use(express.static(path.join(root,'public'),{index:false}));
if(process.env.ATLAS_DEV==='1'){
 const {createServer}=await import('vite');const vite=await createServer({configFile:path.join(root,'encyclopedia/vite.config.ts'),server:{middlewareMode:true,hmr:false}});app.use(vite.middlewares);
}else{
 const dist=path.resolve(process.env.ATLAS_DIST||path.join(root,'encyclopedia/dist'));app.use(express.static(dist,{setHeaders:(res,file)=>{if(file.endsWith('.html'))res.setHeader('Cache-Control','no-store');}}));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
}
app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(400).json({error:err.type==='entity.too.large'?'檔案超過大小上限':err.message||'無法完成操作'}));
app.listen(port,'127.0.0.1',()=>console.log(`精靈圖鑑：http://127.0.0.1:${port} · 資料：${data}`));
