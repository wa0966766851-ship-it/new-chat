/** Display-only contract. Never infer execution semantics or artwork from prose. */
export interface EffectPresentation {
  semanticId: string;
  label: string;
  description?: string;
  iconTag?: string;
  sourceName?: string;
  polarity?: 'positive' | 'negative' | 'neutral';
}

const numberText = (n: number) => Number(n.toFixed(2)).toString();
const percent = (n: number) => `${numberText(n * 100)}%`;

/** Captions are derived from structured parameters, not from the originating skill's name. */
export function payloadPresentation(payload: Record<string, any> = {}): EffectPresentation | undefined {
  payload = { ...(payload.block || {}), ...payload };
  const parts: EffectPresentation[] = [];
  const add = (semanticId: string, label: string, iconTag?: string, description?: string) =>
    parts.push({ semanticId, label, iconTag, description: description || label });
  const block = payload.block || {};
  if(block.typeDamageFloor){const f=block.typeDamageFloor;add('type_damage_floor',`受到技能傷害至少${f.base}×最高克制倍率`,'傷害保底',`在${f.list.join('／')}中取對持有者當前屬性最高的克制倍率；僅限技能傷害。`);}
  if (Number.isFinite(block.powerRatio)) {
    const ratio=block.powerRatio,reciprocal=1/ratio;
    const text=ratio>0&&ratio<1&&Math.abs(reciprocal-Math.round(reciprocal))<1e-10?`1/${Math.round(reciprocal)}`:String(ratio);
    add('power_ratio', `攻擊威力×${text}`, ratio<1?'威力降低':'威力提升', `攻擊技能威力乘以${text}；不是傷害比例，不改屬性技能。`);
  }
  if (block.prio !== undefined) add('priority', `先制${block.prio >= 0 ? '+' : ''}${block.prio}`, block.prio < 0 ? '先制降低' : '先制');
  if (payload.disablePriority) add('priority_disabled', '先制效果失效', '先制效果失效');
  if (block.invalid) add(`invalid:${block.invalid}`, `${block.invalid === 'all' ? '所有' : block.invalid}技能無效`, '技能無效');
  if (block.addInvalid) add(`attached_invalid:${block.addInvalid}`, `${block.addInvalid}技能附加效果無效`, '技能無效');
  if (block.ppMult !== undefined) add('pp_cost', `PP消耗×${block.ppMult}`, '減PP');
  if (block.dmgIn !== undefined) add('received_damage', `受到${block.kind || '指定類型'}傷害${block.dmgIn >= 0 ? '提升' : '降低'}${percent(Math.abs(block.dmgIn))}`, block.dmgIn < 0 ? '減傷' : '增傷');
  if (block.dmgOut !== undefined) add('outgoing_damage', `造成${block.kind || '指定類型'}傷害${block.dmgOut >= 0 ? '提升' : '降低'}${percent(Math.abs(block.dmgOut))}`, block.dmgOut < 0 ? '減傷' : '增傷');
  if (block.dmgOutMult !== undefined) add('outgoing_damage', `造成${block.kind || '指定類型'}傷害×${block.dmgOutMult}`, block.dmgOutMult < 1 ? '減傷' : '增傷');
  if (block.crit || block.critChanceBonus !== undefined) add('critical', block.crit ? '必定致命一擊' : `致命機率增加${percent(block.critChanceBonus)}`, '致命一擊');
  if (block.blockAttack) add('attack_immunity', '抵擋攻擊', '免傷');
  for (const rawKey of payload.mirrorRegistryKeys || []) {
    const key = rawKey.replace(/^p[12]_/, '');
    const known = MIRROR_PRESENTATIONS[key];
    if (known) parts.push({ ...known, description: known.label });
  }
  if (payload.immuneStatus) add(payload.reflectStatus ? 'status_guard_reflect' : 'status_guard', payload.reflectStatus ? '異常免疫與反彈' : '異常免疫', '免疫異常',
    `免疫${payload.excludeStatusCategory === 'AUXILIARY' ? '非附屬類' : '指定'}異常${payload.reflectStatus ? '並反彈' : ''}。`);
  if (payload.recoveryReductionPercent !== undefined) add('recovery_reduction', payload.recoveryReductionPercent >= 1 ? '禁止恢復體力' : `恢復量降低${percent(payload.recoveryReductionPercent)}`, '降療');
  if (payload.ppRecoveryReductionPercent !== undefined) add('pp_recovery_reduction', `PP恢復量降低${percent(payload.ppRecoveryReductionPercent)}`, '減PP');
  if (payload.afterUseDrainRatio) add('after_use_drain', '使用技能後吸取體力', '吸血',
    `使用技能後吸取對手最大體力的${percent(payload.afterUseDrainRatio.ratio)}${payload.afterUseDrainRatio.doubleBelowHalf ? '，自身低於半血時翻倍' : ''}。`);
  if (payload.afterUseDrain) add('after_use_drain_fixed', '使用技能後吸取體力', '吸血',
    `使用技能後吸取${payload.afterUseDrain.amount}點體力（固定傷害）${payload.afterUseDrain.doubleLower ? '，體力低於對手時翻倍' : ''}${payload.afterUseDrain.trueIfNoLoss ? '；未扣血時追加真實傷害' : ''}。`);
  if (payload.afterUseHealEqualPercent !== undefined) add('after_use_heal_damage', '使用技能後恢復與附傷', '恢復', '使用技能後回滿體力，並附加等量百分比傷害。');
  if (payload.roundPpAbsorb) add('round_pp_absorb', '回合開始吸取PP', '吸取PP',
    `每回合開始吸取${payload.roundPpAbsorb.amount}點PP${payload.roundPpAbsorb.doubleWhenLostHalf ? '，損失半血時翻倍' : ''}。`);
  if (payload.incomingPhysicalSkillMultiplier !== undefined) add('physical_received_multiplier', `受到物理技能傷害×${payload.incomingPhysicalSkillMultiplier}`, payload.incomingPhysicalSkillMultiplier < 1 ? '減傷' : '增傷');
  if (payload.nonTrueOutputLimit !== undefined) add('non_true_output_cap', `非真實傷害上限${payload.nonTrueOutputLimit}`, '傷害限制');
  if (payload.inherentInvalid) add('inherent_invalid', '固有效果無效', '技能無效');
  if (payload.preventAction) add('prevent_action', '禁止行動');
  if (payload.lockSwitch) add('switch_lock', '禁止主動切換', '切換限制');
  if (payload.roundHealEqualPercent) add('round_heal_damage', '回合開始恢復與附傷', '恢復');
  if (payload.blockSkillDamage) add('block_skill_damage', '免疫技能傷害', '免傷');
  if (payload.spaceShift) add('space_shift', '空間轉移');
  if (payload.halveNonTrue) add('halve_non_true', '非真實傷害減半', '減傷');
  if (payload.halveReflectSkill) add('halve_reflect_skill', '技能傷害減半並反彈', '反傷');
  if (payload.reflectSkillQuarter) add('reflect_skill_quarter', '技能傷害¼反彈', '反傷');
  if (payload.sleepOnFixed) add('sleep_on_fixed', '受到固定傷害附加睡眠', '施加異常');
  if (payload.nextAttackSkillBoost !== undefined) add('next_attack_boost', `下次技能傷害×${payload.nextAttackSkillBoost}`, '增傷');
  if (payload.incomingAttackCritical) add('incoming_attack_crit', '受到攻擊必定致命一擊', '致命一擊');
  if (payload.fixedPercentAsTrue) add('damage_conversion', '固定／百分比傷害轉為真實傷害');
  if (payload.damageStatusReaction) add('damage_status_reaction', '受傷後異常反應');
  if (payload.afterUsePercent) add('after_use_percent', '使用技能後百分比附傷', '附加傷害');
  if (payload.roundDrainThird) add('round_drain', '回合開始吸取⅓體力', '吸血');
  if (payload.priorityDelta !== undefined) add('priority', `先制${payload.priorityDelta >= 0 ? '+' : ''}${payload.priorityDelta}`, payload.priorityDelta < 0 ? '先制降低' : '先制');
  if (payload.attackAdditionalTruePercent !== undefined) add('attack_true_extra', `攻擊附加${percent(payload.attackAdditionalTruePercent)}真實傷害`, '附加傷害');
  if (payload.orbAttackConversion) add('orb_attack_conversion', '攻擊技能轉化');
  if (payload.nextAttackHalves) add('next_attack_halves', `下次攻擊吸取體力${payload.nextAttackHalves}次`, '吸血');
  if (payload.damageIncreasePercent !== undefined) add('damage_increase', `${damageScope(payload.damageTypes)}傷害提升${percent(payload.damageIncreasePercent)}`, '增傷');
  if (block.body) {
    const actions = block.body.flatMap((s: any) => [...(s.acts || []), ...(s.onSuccess || []), ...(s.onFail || [])]);
    const labels = actions.map((a: any) => actionCaption(a)).filter(Boolean);
    if (labels.length) add('sequence', triggerCaption(block.trig) + labels.join('／'), undefined,
      triggerCaption(block.trig) + labels.join('；') + '。分支與條件以完整積木定義為準。');
  }
  for (const wrap of payload.wrapItems || []) {
    if (wrap.atom === 'damage_multiplier') add('damage_multiplier', `${damageScope(wrap.params?.damageTypes)}傷害×${wrap.params?.value}`, wrap.params?.value < 1 ? '減傷' : '增傷');
  }
  if (!parts.length) return undefined;
  return { semanticId: parts.map(p => p.semanticId).join('+'), label: parts.map(p => p.label).join('／'),
    description: parts.map(p => p.description).join('\n'), iconTag: parts.length === 1 ? parts[0].iconTag : undefined,
    polarity: payload.polarity ? String(payload.polarity).toLowerCase() as EffectPresentation['polarity']
      : parts.some(p => p.polarity === 'negative') || block.invalid || block.addInvalid || block.prio < 0 || block.ppMult > 1 || block.dmgIn > 0 || block.dmgOut < 0 || block.dmgOutMult < 1 || payload.recoveryReductionPercent || payload.ppRecoveryReductionPercent || payload.lockSwitch || payload.preventAction || payload.inherentInvalid || payload.disablePriority || payload.incomingAttackCritical || payload.incomingPhysicalSkillMultiplier > 1 || payload.priorityDelta < 0 ? 'negative' : 'positive' };
}

const MIRROR_PRESENTATIONS: Record<string, EffectPresentation> = {
  attackSkillInvalidTurns: { semanticId: 'invalid:攻擊', label: '攻擊技能無效', iconTag: '技能無效', polarity: 'negative' },
  utilitySkillInvalidTurns: { semanticId: 'invalid:屬性', label: '屬性技能無效', iconTag: '技能無效', polarity: 'negative' },
  noHealTurns: { semanticId: 'recovery_reduction', label: '禁止恢復體力', iconTag: '降療', polarity: 'negative' },
  noSwitchTurns: { semanticId: 'switch_lock', label: '禁止主動切換', iconTag: '切換限制', polarity: 'negative' },
  immuneAttackTurns: { semanticId: 'attack_immunity', label: '免疫攻擊', iconTag: '免傷', polarity: 'positive' },
  priorityBoostTurns: { semanticId: 'priority', label: '先制提升', iconTag: '先制', polarity: 'positive' },
  incomingSkillDmgCapTurns: { semanticId: 'skill_damage_cap', label: '技能傷害上限', iconTag: '傷害限制', polarity: 'positive' },
  damageTakenBoostTurns: { semanticId: 'received_damage', label: '受到傷害提升', iconTag: '增傷', polarity: 'negative' },
};

function damageScope(types?: string[]): string {
  return (types || []).map(t => ({ attack: '攻擊', skill: '技能', non_true: '非真實', fixed: '固定', percent: '百分比', true: '真實' }[t] || t)).join('／');
}

function triggerCaption(trigger?: string): string {
  return ({ self_after_use: '使用技能後（含未命中／無效）：', self_after_skill: '成功使用技能後：', round_start: '回合開始：', round_end: '回合結束：', damaged: '受傷後：' } as Record<string, string>)[trigger || ''] || '觸發時：';
}

function actionCaption(a: { op: string; p: Record<string, any>; label?: string }): string {
  const p = a.p || {};
  if (a.op === 'dmg') return `附加${p.flat !== undefined ? `${p.flat}點` : p.ratio !== undefined ? `${percent(p.ratio)}${p.base || ''}` : ''}${p.type || '指定類型'}傷害`;
  if (a.op === 'dmg_from_last') return `前一效果數值${percent(p.ratio ?? 1)}轉為${p.elem ? `${p.elem}系` : ''}${p.type || '指定類型'}傷害`;
  if (a.op === 'stat') return `${p.side === 'opp' ? '對手' : '自身'}${(p.stats || []).join('／')}等級${p.v >= 0 ? '+' : ''}${p.v}`;
  if (a.op === 'status') return `附加${p.status || '指定異常'}`;
  if (a.op === 'heal') return `恢復${p.flat !== undefined ? `${p.flat}點` : p.ratio !== undefined ? `${p.base || '最大體力'}${percent(p.ratio)}` : ''}體力`;
  if (a.op === 'pp') return '調整PP';
  if (a.op === 'boost') return `${p.kind || '指定類型'}${p.power ? '威力' : '傷害'}×${p.mult}`;
  if (a.label && a.label !== a.op) return a.label;
  return ({ clear_turn: '消除回合類效果', invalid_turns: '技能無效', immune_status_turns: '異常免疫', immune_attack_count: '免疫攻擊', vampire: '吸血', drain: '吸取體力', stat_clear: '消除能力等級', survive: '致死存活' } as Record<string, string>)[a.op] || '積木組合效果';
}

/** Unknown payloads remain explicitly unknown rather than being renamed after a skill. */
export function makeEffectPresentation(payload: Record<string, any> | undefined, sourceName?: string, label?: string): EffectPresentation {
  const inferred = payloadPresentation(payload);
  return { ...(inferred || { semanticId: 'unclassified', label: '待補說明的效果', description: '此效果尚未提供結構化顯示說明；請查看來源定義。' }),
    ...(label ? { label, description: inferred?.description || label } : {}), sourceName };
}
