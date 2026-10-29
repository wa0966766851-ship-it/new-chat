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
console.log('B策略：混合子網格分割、小光效/落雷、normal/遮罩/待機保留、共享素材不變、比例與快取通過');
