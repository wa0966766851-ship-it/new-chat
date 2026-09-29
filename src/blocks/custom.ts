// 專屬積木：描述中精靈獨有、通用積木表達不了的句子。
// key＝正規化後的子句原文（去掉 ■🎯> 標記），label＝積木上顯示的文字。
// run 以該精靈一方的 ctx 執行（self＝自身、target＝對手）。
import type { BattleEventContext } from "../effects/types";
import type { Trigger } from "./model";

export interface CustomRunState { last: boolean | null; lastAmount: number; event?: { trig: Trigger; data?: any } }
export interface CustomDef {
  label: string;
  run: (ctx: BattleEventContext, st: CustomRunState) => boolean | void;
  /** 覆寫所在段落的觸發時點（並忽略段落條件） */
  trig?: Trigger;
  /** 技能先制加成（先制計算時） */
  prio?: (self: any, opp: any) => number;
}

const opp = (ctx: BattleEventContext) => ctx.targetSide;
const statusCount = (ctx: BattleEventContext, e: any) => Object.values(ctx.getStatuses(e) || {}).filter((v: any) => (v as number) > 0).length;
const statusTurns = (ctx: BattleEventContext, e: any) => Object.values(ctx.getStatuses(e) || {}).reduce((a: number, v: any) => a + ((v as number) > 0 ? (v as number) : 0), 0);
const stages = (e: any, pick: (v: number) => boolean) => Object.entries(e?.statStages || {}).filter(([, v]) => typeof v === "number" && pick(v as number)) as [string, number][];
const addMarkCount = (ctx: BattleEventContext, side: "p1" | "p2", id: string, name: string, n: number, extra: Record<string, any> = {}) => {
  const cur = (ctx.getMarks(side) || []).find((m: any) => m.id === id);
  const maxCount = extra.maxCount ?? cur?.maxCount;
  const count = Math.min(maxCount ?? Number.POSITIVE_INFINITY, (cur?.count || 0) + n);
  ctx.setMark({
    ...cur,
    ...extra,
    id,
    name,
    count,
    displayChar: extra.displayChar || cur?.displayChar || name[0],
    description: extra.description || cur?.description || name,
    effects: { ...(cur?.effects || {}), ...(extra.effects || {}) },
  } as any, side);
};

export const CUSTOM: Record<string, CustomDef> = {
  // ───────── 5008 鎮魂·巴弗洛 ─────────
  "持有者回合結束時，每有1道令自身體力調整減少最大體力25%": {
    label: "魂殤：回合結束每道體力調整 -25%最大體力",
    // 真正結算集中於 runHolderMarks 讀取印記 metadata，這裡只負責讓描述與積木一一對應。
    run: () => true,
  },
  "上限4道，下場後消失": {
    label: "魂殤：上限4道／下場清除",
    // 上限由 normalizeMark、下場清除由換場流程統一處理。
    run: () => true,
  },
  "每回合開始時為敵方在場精靈附加1道魂殤": {
    label: "敵方在場精靈 +1 魂殤",
    run: (ctx) => {
      addMarkCount(ctx, opp(ctx), "blk_魂殤", "魂殤", 1, {
        unit: "道",
        maxCount: 4,
        clearable: false,
        persistsOffField: false,
        triggerNode: "round_end",
        polarity: "negative",
        description: "上限4道；回合結束時每道令持有者體力調整減少最大體力的25%；下場後消失。",
        effects: { hpAdjustmentMaxHpRatioPerStack: 0.25 },
      });
      const stacks = (ctx.getMarks(opp(ctx)) || []).find((m: any) => m.id === "blk_魂殤")?.count || 0;
      ctx.addLog(`👻 為【${ctx.target?.name}】附加 1 道魂殤（目前 ${stacks}/4 道）！`, "effect");
      return true;
    },
  },
  "直到上述異常結束前自身抵擋受到的技能傷害": {
    label: "直到該異常結束前 抵擋【技能傷害】",
    run: (ctx, st) => {
      const turns = Number(st.event?.data?.duration || 2);
      ctx.addTimerTo(ctx.actor, { id: `blk_${ctx.actor}_baphomet_block`, name: "抵擋技能傷害", kind: "round_counter", source: "soulmark" as any, remaining: turns, tickAt: "round_end", payload: { block: { blockSkillDmg: true, owner: ctx.actor, src: "鎮魂.巴弗洛" } } } as any, false);
      return true;
    },
  },
  "自身受到異常時立即轉化為混亂": {
    label: "自身受到異常 → 轉化為混亂",
    trig: "status_received",
    run: (ctx, st) => {
      const s = st.event?.data?.status;
      if (!s || s === "混亂" || st.event?.data?.side !== ctx.actor) return false;
      const e: any = ctx.self;
      const effects = (e.effects || []).filter((x: any) => x.id !== s);
      ctx.updateElf(ctx.actor, { effects } as any);
      ctx.applyStatusWithImmunityCheck(ctx.actor, "混亂", Number(st.event?.data?.duration || 2));
      ctx.addLog(`🌀 【${e.name}】的【${s}】轉化為【混亂】！`, "status");
      return true;
    },
  },
  "對手3回合內造成固定傷害、百分比傷害減少40%": {
    label: "對手3回合 造成【固定/百分比傷害】-40%",
    run: (ctx) => {
      ctx.addTimerTo(opp(ctx), { id: `blk_${opp(ctx)}_baphomet_fp`, name: "固定/百分比傷害-40%", kind: "round_counter", source: "soulmark" as any, remaining: 3, tickAt: "round_end", payload: { block: { dmgOutReduce: 0.4, kinds: ["fixed", "percent"], owner: opp(ctx) } } } as any, false);
      return true;
    },
  },
  "若自身處於異常狀態，附加對手等同於自身通過專屬特性抵擋的傷害100%的真實傷害": {
    label: "若自身異常：【真實傷害】＝魂印抵擋量 100%",
    run: (ctx) => {
      if (!statusCount(ctx, ctx.self)) return false;
      const amt = ctx.getPlayerState("blkBlockedBySoul") || 0;
      if (amt <= 0) return false;
      ctx.applyTrueDamage(opp(ctx), amt, "魂印抵擋反饋");
      ctx.setPlayerState("blkBlockedBySoul", 0);
      return true;
    },
  },
  "若自身不處於異常狀態，自身下回合所有技能先制+1": {
    label: "若自身無異常：下回合先制 +1",
    run: (ctx) => {
      if (statusCount(ctx, ctx.self)) return false;
      ctx.setPlayerState("priorityBoostTurns", 2); ctx.setPlayerState("priorityBoostValue", 1); ctx.setPlayerState("priorityBoostAttackOnly", false);
      return true;
    },
  },
  "消除雙方回合類效果、能力上升、下降狀態、護盾與護罩並附加對手等同於自身速度值50%的百分比傷害": {
    label: "消除雙方回合類/能力變化/護盾護罩；【百分比傷害】自身速度 50%",
    run: (ctx) => {
      for (const s of [ctx.actor, opp(ctx)] as ("p1" | "p2")[]) {
        ctx.clearTurnEffectsOf(s);
        const e: any = s === ctx.actor ? ctx.self : ctx.target;
        ctx.updateElf(s, { statStages: Object.fromEntries(Object.keys(e.statStages || {}).map(k => [k, 0])), shield: 0, barrier: 0 } as any);
      }
      const spd = (ctx.self as any).calculatedStats?.speed || 0;
      ctx.applyPinkDamage(opp(ctx), Math.floor(spd * 0.5), "百分比傷害", undefined, undefined, "percent");
      return true;
    },
  },
  "3回合內對手PP值消耗量提升20倍且戰鬥階段結束時受到已損失PP值*10點固定傷害": {
    label: "3回合 對手PP消耗×20；戰鬥階段結束受【固定傷害】已損失PP×10",
    run: (ctx) => {
      ctx.addTimerTo(opp(ctx), { id: `blk_${opp(ctx)}_suohun_pp`, name: "PP消耗×20", kind: "turn_effect", source: "skill" as any, remaining: 3, tickAt: "round_end", payload: { block: { ppMult: 20, owner: opp(ctx), src: "鎖魂曲", trig: "phase_end", body: [{ acts: [{ op: "custom", p: { key: "__lostpp_fixed10" }, label: "已損失PP×10 固定傷害" }] }] } } } as any, ctx.moveIndex === 1);
      return true;
    },
  },
  "__lostpp_fixed10": {
    label: "受到【固定傷害】已損失PP×10",
    run: (ctx) => {
      const e: any = ctx.self;
      const lost = (e.skills || []).reduce((a: number, k: any) => a + Math.max(0, (k.maxPp ?? k.pp ?? 0) - (k.pp ?? 0)), 0);
      if (lost <= 0) return false;
      ctx.applyFixedDamage(ctx.actor, lost * 10, "鎖魂曲");
      return true;
    },
  },
  "先出手則自身下次死亡時100%重生": {
    label: "先出手：下次死亡時重生",
    run: (ctx) => {
      if (!(ctx.goesFirst === true || ctx.moveIndex === 0)) return false;
      ctx.addTimerTo(ctx.actor, { id: `blk_${ctx.actor}_rebirth`, name: "重生", kind: "use_counter", source: "skill" as any, remaining: 1, tickAt: "never", payload: { block: { rebirth: true, owner: ctx.actor } } } as any, false);
      ctx.addLog(`✨ 下次死亡時將重生！`, "effect");
      return true;
    },
  },
  "附加給對手等同於自身能力提升狀態的能力下降狀態，若該效果未滿足條件或未觸發則令對手隨機2項技能PP值歸零": {
    label: "對手能力下降＝自身能力提升；否則對手隨機2技能PP歸0",
    run: (ctx) => {
      const ups = stages(ctx.self, v => v > 0);
      if (ups.length) { ctx.applyStatChange(opp(ctx), Object.fromEntries(ups.map(([k, v]) => [k, -v]))); return true; }
      const e: any = ctx.target; const idx = (e.skills || []).map((k: any, i: number) => i).filter((i: number) => (e.skills[i].pp || 0) > 0);
      const r = ctx.rng || Math.random; const pick = new Set<number>();
      while (pick.size < Math.min(2, idx.length)) pick.add(idx[Math.floor(r() * idx.length)]);
      ctx.updateElf(opp(ctx), { skills: e.skills.map((k: any, i: number) => pick.has(i) ? { ...k, pp: 0 } : k) });
      return true;
    },
  },
  "技能威力提升35%，對手任意1項技能PP值小於2點則提升效果加倍": {
    label: "本次【攻擊傷害】+35%（對手有技能PP<2時 +70%）",
    run: (ctx) => {
      const low = ((ctx.target as any).skills || []).some((k: any) => (k.pp ?? 0) < 2);
      ctx.setPlayerState("skillDamageBoost", (ctx.getPlayerState("skillDamageBoost") || 1) * (low ? 1.7 : 1.35));
      return true;
    },
  },
  "敵我雙方同時進入混亂、流血狀態，觸發成功則雙方每有1回合異常狀態則吸取對手150點固定體力": {
    label: "雙方混亂、流血；成功則每1回合異常吸取150",
    run: (ctx) => {
      let ok = false;
      for (const s of ["混亂", "流血"]) for (const side of [opp(ctx), ctx.actor] as ("p1" | "p2")[]) ok = ctx.applyStatusWithImmunityCheck(side, s, s === "流血" ? 3 : 2).success || ok;
      if (!ok) return false;
      const turns = statusTurns(ctx, ctx.self) + statusTurns(ctx, ctx.target);
      if (turns > 0) ctx.applyAbsorb(opp(ctx), 150 * turns);
      return true;
    },
  },
};

// ───────── 5007 混濁海妖·布林克克：深潛者盛宴 ─────────
Object.assign(CUSTOM, {
  "自身處於能力下降狀態時先制+3且使用技能不受PP值限制、將自身任意能力下降狀態視為至少2倍同等級的全屬性能力提升": {
    label: "自身能力下降時：先制+3、不受PP限制、下降視為2倍同級全屬性提升",
    prio: (self: any) => Object.values(self?.statStages || {}).some((v: any) => typeof v === "number" && v < 0) ? 3 : 0,
    run: (ctx: BattleEventContext) => {
      const downs = Object.values((ctx.self as any).statStages || {}).filter((v: any) => typeof v === "number" && v < 0) as number[];
      if (!downs.length) return false;
      const lvl = Math.min(6, 2 * Math.max(...downs.map(v => -v)));
      ctx.setPlayerState("blkStageAsBoost", lvl);
      ctx.addLog(`🌊 能力下降視為全屬性 +${lvl}！`, "effect");
      return true;
    },
  },
  "自身下2次技能無效時令本次技能額外造成對手當前體力¼的水系技能傷害且令對手100%漸凍1回合": {
    label: "下2次自身技能無效時：【水系技能傷害】對手當前體力¼、對手漸凍1回合",
    run: (ctx: BattleEventContext) => {
      ctx.addTimerTo(ctx.actor, { id: `blk_${ctx.actor}_brinkk_invalid`, name: "技能無效追擊", kind: "use_counter", source: "skill" as any, remaining: 2, tickAt: "never", payload: { block: { trig: "self_invalid", consumeOnFire: true, owner: ctx.actor, body: [{ acts: [{ op: "custom", p: { key: "__brinkk_invalid_hit" }, label: "" }] }] } } } as any, false);
      return true;
    },
  },
  "__brinkk_invalid_hit": {
    label: "【水系技能傷害】對手當前體力¼＋漸凍1回合",
    run: (ctx: BattleEventContext) => {
      ctx.applySkillTypeDamage(ctx.targetSide, Math.floor((ctx.target as any).currentHp / 4), "深潛者盛宴", { elem: "水" });
      ctx.applyStatusWithImmunityCheck(ctx.targetSide, "漸凍", 1);
      return true;
    },
  },
  "造成傷害時取水系、混沌系、水.混沌、普通系中克制倍數最高者，未擊敗對手則延續至自身下2次自身造成技能傷害": {
    label: "克制倍數取 水／混沌／水.混沌／普通 最高者（未擊敗則延續2次）",
    trig: "use",
    run: (ctx: BattleEventContext) => { ctx.setPlayerState("blkTypeOverride", ["水", "混沌", "水.混沌", "普通"]); ctx.setPlayerState("blkTypeOverrideUses", 1); ctx.setPlayerState("blkTypeOverrideExtend", 2); return true; },
  },
  "吸取對手300點體力，雙方每處於1種能力等級提升/下降狀態則額外吸取前額外吸取對手40點，吸取後任意1次對手體力未因此減少則額外汲取對手當前體力¼": {
    label: "吸取300；雙方每1種能力變化再吸取40（獨立）；任一次未減少則汲取對手當前體力¼",
    run: (ctx: BattleEventContext) => {
      const cnt = [ctx.self, ctx.target].reduce((a: number, e: any) => a + Object.values(e?.statStages || {}).filter((v: any) => typeof v === "number" && v !== 0).length, 0);
      let miss = false;
      for (const amt of [...Array(cnt).fill(40), 300]) {
        const dealt = ctx.applyTrueDamage(ctx.targetSide, amt, "吸取");
        if (!dealt) miss = true; else ctx.applyHeal(ctx.actor, dealt);
      }
      if (miss) ctx.applyAbsorb(ctx.targetSide, Math.floor((ctx.target as any).currentHp / 4));
      return true;
    },
  },
} as Record<string, CustomDef>);

// ───────── 5001 悲歌.索比拉特 / 5002 帝皇之盾（疑慮清單 A1/A2 對齊用） ─────────
// 原則：只補積木解析，不刪除 SOBIRAT_SKILLS / IMPERIAL_SHIELD_SKILLS 舊 handler。
Object.assign(CUSTOM, {
  "以令下次被擊敗時黯痕回合數+1": {
    label: "下次被擊敗時【黯痕】回合數+1（可疊加，觸發清空）",
    run: (ctx: BattleEventContext) => {
      // 最終規格 A1-1：使用成功即掛待觸發層數，可疊加；被擊敗結算時消耗清空。
      // 舊 sobiratScarBonus 保留為同一計數器，不另立新鍵，避免雙軌。
      ctx.setPlayerState("sobiratScarBonus", (ctx.getPlayerState("sobiratScarBonus") || 0) + 1);
      ctx.addLog(`🎡【黯】：下次被擊敗時【黯痕】回合數+1（待觸發 ${(ctx.getPlayerState("sobiratScarBonus") || 0)} 層）！`, "effect");
      return true;
    },
  },
  "若對手因此被擊敗則自身保留1點體力": {
    label: "若本擊擊敗對手則自身保留1點體力",
    run: (ctx: BattleEventContext, st) => {
      // 疑慮 A1-2：after_hit kill 條件，僅在本擊造成擊敗時生效
      if (st.event?.trig !== "after_hit") return false;
      if ((ctx.target?.currentHp ?? 1) > 0) return false;
      ctx.updateElf(ctx.actor, { currentHp: Math.max(1, ctx.self.currentHp) } as any);
      ctx.addLog(`🎡【影之牢籠】：同歸未死，保留1點體力！`, "effect");
      return true;
    },
  },
  "3回合內自身使用攻擊技能時若攻擊技能無效則消除對手回合類效果": {
    label: "3回合 自身攻擊無效時消除對手回合類效果",
    run: (ctx: BattleEventContext) => {
      // 疑慮 A1-3：掛 self_invalid 追擊（仿深潛者盛宴），與舊 sobiratDispelOnFailedTurns 並存
      ctx.addTimerTo(ctx.actor, { id: `blk_${ctx.actor}_sobirat_invalid`, name: "攻擊無效消回合", kind: "use_counter", source: "skill" as any, remaining: 3, tickAt: "never", payload: { block: { trig: "self_invalid", consumeOnFire: true, owner: ctx.actor, body: [{ acts: [{ op: "custom", p: { key: "__sobirat_invalid_hit" }, label: "" }] }] } } } as any, false);
      return true;
    },
  },
  "__sobirat_invalid_hit": {
    label: "攻擊無效：消除對手回合類效果",
    run: (ctx: BattleEventContext) => { ctx.clearTurnEffectsOf(ctx.targetSide); ctx.addLog(`🎡【幽冥噬魂】：攻擊無效，消除對手回合類效果！`, "effect"); return true; },
  },
  "__baptism_invalid_hit": {
    label: "洗禮無效重結算：粉傷補償（保底280）",
    run: (ctx: BattleEventContext) => {
      // B方案：只有本次無效的是淨世洗禮頌才結算；否則不消耗 timer（consumeOnFire:false），留給同回合後續。
      // emitSelfInvalid 觸發時的 ctx.skill 即為被無效的已選技能，无需额外字段。
      if ((ctx.skill as any)?.name !== "淨世洗禮頌") return false;
      // 快照的 HP% 翻倍次數（handler 第一行存的）；取不到則按當下 HP 現算。
      let doubles = ctx.getPlayerState("holyMiles.baptismDoubles");
      if (typeof doubles !== "number") {
        const t: any = ctx.target;
        const ratio = t?.maxHp > 0 ? t.currentHp / t.maxHp : 0;
        doubles = Math.min(10, Math.floor(ratio * 10 + 1e-9));
      }
      const times = 1 + (doubles || 0); // 無效翻倍1次 ＋ HP%額外
      // base：取本次技能基礎。管線外重算拿不到 stage1，用「保底280為下限、按威力90等比放大」：
      // 先以 280 為基底乘翻倍鏈，保證無效時至少打出保底；正常管線的攻防加成在無效補償中不重算（粉傷通道）。
      const amount = Math.max(280, Math.floor(280 * 2 ** Math.min(times, 6)));
      const dealt = ctx.applyPinkDamage(ctx.targetSide, amount, "淨世洗禮頌(無效補償)", undefined, undefined, "percent");
      ctx.applyHeal(ctx.actor, dealt > 0 ? dealt : amount);
      ctx.addLog(`🌊【淨世洗禮頌】：技能無效，重新結算 ${times} 次翻倍補償 ${amount} 點技能傷害（保底280）！`, "effect");
      ctx.consumeTimer?.(ctx.actor, `blk_${ctx.actor}_baptism_invalid`);
      return true;
    },
  },
  "4回合內每回合使用技能後恢復自身最大體力1/3，並將恢復量的50%轉化為護盾": {
    label: "4回合 使用技能後恢復最大體力1/3，50%轉護盾",
    run: (ctx: BattleEventContext) => {
      // 疑慮 A2-1：按 self_skill 觸發（與舊 AFTER_ACTION 語義對齊到積木時點）
      ctx.addTimerTo(ctx.actor, { id: `blk_${ctx.actor}_emperor_wall`, name: "帝壁恢復轉盾", kind: "turn_effect", source: "skill" as any, remaining: 4, tickAt: "round_end", payload: { block: { trig: "self_skill", owner: ctx.actor, body: [{ acts: [{ op: "custom", p: { key: "__emperor_wall_hit" }, label: "" }] }] } } } as any, false);
      return true;
    },
  },
  "__emperor_wall_hit": {
    label: "恢復最大體力1/3，50%轉護盾",
    run: (ctx: BattleEventContext) => {
      const amt = Math.floor((ctx.self as any).maxHp / 3);
      ctx.applyHeal(ctx.actor, amt);
      ctx.applyShield(ctx.actor, Math.floor(amt * 0.5));
      return true;
    },
  },
  "消耗自身全部護盾值，每消耗100點護盾值令對手隨機1個技能PP歸零": {
    label: "消耗全部護盾；每100點對手隨機1技能PP歸零（可重複命中）",
    run: (ctx: BattleEventContext) => {
      // 最終規格 A2-2：快照護盾後清零，按 floor(shield/100) 執行 N 次隨機 PP 歸零，可重複命中同一招。
      // 與舊 handler（splice 去重＝不可重複）不同，此處以「可重複」為準；舊 handler 保留不刪。
      const cur = (ctx.self as any).shield || 0;
      ctx.updateElf(ctx.actor, { shield: 0 } as any);
      const n = Math.floor(cur / 100);
      if (n <= 0) return false;
      const skills: any[] = [...(ctx.target?.skills || [])];
      const idx = skills.map((s, i) => i).filter((i) => (skills[i].pp || 0) > 0);
      if (!idx.length) return false;
      const r = ctx.rng || Math.random;
      // 可重複：執行 N 次，每次從 idx 獨立隨機（允許重複命中同一 index）
      const hit: number[] = [];
      for (let k = 0; k < n; k++) hit.push(idx[Math.floor(r() * idx.length)]);
      const distinct = new Set<number>(hit);
      ctx.updateElf(ctx.targetSide, { skills: skills.map((s, i) => (distinct.has(i) ? { ...s, pp: 0 } : s)) } as any);
      ctx.addLog(`🛡️【盾碎同歸】：消耗 ${cur} 護盾，執行 ${n} 次隨機PP歸零（命中 ${distinct.size} 個不同技能）！`, "effect");
      return distinct.size > 0;
    },
  },
  "消耗護盾值為0時自身全屬性+2且下回合先制+3": {
    label: "結算後護盾為0時：全屬性+2、下回合先制+3",
    run: (ctx: BattleEventContext) => {
      // 最終規格 A2-3：以結算後護盾為 0 才觸發（舊 handler 以使用前為 0，保留不刪）。
      // 盾碎同歸的上一子句已清零護盾，此處檢查當前值即為結算後值。
      if (((ctx.self as any).shield || 0) > 0) return false;
      ctx.applyStatChange(ctx.actor, { atk: 2, def: 2, spatk: 2, spdef: 2, speed: 2, accuracy: 2 });
      ctx.setPlayerState("emperorNextTurnPriorityBoost3", true);
      return true;
    },
  },
} as Record<string, CustomDef>);

/** sobiratScarBonus ROUND_END 清空：防止跨回合累積 */
export const CUSTOM_SOBIRAT_ROUND_END: Record<string, CustomDef> = {
  "每回合結束時重設 sobiratScarBonus": {
    label: "黯痕計數器回合結束重置",
    run: (ctx: BattleEventContext) => {
      ctx.setPlayerState("sobiratScarBonus", 0);
      return true;
    },
  },
};

/** 魂印標頭（觸發時點）專屬對應 */
export const CUSTOM_HEADERS: Record<string, { trig: Trigger; label: string; statuses?: string[] }> = {
  "若自身存活於出戰背包內或在場": { trig: "team_round_start" as Trigger, label: "存活於背包或在場・回合開始時" },
  "雙方任一方受到混亂異常、窒息異常時": { trig: "any_status" as Trigger, label: "雙方受到混亂／窒息時", statuses: ["混亂", "窒息"] },
};
