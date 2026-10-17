import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {MIGRATED_DIXIN_SOUL_KIT:def}=await h.server.ssrLoadModule('/src/data/migratedDixinSoulKit.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {preservePrd,resetPrd}=await h.server.ssrLoadModule('/src/utils/prd.ts');
const restore=preservePrd();
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const powers:number[]=[];
h.S.E=(_:any,event:any,data:any)=>{if(event===T.MODIFY_POWER&&data?.isIncoming)powers.push(data.powerComp.power);};
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(node:string,trig:string,acts:any[])=>({codeId:'effect_sequence',node,source:'mechanic',role:'innate',order:0,params:{clause:{raw:'設定正式印記',trig,parsed:true,body:[{acts}]}}});
const mark=(id:string,amount:number,side='self')=>a('resource_mark_add',{id,amount,side,name:id,scope:'elf',unit:'層',displayChar:'層',persistsOffField:true,description:'正式層數'});
const seed=(layers:number,fumo=0,duomo=0)=>({name:'分層情境',effectMode:'kit',kit:[entry('on_entered','entrance',[mark('bahuang_mark',layers),...(fumo?[mark('fumo_mark',fumo)]:[]),...(duomo?[mark('duomo_mark',duomo,'opp')]:[])])]});
// 使用產品的原始條目，不複製其動作；分層測試不宣稱整份魂印已驗收。
const soul=(order:number)=>({name:def.name,description:def.description,effectMode:'kit',kit:structuredClone(def.kit.filter((e:any)=>e.order===order))});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
try{
  await check('產品3／5／7層條目均通過嚴格合約，原始魂印描述仍完整保存',()=>{
    for(const order of [5,6,7])for(const e of soul(order).kit)assert.equal(sequenceIssue(e.params.clause,e.node),null);
    assert.ok(def.description.includes('並有50%機率'));assert.ok(def.description.includes('等同於對方墮魔印記層數'));
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 產品已解鎖層數兩回合連動：免疫生成伏魔立即增加護罩，下次攻擊再讀虛擬層數`,async()=>{
      const kit=structuredClone(def.kit.filter((e:any)=>[5,6,7,8,9].includes(e.order)));
      const defense={name:'百分比免疫',effectMode:'kit',kit:[entry('before_damage','incoming_nontrue',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:1})])]};
      powers.length=0;
      const history=await h.play(side,{self:h.unit('S',3000,[{...h.wait(),name:'層數攻擊',category:'物理',power:10}],{maxHp:9000,extra:{level:1,soulMark:{name:'改名層數魂印',description:def.description,effectMode:'kit',kit},trait:seed(8,0,2)}}),
        opp:h.unit('E',9000,[h.wait()],{statStages:{atk:6,def:1,speed:-2},extra:{trait:defense}}),turns:()=>{resetPrd(()=>.99999);return [0,0];}},2);
      assert.equal(powers[0],10*(1+.13*8*2));assert.equal(powers[1],10*(1+.13*8*4));
      for(const [i,r] of history.entries()){
        assert.equal(r.self.currentHp,9000);assert.equal(r.self.barrier,i===0?4:12);
        assert.equal(r.self.statStages.atk,i===0?4:6);assert.equal(r.opp.statStages.atk,i===0?2:0);assert.equal(r.opp.statStages.speed,-2);
        assert.equal(r.state[`${side}Marks`].find((m:any)=>m.id==='fumo_mark'&&m.ownerBattleId==='S').count,(i+1)*2);
        assert.equal(r.state[`${side}Marks`].find((m:any)=>m.id==='bahuang_mark'&&m.ownerBattleId==='S').count,8);
      }
    });
    await check(`${side} 八層且對手墮魔才翻倍PP／吸取／免疫替代真傷和伏魔；伏魔不額外倍增固定量`,async()=>{
      for(const layers of [7,8])for(const duomo of [0,1])for(const immune of [false,true]){
        const doubled=layers===8&&duomo===1;
        const defense=immune?{name:'百分比免疫',effectMode:'kit',kit:[entry('before_damage','incoming_nontrue',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:1})])]}:undefined;
        const [r]=await h.play(side,{self:h.unit('S',9000,[h.wait()],{extra:{soulMark:soul(5),trait:seed(layers,1,duomo)}}),opp:h.unit('E',9000,[h.wait()],{extra:{trait:defense}})});
        assert.equal(r.opp.currentHp,immune?9000-(doubled?600:300):doubled?3000:6000,r.logs.join('\n'));
        assert.equal(r.opp.skills[0].pp,doubled?94:96);
        assert.equal(r.state[`${side}Marks`].find((m:any)=>m.id==='fumo_mark'&&m.ownerBattleId==='S')?.count,1+(immune?(doubled?2:1):0));
      }
    });
    await check(`${side} 八層墮魔翻倍同次最大／已損失恢復，伏魔不提前解鎖五層`,async()=>{
      for(const [layers,fumo,duomo,expected] of [[4,1,1,3000],[5,1,1,8000],[8,1,0,8000],[8,0,1,9000]] as const){
        const [r]=await h.play(side,{self:h.unit('S',3000,[h.wait()],{maxHp:9000,extra:{soulMark:soul(6),trait:seed(layers,fumo,duomo)}}),opp:h.unit('E',9000,[h.wait()]),turns:()=>{resetPrd(()=>.99999);return [0,0];}});
        assert.equal(r.self.currentHp,expected,r.logs.join('\n'));
      }
    });
    await check(`${side} 七層效果在八層墮魔時護罩與每項吸取都翻倍，保留剩餘提升與負能力`,async()=>{
      for(const layers of [7,8])for(const duomo of [0,2]){
        const doubled=layers===8&&duomo>0,amount=duomo*(doubled?2:1);
        const [r]=await h.play(side,{self:h.unit('S',9000,[h.wait()],{extra:{soulMark:soul(7),trait:seed(layers,3,duomo)}}),opp:h.unit('E',9000,[h.wait()],{statStages:{atk:6,def:1,speed:-2}})});
        assert.equal(r.self.barrier,doubled?6:3);assert.equal(r.self.statStages.atk||0,amount);assert.equal(r.opp.statStages.atk,6-amount);assert.equal(r.opp.statStages.def,duomo?0:1);assert.equal(r.opp.statStages.speed,-2);
      }
    });
    await check(`${side} 3層：只有百分比免疫轉300真傷＋1伏魔，護罩或0上限不冒充免疫`,async()=>{
      for(const mode of ['normal','immune','barrier','cap']){
        const defense=mode==='immune'?{name:'百分比免疫',effectMode:'kit',kit:[entry('before_damage','incoming_nontrue',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:1})])]}:mode==='cap'?{name:'零上限',effectMode:'kit',kit:[entry('on_entered','entrance',[a('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:0,turns:2,next:false})])]}:undefined;
        const [r]=await h.play(side,{self:h.unit('S',9000,[h.wait()],{extra:{soulMark:soul(5),trait:seed(3)}}),opp:h.unit('E',9000,[h.wait()],{extra:{trait:defense,...(mode==='barrier'?{barrier:9000}:{})}})});
        assert.equal(r.opp.currentHp,mode==='normal'?6000:mode==='immune'?8700:9000,r.logs.join('\n'));
        assert.equal(r.state[`${side}Marks`].find((m:any)=>m.id==='fumo_mark'&&m.ownerBattleId==='S')?.count||0,mode==='immune'?1:0);
        assert.equal(r.opp.skills[0].pp,96);
      }
    });
    await check(`${side} 5層：控制PRD取樣驗證50%分支可中可不中，四層不得觸發`,async()=>{
      for(const [layers,draw,expected] of [[5,0,true],[5,.99999,false],[4,0,false]] as const){
        const [r]=await h.play(side,{self:h.unit('S',3000,[h.wait()],{maxHp:9000,extra:{soulMark:soul(6),trait:seed(layers)}}),opp:h.unit('E',9000,[h.wait()]),turns:()=>{resetPrd(()=>draw);return [0,0];}});
        assert.equal(r.self.currentHp,layers===5?8000:3000,'最大體力與已損失體力取同次恢復前快照');
        const timers=r.state[`${side==='p1'?'p2':'p1'}Timers`];assert.equal(timers.some((t:any)=>t.payload?.block?.invalid==='all'),expected,r.logs.join('\n'));
      }
    });
    await check(`${side} 7層：每項吸取不超過墮魔層數，無印記不吸；負能力與剩餘提升保留`,async()=>{
      for(const duomo of [0,2]){
        const [r]=await h.play(side,{self:h.unit('S',9000,[h.wait()],{extra:{soulMark:soul(7),trait:seed(7,3,duomo)}}),opp:h.unit('E',9000,[h.wait()],{statStages:{atk:6,def:1,speed:-2}})});
        assert.equal(r.self.barrier,3);assert.equal(r.self.statStages.atk||0,duomo);assert.equal(r.opp.statStages.atk,6-duomo);assert.equal(r.opp.statStages.def,duomo?0:1);assert.equal(r.opp.statStages.speed,-2);
      }
    });
  }
  console.log(`${checks} dixin soul tier checks passed (partial soul coverage)`);
}finally{delete h.S.E;restore();await h.close();}
