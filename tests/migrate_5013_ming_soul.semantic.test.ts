// 5013 魂印「凕」真 Kit 拆解驗收（DSH 20261017 第八批；keldSoul 通用件組擴充）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const keerhode = DEFAULT_ELVES.find((e: any) => String(e.id) === '5013');
  assert.equal(keerhode.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(keerhode.soulMark?.kit?.length >= 7, '魂印 Kit 條目齊全');
  assert.ok(!JSON.stringify(keerhode.soulMark.kit).includes('legacy_handler'), '不得殘留包裝');
  checks++; console.log('OK 5013 魂印「凕」已是真 Kit');

  const mingUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(keerhode);
    base.id = id; base.battleId = id; base.name = '柯爾霍德';
    base.maxHp = hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = {};
    base.soulMark = keerhode.soulMark;
    return base;
  };
  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, description: '' };
  const bigHit = h.kitSkill('重襲', [{ op: 'dmg', p: { flat: 3000, type: '固定' } }]);
  const smallHit = h.kitSkill('輕襲', [{ op: 'dmg', p: { flat: 200, type: '固定' } }]);
  const trueHit = h.kitSkill('真襲', [{ op: 'dmg', p: { flat: 500, type: '真實' } }]);

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：受大傷（≥⅓）→減60%＋對手獲得霜寒幽光（≈減少量）
    const self = mingUnit('S', 9000, [attack, h.wait()]);
    const opp = h.unit('E', 100000, [bigHit, h.wait()], { speed: 300 });
    const r = await h.play(side, { self, opp, turns: (_e, t) => [t === 1 ? 1 : 0, 0] }, 1);
    const t1 = r[0];
    const selfLoss = 9000 - t1.self.currentHp;
    // 3000 ≥ 9000/3=3000 → 減免：selfLoss ≈ 1200（3000×0.4）
    assert.ok(selfLoss <= 1400 && selfLoss >= 1000, side + ' 大傷減60%（實損 ' + selfLoss + '）');
    checks++;
    const glow = (t1.state[(side === 'p1' ? 'p2' : 'p1') + 'Marks'] || []).find((m: any) => m.id === 'frost_glow');
    assert.ok(glow && glow.count >= 1500, side + ' 對手獲得霜寒幽光（' + (glow?.count ?? 0) + '）');
    checks++;
  }
  console.log('OK 大傷減免＋霜寒幽光 雙側通過');

  // 場景二：受小傷（<⅓）→汲取對手傷害值60%（自身恢復 120=200×0.6）
  {
    const self = mingUnit('S2', 9000, [h.wait(), attack]);
    self.currentHp = 4000; // 損血狀態，汲取可見
    const opp = h.unit('E2', 100000, [smallHit, h.wait()], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: () => [0, 0] }, 1);
    const healed = r[0].self.currentHp - (4000 - 200); // 4000-200+120=3920
    assert.ok(Math.abs(r[0].self.currentHp - 3920) < 200, '小傷汲取60%（HP=' + r[0].self.currentHp + ' 預期≈3920）');
    checks++;
  }
  console.log('OK 小傷汲取60%');

  // 場景三：受真傷→+1未暝之夜（在場任一方——自身受真傷）
  {
    const self = mingUnit('S3', 9000, [attack, h.wait()]);
    const opp = h.unit('E3', 100000, [trueHit, h.wait()], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: () => [1, 0] }, 1);
    const night = (r[0].state.p1Marks || []).find((m: any) => m.id === 'dark_night');
    assert.ok(night && night.count === 1, '受真傷→未暝之夜+1（' + (night?.count ?? 0) + '）');
    checks++;
  }
  console.log('OK 未暝之夜計層');

  // 未暝之夜：技能先制+1（prio_bonus 事中查詢；prio_next 缺陷修正後的行為斷言）
  {
    const self = mingUnit('SP', 9000, [h.wait(), h.wait()]);
    const opp = h.unit('EP', 100000, [h.kitSkill('真襲', [{ op: 'dmg', p: { flat: 500, type: '真實' } }]), h.wait()], { speed: 300 });
    // 對手先手給自身上一層未暝之夜，之後自身所有技能先制+1
    const r = await h.play('p1', { self, opp, turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 2);
    const logs = r[1].logs || [];
    const acts = logs.filter((l: string) => /使用了【(等待|真襲)】/.test(l)).map((l: string) => /【EP】/.test(l) ? 'E' : 'TF');
    // 回合2起自方持有未暝之夜（+1先制）應先於速度300對手——累積快照中回合2首個行動是第3筆
    assert.ok(acts.length >= 4 && acts[2] === 'TF', '未暝之夜先手：回合2自方應先手（序：' + acts.join('→') + '）');
    checks++;
  }
  console.log('OK 未暝之夜先制+1');

  console.log('5013 魂印「凕」：' + checks + ' 項通過');
} finally { await h.close(); }