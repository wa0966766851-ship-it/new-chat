import assert from 'node:assert/strict';
import type {SwfClipData,SwfSubMesh} from '@seer-pet-anim/swf-bundle';
import {preparePetFx,isLargeAddQuad} from '../src/battle/petFxPolicy';
const quad=(x:number,w:number,h:number)=>[x,0,x+w,0,x+w,h,x,h];
const ranges=(blendMode='add',shaderKind='simple',q=3)=>({startVertex:0,indexStart:0,indexCount:q*6,material:{blendMode,shaderKind}} as SwfSubMesh);
const frame=(positions:number[],subMeshes:SwfSubMesh[])=>({labels:['action_hit'],mesh:{positions:Float32Array.from(positions),uvs:new Float32Array(positions.length),mulColors:new Float32Array(positions.length*2),addColors:new Float32Array(positions.length*2),indices:Uint16Array.from(Array.from({length:positions.length/8},(_,q)=>[q*4,q*4+1,q*4+2,q*4,q*4+2,q*4+3]).flat()),subMeshes}});
const idle=frame(quad(0,50,100),[ranges('normal','simple',1)]);
const mixed=frame([...quad(0,10,20),...quad(20,400,200),...quad(420,12,300)],[ranges()]);
const normal=frame([...quad(0,400,200)],[ranges('normal','simple',1)]);
const mask=frame([...quad(0,400,200),...quad(0,400,200),...quad(0,400,200)],[{...ranges('normal','incrMask',1)},{...ranges('add','masked',1),startVertex:4,indexStart:6},{...ranges('normal','decrMask',1),startVertex:8,indexStart:12}]);
const source={sequences:[{name:'standby',frames:[idle]},{name:'sa',frames:[mixed,normal,mask]}]} as SwfClipData;
const result=preparePetFx(source);
assert.equal(result.report.removedQuads,2);assert.equal(result.report.keptAddQuads,2);
assert.equal(result.report.normalRemoved,1,'橫跨整個戰場的 normal 底片也要略過');
assert.deepEqual(result.clip.sequences[1].frames[0].mesh.subMeshes.map(s=>[s.startVertex,s.indexStart,s.indexCount]),[[0,0,6],[8,12,6]],'同一submesh內只刪大底片，不連帶刪小光效或狹長落雷');
assert.equal(mixed.mesh.subMeshes[0].indexCount,18,'原始共享clip不變');
assert.equal(result.clip.sequences[1].frames[0].mesh.positions,mixed.mesh.positions,'不複製巨型圖集/頂點');
assert.equal(result.clip.sequences[0],source.sequences[0],'待機不變');
assert.notEqual(result.clip.sequences[1].frames[1],normal,'全屏 normal 底片要被過濾');assert.equal(result.clip.sequences[1].frames[1].mesh.subMeshes.length,0);
assert.equal(result.clip.sequences[1].frames[2],mask,'遮罩群組保留');
assert.equal(preparePetFx(source),result,'快取且不重複過濾');
// 保守門檻：3 倍待機高才略過；一般大光效(2x1.5)、狹長落雷(12x300)一律保留。
for(const scale of [.2,1,3]){assert.ok(isLargeAddQuad(400*scale,200*scale,100*scale));assert.ok(!isLargeAddQuad(200*scale,150*scale,100*scale));assert.ok(!isLargeAddQuad(12*scale,300*scale,100*scale));}
assert.ok(!isLargeAddQuad(1000,1000,0));assert.ok(!isLargeAddQuad(Infinity,1000,100));
// ---- 2026-11-01 全屏層：被判定為底片的圖塊不再丟掉，而是收進 fxClip；小畫布 clip 仍不畫（舊行為不變）----
const big=frame([...quad(0,10,20),...quad(20,400,200)],[ranges('add','simple',2)]);
const small=frame([...quad(0,10,20)],[ranges('add','simple',1)]);
const source2={sequences:[{name:'standby',frames:[idle]},{name:'attack',frames:[big,big]},{name:'sa',frames:[big,small]},{name:'cp',frames:[small]}]} as SwfClipData;
const auto=preparePetFx(source2);
assert.deepEqual(auto.report.fullscreen,{sequences:['attack','sa'],mode:'auto'},'未登記時自動偵測：有底片被判定的序列都走全屏層（預設，現有素材免設定受益）');
assert.ok(auto.fxClip,'有底片就產生 fxClip');
assert.deepEqual(auto.fxClip!.sequences.map(s=>s.name),source2.sequences.map(s=>s.name),'序列一一對應');
assert.deepEqual(auto.fxClip!.sequences.map(s=>s.frames.length),source2.sequences.map(s=>s.frames.length),'影格數一一對應，兩個播放器可同步');
assert.deepEqual(auto.fxClip!.sequences[2].frames[0].mesh.subMeshes.map(s=>[s.startVertex,s.indexStart,s.indexCount]),[[4,6,6]],'fxClip 只含大底片那一塊（保留超大圖塊）');
assert.equal(auto.fxClip!.sequences[2].frames[0].mesh.positions,big.mesh.positions,'fxClip 與原 clip 共用頂點，不複製');
assert.equal(auto.fxClip!.sequences[2].frames[1].mesh.subMeshes.length,0,'同序列沒有底片的影格為空');
assert.equal(auto.fxClip!.sequences[3].frames[0].mesh.subMeshes.length,0,'沒有底片的序列在全屏層為空');
assert.equal(auto.fxClip!.sequences[0].frames[0].mesh.subMeshes.length,0,'待機在全屏層永遠為空');
assert.deepEqual(auto.clip.sequences[2].frames[0].mesh.subMeshes.map(s=>[s.startVertex,s.indexCount]),[[0,6]],'小畫布仍濾掉底片（行為不變）');
assert.deepEqual(auto.report.backdropBounds.sa,{left:20,right:420,top:0,bottom:200},'底片聯集框（原生座標）供全屏層鋪滿用');
assert.equal(preparePetFx(source2),auto,'相同設定快取');
// 2026-11-01：逐影格底片框（全屏層逐格 cover 用）；聯集框會讓較小的影格鋪不滿，所以每格自己的框要保留。
assert.deepEqual(auto.report.backdropFrames.sa,[{left:20,right:420,top:0,bottom:200},null],'sa：第 0 格有底片、第 1 格沒有（null）');
assert.deepEqual(auto.report.backdropFrames.attack.length,2);
const grow=frame([...quad(0,10,20),...quad(20,400,200)],[ranges('add','simple',2)]),grown=frame([...quad(0,10,20),...quad(-300,1000,500)],[ranges('add','simple',2)]);
const growing=preparePetFx({sequences:[{name:'standby',frames:[idle]},{name:'sa',frames:[grow,grown]}]} as SwfClipData);
const [f0,f1]=growing.report.backdropFrames.sa as any[];
assert.ok(f1.right-f1.left>f0.right-f0.left,'底片逐格放大時每格框各自保留');
assert.deepEqual(growing.report.backdropBounds.sa,{left:-300,right:700,top:0,bottom:500},'聯集框仍在（相容）');
// 逐素材覆寫：明確登記後只認登記的序列；未登記序列的大圖塊照舊過濾（不進全屏層）。
const only=preparePetFx(source2,{sequences:['sa']});
assert.notEqual(only,auto,'不同設定各自快取');
assert.deepEqual(only.report.fullscreen,{sequences:['sa'],mode:'explicit'});
assert.equal(only.fxClip!.sequences[2].frames[0].mesh.subMeshes.length,1,'登記的序列保留超大圖塊');
assert.equal(only.fxClip!.sequences[1].frames[0].mesh.subMeshes.length,0,'未登記序列的超大圖塊仍被過濾');
assert.deepEqual(only.clip.sequences[1].frames[0].mesh.subMeshes.map(s=>s.indexCount),[6],'未登記序列的小畫布也不畫底片');
for(const none of [[],['nope']]){const off=preparePetFx(source2,{sequences:none});assert.equal(off.fxClip,null,'登記為空／不存在的序列＝關閉全屏層');assert.deepEqual(off.report.fullscreen.sequences,[]);assert.equal(off.report.removedQuads,auto.report.removedQuads,'過濾結果不變');}
const plain=preparePetFx({sequences:[{name:'standby',frames:[idle]},{name:'attack',frames:[small]}]} as SwfClipData);
assert.equal(plain.fxClip,null,'沒有任何底片＝不建立第二個播放器');assert.deepEqual(plain.report.fullscreen.sequences,[]);
console.log('B策略：混合子網格分割、小光效/落雷、normal/遮罩/待機保留、共享素材不變、比例與快取通過');
