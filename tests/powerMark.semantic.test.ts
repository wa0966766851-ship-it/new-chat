import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;const powers:number[]=[];
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {eventEffectNode}=await h.server.ssrLoadModule('/src/effects/effectNodes.ts');
const {MIGRATED_DIXIN_SOUL_KIT:def}=await h.server.ssrLoadModule('/src/data/migratedDixinSoulKit.ts');
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(node:string,trig:string,acts:any[])=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,params:{clause:{raw:'可編輯威力',trig,parsed:true,body:[{acts}]}}});
const mod=(boost=1,perMark:any={side:'self',id:'resource'},trig='outgoing_power')=>entry('modify_power',trig,[a('power_mod',{boost,...(perMark?{perMark}:{})})]);
const trait=(kit:any[])=>({name:'測試原始層數',description:'可編輯威力',effectMode:'kit',kit});
const soul=(kit:any[])=>({name:'任意改名魂印',description:'可編輯威力',effectMode:'kit',kit:structuredClone(kit)});
const add=(id:string,amount:number)=>a('resource_mark_add',{id,amount,side:'self',scope:'elf',name:id,displayChar:'層',unit:'層',description:'原始層數',persistsOffField:true});
const seed=(n:number,id='resource')=>n?trait([entry('on_entered','entrance',[add(id,n)])]):undefined;
const hit=(power=10)=>({...h.wait(),name:'對照攻擊',category:'物理',power});
const own=(skill:any,extra:any={})=>h.unit('S',10000,[skill],{speed:200,type:'草',extra:{level:1,...extra}});
const enemy=(skill:any=h.wait(),extra:any={})=>h.unit('E',10000,[skill],{type:'草',extra:{level:1,...extra}});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
h.S.E=(_:any,e:any,d:any)=>{if(e===T.MODIFY_POWER&&d?.isIncoming)powers.push(d.powerComp.power);};
let edited:any;
try{
  await check('正式威力節點與合約：不允許公式後／使用時偽裝威力，拒絕未知數值與查詢',()=>{
    assert.equal(eventEffectNode(T.MODIFY_POWER),'modify_power');assert.equal(sequenceIssue(mod().params.clause,'modify_power'),null);
    for(const e of [mod(0),mod(Infinity),mod(-1),mod(1,{side:'both',id:'x'}),mod(1,{side:'self',id:'x',callback:'x'})])assert.ok(sequenceIssue(e.params.clause,e.node));
    for(const [trig,node] of [['use','on_skill_use'],['outgoing_attack','before_damage'],['passive','passive_always']])assert.ok(sequenceIssue({...mod().params.clause,trig},node));
    assert.ok(sequenceIssue(mod().params.clause,'before_damage'));
  });
  await check('真實Blockly威力節點保存重載，改印記識別碼與每層增量後仍可執行',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{const slot=w.newBlock('custom_node_slot');slot.setFieldValue('modify_power','TARGET_NODE');const b=buildEntryBlock(w as any,mod() as any)!;assert.ok(b);slot.getInput('STACK')!.connection!.connect(b.previousConnection!);
      const act=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;const p=JSON.parse(act.getFieldValue('PARAMS'));p.boost=2;p.perMark.id='edited';act.setFieldValue(JSON.stringify(p),'PARAMS');
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);const restored=r.getTopBlocks(false)[0];edited=createKitBlockParser('soulmark')(restored.getInputTargetBlock('STACK'),'modify_power',0)!;assert.equal(sequenceIssue(edited.params.clause,edited.node),null);
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 荒產品每層威力與固傷倍率相乘，伏魔不提前解鎖，墮魔必須八層才生效`,async()=>{
      for(const [count,fumo,duomo] of [[0,1,1],[1,1,1],[2,0,1],[7,1,1],[8,0,1],[8,1,1],[9,1,0]] as const){
        const kit=def.kit.filter((e:any)=>[8,9].includes(e.order));
        const marks=[...(count?[add('bahuang_mark',count)]:[]),...(fumo?[add('fumo_mark',fumo)]:[]),...(duomo?[{...add('duomo_mark',duomo),p:{...add('duomo_mark',duomo).p,side:'opp'}}]:[])];
        const factor=(fumo?2:1)*(count>=8&&duomo?2:1),power=10*(1+.13*count*factor);
        powers.length=0;
        const [r]=await h.play(side,{self:own(hit(),{soulMark:soul(kit),trait:trait([entry('on_entered','entrance',marks)])}),opp:enemy()});
        assert.equal(powers[0],power,`layers=${count}, fumo=${fumo}, duomo=${duomo}`);
        const [manual]=await h.play(side,{self:own(hit(power)),opp:enemy()});
        assert.equal(r.opp.currentHp,manual.opp.currentHp-(count>=2?39*count*factor:0),r.logs.join('\n'));
        const actual=r.state[`${side}Marks`].find((m:any)=>m.id==='bahuang_mark'&&m.ownerBattleId==='S')?.count||0;
        assert.equal(actual,count,'虛擬計數不得寫回原始層數');
      }
    });
    await check(`${side} 荒實際1層條目逐層修改威力，0／1／2／7層等同直接帶入正確威力`,async()=>{
      for(const count of [0,1,2,7]){
        const kit=def.kit.filter((e:any)=>e.order===8);powers.length=0;
        const [r]=await h.play(side,{self:own(hit(),{soulMark:soul(kit),trait:seed(count,'bahuang_mark')}),opp:enemy()});assert.equal(powers[0],10*(1+.13*count));
        const [base]=await h.play(side,{self:own(hit(10*(1+.13*count))),opp:enemy()});assert.equal(r.opp.currentHp,base.opp.currentHp,r.logs.join('\n'));
      }
    });
    await check(`${side} 威力3倍符合公式前乘區，並非把最終傷害3倍；固定附加100保持100`,async()=>{
      const [base]=await h.play(side,{self:own(hit()),opp:enemy()});
      const [manual]=await h.play(side,{self:own(hit(30)),opp:enemy()});
      const attack=h.kitSkill('對照攻擊',[a('dmg',{flat:100,type:'固定'})],{category:'物理',power:10});
      const [r]=await h.play(side,{self:own(attack,{soulMark:soul([mod(2)]),trait:seed(1)}),opp:enemy()});
      assert.equal(10000-r.opp.currentHp,10000-manual.opp.currentHp+100);assert.notEqual(10000-manual.opp.currentHp,(10000-base.opp.currentHp)*3);
    });
    await check(`${side} 命中附加先加層，公式前讀最新3層，不用技能使用時1層快照`,async()=>{
      powers.length=0;const attack=h.kitSkill('先加層',[add('resource',2)],{category:'物理',power:10});
      await h.play(side,{self:own(attack,{soulMark:soul([mod()]),trait:seed(1)}),opp:enemy()});assert.equal(powers[0],40);
    });
    await check(`${side} 受方outgoing不重乘攻方；同名使用槽的附加威力也不借給對方`,async()=>{
      const source=hit();const e=hit();
      e.kit=[{...mod(3,null),source:'skill',role:'attached'}];
      const [r]=await h.play(side,{self:own(source),opp:enemy(e)});
      const [base]=await h.play(side,{self:own(source),opp:enemy(hit(40))});assert.equal(r.opp.currentHp,base.opp.currentHp);assert.equal(r.self.currentHp,base.self.currentHp);
      const [both]=await h.play(side,{self:own(hit(),{soulMark:soul([mod(1,null)])}),opp:enemy(h.wait(),{soulMark:soul([mod(1,null)])})});
      const [manual]=await h.play(side,{self:own(hit(20)),opp:enemy()});assert.equal(both.opp.currentHp,manual.opp.currentHp);
    });
    await check(`${side} 受方incoming專用條目能修改攻方威力；屬性技能不走威力節點`,async()=>{
      const [r]=await h.play(side,{self:own(hit()),opp:enemy(h.wait(),{soulMark:soul([mod(2,null,'incoming_power')])})});
      const [manual]=await h.play(side,{self:own(hit(30)),opp:enemy()});assert.equal(r.opp.currentHp,manual.opp.currentHp);
      powers.length=0;await h.play(side,{self:own(h.wait(),{soulMark:soul([mod(9,null)])}),opp:enemy()});assert.ok(powers.every(p=>p===0));
    });
    await check(`${side} 不借同id場下持有者資源；編輯後改名實際將威力10改30`,async()=>{
      powers.length=0;const bench=h.unit('S',10000,[h.wait()],{extra:{battleId:'B',trait:trait([entry('battle_start','battle_start',[add('resource',10)])])}});
      await h.play(side,{self:own(hit(),{soulMark:soul([mod()])}),selfBench:[bench],opp:enemy()});assert.equal(powers[0],10);
      powers.length=0;await h.play(side,{self:own(hit(),{soulMark:soul([edited]),trait:seed(1,'edited')}),opp:enemy()});assert.equal(powers[0],30);
    });
  }
  console.log(`${checks} power mark checks passed`);
}finally{delete h.S.E;await h.close();}
