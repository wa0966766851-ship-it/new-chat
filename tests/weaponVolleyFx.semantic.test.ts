import assert from 'node:assert/strict';
import {createWeaponVolleyFx} from '../src/battle/weaponVolleyFx';
import type {CustomFxFrame} from '../src/battle/customBattleFx';
const savedImage=globalThis.Image;
class TestImage {
 src='';decoding='';complete=true;naturalWidth=1280;naturalHeight=1024;
 removeAttribute(){this.src='';}
}
globalThis.Image=TestImage as unknown as typeof Image;
try{
 const calls:unknown[][]=[],scales:number[][]=[];
 const context=new Proxy({canvas:{dataset:{}},drawImage:(...v:unknown[])=>calls.push(v),scale:(...v:number[])=>scales.push(v)},
  {get:(o,k)=>k in o?o[k as keyof typeof o]:(()=>{})}) as unknown as CanvasRenderingContext2D;
 const renderer=createWeaponVolleyFx({sprite:'sword',held:{sequences:['attack','ultimate'],from:8,until:54},impact:{sprite:'impact',cols:5,rows:4,frames:17}});
 const state:CustomFxFrame={sequence:'standby',frame:0,frames:96,hits:[],caster:{left:100,right:300,top:150,bottom:600},target:{left:800,right:1000,top:150,bottom:600},mirrored:false};
 const rect={left:0,top:0} as DOMRect;
 renderer.draw(context,state,rect,'p1',32,18);
 assert.equal(calls.length,6,'待機六把浮劍，不播放命中圖');
 calls.length=0;
 renderer.draw(context,{...state,sequence:'attack',frame:31,frames:64,hits:[32]},rect,'p1',32,18);
 assert.equal(calls.length,5,'持一劍時只留五把浮劍；命中前不播弧光');
 calls.length=0;
 renderer.draw(context,{...state,sequence:'attack',frame:36,frames:64,hits:[32]},rect,'p2',32,18);
 assert.equal(calls.length,6,'五把浮劍加一份命中特效');
 assert.deepEqual(calls.at(-1)?.slice(1,5),[1024,0,256,256],'命中後第四幀取第一列第五格');
 assert.deepEqual(scales.at(-1),[-1,1],'P2弧光只在特效自身鏡射');
 assert.equal(context.canvas.dataset.weaponImpactFrame,'4');
 calls.length=0;
 renderer.draw(context,{...state,sequence:'attack',frame:55,frames:64,hits:[32]},rect,'p1',32,18);
 assert.equal(calls.length,6,'收尾只剩六把浮劍，命中特效不重播');
 assert.equal(context.canvas.dataset.weaponImpactFrame,undefined);
 renderer.destroy();
 console.log('六劍／持劍數量、命中前後貼圖、P2弧光與收尾通過');
}finally{globalThis.Image=savedImage;}
