// 效果晶片標籤／來源／計數契約（Part 2）：標籤不得出現「積木組合效果」或 `stat:`；來源紀錄；待啟用／後手／層數；舊欄位鏡像去重。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0;
const ok = (name: string) => { checks++; console.log(`✓ ${name}`); };
const BAD = /積木組合|stat:/;
try {
  const P = await server.ssrLoadModule('/src/battle/effectPresentation.ts');
  const { OP_DISPLAY_NAMES } = await server.ssrLoadModule('/src/battle/opDisplayNames.ts');
  const { OPS: RUN_OPS } = await server.ssrLoadModule('/src/blocks/runtime.ts');
  const { SEQUENCE_ACTION_FIELDS } = await server.ssrLoadModule('/src/effects/sequenceContract.ts');
  // 已註冊的 op＝可執行的 OPS，加上只在序列契約登記、由其他節點讀取的 op
  const OPS: Record<string, unknown> = { ...SEQUENCE_ACTION_FIELDS, ...RUN_OPS };
  const V = await server.ssrLoadModule('/src/battle/effectViewModel.ts');
  const { activeEffectViews } = await server.ssrLoadModule('/src/battle/activeEffectViews.ts');
  const { unpackReviewedKits } = await server.ssrLoadModule('/src/data/packedReviewedKits.ts');
  const { buildEffectOrigin } = await server.ssrLoadModule('/src/battle/effectOrigin.ts');
  const { skillBadgeViews } = await server.ssrLoadModule('/src/battle/skillBadgeViews.ts');

  // ── 動作顯示名稱表必須涵蓋所有已註冊 op，且沒有多餘項目
  const ops = Object.keys(OPS);
  assert.deepEqual(ops.filter(k => !OP_DISPLAY_NAMES[k]), [], '每個 op 都有顯示名稱');
  assert.deepEqual(Object.keys(OP_DISPLAY_NAMES).filter(k => !OPS[k]), [], '顯示名稱表沒有已不存在的 op');
  assert.ok(Object.values(OP_DISPLAY_NAMES).every((v: any) => v && !BAD.test(v)));
  ok(`op 顯示名稱表涵蓋全部 ${ops.length} 個 op`);

  // ── resolveEffectLabel 順序與保證
  const R = P.resolveEffectLabel;
  assert.equal(R({ label: '先制+3', name: '其他', op: 'dmg' }), '先制+3', 'Kit 標籤優先');
  assert.equal(R({ label: '持續效果', name: '禁療', op: 'dmg' }), '禁療', '「持續效果」不算標籤，退到名稱');
  assert.equal(R({ label: '持續效果', op: 'vampire' }), '吸血', '無名稱用 op 顯示名稱表');
  assert.equal(R({ payload: { block: { invalid: '攻擊' } } }), '攻擊技能無效', '再退到結構化參數句');
  assert.equal(R({ description: '令對手回合類效果消除。之後另有說明' }), '令對手回合類效果消除', '再退到描述首句');
  const mute = console.warn; console.warn = () => {};
  assert.equal(R({ label: '積木組合效果', name: 'stat:攻擊', description: '' }), '未命名效果');
  console.warn = mute;
  for (const label of ['積木組合效果', '計時效果', '待補說明的效果', '次數類效果']) assert.notEqual(R({ label, op: 'shield' }), label);
  ok('resolveEffectLabel：Kit 標籤 → op 表 → 結構化句 → 描述首句 → 未命名效果');

  // ── 附加傷害：stat: 基數轉為可讀名稱，含 of
  const dmg = (p: any) => P.actionCaption({ op: 'dmg', p });
  assert.equal(dmg({ base: 'stat:攻擊和特攻', of: 'opp', ratio: 0.5, type: '固定' }), '附加對手攻擊＋特攻50%固定傷害');
  assert.equal(dmg({ base: 'stat:速度', of: 'self', ratio: 1, type: '真實' }), '附加自身速度100%真實傷害');
  assert.equal(dmg({ base: '最大體力', ratio: 0.1, type: '百分比' }), '附加最大體力10%百分比傷害');
  ok('附加傷害說明：stat: 轉換並帶 of');

  // ── triggerCaption 涵蓋 model.ts 的全部 Trigger；未知者不加前綴
  const model = readFileSync('src/blocks/model.ts', 'utf8');
  const union = model.slice(model.indexOf('export type Trigger'), model.indexOf('| "custom"'));
  const triggers = [...union.matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
  assert.ok(triggers.length > 80, `解析到 ${triggers.length} 個 Trigger`);
  const noCaption = triggers.filter(t => !P.triggerCaption(t));
  assert.deepEqual(noCaption, [], 'Trigger 皆有顯示前綴');
  assert.equal(P.triggerCaption('totally_unknown'), '');
  assert.equal(P.triggerCaption(undefined), '');
  assert.ok(![...triggers, 'custom'].some(t => P.triggerCaption(t) === '觸發時：'));
  ok(`triggerCaption 涵蓋 ${triggers.length} 個 Trigger，未知者無前綴`);

  // ── 掃描所有已審核 Kit：任何說明／標籤不含「積木組合」或 stat:，且沒有缺顯示名稱的 op
  const packed = JSON.parse(readFileSync('src/data/reviewedKits.compressed.json', 'utf8'));
  const defs: any[] = unpackReviewedKits(packed);
  let clauses = 0, acts = 0;
  const walk = (stmts: any[], visit: (a: any) => void) => {
    for (const s of stmts || []) for (const a of [...(s.acts || []), ...(s.onSuccess || []), ...(s.onFail || [])]) {
      visit(a);
      for (const v of Object.values(a.p || {})) if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && ('acts' in v[0] || 'cond' in v[0])) walk(v as any[], visit);
    }
  };
  for (const def of defs) for (const entry of def.kit || []) {
    const clause = entry?.params?.clause; if (!clause?.body) continue;
    clauses++;
    walk(clause.body, a => {
      acts++;
      const caption = P.actionCaption(a);
      assert.ok(!BAD.test(caption), `${def.name}/${a.op} 說明含禁字：${caption}`);
      assert.ok(OP_DISPLAY_NAMES[a.op] || a.op === undefined, `${def.name} 的 op ${a.op} 沒有顯示名稱`);
    });
    const presentation = P.payloadPresentation({ block: { trig: clause.trig, body: clause.body } });
    if (presentation) assert.ok(!BAD.test(presentation.label + presentation.description), `${def.name}：${presentation.label}`);
    const label = R({ payload: { block: { trig: clause.trig, body: clause.body } }, description: clause.raw });
    assert.ok(!BAD.test(label), `${def.name} 標籤：${label}`);
  }
  assert.ok(clauses > 1000 && acts > 1500, `掃描 ${clauses} 條款／${acts} 動作`);
  ok(`掃描 ${defs.length} 份已審核 Kit（${clauses} 條款／${acts} 動作）：無「積木組合」或 stat:`);

  // ── 舊存檔的籠統標籤與 stat: 不再輸出
  const legacyTimer: any = { id: 't', name: '積木組合效果', kind: 'turn_effect', source: 'skill', remaining: 2, tickAt: 'round_end',
    presentation: { semanticId: 'x', label: '積木組合效果', description: '附加stat:攻擊和特攻傷害' },
    payload: { block: { trig: 'round_end', body: [{ acts: [{ op: 'shield', p: {} }] }] } } };
  const [legacy] = V.buildEffectViewModels([], [legacyTimer], 'holder');
  assert.ok(!BAD.test(legacy.label + legacy.description), JSON.stringify(legacy));
  assert.equal(legacy.label, '回合結束時：附加護盾', '舊存檔沿用結構化句重新命名');
  ok('舊存檔的籠統標籤／stat: 被重新解析');

  // ── 來源紀錄：晶片前綴只在來源不是持有者本人時出現；舊存檔（無 origin）照常顯示
  const self = { battleId: 'A', id: 'A', name: '甲', soulMark: { name: '魂甲' } };
  const foe = { battleId: 'B', id: 'B', name: '乙', soulMark: { name: '魂乙' } };
  const find = (_s: string, id: string) => id === 'B' ? foe : self;
  const originSkill = buildEffectOrigin({ actor: 'p2', skill: { name: '重擊' } }, foe, 'p2', find, 'skill');
  assert.deepEqual(originSkill, { kind: 'skill', sourceSide: 'p2', sourceBattleId: 'B', sourceName: '乙', skillName: '重擊' });
  const originSoul = buildEffectOrigin({ actor: 'p1', recoveryOrigin: { kind: 'soul', sourceSide: 'p1', sourceBattleId: 'A' }, skill: { name: '無關技能' } }, self, 'p1', find, 'skill');
  assert.equal(originSoul.kind, 'soulmark', '魂印容器優先於當前選招');
  assert.equal(originSoul.skillName, undefined); assert.equal(originSoul.defName, '魂甲');
  const originAcquired = buildEffectOrigin({ actor: 'p1', illusionEffectKey: '被複製者', skill: undefined, recoveryOrigin: { kind: 'soul', sourceSide: 'p1', sourceBattleId: 'A' } }, self, 'p1', find);
  assert.equal(originAcquired.sourceBattleId, 'A', '取得效果：施加者是持有者本人'); assert.equal(originAcquired.defName, '被複製者');
  const t = (origin: any, extra: any = {}) => ({ id: `t${Math.random()}`, name: '禁療', kind: 'turn_effect', source: 'skill', remaining: 2, tickAt: 'round_end', payload: {}, ...(origin ? { origin } : {}), ...extra });
  const [foreign] = V.buildEffectViewModels([], [t(originSkill)], 'A');
  assert.equal(foreign.sourceTag, '【乙】'); assert.match(V.describeEffectMeta(foreign), /來源：乙・技能「重擊」/);
  const [mine] = V.buildEffectViewModels([], [t(originSoul)], 'A');
  assert.equal(mine.sourceTag, ''); assert.match(V.describeEffectMeta(mine), /來源：甲・魂印「魂甲」/);
  const [old] = V.buildEffectViewModels([], [t(undefined)], 'A');
  assert.equal(old.sourceTag ?? '', ''); assert.equal(old.source, '技能');
  const [markForeign] = V.buildEffectViewModels([{ id: 'm', name: '印', displayChar: '印', count: 1, source: 'x', description: 'd', origin: originSkill }], [], 'A');
  assert.equal(markForeign.sourceTag, '【乙】');
  ok('來源紀錄：前綴只在外來來源；tooltip 含完整來源；舊存檔無 origin 仍可顯示');

  // ── 計數：待啟用／後手補償／層數
  const [pending] = V.buildEffectViewModels([], [t(undefined, { pendingActivation: true, remaining: 3 })], 'A');
  assert.equal(pending.countText, '待啟用'); assert.match(V.describeEffectMeta(pending), /下3回合/);
  const [late] = V.buildEffectViewModels([], [t(undefined, { lateMoverPending: true, remaining: 2 })], 'A');
  assert.equal(late.countText, '3回合', '後手補償：本回合不扣，實際多1回合'); assert.match(V.describeEffectMeta(late), /後手附加/);
  const [plain] = V.buildEffectViewModels([], [t(undefined, { remaining: 2 })], 'A');
  assert.equal(plain.countText, '2回合');
  const [stack] = V.buildEffectViewModels([], [t(undefined, { remaining: 2, layers: 3, stackRule: 'stack', payload: { maxLayers: 5 } })], 'A');
  assert.equal(stack.countText, '2回合 3/5層');
  const [uses] = V.buildEffectViewModels([], [t(undefined, { kind: 'use_counter', remaining: 2, tickAt: 'never' })], 'A');
  assert.equal(uses.countText, '2次');
  const mk = (extra: any) => ({ id: 'mk', name: '魂殤', displayChar: '殤', count: 1, source: 's', description: 'd', ...extra });
  assert.equal(V.buildEffectViewModels([mk({ count: 3, maxCount: 4, unit: '道' })], [], 'A')[0].countText, '3/4道');
  assert.equal(V.buildEffectViewModels([mk({ unit: '回合', remainingRounds: 3 })], [], 'A')[0].countText, '3回合', 'mark_turns／mark_duration：回合數不當成層');
  assert.equal(V.buildEffectViewModels([mk({ count: 2, maxCount: 5, unit: '層', remainingRounds: 3 })], [], 'A')[0].countText, '2/5層 3回合', '同時有層與回合時兩者都列');
  ok('計數：待啟用／後手真實剩餘／層數上限／回合與層並列');

  // ── 舊欄位鏡像：以 mirrorRegistryKeys 去重，不再出現數字不同的兩顆
  const elf: any = { ...self, statusImmuneTurns: 0, cannotUseAttrSkillsTurns: 0, cannotUseAttackSkillsTurns: 2, skills: [] };
  const mirror = t(undefined, { id: 'mirror', name: '攻擊技能失效', remaining: 3, payload: { mirrorRegistryKeys: ['p1_attackSkillInvalidTurns'] } });
  const withMirror = activeEffectViews(elf, [], [mirror], { attackSkillInvalidTurns: 2 });
  assert.equal(withMirror.filter((v: any) => v.semanticId === 'invalid:攻擊').length, 1, '同一鏡像只留計時器那一顆');
  const withoutMirror = activeEffectViews(elf, [], [], { attackSkillInvalidTurns: 2 });
  assert.equal(withoutMirror.filter((v: any) => v.semanticId === 'invalid:攻擊').length, 1, '沒有計時器時欄位鏡像照常顯示');
  const twoTimers = activeEffectViews(elf, [], [mirror, { ...mirror, id: 'mirror2' }], {});
  assert.equal(twoTimers.filter((v: any) => v.semanticId === 'invalid:攻擊').length, 2, '獨立計時器不合併');
  ok('舊欄位鏡像依 mirrorRegistryKeys 去重');

  // ── 符文標記：技能名＋狀態
  const runeElf: any = { skills: [{ name: '炎爆術', specialBadge: { text: '焰', description: '【已激活】選擇該技能時激活：效果' }, isRuneActive: true }] };
  const [rune] = skillBadgeViews(runeElf);
  assert.equal(rune.label, '炎爆術 已激活'); assert.equal(rune.shortLabel, '焰');
  ok('符文標記標籤＝技能名＋狀態');

  // ── 動作未知時：不輸出內部 op 代號、不輸出「積木組合效果」
  assert.equal(P.actionCaption({ op: 'zzz_not_registered', p: {} }), '');
  const warn = console.warn; let warned = '';
  console.warn = (m: any) => { warned += String(m); };
  assert.equal(R({ payload: { block: { body: [{ acts: [{ op: 'zzz_not_registered', p: {} }] }] } } }), '未命名效果');
  console.warn = warn;
  assert.match(warned, /zzz_not_registered/, '開發模式 console.warn 指出 op');
  ok('未知 op：未命名效果並警告');
  console.log(`效果標籤／來源／計數：${checks} 組通過。`);
} finally { await server.close(); }
