import { getStatMultiplier } from "../utils/statCalculator";
/**
 * 通用技能描述執行器（無專屬註冊表 handler、無 kit 的技能使用）
 *
 * 原本的 parseAndExecuteTemplate 只會比對「第一個」符合的模板就 return，
 * 多段描述只執行第一句，且大量常見句型（自身能力提升、回復比例體力、
 * 百分比/比例固定傷害、條件式威力提升…）完全沒有對應，導致技能效果與描述不符。
 *
 * 這裡改成：
 *   1. 把描述切成子句（；。換行 ，）
 *   2. 每個子句拆「條件 + 本體」，條件可判定才執行
 *   3. 每個子句獨立比對規則，全部執行（不再只執行第一個）
 *   4. 無法辨識的子句以 console.warn 列出（部分技能由魂印 handler 依技能名處理，故不在戰鬥日誌提示）
 *
 * 注意：僅讀取描述文字，絕不修改描述文字本身。
 */
import { BattleEventContext } from "./types";
import { StatusRegistry } from "./statusRegistry";
import { TEMPLATE_EFFECTS, executeTemplateEffect } from "./templateEngine";
import { SOUL_MARK_HANDLED_SKILLS } from "./soulMarkHandledSkills";
import { prdPercent, prdChance } from "../utils/prd";
// 機率判定一律走偽隨機（每個「精靈 × 技能 × 效果位置」各自計數）
const chanceOf = (ctx: BattleEventContext, tag: string, percent: number) =>
  prdPercent(`${ctx.actor}:${ctx.self?.id}:${ctx.skill?.name ?? ""}:${tag}`, percent);


type Side = "p1" | "p2";

const STAT_KEY: Record<string, string> = {
  攻擊: "atk", 防禦: "def", 特攻: "spatk", 特防: "spdef", 速度: "speed", 命中: "accuracy", 全屬性: "all",
};
const STAT_WORD = "(?:全屬性|攻擊|防禦|特攻|特防|速度|命中)";

const STATUS_ALIAS: Record<string, string> = { 麻痹: "麻痺" };
const STATUS_DURATION: Record<string, number> = { 中毒: 3, 燒傷: 3, 寄生: 3, 凍傷: 3, 衰弱: 3 };

// ---------- 條件判定 ----------
interface EvalState {
  lastClearSuccess: boolean | null;
  lastTriggered?: boolean | null;
  doubleSelfBuff: boolean;
}

const hasAbnormal = (ctx: BattleEventContext, elf: any) => {
  const st = ctx.getStatuses ? ctx.getStatuses(elf) : {};
  return Object.values(st || {}).some((v: any) => (v as number) > 0);
};
const hasStage = (elf: any, positive: boolean) =>
  Object.values(elf?.statStages || {}).some((v: any) => typeof v === "number" && (positive ? v > 0 : v < 0));

/** 回傳 true/false = 可判定；undefined = 無法判定（視為未實裝） */
function evalCondition(cond: string, ctx: BattleEventContext, st: EvalState): boolean | undefined {
  const c = cond.replace(/^(若|如果|當回合|當)/, "").trim();
  const self = ctx.self, opp = ctx.target;
  if (/^先出手$/.test(c)) return ctx.goesFirst === true || ctx.moveIndex === 0;
  if (/^後出手$/.test(c)) return !(ctx.goesFirst === true || ctx.moveIndex === 0);
  if (/^(未觸發|若未觸發|該效果未觸發)$/.test(c)) return st.lastTriggered === false;
  if (/^(觸發成功|觸發)$/.test(c)) return st.lastTriggered === true;
  if (/^對[手方]不處於異常狀態$/.test(c)) return !hasAbnormal(ctx, opp);
  if (/^自身不處於異常狀態$/.test(c)) return !hasAbnormal(ctx, self);
  if (/^自身(?:當前)?體力(高於|大於)對[手方]$/.test(c)) return self.currentHp > opp.currentHp;
  if (/^(消除|吸取|複製|交換|解除)成功$/.test(c)) return st.lastClearSuccess ?? false;
  if (/^消除失敗$/.test(c)) return st.lastClearSuccess === false;
  if (/^對[手方]體力(小於|低於)(1\/2|一半)$/.test(c)) return opp.currentHp < opp.maxHp / 2;
  if (/^自身體力(小於|低於)(1\/2|一半)$/.test(c)) return self.currentHp < self.maxHp / 2;
  if (/^對[手方]體力(高於|大於)自身$/.test(c) || /^自身體力(低於|小於)對[手方]$/.test(c)) return opp.currentHp > self.currentHp;
  if (/^自身體力(高於|大於)對[手方]$/.test(c) || /^對[手方]體力(低於|小於)自身$/.test(c)) return self.currentHp > opp.currentHp;
  if (/^對[手方]處於異常狀態$/.test(c)) return hasAbnormal(ctx, opp);
  if (/^自身處於異常狀態$/.test(c)) return hasAbnormal(ctx, self);
  if (/^對[手方]處於能力提升狀態$/.test(c)) return hasStage(opp, true);
  if (/^對[手方]處於能力下降狀態$/.test(c)) return hasStage(opp, false);
  if (/^自身處於能力提升狀態$/.test(c)) return hasStage(self, true);
  if (/^自身處於能力下降狀態$/.test(c)) return hasStage(self, false);
  return undefined;
}

// ---------- 規則 ----------
interface Rule {
  re: RegExp;
  /** 允許用在含「N回合」的持續型子句 */
  multiTurn?: boolean;
  /** 回傳 false 代表比對到但判定為不適用（仍視為已實裝） */
  apply: (m: RegExpMatchArray, ctx: BattleEventContext, st: EvalState, clause: string) => void | false;
}

const roll = (ctx: BattleEventContext) => (ctx.rng ? ctx.rng() : Math.random());

const boostDamage = (ctx: BattleEventContext, mult: number, label: string) => {
  ctx.setPlayerState("skillDamageBoost", (ctx.getPlayerState("skillDamageBoost") || 1) * mult);
  ctx.addLog(`⚡ 【${label}】：本次傷害 ×${mult}！`, "effect");
};

const resetStages = (ctx: BattleEventContext, side: Side, pick: (v: number) => boolean): boolean => {
  const elf: any = side === ctx.actor ? ctx.self : ctx.target;
  const stages: Record<string, number> = { ...(elf.statStages || {}) };
  let changed = false;
  for (const k in stages) if (typeof stages[k] === "number" && pick(stages[k])) { stages[k] = 0; changed = true; }
  if (changed) ctx.updateElf(side, { statStages: stages as any });
  return changed;
};

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5 };
const num = (x: string) => (CN_NUM[x] ?? Number(x));

const RULES: Rule[] = [
  // ---- 持續型（N 回合）----
  {
    multiTurn: true,
    re: /(\d+)\s*回合(?:內)?免疫(並反彈)?(?:所有)?.*異常/,
    apply: (m, ctx) => {
      const n = Number(m[1]);
      ctx.setPlayerState(m[2] ? "reflectStatusTurns" : "immuneStatusTurns", n);
      ctx.addLog(`🛡️ 【異常${m[2] ? "反彈" : "免疫"}】：${n} 回合內${m[2] ? "免疫並反彈" : "免疫"}異常狀態！`, "effect");
    },
  },
  {
    multiTurn: true,
    re: /(\d+)\s*回合內(?:自身)?免疫能力下降/,
    apply: (m, ctx) => { ctx.setPlayerState("immuneStatDownTurns", Number(m[1])); ctx.addLog(`🛡️ 【免疫弱化】：${m[1]} 回合內免疫能力下降！`, "effect"); },
  },
  {
    multiTurn: true,
    re: /下\s*(\d+)\s*回合對[手方]受到(?:的)?(?:攻擊)?傷害(?:提升100%|翻倍)/,
    apply: (m, ctx) => { ctx.setOpponentState("damageTakenBoostTurns", Number(m[1]) + 1); ctx.addLog(`💢 【易傷】：下 ${m[1]} 回合對手受到的傷害翻倍！`, "effect"); },
  },
  {
    multiTurn: true,
    re: /下\s*(\d+)\s*回合(?:自身)?(?:造成的)?(?:攻擊)?傷害(?:提升100%|翻倍)$/,
    apply: (m, ctx) => { ctx.setPlayerState("dmgDoubleTurns", Number(m[1]) + 1); ctx.addLog(`⚔️ 【蓄力】：下 ${m[1]} 回合造成的傷害翻倍！`, "effect"); },
  },
  {
    multiTurn: true,
    re: /(\d+)\s*回合內對[手方](?:無法(?:通過自身技能)?恢復體力|體力恢復量(?:降低|下降)100%)/,
    apply: (m, ctx) => {
      // 用帶方位前綴的鍵：特質引擎每回合會遞減它（無前綴的 noHealTurns 沒人遞減，會變永久）
      ctx.setOpponentState(`${ctx.targetSide}_noHealTurns`, Number(m[1]));
      ctx.setOpponentState(`${ctx.targetSide}_noHealReason`, `【${ctx.skill?.name || "技能"}】禁療`);
      ctx.addLog(`🚫 【禁療】：${m[1]} 回合內對手無法恢復體力！`, "effect");
    },
  },
  {
    multiTurn: true,
    re: /(\d+)\s*回合內每回合(?:自身)?(?:使用技能)?吸取對[手方]最大體力(?:的)?\s*(\d+)\s*\/\s*(\d+)/,
    apply: (m, ctx) => {
      const turns = Number(m[1]);
      const amount = Math.floor((ctx.target.maxHp * Number(m[2])) / Number(m[3]));
      ctx.setOpponentState("hpLossPerTurnTurns", turns);
      ctx.setOpponentState("hpLossPerTurnAmount", amount);
      ctx.setPlayerState("hpHealPerTurnTurns", turns);
      ctx.setPlayerState("hpHealPerTurnAmount", amount);
      ctx.addLog(`🩸 【持續吸取】：${turns} 回合內每回合吸取對手 ${amount} 點體力！`, "effect");
    },
  },

  {
    // 對手 N 回合內：無法恢復體力／屬性技能無效／攻擊技能無效（可同時出現，以「且」連接）
    multiTurn: true,
    re: /對[手方]\s*(\d+)\s*回合內(.*(?:無法(?:通過自身技能)?恢復體力|體力恢復量(?:降低|下降)100%|屬性技能無效|攻擊技能無效).*)$|(\d+)\s*回合內對[手方](?:所有)?(.*(?:屬性技能無效|攻擊技能無效).*)$/,
    apply: (m, ctx) => {
      const n = Number(m[1] || m[3]);
      const what = m[2] || m[4] || "";
      const reason = `【${ctx.skill?.name || "技能"}】`;
      let any = false;
      if (/無法(?:通過自身技能)?恢復體力|體力恢復量(?:降低|下降)100%/.test(what)) {
        ctx.setOpponentState(`${ctx.targetSide}_noHealTurns`, n);
        ctx.setOpponentState(`${ctx.targetSide}_noHealReason`, `${reason}禁療`);
        any = true;
      }
      if (/屬性技能無效/.test(what)) {
        ctx.setOpponentState("utilitySkillInvalidTurns", n);
        ctx.setOpponentState("utilitySkillInvalidReason", reason);
        any = true;
      }
      if (/攻擊技能無效/.test(what)) {
        ctx.setOpponentState("attackSkillInvalidTurns", n);
        ctx.setOpponentState("attackSkillInvalidReason", reason);
        any = true;
      }
      if (!any) return false;
      ctx.addLog(`🚫 ${reason}：${n} 回合內對手${what}！`, "effect");
    },
  },
  {
    // N 回合內 X% 機率使對手的屬性技能失效
    multiTurn: true,
    re: /(\d+)\s*回合內\s*(\d+)%\s*(?:機率)?(?:使|令)對[手方](?:的)?屬性技能失效/,
    apply: (m, ctx) => {
      ctx.setOpponentState("utilityFailChanceTurns", Number(m[1]));
      ctx.setOpponentState("utilityFailChance", Number(m[2]) / 100);
      ctx.addLog(`🚫 ${m[1]} 回合內對手的屬性技能有 ${m[2]}% 機率失效！`, "effect");
    },
  },
  {
    // 下 N 回合自身（所有）（攻擊）技能先制 +K
    multiTurn: true,
    re: /下\s*(\d+)\s*回合(?:令)?(?:自身)?(?:令自身)?所有(攻擊)?技能先制\s*[+＋]\s*(\d+)/,
    apply: (m, ctx) => {
      ctx.setPlayerState("priorityBoostTurns", Number(m[1]) + 1);
      ctx.setPlayerState("priorityBoostValue", Number(m[3]));
      ctx.setPlayerState("priorityBoostAttackOnly", !!m[2]);
      ctx.addLog(`⚡ 【先制強化】：下 ${m[1]} 回合${m[2] ? "攻擊" : ""}技能先制 +${m[3]}！`, "effect");
    },
  },
  {
    // N 回合內自身受到的（單次）攻擊傷害不超過 X 點
    multiTurn: true,
    re: /(\d+)\s*回合內自身(?:體力)?受到(?:的)?(?:單次)?攻擊傷害不超過\s*(\d+)\s*點/,
    apply: (m, ctx) => {
      ctx.setPlayerState("incomingSkillDmgCapTurns", Number(m[1]));
      ctx.setPlayerState("incomingSkillDmgCap", Number(m[2]));
      ctx.addLog(`🛡️ 【傷害上限】：${m[1]} 回合內受到的攻擊傷害不超過 ${m[2]} 點！`, "effect");
    },
  },
  {
    // 下 N 回合自身攻擊技能必定令對手陷入某異常
    multiTurn: true,
    re: /下\s*(\d+)\s*回合自身(?:的)?攻擊(?:技能)?必定令對[手方](麻痺|中毒|燒傷|害怕|睡眠|冰封|石化|寄生|凍傷|混亂|衰弱|失明|疲憊)/,
    apply: (m, ctx) => {
      ctx.setPlayerState("attackInflictStatusTurns", Number(m[1]) + 1);
      ctx.setPlayerState("attackInflictStatus", STATUS_ALIAS[m[2]] || m[2]);
      ctx.addLog(`✨ 下 ${m[1]} 回合攻擊必定令對手${m[2]}！`, "effect");
    },
  },

  // ---- 單次 ----
  // 純描述／已由其他系統處理（先制值、必中在技能欄位上）
  { re: /^(必中|先制[+＋]?\d+|先制|__RAMP__)$/, apply: () => {} },
  // 條件式先制／必定命中在先制計算與命中判定時處理
  { re: /^先制\s*[+＋]\s*\d+(?:且必定命中)?$/, apply: () => {} },
  { re: /^(?:且)?必定命中$/, apply: () => {} },
  { re: /^先手攻擊$/, apply: () => {} },
  // 手下留情：在描述預掃描時設定，這裡只標記為已處理
  { re: /^(?:威力\d+\s*)?傷害大於對[方手](?:當前)?體力時$/, apply: () => {} },
  { re: /^(?:對[方手])?會?(?:餘下|保留)\s*1\s*點?體力$/, apply: () => {} },
  // 免疫下 N 次受到的攻擊
  {
    re: /免疫下\s*(\d+)\s*次(?:受到的)?攻擊/,
    apply: (m, ctx) => {
      ctx.setPlayerState("blockAttackCount", (ctx.getPlayerState("blockAttackCount") || 0) + Number(m[1]));
      ctx.addLog(`🛡️ 【免疫攻擊】：免疫下 ${m[1]} 次受到的攻擊！`, "effect");
    },
  },
  // 減少對手最大體力 a/b（百分比傷害）
  {
    re: /減少對[手方]最大體力(?:的)?\s*(\d+)\s*\/\s*(\d+)/,
    apply: (m, ctx) => ctx.applyPercentDamage(ctx.targetSide, Number(m[1]) / Number(m[2])),
  },
  { re: /(?:恢復|回復)自[身己]所有技能\s*(?:的)?\s*PP(?:值)?\s*([一二兩三四五\d]+)\s*點/i, apply: (m, ctx) => executeTemplateEffect("0051", [num(m[1])], ctx) },
  { re: /^(造成.{0,8}傷害|（?無特殊效果）?|威力\d+)$/, apply: () => {} },
  { re: /強化效果翻倍$/, apply: () => {} }, // 由預掃描處理

  // 威力／傷害倍率（通常搭配條件）
  { re: /(?:本技能)?威力加倍$/, apply: (_m, ctx) => boostDamage(ctx, 2, "威力加倍") },
  {
    re: /(?:本技能)?(?:威力|造成的?(?:攻擊)?傷害|傷害)提升\s*(\d+)%/,
    apply: (m, ctx, _st, clause) => {
      boostDamage(ctx, 1 + Number(m[1]) / 100, `傷害提升${m[1]}%`);
      if (/恢復等量體力/.test(clause)) ctx.setPlayerState("vampireRatio", 1);
    },
  },

  // 吸血
  { re: /(?:造成的?|給予對[手方])?(?:傷害|損傷)的\s*(\d+)%\s*(?:恢復|回復)自身(?:的)?體力/, apply: (m, ctx) => ctx.setPlayerState("vampireRatio", Number(m[1]) / 100) },
  { re: /(?:傷害|損傷)的一半會?(?:恢復|回復|回覆)自[身己]的?體力/, apply: (_m, ctx) => ctx.setPlayerState("vampireRatio", 0.5) },

  // 持續回復 / 持續固傷（N 回合內每回合…）
  {
    multiTurn: true,
    re: /(\d+)\s*回合內每回合(?:使用技能)?(?:恢復|回復)自身最大體力(?:的)?\s*(\d+)\s*\/\s*(\d+)/,
    apply: (m, ctx, _st, clause) => {
      const turns = Number(m[1]);
      const amount = Math.floor((ctx.self.maxHp * Number(m[2])) / Number(m[3]));
      ctx.setPlayerState("hpHealPerTurnTurns", turns);
      ctx.setPlayerState("hpHealPerTurnAmount", amount);
      ctx.addLog(`💚 【持續回復】：${turns} 回合內每回合恢復 ${amount} 點體力！`, "heal");
      if (/附加等量(?:固定|百分比)傷害|造成等量(?:固定|百分比)傷害/.test(clause)) {
        ctx.setOpponentState("hpLossPerTurnTurns", turns);
        ctx.setOpponentState("hpLossPerTurnAmount", amount);
      }
    },
  },

  // 單次回復
  {
    re: /(?:恢復|回復)自身\s*(?:最大體力(?:的)?)?\s*(\d+)\s*\/\s*(\d+)\s*(?:的)?(?:最大體力|體力)?/,
    apply: (m, ctx, _st, clause) => {
      if (/回合/.test(clause)) return;
      const amt = Math.floor((ctx.self.maxHp * Number(m[1])) / Number(m[2]));
      ctx.applyHeal(ctx.actor, amt);
      ctx.addLog(`💚 【回復】：恢復了 ${amt} 點體力！`, "heal");
    },
  },
  {
    re: /(?:恢復|回復)自身(?:最大體力(?:的)?)?\s*(\d+)%/,
    apply: (m, ctx) => {
      const amt = Math.floor((ctx.self.maxHp * Number(m[1])) / 100);
      ctx.applyHeal(ctx.actor, amt);
      ctx.addLog(`💚 【回復】：恢復了 ${amt} 點體力！`, "heal");
    },
  },
  { re: /(?:恢復|回復)(?:自身)?\s*(\d+)\s*點體力/, apply: (m, ctx) => ctx.applyHeal(ctx.actor, Number(m[1])) },

  // 固定傷害
  {
    re: /附加(?:對[手方])?最大體力(?:的)?\s*(\d+)\s*\/\s*(\d+)\s*(?:的)?固定傷害/,
    apply: (m, ctx) => ctx.applyFixedDamage(ctx.targetSide, Math.floor((ctx.target.maxHp * Number(m[1])) / Number(m[2])), "固定傷害"),
  },
  {
    re: /附加(?:對[手方])?最大體力(?:的)?\s*(\d+)%\s*(?:的)?固定傷害/,
    apply: (m, ctx) => ctx.applyFixedDamage(ctx.targetSide, Math.floor((ctx.target.maxHp * Number(m[1])) / 100), "固定傷害"),
  },
  {
    re: /(?:附加)?對[手方]當前體力(?:的)?\s*(\d+)\s*%\s*(?:的)?固定傷害/,
    apply: (m, ctx) => ctx.applyFixedDamage(ctx.targetSide, Math.floor((ctx.target.currentHp * Number(m[1])) / 100), "固定傷害"),
  },
  { re: /附加\s*(\d+)\s*點固定傷害/, apply: (m, ctx) => ctx.applyFixedDamage(ctx.targetSide, Number(m[1]), "固定傷害") },

  // 異常狀態
  {
    re: /(?:(\d+)%\s*(?:機率)?\s*)?(?:令|使)(?:對[手方])(?:陷入)?(麻痺|麻痹|中毒|燒傷|害怕|睡眠|冰封|石化|寄生|凍傷|混亂|衰弱|失明|疲憊|焚燼|詛咒|感染|束縛|流血)/,
    apply: (m, ctx, st) => {
      const chance = m[1] !== undefined ? Number(m[1]) : 100;
      const status = STATUS_ALIAS[m[2]] || m[2];
      if (!isStatusStatus(status)) return false;
      st.lastTriggered = false;
      if (!chanceOf(ctx, "L308", chance)) return;
      const res = ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, STATUS_DURATION[status] ?? 2);
      st.lastTriggered = !!res.success;
      if (res.success) ctx.addLog(`💫 【異常狀態】：使對手陷入了【${status}】！`, "status");
    },
  },

  // 能力等級（自身／對手／雙方）
  {
    re: new RegExp(
      `(?:(\\d+)%\\s*(?:機率)?\\s*)?(?:令|使|改變)?\\s*(自身|對手|對方|雙方)?\\s*(?:的)?\\s*(${STAT_WORD}(?:\\s*[、與和及]\\s*${STAT_WORD})*)\\s*(?:等級)?\\s*([+-]\\d+)`
    ),
    apply: (m, ctx, st, clause) => {
      const chance = m[1] !== undefined ? Number(m[1]) : 100;
      if (!chanceOf(ctx, "L322", chance)) return;
      const who = m[2] || (/(對手|對方)/.test(clause.slice(0, clause.indexOf(m[3]))) ? "對手" : "自身");
      const stats = m[3].split(/\s*[、與和及]\s*/).map(s => STAT_KEY[s]).filter(Boolean);
      let val = Number(m[4]);
      const sides: Side[] = who === "雙方" ? [ctx.actor, ctx.targetSide] : who === "自身" ? [ctx.actor] : [ctx.targetSide];
      for (const side of sides) {
        let v = val;
        if (side === ctx.actor && v > 0 && st.doubleSelfBuff) v *= 2;
        const changes: Record<string, number> = {};
        stats.forEach(k => (changes[k] = v));
        ctx.applyStatChange(side, changes);
      }
    },
  },

  // 閃避：N 回合內自身 100% 閃避對手所有攻擊
  {
    multiTurn: true,
    re: /(\d+)\s*回合內自身100%閃避對[手方](?:所有)?(?:的)?攻擊/,
    apply: (m, ctx) => { ctx.setPlayerState("evadeAttackTurns", Number(m[1])); ctx.addLog(`💨 【閃避】：${m[1]} 回合內閃避對手所有攻擊！`, "effect"); },
  },
  // 雙方同時進入異常
  {
    re: /(?:(\d+)%\s*)?(?:令|使)?(?:敵我)?雙方(?:同時)?(?:進入)?((?:麻痺|中毒|燒傷|害怕|睡眠|冰封|石化|寄生|凍傷|混亂|衰弱|失明|疲憊|流血|詛咒|凝滯)(?:、(?:麻痺|中毒|燒傷|害怕|睡眠|冰封|石化|寄生|凍傷|混亂|衰弱|失明|疲憊|流血|詛咒|凝滯))*)(?:異常)?(?:狀態)?$/,
    apply: (m, ctx) => {
      const chance = m[1] !== undefined ? Number(m[1]) : 100;
      if (!chanceOf(ctx, "L348", chance)) return;
      for (const status of m[2].split("、")) {
        if (!isStatusStatus(status)) continue;
        for (const side of [ctx.targetSide, ctx.actor] as Side[]) ctx.applyStatusWithImmunityCheck(side, status, STATUS_DURATION[status] ?? 2);
      }
      ctx.addLog(`💫 雙方陷入【${m[2]}】！`, "status");
    },
  },
  // 消除敵我雙方回合類效果／能力變化
  {
    re: /消除(?:敵我)?雙方(?:的)?回合類效果/,
    apply: (_m, ctx, st) => {
      const a = ctx.clearTurnEffectsOf(ctx.actor), b = ctx.clearTurnEffectsOf(ctx.targetSide);
      st.lastClearSuccess = a || b;
      ctx.addLog(`🧹 消除了雙方的回合類效果！`, "effect");
    },
  },
  {
    re: /消除(?:敵我)?雙方(?:的)?能力(?:上升|提升)、下降狀態/,
    apply: (_m, ctx, st) => {
      const a = resetStages(ctx, ctx.actor, v => v !== 0), b = resetStages(ctx, ctx.targetSide, v => v !== 0);
      st.lastClearSuccess = a && b;
      ctx.addLog(`🧹 消除了雙方的能力變化！`, "status");
    },
  },
  // 吸取／複製對手能力提升
  {
    re: /(雙倍)?(吸取|複製)對[手方](?:的)?能力提升(?:狀態)?/,
    apply: (m, ctx, st) => {
      const opp: any = ctx.target, me: any = ctx.self;
      const gains: Record<string, number> = {};
      let any = false;
      for (const k in (opp.statStages || {})) {
        const v = opp.statStages[k];
        if (typeof v === "number" && v > 0) { gains[k] = v * (m[1] ? 2 : 1); any = true; }
      }
      st.lastClearSuccess = any;
      if (!any) return;
      ctx.applyStatChange(ctx.actor, gains);
      if (m[2] === "吸取") resetStages(ctx, ctx.targetSide, v => v > 0);
      ctx.addLog(`✨ ${m[2]}了對手的能力提升！`, "status");
      void me;
    },
  },
  // PP 歸零
  {
    re: /令對[手方](?:所有)?(屬性|攻擊)?技能(?:的)?PP值歸(?:0|零)/,
    apply: (m, ctx) => {
      const skills = (ctx.target.skills || []).map((sk: any) => (!m[1] || (m[1] === "屬性" ? sk.category === "屬性" : sk.category !== "屬性")) ? { ...sk, pp: 0 } : sk);
      ctx.updateElf(ctx.targetSide, { skills });
      ctx.addLog(`⚡ 對手${m[1] || ""}技能 PP 歸零！`, "effect");
    },
  },
  {
    re: /(?:令)?對[手方]隨機\s*(\d+)\s*(?:個|項)(?:PP值不為0的)?技能(?:的)?PP值歸(?:0|零)/,
    apply: (m, ctx) => {
      const idx = (ctx.target.skills || []).map((sk: any, i: number) => ({ sk, i })).filter((x: any) => (x.sk.pp || 0) > 0);
      const pick = new Set<number>();
      while (pick.size < Math.min(Number(m[1]), idx.length)) pick.add(idx[Math.floor(roll(ctx) * idx.length)].i);
      const skills = (ctx.target.skills || []).map((sk: any, i: number) => pick.has(i) ? { ...sk, pp: 0 } : sk);
      ctx.updateElf(ctx.targetSide, { skills });
      ctx.addLog(`⚡ 對手隨機 ${pick.size} 個技能 PP 歸零！`, "effect");
    },
  },
  // 攻擊時不會出現微弱
  {
    re: /(?:攻擊時)?造成的傷害不會出現微弱/,
    apply: (_m, ctx) => ctx.setPlayerState("noResistedThisAction", true),
  },

  // 解除／消除
  {
    re: /(?:解除|清除)自身(?:的)?(?:所有)?能力下降/,
    apply: (_m, ctx) => { if (resetStages(ctx, ctx.actor, v => v < 0)) ctx.addLog(`🛡️ 【淨化】：解除了自身的能力下降狀態！`, "status"); },
  },
  {
    re: /消除對[手方](?:的)?(?:所有)?能力提升/,
    apply: (_m, ctx, st) => {
      const ok = resetStages(ctx, ctx.targetSide, v => v > 0);
      st.lastClearSuccess = ok;
      if (ok) ctx.addLog(`✨ 【消強】：消除了對手的能力提升狀態！`, "status");
    },
  },
  {
    re: /消除對[手方](?:的)?回合類效果/,
    apply: (_m, ctx, st) => {
      const ok = ctx.clearTurnEffectsOf(ctx.targetSide);
      st.lastClearSuccess = ok;
      if (ok) ctx.addLog(`🧹 【消除】：消除了對手的回合類效果！`, "effect");
    },
  },

  // 吸取
  {
    re: /吸取對[手方](?:最大體力(?:的)?\s*(\d+)\s*\/\s*(\d+)|最大體力(?:的)?\s*(\d+)%|\s*(\d+)\s*點(?:固定)?體力)/,
    apply: (m, ctx) => {
      const t = ctx.target;
      const amt = m[1] ? Math.floor((t.maxHp * Number(m[1])) / Number(m[2])) : m[3] ? Math.floor((t.maxHp * Number(m[3])) / 100) : Number(m[4]);
      ctx.applyAbsorb(ctx.targetSide, amt);
    },
  },

  // PP
  { re: /(?:降低|減少)對[手方]所有(?:技能)?PP\s*([一二兩三四五\d]+)\s*點/i, apply: (m, ctx) => executeTemplateEffect("0030", [num(m[1])], ctx) },
  { re: /(?:恢復|回復)自身所有(?:技能)?PP\s*([一二兩三四五\d]+)\s*點/i, apply: (m, ctx) => executeTemplateEffect("0051", [num(m[1])], ctx) },
  { re: /(?:減少|扣除)對[手方](?:所有)?(?:的)?技能\s*(\d+)\s*點\s*PP/i, apply: (m, ctx) => executeTemplateEffect("0030", [Number(m[1])], ctx) },
  { re: /(?:減少|扣除)對[手方](?:所有)?(?:的)?技能PP(?:值)?\s*(\d+)\s*點/i, apply: (m, ctx) => executeTemplateEffect("0030", [Number(m[1])], ctx) },
  { re: /(?:恢復|回復)自身所有技能\s*(?:的)?\s*PP(?:值)?\s*(\d+)\s*點/i, apply: (m, ctx) => executeTemplateEffect("0051", [Number(m[1])], ctx) },

  // 其他既有模板
  { multiTurn: true, re: /下回合(?:自身)?(?:的)?(?:技能|攻擊)?必定(?:致命一擊|暴擊)/, apply: (_m, ctx) => executeTemplateEffect("0080", [], ctx) },
  { re: /附加\s*(\d+)\s*點(?:傷害吸收)?護盾/, apply: (m, ctx) => executeTemplateEffect("0101", [Number(m[1])], ctx) },
  { re: /將自身能力下降狀態轉移給對[手方]/, apply: (_m, ctx) => executeTemplateEffect("0056", [], ctx) },
  {
    multiTurn: true,
    re: /(?:接下來|持續)\s*(\d+)\s*回合.*每回合(?:恢復|回復)\s*(\d+)\s*點體力/,
    apply: (m, ctx) => executeTemplateEffect("0008", [Number(m[1]), Number(m[2])], ctx),
  },
  {
    multiTurn: true,
    re: /(?:接下來|持續)\s*(\d+)\s*回合.*每回合.*對手受到\s*(\d+)\s*點固定傷害/,
    apply: (m, ctx) => executeTemplateEffect("0009", [Number(m[1]), Number(m[2])], ctx),
  },
];

// ---------- 切分 ----------
const CLAUSE_PREFIX = /^\s*(並且|並|且|同時|然後|命中後|技能使用後|使用後|使用時|技能命中時)\s*/;
/** 標準格式標記：◇攜帶 ■固有 🎯附加，> 為上一條的延伸說明 */
const LINE_MARKER = /^\s*(?:[▸◆◇■🎯•·-]\s*)*/u;

export function splitClauses(desc: string): string[] {
  const out: string[] = [];
  for (const rawLine of (desc || "").split(/\n/)) {
    let line = rawLine.replace(LINE_MARKER, "");
    const isSub = /^>/.test(line);
    line = line.replace(/^>+\s*/, "").replace(LINE_MARKER, "");
    // 全形括號內為補充說明（例如投石者時的變化），不作為獨立效果執行
    line = line.replace(/（[^）]*）/g, "");
    const parts = line.split(/[；;。]/).flatMap(p => (isSub ? [p] : p.split(/[，,]/)));
    for (let p of parts) {
      p = p.replace(CLAUSE_PREFIX, "").trim();
      // 「🎯附加當回合…」「🎯附加吸取…」的「附加」為標記用字
      p = p.replace(/^附加(?=當回合|若|吸取|對手|自身)/, "");
      if (p.length > 0) out.push(p);
    }
  }
  return out;
}

/** 拆出「條件…時 / 若…則 / X成功…」與本體 */
function splitCondition(clause: string): { cond?: string; body: string } {
  let m = clause.match(/^若(.+?)[，,]?則(.+)$/);
  if (m) return { cond: m[1], body: m[2] };
  m = clause.match(/^(.+?)則(.+)$/);
  if (m) return { cond: m[1], body: m[2] };
  m = clause.match(/^((?:消除|吸取|複製|交換|解除)成功|未觸發|觸發成功)(?:時|後)?(.+)$/);
  if (m) return { cond: m[1], body: m[2] };
  m = clause.match(/^(先出手|後出手)時(.+)$/);
  if (m) return { cond: m[1], body: m[2] };
  m = clause.match(/^(?:若|當回合|當)?(.+?(?:狀態|體力.{0,6}|異常))時(.+)$/);
  if (m) return { cond: m[1], body: m[2] };
  return { body: clause };
}

/** 含「N回合」「下回合」的持續型子句：只能套用 multiTurn 規則，避免把持續效果誤當單次效果 */
function isTurnClause(clause: string) {
  return /\d+\s*回合|下回合/.test(clause);
}

function isStatusStatus(status: string) {
  return !!(StatusRegistry as any)[STATUS_ALIAS[status] || status];
}

// ---------- 條件分類 ----------
const KNOWN_COND = /^(若|如果|當回合|當)?((?:消除|吸取|複製|交換|解除)成功|先出手|後出手|消除失敗|未觸發|若未觸發|該效果未觸發|觸發成功|觸發|對[手方]體力(小於|低於)(1\/2|一半)|自身體力(小於|低於)(1\/2|一半)|對[手方]體力(高於|大於)自身|自身體力(低於|小於)對[手方]|自身(當前)?體力(高於|大於)對[手方]|對[手方]體力(低於|小於)自身|(對[手方]|自身)(不)?處於(異常|能力提升|能力下降)狀態)$/;
/** 需等傷害結算後才能判定的條件 */
const AFTER_HIT_COND = /^(若)?(當回合)?(未)?(擊敗|擊倒)對[手方]$/;


// 「每次使用額外附加X點，最高Y點」「連續使用每次增加X%，最高Y%」：改寫上一條子句的數值
const RAMP_RE = /^(連續)?(?:使用)?每次(?:使用)?(?:額外附加|增加|提升)\s*(\d+)\s*(點|%)[，,]?\s*最高\s*(\d+)\s*(?:點|%)$/;
function applyRamps(ctx: BattleEventContext, clauses: string[], countUse: boolean): string[] {
  const out = clauses.slice();
  const name = ctx.skill?.name || "";
  const lastUsed = ctx.getPlayerState("lastSkillUsedName");
  const uses = ctx.getPlayerState(`skillUses:${name}`) || 0;
  const streak = lastUsed === name ? (ctx.getPlayerState(`skillStreak:${name}`) || 0) : 0;
  for (let i = 1; i < out.length; i++) {
    const m = out[i].match(RAMP_RE);
    if (!m) continue;
    const n = m[1] ? streak : uses;
    const inc = Number(m[2]), cap = Number(m[4]), unit = m[3];
    const numRe = unit === "%" ? /(\d+)(?=\s*%)/ : /(\d+)(?=\s*點)/;
    out[i - 1] = out[i - 1].replace(numRe, (v) => String(Math.min(cap, Number(v) + inc * n)));
    out[i] = "__RAMP__";
  }
  if (countUse) {
    ctx.setPlayerState(`skillUses:${name}`, uses + 1);
    ctx.setPlayerState(`skillStreak:${name}`, streak + 1);
    ctx.setPlayerState("lastSkillUsedName", name);
  }
  return out;
}

function ruleMatches(body: string, turnClause: boolean): Rule | null {
  for (const r of RULES) {
    if (turnClause && !r.multiTurn) continue;
    const m = body.match(r.re);
    if (!m) continue;
    if (r.re.source.includes("麻痺|麻痹") && m[2] && /令|使/.test(body) && !isStatusStatus(m[2])) continue;
    return r;
  }
  return null;
}

// ---------- 靜態分析（覆蓋率檢查用） ----------
export function analyzeSkillText(desc: string): { handled: string[]; unhandled: string[] } {
  const handled: string[] = [], unhandled: string[] = [];
  for (const clause of splitClauses(desc)) {
    if (RAMP_RE.test(clause)) { handled.push(clause); continue; }
    const { cond, body } = splitCondition(clause);
    if (cond && !KNOWN_COND.test(cond.trim()) && !AFTER_HIT_COND.test(cond.trim())) { unhandled.push(clause); continue; }
    (ruleMatches(body, isTurnClause(clause)) ? handled : unhandled).push(clause);
  }
  return { handled, unhandled };
}

// ---------- 執行 ----------
const warnedSkills = new Set<string>();

function canRunGeneric(ctx: BattleEventContext): boolean {
  const sk = ctx.skill;
  if (!sk) return false;
  if (sk.kit && sk.kit.length > 0) return false; // kit 由 effectRunner 執行，避免重複
  if (SOUL_MARK_HANDLED_SKILLS.has(sk.name)) return false; // 已由魂印 handler 依技能名處理
  if (ctx.getPlayerState("additionalEffectsSealed")) return false;
  return true;
}

function runClauses(ctx: BattleEventContext, phase: "main" | "afterHit"): { handled: number; unhandled: string[] } {
  const sk = ctx.skill;
  const clauses = applyRamps(ctx, splitClauses(sk.description || ""), phase === "main");
  const st: EvalState = { lastClearSuccess: null, lastTriggered: null, doubleSelfBuff: false };
  if (phase === "main") {
    // 預掃描：「…時強化效果翻倍」
    for (const c of clauses) {
      const m = c.match(/^(?:若)?(.+?)時強化效果翻倍$/);
      if (m && evalCondition(m[1], ctx, st)) st.doubleSelfBuff = true;
    }
    // 預掃描：手下留情
    if (/(?:對[方手])會?(?:餘下|保留)\s*1\s*點?體力/.test(sk.description || "")) ctx.setPlayerState("mercyThisAction", true);
  }
  let handled = 0;
  const unhandled: string[] = [];
  for (const clause of clauses) {
    const { cond, body } = splitCondition(clause);
    const isAfterHit = !!cond && AFTER_HIT_COND.test(cond.trim());
    if (phase === "afterHit" && !isAfterHit) continue;
    if (phase === "main" && isAfterHit) { handled++; continue; } // 留到傷害結算後
    if (cond) {
      let ok: boolean | undefined;
      if (isAfterHit) {
        const dead = (ctx.target?.currentHp ?? 1) <= 0;
        ok = /未/.test(cond) ? !dead : dead;
      } else {
        ok = evalCondition(cond, ctx, st);
      }
      if (ok === undefined) { unhandled.push(clause); continue; }
      if (!ok) { handled++; continue; }
    }
    const r = ruleMatches(body, isTurnClause(clause));
    if (!r) { unhandled.push(clause); continue; }
    let res: void | false = undefined;
    try { res = r.apply(body.match(r.re)!, ctx, st, body); } catch (e) { console.error("[genericSkillText]", sk.name, clause, e); }
    if (res === false) unhandled.push(clause); else handled++;
  }
  return { handled, unhandled };
}

export function executeGenericSkillText(ctx: BattleEventContext): void {
  const sk = ctx.skill;
  if (!sk) return;
  if (sk.templateId && TEMPLATE_EFFECTS[sk.templateId]) {
    executeTemplateEffect(sk.templateId, sk.templateArgs || [], ctx);
    return;
  }
  if (!canRunGeneric(ctx)) return;
  const { handled, unhandled } = runClauses(ctx, "main");
  // 自訂／AI 生成的技能：描述無法辨識時，改用結構化欄位 effectType / effectDetail
  if (handled === 0 && sk.effectDetail) applyEffectDetail(ctx);
  if (unhandled.length > 0 && !warnedSkills.has(sk.name)) {
    warnedSkills.add(sk.name);
    console.warn(`[技能效果未實裝] ${sk.name}：`, unhandled);
  }
}

/** 傷害結算後才判定的子句（擊敗／未擊敗對手則…） */
export function executeGenericSkillTextAfterHit(ctx: BattleEventContext): void {
  if (!ctx.skill || ctx.skill.templateId || !canRunGeneric(ctx)) return;
  runClauses(ctx, "afterHit");
}

// ---------- 結構化欄位（effectType / effectDetail） ----------
const DETAIL_STATUS: Record<string, string> = {
  paralyze: "麻痺", burn: "燒傷", poison: "中毒", fear: "害怕", sleep: "睡眠", freeze: "冰封", frozen: "冰封",
  confuse: "混亂", petrify: "石化", frostbite: "凍傷", parasite: "寄生", weaken: "衰弱", blind: "失明", tired: "疲憊", fatigue: "疲憊",
};
export function applyEffectDetail(ctx: BattleEventContext): boolean {
  const sk = ctx.skill;
  const detail = String(sk.effectDetail || "").trim();
  const type = String(sk.effectType || "");
  if (!detail || type === "none") return false;
  let done = false;
  for (const part of detail.split(/[,，;；\s]+/).filter(Boolean)) {
    let m = part.match(/^(atk|def|spatk|spdef|speed|accuracy|all)([+-]\d+)$/i);
    if (m) {
      const val = Number(m[2]);
      const toOpp = type === "stat_down" || (type !== "stat_up" && val < 0);
      ctx.applyStatChange(toOpp ? ctx.targetSide : ctx.actor, { [m[1].toLowerCase()]: val });
      done = true; continue;
    }
    m = part.match(/^heal:(\d+)%?$/i);
    if (m) { ctx.applyHeal(ctx.actor, Math.floor((ctx.self.maxHp * Number(m[1])) / 100)); done = true; continue; }
    m = part.match(/^(?:absorb|drain|vampire):(\d+)%?$/i);
    if (m) { ctx.setPlayerState("vampireRatio", Number(m[1]) / 100); done = true; continue; }
    m = part.match(/^double_damage:(\d+)%?$/i);
    if (m) { if (chanceOf(ctx, "L629", Number(m[1]))) boostDamage(ctx, 2, "傷害翻倍"); done = true; continue; }
    m = part.match(/^([a-z_]+):(\d+)%?$/i);
    if (m && DETAIL_STATUS[m[1].toLowerCase()]) {
      const status = DETAIL_STATUS[m[1].toLowerCase()];
      if (isStatusStatus(status) && chanceOf(ctx, "L633", Number(m[2]))) {
        if (ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, STATUS_DURATION[status] ?? 2).success) ctx.addLog(`💫 使對手陷入了【${status}】！`, "status");
      }
      done = true; continue;
    }
  }
  if (type === "mercy") { ctx.setPlayerState("mercyThisAction", true); done = true; }
  return done;
}

// ---------- 先制與命中 ----------
type StatusGetter = (e: any) => Record<string, number>;
const pseudoCtx = (self: any, target: any, getStatuses: StatusGetter): BattleEventContext =>
  ({ self, target, getStatuses } as any);

/** 條件式先制：「（當回合）(自身|對手)處於…狀態時先制+N（且必定命中）」 */
export function conditionalPriorityFromDescription(skill: any, self: any, opp: any, getStatuses: StatusGetter): number {
  if (!skill || SOUL_MARK_HANDLED_SKILLS.has(skill.name)) return 0;
  let bonus = 0;
  for (const clause of splitClauses(skill.description || "")) {
    const { cond, body } = splitCondition(clause);
    if (!cond) continue;
    const m = body.match(/^先制\s*[+＋]\s*(\d+)/);
    if (!m) continue;
    if (evalCondition(cond, pseudoCtx(self, opp, getStatuses), { lastClearSuccess: null, doubleSelfBuff: false })) bonus += Number(m[1]);
  }
  // 「先手攻擊」視為先制 +1（僅在技能欄位沒有先制值時）
  if (!skill.priority && splitClauses(skill.description || "").some(c => c === "先手攻擊")) bonus += 1;
  return bonus;
}

const ACC_TRAIT = (elf: any, name: string) => {
  const t = elf?.alienTraits || {};
  return t.generalTrait?.name === name || t.alienTrait?.name === name;
};

/**
 * 命中率（不擲骰）。技能基準命中率與「必中」是兩回事：
 * - 必中（固有效果）：不受閃避、命中下降影響；固有效果失效時改用基準命中率。
 * - 基準命中率（accuracy，100% ≠ 必中）：會被命中等級、混亂（攻擊技能 −80%）、易燃（攻擊技能 −30%）、閃避降低。
 * - 精準：與基準命中率乘法疊加（×1.14）；迴避：−14%。
 */
export function computeHitChance(actor: any, target: any, skill: any, getStatuses: StatusGetter, targetReg?: Record<string, any>): number {
  if (!skill || skill.name === "切換精靈" || skill.name === "使用道具") return 1;
  const inherentOff = !!actor?.isInherentInvalid; // 固有效果失效：必中不生效
  if (!inherentOff) {
    if (skill.isSureHit) return 1;
    const clauses = splitClauses(skill.description || "");
    if (clauses.some(c => c === "必中" || /^必中/.test(c))) return 1;
    for (const clause of clauses) {
      const { cond, body } = splitCondition(clause);
      if (/必定命中/.test(body)) {
        if (!cond || evalCondition(cond, pseudoCtx(actor, target, getStatuses), { lastClearSuccess: null, doubleSelfBuff: false })) return 1;
      }
    }
  }
  // 閃避對手所有攻擊（evadeAttackTurns，設在閃避方）：只對非必中技能有效
  if (skill.category !== "屬性" && (targetReg?.evadeAttackTurns || 0) > 0) return 0;
  let base = (typeof skill.accuracy === "number" ? skill.accuracy : 100) / 100;
  if (skill.category !== "屬性") {
    const st = getStatuses(actor) || {};
    if (st["混亂"]) base -= 0.8;   // 混亂：攻擊技能初始命中率降低80%（減法）
    if (st["易燃"]) base -= 0.3;   // 易燃：攻擊技能初始命中率降低30%（減法）
  }
  const stage = Math.max(-6, Math.min(6, actor?.statStages?.accuracy || 0));
  const mult = getStatMultiplier(stage, true); // 命中等級（下降採使用者規則表）
  let chance = Math.max(0, base) * mult;
  if (ACC_TRAIT(actor, "精準")) chance *= 1.14;
  if (ACC_TRAIT(target, "迴避")) chance -= 0.14;
  return Math.max(0, Math.min(1, chance));
}

/** 命中判定（偽隨機：以「未命中機率」計數，避免連續 MISS） */
export function rollSkillHit(actor: any, target: any, skill: any, getStatuses: StatusGetter, _rng: () => number, targetReg?: Record<string, any>): { hit: boolean; chance: number } {
  const chance = computeHitChance(actor, target, skill, getStatuses, targetReg);
  if (chance >= 1) return { hit: true, chance: 1 };
  if (chance <= 0) return { hit: false, chance: 0 };
  const miss = prdChance(`hit:${actor?.id}:${skill?.name}`, 1 - chance);
  return { hit: !miss, chance };
}

/** 描述開頭無條件的「先制+N」（技能欄位 priority 未設定時補上） */
export function priorityFromDescription(desc: string, skillName?: string): number {
  if (skillName && SOUL_MARK_HANDLED_SKILLS.has(skillName)) return 0;
  for (const c of splitClauses(desc)) {
    const m = c.match(/^先制\s*[+＋]\s*(\d+)$/);
    if (m) return Number(m[1]);
  }
  return 0;
}
