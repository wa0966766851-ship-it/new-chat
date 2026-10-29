// src/battle/ai.ts
// 戰術 AI 決策引擎 —— 取代 v3 的「只選技能 + 每隻硬寫 if」與 v4 的「克制→威力排序」。
//
// 相對 v3 的三個實質升級:
//   1. 統一行動空間:技能 / 切換 / 道具 一起評分競爭(v3 的切換只有「HP<15% 時 12% 隨機切」,道具完全沒有)
//   2. 局勢感知:預估我方能否 KO、對手能否 KO 我(用引擎真正的傷害公式,非自己重算)
//   3. 專屬特性/登場效果:改用資料表(AI_ELF_HINTS)取代 v3 散落的 if 鏈,可擴充、可測試
//
// ⚠️ 純函式:所有引擎能力以參數注入,不 import BattleScreen。可 headless 單元測試。

import { Elf, Skill, BattleItem } from "../../types";
import { isStatusActive } from "../../utils/statusManager";
import { isAbnormal } from "../../utils/battleHelpers";
import { checkElfDead } from '../elfAlive';
import { resolveDamageTransition } from '../survivalRules';
import { elfHint } from './hooks';
import { abnormalSideEffectsSuppressed, itemRecoveryGain, survivalMargin } from './mechanicAwareness';

/* ────────────────────────────────────────────────────────────
 * 1. 行動空間
 * ──────────────────────────────────────────────────────────── */

export type AIAction =
  | { kind: "skill"; skill: Skill; moveIndex: number }
  | { kind: "switch"; index: number }
  | { kind: "item"; item: BattleItem };

export interface ScoredAction {
  action: AIAction;
  score: number;
  /** 給戰報顯示的中文理由(沿用 v3 會輸出決策理由的做法) */
  reason: string;
}

/* ────────────────────────────────────────────────────────────
 * 2. 注入的引擎能力(避免重算公式導致與實戰漂移)
 * ──────────────────────────────────────────────────────────── */

export interface AIDeps {
  /** 引擎真正的傷害公式。務必傳入 calculateDamage,不要讓 AI 自己估。 */
  estimateDamage: (attacker: Elf, defender: Elf, skill: Skill) => number;
  /** 屬性克制倍率 */
  getTypeMatchup: (attackerType: string, defenderType: string) => number;
  /** 取得異常狀態表(Record<string, number>) */
  getStatuses: (elf: Elf) => Record<string, number>;
  /** 該技能當下是否可用(PP/充能/封印…)。務必傳入引擎既有判定,不要用 pp>0 硬猜。 */
  isSkillUsable: (elf: Elf, skill: Skill) => boolean;
  /** 不受PP限制的技能不應觸發「無PP需吃藥」。 */
  isPpExempt?: (elf: Elf, skill: Skill) => boolean;
  /** 是否為控制類異常 */
  isControlStatus: (status: string) => boolean;
  rng: () => number;
}

export interface AIContext {
  self: Elf;
  opponent: Elf;
  /** 我方全隊(含在場) */
  team: Elf[];
  activeIndex: number;
  /** 可用道具;沒有道具系統時傳 [] */
  items: BattleItem[];
  /** 是否允許切換(強制換場階段以外) */
  canSwitch: boolean;
  canUseItem: boolean;
  turnNumber: number;
}

/* ────────────────────────────────────────────────────────────
 * 3. 可調參數(集中管理,方便調難度;不要散在邏輯裡)
 * ──────────────────────────────────────────────────────────── */

export interface AIConfig {
  /** 0=保守 1=激進 */
  aggression: number;
  /** 0=不亂猜 1=常有隨機 */
  randomness: number;
  /** 允許的決策雜訊上限(分) */
  noise: number;
}

export const AI_DEFAULT: AIConfig = { aggression: 0.6, randomness: 0.15, noise: 8 };
export const AI_HARD: AIConfig = { aggression: 0.75, randomness: 0.03, noise: 2 };
export const AI_EASY: AIConfig = { aggression: 0.4, randomness: 0.45, noise: 22 };

/* ────────────────────────────────────────────────────────────
 * 4. 專屬特性 / 登場效果 提示表
 *    取代 v3 那串 `if (self.name === "鎮魂.巴弗洛")` 的硬寫啟發式。
 *    ★ 這是資料,不是邏輯 —— 新增精靈只需加一筆,不用改 AI。
 * ──────────────────────────────────────────────────────────── */

export interface ElfHint {
  /** 登場效果價值(0~100):越高越值得為了觸發它而切換上場 */
  entranceValue?: number;
  /** 登場效果說明(戰報用) */
  entranceNote?: string;
  /** 該精靈技能的情境加分 */
  skillHints?: Record<string, (c: AIContext, d: AIDeps) => { bonus: number; reason: string } | null>;
  /** 魂印讓它更耐打/更脆(影響換人與吃藥判斷) */
  bulkModifier?: number;
}

const anyBuff = (e: Elf) => Object.values(e.statStages || {}).some(v => (v as number) > 0);
const buffCount = (e: Elf) =>
  Object.values(e.statStages || {}).reduce((s: number, v) => s + ((v as number) > 0 ? (v as number) : 0), 0);
const anyDebuff = (e: Elf) => Object.values(e.statStages || {}).some(v => (v as number) < 0);
const hpRatio = survivalMargin;
// 估傷不足以穿透護盾／復活；回退只做保守斬殺判定，完整結果由推演確認。
const estimatedKO = (e: Elf, amount: number) => amount > 0 && e.currentHp > 0
  && !((e.deathImmunity?.deathImmuneTurns || 0) > 0)
  && !resolveDamageTransition(e.currentHp, e.maxHp, Math.max(0, amount - (e.shield || 0) - (e.barrier || 0)), 'non_true', e.survivalRule).alive;

/**
 * 精靈提示表。從 v3 的 if 鏈遷移而來,並補上登場效果價值。
 * 找不到的精靈會走通用評分 —— 不會像 v3 那樣「沒寫 if 就完全不懂」。
 */
export { AI_ELF_HINTS } from './hooks';

/* ────────────────────────────────────────────────────────────
 * 5. 局勢評估
 * ──────────────────────────────────────────────────────────── */

interface Threat {
  /** 對手預估對我造成的最大傷害 */
  incomingMax: number;
  /** 對手是否本回合可能 KO 我 */
  opponentCanKO: boolean;
  /** 我最好的技能預估傷害 */
  bestOutgoing: number;
  /** 我是否可 KO 對手 */
  selfCanKO: boolean;
}

function assess(c: AIContext, d: AIDeps): Threat {
  let incomingMax = 0;
  for (const sk of c.opponent.skills || []) {
    if (sk.category === "屬性") continue;
    if (!d.isSkillUsable(c.opponent, sk)) continue;
    try { incomingMax = Math.max(incomingMax, d.estimateDamage(c.opponent, c.self, sk)); } catch { /* ignore */ }
  }
  let bestOutgoing = 0;
  for (const sk of c.self.skills || []) {
    if (sk.category === "屬性") continue;
    if (!d.isSkillUsable(c.self, sk)) continue;
    try { bestOutgoing = Math.max(bestOutgoing, d.estimateDamage(c.self, c.opponent, sk)); } catch { /* ignore */ }
  }
  return {
    incomingMax,
    opponentCanKO: estimatedKO(c.self, incomingMax),
    bestOutgoing,
    selfCanKO: estimatedKO(c.opponent, bestOutgoing),
  };
}

/* ────────────────────────────────────────────────────────────
 * 6. 各行動評分
 * ──────────────────────────────────────────────────────────── */

function scoreSkills(c: AIContext, d: AIDeps, cfg: AIConfig, th: Threat): ScoredAction[] {
  const out: ScoredAction[] = [];
  const hints = elfHint(c.self)?.skillHints;

  (c.self.skills || []).forEach((skill, moveIndex) => {
    if (!d.isSkillUsable(c.self, skill)) return;

    let score = 50;
    let reason = "基礎出招";

    if (skill.category !== "屬性") {
      const dmg = (() => { try { return d.estimateDamage(c.self, c.opponent, skill); } catch { return 0; } })();
      const mult = d.getTypeMatchup(skill.type, c.opponent.type);

      // ★ 斬殺判定:v3 完全沒有。這是「更敏銳」最關鍵的一項。
      if (estimatedKO(c.opponent, dmg)) {
        score += 140;
        reason = `可直接擊敗【${c.opponent.name}】(預估 ${Math.round(dmg)} 傷害)`;
        if ((skill.priority || 0) > 0) { score += 25; reason += ",且先制搶殺"; }
      } else {
        // 以「佔對手當前體力比例」評估,比 v3 只看 power 準得多
        const ratio = c.opponent.currentHp > 0 ? dmg / c.opponent.currentHp : 0;
        score += Math.min(60, ratio * 100) * (0.6 + cfg.aggression * 0.6);
        if (mult > 1.5) { score += 45; reason = `屬性克制 ${mult}x,重擊【${c.opponent.name}】`; }
        else if (mult < 1.0) { score -= 30; reason = `屬性被抵抗(${mult}x),輸出偏低`; }
        else if (skill.power > 120) { score += 20; reason = "高威力核心大招"; }
      }

      // 對手可能先 KO 我 → 先制技加值
      if (th.opponentCanKO && (skill.priority || 0) > 0) {
        score += 45;
        reason += ";對手可能秒殺我,搶先出手";
      }
      // 對手已有護盾 → 純輸出略降
      if ((c.opponent.shield ?? 0) > 0) score -= 8;
    } else {
      // 屬性技:局勢好時鋪場,危急時別浪費回合(v3 對屬性技幾乎沒有判斷)
      score += 10;
      reason = "屬性技鋪場";
      if (th.opponentCanKO) { score -= 55; reason = "危急,不宜鋪場"; }
      if (th.selfCanKO) { score -= 70; reason = "可直接收人頭,不鋪場"; }
      if (anyBuff(c.self) && buffCount(c.self) >= 6) { score -= 20; reason = "自身增益已飽和"; }
      if (c.turnNumber <= 2) { score += 18; reason = "開局鋪場收益高"; }
    }

    // 專屬提示表(取代 v3 的 if 鏈)
    const h = hints?.[skill.name]?.(c, d);
    if (h) { score += h.bonus; reason = h.reason; }

    out.push({ action: { kind: "skill", skill, moveIndex }, score, reason });
  });

  return out;
}

function scoreSwitches(c: AIContext, d: AIDeps, cfg: AIConfig, th: Threat): ScoredAction[] {
  if (!c.canSwitch) return [];
  const out: ScoredAction[] = [];

  const selfWorstIncoming = th.incomingMax;
  const selfMult = d.getTypeMatchup(c.opponent.type, c.self.type); // 對手打我的倍率

  c.team.forEach((cand, index) => {
    if (index === c.activeIndex || cand.isExtra || checkElfDead(cand)) return;

    let score = 20; // 換人有一回合代價,基準分刻意低於出招
    const reasons: string[] = [];

    // 抗性:對手打候選人的倍率是否更低
    const candMult = d.getTypeMatchup(c.opponent.type, cand.type);
    if (candMult < selfMult) { score += (selfMult - candMult) * 40; reasons.push(`【${cand.name}】對其屬性抗性更佳`); }

    // 反打:候選人是否能克制對手
    let candBest = 0;
    for (const sk of cand.skills || []) {
      if (sk.category === "屬性") continue;
      if (!d.isSkillUsable(cand, sk)) continue;
      try { candBest = Math.max(candBest, d.estimateDamage(cand, c.opponent, sk)); } catch { /* ignore */ }
    }
    if (estimatedKO(c.opponent, candBest)) { score += 55; reasons.push("上場有斬殺機會"); }

    // 我快死 且 候選人能扛 → 換
    // ★ 必須用「對手打候選人」的傷害來算,不能沿用對當前精靈的 incomingMax ——
    //   候選人屬性/防禦不同,承受的傷害也不同(用錯會讓「換上抗性隊友」判斷失準)。
    if (th.opponentCanKO) {
      let candIncoming = 0;
      for (const sk of c.opponent.skills || []) {
        if (sk.category === "屬性") continue;
        if (!d.isSkillUsable(c.opponent, sk)) continue;
        try { candIncoming = Math.max(candIncoming, d.estimateDamage(c.opponent, cand, sk)); } catch { /* ignore */ }
      }
      const bulk = elfHint(cand)?.bulkModifier ?? 1;
      if (candIncoming < cand.currentHp * bulk) {
        score += 60;
        reasons.push("我方瀕危,換上可承受一擊者");
      }
      // 候選人也扛不住 → 換人只是換一隻死,別浪費健康戰力(v3/一般 AI 常犯的錯)
      else if (candIncoming >= cand.currentHp && hpRatio(cand) > hpRatio(c.self)) {
        score -= 40;
        reasons.push("(候選人同樣扛不住,換上去只是折損更健康的戰力)");
      }
    }

    // 我方陷入控制且無法作為 → 換人止血
    const st = d.getStatuses(c.self);
    const controlled = !abnormalSideEffectsSuppressed(c.self) && Object.keys(st).some(k => st[k] > 0 && d.isControlStatus(k));
    if (controlled) { score += 30; reasons.push("自身受控,換人止損"); }

    // 我方被弱化嚴重 → 換人洗掉
    if (anyDebuff(c.self) && !anyBuff(c.self)) { score += 22; reasons.push("自身能力被弱化,換人重置"); }

    // ★ 登場效果價值(v3 完全沒有這個維度)
    const hint = elfHint(cand);
    if (hint?.entranceValue) {
      score += hint.entranceValue * 0.5;
      reasons.push(hint.entranceNote ?? `【${cand.name}】登場效果有價值`);
    }

    // 反向抑制:自己狀態很好時不要亂換
    if (th.selfCanKO) score -= 80;
    if (anyBuff(c.self) && buffCount(c.self) >= 4) { score -= 45; reasons.push("(自身增益豐厚,換人會浪費)"); }
    if (selfWorstIncoming < c.self.currentHp * 0.2) score -= 25;

    out.push({
      action: { kind: "switch", index },
      score,
      reason: reasons.length ? reasons.join(";") : `換上【${cand.name}】`,
    });
  });

  return out;
}

function scoreItems(c: AIContext, d: AIDeps, cfg: AIConfig, th: Threat): ScoredAction[] {
  if (!c.canUseItem || !c.items?.length) return [];
  const out: ScoredAction[] = [];
  const hp = hpRatio(c.self);
  const st = d.getStatuses(c.self);
  const statusKeys = abnormalSideEffectsSuppressed(c.self) ? [] : Object.keys(st).filter(k => st[k] > 0);
  const controlled = statusKeys.some(k => d.isControlStatus(k));

  for (const item of c.items) {
    let score = 0;
    let reason = "";

    if (item.type === "hp" || item.type === "hybrid" || (item.type === "special" && item.value)) {
      const heal = item.value ?? 0;
      const missing = c.self.maxHp - c.self.currentHp;
      if (missing <= 0) continue;

      // 只在真的需要時吃,且不浪費大藥(溢療懲罰)
      const effective = itemRecoveryGain(c.self, heal);
      const marginGain = survivalMargin({...c.self, currentHp: c.self.currentHp + effective}) - hp;
      const waste = Math.max(0, heal - effective);
      score = effective > 0 ? 10 + marginGain * 90 - (waste / c.self.maxHp) * 45 : -100;

      if (hp < 0.35) { score += 45; reason = `體力僅剩 ${Math.round(hp * 100)}%,補血續戰`; }
      else if (hp < 0.6) { score += 12; reason = "中度受損,補血"; }
      else score -= 35;

      // ★ 吃藥不能防秒:對手能 KO 我且補完仍會死 → 這藥沒意義
      const afterHeal = resolveDamageTransition(c.self.currentHp + effective, c.self.maxHp, th.incomingMax, 'non_true', c.self.survivalRule);
      if (th.opponentCanKO && !afterHeal.alive) {
        score -= 70;
        reason = "補血也擋不住對手斬殺,不值得";
      } else if (th.opponentCanKO && afterHeal.alive) {
        score += 50;
        reason = "補血後可撐過對手攻擊";
      }
      // 我能一擊 KO 對手時別浪費回合吃藥
      if (th.selfCanKO) score -= 90;
    }

    if (item.effect === "clear_status" && statusKeys.length) {
      score += controlled ? 75 : 25;
      reason = controlled ? "解除控制類異常,恢復行動" : "清除異常";
      if (hp < 0.5) score += 20;
    }
    if (item.effect === "clear_debuff" && anyDebuff(c.self)) {
      score += 40;
      reason = "解除能力下降";
    }
    if (item.type === "pp") {
      const dry = (c.self.skills || []).filter(s => s.charge === undefined && (s.pp ?? 0) <= 0 && !d.isPpExempt?.(c.self, s)).length;
      const total = (c.self.skills || []).length || 1;
      if (dry / total >= 0.5) { score += 55; reason = "多數技能已無 PP,補充活力"; }
      else continue;
    }

    if (score > 0) out.push({ action: { kind: "item", item }, score, reason: reason || `使用【${item.name}】` });
  }

  return out;
}

/* ────────────────────────────────────────────────────────────
 * 7. 主入口
 * ──────────────────────────────────────────────────────────── */

/**
 * 選擇 AI 本回合的行動。純函式 —— 同 rng 種子下結果可重現(golden 測試友善)。
 *
 * @returns 最佳行動;若完全無可用行動則回傳 null(呼叫端應處理,不要當作技能 0)
 */
export function decideAction(
  c: AIContext, d: AIDeps, cfg: AIConfig = AI_DEFAULT
): ScoredAction | null {
  const candidates = scoreActions(c, d, cfg);
  if (!candidates.length) return null;

  // 決策雜訊:難度可調,且用注入的 rng(保持可重現)
  for (const cand of candidates) {
    cand.score += (d.rng() - 0.5) * 2 * cfg.noise;
  }
  candidates.sort((a, b) => b.score - a.score);

  // 隨機性:偶爾不選最優(擬人),但永遠不選負分行動
  if (cfg.randomness > 0 && candidates.length > 1 && d.rng() < cfg.randomness) {
    const pool = candidates.filter(x => x.score > 0).slice(0, 3);
    if (pool.length) return pool[Math.floor(d.rng() * pool.length)];
  }
  return candidates[0];
}

/** 推演排序／安全回退共用；不在此消耗隨機值。 */
export function scoreActions(c: AIContext, d: AIDeps, cfg: AIConfig = AI_DEFAULT): ScoredAction[] {
  const th = assess(c, d);
  return [...scoreSkills(c, d, cfg, th), ...scoreSwitches(c, d, cfg, th), ...scoreItems(c, d, cfg, th)];
}

/** 強制換場時的選擇(對手已陣亡/我方被打死後派誰上)。 */
export function decideForcedSwitch(c: AIContext, d: AIDeps): number {
  let best = -1, bestScore = -Infinity;
  c.team.forEach((cand, index) => {
    if (index === c.activeIndex || cand.isExtra || checkElfDead(cand)) return;
    let score = hpRatio(cand) * 40;
    score += (2 - d.getTypeMatchup(c.opponent.type, cand.type)) * 30; // 對手打它越弱越好
    let best2 = 0;
    for (const sk of cand.skills || []) {
      if (sk.category === "屬性") continue;
      if (!d.isSkillUsable(cand, sk)) continue;
      try { best2 = Math.max(best2, d.estimateDamage(cand, c.opponent, sk)); } catch { /* ignore */ }
    }
    if (estimatedKO(c.opponent, best2)) score += 50;
    score += (elfHint(cand)?.entranceValue ?? 0) * 0.4;
    if (score > bestScore) { bestScore = score; best = index; }
  });
  return best;
}

/** 給戰報用的決策說明。 */
export function describeAction(a: ScoredAction, self: Elf): string {
  switch (a.action.kind) {
    case "skill":  return `【${self.name}】選擇【${a.action.skill.name}】—— ${a.reason}`;
    case "switch": return `【${self.name}】決定換人 —— ${a.reason}`;
    case "item":   return `對手使用【${a.action.item.name}】—— ${a.reason}`;
  }
}
