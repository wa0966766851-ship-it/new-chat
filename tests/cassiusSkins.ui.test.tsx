// 岳峙淵渟.卡修斯（5041）：兩款皮膚、預設 3568、頭像一致、靜態／動畫朝向與動畫登記。
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {readFileSync,existsSync} from 'node:fs';
import {ElfSkinPicker} from '../src/components/ElfSkinPicker';
import {ElfAvatar} from '../src/components/SeerImages';
import {availableElfSkins,selectedElfSkin} from '../src/data/elfSkins';
import {petAnimationBinding} from '../src/battle/petAnimationRegistry';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {BODY_SOURCE_FACING,BATTLE_SPRITE_FACING,STATIC_FRONT_EVIDENCE,normalizeName,mirrorSourceFacing,shouldMirrorBattleSprite,petImageUrls,loadSeerIndex} from '../src/battle/seerAssets';
import {parseElfBlueprint} from '../src/utils/elfBlueprint';
import {DEFAULT_ELVES} from '../src/data/defaultElves';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
await loadSeerIndex();
const NAME='岳峙淵渟.卡修斯';
const base:any={id:'5041',name:NAME,type:'聖靈.地面',level:100,height:196,weight:168,currentHp:1,skills:[{name:'不改動',pp:2}],soulMark:{name:'山'},calculatedStats:{atk:77}};
const SKINS={'cassius-shandi':{body:'/seer/body/3568.png',head:'/seer/head/3568.png',anim:'cassiusShandi'},'cassius-original':{body:'/seer/body/798.png',head:'/seer/head/798.png',anim:'cassiusOriginal'}} as const;

// 1. 兩款皮膚可選；預設（無 skinId）是 3568。
{
 const skins=availableElfSkins(base);
 assert.deepEqual(skins.map(s=>s.id),['','cassius-shandi','cassius-original'],'原始外觀＋聖地＋原版');
 assert.equal(skins.find(s=>s.id==='cassius-shandi')?.name,'聖地卡修斯');
 assert.equal(skins.find(s=>s.id==='cassius-original')?.name,'原版卡修斯');
 assert.equal(selectedElfSkin(base),undefined);
 assert.equal(petImageUrls(base,'body')[0],'/seer/body/3568.png','未選皮膚的預設全身圖是 3568');
 assert.equal(petImageUrls(base,'head')[0],'/seer/head/3568.png','未選皮膚的預設頭像是 3568');
 assert.equal(petAnimationBinding(base),'cassiusShandi','預設動畫是聖地卡修斯');
 // 以名稱找皮膚也要成立（對戰副本／改名後的 id 不同）。
 assert.equal(availableElfSkins({id:'custom_1',name:NAME}).length,3);
}
// 2. 每款皮膚：全身圖／頭像／動畫互相對應，素材檔存在，動畫登記完整。
for(const [id,expect] of Object.entries(SKINS)){
 const skin=selectedElfSkin({...base,skinId:id})!;
 assert.equal(skin.body,expect.body);assert.equal(skin.head,expect.head);assert.equal(skin.animationAssetId,expect.anim);
 assert.equal(petAnimationBinding({...base,skinId:id}),expect.anim);
 assert.equal(petImageUrls({...base,skinId:id},'body')[0],expect.body);assert.equal(petImageUrls({...base,skinId:id},'head')[0],expect.head);
 for(const f of [expect.body,expect.head])assert.ok(existsSync(new URL('../public'+f,import.meta.url)),f+' 檔案存在');
 const meta=PET_ANIMATION_ASSETS[expect.anim as keyof typeof PET_ANIMATION_ASSETS] as any;
 assert.equal(meta.body,expect.body,'動畫只綁定自己的靜態來源');
 assert.equal(meta.facingVerified,true);
 assert.match(meta.hash,/^[a-f0-9]{32}$/);assert.match(meta.sha256,/^[a-f0-9]{64}$/);assert.ok(meta.size>0);
 assert.equal(meta.clip,expect.body.match(/(\d+)\.png/)![1]+'.pet');
 assert.deepEqual(meta.sequences.map((s:any)=>s.name),['standby','attack','sa','cp','hited']);
 for(const s of meta.sequences)assert.ok(s.frames>0);
 for(const s of meta.sequences)for(const h of s.hits)assert.ok(h>0&&h<s.frames,`${s.name} hit 在影格範圍內`);
 assert.ok(meta.fps>=24&&meta.fps<=25);
}
assert.notEqual(PET_ANIMATION_ASSETS.cassiusShandi.hash,PET_ANIMATION_ASSETS.cassiusOriginal.hash);
// 3. 朝向：靜態兩張原圖 left；兩款原生動畫 right（逐側實機渲染核對）；不使用 front 假證據。
for(const src of ['/seer/body/3568.png','/seer/body/798.png']){
 assert.equal(BODY_SOURCE_FACING[src],'left',src);
 assert.equal(STATIC_FRONT_EVIDENCE[src],undefined,'未登記 front 證據');
 assert.equal(mirrorSourceFacing(BODY_SOURCE_FACING[src],'p1'),true,src+' P1 鏡射→朝右');
 assert.equal(mirrorSourceFacing(BODY_SOURCE_FACING[src],'p2'),false,src+' P2 原圖→朝左');
}
assert.equal(BATTLE_SPRITE_FACING[normalizeName(NAME)],'left');
for(const key of ['cassiusShandi','cassiusOriginal'] as const){
 assert.equal(PET_ANIMATION_ASSETS[key].facing,'right',key);
 const src='/api/pet-animations/bundle/'+key;
 assert.equal(BODY_SOURCE_FACING[src],'right');
 assert.equal(shouldMirrorBattleSprite(NAME,'p1',false,src),false,key+' P1 不翻（原生朝右）');
 assert.equal(shouldMirrorBattleSprite(NAME,'p2',false,src),true,key+' P2 在播放器根節點翻一次');
}
// 4. 動態不得小於靜態：播放器尺寸只由高度決定（見 PetActionSprite），沒有 battleScale 縮小；
//    實機量測（Chromium WebGL）：待機框高度與靜態可見高度相同。這裡鎖定「不得以 battleScale<1 縮小動畫」。
for(const key of ['cassiusShandi','cassiusOriginal'] as const){const scale=(PET_ANIMATION_ASSETS[key] as any).battleScale;assert.ok(scale===undefined||scale>=1,key+' battleScale 不得小於 1');}
// 5. 實際 ElfAvatar DOM：P1／P2 面對面、頭像不鏡射、選擇器兩款可切、存檔往返、不動戰鬥資料。
const root=createRoot(document.getElementById('root')!);
let elf:any={...base};const before=structuredClone(elf);
const render=()=>root.render(<><ElfSkinPicker elf={elf} onChange={next=>{elf=next;render();}}/><ElfAvatar elf={elf} kind="body" battleSide="p1"/><ElfAvatar elf={elf} kind="body" battleSide="p2"/></>);
try{
 await act(async()=>render());
 const pick=()=>document.querySelector('select')!;
 assert.equal(pick().querySelectorAll('option').length,3);
 const bodies=()=>[...document.querySelectorAll('img')].filter(i=>/\/seer\/body\//.test(i.getAttribute('src')||''));
 {const [,p1,p2]=bodies();assert.equal(p1.getAttribute('src'),'/seer/body/3568.png');assert.equal(p1.style.transform,'scaleX(-1)');assert.equal(p2.style.transform,'');}
 for(const [id,expect] of Object.entries(SKINS)){
  await act(async()=>{const select=pick();select.value=id;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.equal(elf.skinId,id);
  assert.deepEqual({...elf,skinId:undefined},{...before,skinId:undefined},'皮膚不能動到戰鬥資料');
  const imgs=bodies().filter(i=>i.getAttribute('src')===expect.body);
  assert.equal(imgs.length,3,id+' 預覽＋P1＋P2 都載入 '+expect.body);
  assert.equal(imgs[1].style.transform,'scaleX(-1)',id+' P1 翻→朝右');assert.equal(imgs[2].style.transform,'',id+' P2 原圖→朝左');
  assert.equal(JSON.parse(JSON.stringify(elf)).skinId,id,'序列化保留 skinId');
  await act(async()=>root.render(<><ElfAvatar elf={elf} kind="head" battleSide="p1"/><ElfAvatar elf={elf} kind="head" battleSide="p2"/></>));
  const heads=[...document.querySelectorAll('img')];
  assert.equal(heads.length,2);for(const h of heads){assert.equal(h.getAttribute('src'),expect.head,id+' 頭像對應');assert.equal(h.style.transform,'','頭像不鏡射');}
  await act(async()=>render());
 }
 await act(async()=>{const select=pick();select.value='';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 assert.equal(elf.skinId,undefined);assert.equal(bodies().filter(i=>i.getAttribute('src')==='/seer/body/3568.png').length,3,'回復原始外觀＝3568');
}finally{await act(async()=>root.unmount());dom.window.close();}
// 6. 藍圖匯入／匯出不得丟掉 skinId（原版卡修斯存檔後重載才會是 798）；預設精靈的身高體重沿用聖地卡修斯。
{
 const real:any=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5041')!;
 assert.ok(real);assert.equal(real.height,196);assert.equal(real.weight,168);
 for(const id of ['cassius-original','cassius-shandi']){
  const back=parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:{...real,skinId:id}}));
  assert.equal(back.elf.skinId,id);assert.ok(!back.warnings.some(w=>w.includes('skinId')),back.warnings.join('|'));
 }
}
console.log('卡修斯兩款皮膚、預設 3568、頭像、動畫登記與靜態／動畫朝向通過');
