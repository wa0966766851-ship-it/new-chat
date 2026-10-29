// 5026 石之力-S 共用程式拆解的行為快照（2026-10-12）：拆前先鎖現有結果，拆後同一份快照必須通過。
// 以 P1／P2 完整對戰（headless 引擎）逐回合記錄：體力、能力等級、異常、PP、回合效果、出手順序、行動封鎖。
// UPDATE_SNAPSHOT=1 只用於拆前建立快照；之後不得重產。
// 2026-10-12 情境修正：引擎依原廠規則拒絕選 PP 為 0 的技能（skillSelectable）。「自然石之力-S（attr_nature_pp）」的一般持有者
// 會在第 14 回合把自身技能石 PP 降到 2、第 16 回合歸 0，舊情境仍每回合選它（非法行動）。現在石頭 PP 為 0 時改選第 2 招「等待」。
// 只重產受影響的 4 份情境（自然石之力-S｜normal-slow／normal-fast × p1／p2，PP 歸 0 之後的回合）；其餘 206 份一字未動。
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHarness } from './helpers/migrationHarness';

const FIXTURE = new URL('./fixtures/skillStoneSplitSnapshot.json', import.meta.url);
const h = await createHarness();
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElves.ts');
  const elf = DEFAULT_ELVES.find((e: any) => String(e.id) === '5026');
  const defs: any[] = [...elf.skills, ...(elf.skillPool || [])].filter((s: any) => /石之力-S$/.test(s.name));
  const unique = defs.filter((s, i) => defs.findIndex(t => t.name === s.name && t.description === s.description) === i);
  assert.equal(unique.length, 21, '5026 共 21 份不同的石之力-S 定義');
  // 一般持有者吃 PRD（偽隨機）機率，需要較多回合才會看到觸發；投石者機率 100%，12 回合足夠。
  const attack = { ...h.wait(), name: '重擊', category: '物理', type: '普通', power: 120, pp: 99, maxPp: 99, isSureHit: true };
  const snapshot: Record<string, any> = {};
  const brief = (e: any, state: any, side: string) => ({ hp: e.currentHp, stages: Object.fromEntries(Object.entries(e.statStages || {}).filter(([, v]) => v)),
    statuses: h.statuses(e).sort(), pp: (e.skills || []).map((s: any) => s.pp),
    timers: (state[`${side}Timers`] || []).map((t: any) => `${t.kind}:${t.remaining}:${t.pendingActivation ? 1 : 0}`).sort() });
  // 情境：持有者種類（一般／投石者）× 速度（慢＝對手先手、快＝自身先手）× 是否附加效果失效（只測投石者）
  const VARIANTS = [
    { id: 'normal-slow', turns: 40, speed: 50, extra: {} }, { id: 'normal-fast', turns: 40, speed: 200, extra: {} },
    { id: 'thrower-slow', turns: 12, speed: 50, extra: { trait_stone_thrower: true } }, { id: 'thrower-fast', turns: 12, speed: 200, extra: { trait_stone_thrower: true } },
    { id: 'thrower-sealed', turns: 12, speed: 50, extra: { trait_stone_thrower: true, isAdditionalInvalid: true } },
  ];
  for (const def of unique) for (const v of VARIANTS) for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const stone = { ...def, pp: 99, maxPp: 99 };
    const self = h.unit('S', 1e6, [stone, h.wait()], { maxHp: 1e6, speed: v.speed, extra: v.extra });
    const opp = h.unit('E', 1e6, [{ ...attack }, h.wait()], { maxHp: 1e6, speed: 100 });
    const hist = await h.play(side, { self, opp, turns: (engine: any) => [(engine.getState()[side].skills[0].pp ?? 0) > 0 ? 0 : 1, 0] } as any, v.turns);
    let seen = 0;
    snapshot[`${def.name}|${def.skillStoneEffect}|${v.id}|${side}`] = hist.map((r: any) => {
      const fresh = r.logs.slice(seen); seen = r.logs.length;
      return { turn: r.turn, self: brief(r.self, r.state, side), opp: brief(r.opp, r.state, other),
        order: fresh.filter((l: string) => /使用了【/.test(l)).map((l: string) => l.includes('重擊') ? 'E' : 'S').join(''),
        prevented: r.state[`${other}RegistryState`]?.actionPreventedRound ?? null };
    });
  }
  if (process.env.DUMP_SNAPSHOT) writeFileSync(process.env.DUMP_SNAPSHOT, JSON.stringify(snapshot));
  if (process.env.UPDATE_SNAPSHOT === '1') { writeFileSync(FIXTURE, '{\n' + Object.entries(snapshot).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n') + '\n}\n'); console.log('snapshot written', Object.keys(snapshot).length); }
  else {
    assert.ok(existsSync(FIXTURE), '缺少快照檔');
    const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    assert.deepEqual(Object.keys(snapshot), Object.keys(expected));
    for (const key of Object.keys(expected)) assert.deepEqual(snapshot[key], expected[key], `行為快照不一致：${key}`);
    console.log(`${Object.keys(expected).length} 份快照一致（21 定義 × 5 情境 × P1／P2）`);
  }
} finally { await h.close(); }
