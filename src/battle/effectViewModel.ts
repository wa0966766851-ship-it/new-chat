import type { Mark } from "./marks";
import type { Timer, TimerKind } from "./timers";
import { payloadPresentation } from './effectPresentation';
import { effectIcon } from './effectIcons';
import {statusCountAppearance, type StatusCountTone} from './statusImmunityCount';

export type EffectViewCategory = "mark" | "turn" | "round" | "count" | "mechanism" | "protection";
export type EffectMetricUnit = "層" | "道" | "點" | "篇" | "枚" | "株" | "回合" | "次";

export interface BattleEffectViewModel {
  id: string;
  category: EffectViewCategory;
  label: string;
  shortLabel: string;
  description: string;
  source: string;
  value?: number;
  maxValue?: number;
  unit?: EffectMetricUnit;
  clearable: boolean;
  persistsOffField?: boolean;
  triggerNode?: string;
  polarity: "positive" | "negative" | "neutral";
  priority: number;
  semanticId: string;
  icon: string;
  tone?: StatusCountTone;
}

const TIMER_CATEGORY: Record<TimerKind, EffectViewCategory> = {
  turn_effect: "turn",
  round_counter: "round",
  use_counter: "count",
};

const TIMER_PRIORITY: Record<EffectViewCategory, number> = {
  turn: 80,
  count: 70,
  mark: 60,
  round: 50,
  mechanism: 45,
  protection: 90,
};

function timerPolarity(timer: Timer): BattleEffectViewModel["polarity"] {
  const raw = String(timer.presentation?.polarity || timer.polarity || timer.payload?.polarity || "positive").toLowerCase();
  if (raw === "negative") return "negative";
  if (raw === "neutral") return "neutral";
  return "positive";
}

/**
 * 將引擎的印記與三種 Timer 轉成同一套顯示資料。
 * 這層只負責呈現，不從描述文字反推戰鬥語意。
 */
export function buildEffectViewModels(marks: Mark[] = [], timers: Timer[] = [], activeBattleId?: string): BattleEffectViewModel[] {
  const markViews: BattleEffectViewModel[] = marks
    .filter(mark => (mark.count > 0 || mark.visibleWhenZero) && (!mark.ownerBattleId || !activeBattleId || mark.ownerBattleId === activeBattleId))
    .map(mark => ({
      id: `mark:${mark.id}`,
      category: "mark",
      label: mark.presentation?.label || mark.name,
      shortLabel: mark.displayChar || mark.name.slice(0, 1),
      description: mark.presentation?.description || mark.description || mark.name,
      source: mark.presentation?.sourceName || mark.source || "印記",
      semanticId: mark.presentation?.semanticId || `mark:${mark.id}`,
      icon: effectIcon(mark.presentation?.iconTag || mark.iconTag, mark.name),
      value: mark.remainingRounds ?? mark.count,
      maxValue: mark.maxCount,
      unit: mark.remainingRounds !== undefined ? "回合" : (mark.unit || "層"),
      clearable: mark.clearable ?? false,
      persistsOffField: mark.persistsOffField,
      triggerNode: mark.triggerNode,
      polarity: mark.presentation?.polarity || mark.polarity || "neutral",
      priority: (mark.presentation?.polarity || mark.polarity) === "negative" ? 75 : TIMER_PRIORITY.mark,
    }));

  const timerViews: BattleEffectViewModel[] = timers
    .filter(timer => timer.remaining > 0 && (timer.scope === 'team' || !timer.ownerBattleId || !activeBattleId || timer.ownerBattleId === activeBattleId))
    .map(timer => {
      const category = TIMER_CATEGORY[timer.kind];
      const count = timer.payload?.statusImmunityCount ? statusCountAppearance(timer.scope === 'team', timer.persistsOffField !== false, !!timer.payload.statusImmunityCount.reflect) : undefined;
      const presentation = timer.presentation || payloadPresentation(timer.payload);
      const polarity = timer.polarity || timer.payload?.polarity || timer.presentation?.polarity ? timerPolarity(timer) : presentation?.polarity || 'positive';
      const label = count?.label || presentation?.label || timer.name || (category === "count" ? "次數類效果" : "計時效果");
      return {
        id: `timer:${timer.id}`,
        category,
        label,
        shortLabel: timer.displayChar || label.slice(0, 1),
        description: count?.description || presentation?.description || timer.description || timer.name || "啟用中的效果",
        source: presentation?.sourceName || timer.payload?.block?.src || ({ skill: '技能', soulmark: '魂印', trait: '特質', system: '系統' } as Record<string, string>)[timer.source] || timer.source,
        semanticId: presentation?.semanticId || `timer:${timer.id}`,
        icon: count ? count.icon : effectIcon(presentation?.iconTag),
        ...(count ? {tone: count.tone} : {}),
        value: timer.remaining,
        maxValue: timer.payload?.maxLayers,
        unit: category === "count" ? "次" : "回合",
        clearable: timer.kind === "turn_effect" && timer.clearable !== false,
        persistsOffField: timer.persistsOffField ?? timer.payload?.persistsOffField,
        triggerNode: timer.tickAt === "never" ? "主動消耗" : timer.tickAt,
        polarity,
        priority: TIMER_PRIORITY[category] + (polarity === "negative" ? 15 : 0) + (timer.remaining === 1 ? 8 : 0),
      };
    });

  return [...markViews, ...timerViews].sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label, "zh-Hant"));
}

export function describeEffectMeta(effect: BattleEffectViewModel): string {
  const category = effect.category === "mark" ? "印記"
    : effect.category === "turn" ? "回合類效果"
    : effect.category === "round" ? "其他回合計數"
    : effect.category === "mechanism" ? "常駐機制"
    : effect.category === "protection" ? "防護" : "次數類效果";
  const lines = [
    effect.description,
    "",
    `分類：${category}`,
    `來源：${effect.source}`,
    `可被消除回合類效果清除：${effect.clearable ? "是" : "否"}`,
  ];
  if (effect.persistsOffField !== undefined) lines.push(`下場後保留：${effect.persistsOffField ? "是" : "否"}`);
  if (effect.triggerNode) lines.push(`遞減／觸發節點：${effect.triggerNode}`);
  return lines.join("\n");
}
