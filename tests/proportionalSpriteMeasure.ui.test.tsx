import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
// 以正式 ProportionalSprite 驗證：換圖（幻化／皮膚／型態）期間沿用上一次有效量測，不跳到備援尺寸；量測失敗不快取、稍後重試。
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
 const {ProportionalSprite}=await server.ssrLoadModule('/src/components/battle/ProportionalSprite.tsx');
 const {getVisibleBox}=await server.ssrLoadModule('/src/battle/visibleBox.ts');
 const elf:any={id:'x',battleId:'x',name:'測試',path:'/seer/body/70.png',height:300,artPresentation:'sprite',currentHp:10,maxHp:10};
 await act(async()=>root.render(React.createElement(ProportionalSprite,{elf,side:'p1',anchorX:300,stageW:480,stageH:FIELD_H,anim:{},dead:false,opacity:1,overlay:()=>null})));
 const sprite=()=>document.querySelector<HTMLElement>('[data-sprite-side]')!;
 const loadImg=async()=>{await act(async()=>document.querySelector('img')!.dispatchEvent(new dom.window.Event('load')));await settle();};
 await loadImg();
 const measured=sprite().dataset.spriteVisible!,opaque=sprite().dataset.spriteOpaque!;
 const box0=getVisibleBox('p1');assert.ok(box0&&opaque,'載入後有量測');
 // 換圖：src 改變但新圖尚未載入 → 不得跳回備援尺寸（fbSize）、不得清掉可見框。
 const img=document.querySelector('img')!;
 await act(async()=>{img.setAttribute('src','/seer/body/71.png');});await settle();
 assert.equal(sprite().dataset.spriteVisible,measured,'換圖載入中沿用上一次量測（visible 不跳）');
 assert.equal(sprite().dataset.spriteOpaque,opaque,'換圖載入中不透明框不被清掉');
 assert.ok(getVisibleBox('p1'),'換圖載入中可見框仍在（飄字／對位不回到備援）');
 // 新圖載入完成才切換成新量測（此處新圖量測結果相同，確認流程不卡死）。
 await loadImg();
 assert.equal(sprite().dataset.spriteVisible,measured);assert.ok(getVisibleBox('p1'));
 // 量測失敗：先以備援顯示，不快取；之後可量時改用真正的可見框。
 let failing=true;const proto=dom.window.HTMLCanvasElement.prototype as any,ok=proto.getContext;
 proto.getContext=function(...a:any[]){if(failing)return {drawImage(){throw new Error('tainted');},getImageData(){throw new Error('tainted');}};return ok.apply(this,a);};
 await act(async()=>{document.querySelector('img')!.setAttribute('src','/seer/body/72.png');});await settle();await loadImg();
 const fallbackOpaque=sprite().dataset.spriteOpaque!;
 assert.notEqual(fallbackOpaque,opaque,'失敗時退整張圖（與真實不透明框不同）');
 failing=false;
 await act(async()=>{await new Promise(r=>setTimeout(r,700));});await settle();
 assert.equal(sprite().dataset.spriteOpaque,opaque,'失敗未被快取，稍後重試後改用真實可見框');
 await act(async()=>root.render(null));
 console.log('換圖期間沿用上次量測、量測失敗不快取並重試通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
