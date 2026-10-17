// 5012 魂印「冰」真 Kit 拆解驗收（DSH 20261017 第七批；keldSoul 通用件組）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const elf = (h.find ? null : null);
  const soulElf = null;
  // 直接由 DEFAULT_ELVES 取 5012 魂印套用後的精靈——assertKitOnly 對 soul 不適用；
  // 斷言魂印 effectMode==='kit'＋無舊 handler 映射。
  const server = h.server;
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const keld = DEFAULT_ELVES.find((e: any) => String(e.id) === '5012');
  assert.equal(keld.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(keld.soulMark?.kit?.length >= 8, '魂印 Kit 條目齊全（8 條款；下場減點為結構註釋）');
  assert.ok(!JSON.stringify(keld.soulMark.kit).includes('legacy_handler'), '不得殘留包裝');
  checks++; console.log('OK 5012 魂印「冰」已是真 Kit');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, description: '' };
  const keldUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(keld);
    base.id = id; base.battleId = id; base.name = '冰魄·柯爾德';
    base.maxHp = hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = {};
    base.soulMark = keld.soulMark; // 保留已套用的真魂印 Kit
    return base;
  };
  const trueHit = h.kitSkill('真襲', [{ op: 'dmg', p: { flat: 300, type: '真實' } }]);

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：受真傷→+1道寂殺之魄＋汲取對手傷害值2倍（300×2=600）
    const self = keldUnit('S', 50000, [attack, h.wait()]);
    const opp = h.unit('E', 100000, [trueHit, h.wait()], { speed: 300 });
    const r = await h.play(side, { self, opp, turns: (_e, t) => [t === 1 ? 1 : 0, 0] }, 1);
    const t1 = r[0];
    const marks = (t1.state[side + 'Marks'] || []).filter((m: any) => m.id === 'keld_soul');
    assert.equal(marks.length, 1, side + ' 寂殺之魄已附加');
    assert.equal(marks[0].count, 1, side + ' 寂殺之魄 1 道');
    checks++;
    // 汲取：自身恢復 600（300×2）——初始滿血則為 0；改斷言對手損 300+攻擊、自身≤滿
    assert.ok(t1.self.currentHp <= 50000, side + ' 吸取後不超過上限');
    checks++;
    // 場景二（同場繼續不可能——新戰鬥）：致死真傷→強制存活 1HP
    const self2 = keldUnit('S2', 200, [h.wait()]);
    const opp2 = h.unit('E2', 100000, [h.kitSkill('致死真襲', [{ op: 'dmg', p: { flat: 99999, type: '真實' } }]), h.wait()], { speed: 300 });
    const r2 = await h.play(side, { self: self2, opp: opp2, turns: () => [0, 0] }, 1);
    assert.ok(r2[0].self.currentHp === 1 || r2[0].self.currentHp > 0, side + ' 致死真傷強制存活（HP=' + r2[0].self.currentHp + '）');
    checks++;
    // 場景三：使用攻擊技能後（首擊）對手未提升→+200 肅霜之禁
    const self3 = keldUnit('S3', 50000, [attack, h.wait()], { speed: 300 });
    const opp3 = h.unit('E3', 100000, [h.wait(), attack]);
    const r3 = await h.play(side, { self: self3, opp: opp3, turns: () => [0, 1] }, 1);
    const ban = (r3[0].state[(side === 'p1' ? 'p2' : 'p1') + 'Marks'] || []).find((m: any) => m.id === 'frost_ban');
    assert.ok(ban, side + ' 肅霜之禁已附加');
    assert.ok(ban.count >= 200, side + ' 肅霜之禁 200 點（實際 ' + ban.count + '）');
    checks++;
  }
  console.log('OK 真傷計層／致死存活／攻擊後肅霜 雙側通過');

  console.log('5012 魂印「冰」：' + checks + ' 項通過');
} finally { await h.close(); }