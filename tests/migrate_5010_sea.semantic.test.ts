// 5010 星光·魯斯王 魂印「海」真 Kit 拆解驗收（DSH 20261018 最後衝刺·組 5）。
// 雙側（P1/P2）正式 headless 引擎實戰；合成精靈帶真名與真 soulMark。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const rus = DEFAULT_ELVES.find((e: any) => String(e.id) === '5010');
  const { MIGRATED_GROUP5_SEA_SOUL_KIT: KIT } = await h.server.ssrLoadModule('/src/data/migratedGroup5SeaSoulKit.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  assert.equal(rus.soulMark?.name, '海');
  assert.equal(rus.soulMark?.effectMode, 'kit');
  assert.ok(!JSON.stringify(rus.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  assert.equal(rus.soulMark.description, KIT.description, 'Kit description 與實際載入原文逐字相同');
  assert.deepEqual(rus.soulMark.kit, structuredClone(KIT.kit));
  for (const e of KIT.kit) assert.equal(kitEntryIssue(e), null, 'kitEntryIssue: ' + e.customText);
  for (const k of ['5010', '1007', '星光·魯斯王', '魯斯王']) assert.ok(!(k in h.S), 'SOUL_MARK_MAPPING 不得殘留：' + k);
  checks++; console.log('OK 5010 魂印「海」已是真 Kit（無包裝、無舊映射、合約全過）');

  const rusUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const b = structuredClone(rus);
    b.id = id; b.battleId = id; b.name = '星光·魯斯王'; b.level = o.level ?? 100; b.type = o.type || '水';
    b.maxHp = o.maxHp ?? hp; b.currentHp = hp;
    b.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    b.calculatedStats = { hp: b.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    b.skills = skills; b.statStages = o.statStages || {}; b.shield = 0; b.barrier = 0;
    b.soulMark = rus.soulMark;
    return b;
  };
  const hit = (name = '打', power = 100, extra: any = {}) => ({ name, category: '物理', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '', ...extra });
  const util = h.healSkill(1000);

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const soak = (r: any, who: string) => (r.state[who + 'Marks'] || []).find((m: any) => m.name === '星海之浸');
    // ① 登場：對手 3 回合星海之浸；對手屬性技能無效（補血無效）
    {
      const self = rusUnit('S', 100000, [h.wait()]);
      const opp = h.unit('E', 50000, [util], { maxHp: 100000 });
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const m = soak(r, other);
      assert.ok(m, side + ' 登場即對手附加星海之浸');
      assert.equal(m.effects.blkInvalid, '屬性', side + ' 持有者屬性技能無效旗標');
      assert.ok(m.remainingRounds >= 2 && m.remainingRounds <= 3, side + ' 回合數 3（回合末遞減）：' + m.remainingRounds);
      assert.equal(r.opp.currentHp, 50000, side + ' 對手屬性技能（補血）無效：' + r.logs.slice(-5).join('｜'));
      assert.ok(r.logs.some(l => l.includes('技能無效')), side + ' 技能無效日誌');
      assert.ok(!soak(r, side), side + ' 自身不持有');
      checks++;
    }
    // ② 持續 3 回合後消失（未再攻擊）
    {
      const self = rusUnit('S', 100000, [h.wait()]);
      const opp = h.unit('E', 50000, [util], { maxHp: 100000 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 4);
      assert.ok(soak(r[1], other), side + ' 第2回合仍在');
      assert.ok(!soak(r[3], other), side + ' 3 回合後消失');
      assert.equal(r[3].opp.currentHp, 50000 + 1000, side + ' 消失後補血生效（第4回合 +1000）');
      checks++;
    }
    // ③ 自身使用攻擊後重置為 3 回合
    {
      const self = rusUnit('S', 100000, [hit()]);
      const opp = h.unit('E', 90000, [h.wait()], { maxHp: 100000 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 3);
      const m = soak(r[2], other);
      assert.ok(m, side + ' 連續攻擊後仍持有');
      assert.ok(m.remainingRounds >= 2, side + ' 攻擊後刷新回合：' + m.remainingRounds);
      checks++;
    }
    // ④ 持有者受到攻擊傷害後：額外受到等量百分比傷害＋恢復魯斯王等量體力＋1點PP（對手非草系：無真實傷害）
    {
      const ppSkill = { ...hit('攻', 100), pp: 4, maxPp: 9 };
      const self = rusUnit('S', 50000, [ppSkill, { ...h.wait(), pp: 3, maxPp: 5 }], { maxHp: 100000, speed: 300 });
      const opp = h.unit('E', 90000, [h.wait()], { maxHp: 100000 });
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const healed = r.self.currentHp - 50000;
      assert.ok(healed > 0, side + ' 魯斯王恢復體力：' + r.self.currentHp);
      assert.equal(90000 - r.opp.currentHp, healed * 2, side + ' 持有者損失＝攻擊傷害＋等量百分比傷害＝恢復量×2');
      assert.equal(r.self.skills[1].pp, 4, side + ' 所有技能 +1PP（3→4）');
      assert.equal(r.self.skills[0].pp, 4, side + ' 出招技能 PP 不變（消耗1後 +1 回補：4→3→4）');
      assert.ok(!r.logs.some(l => l.includes('真實傷害')), side + ' 非草系無真實傷害追加');
      checks++;
    }
    // ⑤ 持有者為草系：追加等量真實傷害、恢復等量體力與全部PP
    {
      const self = rusUnit('S', 50000, [hit('攻', 100), { ...h.wait(), pp: 1, maxPp: 5 }], { maxHp: 100000, speed: 300 });
      const opp = h.unit('E', 90000, [h.wait()], { maxHp: 100000, type: '草' });
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const healed = r.self.currentHp - 50000;
      assert.equal(90000 - r.opp.currentHp, healed / 2 * 3, side + ' 草系：攻擊＋百分比＋真實＝3 倍單次傷害（恢復量為 2 倍單次）');
      assert.ok(r.logs.some(l => l.includes('點真實傷害')), side + ' 真實傷害追加日誌');
      assert.equal(r.self.skills[1].pp, 5, side + ' 對手為草系：所有技能補滿 PP');
      checks++;
    }
    // ⑥ 所有技能必定致命一擊：同數值對照（無魂印）傷害較低
    {
      const mk = (withSoul: boolean) => { const u = rusUnit('S', 50000, [hit('攻', 100)], { maxHp: 100000, speed: 300 }); if (!withSoul) u.soulMark = undefined; return u; };
      const [withSoul] = await h.play(side, { self: mk(true), opp: h.unit('E', 90000, [h.wait()], { maxHp: 100000 }), turns: () => [0, 0] }, 1);
      const [plain] = await h.play(side, { self: mk(false), opp: h.unit('E2', 90000, [h.wait()], { maxHp: 100000 }), turns: () => [0, 0] }, 1);
      const firstHit = (90000 - withSoul.opp.currentHp) / 2; // 攻擊 + 等量百分比
      const plainHit = 90000 - plain.opp.currentHp;
      assert.ok(firstHit > plainHit, side + ` 必定致命一擊：魂印攻擊傷害 ${firstHit} 高於無魂印 ${plainHit}`);
      assert.ok(withSoul.logs.some(l => l.includes('致命一擊')), side + ' 致命一擊日誌');
      checks++;
    }
    // ⑦ 致死保護（等級100、每場戰鬥限1次）：消對手強化／回合類、體力PP全滿、護盾護罩＝體力；第二次致死不再觸發
    {
      const sk = { ...h.wait(), name: '蓄', category: '屬性', pp: 2, maxPp: 7 };
      const self = rusUnit('S', 500, [sk, { ...h.wait(), pp: 1, maxPp: 9 }], { maxHp: 100000 });
      const lethal = h.kitSkill('絕殺', [{ op: 'dmg', p: { flat: 500000, type: '真實' } }], { category: '物理', power: 1 });
      const opp = h.unit('E', 90000, [hit('大', 3000), lethal], { maxHp: 100000, speed: 300, statStages: { atk: 3 } });
      const r = await h.play(side, { self, opp, turns: (_e, t) => [0, t === 1 ? 0 : 1] }, 2);
      assert.equal(r[0].self.currentHp, 100000, side + ' 致死→體力全滿');
      assert.equal(r[0].self.skills[1].pp, 9, side + ' PP 全滿');
      assert.equal(r[0].self.shield, 100000, side + ' 護盾＝體力值：' + r[0].self.shield);
      assert.equal(r[0].self.barrier, 100000, side + ' 護罩＝體力值');
      assert.equal(r[0].opp.statStages.atk || 0, 0, side + ' 消除對手能力提升');
      assert.ok(r[0].self.currentHp > 0 && !r[0].logs.some(l => l.includes('對手獲勝')), side + ' 未被擊敗');
      assert.ok(r[1].logs.some(l => l.includes('對手獲勝')) || r[1].self.currentHp === 0, side + ' 每場戰鬥限1次：第二次致死不再保護');
      checks++;
    }
    // ⑧ 等級非100：致死保護不觸發（也不消耗次數）
    {
      const sk = { ...h.wait(), name: '蓄', category: '屬性', pp: 2, maxPp: 7 };
      const self = rusUnit('S', 500, [sk], { maxHp: 100000, level: 99 });
      const opp = h.unit('E', 90000, [hit('大', 3000)], { maxHp: 100000, speed: 300 });
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.equal(r.self.currentHp, 0, side + ' 等級99：致死不保護');
      checks++;
    }
  }
  console.log('5010 魂印「海」：' + checks + ' 項通過');
} finally { await h.close(); }
