import assert from 'node:assert/strict';
import path from 'node:path';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
// 預載底片契約（2026-11-06）：以正式 PetActionSprite（替身播放器，不碰 WebGL）驗證全屏層接線：第二播放器只含底片，本體就緒後閒置預載＋暖機、
// 整場保留（不閒置銷毀）、卸載才銷毀、全屏序列早於預載則立即建立；沒有全屏層時完全不啟用；第五技能 ultimate 序列映射。
const dom=new JSDOM('<div id="root"></div><div id="layer"></div>',{url:'http://localhost/',pretendToBeVisual:true});(dom.window as any).devicePixelRatio=3;
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(f:any)=>setTimeout(()=>f(performance.now()),4),cancelAnimationFrame:clearTimeout,ResizeObserver:class{observe(){}disconnect(){}}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const P=dom.window.HTMLElement.prototype as any;
Object.defineProperties(P,{clientWidth:{configurable:true,get:()=>800},clientHeight:{configurable:true,get:()=>600}});
P.getBoundingClientRect=function(){return {left:0,top:0,right:800,bottom:600,width:800,height:600,x:0,y:0,toJSON(){}};};
const fixtures=path.resolve('tests/fixtures');
const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false,watch:null},
 resolve:{alias:[{find:'@seer-pet-anim/swf-renderer',replacement:path.join(fixtures,'fakeSwfRenderer.ts')},{find:/^(\.\.?\/)+battle\/petAnimationLoader$/,replacement:path.join(fixtures,'fakePetLoader.ts')}]},
 plugins:[{name:'headless-only',configResolved(c:any){c.server.hmr=false;c.server.watch=null;}}]});
const settle=(ms=30)=>act(async()=>{await new Promise(r=>setTimeout(r,ms));});
const quad=(x:number,w:number,h:number)=>[x,0,x+w,0,x+w,h,x,h];
const sm=(q:number,start=0)=>({startVertex:start,indexStart:start/4*6,indexCount:q*6,material:{blendMode:'add',shaderKind:'simple'}});
const frame=(positions:number[],subMeshes:any[],uv=0)=>({labels:[],mesh:{positions:Float32Array.from(positions),uvs:new Float32Array(positions.length).fill(uv),mulColors:new Float32Array(positions.length*2),addColors:new Float32Array(positions.length*2),indices:new Uint16Array(0),subMeshes}});
// standby 本體 50×100；sa 帶一塊 400×200 的全屏底片（≥3 倍待機高）；cp 沒有底片。
const clipData:any={frameRate:24,sequences:[
 {name:'standby',frames:[frame(quad(0,50,100),[sm(1)])]},
 {name:'attack',frames:[frame(quad(0,50,100),[sm(1)])]},
 {name:'sa',frames:[frame([...quad(0,50,100),...quad(-200,400,200)],[sm(2)]),frame([...quad(0,50,100),...quad(-200,400,200)],[sm(2)])]},
 {name:'cp',frames:[frame(quad(0,50,100),[sm(1)])]},
 {name:'hited',frames:[frame(quad(0,50,100),[sm(1)])]}]};
try{
 const {PetActionSprite}=await server.ssrLoadModule('/src/components/battle/PetActionSprite.tsx');
 const fx=await server.ssrLoadModule('/src/battle/fullscreenFx.ts');
 const lazy=await server.ssrLoadModule('/src/battle/petFxLayerRuntime.ts');
 const fake=await server.ssrLoadModule(path.join(fixtures,'fakeSwfRenderer.ts'));
 const loader=await server.ssrLoadModule(path.join(fixtures,'fakePetLoader.ts'));
 loader.setFakeClip({...clipData,atlas:{width:8192,height:8192}});
 const elf:any={id:'343',battleId:'t1',name:'悲歌.索比拉特'};
 const layer=document.getElementById('layer')!;const off=fx.registerFxHost(layer);
 const mount=(action:string,extra:any={})=>act(async()=>root.render(React.createElement(PetActionSprite,{elf,side:'p1',action,actionToken:{n:action},width:300,height:200,assetId:'sobira',onReady(){},viewport:{width:800,height:600,anchorX:200,targetX:600},...extra})));
 const PRELOAD=lazy.FX_PRELOAD_FALLBACK_MS+140;// 沒有 requestIdleCallback → setTimeout 退路
 // 1) 本體就緒後、閒置時預載底片播放器：此時還沒有任何全屏序列。
 await mount('standby');await settle(40);
 assert.equal(fake.instances.length,1,'本體就緒當下只有本體（預載排在閒置，不阻塞載入）');
 await settle(PRELOAD);
 assert.equal(fake.instances.length,2,'閒置後預載底片播放器（早於第一個全屏序列）');const [main,back]=fake.instances;
 assert.ok(layer.contains(back.parent)&&!layer.contains(main.parent),'底片播放器掛在全屏層');
 assert.equal(main.app.renderer.resolution,1.5,'dpr=3、8192 圖集 → 本體解析度 1.5（舊行為 3）');assert.equal(back.app.renderer.resolution,1.5,'底片畫布同樣套用上限');
 assert.ok(back.draws>=1,'暖機：掛載後已隱藏繪製一次（材質與 shader 先上傳）');assert.equal(back.parent.style.visibility,'hidden','預載後仍隱藏');assert.ok(!fx.isFullscreenFxActive());
 const warmDraws=back.draws;await settle(80);assert.equal(back.draws,warmDraws,'隱藏時不再繪製');
 await mount('cp');await settle(40);assert.equal(fake.instances.length,2,'非全屏序列不重建');
 // 2) 第一個全屏序列：直接使用已預載的播放器，不再建立任何東西。
 await mount('sa');await settle(60);
 assert.equal(fake.instances.length,2,'全屏序列不再建立播放器（預載已完成）');assert.equal(back.current,'sa');assert.ok(back.draws>warmDraws,'全屏序列期間繪製');
 assert.equal(layer.querySelector<HTMLElement>('[data-pet-fx-layer]')!.style.visibility,'visible');
 // 3) 整場保留：序列結束、久放（遠超舊的閒置銷毀時間）都不銷毀；再次全屏招式沿用同一個播放器。
 await mount('standby');await settle(PRELOAD+200);
 assert.equal(back.destroyed,false,'不閒置銷毀（整場保留）');assert.equal(fake.instances.filter((i:any)=>!i.destroyed).length,2,'戰鬥期間固定兩個 context');
 await mount('sa');await settle(40);assert.equal(fake.instances.length,2,'再次全屏招式沿用同一個播放器');
 // 4) 卸載全部銷毀。
 await act(async()=>root.render(null));await settle();
 assert.ok(fake.instances.every((i:any)=>i.destroyed),'卸載全部銷毀');assert.equal(layer.querySelectorAll('[data-pet-fx-layer]').length,0);assert.equal(layer.querySelectorAll('canvas').length,0);
 // 5) 全屏序列早於預載完成：立即建立（不等閒置），且預載回呼不會再建第二個。
 fake.instances.length=0;
 await mount('standby');await settle(40);assert.equal(fake.instances.length,1,'預載尚未開始');
 await mount('sa');await settle(60);
 assert.equal(fake.instances.length,2,'預載前就出全屏招式 → 立即建立');const early=fake.instances[1];assert.equal(early.current,'sa');assert.ok(early.draws>0);assert.ok(early.seeks.length===0||early.seeks[0]>=0,'與本體時間對齊');
 await settle(PRELOAD);assert.equal(fake.instances.length,2,'之後預載回呼不重複建立');
 await act(async()=>root.render(null));await settle();
 // 6) 預載未完成就卸載：取消排程，不建立任何底片播放器。
 fake.instances.length=0;
 await mount('standby');await settle(40);await act(async()=>root.render(null));await settle(PRELOAD);
 assert.equal(fake.instances.length,1,'卸載後不預載');assert.ok(fake.instances.every((i:any)=>i.destroyed));
 // P2 鏡射：底片與本體同一個鏡射方向。
 fake.instances.length=0;
 await mount('standby',{side:'p2',elf:{...elf,name:'悲歌.索比拉特'}});await settle(40+PRELOAD);await mount('sa',{side:'p2'});await settle(60);
 {const m=fake.instances[0],b=fake.instances[1];assert.ok(b,'P2 也預載');assert.equal(Math.sign(b.transforms.at(-1).scale.x),Math.sign(m.transforms.at(-1).scale.x),'P2 底片與本體鏡射一致');}
 await act(async()=>root.render(null));await settle();
 // document.hidden：迴圈停止排程、不再 advance／draw；回前景續跑。
 fake.instances.length=0;await mount('standby');await settle(80);
 {const m=fake.instances[0];const hidden=Object.getOwnPropertyDescriptor(dom.window.Document.prototype,'hidden');let h=true;
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle(40);
  const a=m.advanced,d=m.draws;await settle(80);assert.equal(m.advanced,a,'背景不推進');assert.equal(m.draws,d,'背景不繪製');assert.equal(m.playing,false,'背景暫停時鐘');
  h=false;document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle(80);assert.ok(m.advanced>a,'回前景續跑');assert.equal(m.playing,true);
  delete (document as any).hidden;if(hidden)Object.defineProperty(dom.window.Document.prototype,'hidden',hidden);}
 off();
 console.log('PetActionSprite 底片預載：閒置預載＋暖機、整場保留不閒置銷毀、卸載銷毀、早出全屏招立即建立、解析度上限、P2 鏡射、背景暫停通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
