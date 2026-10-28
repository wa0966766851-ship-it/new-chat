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
