import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
const h = await createHarness();
let checks = 0;
try {
  const { MIGRATED_FINAL_MARS_SKILL_KITS: skills, MIGRATED_FINAL_DRAGON_SOUL_KIT: dragon } = await h.server.ssrLoadModule('/src/data/migratedFinalMarsLanDragonKits.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  for (const def of [...skills, dragon]) for (const entry of def.kit) assert.equal(kitEntryIssue(entry), null, def.name + ': ' + entry.customText);
  checks++;
  defineCustomBlocks();
  for (const def of [...skills, dragon]) {
    const work = new Blockly.Workspace(), reload = new Blockly.Workspace();
    try {
      for (const entry of def.kit) { const block = buildEntryBlock(work as any, entry); assert.ok(block); assert.notEqual(block.type, 'native_effect_reference'); }
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(work), reload);
      const restored = reload.getTopBlocks(false).map(block => { const old = JSON.parse(block.data!).entry; return createKitBlockParser(def === dragon ? 'soulmark' : 'skill')(block, old.node, old.order); }).sort((a, b) => a!.order - b!.order);
      assert.deepEqual(restored, [...def.kit].sort((a: any, b: any) => a.order - b.order));
      checks++;
    } finally { work.dispose(); reload.dispose(); }
  }
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const canonical = DEFAULT_ELVES.find((elf: any) => elf.id === '5021');
  assert.equal(canonical.soulMark.effectMode, 'kit', '正式精靈必須接到實際魂印積木');
  for (const side of ['p1', 'p2'] as const) {
    const source = structuredClone(canonical);
    source.battleId = 'canonical-dragon';
    const rounds = await h.play(side, { self: h.unit('ally', 10000, [h.wait()]), opp: h.unit('enemy', 10000, [h.wait()]), selfBench: [source], turns: (engine: any, turn: number) => { console.log('canonical source', side, turn, engine.getState().phase); return [0, 0]; } }, 16);
    const state = rounds.at(-1)!.state;
    for (const elf of [...state.p1Team, ...state.p2Team]) {
      const mark = elf.marks.find((m: any) => m.id === 'poem_chapter');
      assert.equal(mark.count, 16, '正式次元龍在後備仍逐回合發放；16回合不能只保留登場補的1篇');
      assert.equal(mark.effects.poemHpSnapshots.length, 16);
      assert.equal(mark.ownerBattleId, elf.battleId);
    }
    checks++;
  }
  const rawSkill = (name: string) => {
    const def = skills.find((s: any) => s.name === name);
    return { ...h.wait(), name, effectMode: 'kit', kit: structuredClone(def.kit), description: def.description, pp: 10, maxPp: 10 };
  };
  for (const side of ['p1', 'p2'] as const) {
    const fifth = rawSkill('王·超限共頻');
    // 單獨保留資源與能力條款，避免70%吸取／反彈等條款影響斷言。
    fifth.kit = fifth.kit.filter((e: any) => e.order === 6);
    fifth.charge = 2;
    const self = h.unit('S', 10000, [fifth, { ...h.wait(), charge: 0 }], { speed: 300 });
    const [r] = await h.play(side, { self, opp: h.unit('E', 10000, [h.wait()]), turns: () => [0, 0] }, 1);
    assert.equal(r.self.statStages.spatk, 2);
    assert.equal(r.self.skills[1].charge, 5);
    assert.ok(r.self.skills[0].charge >= 6);
    checks++;
    const core = rawSkill('核心重構');
    core.kit = core.kit.filter((e: any) => e.order === 4);
    core.charge = 3;
    const attack = { ...h.wait(), name: '攻', power: 10, category: '物理', pp: 5, maxPp: 5 };
    const removed:number[]=[];h.S.E=(_c:any,event:string,data:any)=>{if(event==='PP_CHANGED'&&data.reason==='clear')removed.push(data.removed);};
    const [pp] = await h.play(side, { self: h.unit('S', 10000, [core], { speed: 300 }), opp: h.unit('E', 10000, [attack, { ...h.wait(), pp: 7, maxPp: 7 }]), turns: () => [0, 0] }, 1);
    const lost = 12 - pp.opp.skills.reduce((sum: number, sk: any) => sum + sk.pp, 0);
    assert.equal(lost, 12);
    assert.deepEqual(removed,[11],'使用技能先正常支付1PP，清除管線實際移除餘下11，不能把成本也當成清除量');
    assert.equal(pp.self.skills[0].charge,3+removed[0],'充能只增加正式清除回執11，原有3點未扣費；不以初始PP總減少量冒充清除量');
    delete h.S.E;
    checks++;
    const dragonUnit = (id: string, hp: number, skill: any = h.wait()) => h.unit(id, hp, [skill], { speed: 300, extra: { soulMark: { name: '龍', effectMode: 'kit', description: dragon.description, kit: structuredClone(dragon.kit).filter((e: any) => e.order <= 2) } } });
    const both = await h.play(side, { self: dragonUnit('D', 10000), opp: h.unit('E', 12000, [h.wait()]), selfBench: [dragonUnit('D2', 15000)], turns: () => [0, 0] }, 1);
    const state = both[0].state;
    assert.equal(both[0].self.maxHp, 10000, '無人死亡時不能轉交存活者詩章並增加在場接收者體力上限');
    assert.equal(both[0].opp.maxHp, 12000, '對手存活時保留原有體力上限');
    assert.equal(state[side + 'Team'][1].maxHp, 15000, '後備接收者也不能在無人死亡時增加體力上限');
    for (const team of [state.p1Team, state.p2Team]) for (const unit of team) {
      const mark = (unit.marks || []).find((m: any) => m.id === 'poem_chapter');
      assert.equal(mark?.count, 2, '兩個規則持有者各為所有存活精靈附加1篇');
      assert.equal(mark.ownerBattleId, unit.battleId);
      assert.equal(mark.effects.poemHpSnapshots.length, 2);
    }
    checks++;
    const kill = h.kitSkill('快照死亡驗證', [{ op: 'dmg', p: { flat: 2000, type: '真實' } }]);
    const death = await h.play(side, { self: dragonUnit('D', 10000, kill), opp: h.unit('E', 1000, [h.wait()]), selfBench: [dragonUnit('D2', 15000)], turns: () => [0, 0] }, 1);
    const own = death[0].state[side + 'Team'];
    assert.equal(own[0].maxHp, 12000, '死亡者兩篇1000快照各轉給在場接收者，不能死亡節點重播');
    assert.equal(own[1].maxHp, 17000, '同一份數量也轉給場下接收者');
    for (const receiver of own) {
      const mark = receiver.marks.find((m: any) => m.id === 'poem_chapter');
      assert.equal(mark.count, 4, '轉移必須同時增加篇數，不能只有體力上限增加');
      assert.equal(mark.effects.poemHpSnapshots.length, 4);
      assert.deepEqual(mark.effects.poemHpSnapshots.slice(-2), [1000, 1000], '轉移保留每篇取得時的體力快照');
      assert.equal(receiver.calculatedStats.hp, receiver.maxHp, '當前能力面板與最大體力同步');
    }
    assert.ok(!death[0].opp.marks.some((m: any) => m.id === 'poem_chapter'), '轉移後消耗死亡原持有者快照');
    assert.equal(death[0].opp.isVanished, true, '轉交後必須走正式消逝入口');
    assert.equal(death[0].opp.maxHp, 0, '一般精靈消逝時體力上限歸零，非單純陣亡');
    assert.ok(own.every((e: any) => !e.isVanished), '存活接收者不能跟著消逝');
    checks++;
  }
  console.log(`finalMarsLanDragon: ${checks} groups passed`);
} finally { await h.close(); }
