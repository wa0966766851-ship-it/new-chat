import assert from 'node:assert/strict';
import {NEW_ELF_SEEDS} from '../src/data/newElves';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {petAnimationBinding} from '../src/battle/petAnimationRegistry';
import {petImageUrls,shouldMirrorBattleSprite,battleSpriteProfile} from '../src/battle/seerAssets';
import {GAIA_SKINS} from '../src/data/elfSkins';
import fs from 'node:fs';
const owners=['5037','5038','5039','5040','5042','5043','5044','5045','5046','5047'];
const ids=[3094,3467,2205,2824,88,261,3590,264,999,2652];
for(let i=0;i<owners.length;i++){
 const elf=NEW_ELF_SEEDS.find(e=>String(e.id)===owners[i])!;assert.ok(elf);assert.equal(elf.seerId,ids[i]);const binding=petAnimationBinding(elf)!;assert.ok(binding);const meta=PET_ANIMATION_ASSETS[binding];assert.equal(meta.clip,ids[i]+'.pet');assert.equal(meta.facingVerified,true);assert.ok(meta.sequences.some(s=>s.name==='attack'&&s.hits.length));
 assert.equal(petImageUrls({...elf,seerId:0},'body')[0],`/seer/body/${ids[i]}.png`,'舊存檔也由已核對名稱取得正確立繪');
 assert.equal(petAnimationBinding({...elf,path:'/custom/other.png'}),null,'自訂立繪不偷套官方動作');
 for(const kind of ['body','head'])assert.equal(fs.readFileSync(`public/seer/${kind}/${ids[i]}.png`).readUInt32BE(0),0x89504e47);
 for(const side of ['p1','p2'] as const){assert.equal(shouldMirrorBattleSprite(elf.name,side,false,`/api/pet-animations/bundle/${binding}`),side==='p2');assert.equal(shouldMirrorBattleSprite(elf.name,side,false,`/seer/body/${ids[i]}.png`),ids[i]===88?false:side==='p1');}
}
const gaia=NEW_ELF_SEEDS.find(e=>String(e.id)==='5043')!;
for(const skin of GAIA_SKINS){const selected=JSON.parse(JSON.stringify({...gaia,skinId:skin.id}));assert.equal(petAnimationBinding(selected),skin.animationAssetId);assert.deepEqual(selected.skills,gaia.skills);assert.deepEqual(selected.soulMark,gaia.soulMark);assert.equal(petImageUrls(selected,'body')[0],skin.body);}
assert.equal(petAnimationBinding({...gaia,skinId:'unknown'}),null);
console.log('新10隻立繪／原生動作／舊存檔／雙側朝向／蓋亞皮膚保存重載通過');

assert.equal(battleSpriteProfile(gaia.name,'http://localhost:3026/seer/body/4766.png')?.heightRatio,1.65);assert.equal(battleSpriteProfile(gaia.name,'http://localhost:3026/seer/body/261.png'),null);
