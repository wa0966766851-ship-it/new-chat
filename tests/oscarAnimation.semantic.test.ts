import assert from 'node:assert/strict';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {petAnimationBinding,readyPetTiming,registerPetPlayer,registerPetTimings} from '../src/battle/petAnimationRegistry';
import {availableElfSkins} from '../src/data/elfSkins';
import {shouldMirrorBattleSprite} from '../src/battle/seerAssets';
import {PET_BUNDLES,PET_REMOTE_BASE} from '../server/petAnimationCache';
const elf={id:'5048',seerId:1400599,name:'聖靈奧斯卡',battleId:'oscar-animation-test'};
assert.equal(petAnimationBinding(elf),'oscarGenesis');
assert.equal(petAnimationBinding({...elf,skinId:'oscar-genesis'}),'oscarGenesis');
assert.equal(petAnimationBinding({...elf,skinId:'oscar-original'}),'oscarOriginal');
assert.equal(petAnimationBinding({...elf,path:'/custom/oscar.png'}),null,'自訂圖不能套官方動作');
assert.equal(petAnimationBinding({...elf,skinId:'unknown'}),null);
assert.ok(availableElfSkins(elf).some(s=>s.id==='oscar-genesis'&&s.body==='/seer/body/1400599.png'));
for(const [id,clip,fps,hit] of [['oscarGenesis','1400599.pet',24,100],['oscarOriginal','3425.pet',25,114]] as const){
 const asset=PET_ANIMATION_ASSETS[id];assert.equal(asset.clip,clip);assert.equal(asset.fps,fps);
 assert.equal(asset.source.url,PET_REMOTE_BASE+asset.hash);assert.ok(asset.source.indexUrl.includes('seerapi.com'));
 assert.equal(PET_BUNDLES[id].sha256,asset.sha256);assert.equal(asset.sequences.find(s=>s.name==='attack')?.hits[0],hit);
 const source='/api/pet-animations/bundle/'+id;
 assert.equal(shouldMirrorBattleSprite(elf.name,'p1',false,source),false);
 assert.equal(shouldMirrorBattleSprite(elf.name,'p2',false,source),true);
 const actor={...elf,skinId:id==='oscarOriginal'?'oscar-original':undefined} as any;
 const unregister=registerPetPlayer('p1',actor),off=registerPetTimings('p1',actor,{attack:{hit:hit/fps*1000,duration:asset.sequences.find(s=>s.name==='attack')!.frames/fps*1000}});
 assert.equal(readyPetTiming('p1',actor,'attack')?.hit,hit/fps*1000);assert.equal(readyPetTiming('p2',actor,'attack'),undefined,'雙側計時隔離');off();unregister();
}
console.log('奧斯卡雙外觀綁定、來源保留、素材白名單、命中時點與雙側隔離通過');
