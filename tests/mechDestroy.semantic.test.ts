import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {MIGRATED_5016_MECH_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const {OPS,evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
  const entries=source.kit.filter((e:any)=>[12,13,14,104].includes(e.order));
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{
    for(const e of entries){assert.equal(kitEntryIssue(e),null);assert.ok(buildEntryBlock(w as any,e));}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),entries);
  }finally{w.dispose();r.dispose();}
  const mode={codeId:'effect_sequence',source:'soulmark',role:'innate',node:'on_entered',order:0,customText:'測試模式',params:{clause:{raw:'測試模式',trig:'entrance',parsed:true,body:[{acts:[{op:'mech_combo',p:{mech:'毀滅'},label:'測試模式'}]}]}}};
  const soul=(orders:number[])=>({...source,name:'任意毀滅機甲',effectMode:'kit',kit:[structuredClone(mode),...structuredClone(entries.filter((e:any)=>orders.includes(e.order)))]});
  for(const side of ['p1','p2'] as const){
    const powers:number[]=[];
    h.S['威力受方']=(_c:any,event:string,data:any)=>{if(event==='MODIFY_POWER'&&data.isIncoming)powers.push(data.powerComp.power);};
    const attack={...h.wait(),name:'編輯後攻擊',category:'物理',power:100,ppUnlimited:true};
    await h.play(side,{self:h.unit('威力持有者',100000,[attack],{extra:{soulMark:soul([12,104])}}),opp:h.unit('威力受方',10000000,[h.wait()])},9);
    assert.deepEqual(powers.map(Math.round),[210,220,230,240,250,260,270,270,270],'每次使用增加10%威力，總增幅封頂170%');
    for(const hp of [20000,30000,70000])for(const charge of [0,1]){
      const selected={...h.wait(),name:'同名槽',charge};
      const [result]=await h.play(side,{self:h.unit('分支持有者',1000,[{...selected,charge:9},selected],{maxHp:200000,extra:{soulMark:soul([13,14])}}),opp:h.unit('分支受方',hp,[h.wait()],{maxHp:100000,extra:{shield:10000,barrier:10000}}),turns:()=>[1,0]});
      const acted=charge>0&&hp!==30000;
      assert.deepEqual(result.self.skills.map((s:any)=>s.charge),[9,acted?0:charge],'只消耗選中的第二同名槽，無充能不得借用其他槽');
      if(hp===20000&&charge){
        assert.equal(result.opp.currentHp,0,'低於30%直接消耗體力，不能用固定傷害被盾罩承傷');
        assert.equal(result.opp.shield,10000);assert.equal(result.opp.barrier,10000);
        assert.equal(result.self.calculatedStats.atk,390,'消耗後自身能力值提升30%');
      }else if(hp===70000&&charge){
        // 百分比傷害先經正式盾罩結算；恢復採同一結算值，不按自身最大體力取30%。
        assert.equal(result.self.currentHp,31000,'高於30%附加三萬百分比傷害並恢復三萬');
      }else{
        assert.equal(result.opp.currentHp,hp,'恰好30%或零充能時不觸發');
        assert.equal(result.self.currentHp,1000);assert.equal(result.self.calculatedStats.atk,300);
      }
    }
  }
  // 同一次公式重算不能再次累積；屬性技與錯誤槽不借充能。
  const values:any={},ctx:any={roundNumber:1,actionId:4,skill:{category:'物理'},getPlayerState:(k:string)=>values[k],setPlayerState:(k:string,v:any)=>values[k]=v};
  const p={key:'edited',step:.1,cap:.7};OPS.power_growth_add(ctx,p,{});OPS.power_growth_add(ctx,p,{});
  assert.equal(values['powerGrowth:edited'].value,.1);
  ctx.skill.category='屬性';ctx.actionId++;assert.equal(OPS.power_growth_add(ctx,p,{}),false);
  console.log('毀滅機甲：P1/P2真實威力210→270封頂、30%臨界、原槽充能/零充能、HP消耗與等量恢復、Blockly通過');
}finally{await h.close();}
