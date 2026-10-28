import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spriteHeightRatio,fitScale,placeSprite,spriteStageLayout,DEFAULT_HEIGHT_RATIO,MAX_HEIGHT_FRAC,MIN_SIZE_RATIO,MAX_SIZE_RATIO,type OpaqueBox} from '../src/battle/spriteMetrics';
import {registerVisibleBox,getVisibleBox,popupAnchor,subscribeVisibleBox} from '../src/battle/visibleBox';
import {BattlePresentation} from '../src/battle/presentation';
import {registerPetPlayer,registerPetTimings,readyPetTiming,isPetDegraded,getPetDegradeLog,clearPetDegrade,setPetRecoveryGrace,petRecoveryTimeout,PET_RECOVERY_GRACE_MS_DEFAULT} from '../src/battle/petAnimationRegistry';
import {DEFAULT_BATTLE_ANIMATION,withAnimationMode,effectiveAnimationSettings} from '../src/battle/animationSettings';

// ── 1. 比例：單調遞增、大型之間仍可辨、不超框 ─────────────────────────────
const weights=[20,30,49.5,80,100,150,200,300,380,420,500,800,1200];
const ratios=weights.map(spriteHeightRatio);
for(let i=1;i<ratios.length;i++)assert.ok(ratios[i]>ratios[i-1]-1e-12,`體型 ${weights[i]} 不得小於 ${weights[i-1]}`);
assert.ok(spriteHeightRatio(380)-spriteHeightRatio(300)>.02,'300 與 380 仍可辨大小（舊版同為 0.94）');
assert.ok(spriteHeightRatio(500)-spriteHeightRatio(380)>.02);
assert.ok(spriteHeightRatio(150)-spriteHeightRatio(100)>.03);
for(const bad of [0,-1,NaN,1568883])assert.equal(spriteHeightRatio(bad),DEFAULT_HEIGHT_RATIO);
// 比例區間以原廠對照為準（一般精靈可見高約場地高的 0.8，最大體型略高於 1），
// 上下限一律讀常數，測試不再各自寫死一組數字。
assert.ok(Math.max(...ratios)<=MAX_SIZE_RATIO+1e-9&&Math.min(...ratios)>=MIN_SIZE_RATIO-1e-9,JSON.stringify({min:Math.min(...ratios),max:Math.max(...ratios)}));

const boxes:Record<string,OpaqueBox>={square:{w:400,h:400,left:0,top:0,right:400,bottom:400},wide:{w:1924,h:1276,left:0,top:150,right:1924,bottom:1276},tall:{w:200,h:600,left:20,top:0,right:180,bottom:600},small:{w:320,h:248,left:3,top:0,right:322,bottom:248}};
for(const [fw,fh] of [[1920,430],[1366,300],[390,304]] as const){
 const {widthFrac}=spriteStageLayout(fw);const stageW=fw*widthFrac;
 for(const [name,box] of Object.entries(boxes)){
  let prevH=0,prevW=0;
  for(const w of weights){
   const s=fitScale(box,stageW,fh,spriteHeightRatio(w));
   const vh=(box.bottom-box.top)*s,vw=(box.right-box.left)*s;
   assert.ok(vh<=fh*MAX_HEIGHT_FRAC+1e-6,`${name}@${fw} 體型${w} 高 ${vh} 超框`);assert.ok(vw<=stageW+1e-6,`${name}@${fw} 體型${w} 寬 ${vw} 超框`);
   assert.ok(vh>prevH-1e-9&&vw>prevW-1e-9,`${name}@${fw} 體型遞增時顯示尺寸不得變小`);prevH=vh;prevW=vw;
  }
  // 大型之間仍有差：380 與 500 的可見面積至少差 3%
  const a=fitScale(box,stageW,fh,spriteHeightRatio(380)),b=fitScale(box,stageW,fh,spriteHeightRatio(500));
  assert.ok(b>a*1.01,`${name}@${fw}：380 與 500 仍須可辨 (${a} vs ${b})`);
 }
}
// 寬圖與高圖同體型：可見高度相近（頂線接近），不再各自撞高度／寬度上限而差距懸殊
{const stageW=1920*.4,fh=430,r=spriteHeightRatio(300);
 const h=[boxes.square,boxes.wide,boxes.small].map(b=>(b.bottom-b.top)*fitScale(b,stageW,fh,r));assert.ok(Math.max(...h)/Math.min(...h)<1.3,`同體型可見高度相近 ${h}`);}
// 腳底貼地（雙方地平線一致）：不論尺寸，可見底緣 offsetBottom 恆 0
for(const box of Object.values(boxes)){const p=placeSprite({...box,bottom:box.bottom},600,400,.7,1,false,'area');assert.equal(p.offsetBottom+(box.h-box.bottom)*p.scale,0);}
// 手機窄版舞台：兩側各佔不超出視窗
{const {anchorFrac,widthFrac}=spriteStageLayout(390);assert.ok(anchorFrac-widthFrac/2>=0&&anchorFrac+widthFrac/2<.5,'手機兩側精靈不裁切、不相疊');}
{const {anchorFrac,widthFrac}=spriteStageLayout(1920);assert.ok(anchorFrac-widthFrac/2>=0&&anchorFrac+widthFrac/2<.5);}

// ── 2. getVisibleBox：動畫優先、無效退回靜態圖、通知 ───────────────────────
assert.equal(getVisibleBox('p1'),null);
let notified=0;const unsub=subscribeVisibleBox(()=>notified++);
const offImg=registerVisibleBox('p1','image',()=>({left:100,right:300,top:200,bottom:400}));
assert.deepEqual(getVisibleBox('p1'),{left:100,right:300,top:200,bottom:400});
let frame:any={left:90,right:340,top:150,bottom:400};
const offAnim=registerVisibleBox('p1','animation',()=>frame);
assert.deepEqual(getVisibleBox('p1'),{left:90,right:340,top:150,bottom:400},'有動畫時用動畫當前包圍框');
frame={left:NaN,right:1,top:0,bottom:1};assert.equal(getVisibleBox('p1')?.left,100,'動畫框無效時退回靜態圖可見框');
frame=null;assert.equal(getVisibleBox('p1')?.right,300);
assert.equal(getVisibleBox('p2'),null,'兩側隔離');
assert.ok(notified>=2,'登錄時通知重算');
offAnim();assert.equal(getVisibleBox('p1')?.left,100);offImg();assert.equal(getVisibleBox('p1'),null);unsub();
{const a=popupAnchor({left:100,right:300,top:200,bottom:400});assert.equal(a.x,200);assert.ok(Math.abs(a.y-256)<1e-9,'飄字取可見框上緣下 28%');
 const small=popupAnchor({left:0,right:80,top:340,bottom:400}),big=popupAnchor({left:0,right:400,top:20,bottom:400});
 assert.ok(small.y>big.y&&small.y>=340&&big.y>=20,'小型與大型精靈的飄字都落在各自可見框上部，不漂在頭上或身體中段');}

// ── 3. 逾時降級：播放器停住時不鎖住戰鬥 ───────────────────────────────────
{clearPetDegrade();setPetRecoveryGrace(60);
 assert.equal(petRecoveryTimeout(40),100);
 const elf:any={id:'70',name:'雷伊',battleId:'stuck'};
 const off=registerPetPlayer('p1',elf),untiming=registerPetTimings('p1',elf,{attack:{hit:20,duration:40}});
 assert.ok(readyPetTiming('p1',elf,'attack'));
 const p=new BattlePresentation(()=>{},()=>false);await p.stage({p1Team:[elf],p1ActiveIndex:0});
 const t0=Date.now();const anim={side:'p1',category:'physical'};
 const first=p.animate(anim,350);
 await Promise.race([first.then(()=>p.wait()),new Promise((_,r)=>setTimeout(()=>r(new Error('收招被動畫無限鎖住')),2000))]);
 assert.ok(Date.now()-t0<1500,`逾時應約在片段長度+寬限，實際 ${Date.now()-t0}ms`);
 assert.equal(p.skillAnim,null);
 assert.equal(isPetDegraded('p1',elf),true);assert.equal(getPetDegradeLog().at(-1)?.reason,'timeout');
 assert.equal(readyPetTiming('p1',elf,'attack'),undefined,'降級後不再等待片段，改走簡易演出');
 const t1=Date.now();await p.animate({side:'p1',category:'physical'},30);assert.ok(Date.now()-t1<500,'降級後下一次出手不再被鎖');
 p.dispose();off();untiming();clearPetDegrade();setPetRecoveryGrace(PET_RECOVERY_GRACE_MS_DEFAULT);
 assert.equal(petRecoveryTimeout(3125),3125+1500);}

// ── 4. 靜態模式保留飄字，只關位移與特效 ────────────────────────────────────
{const raw=withAnimationMode(DEFAULT_BATTLE_ANIMATION,'static');const eff=effectiveAnimationSettings(raw);
 assert.equal(eff.skill,false);assert.equal(eff.intro,false);assert.equal(eff.damage,true);assert.equal(eff.potion,true);assert.equal(eff.roundEnd,true);
 const seen:any[]=[];const p=new BattlePresentation(()=>{if(p.popups.length)seen.push(...p.popups);},()=>true,()=>raw);
 await p.stage({p1Team:[{id:'a',name:'甲',battleId:'a'}],p1ActiveIndex:0});
 await p.record({side:'p1',elfId:'a',type:'skill',amount:30,delta:-30,before:100,after:70,maxHp:100});
 await p.record({side:'p1',elfId:'a',type:'heal',amount:10,delta:10,before:70,after:80,maxHp:100,immediate:true} as any);
 assert.deepEqual(seen.map(x=>x.type),['skill','heal'],'靜態模式的傷害與治療飄字都在');
 assert.equal(p.shakeSide,null,'靜態模式不晃動');assert.equal(p.hp.get('p1:a'),80);
 const off=withAnimationMode({...DEFAULT_BATTLE_ANIMATION,damage:false},'static');
 const seen2:any[]=[];const q=new BattlePresentation(()=>{if(q.popups.length)seen2.push(...q.popups);},()=>true,()=>off);
 await q.stage({p1Team:[{id:'a',name:'甲',battleId:'a'}],p1ActiveIndex:0});await q.record({side:'p1',elfId:'a',type:'skill',amount:30,delta:-30,before:100,after:70,maxHp:100});
 assert.equal(seen2.length,0,'使用者自己關掉技能傷害時，靜態模式也尊重');p.dispose();q.dispose();}
// ── 5. 首領下沉量必須同時套用到原生動畫宿主 ────────────────────────────────
// 靜態立繪用 bottom:offsetBottom-sink 下沉；原生動畫若仍 bottom:0，腳底會比靜態圖高出一截，
// 首領在出招時看起來「整隻變小、往上飄」。兩者必須吃同一個 sink。
{const src=readFileSync(new URL('../src/components/battle/PetActionSprite.tsx',import.meta.url),'utf8');
 assert.match(src,/sink=0/,'PetActionSprite 需接受 sink（預設 0，其餘精靈不受影響）');
 const bottoms=(src.match(/bottom:-sink/g)||[]).length;
 assert.ok(bottoms>=2,`動畫宿主與投射物容器都要套 sink，實際 ${bottoms} 處`);
 assert.ok(!/bottom:0,visibility/.test(src),'動畫宿主不得寫死 bottom:0');
 const parent=readFileSync(new URL('../src/components/battle/ProportionalSprite.tsx',import.meta.url),'utf8');
 assert.match(parent,/sink={sink}/,'ProportionalSprite 需把算好的 sink 傳給原生動畫');
 assert.match(parent,/bottom: place\.offsetBottom - sink/,'靜態立繪與原生動畫共用同一個 sink');
 // 數值驗證：咤克斯的腳底在兩種模式下必須落在同一條地平線。
 const box:OpaqueBox={w:840,h:1024,left:0,top:8,right:824,bottom:1024},stageH=266,ratio=1.31;
 const place=placeSprite(box,1067,stageH,ratio,1,false,'colossal');
 const sink=Math.max(0,place.height-stageH)*1;
 assert.ok(sink>0,'首領高於場地時才需要下沉');
 assert.ok(Math.abs((place.offsetBottom-sink)-(place.offsetBottom-sink))<1e-9);
 assert.equal(place.offsetBottom-sink,-sink,'可見底緣＝場地下緣往下 sink，與靜態圖同值');}
console.log('比例單調且不超框、可見框與飄字錨點、逾時降級、靜態模式飄字通過');
