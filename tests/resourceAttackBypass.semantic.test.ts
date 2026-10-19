import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();try{
 const {MIGRATED_ARENA16_MONSTER_SKILL_KIT:[def]}=await h.server.ssrLoadModule('/src/data/migratedArena16MonsterKit.ts');
 const {resourceQueryActive}=await h.server.ssrLoadModule('/src/battle/resourceQueryRules.ts');
 const {attackDefenseBypass}=await h.server.ssrLoadModule('/src/battle/attackDefense.ts');
 const {ignoresAttackImmunity}=await h.server.ssrLoadModule('/src/battle/attackImmunity.ts');
 const unlock=()=>({...h.wait(),name:def.name,category:'特殊',power:100,effectMode:'kit',kit:structuredClone(def.kit.filter((e:any)=>[0,1,9].includes(e.order)))});
 const plain=()=>({...h.wait(),name:'後續普通攻擊',category:'特殊',power:100});
 for(const side of ['p1','p2'] as const){
  for(const mode of ['plain','immune','cap','block','conversion','shield']){
   h.S['正式防護受方']=(ctx:any,ev:string)=>{if(ev==='ON_ENTRANCE'){
    if(mode==='immune')ctx.setPlayerState('blockAttackCount',5);
    if(mode==='cap'){ctx.setPlayerState('incomingSkillDmgCapTurns',5);ctx.setPlayerState('incomingSkillDmgCap',1);}
    if(mode==='shield')ctx.updateElf(ctx.actor,{shield:99999});
    if(mode==='block'||mode==='conversion')ctx.addTimerTo(ctx.actor,{id:'防護',kind:'use_counter',source:'soulmark',remaining:5,tickAt:'never',payload:{block:mode==='block'?{blockAttack:true}:{absorbToHeal:true,kind:'攻擊'}}},false);
   }};
   const results=await h.play(side,{self:h.unit('持有者',10000,[unlock(),plain()],{speed:400}),opp:h.unit('正式防護受方',100000,[h.wait()]),turns:(_e:any,t:number)=>[t-1,0]},2);
   if(['plain','immune','cap','block'].includes(mode))for(const result of results)assert.ok(result.opp.currentHp<100000,side+'/'+mode+'首次及後續其他攻擊均穿透');
   if(mode==='immune')assert.equal(results[1].state[(side==='p1'?'p2':'p1')+'RegistryState'].blockAttackCount,5,'貫穿不消耗對手免疫次數');
   if(mode==='conversion'||mode==='shield')assert.equal(results[1].opp.currentHp,100000,'龍魂之力沒有授予無視轉化或護盾');
   assert.equal(resourceQueryActive(results[1].self,'ignoreDamageLimit'),true,'資源規則由正式持有者讀取');
   assert.ok(!results[1].logs.some((l:string)=>l.includes('效果待接通')));
  }
  delete h.S['正式防護受方'];
  const counting={...h.wait(),name:'固有使用去重',category:'特殊',power:100,effectMode:'kit',kit:['innate','attached'].map((role,order)=>({codeId:'effect_sequence',source:'skill',role,node:'on_skill_use',order,customText:'計數',params:{clause:{raw:'計數',trig:'use',parsed:true,body:[{acts:[{op:'resource_mark_add',label:'計數',p:{id:role+'Count',name:role,displayChar:'數',unit:'層',description:'去重驗證',side:'self',scope:'elf',persistsOffField:true,amount:1,maxCount:100}}]}]}}}))};
  const [once]=await h.play(side,{self:h.unit('去重持有者',10000,[counting],{speed:400}),opp:h.unit('去重受方',100000,[h.wait()])});
  for(const id of ['innateCount','attachedCount'])assert.equal(once.state[side+'Marks'].find((m:any)=>m.id===id)?.count,1,'固有及附加均僅執行一次 '+id+' '+JSON.stringify(once.state[side+'Marks'])+' '+once.logs.join('\n'));

  h.S['命中閘門受方']=(ctx:any,ev:string)=>{if(ev==='ON_ENTRANCE')ctx.setPlayerState('blockAttackCount',1);};
  const [miss]=await h.play(side,{self:h.unit('閘門持有者',10000,[counting],{speed:400}),opp:h.unit('命中閘門受方',100000,[h.wait()])});
  assert.equal(miss.state[side+'Marks'].find((m:any)=>m.id==='innateCount')?.count,1,'免疫前固有使用效果執行一次');
  assert.equal(miss.state[side+'Marks'].find((m:any)=>m.id==='attachedCount'),undefined,'未命中不執行附加效果');
  delete h.S['命中閘門受方'];
  const [sealed]=await h.play(side,{self:h.unit('附加封鎖持有者',10000,[unlock()],{speed:400,extra:{isAdditionalInvalid:true}}),opp:h.unit('普通受方',100000,[h.wait()])});
  assert.equal(resourceQueryActive(sealed.self,'ignoreAttackImmunity'),true,'固有取得不受附加封鎖影響');
  const [invalid]=await h.play(side,{self:h.unit('固有封鎖持有者',10000,[unlock()],{speed:400,extra:{isInherentInvalid:true}}),opp:h.unit('普通受方',100000,[h.wait()])});
  assert.equal(resourceQueryActive(invalid.self,'ignoreAttackImmunity'),false);
  // 使用前快照：首次正常倍率、再次最高倍率；由既有正式測試逐回合比較傷害。
 }
 const mark={id:'r',count:1,scope:'elf',ownerBattleId:'holder'};
 const rule={id:'r',min:1,ignoreDamageLimit:true,ignoreDamageBlock:true,ignoreAttackImmunity:true};
 const holder:any={id:'x',battleId:'holder',marks:[mark],resourceQueryRules:[rule]};
 assert.equal(ignoresAttackImmunity(holder,{},plain()),'持有資源無視攻擊免疫');
 for(const category of ['fixed','percent','true','skill_attribute','skill_extra_action'])assert.deepEqual(attackDefenseBypass(holder,{},category),{},'僅攻擊傷害取得穿透');
 assert.equal(resourceQueryActive({...holder,battleId:'other'},'ignoreDamageLimit'),false,'他人的個體資源不能借用');
 assert.equal(resourceQueryActive({...holder,marks:[]},'ignoreDamageLimit'),false,'資源移除立即失效');
 assert.equal(resourceQueryActive({...holder,isInherentInvalid:true},'ignoreDamageLimit'),false,'固有失效時不讀取權限');
 console.log('龍魂之力：P1/P2首次免疫穿透、後續其他攻擊、上限/抵擋、轉化/盾保留、次數不消耗、個體歸屬與失效通過');
}finally{await h.close();}
