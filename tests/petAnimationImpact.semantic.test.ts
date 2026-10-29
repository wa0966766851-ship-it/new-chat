import assert from 'node:assert/strict';
import {BattlePresentation} from '../src/battle/presentation';
import {registerPetPlayer,registerPetTimings,reportPetPlayback} from '../src/battle/petAnimationRegistry';
import {actionApproach,attackContact} from '../src/battle/petAnimationGeometry';
const elf:any={id:'70',name:'雷伊',battleId:'impact-test'};
const off=registerPetPlayer('p1',elf),untiming=registerPetTimings('p1',elf,{attack:{hit:500,duration:2000},cp:{hit:400,duration:2000}});
const ticks=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const p=new BattlePresentation(()=>{},()=>false);
await p.stage({p1Team:[elf],p1ActiveIndex:0});
const anim={side:'p1',category:'physical'};
const attack=p.animate(anim,350);await ticks();assert.equal(p.skillAnim,anim);
reportPetPlayback('p2',elf,{sequence:'attack',type:'marker',marker:{name:'action_hit'}});await ticks();assert.equal(p.skillAnim,anim);
reportPetPlayback('p1',elf,{sequence:'attack',type:'marker',marker:{name:'action_hit'}});
await attack;assert.equal(p.skillAnim,anim,'命中時不截斷收招');
const red=p.record({side:'p2',elfId:'target',type:'skill',amount:20,delta:-20,before:100,after:80,maxHp:100});await ticks();
assert.equal(p.hp.get('p2:target'),80);assert.equal(p.popups[0]?.type,'skill');assert.equal(p.skillAnim,anim,'紅字與血條在收招前顯示');
reportPetPlayback('p1',elf,{sequence:'attack',type:'complete'});assert.equal(p.skillAnim,null);p.dispose();await red;await p.wait();
const q=new BattlePresentation(()=>{},()=>false);await q.stage({p1Team:[elf],p1ActiveIndex:0});
const property=q.animate({side:'p1',category:'property'},350);await ticks();q.dispose();await property;await q.wait();assert.equal(q.popups.length,0,'取消不製造傷害或卡住');
assert.equal(actionApproach(22,22,74),1);assert.equal(actionApproach(74,22,74),0);assert.equal(actionApproach(0,22,74),0);
// 接觸點：攻擊者前緣抵達對手可見框近側邊緣（穿入 overlap），與雙方距離、體寬無關。
for(const [front,near,dir] of [[667,1144,1],[1144,667,-1],[300,520,1],[88,40,-1]] as const){
 for(const overlap of [0,6]){const shift=attackContact(front,near,dir,overlap);assert.ok(Math.abs((near-(front+shift))*dir+overlap)<1e-9,`前緣${front}→近側${near}：空隙應為 -${overlap}，實際位移 ${shift}`);}
}
assert.equal(attackContact(667,1144,1,0,100),100,'位移受 maxShift 上限');
assert.equal(attackContact(700,600,1),0,'已越過對手近側邊緣不倒退');
assert.equal(attackContact(500,500,-1),0);
off();untiming();console.log('命中放行、收招保留、雙側隔離、取消與接觸座標通過');
