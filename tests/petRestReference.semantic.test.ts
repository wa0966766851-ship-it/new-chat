import assert from 'node:assert/strict';
import {nativeRestBounds,restBodyTiles,petCanvasFrame} from '../src/battle/petAnimationGeometry';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {petAnimationBinding} from '../src/battle/petAnimationRegistry';
import {selectedElfSkin} from '../src/data/elfSkins';
import {shouldMirrorBattleSprite} from '../src/battle/seerAssets';
import index from '../src/data/seerIndex.json';
const mesh=(l:number,r:number,t:number,b:number)=>({positions:Float32Array.from([l,t,r,t,r,b,l,b]),uvs:new Float32Array(8)});
const body=mesh(-1,1,-2,2),laterHalo=mesh(-8,8,-9,9);
assert.deepEqual(nativeRestBounds([body,laterHalo]),{left:-1,right:1,top:-2,bottom:2},'後續擴張光暈不可把待機本體縮小');
assert.deepEqual(nativeRestBounds([{positions:[],uvs:[]},body]),nativeRestBounds([body]),'空白首幀跳過');
assert.equal(nativeRestBounds([]),null);
// ---- 2026-11-01 尺寸基準加固（精靈偶爾變很小）----
// 以 uv 區分圖塊：本體 uv 全 0；光暈／背景片用獨有 uv。
const tile=(l:number,r:number,t:number,b:number,uv=0)=>({positions:[l,t,r,t,r,b,l,b],uvs:Array(8).fill(uv)});
const frameOf=(...tiles:ReturnType<typeof tile>[])=>({positions:Float32Array.from(tiles.flatMap(t=>t.positions)),uvs:Float32Array.from(tiles.flatMap(t=>t.uvs))});
const bodyTile=tile(-1,1,-2,2),halo=tile(-40,40,-45,45,.25);
const haloFirst=[frameOf(bodyTile,halo),frameOf(bodyTile),frameOf(bodyTile),frameOf(bodyTile),frameOf(bodyTile)];
assert.deepEqual(nativeRestBounds(haloFirst),{left:-1,right:1,top:-2,bottom:2},'首個待機影格的巨大光暈／背景片不可縮小 refH');
assert.ok(!restBodyTiles(haloFirst).has(Array.from({length:8},()=>Math.round(.25*65536)).join(',')),'一閃而過的特大圖塊不算本體');
// 光暈持續整段待機（持久出現）時無法與本體區分 → 視為本體（與舊行為一致，不誤刪翅膀／披風）。
const persistent=[frameOf(bodyTile,tile(-5,5,-6,6,.5)),frameOf(bodyTile,tile(-5,5,-6,6,.5)),frameOf(bodyTile,tile(-5,5,-6,6,.5))];
assert.deepEqual(nativeRestBounds(persistent),{left:-5,right:5,top:-6,bottom:6});
// 逐格換圖的身體（每格獨有 uv）：圖塊都「少見」，但尺寸正常，不得被排除（否則 refH 縮水）。
const flipbook=Array.from({length:6},(_,i)=>frameOf(tile(-2,2,-4,4,.01*(i+1))));
assert.deepEqual(nativeRestBounds(flipbook),{left:-2,right:2,top:-4,bottom:4},'逐格換圖本體保留');
// 首幀特效若是持久圖塊（無法靠圖塊排除）→ 改用高度居中位的影格。
const outlierFirst=[frameOf(tile(-9,9,-10,10)),frameOf(bodyTile),frameOf(bodyTile),frameOf(bodyTile)];
assert.deepEqual(nativeRestBounds(outlierFirst),{left:-1,right:1,top:-2,bottom:2},'首幀高度偏離中位數 20% 以上時用中位影格');
// 正常待機（首幀就是代表）維持首幀基準，不引入逐幀飄移。
const breathing=[frameOf(tile(-1,1,-2,2)),frameOf(tile(-1.05,1.05,-2.1,2.1)),frameOf(tile(-1,1,-2,2))];
assert.deepEqual(nativeRestBounds(breathing),{left:-1,right:1,top:-2,bottom:2},'穩定待機仍以首幀為準');
for(const [stage,body] of [[378,363],[540,499],[300,1000]]){
 const frame=petCanvasFrame(stage,body);
 assert.equal(frame.height-frame.footroom,stage,'擴張畫布並下移底部後，地平線必須保持原位');
 assert.ok(frame.height>frame.baseline+30,'低於原地平線30px的待機影格不應被裁掉');
 assert.ok(frame.footroom<=160,'留白需有上限，不能按巨型角色無限制增加畫布');
}
assert.equal(petCanvasFrame(500,400,false).height,500,'首頁不跟隨戰鬥畫布留白');
assert.equal(PET_ANIMATION_ASSETS.sobira.clip,`${index.pets['索比拉特'][0][0]}.pet`,'官方名稱與動畫序號須相符，3435是伊麗莎白');
assert.equal(index.pets['伊麗莎白'][0][0],3435);
assert.equal(PET_ANIMATION_ASSETS.sobira.size,513549);
// 實機裁定：不可把近正面姿勢當成無方向，否則 P2 會沿用 P1 的出招方向。
for(const key of ['sixKing','astralAesfia','astralAesfig','puni','baflo','holyPuni','starLisa','scarlett']) {
 assert.equal(PET_ANIMATION_ASSETS[key].facing,'right',`${key} 原姿用於 P1，P2 必須鏡射`);
}
const holy={id:'5000',name:'聖靈譜尼'};
for(const key of ['starLisa','scarlett'])assert.equal(PET_ANIMATION_ASSETS[key].physicalMotion,'approach','自帶衝刺的素材必須依對手停點校正');
assert.equal(petAnimationBinding(holy),'holyPuni','原始聖靈譜尼動畫保留');
assert.equal(petAnimationBinding({...holy,skinId:'puni-original'}),'puni','原版譜尼皮膚共用300來源');
assert.equal(selectedElfSkin({...holy,skinId:'puni-original'})?.head,'/seer/head/300.png','頭像與皮膚同源');
assert.equal(shouldMirrorBattleSprite(holy.name,'p1',false,'/api/pet-animations/bundle/puni'),false);
assert.equal(shouldMirrorBattleSprite(holy.name,'p2',false,'/api/pet-animations/bundle/puni'),true);
console.log('待機固定參照、空幀及索比拉特來源對照通過；視覺效果仍須內部瀏覽器驗收');
