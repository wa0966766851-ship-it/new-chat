import type { Elf } from '../types';
import type { Mark } from './marks';
import type { Timer } from './timers';
import { buildEffectViewModels, type BattleEffectViewModel } from './effectViewModel';
import { effectIcon, STATE_SIGNS } from './effectIcons';
import { marsMechanismEffects, MARS_MECHA_CATALOG } from '../effects/elves/mars/presentation';
import { elfForViewer, hiddenFromViewer, type BattleViewMode } from './viewerPerspective';
import {statusCountAppearance} from './statusImmunityCount';
import {displayTurnValue} from './displayTurnValue';
import {skillBadgeViews} from './skillBadgeViews';

export function visibleEffectSourceText(source: Elf | undefined, side: 'p1' | 'p2', mode: BattleViewMode = 'PVE'): string {
  return !source || hiddenFromViewer(source, side, mode) ? '' : elfForViewer(source, side).soulMark?.description || '';
}

/** One read-only projection for HUD, avatar details and inspector. No state is created here. */
export function activeEffectViews(elf: Elf, marks: Mark[] = [], timers: Timer[] = [], registry: Record<string, any> = {}, sourceText = ''): BattleEffectViewModel[] {
  const views = buildEffectViewModels(marks, timers, elf.battleId || elf.id);
  const append = (view: BattleEffectViewModel, shadowOf?: string) => {
    // Only legacy-field mirrors are deduplicated. Two distinct timers must never be merged by label.
    if (shadowOf && views.some(v => v.semanticId === shadowOf && v.value === view.value)) return;
    views.push(view);
  };
  for (const key of ['blkImmuneStatusCount', 'blkReflectStatusCount']) {
    const value = Number(registry[key] || 0);
    if (!(value > 0)) continue;
    const appearance = statusCountAppearance(false, true, key === 'blkReflectStatusCount');
    append({id: `registry:${key}`, semanticId: key, category: 'count', ...appearance,
      shortLabel: '免', source: '持有者次數狀態', value, unit: '次', clearable: false,
      persistsOffField: true, triggerNode: '受到異常時消耗', polarity: 'positive',
      icon: appearance.icon, priority: 70});
  }
  for (const [field, semanticId, label, iconTag, polarity] of [
    ['statusImmuneTurns', 'status_guard', '異常免疫', '免疫異常', 'positive'],
    ['cannotUseAttrSkillsTurns', 'invalid:屬性', '屬性技能封鎖', '技能無效', 'negative'],
    ['cannotUseAttackSkillsTurns', 'invalid:攻擊', '攻擊技能失效', '技能無效', 'negative'],
  ] as const) {
    const value = displayTurnValue(elf,registry,field);
    if (value > 0) append({ id: `field:${field}`, semanticId, category: 'turn', label, shortLabel: label[0],
      description: label, source: '戰鬥狀態欄位', value, unit: '回合', clearable: true,
      polarity, icon: effectIcon(iconTag), priority: 80 }, semanticId);
  }
  if (elf.isAttackImmune) append({ id: 'field:isAttackImmune', semanticId: 'attack_immunity', category: 'mechanism',
    label: '攻擊傷害免疫', shortLabel: '免', description: '當前攻擊傷害免疫狀態；不虛構剩餘次數。',
    source: '戰鬥狀態欄位', clearable: false, polarity: 'positive', icon: effectIcon('免傷'), priority: 80 });
  for (const [field, label] of [['shield', '護盾'], ['barrier', '護罩']] as const) {
    const value = Number(elf[field] || 0);
    if (value > 0) append({ id: `field:${field}`, semanticId: field, category: 'protection', label, shortLabel: label[1],
      description: `剩餘${label}容量：${value}。`, source: '防護狀態', value, unit: '點', clearable: false,
      polarity: 'positive', icon: effectIcon(label), priority: 90 });
  }
  for (const mechanism of marsMechanismEffects(elf, registry)) {
    const catalog = MARS_MECHA_CATALOG[mechanism.catalogId as keyof typeof MARS_MECHA_CATALOG];
    append({ id: `mechanism:${catalog.id}`, semanticId: catalog.id, category: 'mechanism', label: catalog.label,
      shortLabel: '機', description: catalog.describe(), source: '魂印機制', clearable: false,
      polarity: 'positive', icon: effectIcon(), priority: 45 });
  }
  views.push(...skillBadgeViews(elf)); // 技能欄位上的標記（符文等）
  for (const sign of STATE_SIGNS) {
    const value = Number(registry[sign.key] || 0);
    if (value <= 0 || views.some(v => v.category === 'mark' && v.label === sign.name)) continue;
    const descriptionAt = Math.max(sourceText.indexOf(`${sign.name}:`), sourceText.indexOf(`${sign.name}：`));
    append({ id: `state-sign:${sign.key}`, semanticId: sign.key, category: 'mark', label: sign.name,
      shortLabel: sign.name, description: descriptionAt >= 0 ? sourceText.slice(descriptionAt) : `專屬印記：剩餘${value}回合。`, source: '專屬印記狀態',
      value, unit: '回合', clearable: false, polarity: 'neutral', icon: effectIcon(undefined, sign.name), priority: 60 });
  }
  return views.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label, 'zh-Hant'));
}
