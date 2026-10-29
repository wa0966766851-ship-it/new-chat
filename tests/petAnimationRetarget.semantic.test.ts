import assert from 'node:assert/strict';
import fs from 'node:fs';
import {actionApproach,retargetAttack,bodyTiles,nativeBodyBounds} from '../src/battle/petAnimationGeometry';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {petAnimationBinding} from '../src/battle/petAnimationRegistry';
const mesh=(x:number,uv:number)=>({positions:Float32Array.from([x,1,x+1,1,x+1,0,x,0]),uvs:Float32Array.from([uv,0,uv+.1,0,uv+.1,.1,uv,.1])});
const idle=mesh(0,0),flash=mesh(100,.5),tiles=bodyTiles([idle]);
const mix={positions:Float32Array.from([...idle.positions,...flash.positions]),uvs:Float32Array.from([...idle.uvs,...flash.uvs])};
assert.equal(nativeBodyBounds(mix,tiles)?.right,1,'攻擊新出現的遠端爆炸不可變成本體');assert.equal(nativeBodyBounds(mix)?.right,101);
let framesChecked=0,oldOvershoot=0;
for(const [id,asset] of [['70',PET_ANIMATION_ASSETS.rey70],['15010',PET_ANIMATION_ASSETS.zhakesi15010]] as const){
 const fixture=JSON.parse(fs.readFileSync(new URL(`./fixtures/native-animation/${id}.bounds.json`,import.meta.url),'utf8'));
 assert.equal(fixture.sha256,asset.sha256);const rest=fixture.rest;
 const hit=fixture.attack.findIndex((f:any)=>f.labels.includes('action_hit'));assert.ok(hit>0);
 for(const viewport of [{w:1920,h:1010},{w:1366,h:768},{w:390,h:844}])for(const dir of [1,-1]){
  const height=viewport.h*.45,scale=height/(rest.bottom-rest.top),origin=viewport.w*(dir===1?.22:.78),near=viewport.w*(dir===1?.65:.35),half=(rest.right-rest.left)*scale/2;
  for(const [i,f] of fixture.attack.entries()){
   const b=f.body??f.all,offset=((b.left+b.right-rest.left-rest.right)/2)*scale*dir,pose=(b.right-b.left)*scale/2;
   const approach=actionApproach(i,hit,fixture.attack.length-1);
   const result=retargetAttack(origin,near,dir,half,offset,pose,approach,Math.min(14,half*.1));
   assert.ok((result.front-near)*dir<=Math.min(14,half*.1)+1e-7,`${id}:${viewport.w}:${dir}:frame${i} 本體不可穿過對手`);
   assert.ok(Math.abs(result.translation+offset-result.bodyCenter)<1e-7);
   if((origin+offset+dir*half+dir*Math.max(0,(near-origin)*dir-half)*approach-near)*dir>100)oldOvershoot++;
   framesChecked++;
  }
 }
}
assert.ok(oldOvershoot>0,'真實影格必須能重現舊公式衝過對手，否則不是有效回歸測試');
assert.equal(petAnimationBinding({id:'5025',name:'恐懼的化身·咤克斯',path:'zhakesi_fear'}),'zhakesi15010');
assert.equal(petAnimationBinding({id:'5025',name:'恐懼的化身·咤克斯',path:'https://custom.invalid/art.png'}),null);
// 5010 現在有自己的 4648.pet；重點是不能被誤認為咤克斯的 15010.pet。
assert.equal(petAnimationBinding({id:'5010',name:'星光·魯斯王'}),'starRuth');
assert.notEqual(petAnimationBinding({id:'5010',name:'星光·魯斯王'}),'zhakesi15010','資料庫5010不能誤認為動畫15010');
assert.equal(PET_ANIMATION_ASSETS.starRuth.clip,'4648.pet');
assert.equal(PET_ANIMATION_ASSETS.zhakesi15010.physicalMotion,'stationary','使用者確認：咤克斯物攻留在原地');
assert.equal(PET_ANIMATION_ASSETS.rey70.physicalMotion,'approach');
console.log(`真實素材 ${framesChecked} 影格／方向／尺寸組合通過；舊公式 ${oldOvershoot} 組越位已攔截。`);
