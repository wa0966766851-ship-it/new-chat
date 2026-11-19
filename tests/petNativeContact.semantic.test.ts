import assert from 'node:assert/strict';
import fs from 'node:fs';
import {actionApproach,nativeContactWindow,retargetAttack,physicalContactOffset} from '../src/battle/petAnimationGeometry';
import {PET_ANIMATION_ASSETS,type PetAnimationAsset} from '../src/battle/petAnimationAssets';
for(const [id,arrival,departure] of [['rey70',22,41],['gaiaGodslayer',107,193],['oscarGenesis',19,110],['oscarOriginal',51,141]] as const){
 const a=JSON.parse(fs.readFileSync(new URL(`./fixtures/native-animation/${id}.contact.json`,import.meta.url),'utf8'));
 const asset:PetAnimationAsset=PET_ANIMATION_ASSETS[id];
 assert.equal(asset.physicalContact?.attack??1,a.contactFraction,'保留已校準的武器／落點位置');
 assert.equal(a.sha256,PET_ANIMATION_ASSETS[id].sha256,'必須對應已核對的官方素材版本');
 const hit=PET_ANIMATION_ASSETS[id].sequences.find(s=>s.name==='attack')!.hits[0];
 assert.equal(a.hit,hit);
 const window=nativeContactWindow(a.frames,a.rest,hit);
 assert.deepEqual(window,{arrival,departure},id+' 原生衝刺／收招邊界');
 const end=a.frames.length-1;
 // 命中後仍在揮擊的真實影格，不能先退到場地中央。
 assert.ok(actionApproach(departure,hit,end)<1,'舊流程應能重現提早退回');
 for(let frame=hit;frame<=departure;frame++){
  const b=a.frames[frame];if(!b)continue;
  for(const width of [1024,1920])for(const dir of [-1,1]){
   const scale=85,origin=width*(dir>0?.22:.78),target=width*(dir>0?.78:.22);
   const offset=((b.left+b.right-a.rest.left-a.rest.right)/2)*scale*dir;
   const contactOffset=physicalContactOffset((b.right-b.left)*scale/2,asset.physicalContact?.attack);
   const position=retargetAttack(origin,target,dir,(a.rest.right-a.rest.left)*scale/2,offset,contactOffset,actionApproach(frame,arrival,end,departure),14);
   assert.ok(Math.abs(position.front-(target+dir*14))<1e-6,`${id} ${frame} ${width} ${dir} 接觸應留在對手位置`);
  }
 }
 assert.equal(actionApproach(end,arrival,end,departure),0,'完成後回原位');
 // 左朝素材先在素材座標辨識，不受 P1／P2 畫面鏡射影響。
 const mirror=(b:any)=>b?{...b,left:-b.right,right:-b.left}:null;
 assert.deepEqual(nativeContactWindow(a.frames.map(mirror),mirror(a.rest),hit,-1),window);
}
assert.deepEqual(nativeContactWindow([null,null],null,1),{arrival:1,departure:1});
assert.deepEqual(nativeContactWindow([{left:0,right:2,top:0,bottom:1}],{left:0,right:2,top:0,bottom:1},0),{arrival:0,departure:0});
console.log('雷伊、滅戰神決蓋亞、奧斯卡雙外觀：原生攻擊段、雙向寬窄接觸及返回通過');
