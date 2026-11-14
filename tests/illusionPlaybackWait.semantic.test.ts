import assert from 'node:assert/strict';
import {BattlePresentation} from '../src/battle/presentation';
import {appearanceElf} from '../src/battle/illusionPresentation';
import {registerPetPlayer,registerPetTimings,reportPetPlayback} from '../src/battle/petAnimationRegistry';

const ticks=async()=>{for(let n=0;n<15;n++)await Promise.resolve();};
for(const side of ['p1','p2'] as const){
 const owner:any={id:'test-owner',battleId:'illusion-wait-'+side,name:'原持有者',skinId:'original',illusion:{target:{name:'幻化外觀',skinId:'target-skin'}}};
 const shown=appearanceElf(owner);
 const off=registerPetPlayer(side,shown);
 // 正式播放器把「沒有專用 extra 時的 cp」長度登記為 extra。
 const untiming=registerPetTimings(side,shown,{extra:{duration:3000,hit:1500}});
 const p=new BattlePresentation(()=>{},()=>false);
 await p.stage({[side+'Team']:[owner],[side+'ActiveIndex']:0});
 const first={side,category:'extra'},next={side,category:'extra'};
 let hitReleased=false,nextStarted=false;
 const firstWait=p.animate(first,400).then(()=>{hitReleased=true;});
 await ticks();assert.equal(p.skillAnim,first);
 reportPetPlayback(side,shown,{sequence:'extra',type:'marker',marker:{name:'action_hit'}});
 await ticks();
 assert.equal(hitReleased,true,'幻化後的命中訊號須被真正的播放時間軸接收，而非退回固定短延遲');
 const secondWait=p.animate(next,400).then(()=>{nextStarted=true;});
 await ticks();assert.equal(p.skillAnim,first,'命中後仍保留第一段收招');
 assert.equal(nextStarted,false);
 reportPetPlayback(side,shown,{sequence:'extra',type:'complete'});
 await firstWait;await ticks();assert.equal(p.skillAnim,next,'第一段完成才允許下一次額外行動開始');
 reportPetPlayback(side,shown,{sequence:'extra',type:'complete'});
 await secondWait;await p.wait();assert.equal(p.skillAnim,null);
 p.dispose();untiming();off();
}
console.log('幻化後雙側額外行動：真實播放器身分、命中放行、收招等待與連續播放通過');
