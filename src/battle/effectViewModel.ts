import type { Mark } from "./marks";
import type { Timer, TimerKind } from "./timers";
import type { EffectOrigin } from '../types';
import { payloadPresentation, resolveEffectLabel, scrubEffectText, triggerCaption } from './effectPresentation';
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
  /** 來源紀錄（新存檔才有）。 */
  origin?: EffectOrigin;
  /** 晶片前綴：只在來源精靈不是持有者本人時才有，例如「【卡修斯】」；完整來源在 tooltip。 */
  sourceTag?: string;
  /** 層數／回合分開保存；countText 為晶片與面板統一顯示的計數文字。 */
  layers?: number;
  maxLayers?: number;
  layerUnit?: string;
  turns?: number;
  pending?: boolean;
  lateMover?: boolean;
  /** 計數補充（待啟用／後手補償），只放 tooltip。 */
  note?: string;
  countText?: string;
  /** 此效果同步寫入的舊欄位鍵（去掉 p1_／p2_ 前綴），供舊欄位鏡像去重。 */
  mirrorKeys?: string[];
  /** 觸發時點（結構化顯示用，來自積木 trig）。 */
  triggerText?: string;
}

/** 計數統一文字：待啟用優先；層數與回合同時存在時兩者都列。 */
export function effectCountText(v: Pick<BattleEffectViewModel, 'value' | 'maxValue' | 'unit' | 'layers' | 'maxLayers' | 'turns' | 'pending'>): string {
  const parts: string[] = [];
  if (v.pending) parts.push('待啟用');
  else if (v.turns !== undefined) parts.push(`${v.turns}回合`);
  else if (v.value !== undefined) parts.push(`${v.value}${v.maxValue !== undefined && v.layers === undefined ? `/${v.maxValue}` : ''}${v.unit || ''}`);
  if (v.layers !== undefined) parts.push(`${v.layers}${v.maxLayers !== undefined ? `/${v.maxLayers}` : ''}層`);
  return parts.join(' ');
}

const ORIGIN_KIND_TEXT: Record<EffectOrigin['kind'], string> = { skill: '技能', soulmark: '魂印', trait: '特質', item: '道具', extra: '額外精靈', system: '系統' };
const LEGACY_SOURCE_TEXT: Record<string, string> = { skill: '技能', soulmark: '魂印', trait: '特質', item: '道具', extra: '額外精靈', mechanic: '機制', system: '系統' };
export function describeOrigin(origin: EffectOrigin): string {
  const detail = origin.kind === 'skill' ? origin.skillName : origin.defName;
  return `${origin.sourceName || '未知精靈'}・${ORIGIN_KIND_TEXT[origin.kind]}${detail ? `「${detail}」` : ''}`;
}
const foreignTag = (origin: EffectOrigin | undefined, ownerBattleId?: string): string =>
  origin?.sourceName && ownerBattleId && origin.sourceBattleId && origin.sourceBattleId !== ownerBattleId ? `【${origin.sourceName}】` : '';

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
    .map(mark => {
      const turns = mark.remainingRounds;
      const showLayers = turns === undefined || mark.count > 1 || mark.maxCount !== undefined;
      const layerUnit = turns === undefined ? (mark.unit || '層') : (mark.unit && mark.unit !== '回合' ? mark.unit : '層');
      const view: BattleEffectViewModel = {
      id: `mark:${mark.id}`,
      category: "mark",
      label: resolveEffectLabel({ label: mark.presentation?.label, name: mark.name || mark.id, description: mark.description }),
      // 2026-10-30：任何印記缺 displayChar 與 name 時不可讓整個清單崩潰。
      shortLabel: mark.displayChar || mark.name?.slice(0, 1) || "印",
      description: scrubEffectText(mark.presentation?.description || mark.description || mark.name || mark.id),
      source: mark.origin ? describeOrigin(mark.origin) : mark.presentation?.sourceName || mark.source || "印記",
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
      ...(mark.origin ? { origin: mark.origin, sourceTag: foreignTag(mark.origin, activeBattleId) } : {}),
      ...(showLayers ? { layers: mark.count, maxLayers: mark.maxCount, layerUnit } : {}),
      ...(turns !== undefined ? { turns } : {}),
      countText: [showLayers ? `${mark.count}${mark.maxCount !== undefined ? `/${mark.maxCount}` : ''}${layerUnit}` : '', turns !== undefined ? `${turns}回合` : ''].filter(Boolean).join(' '),
      };
      return view;
    });

  const timerViews: BattleEffectViewModel[] = timers
    .filter(timer => timer.remaining > 0 && (timer.scope === 'team' || !timer.ownerBattleId || !activeBattleId || timer.ownerBattleId === activeBattleId))
    .map(timer => {
      const category = TIMER_CATEGORY[timer.kind];
      const count = timer.payload?.statusImmunityCount ? statusCountAppearance(timer.scope === 'team', timer.persistsOffField !== false, !!timer.payload.statusImmunityCount.reflect) : undefined;
      const presentation = timer.presentation || payloadPresentation(timer.payload);
      const polarity = timer.polarity || timer.payload?.polarity || timer.presentation?.polarity ? timerPolarity(timer) : presentation?.polarity || 'positive';
      const label = resolveEffectLabel({ label: count?.label || presentation?.label, name: timer.name, payload: timer.payload, description: timer.description });
      const pending = !!timer.pendingActivation;
      const lateMover = !pending && !!timer.lateMoverPending && timer.kind === 'turn_effect';
      // 後手補償：本回合結束不扣回合，實際還會經歷 remaining+1 次回合結束。
      const remaining = timer.remaining + (lateMover ? 1 : 0);
      const layers = (timer.layers ?? 1) > 1 || timer.payload?.maxLayers !== undefined ? (timer.layers ?? 1) : undefined;
      const triggerText = triggerCaption(timer.payload?.block?.trig).replace(/：$/, '');
      const maxLayers = layers !== undefined ? (timer.payload?.maxLayers ?? (timer.stackRule === 'stack' ? 5 : undefined)) : undefined;
      const unit: EffectMetricUnit = category === "count" ? "次" : "回合";
      const note = pending ? `下${timer.remaining}回合：附加當回合不啟用，首次回合結束後啟用。` : lateMover ? '後手附加：本回合結束不扣除，實際多持續1回合。' : undefined;
      const view: BattleEffectViewModel = {
        id: `timer:${timer.id}`,
        category,
        label,
        shortLabel: timer.displayChar || label.slice(0, 1),
        description: scrubEffectText(count?.description || presentation?.description || timer.description || timer.name || "啟用中的效果"),
        source: timer.origin ? describeOrigin(timer.origin) : presentation?.sourceName || timer.payload?.block?.src || LEGACY_SOURCE_TEXT[timer.source] || timer.source,
        semanticId: presentation?.semanticId || `timer:${timer.id}`,
        icon: count ? count.icon : effectIcon(presentation?.iconTag),
        ...(count ? {tone: count.tone} : {}),
        value: remaining,
        maxValue: timer.payload?.maxLayers,
        unit,
        clearable: timer.kind === "turn_effect" && timer.clearable !== false,
        persistsOffField: timer.persistsOffField ?? timer.payload?.persistsOffField,
        triggerNode: timer.tickAt === "never" ? "主動消耗" : timer.tickAt,
        polarity,
        priority: TIMER_PRIORITY[category] + (polarity === "negative" ? 15 : 0) + (timer.remaining === 1 ? 8 : 0),
        ...(timer.origin ? { origin: timer.origin, sourceTag: foreignTag(timer.origin, activeBattleId) } : {}),
        ...(layers !== undefined ? { layers, maxLayers } : {}),
        ...(triggerText ? { triggerText } : {}),
        ...(pending ? { pending } : {}), ...(lateMover ? { lateMover } : {}), ...(note ? { note } : {}),
        ...(timer.payload?.mirrorRegistryKeys?.length ? { mirrorKeys: (timer.payload.mirrorRegistryKeys as string[]).map(k => k.replace(/^p[12]_/, '')) } : {}),
      };
      view.countText = effectCountText({ ...view, maxValue: undefined });
      return view;
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
  if (effect.triggerText) lines.splice(3, 0, `觸發：${effect.triggerText}`);
  if (effect.note) lines.push(effect.note);
  if (effect.persistsOffField !== undefined) lines.push(`下場後保留：${effect.persistsOffField ? "是" : "否"}`);
  if (effect.triggerNode) lines.push(`遞減／觸發節點：${effect.triggerNode}`);
  return lines.join("\n");
}
