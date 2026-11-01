import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {fullscreenFit,registerFxHost,getFxHost,setFullscreenFxActive,isFullscreenFxActive,subscribeFullscreenFx,resetFullscreenFx} from '../src/battle/fullscreenFx';
import {routeUltimate,isFifthSkillAnim,ultimateSequenceOf} from '../src/battle/petActionRouting';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {registerPetPlayer,registerPetTimings,reportPetPlayback,readyPetTiming,clearPetDegrade} from '../src/battle/petAnimationRegistry';
import {BattlePresentation} from '../src/battle/presentation';
import {measureOpaqueBoxResult,measureOpaqueBox} from '../src/battle/opaqueMeasure';

// ---- 全屏底片縮放 ----
assert.deepEqual(fullscreenFit({left:0,right:400,top:0,bottom:300},{width:800,height:600},1),{scale:2,centered:true},'底片不足以鋪滿 → cover 等比放大並置中');
assert.deepEqual(fullscreenFit({left:0,right:400,top:0,bottom:300},{width:800,height:300},1),{scale:2,centered:true},'只有寬不足也放大（取較大倍率才鋪滿）');
assert.deepEqual(fullscreenFit({left:0,right:900,top:0,bottom:700},{width:800,height:600},1),{scale:1,centered:false},'已覆蓋整層 → 沿用角色比例與本體對位');
for(const bad of [undefined,null,{left:0,right:0,top:0,bottom:0}])assert.deepEqual(fullscreenFit(bad as any,{width:800,height:600},1.5),{scale:1.5,centered:false},'無底片資料不改比例');
assert.deepEqual(fullscreenFit({left:0,right:10,top:0,bottom:10},{width:0,height:0},1),{scale:1,centered:false});

// ---- 登記表（host／active）----
const dom=new JSDOM('<div id="a"></div>');
const el=dom.window.document.getElementById('a')!;
assert.equal(getFxHost(),null,'沒掛全屏層（首頁／預覽）＝不啟用');
const off=registerFxHost(el);assert.equal(getFxHost(),el);off();assert.equal(getFxHost(),null);
let ticks=0;const unsub=subscribeFullscreenFx(()=>ticks++);
setFullscreenFxActive('p1',true);setFullscreenFxActive('p1',true);assert.equal(ticks,1,'重複設定不重複通知');
setFullscreenFxActive('p2',true);setFullscreenFxActive('p1',false);assert.ok(isFullscreenFxActive(),'任一側在播就是 active');
setFullscreenFxActive('p2',false);assert.ok(!isFullscreenFxActive());unsub();resetFullscreenFx();
dom.window.close();

// ---- 第五技能 → 絕招序列 ----
const sobira=PET_ANIMATION_ASSETS.sobira as any;
assert.equal(ultimateSequenceOf('sobira'),null,'未登記 fullscreen.ultimate → 沿用既有對應');
assert.equal(ultimateSequenceOf(null),null);assert.equal(ultimateSequenceOf('no-such-asset'),null);
const fifth={side:'p1',category:'special',isFifthSkill:true},normal={side:'p1',category:'special',isFifthSkill:false};
assert.ok(isFifthSkillAnim(fifth));assert.ok(!isFifthSkillAnim(normal));assert.ok(!isFifthSkillAnim(7));assert.ok(!isFifthSkillAnim(null));assert.ok(!isFifthSkillAnim({isFifthSkill:'true'}),'只認資料旗標 true');
for(const base of ['attack','sa','cp'] as const){
 assert.equal(routeUltimate(base,fifth,true),'ultimate',`第五技能(${base})且素材登記絕招 → ultimate`);
 assert.equal(routeUltimate(base,fifth,false),base,'素材沒登記 → 維持原對應');
 assert.equal(routeUltimate(base,normal,true),base,'非第五技能不受影響');
}
for(const keep of ['extra','hited','standby'] as const)assert.equal(routeUltimate(keep,fifth,true),keep,`${keep} 不改道`);
const saved=sobira.fullscreen;
try{
 sobira.fullscreen={ultimate:'sa'};assert.equal(ultimateSequenceOf('sobira'),'sa','登記且存在於素材序列 → 採用');
 sobira.fullscreen={ultimate:'ultimate-not-in-asset'};assert.equal(ultimateSequenceOf('sobira'),null,'登記了不存在的序列 → 視為未登記，不會播空');
}finally{if(saved===undefined)delete sobira.fullscreen;else sobira.fullscreen=saved;}

// 出招時間軸（presentation）：素材登記絕招並回報 ultimate 時間軸時，等的是 ultimate 序列的命中／完成事件。
const elf:any={id:'9',battleId:'b9',name:'測試精靈'};
const view={p1Team:[elf],p1ActiveIndex:0,p2Team:[],p2ActiveIndex:0};
async function run(isFifth:boolean,registerUltimate:boolean){
 clearPetDegrade();
 const p=new BattlePresentation(()=>{},()=>false);p.view=view;
 const timings:any={special:undefined,sa:{duration:3000,hit:1000},attack:{duration:3000,hit:1000}};
 if(registerUltimate)timings.ultimate={duration:5000,hit:2000};
 const off1=registerPetPlayer('p1',elf),off2=registerPetTimings('p1',elf,timings);
 assert.ok(registerUltimate===!!readyPetTiming('p1',elf,'ultimate'));
 const seen:string[]=[];
 const done=p.animate({side:'p1',category:'special',skillName:'絕招',targetSide:'p2',isFifthSkill:isFifth},400,true).then(()=>seen.push('hit'));
 await new Promise(r=>setTimeout(r,5));
 // 回報「錯的」序列事件不會放行；回報對的才放行。
 const wrong=isFifth&&registerUltimate?'sa':'ultimate';
 reportPetPlayback('p1',elf,{sequence:wrong,type:'marker',marker:{name:'action_hit'}});
 await new Promise(r=>setTimeout(r,5));const early=seen.length;
 reportPetPlayback('p1',elf,{sequence:isFifth&&registerUltimate?'ultimate':'sa',type:'marker',marker:{name:'action_hit'}});
 await done;
 reportPetPlayback('p1',elf,{sequence:isFifth&&registerUltimate?'ultimate':'sa',type:'complete'});
 off1();off2();p.dispose?.();
 return early;
}
assert.equal(await run(true,true),0,'第五技能＋登記絕招：只認 ultimate 的命中事件');
assert.equal(await run(true,false),0,'第五技能但素材沒登記：沿用 sa');
assert.equal(await run(false,true),0,'一般技能：即使素材登記絕招也沿用 sa');

// ---- measureOpaqueBox：失敗不快取 ----
const dom2=new JSDOM('<img id="i">');
Object.assign(globalThis,{document:dom2.window.document});
const img=dom2.window.document.getElementById('i') as HTMLImageElement;
Object.defineProperties(img,{naturalWidth:{value:200},naturalHeight:{value:100},currentSrc:{value:'/seer/body/x.png'}});
let mode:'fail'|'ok'='fail',draws=0;
(dom2.window.HTMLCanvasElement.prototype as any).getContext=function(){return {drawImage(){draws++;if(mode==='fail')throw new Error('tainted');},getImageData:(_x:number,_y:number,w:number,h:number)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=10;y<60;y++)for(let x=20;x<100;x++)data[(y*w+x)*4+3]=255;return {data};}};};
const failed=measureOpaqueBoxResult(img);
assert.equal(failed.measured,false,'讀不到像素 → 回報備援旗標');assert.deepEqual(failed.box,{w:200,h:100,left:0,top:0,right:200,bottom:100},'備援＝整張圖');
mode='ok';
const real=measureOpaqueBoxResult(img);
assert.equal(real.measured,true,'失敗沒有被快取：同一網址下次仍會重新量測');assert.ok(real.box.right-real.box.left<200&&real.box.left>0,'拿到真正的不透明框');
const before=draws;measureOpaqueBoxResult(img);assert.equal(draws,before,'成功結果才快取');
assert.deepEqual(measureOpaqueBox(img),real.box,'舊 API 仍回傳 box');
dom2.window.close();
console.log('全屏縮放、登記表、第五技能絕招路由（含時間軸）、量測失敗不快取通過');
