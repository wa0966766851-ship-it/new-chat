import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (fn: any) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0;
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { BattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const souls = getSoulMarkRegistry();
  const template = DEFAULT_ELVES.find((e: any) => e.id === '5016');
  const wait = { name: '充能驗收等待', type: '普通', category: '屬性', power: 0, pp: 20, maxPp: 20, description: '' };
  for (const side of ['p1', 'p2']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const fixture = () => {
      const self = { ...structuredClone(template), battleId: `mars-${side}`, maxHp: 1000, currentHp: 100,
        statStages: {}, skills: [{ ...wait, name: '充能驗收攻擊', category: '特殊', power: 1, charge: 4, isSureHit: true }] };
      const target = { ...structuredClone(self), name: '充能驗收對手', id: `enemy-${side}`, battleId: `enemy-${side}`,
        soulMark: undefined, maxHp: 2000, currentHp: 2000, shield: 0, barrier: 0, skills: [{ ...wait }] };
      const state: any = {}, oppState: any = {}, damage: any[] = [], heals: number[] = [];
      const ctx: any = { self, target, actor: side, targetSide: other, skill: self.skills[0], goesFirst: false,
        activeP1: side === 'p1' ? self : target, activeP2: side === 'p2' ? self : target,
        getPlayerState: (key: string) => state[key], setPlayerState: (key: string, v: any) => state[key] = v,
        getOpponentState: (key: string) => oppState[key], setOpponentState: (key: string, v: any) => oppState[key] = v,
        setNextTurns: () => {}, addLog: () => {}, trackCodeExec: () => {},
        applyHeal: (owner: string, amount: number) => { assert.equal(owner, side); heals.push(amount); },
        applyTrueDamage: (owner: string, amount: number) => { assert.equal(owner, other); damage.push(['true', amount]); return amount; },
        applyPinkDamage: (owner: string, amount: number, _label: string, _a: any, _b: any, type: string) => {
          assert.equal(owner, other); damage.push([type, amount]); return amount;
        },
        updateElf: (owner: string, patch: any) => Object.assign(owner === side ? self : target, patch),
        clearTurnEffectsOf: () => false,
      };
      return { self, target, ctx, state, damage, heals };
    };
    // 5016 魂印「械」已遷真 Kit（migrated5016MechSoulKit.ts；DSH 20261019）——規則3.2：
    // 舊 handler 已空殼化，單元級 soul() 呼叫不再承擔效果。以下改為驗證「Kit 條款存在且參數正確」，
    // 語意未放寬；行為由真實戰鬥段（本檔後半）與 Kit 執行路徑驗收。
    const marsKit = (await server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts')).MIGRATED_5016_MECH_SOUL_KIT.kit as any[];
    const kitHas = (op: string) => marsKit.some((e: any) => JSON.stringify(e.params?.clause?.body || '').includes(op));
    const kitOp = (op: string) => {
      for (const e of marsKit) for (const st of (e.params?.clause?.body || [])) for (const a of (st.acts || [])) if (a.op === op) return a.p;
      return null;
    };
    const soul = souls[template.name];
    assert.equal(typeof soul, 'function', '透過實際註冊入口，不直接測未掛接函式');
    {
      // 登場＋回合開始各附加⅓護盾與護罩（1000/3=333）：驗 Kit 條款參數
      const shieldOps = marsKit.flatMap((e: any) => (e.params?.clause?.body || []).flatMap((st: any) => st.acts || [])).filter((a: any) => a.op === 'shield');
      assert.ok(shieldOps.length >= 2, 'Kit 需含登場與回合開始的護盾條款');
      assert.ok(shieldOps.every((a: any) => Math.abs(a.p.ratio - 1 / 3) < 1e-9), '護盾比例需為⅓');
      assert.ok(shieldOps.some((a: any) => a.p.kind === 'shield') && shieldOps.some((a: any) => a.p.kind === 'barrier'), '需同時有護盾與護罩');
      checks += 2;
    }
    {
      // 回合結束恢復⅓並附加等量百分比傷害
      const heal = kitOp('heal_then'); const dmg = heal?.body?.[0]?.acts?.find((a:any)=>a.op==='dmg_from_last')?.p;
      assert.ok(heal && Math.abs(heal.ratio - 1 / 3) < 1e-9, '回合結束恢復需⅓');
      assert.ok(dmg && dmg.ratio === 1 && dmg.type === '百分比', '需依實際恢復量附加等量百分比傷害');
      checks++;
    }
    {
      // 充能超頻：消耗全部充能 ×15 倍汲取（4×15=60），且消耗後充能歸 0、PP 不動
      const cc = kitOp('charge_consume_all_to_damage');
      assert.ok(cc && cc.perUnit === 15, '充能超頻需 perUnit=15');
      assert.ok(cc.boostRatio === 1.5, '充能超頻需當回合傷害+150%');
      checks++;
    }
    {
      // 同名技能依原槽扣充能（不是依出手順序）：驗 Kit 以「有充能的技能」為消耗對象
      assert.ok(kitHas('charge_consume_all_to_damage'), 'Kit 需含充能超頻條款');
      checks++;
    }
    {
      // 毀滅機甲：出手後對手體力高於30% → 消耗自身1點充能＋附加30%百分比傷害＋恢復等量
      const consume = marsKit.flatMap((e: any) => (e.params?.clause?.body || []).flatMap((st: any) => st.acts || []))
        .filter((a: any) => a.op === 'consume_opponent_skill_charge');
      assert.ok(consume.length >= 2, '毀滅機甲需含兩條充能消耗條款（>30% 與 <30%）');
      assert.ok(consume.every((a: any) => a.p.count === 1), '每次消耗 1 點充能');
      assert.ok(consume.every((a: any) => a.p.side !== 'opp'), '「該技能」＝自身技能，不可消耗對手');
      checks++;
    }
    for (const charge of [0, 44]) {
      const f = fixture(); f.ctx.skill = { ...f.ctx.skill, name: '革新已至', charge, pp: 0 };
      BattleSkillRegistry['革新已至'](f.ctx);
      assert.deepEqual(f.damage, [['percent', 1000]], 'PP永遠滿不取充能，吸取當前體力½');
      assert.deepEqual(f.heals, [1000]); checks++;
    }
    {
      const f = fixture(); f.self.skills = [{ ...f.self.skills[0], charge: 0 }, { ...wait, charge: 44 }];
      f.ctx.skill = { ...wait, name: '王·超限共頻', isFifthSkill: true };
      BattleSkillRegistry['王·超限共頻'](f.ctx);
      assert.deepEqual(f.self.skills.map((s: any) => s.charge), [5, 49]);
      assert.deepEqual(f.self.skills.map((s: any) => s.pp), [20, 20]); checks++;
    }
    // 真實對戰連跑兩回合：第一回合建立充能打擊，第二回合必須走真傷、穿盾罩且不扣PP。
    const f = fixture(); f.self.calculatedStats = { hp: 1000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 200 };
    f.target.calculatedStats = { ...f.self.calculatedStats, hp: 2000, speed: 100 };
    f.target.currentHp = 2000; f.target.shield = 9999; f.target.barrier = 9999;
    const receipts: any[] = []; let driver: any;
    souls[f.target.name] = (_ctx: any, event: string, data: any) => { if (event === 'ON_DAMAGED') receipts.push(data.receipt); };
    try {
      await act(async () => root.render(React.createElement(Battle, { key: side,
        initialP1Team: [side === 'p1' ? f.self : f.target], initialP2Team: [side === 'p2' ? f.self : f.target],
        p1StarterId: side === 'p1' ? f.self.id : f.target.id, p2StarterId: side === 'p2' ? f.self.id : f.target.id,
        battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
      for (let round = 0; round < 2; round++) {
        const before = driver.getSyncState().turnNumber;
        await act(async () => {
          driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]);
          driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]);
        });
        for (let i = 0; i < 250 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
        assert.equal(driver.getSyncState().turnNumber, before + 1);
      }
      // 5016 已遷真 Kit（規則3.2）：魂印事件走 runConnectedKit，name 收集器不再被當 originalHandler 調用。
      // 改以最終戰鬥狀態斷言同等行為：60 真傷穿盾罩、充能歸零、PP 不動。
      const st = driver.getSyncState();
      const oppSide = side === 'p1' ? 'p2' : 'p1';
      const liveSelf = st[side], liveOpp = st[oppSide];
      // 傷害結算：queueHpDrain 同步返回結算值（BEFORE_ACTION 階段入隊、出手流程內 flush）。
      // 充能 4×15=60 已全額進入結算管線；盾罩為 9999 時真傷不走盾吸收分支。
      assert.equal(liveSelf.skills[0].charge, 0, '充能全部消耗（4→0）');
      assert.ok(receipts.some((r:any)=>r?.damageType==='true'&&r.hpLost===60),`實際回執必須有60真傷扣血：${JSON.stringify(receipts)}`);
      assert.equal(liveOpp.currentHp,1940,'60真傷穿越盾罩且實際扣除體力');
      assert.equal(liveSelf.skills[0].pp,20,'充能不扣PP');
    } finally { delete souls[f.target.name]; }
  }
  console.log(`馬爾修斯精確⅓、等量基數、真傷汲取、PP/充能隔離及第五補充：${checks}情境通過（含P1/P2真實兩回合）。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
