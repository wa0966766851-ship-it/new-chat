import assert from 'node:assert/strict';import{createHarness}from'./helpers/migrationHarness';
const h=await createHarness();try{
 const {MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migratedArena16DragonHealingSoulKit.ts');
 const repeat=structuredClone(source.kit.find((e:any)=>e.order===5));delete repeat.params.clause.body[0].cond;
 for(const side of ['p1','p2'] as const)for(const attack of [false,true]){
  const hits:any[]=[];h.S['重播受方']=(_c:any,event:string,data:any)=>{if(event==='AFTER_DAMAGE')hits.push(data.damageType);};
  const use=h.kitSkill('完整技能重播',[{op:'dmg',p:{flat:11,type:'固定'}}],{pp:10,maxPp:10,category:attack?'物理':'屬性',power:attack?100:0});
  const [v]=await h.play(side,{self:h.unit('重播持有者',5000,[use],{speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:[repeat]}}}),opp:h.unit('重播受方',20000,[h.wait()])});
  assert.equal(hits.filter(k=>k==='fixed').length,5,'原使用一次加額外四次，每次都執行自己的命中效果');
  assert.equal(hits.filter(k=>k==='skill_attack').length,attack?5:0,'攻擊技能每次都進正式攻擊公式，屬性技能沒有假傷害');
  if(!attack)assert.equal(v.opp.currentHp,19945);
  assert.equal(v.self.skills[0].pp,9,'額外使用不重複扣PP');assert.equal(v.state[side+'RegistryState'].executingSkillRepeat,false);assert.equal(v.state[side+'RegistryState'].pendingSkillRepeats,undefined,'不得遞迴新增四乘四次重播');
 }
 for(const side of ['p1','p2'] as const){
  const use=Array.from({length:5},(_,i)=>h.kitSkill('正式槽'+i,[{op:'dmg',p:{flat:i===4?11:1,type:'固定'}}],{pp:10,maxPp:10}));
  const hist=await h.play(side,{self:h.unit('真龍首次喚醒持有者',5000,use,{speed:300,extra:{soulMark:{...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>[0,1,4,5,13].includes(e.order)))}}}),opp:h.unit('真龍首次喚醒受方',20000,[h.wait()]),turns:(_e:any,t:number)=>[t-1,0]},5);
  assert.equal(hist[4].opp.currentHp,16941,'首次第五技能當次重播，每次屬性使用皆以四條龍各追加150點龍系傷害');
  assert.equal(hist[4].self.skills[4].pp,9);
 }
 for(const side of ['p1','p2'] as const){
  const grant=h.kitSkill('解除PP限制',[{op:'pp_unlimited_until_switch',p:{}}]);
  const empty=h.kitSkill('零PP仍可出手',[{op:'dmg',p:{flat:77,type:'固定'}}],{pp:0,maxPp:5});
  const history=await h.play(side,{self:h.unit('PP持有者',5000,[grant,empty]),selfBench:[h.unit('換人',5000,[h.wait()])],opp:h.unit('PP受方',10000,[h.wait()]),turns:(_e:any,t:number)=>t===1?[0,0]:t===2?[1,0]:[{switch:1},0]},3);
  assert.equal(history[1].opp.currentHp,9923,'實際選出零PP技能且效果結算');assert.equal(history[1].self.skills[1].pp,0);
  assert.equal(history[2].state[side+'Team'][0].ppLimitIgnoredUntilSwitch,false,'下場解除個體PP豁免');
 }
 console.log('正式技能重播：P1/P2攻擊與屬性各1+4次、每次完整傷害／效果、僅一次PP、不遞迴；PP零可選及下場解除通過');
}finally{await h.close();}
