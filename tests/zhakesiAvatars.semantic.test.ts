import assert from 'node:assert/strict';
import {petAnimationBinding} from '../src/battle/petAnimationRegistry';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {petColorVariant,PET_COLOR_VARIANTS} from '../src/battle/petColorVariants';
import {availableElfSkins,selectedElfSkin} from '../src/data/elfSkins';

// 1. 三個化身各自綁到自己的原廠素材，互不共用、也不靠序號推算。
{
 const cases=[
  ['恐懼的化身·咤克斯','zhakesi15010','zhakesi_fear','/elf-art/zhakesi_fear_body.png'],
  ['憤怒的化身·咤克斯','zhakesi15008','zhakesi_wrath','/elf-art/zhakesi_wrath_body.png'],
  ['貪婪的化身·咤克斯','zhakesi15009','zhakesi_greed','/elf-art/zhakesi_greed_body.png'],
 ] as const;
 for(const [name,asset,path,url] of cases){
  for(const p of [undefined,path,url])assert.equal(petAnimationBinding({id:'5025',name,path:p} as any),asset,`${name} @ ${p}`);
  // 自訂圖址不得套官方動作
  assert.equal(petAnimationBinding({id:'5025',name,path:'/elf-art/zhakesi_fear_body.png?x' } as any),null,`${name} 自訂圖址`);
  assert.equal(petAnimationBinding({id:'5025',name,path:'/uploads/mine.png'} as any),null,`${name} 自繪`);
 }
}

// 2. 三份素材都真的登記了，而且圖集／序列一致（同模型不同色）。
{
 const ids=['zhakesi15008','zhakesi15009','zhakesi15010'] as const;
 for(const id of ids)assert.ok(PET_ANIMATION_ASSETS[id],id+' 未登記');
 assert.deepEqual(PET_ANIMATION_ASSETS.zhakesi15008.atlas,PET_ANIMATION_ASSETS.zhakesi15010.atlas);
 assert.deepEqual(PET_ANIMATION_ASSETS.zhakesi15008.sequences,PET_ANIMATION_ASSETS.zhakesi15010.sequences);
 assert.notEqual(PET_ANIMATION_ASSETS.zhakesi15008.hash,PET_ANIMATION_ASSETS.zhakesi15009.hash,'三份 bundle 不得是同一檔');
 assert.notEqual(PET_ANIMATION_ASSETS.zhakesi15009.hash,PET_ANIMATION_ASSETS.zhakesi15010.hash);
}

// 3. 顏色變體：三個化身各自一種，而且互不相同。
{
 const v=['zhakesi15008','zhakesi15009','zhakesi15010'].map(id=>petColorVariant('',id));
 assert.deepEqual(v.map(x=>x.id),['wrath','greed','fear']);
 // 三者必須真的不同色（任一通道不同即可）；恐懼用原始材質色、另兩者用原廠 addColor。
 assert.notDeepEqual([v[0].mul,v[0].add],[v[1].mul,v[1].add]);
 assert.notDeepEqual([v[1].mul,v[1].add],[v[2].mul,v[2].add]);
 assert.notDeepEqual([v[0].mul,v[0].add],[v[2].mul,v[2].add]);
 // 三者的 addColor 各自偏一個通道：憤怒偏紅、貪婪偏紫、恐懼偏青綠。
 assert.ok(v[0].add[0]>v[0].add[2]&&v[0].add[0]>v[0].add[1],'憤怒偏紅');
 assert.ok(v[1].add[2]>v[1].add[1]&&v[1].add[0]<v[1].add[2],'貪婪偏紫');
 assert.ok(v[2].add[1]>0&&v[2].add[2]>0&&v[2].add[0]===0,'恐懼偏青綠');
 for(const x of v)assert.ok(PET_COLOR_VARIANTS[x.id]||x.id==='wrath'||x.id==='greed'||x.id==='fear');
 // 未登記的素材仍走預設，不會亂套別人的顏色。
 assert.equal(petColorVariant('','rey70').id,'official');
}

// 4. 皮膚：湮滅之主底下可以直接切換三種化身；恐懼的化身可切回原始外觀。
{
 const elf={id:'5024',name:'湮滅之主・咤克斯'} as any;
 const skins=availableElfSkins(elf);
 assert.equal(skins[0].id,'','第一項永遠是原始外觀');
 for(const id of ['zhakesi-fear','zhakesi-wrath','zhakesi-greed'])assert.ok(skins.some(s=>s.id===id),id+' 未列在皮膚清單');
 assert.equal(selectedElfSkin({...elf,skinId:'zhakesi-wrath'})?.animationAssetId,'zhakesi15008');
 assert.equal(petAnimationBinding({...elf,skinId:'zhakesi-greed'}),'zhakesi15009');
 assert.equal(petAnimationBinding({...elf,skinId:''}),'zhakesi4762','原始外觀仍是湮滅之主自己的動作');
}
console.log('三化身素材、顏色變體、皮膚切換與自訂圖址保護通過');
