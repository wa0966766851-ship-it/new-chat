import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import path from 'node:path';
// 新版首頁動態立繪（以替身播放器）：動作模式只在條件成立時掛載；尺寸／腳底／中心取自靜態圖的不透明區域，不填滿容器；失敗與降級退回靜態圖。
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const IMG_W=1000,IMG_H=500,BOX_W=800,BOX_H=600;
let imageAvailable=true;
Object.defineProperties(dom.window.HTMLImageElement.prototype,{
 naturalWidth:{configurable:true,get:()=>imageAvailable?IMG_W:0},naturalHeight:{configurable:true,get:()=>imageAvailable?IMG_H:0},complete:{configurable:true,get:()=>true}});
// 不透明區域：x 250..750、y 100..450（圖座標）→ contain 縮放 0.8、垂直置中 offset 100
(dom.window.HTMLCanvasElement.prototype as any).getContext=function(){return {drawImage(){},getImageData:(_x:number,_y:number,w:number,h:number)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ix=x/w*IMG_W,iy=y/h*IMG_H;if(ix>=250&&ix<750&&iy>=100&&iy<450)data[(y*w+x)*4+3]=255;}return {data};}};};
Object.defineProperties(dom.window.HTMLElement.prototype,{clientWidth:{configurable:true,get:()=>BOX_W},clientHeight:{configurable:true,get:()=>BOX_H}});
(globalThis as any).ResizeObserver=class{constructor(private cb:()=>void){}observe(){this.cb();}unobserve(){}disconnect(){}};
(globalThis as any).IntersectionObserver=class{constructor(private cb:(e:any[])=>void){}observe(){this.cb([{isIntersecting:true}]);}unobserve(){}disconnect(){}};
(dom.window as any).matchMedia??=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const fake=path.resolve('tests/fixtures/fakePetActionSprite.tsx');
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false,watch:null},logLevel:'silent',
 plugins:[{name:'fake-pet-sprite',enforce:'pre',resolveId(id:string){if(/components\/battle\/PetActionSprite$/.test(id))return fake;}}]});
const settle=()=>act(async()=>{await new Promise(r=>setTimeout(r,30));});
// 動態層為延後載入（React.lazy）：輪詢到出現或逾時。
const until=async(cond:()=>boolean,ms=8000)=>{const end=Date.now()+ms;while(!cond()&&Date.now()<end)await settle();};
try{
 const {HomePetFigure}=await server.ssrLoadModule('/src/shell/art/HomePetFigure.tsx');
 const {degradePet,clearPetDegrade}=await server.ssrLoadModule('/src/battle/petAnimationRegistry.ts');
 const rey:any={id:'70',battleId:'70',name:'雷伊',path:'/seer/body/70.png',height:100};
 const other:any={id:'5036',battleId:'5036',name:'九青',path:'/elf-art/jiuqing_body.png',height:170};
 const mode=(m:string)=>{localStorage.setItem('battleAnimationSettings',JSON.stringify({mode:m,skill:true}));dom.window.dispatchEvent(new dom.window.Event('battle-animation-update'));};
 const render=(elf:any,style:React.CSSProperties={objectFit:'contain'})=>act(async()=>root.render(React.createElement(HomePetFigure,{elf,style})));
 const loaded=async()=>{await act(async()=>{for(const img of document.querySelectorAll('img'))img.dispatchEvent(new dom.window.Event('load'));});await settle();};
 const sprite=()=>document.querySelector<HTMLElement>('[data-fake-pet]');
 const staticHidden=()=>document.querySelector<HTMLElement>('img')?.style.visibility==='hidden';

 // 1. 簡易／靜態模式：完全不掛動態層。
 mode('simple');await render(rey);await loaded();assert.equal(sprite(),null,'簡易模式不載入動作');assert.equal(staticHidden(),false);
 // 2. 動作模式但該精靈沒有動作素材：不掛。
 mode('actions');await render(other);await loaded();assert.equal(sprite(),null,'沒有動作對應的精靈維持靜態圖');
 // 3. 動作模式＋有素材：尺寸取自不透明區域（500×350 圖座標 → ×0.8 = 400×280），不是整個容器 800×600。
 await render(rey);await until(()=>!!document.querySelector('[data-animation-surface] > div'));await loaded();await until(()=>!!sprite());
 const s=sprite();assert.ok(s,'動作模式掛載動態立繪');
 assert.equal(s!.getAttribute('data-context'),'home');
 // 量測以 ≤256px 取樣，邊緣最多差一個取樣格（約 4 px）；不得接近容器 800×600。
 const near=(a:number,b:number,msg:string)=>assert.ok(Math.abs(a-b)<=4,`${msg}：${a} vs ${b}`);
 near(Number(s!.getAttribute('data-w')),400,'寬＝不透明區域寬×縮放');near(Number(s!.getAttribute('data-h')),280,'高＝不透明區域高×縮放');
 const anchor=s!.parentElement!;
 near(parseFloat(anchor.style.left),400,'水平中心＝不透明區域中心');
 near(parseFloat(anchor.style.bottom),140,'腳底線＝靜態圖不透明區域底緣（容器底往上 140）');
 assert.equal(staticHidden(),true,'動態就緒後才隱藏靜態圖');
 // 4. cover 版面：矩形仍在容器內。
 await render(rey,{objectFit:'cover'});await loaded();
 const c=sprite()!;assert.ok(Number(c.getAttribute('data-w'))<=BOX_W&&Number(c.getAttribute('data-h'))<=BOX_H,'cover 不超出容器');
 assert.ok(Number(c.getAttribute('data-h'))>290,'cover 比 contain 大');
 // 5. 降級：播放失敗後卸載動態層、顯示靜態圖。
 await render(rey);await loaded();assert.ok(sprite());
 await act(async()=>degradePet('p2',rey,'load-failed'));await settle();
 assert.equal(sprite(),null,'降級後移除動態層');assert.equal(staticHidden(),false,'降級後顯示靜態圖');
 clearPetDegrade();
 // 6. 靜態圖缺檔：動態立繪退回整個容器（不卡在不量測）。
 imageAvailable=false;await render({...rey,id:'70',name:'雷伊',battleId:'70b'});await settle();
 await act(async()=>{for(const img of document.querySelectorAll('img'))img.dispatchEvent(new dom.window.Event('error'));});await settle();
 const fallback=sprite();assert.ok(fallback,'缺靜態圖時仍可播放動態立繪');
 assert.equal(Number(fallback!.getAttribute('data-w')),BOX_W);assert.equal(Number(fallback!.getAttribute('data-h')),BOX_H);
 console.log('新版首頁動態立繪：掛載條件、不透明區域對位、cover、降級、缺圖退回通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
