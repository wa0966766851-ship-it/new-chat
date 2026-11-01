// 效果來源紀錄（Timer.origin／Mark.origin）：由 addTimerTo／setMark 依執行容器集中填入（P1／P2 皆驗）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
const ok = (name: string) => { checks++; console.log(`✓ ${name}`); };
try {
  const { EffectTiming } = await h.server.ssrLoadModule('/src/effects/types.ts');
  const { acquiredEffectContext } = await h.server.ssrLoadModule('/src/battle/acquiredEffectContext.ts');
  const { buildEffectOrigin } = await h.server.ssrLoadModule('/src/battle/effectOrigin.ts');
  const { buildEffectViewModels } = await h.server.ssrLoadModule('/src/battle/effectViewModel.ts');
  const shieldClause = (source: 'soulmark' | 'skill', node: string, trig: string) => ({ codeId: 'effect_sequence', node, source, role: source === 'skill' ? 'attached' : 'innate', order: 0, customText: '來源測試',
    params: { clause: { raw: '來源測試', trig, parsed: true, body: [{ acts: [{ op: 'immune_status_turns', p: { turns: 3, cls: '非附屬類', reflect: false }, label: 'x' }] }] } } });

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // 魂印觸發建立的計時器：origin 是魂印（不是當回合選的技能），來源精靈是持有者
    const self = h.unit('魂印甲', 100_000, [h.wait()], { speed: 200, extra: { soulMark: { name: '測試魂印', description: '', effectMode: 'kit', effectType: 'none', effectValue: 0, kit: [shieldClause('soulmark', 'round_start', 'round_start')] } } });
    const foe = h.unit('對手乙', 100_000, [h.wait()], { speed: 100 });
    const hist = await h.play(side, { self, opp: foe, turns: () => [0, 0] }, 1);
    const timer = (hist[0].state[`${side}Timers`] || []).find((t: any) => t.origin?.kind === 'soulmark');
    assert.ok(timer, `${side} 魂印計時器有 origin：` + JSON.stringify(hist[0].state[`${side}Timers`]));
    assert.equal(timer.origin.sourceSide, side); assert.equal(timer.origin.sourceBattleId, '魂印甲'); assert.equal(timer.origin.sourceName, '魂印甲');
    assert.equal(timer.origin.skillName, undefined, '魂印來源不記當前技能'); assert.equal(timer.origin.defName, '測試魂印');
    assert.ok(timer.presentation.sourceName, '來源名稱不為空：' + JSON.stringify(timer.presentation));
    assert.notEqual(timer.name, '持續效果'); assert.ok(!/積木組合|stat:/.test(timer.name));
    ok(`${side} 魂印觸發的計時器記錄 origin（魂印、持有者）且標籤／來源名不為空`);

    // 技能建立：skillName；對手施加到我方時，晶片前綴為來源精靈
    const attacker = h.unit('攻擊丙', 100_000, [h.kitSkill('封印咒', [{ op: 'dmg_taken_uses', p: { kind: '技能', mult: 2, uses: 2 } }])], { speed: 200 });
    const victim = h.unit('受害丁', 100_000, [h.wait()], { speed: 100 });
    const hist2 = await h.play(side, { self: attacker, opp: victim, turns: () => [0, 0] }, 1);
    const onVictim = (hist2[0].state[`${other}Timers`] || []).find((t: any) => t.origin?.kind === 'skill');
    assert.ok(onVictim, `${side} 技能計時器有 origin：` + JSON.stringify(hist2[0].state[`${other}Timers`]));
    assert.equal(onVictim.origin.sourceSide, side); assert.equal(onVictim.origin.sourceBattleId, '攻擊丙'); assert.equal(onVictim.origin.skillName, '封印咒');
    const [view] = buildEffectViewModels([], [onVictim], '受害丁');
    assert.equal(view.sourceTag, '【攻擊丙】'); assert.match(view.source, /攻擊丙・技能「封印咒」/);
    assert.equal(buildEffectViewModels([], [{ ...onVictim, ownerBattleId: undefined }], '攻擊丙')[0].sourceTag, '', '來源就是持有者本人時沒有前綴');
    ok(`${side} 技能施加到對手的計時器：origin 記施放者與技能，持有者視角出現來源前綴`);
  }

  // 取得效果（幻化）：以衍生容器呼叫 addTimerTo 時，origin 仍由 this 推導（defName＝被複製的定義）
  let captured: any;
  h.S['來源探針'] = ((c: any, ev: any) => {
    if (ev !== EffectTiming.ROUND_START || c.actor !== 'p1') return;
    const derived = Object.create(c); derived.illusionEffectKey = '被複製者'; Object.defineProperty(derived, 'recoveryOrigin', { value: { kind: 'soul', sourceSide: 'p1', sourceBattleId: '來源探針' } });
    derived.addTimerTo('p1', { id: 'probe', name: '探針', kind: 'round_counter', source: 'soulmark', remaining: 2, tickAt: 'round_end', payload: { block: { trig: 'round_end', body: [{ acts: [{ op: 'shield', p: {} }] }] } } }, false);
    c.addTimerTo('p1', { id: 'probe2', name: '探針二', kind: 'round_counter', source: 'soulmark', remaining: 2, tickAt: 'round_end', payload: {} }, false);
    c.setMark({ id: 'probe_mark', name: '探針印', displayChar: '探', count: 1 }, 'p1');
    captured = true;
  }) as any;
  const probe = h.unit('來源探針', 100_000, [h.wait()], { speed: 200 });
  const hist3 = await h.play('p1', { self: probe, opp: h.unit('旁觀', 100_000, [h.wait()]), turns: () => [0, 0] }, 1);
  delete h.S['來源探針'];
  assert.ok(captured, '探針有執行');
  const timers = hist3[0].state.p1Timers || [];
  const p1 = timers.find((t: any) => t.id === 'probe'), p2 = timers.find((t: any) => t.id === 'probe2');
  assert.equal(p1?.origin?.defName, '被複製者'); assert.equal(p1?.origin?.kind, 'soulmark'); assert.equal(p1?.origin?.sourceBattleId, '來源探針');
  assert.equal(p2?.origin?.kind, 'soulmark', '舊式 registry 寫入以 timer.source 推導'); assert.equal(p2?.origin?.sourceName, '來源探針');
  const mark = (hist3[0].state.p1Marks || []).find((m: any) => m.id === 'probe_mark');
  assert.ok(mark?.origin && mark.origin.sourceBattleId === '來源探針' && mark.origin.sourceName === '來源探針', JSON.stringify(mark));
  ok('衍生容器（取得效果）與舊式寫入皆記錄 origin；印記也記錄 origin');

  // acquiredEffectContext 的衍生容器公開 illusionEffectKey，buildEffectOrigin 讀得到
  const holder: any = { battleId: 'H', id: 'H', name: '持有者', soulMark: { name: '原魂印' } };
  const target: any = { battleId: 'T', id: 'T', name: '被複製精靈', soulMark: { name: '複製魂印' }, skills: [] };
  const base: any = { actor: 'p1', targetSide: 'p2', self: { ...holder, illusion: { target, effectKey: '被複製精靈' } }, updateElf() {}, setPlayerState() {}, getPlayerState() {}, activeP1: holder, activeP2: undefined };
  const acquired = acquiredEffectContext(base);
  const origin = buildEffectOrigin(acquired, holder, 'p1', () => undefined, 'soulmark');
  assert.equal(origin.defName, '被複製精靈'); assert.equal(origin.sourceBattleId, 'H'); assert.equal(origin.sourceName, '持有者');
  ok('acquiredEffectContext：施加者是持有者，定義來源為被複製者');
} finally { await h.close(); }
console.log(`效果來源紀錄：${checks} 組通過。`);
