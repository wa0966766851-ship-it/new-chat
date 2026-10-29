import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock,createKitBlockParser,defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { MIGRATED_MARK_SOUL_KITS } from '../src/data/migratedMarkSoulKits';
import { MIGRATED_DIRECT_SKILL_KITS } from '../src/data/migratedDirectSkillKits';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const soul=(id:string,orders?:number[])=>{
  const d=MIGRATED_MARK_SOUL_KITS.find(d=>d.elfIds.includes(id))!;
  return {name:d.name,description:d.description,effectMode:'kit',kit:structuredClone(orders?d.kit.filter(e=>orders.includes(e.order)):d.kit)};
};
const strike=(category='物理')=>({...h.wait(),name:'實際攻擊',category,power:100});
try {
  await check('完整原文與持有者匹配：2魂印、6技能資料、9份實際定義均切換Kit',async()=>{
    const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
    for(const d of MIGRATED_MARK_SOUL_KITS)for(const id of d.elfIds){
      const original=DEFAULT_ELVES.find((e:any)=>String(e.id)===id).soulMark;
      assert.equal(original.description,d.description);assert.equal(original.effectMode,'kit');assert.deepEqual(original.kit,d.kit);
    }
    for(const d of MIGRATED_DIRECT_SKILL_KITS)for(const id of d.elfIds){
      const original=h.find(id,d.name);assert.equal(original.description,d.description);assert.equal(original.effectMode,'kit');assert.deepEqual(original.kit,d.kit);
    }
  });
  await check('所有新定義真正Blockly保存、重載；巢狀印記和傷害來源保持完整',()=>{
    defineCustomBlocks();
    for(const d of [...MIGRATED_MARK_SOUL_KITS,...MIGRATED_DIRECT_SKILL_KITS]){
      const ws=new Blockly.Workspace(),back=new Blockly.Workspace();
      try{
        for(const e of d.kit){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),back);
        const entries=back.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser(d.kit[0].source!)(b,e.node,e.order);}).sort((a,b)=>a!.order-b!.order);
        assert.deepEqual(entries,d.kit);
      }finally{ws.dispose();back.dispose();}
    }
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 芳：開局高血、低血兩種快照；非真實輸出與受傷降低各50%，真實不變`,async()=>{
      const mixed=h.kitSkill('兩類傷害',[{op:'dmg',p:{flat:900,type:'固定'}},{op:'dmg',p:{flat:1000,type:'真實'}}]);
      for(const hp of [90000,40000]){
        const [r]=await h.play(side,{self:h.unit('S',hp,[h.wait()],{maxHp:100000,extra:{soulMark:soul('5011')}}),
          opp:h.unit('E',hp===90000?30000:90000,[mixed])});
        assert.equal(r.self.currentHp,hp===90000?88775:73550,r.logs.join('\n'));
      }
    });
    await check(`${side} 灼：雙攻求和；物理恢復再等量傷害、特殊附加再恢復；PP恢復`,async()=>{
      for(const category of ['物理','特殊']){
        const mk=(selected:any)=>({self:h.unit('S',40000,[strike(category),{...h.wait(),pp:3,maxPp:10}],{maxHp:120000,extra:{soulMark:selected}}),opp:h.unit('E',90000,[h.wait()])});
        const [base]=await h.play(side,mk(soul('5006',[2])));const damage=90000-base.opp.currentHp;assert.ok(damage>0);
        const [r]=await h.play(side,mk(soul('5006')));
        assert.equal(r.opp.currentHp,90000-2*damage-40000,r.logs.join('\n'));
        assert.equal(r.self.currentHp,80000+damage,r.logs.join('\n'));
        assert.equal(r.self.skills[1].pp,5);
        const other=side==='p1'?'p2':'p1';assert.equal(r.state[`${other}RegistryState`].starfireBurnTurns||0,0);
        assert.ok(!r.logs.some((s:string)=>s.includes('焰之灼燒')));
      }
    });
    await check(`${side} 持有者反應：對手火／水雙屬性觸發解除、等量真傷、回復與全部PP；對向判定`,async()=>{
      for(const [id,element] of [['5011','火'],['5006','水']]){
        const mk=(withMark:boolean)=>({self:h.unit('S',40000,[strike(),{...h.wait(),pp:3,maxPp:10}],{type:`${element}.普通`,maxHp:100000,extra:withMark?{soulMark:soul(id,[0])}:{}}),opp:h.unit('E',90000,[h.wait()],{type:'草'})});
        const [base]=await h.play(side,mk(false));const damage=90000-base.opp.currentHp;
        const [r]=await h.play(side,mk(true));
        assert.equal(r.opp.currentHp,90000-3*damage,r.logs.join('\n'));assert.equal(r.self.currentHp,40000+2*damage);
        assert.equal(r.self.skills[1].pp,10);assert.equal(r.state[`${side==='p1'?'p2':'p1'}Marks`].length,0);
      }
    });
    await check(`${side} 3回合期限包含登場回合；灼阻止持有者回血，到期後恢复`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',90000,[h.wait()],{extra:{soulMark:soul('5006',[0])}}),opp:h.unit('E',4000,[h.healSkill(1000)],{maxHp:10000})},4);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[4000,4000,4000,5000]);
    });
    await check(`${side} 兩種捨身撞擊按實際傷害的1/4及1/2扣自身體力`,async()=>{
      for(const name of ['捨身撞擊','星光·捨身撞擊']){
        const sk={...h.find('5011',name),isSureHit:true},mk=(skill:any)=>({self:h.unit('S',9000,[skill]),opp:h.unit('E',10000,[h.wait()])});
        const [base]=await h.play(side,mk({...h.wait(),category:sk.category,power:sk.power,type:sk.type}));const damage=10000-base.opp.currentHp;
        const [r]=await h.play(side,mk(sk));assert.ok(damage>0);assert.equal(r.self.currentHp,9000-Math.floor(damage/(name==='捨身撞擊'?4:2)),r.logs.join('\n'));
      }
    });
    await check(`${side} 聖潔只封對自身的屬性技能，5回合後結束；必中也受封鎖`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',10000,[h.find('300','聖潔'),h.wait()],{speed:200}),
        opp:h.unit('E',10000,[h.kitSkill('必中屬性攻擊',[{op:'dmg',p:{flat:1000,type:'固定'}}])]),turns:(_e,t)=>[t===1?0:1,0]},6);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[10000,10000,10000,10000,10000,9000]);
    });
    await check(`${side} 手下留情實際公式傷害保留對手1點體力`,async()=>{
      const sk={...h.find('5020','手下留情'),category:'物理',power:10000,isSureHit:true};
      const [r]=await h.play(side,{self:h.unit('S',10000,[sk]),opp:h.unit('E',1000,[h.wait()])});assert.equal(r.opp.currentHp,1);
    });
  }
  console.log(`遷移优先批次 ${checks} 項集中複檢通過；未授予全部定義語意驗收`);
}finally{await h.close();}
