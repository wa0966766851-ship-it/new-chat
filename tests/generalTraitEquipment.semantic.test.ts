import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
try {
  const { GENERAL_TRAITS } = await h.server.ssrLoadModule('/src/data/generalTraits.ts');
  const { traitNames, traitPowerMultiplier, afterSkillHit } = await h.server.ssrLoadModule('/src/effects/traitEffects.ts');
  const { computeHitChance } = await h.server.ssrLoadModule('/src/effects/genericSkillText.ts');
  const { calculateDamage } = await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
  const { readStatPercent } = await h.server.ssrLoadModule('/src/effects/soulProperty.ts');
  const { prdConstant, prdChance, restorePrd } = await h.server.ssrLoadModule('/src/utils/prd.ts');
  const current = (name: string) => ({ alienTraits: {generalTrait: { ...GENERAL_TRAITS[name] }} });
  const legacy = (name: string) => ({ trait: { ...GENERAL_TRAITS[name] } });

  for (const name of Object.keys(GENERAL_TRAITS)) {
    const old = h.unit('old', 1000, [h.wait()], { extra: legacy(name) });
    const modern = h.unit('new', 1000, [h.wait()], { extra: current(name) });
    const equippedTwice = { ...old, ...current(name) };
    if (name === '亂舞') {
      assert.equal(readStatPercent(equippedTwice, 'atk'), 12);
    } else {
      assert.deepEqual(traitNames(old), [name]);
      assert.deepEqual(traitNames(modern), [name]);
      assert.deepEqual(traitNames(equippedTwice), [name]);
    }
  }

  const core = h.unit('core', 1000, [h.wait()]);
  const attacker = { ...core, ...legacy('炎火') };
  const defender = h.unit('defender', 1000, [h.wait()]);
  const attack = { ...h.wait(), name:'物攻', type:'火·電', category:'物理', power:100, accuracy:70, isSureHit:false };
  assert.ok(Math.abs(traitPowerMultiplier(attacker, attack) - 1.14) < 1e-12);
  assert.equal(traitPowerMultiplier(attacker, { ...attack, type:'冰' }), 1);
  const plain = (elf: any, skill: any) => calculateDamage(elf, defender, skill, 'p1', undefined, undefined, 1);
  restorePrd([], () => .999);
  assert.deepEqual(plain(attacker, attack), plain(core, { ...attack, power:114 }), '屬性特性必須進技能威力乘區');
  assert.ok(Math.abs(computeHitChance({ ...core, ...legacy('精準') }, defender, attack, () => ({})) - .798) < 1e-12);

  for (const [name, status, accepted, ignored] of [['火熱','燒傷','特殊','物理'],['靜電','麻痺','物理','特殊']]) {
    const source = { ...core, ...current(name) };
    const hits: string[] = [];
    const ctx = { actor:'p1', self:source, target:defender, addLog:()=>{}, applyStatusWithImmunityCheck:(_side: string, applied: string) => { hits.push(applied); return {success:true}; } };
    restorePrd([], () => 0);
    afterSkillHit(source, defender, {...attack, category:ignored}, 10, false, ctx, {...ctx, actor:'p2'}, () => 0);
    assert.deepEqual(hits, []);
    afterSkillHit(source, defender, {...attack, category:accepted}, 10, false, ctx, {...ctx, actor:'p2'}, () => 0);
    assert.deepEqual(hits, [status]);
  }

  for (const side of ['p1','p2'] as const) {
    const strike = { ...attack, type:'普通', isSureHit:true, accuracy:100 };
    const dealt = async (name?: string) => {
      const [round] = await h.play(side, {
        self: h.unit('holder', 1000, [strike], { extra: {critValue:0, ...(name ? current(name) : {})} }),
        opp: h.unit('defender', 1000, [h.wait()], { extra: current('堅硬') }),
        turns:()=>{restorePrd([], () => 0);return [0,0];},
      });
      return 1000 - round.opp.currentHp;
    };
    assert.equal(await dealt('強攻') - await dealt(), 80, '堅硬只削減主傷害');
    const [benchRound] = await h.play(side, {
      self: h.unit('active', 1000, [h.wait()]),
      selfBench:[h.unit('reserve', 1000, [h.wait()], { extra: current('回神') })],
      opp: h.unit('caster', 2000, [h.wait()]),
      turns:engine=>{
        restorePrd([], () => 0);
        engine.pushEffect({type:'damage',side,data:{amount:900,damageType:'fixed',targetId:'reserve'}});
        return [0,0];
      },
    });
    assert.equal(benchRound.self.currentHp, 1000);
    assert.equal(benchRound.state[side + 'Team'][1].currentHp, 1000, '場下持有者回神，回復指定個體');
    for (const damage of [860,900,1500]) {
      const [round] = await h.play(side, {
        self: h.unit('holder', 1000, [h.wait()], { extra: current('回神') }),
        opp: h.unit('caster', 2000, [h.kitSkill('固定傷害', [{ op:'dmg', p:{flat:damage, type:'固定'} }])]),
        turns:()=>{restorePrd([], () => 0);return [0,0];},
      });
      assert.equal(round.self.currentHp, damage === 860 ? 140 : 1000, `${side}/${damage}: 體力門檻與致死各走一次 ${JSON.stringify(round.logs)}`);
    }
  }
  const known = [[.08,.00955241569674],[.01,.00015604169167],[.001,.00000156975007]];
  for (const [p, c] of known) assert.ok(Math.abs(prdConstant(p) - c) < 1e-12, `PRD p=${p}`);
  assert.ok(prdConstant(.0001) > 0);
  assert.equal(prdChance('below-resolution', .000001), false);
  console.log(`✓ ${Object.keys(GENERAL_TRAITS).length} 項通用特性的兩種資料來源、同名去重、威力與命中、火熱／靜電、雙方回神及低機率 PRD`);
} finally { await h.close(); }
process.exit(0);
