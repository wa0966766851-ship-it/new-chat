import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness(); let count = 0;
try {
  const { MIGRATED_FINAL_DELU_SOUL_KIT: def } = await h.server.ssrLoadModule('/src/data/migratedFinalOdinDeluBelienteKits.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  for (const entry of def.kit) assert.equal(kitEntryIssue(entry), null, entry.customText);
  const soul = (entries = def.kit) => ({ name: def.name, description: def.description, effectMode: 'kit', kit: structuredClone(entries) });
  for (const side of ['p1', 'p2'] as const) {
    // 正式魂印（非專名精靈），戰鬥初始化與印記每層200%寫入可被實際重量端使用。
    const actor = h.unit('source', 10000, [h.wait()], { extra: { soulMark: soul() } });
    const [initial] = await h.play(side, { self: actor, opp: h.unit('enemy', 10000, [h.wait()]) });
    assert.equal(initial.self.maxHp, 3000000); assert.equal(initial.self.currentHp, 3000000); count++;
    const marks = initial.state[side + 'Marks'];
    assert.equal(marks.find((m: any) => m.id === 'delu_shackles')?.effects?.weightIncreasePercentPerStack, 2); count++;
    // 固定傷害結算後，雙防300+300的一半＝300；傷害對手並只回復實際吸取量。
    const fixed = h.kitSkill('定額700', [{ op: 'dmg', p: { flat: 700, type: '固定' } }]);
    const [received] = await h.play(side, { self: h.unit('source', 10000, [h.wait()], { extra: { soulMark: soul(def.kit.filter((e:any)=>[0,6].includes(e.order))) } }), opp: h.unit('enemy', 10000, [fixed]) });
    assert.equal(received.self.currentHp, 3000000 - 700 + 300); assert.equal(received.opp.currentHp, 9700); count++;
    const [whole] = await h.play(side, { self: h.unit('source', 10000, [h.wait()], { extra: { soulMark: soul() } }), opp: h.unit('enemy', 10000, [fixed]) });
    assert.equal(whole.self.currentHp,2999750,'整份魂印高血分支非真傷+50%，固定吸取300→450');assert.equal(whole.opp.currentHp,9550);count++;
    // 受到真實傷害時由當前印記持有者自帶程式轉移，無須名為迪露。
    const trueHit = h.kitSkill('真傷1', [{ op: 'dmg', p: { flat: 1, type: '真實' } }]);
    const [transferred] = await h.play(side, { self: h.unit('source', 10000, [h.wait()], { extra: { soulMark: soul() } }), opp: h.unit('enemy', 10000, [trueHit]) });
    const other = side === 'p1' ? 'p2' : 'p1';
    assert.equal(transferred.state[side + 'Marks'].find((m: any) => m.id === 'delu_shackles')?.count, 4);
    assert.equal(transferred.state[other + 'Marks'].find((m: any) => m.id === 'delu_shackles')?.count, 1); count++;
    // 改數值確實改初始體力，不依技能或精靈名稱判斷。
    const edited = structuredClone(def.kit); edited[0].params.clause.body[0].acts[0].p.value = 12345;
    const [modified] = await h.play(side, { self: h.unit('editor', 10000, [h.wait()], { extra: { soulMark: soul(edited) } }), opp: h.unit('enemy', 10000, [h.wait()]) });
    assert.equal(modified.self.maxHp, 12345); count++;
  }
  console.log(`迪露通用魂印：${count} 項正式 P1/P2 後台檢查通過`);
} finally { await h.close(); }
