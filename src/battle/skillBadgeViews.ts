import type { Elf } from '../types';
import type { BattleEffectViewModel } from './effectViewModel';
import { effectIcon } from './effectIcons';

/**
 * 掛在技能欄位上的標記（Skill.specialBadge／isRuneActive）→ 同一套「印記」顯示資料。
 * 只讀投影：狀態仍存在技能上，這裡不建立任何戰鬥狀態；通用機制，不認精靈名稱。
 */
export function skillBadgeViews(elf: Elf): BattleEffectViewModel[] {
  const views: BattleEffectViewModel[] = [];
  (elf.skills || []).forEach((skill, slot) => {
    const badge = skill.specialBadge;
    if (!badge?.text) return;
    const known = typeof skill.isRuneActive === 'boolean';
    const active = skill.isRuneActive === true;
    const state = known ? (active ? '已激活' : '未激活') : '';
    const detail = (badge.description || '').replace(/^【(已|未)激活】(選擇該技能時激活：)?/, '');
    views.push({
      id: `skill-badge:${slot}:${badge.text}`,
      semanticId: `skill-badge:${badge.text}`,
      category: 'mark',
      label: `${badge.text}${state ? ` ${state}` : ''}`,
      shortLabel: badge.text,
      description: `技能${slot + 1}「${skill.name}」上的${badge.text}${state ? `（${state}）` : ''}：${detail || badge.text}`,
      source: '技能印記',
      clearable: false,
      persistsOffField: false,
      triggerNode: '直到持有者下場前',
      polarity: badge.polarity || (active ? 'positive' : 'neutral'),
      priority: active ? 62 : 58,
      icon: effectIcon(undefined, badge.text),
    });
  });
  return views;
}
