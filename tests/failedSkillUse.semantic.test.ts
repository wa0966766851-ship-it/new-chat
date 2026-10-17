import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {getBattleSkillOnInvalidRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {requestSkillRecalculation}=await h.server.ssrLoadModule('/src/battle/skillRecalculation.ts');
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const invalidRegistry=getBattleSkillOnInvalidRegistry();
const a=(op:string,p:any)=>({op,p,label:op});
const check=async(n:string,f:()=>Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const trait=(acts:any[])=>({name:'使用後監控',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'使用後監控',trig:'entrance',parsed:true,body:[{acts}]}}}]});
const watch=(trig:string)=>a('timed',{turns:3,from:'now',trig,body:[{acts:[a('heal_flat',{amount:100})]}]});
try{
 for(const side of ['p1','p2'] as const){
  await check(`${side} 純白聖翎：無效的屬性技能使用後真正歸零，三回合期滿恢復`,async()=>{
   const skills=Array.from({length:4},(_,i)=>h.kitSkill('屬性'+i,[a('stat',{side:'self',stats:['攻擊'],v:1})]));
   const r=await h.play(side,{self:h.unit('S',10000,[structuredClone(h.find('5014','純白聖翎')),h.wait()],{speed:200}),opp:h.unit('E',10000,skills),turns:(_,t)=>[t===1?0:1,t-1]},4);
   for(let i=0;i<3;i++){assert.equal(r[i].opp.skills[i].pp,0);assert.equal(r[i].opp.statStages.atk||0,0);}
   assert.equal(r[0].opp.skills[1].pp,99,'沒有使用的技能不受歸零影響');
   assert.equal(r[3].opp.skills[3].pp,98);assert.equal(r[3].opp.statStages.atk,1);
  });
  await check(`${side} 未施放純白聖翎沒有歸零或無效效果`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()]),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.opp.skills[0].pp,98);
  });
  for(const category of ['屬性','物理'] as const){
   await check(`${side} ${category}成功／無效收尾各通知一次，分類監控不混用`,async()=>{
    for(const invalid of [false,true]){
     const acts=[watch('opp_after_skill'),watch(category==='屬性'?'opp_after_status':'opp_after_attack'),watch(category==='屬性'?'opp_after_attack':'opp_after_status')];
     if(invalid)acts.push(a('invalid_turns',{turns:1,kind:category==='屬性'?'屬性':'攻擊'}));
     const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{trait:trait(acts)}}),opp:h.unit('E',10000,[{...h.wait(),category,power:0}])});
     assert.equal(r.self.currentHp,1200,`${invalid?'無效':'成功'}：通用及同類各一次`);
    }
   });
  }
  await check(`${side} 睡眠未出手與切換均不冒充技能使用後`,async()=>{
   for(const asleep of [false,true]){
    const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{trait:trait([watch('opp_after_skill')])}}),opp:h.unit('E',10000,[h.wait()],{extra:asleep?{trait:trait([a('status',{side:'self',status:'睡眠',chance:100,turns:3})])}:{}}),oppBench:[h.unit('B',10000,[h.wait()])],turns:()=>[0,asleep?0:{switch:1}]});
    assert.equal(r.self.currentHp,1000);if(asleep)assert.equal(r.opp.skills[0].pp,99);
   }
  });
  await check(`${side} 未命中／閃避／攻擊免疫各只收尾一次，公式重算不重播`,async()=>{
   for(const kind of ['miss','evade','immune','retry']){
    const attack={...h.wait(),name:'測試重算攻擊',category:'物理',power:10,isSureHit:false,accuracy:kind==='miss'?0:100};
    const acts=[watch('opp_after_skill'),watch('opp_after_attack')];
    if(kind==='immune'||kind==='retry')acts.push(a('immune_attack_count',{count:1}));
    const extra:any={trait:trait(acts)};
    if(kind==='evade')extra.soulMark=structuredClone(DEFAULT_ELVES.find((e:any)=>e.id==='5005').soulMark);
    let retries=0;
    if(kind==='retry')invalidRegistry[attack.name]=(ctx:any)=>{retries++;requestSkillRecalculation(ctx,{powerMultiplier:2});};
    try{
     const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra}),opp:h.unit('E',10000,[attack])});
     const logs=r.logs.join('\n');
     if(kind==='retry'){assert.equal(retries,1);assert.ok(r.self.currentHp<1200);}
     else{assert.equal(r.self.currentHp,1200);assert.match(logs,kind==='miss'?/沒有命中/:kind==='evade'?/閃避了/:/免疫了/);}
     assert.equal(r.opp.skills[0].pp,98,'收尾與重算不二次扣PP');
    }finally{delete invalidRegistry[attack.name];}
   }
  });
 }
 console.log(`失敗技能使用後：${checks} 項通過`);
}finally{await h.close();}
