import express from 'express';
import path from 'node:path';
import {registerPetAnimations} from '../server/petAnimations';
async function main(){
 const app=express();registerPetAnimations(app,process.cwd());
 // 驗收不依賴另外啟動的正式網站，先供應相同的本機圖片。
 app.use(express.static(path.resolve('public'),{index:false}));
 const dev=process.argv.includes('--dev'),port=Number(process.env.PET_PREVIEW_PORT||(dev?3015:3013));
 const {createServer}=await import('node:http');const server=createServer(app);
 if(dev){
  const {createServer:createViteServer}=await import('vite');
  const vite=await createViteServer({configFile:path.resolve('tests/fixtures/petAnimation.vite.config.ts'),server:{middlewareMode:true,proxy:{},watch:null,hmr:{server}}});
  app.use(vite.middlewares);
  server.on('close',()=>{void vite.close();});
 }else app.use(express.static(path.resolve('.seer-cache/animation-preview')));
 server.on('error',error=>{console.error('驗收服務啟動失敗；不會停止其他服務。',error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`正式對戰動畫驗收（${dev?'即時來源':'建置產物'}）：http://127.0.0.1:${port}/tests/fixtures/petBattlePreview.html`));
}
void main();
