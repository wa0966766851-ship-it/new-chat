import assert from 'node:assert/strict';
import {nativeRestBounds,petCanvasFrame} from '../src/battle/petAnimationGeometry';
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
// ---- 2026-11-01 回歸修正：尺寸基準回到「待機首個有內容的影格」----
// 之前加的「排除特大圖塊／首幀偏離中位數改用中位影格」會讓 refH 變大、立繪變小，
// 破壞「靜態立繪可見高＝動畫待機高」的契約（車主回報立繪變小、與靜態比例不符）。
// 下列斷言鎖定正確行為：首幀就是基準，不隨後續影格（含中位數）改變。
const tile=(l:number,r:number,t:number,b:number,uv=0)=>({positions:[l,t,r,t,r,b,l,b],uvs:Array(8).fill(uv)});
const frameOf=(...tiles:ReturnType<typeof tile>[])=>({positions:Float32Array.from(tiles.flatMap(t=>t.positions)),uvs:Float32Array.from(tiles.flatMap(t=>t.uvs))});
const smallFirst=[frameOf(tile(-1,1,-2,2)),frameOf(tile(-1.5,1.5,-3,3)),frameOf(tile(-1.5,1.5,-3,3)),frameOf(tile(-1.5,1.5,-3,3))];
assert.deepEqual(nativeRestBounds(smallFirst),{left:-1,right:1,top:-2,bottom:2},'首幀較小時仍以首幀為準（不改用較高的中位影格，否則立繪被縮小）');
const breathing=[frameOf(tile(-1,1,-2,2)),frameOf(tile(-1.05,1.05,-2.1,2.1)),frameOf(tile(-1,1,-2,2))];
assert.deepEqual(nativeRestBounds(breathing),{left:-1,right:1,top:-2,bottom:2},'穩定待機以首幀為準');
const flipbook=Array.from({length:6},(_,i)=>frameOf(tile(-2,2,-4,4,.01*(i+1))));
assert.deepEqual(nativeRestBounds(flipbook),{left:-2,right:2,top:-4,bottom:4},'逐格換圖本體保留');
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
