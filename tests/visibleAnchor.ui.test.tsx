import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
// 以正式 ProportionalSprite 驗證：getVisibleBox 取得「透明邊以內」的可見框；飄字錨點跟著可見框；resize／換邊後重算。
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
Object.defineProperties(dom.window.HTMLImageElement.prototype,{naturalWidth:{configurable:true,get:()=>200},naturalHeight:{configurable:true,get:()=>200},complete:{configurable:true,get:()=>false}});
(dom.window.HTMLCanvasElement.prototype as any).getContext=function(){return {drawImage(){},getImageData:(_x:number,_y:number,w:number,h:number)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=20;y<180;y++)for(let x=10;x<110;x++)data[(y*w+x)*4+3]=255;return {data};}};};
const FIELD_H=600;
// 簡易版面：sprite 根在 (anchorX, 地面)；img 的外框 div 以 left/bottom/width/height 絕對定位
const rectOf=(l:number,t:number,w:number,h:number)=>({left:l,top:t,right:l+w,bottom:t+h,width:w,height:h,x:l,y:t,toJSON(){}});
dom.window.HTMLElement.prototype.getBoundingClientRect=function(this:HTMLElement){
 if(this.hasAttribute('data-sprite-side'))return rectOf(parseFloat(this.style.left||'0'),FIELD_H-parseFloat(this.style.bottom||'0'),0,0) as any;
 if(this.tagName==='IMG'){const p=this.parentElement!,root=p.parentElement!;const ax=parseFloat(root.style.left||'0'),w=parseFloat(p.style.width),h=parseFloat(p.style.height),l=ax+parseFloat(p.style.left),b=parseFloat(p.style.bottom);return rectOf(l,root.getBoundingClientRect().bottom-b-h,w,h) as any;}
 return rectOf(0,0,0,0) as any;};
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false,watch:null},plugins:[{name:'headless-only',configResolved(c:any){c.server.hmr=false;c.server.watch=null;}}]});
const settle=()=>act(async()=>{await new Promise(r=>setTimeout(r,10));});
try{
 const {ProportionalSprite,AnchoredToVisible}=await server.ssrLoadModule('/src/components/battle/ProportionalSprite.tsx');
 const {getVisibleBox}=await server.ssrLoadModule('/src/battle/visibleBox.ts');
 const {battleSpriteSizeRatio,BATTLE_GROUND_LIFT}=await server.ssrLoadModule('/src/battle/spriteMetrics.ts');
 // 一般立繪貼地；咤克斯另有刻意放大、下沉與向外站位的專屬取景，不能混用。
 const elf:any={id:'x',battleId:'x',name:'測試',path:'/seer/body/70.png',height:300,artPresentation:'sprite',currentHp:10,maxHp:10};
 const render=(side:'p1'|'p2',stageH:number,anchorX=300)=>act(async()=>root.render(React.createElement(ProportionalSprite,{elf,side,anchorX,stageW:480,stageH,anim:{},dead:false,opacity:1,
  overlay:()=>React.createElement(AnchoredToVisible,{side,fraction:.28,fallbackBottom:7,className:'pop'},'x')})));
 const loaded=async()=>{await act(async()=>document.querySelector('img')!.dispatchEvent(new dom.window.Event('load')));await settle();};
 await render('p1',FIELD_H);await loaded();
 const pop=()=>document.querySelector<HTMLElement>('.pop')!;
 const box=getVisibleBox('p1')!;assert.ok(box,'載入後有可見框');
 const img=document.querySelector('img')!.getBoundingClientRect();
 // 不透明區 x:10..110（共 200）→ 可見框比整張圖窄，且扣掉透明邊
 assert.ok(box.right-box.left<img.width*.6&&box.left>img.left&&box.bottom<=img.bottom&&box.top>img.top,`可見框應小於圖片框：${JSON.stringify(box)} vs ${img.left},${img.top},${img.width}`);
 const ground=FIELD_H*(1-BATTLE_GROUND_LIFT);
 assert.ok(Math.abs(box.bottom-ground)<1.5,'腳底貼地：可見框底緣即地平線');
 const cx=(box.left+box.right)/2;
 assert.ok(Math.abs(cx-300)<1.5,'可見框水平置中於錨點');
 const expectBottom=ground-(box.top+(box.bottom-box.top)*.28);
 assert.ok(Math.abs(parseFloat(pop().style.bottom)-expectBottom)<1.5,`飄字 y 在可見框上緣下 28%（期望 ${expectBottom}，實際 ${pop().style.bottom}）`);
 assert.ok(Math.abs(parseFloat(pop().style.left)-(cx-300))<1.5,'飄字 x 在可見框中心');
 // resize：場地高度減半 → 可見框與飄字重算
 await render('p1',FIELD_H/2);await settle();
 const small=getVisibleBox('p1')!;assert.ok(small.bottom-small.top<(box.bottom-box.top)*.75,'resize 後可見框縮小');
 assert.ok(Math.abs(parseFloat(pop().style.bottom)-(FIELD_H-FIELD_H/2*BATTLE_GROUND_LIFT-(small.top+(small.bottom-small.top)*.28)))<1.5,'resize 後飄字跟著重算');
 // 可見框一律遵守單一比例來源：寬度不超出舞台
 assert.ok(small.right-small.left<=480+1e-6);
 assert.equal(document.querySelector<HTMLElement>('[data-sprite-side]')!.dataset.spriteRatio,battleSpriteSizeRatio(300).toFixed(2));
 // 換邊（P2 鏡射）：不透明區位置鏡射，可見框仍以錨點為中心
 await act(async()=>root.render(null));await render('p2',FIELD_H,900);await loaded();
 const b2=getVisibleBox('p2')!;assert.ok(b2&&Math.abs((b2.left+b2.right)/2-900)<1.5,'P2 鏡射後仍置中於錨點');
 await act(async()=>root.render(null));assert.equal(getVisibleBox('p2'),null,'卸載後登錄解除');
 console.log('可見框（扣透明邊、貼地、置中）、飄字錨點、resize 與鏡射重算通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
