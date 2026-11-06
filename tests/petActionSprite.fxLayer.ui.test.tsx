import assert from 'node:assert/strict';
import path from 'node:path';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
// 以正式 PetActionSprite（替身播放器，不碰 WebGL）驗證全屏層接線：第二播放器只含底片、與本體同序列同步、
// 只在全屏序列顯示、離開／卸載清乾淨；沒有全屏層時完全不啟用；第五技能 ultimate 序列映射。
const dom=new JSDOM('<div id="root"></div><div id="layer"></div>',{url:'http://localhost/',pretendToBeVisual:true});
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
 const lazyMs=await server.ssrLoadModule('/src/battle/petFxLayerRuntime.ts');
 const fake=await server.ssrLoadModule(path.join(fixtures,'fakeSwfRenderer.ts'));
 const loader=await server.ssrLoadModule(path.join(fixtures,'fakePetLoader.ts'));
 const assets=(await server.ssrLoadModule('/src/battle/petAnimationAssets.ts')).PET_ANIMATION_ASSETS;
 loader.setFakeClip(clipData);
 const elf:any={id:'343',battleId:'t1',name:'悲歌.索比拉特'};
 const layer=document.getElementById('layer')!;
 const mount=(action:string,extra:any={})=>act(async()=>root.render(React.createElement(PetActionSprite,{elf,side:'p1',action,actionToken:{n:action},width:300,height:200,assetId:'sobira',onReady(){},viewport:{width:800,height:600,anchorX:200,targetX:600},...extra})));
 // 1) 沒有全屏層（首頁／預覽）：只有本體播放器。
 await mount('standby');await settle(80);
 assert.equal(fake.instances.length,1,'沒登記 host → 不建立第二個播放器（舊行為）');
 await act(async()=>root.render(null));await settle();
 fake.instances.length=0;
 // 2) 有全屏層：本體 + 底片播放器。
 const off=fx.registerFxHost(layer);
 await mount('standby');await settle(80);
 // 2026-11-06 預載契約：本體就緒後的閒置時預載底片播放器（早於第一個全屏序列，底片不會晚出現），整場保留。
 assert.equal(layer.querySelectorAll('[data-pet-fx-layer]').length,1,'底片容器先掛好');
 await settle(lazyMs.FX_PRELOAD_FALLBACK_MS+140);
 assert.equal(fake.instances.length,2,'閒置後已預載底片播放器（全屏序列開始前）');
 const [main]=fake.instances;let back:any;
 assert.deepEqual(main.clip.sequences.find((s:any)=>s.name==='sa').frames[0].mesh.subMeshes.map((s:any)=>[s.startVertex,s.indexCount]),[[0,6]],'本體播放器不含底片（沒有重複繪製）');
 assert.equal(layer.querySelector('[data-pet-fx-layer]')!.style.visibility,'hidden','待機時底片層隱藏');assert.ok(!fx.isFullscreenFxActive());
 const standbyScale=main.transforms.at(-1).scale;
 // 3) 播全屏序列：此刻才建立底片播放器；兩邊同序列、顯示、active、精靈提層級依據 store。
 await mount('sa');await settle(60);
 assert.equal(fake.instances.length,2,'全屏序列使用已預載的底片播放器（不再建立）');back=fake.instances[1];
 assert.ok(layer.contains(back.parent)&&!layer.contains(main.parent),'底片播放器掛在全屏層，本體留在精靈容器');
 assert.deepEqual(back.options,{transparent:true,mode:'fixed',clock:'manual',signal:back.options.signal},'全屏畫布透明、固定變換、手動時鐘');
 assert.deepEqual(back.clip.sequences.find((s:any)=>s.name==='sa').frames[0].mesh.subMeshes.map((s:any)=>[s.startVertex,s.indexCount]),[[4,6]],'底片播放器只含超大圖塊');
 assert.equal(main.current,'sa');assert.equal(back.current,'sa','底片播放器同序列同步');
 assert.equal(back.parent.style.visibility,'visible');assert.ok(fx.isFullscreenFxActive(),'全屏期間 active（全屏層顯示、精靈提到全屏層之上）');
 assert.ok(back.advanced>0&&back.advanced<=main.advanced+1e-9,'以相同 dt 推進（只在全屏序列期間推進，不超前本體）');
 const t=back.transforms.at(-1);assert.ok(t&&[t.position.x,t.position.y,t.scale.x,t.scale.y].every(Number.isFinite),'底片有有效變換');
 assert.ok(Math.abs(t.scale.x)>=Math.abs(main.transforms.at(-1).scale.x),'底片縮放不小於本體（不足時 cover 放大鋪滿）');
 assert.equal(Math.sign(t.scale.x),Math.sign(main.transforms.at(-1).scale.x),'與本體同一個鏡射方向');
 assert.ok(back.draws>0,'全屏序列中有繪製底片');
 // 2026-11-01 回歸：全屏序列期間本體縮放必須與待機完全相同（尺寸只由靜態立繪可見高決定，不隨序列／底片改變）。
 const saScale=main.transforms.at(-1).scale;
 assert.equal(Math.abs(saScale.x),Math.abs(standbyScale.x),'全屏序列本體 x 縮放 = 待機');assert.equal(Math.abs(saScale.y),Math.abs(standbyScale.y),'全屏序列本體 y 縮放 = 待機');
 assert.ok(main.transforms.filter((x:any)=>Math.abs(x.scale.x)!==Math.abs(standbyScale.x)).length===0,'整段播放過程中本體縮放從未偏離待機');
 // 底片逐影格 cover：舞台 800×600，底片 400×200（baseScale 遠小於鋪滿所需）→ 縮放至少讓該影格鋪滿整層。
 assert.ok(Math.abs(t.scale.x)*400>=800-1e-6&&Math.abs(t.scale.y)*200>=600-1e-6,'底片縮放後覆蓋整個戰鬥區域（800×600）');
 // 位置也要蓋滿：用底片框（x -200..200、y 0..200，原生座標，y 向上）套上實際變換，四邊都要超出整層矩形（800×600 = 戰鬥畫面根節點全矩形，不是精靈畫布）。
 {const sx=t.scale.x,s=-t.scale.y,x0=t.position.x+(-200)*sx,x1=t.position.x+200*sx,y0=t.position.y-200*s,y1=t.position.y-0*s;
  assert.ok(Math.min(x0,x1)<=1e-6&&Math.max(x0,x1)>=800-1e-6,'底片水平方向蓋滿整層寬');assert.ok(Math.min(y0,y1)<=1e-6&&Math.max(y0,y1)>=600-1e-6,'底片垂直方向蓋滿整層高');
  assert.ok(Math.abs((x0+x1)/2-400)<1e-6&&Math.abs((y0+y1)/2-300)<1e-6,'cover 時底片框置中於整層');}
 // 4) 回到待機/非全屏序列：隱藏、清 active、不再繪製。
 await mount('cp');await settle(60);
 assert.equal(back.parent.style.visibility,'hidden','沒有底片的序列不顯示全屏層');assert.equal(fake.instances.length,2,'離開全屏序列不重建');assert.ok(!fx.isFullscreenFxActive());
 const drawsAfter=back.draws;await settle(60);assert.equal(back.draws,drawsAfter,'隱藏後不再繪製（省 GPU）');
 // 5) 第五技能 ultimate：素材登記才會映射；未登記退回 sa。
 await mount('ultimate');await settle(60);assert.equal(main.current,'sa','未登記 ultimate 序列名 → 退回 sa');
 await act(async()=>root.render(null));await settle();
 assert.ok(back.destroyed&&main.destroyed,'卸載：兩個播放器都銷毀');assert.equal(layer.querySelectorAll('[data-pet-fx-layer]').length,0,'底片容器移除');assert.ok(!fx.isFullscreenFxActive(),'卸載清 active');
 // 6) 登記 ultimate 序列。
 fake.instances.length=0;assets.sobira.fullscreen={ultimate:'attack'};
 try{await mount('standby');await settle(80);await mount('ultimate');await settle(60);assert.equal(fake.instances[0].current,'attack','登記的 ultimate 序列被播放');}
 finally{delete assets.sobira.fullscreen;}
 await act(async()=>root.render(null));await settle();
 // 7) 逐素材關閉：fullscreen.sequences=[] → 不建立第二播放器。
 fake.instances.length=0;assets.sobira.fullscreen={sequences:[]};
 try{await mount('standby');await settle(80);assert.equal(fake.instances.length,1,'登記空清單＝關閉全屏層');}finally{delete assets.sobira.fullscreen;}
 off();
 console.log('PetActionSprite 全屏層接線：雙播放器同步、僅全屏序列顯示、清理、ultimate 映射、逐素材關閉通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
