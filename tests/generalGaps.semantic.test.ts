// 本輪通用缺口修正：條件先制／命中率固有查詢、先制+必定命中合句、吸取並反轉。
// 以正式 headless 引擎跑 P1／P2，驗證真實行為而不是只驗解析。
import assert from 'node:assert/strict';
import { distillEffect } from '../src/effects/distillEffect';
import { kitEntryIssue } from '../src/effects/effectConnection';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness(); let checks = 0;
const check = async (name: string, fn: () => Promise<void> | void) => { console.log(`檢查：${name}`); await fn(); checks++; console.log(`✓ ${name}`); };
const a = (op: string, p: any) => ({ op, p, label: op });
const skill = (d: string, o: any = {}) => {
  const r = distillEffect({ ...o,name: '測試', description: d }, 'skill');
  assert.equal(r.complete, true, `應可煉成：${d}`);
  return { ...h.wait(), name: '測試', ...o, effectMode: 'kit', kit: r.kit };
};
try {
  await check('條件先制：能力下降省略「狀態」仍可煉成，且條件成立才加在欄位先制上', () => {
    for (const d of ['■ 自身處於能力下降時先制+1（總先制+4）', '■ 自身處於能力下降時先制 +3', '■ 自身處於能力下降狀態時先制+3'])
      assert.ok(!kitEntryIssue(skill(d,{priority:d.includes('總先制')?3:0}).kit[0]), d);
    const s = skill('■ 自身處於能力下降時先制+1（總先制+4）', { priority: 3 });
    assert.equal(s.kit[0].params.property, 'base_priority');
    assert.deepEqual(s.kit[0].params.conditions, [{ c: 'stage', p: { side: 'self', kind: 'down', neg: false }, label: '自身處於能力下降' }]);
  });
  await check('先制+N且必定命中：拆成兩個獨立固有查詢，共用同一條件', () => {
    const s = skill('■ 對手處於能力下降狀態時先制+1且必定命中');
    assert.equal(s.kit.length, 2, '應為兩個 Kit 條目');
    const prio = s.kit.find((e: any) => e.params.property === 'base_priority');
    const sure = s.kit.find((e: any) => e.params.property === 'sure_hit');
    assert.ok(prio && sure, '先制與必中都要存在');
    assert.equal(prio.params.value, 1);
    assert.equal(sure.params.value, true);
    assert.deepEqual(prio.params.conditions, sure.params.conditions, '兩者條件必須一致');
    assert.equal(prio.node, 'modify_priority'); assert.equal(sure.node, 'before_skill');
  });
  await check('命中率N%：固有命中率可煉成，且不是必中', () => {
    const s = skill('■ 命中率99%');
    assert.equal(s.kit[0].params.property, 'base_accuracy');
    assert.equal(s.kit[0].params.value, 99);
    assert.equal(s.kit[0].node, 'before_skill');
  });
  await check('吸取並反轉：不得降級成只清零的「吸取」', () => {
    const s = skill('🎯 吸取並反轉對手能力提升狀態');
    const act = s.kit[0].params.clause.body[0].acts[0];
    assert.equal(act.op, 'stat_steal');
    assert.equal(act.p.reverse, true);
    assert.equal(act.p.mode, '吸取');
    // 僅「吸取」不得帶 reverse
    const plain = skill('🎯 吸取對手能力提升狀態').kit[0].params.clause.body[0].acts[0];
    assert.equal(plain.p.reverse, undefined);
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 吸取並反轉：對手 +2 攻擊 → 自身 +2、對手變 -2（不是 0）`, async () => {
      const sk = skill('🎯 吸取並反轉對手能力提升狀態', { category: '屬性', power: 0 });
      const hist = await h.play(side, { self: h.unit('S', 90000, [sk, h.wait()]), opp: h.unit('E', 90000, [h.wait()], { statStages: { atk: 2, def: 1 } }) });
      const r = hist[0];
      assert.equal(r.self.statStages.atk, 2, '自身獲得吸取的提升');
      assert.equal(r.opp.statStages.atk, -2, '對手 +2 應反轉為 -2');
      assert.equal(r.opp.statStages.def, -1, '對手 +1 應反轉為 -1');
    });
    await check(`${side} 僅吸取：對手提升被清零（對照組，確認未誤用反轉）`, async () => {
      const sk = skill('🎯 吸取對手能力提升狀態', { category: '屬性', power: 0 });
      const hist = await h.play(side, { self: h.unit('S', 90000, [sk, h.wait()]), opp: h.unit('E', 90000, [h.wait()], { statStages: { atk: 2 } }) });
      const r = hist[0];
      assert.equal(r.self.statStages.atk, 2);
      assert.equal(r.opp.statStages.atk, 0, '僅吸取應清零');
    });
    await check(`${side} 條件先制：條件成立才先出手（以擊敗順序判別，不是只看解析）`, async () => {
      // 自身速度較慢；技能直接擊敗對手。先出手則對手來不及行動、自身不掉血。
      // 保留煉出的 skill_property 條目，再追加一擊傷害（不可覆蓋整個 kit）。
      const base = skill('■ 自身處於能力下降時先制+3', { category: '物理', power: 0 });
      const cond = { ...base, kit: [...base.kit, {
        codeId: 'effect_sequence', source: 'skill', role: 'attached', node: 'on_skill_use', order: base.kit.length, customText: '一擊',
        params: { clause: { raw: '一擊', trig: 'use', parsed: true, body: [{ acts: [a('dmg', { flat: 100000, type: '真實' })] }] } } }] };
      const enemy = h.kitSkill('敵', [a('dmg', { flat: 7, type: '固定' })]);
      const met = await h.play(side, { self: h.unit('S', 90000, [cond, h.wait()], { speed: 50, statStages: { atk: -1 } }), opp: h.unit('E', 90000, [enemy], { speed: 100 }) });
      assert.equal(met[0].self.currentHp, 90000, '條件成立：先出手擊敗對手，不應受傷');
      const unmet = await h.play(side, { self: h.unit('S', 90000, [cond, h.wait()], { speed: 50 }), opp: h.unit('E', 90000, [enemy], { speed: 100 }) });
      assert.equal(unmet[0].self.currentHp, 89993, '條件不成立：後手，對手先造成 7 點固定傷害');
    });
  }
  await check('隨機異常：候選池取自正式 StatusRegistry，非附屬類排除附屬類與BOSS專用', async () => {
    const { StatusRegistry } = await h.server.ssrLoadModule('/src/effects/statusRegistry.ts');
    const cls: Record<string, string> = { 控制類: 'CONTROL', 弱化類: 'WEAKENING', 限制類: 'RESTRICTIVE', 衍化類: 'EVOLUTIONARY', 附屬類: 'AUXILIARY' };
    const pool = (sel: string) => Object.keys(StatusRegistry).filter((n: string) => {
      const c = StatusRegistry[n]?.categories || [];
      if (!c.length || StatusRegistry[n]?.name !== n || c.includes('NO_EFFECT')) return false;
      if (sel === '非附屬類') return !c.includes('AUXILIARY') && !c.includes('BOSS_ONLY');
      return cls[sel] ? c.includes(cls[sel]) : true;
    });
    for (const [sel, must] of [['控制類', ['麻痺', '害怕']], ['弱化類', ['中毒', '燒傷']], ['非附屬類', ['麻痺', '中毒']]] as const)
      for (const n of must) assert.ok(pool(sel).includes(n), `${sel} 應含 ${n}`);
    for (const n of ['星賜', '狂暴', '星護']) assert.ok(!pool('非附屬類').includes(n), `非附屬類不應含 ${n}`);
    for (const n of ['神話', '免疫']) assert.ok(!pool('非附屬類').includes(n), `非附屬類不應含BOSS專用 ${n}`);
    assert.ok(pool('控制類').length >= 10 && pool('非附屬類').length > pool('控制類').length, '分類池大小合理');
  });
  await check('隨機異常：合約接受 count/cls，拒絕非法值；空池不報成功', () => {
    const entry = (p: any) => ({ codeId: 'effect_sequence', source: 'skill', role: 'attached', node: 'on_skill_use', order: 0, customText: 'x',
      params: { clause: { raw: 'x', trig: 'use', parsed: true, body: [{ acts: [{ op: 'status_random', p, label: 'x' }] }] } } });
    assert.equal(kitEntryIssue(entry({ count: 2, cls: '非附屬類' })), null);
    assert.equal(kitEntryIssue(entry({ count: 1, cls: '' })), null);
    assert.ok(kitEntryIssue(entry({ count: 0, cls: '' })), 'count 0 應拒絕');
    assert.ok(kitEntryIssue(entry({ count: 99, cls: '' })), 'count 超出應拒絕');
    assert.ok(kitEntryIssue(entry({ count: 1, cls: '宇宙類' })), '未知分類應拒絕');
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 隨機異常：抽兩種非附屬類必為不同異常，且實際附加到對手`, async () => {
      const sk = skill('🎯 使對手隨機進入兩種非附屬類異常狀態', { category: '屬性', power: 0 });
      const hist = await h.play(side, { self: h.unit('S', 90000, [sk, h.wait()]), opp: h.unit('E', 90000, [h.wait()]) });
      const got = h.statuses(hist[0].opp);
      assert.equal(got.length, 2, `應恰好兩種不同異常，實際 ${JSON.stringify(got)}`);
      for (const n of got) assert.ok(['星賜', '狂暴', '神話', '免疫'].indexOf(n) < 0, `不應抽到附屬／BOSS 類：${n}`);
    });
  }
  console.log(`${checks} checks`);
} finally { await h.close(); }
