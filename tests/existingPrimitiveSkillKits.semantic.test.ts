// 用既有通用原子完成的整份技能遷移（雙側正式引擎）。
// 這些 op 原本就在 runtime 實作且有引擎讀取端，只是缺合約欄位；本檔驗證接通後的真實行為。
import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { kitEntryIssue } from '../src/effects/effectConnection';
import { MIGRATED_EXISTING_PRIMITIVE_SKILL_KITS as definitions } from '../src/data/migratedExistingPrimitiveSkillKits';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness(); let checks = 0;
const check = async (name: string, fn: () => Promise<void> | void) => { console.log(`檢查：${name}`); await fn(); checks++; console.log(`✓ ${name}`); };
const a = (op: string, p: any) => ({ op, p, label: op });
try {
  defineCustomBlocks();
  await check('2份來源完整精確匹配、合約可執行、真正 Blockly 保存重載', () => {
    let matched = 0;
    for (const def of definitions) for (const id of def.elfIds) {
      const s = h.find(id, def.name);
      assert.equal(s.description, def.description, `${def.name} 原文須完全一致`);
      assert.equal(s.effectMode, 'kit');
      assert.deepEqual(JSON.parse(JSON.stringify(s.kit)), def.kit);
      validateKit(s.kit);
      assert.ok(s.kit.every((e: any) => !kitEntryIssue(e)), `${def.name} 合約`);
      const ws = new Blockly.Workspace(), reload = new Blockly.Workspace();
      try {
        for (const e of s.kit) { const b = buildEntryBlock(ws as any, e)!; assert.ok(b); assert.notEqual(b.type, 'native_effect_reference'); assert.deepEqual(createKitBlockParser('skill')(b, e.node, e.order), e); }
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws), reload);
        const result = reload.getTopBlocks(false).map(b => { const e = JSON.parse(b.data!).entry; return createKitBlockParser('skill')(b, e.node, e.order); }).sort((x, y) => x!.order - y!.order);
        assert.deepEqual(result, s.kit);
      } finally { ws.dispose(); reload.dispose(); }
      matched++;
    }
    assert.equal(matched, 2);
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 毀傷湧進：兩種非附屬類必為不同異常且排除附屬／BOSS 類`, async () => {
      const sk = { ...h.find('5024', '毀傷湧進'), category: '屬性', power: 0 };
      const hist = await h.play(side, { self: h.unit('S', 90000, [sk, h.wait()]), opp: h.unit('E', 90000, [h.wait()]) });
      const got = h.statuses(hist[0].opp);
      assert.equal(got.length, 2, `應恰好兩種不同異常：${JSON.stringify(got)}`);
      for (const n of got) assert.ok(['星賜', '狂暴', '神話', '免疫', '星護'].indexOf(n) < 0, `不應抽到附屬／BOSS：${n}`);
    });
    await check(`${side} 金光綠葉：降對手 PP 1、補自身 PP 1（各自獨立）`, async () => {
      const sk = { ...h.find('5011', '星光·金光綠葉'), category: '屬性', power: 0, isSureHit: true, pp: 5, maxPp: 5 };
      // 對手出招會自然消耗 1 點；改為檢查「未被使用」的槽，才只反映本招的 PP 效果。
      const unused = { ...h.wait(), name: '未用招', pp: 5, maxPp: 10 };
      const hist = await h.play(side, { self: h.unit('S', 90000, [sk, { ...h.wait(), pp: 3, maxPp: 10 }]), opp: h.unit('E', 90000, [h.wait(), unused]) });
      const r = hist[0];
      assert.equal(r.self.skills[1].pp, 4, '自身其餘技能 +1');
      assert.equal(r.opp.skills[1].pp, 4, '對手未使用的技能 -1（只反映本招效果）');
    });
    await check(`${side} 金光綠葉：附加 200 固定傷害且每次使用遞增 100、上限 400`, async () => {
      const base = h.find('5011', '星光·金光綠葉');
      const sk = { ...base, category: '屬性', power: 0, isSureHit: true };
      const hist = await h.play(side, { self: h.unit('S', 90000, [sk, h.wait()]), opp: h.unit('E', 100000, [h.wait()]) }, 3);
      const deltas = hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : 100000) - r.opp.currentHp);
      assert.deepEqual(deltas, [200, 300, 400], `連續使用應為 200/300/400，實際 ${JSON.stringify(deltas)}`);
    });
    await check(`${side} 金光綠葉：消除對手回合類效果成功才把下回合受傷轉為體力`, async () => {
      const sk = { ...h.find('5011', '星光·金光綠葉'), category: '屬性', power: 0, isSureHit: true };
      const enemy = h.kitSkill('敵擊', [a('dmg', { flat: 5000, type: '固定' })]);
      // 第1回合立盾，第2回合消盾；當回合扣血、第3回合轉體力、第4回合正常扣血。
      for(const succeeds of [true,false]){
        const hist=await h.play(side,{self:h.unit('S',20000,[sk,h.wait()],{maxHp:90000,speed:200}),opp:h.unit('E',90000,[succeeds?h.turnEffectSkill():h.wait(),enemy]),
          turns:(_e,t)=>[t===2?0:1,t===1?0:1]},4);
        assert.deepEqual(hist.map(r=>r.self.currentHp),succeeds?[20000,15000,20000,15000]:[20000,15000,10000,5000]);
      }
    });
  }
  console.log(`${checks} checks`);
} finally { await h.close(); }
