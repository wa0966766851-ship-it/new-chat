import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const original=structuredClone(DEFAULT_ELVES.find((e:any)=>String(e.id)==='5035').soulMark);
  for(const e of original.kit)assert.equal(kitEntryIssue(e),null,'完整魂印每個入口必須通過正式合約');
  const entries=original.kit.filter((e:any)=>e.node!=='on_entered'&&/lowHealthDefenseMode|missing_hp_scaled/.test(JSON.stringify(e)));
  assert.equal(entries.length,5);
  for(const e of entries)assert.equal(sequenceIssue(e.params.clause,e.node),null);
  const modeSoul={...original,kit:entries.filter((e:any)=>/lowHealthDefenseMode/.test(JSON.stringify(e)))};
  const scaleSoul={...original,kit:entries.filter((e:any)=>/missing_hp_scaled/.test(JSON.stringify(e)))};
  defineCustomBlocks();const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{
    for(const e of original.kit){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
    assert.deepEqual(reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);}),original.kit);
  }finally{ws.dispose();reload.dispose();}
  const ordinary=h.kitSkill('普通屬性傷害',[{op:'dmg',p:{flat:1000,type:'技能',elem:'普通'}}]);
  const modeAttack=h.kitSkill('異常與傷害',[{op:'status',p:{side:'opp',status:'害怕',chance:100,turns:3}},{op:'dmg',p:{flat:1000,type:'技能',elem:'普通'}}]);
  for(const side of ['p1','p2'] as const){
    for(const [hp,oppHp,low] of [[10000,100000,false],[4000,100000,true],[5000,100000,false],[4000,4000,false],[4000,3000,false]] as const){
      const [r]=await h.play(side,{self:h.unit('模式持有者',hp,[{...h.wait(),priority:10}],{maxHp:10000,extra:{soulMark:modeSoul}}),opp:h.unit('模式攻方',oppHp,[modeAttack])});
      assert.equal(r.state[side+'RegistryState'].lowHealthDefenseMode,low,'雙低於條件與半血／等血邊界');
      assert.equal(h.statuses(r.self).includes('害怕'),low,'正常模式免疫；低血模式開放異常');
      assert.equal(hp-r.self.currentHp,low?250:1000,'低血模式技能傷害上限；其他模式不偷加上限');
    }
    const cross=h.kitSkill('跨越半血',[{op:'dmg',p:{flat:2000,type:'真實'}},{op:'status',p:{side:'opp',status:'害怕',chance:100,turns:3}},{op:'dmg',p:{flat:1000,type:'技能',elem:'普通'}}]);
    const [sameRound]=await h.play(side,{self:h.unit('模式持有者',6000,[{...h.wait(),priority:10}],{maxHp:10000,extra:{soulMark:modeSoul}}),opp:h.unit('跨線攻方',100000,[cross])});
    assert.equal(sameRound.self.currentHp,3000);assert.ok(!h.statuses(sameRound.self).includes('害怕'),'回合中跨低血線不即時偷換模式');
    const changed=await h.play(side,{self:h.unit('模式持有者',4000,[{...h.healSkill(3000),priority:10},h.wait()],{maxHp:10000,extra:{soulMark:modeSoul}}),opp:h.unit('恢復模式攻方',100000,[modeAttack]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
    assert.equal(changed[0].self.currentHp,6750,'本回合回血越線仍維持回合開始取得的上限');
    assert.equal(changed[1].state[side+'RegistryState'].lowHealthDefenseMode,false,'下一回合重新取樣恢復免疫');
    assert.equal(changed[1].self.currentHp,5750);
    for(const hp of [10000,9001,9000,5000,4999]){
      const own=h.kitSkill('增傷探針',[{op:'dmg',p:{flat:1000,type:'技能',elem:'普通'}}],{priority:10});
      const [r]=await h.play(side,{self:h.unit('增幅持有者',hp,[own],{maxHp:10000,extra:{soulMark:scaleSoul}}),opp:h.unit('增幅對手',100000,[h.wait()])});
      const steps=Math.floor(((10000-hp)/10000+1e-10)/.1);
      assert.equal(100000-r.opp.currentHp,Math.floor(1000*(1+1.5*1.1**steps)),'當次傷害立即增幅，無需先前回合timer');
      assert.equal(r.self.currentHp,Math.min(10000,hp+Math.floor(1500*1.1**steps)),'每次恢復按當時失血獨立取樣並封頂');
    }
    for(const type of ['固定','百分比','真實']){
      const own=h.kitSkill('非技能-'+type,[{op:'dmg',p:{flat:1000,type}}]);
      const [r]=await h.play(side,{self:h.unit('分類持有者',5000,[own],{maxHp:10000,extra:{soulMark:scaleSoul}}),opp:h.unit('分類對手',100000,[h.wait()])});
      assert.equal(100000-r.opp.currentHp,1000,'技能增傷不擴張到'+type);
    }
    const attack={...h.wait(),name:'公式增傷探針',category:'物理',power:100,priority:10};
    const formula=(soul:any)=>h.play(side,{self:h.unit('公式增幅持有者',5000,[attack],{maxHp:10000,extra:soul?{soulMark:soul}:{}}),opp:h.unit('公式增幅對手',100000,[h.wait()])});
    const [base]=await formula(null),[boosted]=await formula(scaleSoul);
    assert.equal(100000-boosted.opp.currentHp,Math.floor((100000-base.opp.currentHp)*(1+1.5*1.1**5)),'真正公式攻擊亦在當次傷害管線取得增幅');
    const blocked=h.kitSkill('禁療與傷害',[{op:'no_heal',p:{turns:2}},{op:'dmg',p:{flat:1000,type:'真實'}}]);
    const [noHeal]=await h.play(side,{self:h.unit('禁療持有者',5000,[h.wait()],{maxHp:10000,extra:{soulMark:scaleSoul}}),opp:h.unit('禁療對手',100000,[blocked])});
    assert.equal(noHeal.self.currentHp,4000,'回合回血仍走正式禁療，而非體力重置');
    const edited=structuredClone(scaleSoul);edited.name='任意增幅名稱';
    for(const e of edited.kit){const p=e.params.clause.body[0].acts[0].p;p.step=.25;p.multiplier=1.2;if(p.baseBoost)p.baseBoost=1;else p.baseRatio=.1;}
    const [custom]=await h.play(side,{self:h.unit('改值持有者',5000,[ordinary],{maxHp:10000,extra:{soulMark:edited}}),opp:h.unit('改值對手',100000,[h.wait()])});
    assert.equal(100000-custom.opp.currentHp,2440);assert.equal(custom.self.currentHp,6440,'改步長倍率比例後照積木執行');
    const immuneSoul={name:'測試異常免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',role:'innate',order:0,params:{clause:{raw:'測試免疫',trig:'before_status',parsed:true,body:[{acts:[{op:'status_guard',p:{cls:''},label:'免疫'}]}]}}}]};
    const drops={op:'stat',p:{side:'opp',stats:['攻擊'],v:-1}};
    const fixed={op:'dmg',p:{type:'固定',flat:1000}};
    const ppClear={op:'pp_op',p:{side:'opp',mode:'zero'}};
    const probes=['水','火','草'].map((type,i)=>h.kitSkill('完整魂印-'+type,[{op:'dmg',p:{flat:1000,type:'技能',elem:type}},...[drops,fixed,ppClear].slice(i,i+1)],{priority:10}));
    const finalProbe=h.kitSkill('保護到期後觸發三色',[fixed,drops,ppClear],{priority:10});
    const all=await h.play(side,{self:h.unit('完整魂印持有者',10000,[h.wait()],{type:'龍',extra:{soulMark:original}}),opp:h.unit('完整魂印對手',100000,[...probes,h.wait(),finalProbe],{extra:{soulMark:immuneSoul}}),turns:(_e:any,t:number)=>[0,t-1]},5);
    const marks=(i:number)=>all[i].state[side+'Marks'].filter((m:any)=>m.ownerBattleId==='完整魂印持有者'&&m.id.startsWith('hamo_scale_'));
    assert.deepEqual(marks(2).map((m:any)=>m.id).sort(),['hamo_scale_紅色','hamo_scale_綠色','hamo_scale_藍色'].sort(),JSON.stringify(all.map((r:any)=>({marks:r.state[side+'Marks'].map((m:any)=>m.id),timers:r.state[side+'Timers'].map((t:any)=>({id:t.id,remaining:t.remaining,lock:t.payload?.block?.markLock})),logs:r.logs}))));
    assert.equal(all[2].opp.maxHp,80000,'受保護綠鱗仍執行消失副作用');
    assert.equal(marks(4).length,0,'白鱗耗盡且保護到期後，三色能在同一回合真正消耗');
    assert.equal(all[4].opp.maxHp,64000);assert.equal(all[4].self.currentHp,10000);
    assert.equal(all[4].state[side+'RegistryState'].hamoScales,undefined,'未重播舊魂印私有狀態路徑');
  }
  console.log('哈莫常駐：P1/P2低血模式取樣／邊界／跨回合恢復／失血逐次增幅／傷害分類／禁療與Blockly往返通過');
}finally{await h.close();}
