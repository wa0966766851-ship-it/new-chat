import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
try {
  const { ALIEN_TRAITS } = await h.server.ssrLoadModule('/src/data/alienTraits.ts');
  const { traitNames } = await h.server.ssrLoadModule('/src/effects/traitEffects.ts');
  const { restorePrd } = await h.server.ssrLoadModule('/src/utils/prd.ts');
  const equip = (name: string, enable = true) => ({
    groupIds: enable ? ['alien'] : [],
    alienTraits: { alienTrait: { ...ALIEN_TRAITS[name] } },
  });
  for (const name of Object.keys(ALIEN_TRAITS)) {
    assert.deepEqual(traitNames(h.unit('A', 1000, [h.wait()], {extra:equip(name)})), [name]);
    assert.deepEqual(traitNames(h.unit('A', 1000, [h.wait()], {extra:{isAlienElf:true,...equip(name,false)}})), []);
  }
  const attack = {...h.wait(),name:'測試攻擊',type:'普通',category:'物理',power:100,isSureHit:true};
  for (const side of ['p1','p2'] as const) {
    const both = [0,0] as [number,number];
    for(const type of ['固定','百分比','真實','技能']) {
      const source = h.kitSkill('分類傷害',[{op:'dmg',p:{flat:60,type,...(type==='技能'?{elem:'普通'}:{})}}]);
      const [result]=await h.play(side,{
        self:h.unit('A',1000,[source],{extra:equip('淨化')}),
        opp:h.unit('B',1000,[h.wait()],{statStages:{atk:2,def:-1}}),
      });
      assert.ok(result.opp.currentHp<1000);
      assert.equal(result.opp.statStages.atk||0,type==='真實'?2:0,`${side} ${type}淨化`);
      assert.equal(result.opp.statStages.def,-1);
    }

    const [guarded] = await h.play(side,{
      self:h.unit('A',1000,[h.kitSkill('固定',[{op:'dmg',p:{flat:60,type:'固定'}}])],{extra:equip('淨化')}),
      opp:h.unit('B',1000,[h.kitSkill('護強化',[{op:'stat_protect_turns',p:{turns:3}}],{priority:6})],{statStages:{atk:2}}),
    });
    assert.equal(guarded.opp.statStages.atk,2);
    assert.ok(!guarded.logs.some((line:string)=>line.includes('【淨化】')));

    const typedDamage = async (selfTrait?: string, oppTrait?: string, extra = {}) => {
      const [result] = await h.play(side, {
        self: h.unit('A', 1000, [h.kitSkill('附加普通系傷害', [{op:'dmg',p:{flat:100,type:'技能',elem:'普通'}}])],
          {extra:selfTrait ? equip(selfTrait) : {}}),
        opp: h.unit('B', 1000, [h.wait()], {extra:{...extra,...(oppTrait ? equip(oppTrait) : {})}}),
        turns: () => { restorePrd([], () => 0); return both; },
      });
      return 1000 - result.opp.currentHp;
    };
    assert.equal(await typedDamage(), 100);
    assert.equal(await typedDamage('強化'), 120);
    assert.equal(await typedDamage(undefined, '守護'), 50);
    assert.equal(await typedDamage(undefined, undefined, {trait:{name:'堅硬',description:'受到技能傷害減少 14%'}}), 86);

    const resultFor = async (power:number, status:string, trait?:string) => {
      const [result] = await h.play(side,{
        self:h.unit('A',1000,[{...attack,power}],{speed:200,extra:{critValue:0,...(trait?equip(trait):{})}}),
        opp:h.unit('B',1000,[h.wait()],{extra:{battleStatuses:{[status]:3}}}),
        turns:()=>{restorePrd([],()=>0);return both;},
      });
      assert.ok(result.opp.currentHp < 1000, `${status}解除或回合結算不可洗回已扣除的體力`);
      if (status === '睡眠') assert.ok(!result.opp.battleStatuses?.睡眠, '命中後解除睡眠');
      return result.opp.currentHp;
    };
    for (const [trait, status] of Object.entries({灼熱:'燒傷',霜襲:'凍傷',毒攻:'中毒',殘忍:'麻痺',恐懼:'害怕',困頓:'睡眠',操控:'疲憊',落石:'石化'})) {
      assert.equal(await resultFor(100,status,trait),await resultFor(200,status),`${trait}威力翻倍，以完整傷害公式對照`);
    }
    assert.equal(await resultFor(100,'燒傷','殘忍'),await resultFor(100,'燒傷'),'其他異常不會觸發殘忍');

    const hit={...attack,power:20};
    const turns = (trait?: string)=>h.play(side,{
      self:h.unit('A',2000,[hit,h.wait()],{extra:{critValue:0,...(trait?equip(trait):{})}}),
      opp:h.unit('B',2000,[h.wait()],{extra:{barrier:100}}),
      turns:(_engine,t)=>{restorePrd([],()=>0);return t===1?both:[1,0];},
    },4);
    const plain=await turns(), cut=await turns('切割');
    assert.deepEqual(cut.map((r,i)=>plain[i].opp.currentHp-r.opp.currentHp),[50,100,150,150],'切割只在前三個回合造成真實傷害');
    assert.equal(cut[2].opp.barrier,100,'切割不被護罩吸收');
    console.log(`✓ ${side} 淨化各傷害分類與保護、異常威力倍率、切割三次真傷`);
  }
  console.log(`✓ ${Object.keys(ALIEN_TRAITS).length} 項異能通用特質都通過裝備與標籤檢查`);
} finally { await h.close(); }
process.exit(0);
