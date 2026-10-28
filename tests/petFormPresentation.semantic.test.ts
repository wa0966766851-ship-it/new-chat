import assert from 'node:assert/strict';
import {battleFormAsset,battleFormAssets,settledFormAsset} from '../src/battle/battleFormPresentation';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';

const marthus={id:'5016',name:'變革·馬爾修斯'} as any;

// 1) 兩種型態都要被預載（原形 + 變身），且只含明確登記的素材。
const preload=battleFormAssets(marthus);
assert.ok(preload.includes('marthus'),'原形必須在預載清單');
assert.ok(preload.includes('marthusDestroy'),'變身形態必須在預載清單');
assert.equal(new Set(preload).size,preload.length,'預載清單不得重複');
for(const id of preload) assert.ok(PET_ANIMATION_ASSETS[id],`${id} 必須是已登記素材`);

// 2) 型態對應：堅壁/極速→原形，毀滅→變身；未指定時回原形。
assert.equal(battleFormAsset(marthus,{mechCombo:'堅壁'}),'marthus');
assert.equal(battleFormAsset(marthus,{mechCombo:'極速'}),'marthus');
assert.equal(battleFormAsset(marthus,{mechCombo:'毀滅'}),'marthusDestroy');
assert.equal(battleFormAsset(marthus,{}),'marthus');
assert.equal(battleFormAsset(marthus,undefined),'marthus');

// 3) 出招途中不換型態，收招（standby）才換，避免切斷命中事件。
assert.equal(settledFormAsset('marthus','marthusDestroy','attack'),'marthus');
assert.equal(settledFormAsset('marthus','marthusDestroy','sa'),'marthus');
assert.equal(settledFormAsset('marthus','marthusDestroy','standby'),'marthusDestroy');

// 4) 非雙型態精靈不預載額外素材，也不誤判。
assert.deepEqual(battleFormAssets({id:'70',name:'雷伊'} as any),[]);

// 5) 變身素材本身必須是 29000+原序號 的官方慣例（不靠段號猜，實際比對 clip）。
const clip=PET_ANIMATION_ASSETS.marthusDestroy.clip;
assert.equal(clip,'290003393.pet','變身素材必須是 290003393');
assert.equal(String(Number(clip.replace('.pet',''))).slice(5),'3393','29000 後段必須等於原形序號 3393');

console.log('馬爾修斯雙型態：預載、對應、出招不切換、非雙型態不預載 全數通過');
