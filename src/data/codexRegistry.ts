import { EffectCode } from "../effects/effectSystem.schema";
import { mapCodeToAtoms } from "../effects/atomMapper";

// Import raw codex JSON if exists, else fallback to standard list
import rawCodex from "./codex.json";

export const CODEX: Record<string, EffectCode> = {};

// Initialize CODEX dictionary with mapped atoms
(function initCodex() {
  if (Array.isArray(rawCodex)) {
    for (const item of rawCodex as Partial<EffectCode>[]) {
      if (!item.id) continue;
      const code: EffectCode = {
        id: item.id,
        template: item.template || "",
        paramCount: item.paramCount ?? 0,
        era: item.era || "legacy",
        role: item.role || "innate",
        node: item.node || null,
        damageType: item.damageType || null,
        counter: item.counter,
        namedStatus: item.namedStatus ?? false,
        isDual: item.isDual ?? false,
        target: item.target || "self",
        targetInferred: item.targetInferred ?? false,
        polarity: item.polarity || "NEUTRAL",
        contexts: item.contexts || ["skill"],
        atoms: item.atoms && item.atoms.length > 0 ? item.atoms : mapCodeToAtoms(item),
        clarity: item.clarity || "clear",
        needsReview: item.needsReview ?? false,
        reviewReason: item.reviewReason || ""
      };
      CODEX[item.id] = code;
    }
  }

  // --- Dynamic registration for Puni (1000) and Saint Puni (5000) ---
  const customList: Partial<EffectCode>[] = [
    // --- 譜尼魂印 ---
    {
      id: "puni_base_m1",
      template: "天生免疫每次受到的異常狀態",
      node: "passive_always",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "天生免疫每次受到的異常狀態" } }]
    },
    {
      id: "puni_base_m2",
      template: "每回合結束時恢復最大體力25%",
      node: "round_end",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "heal", target: "self", params: { ratio: 0.25 } }]
    },
    {
      id: "puni_base_m3",
      template: "每回合結束時所有技能回復1點PP值",
      node: "round_end",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "pp_op", target: "self", params: { op: "add", amount: 1 } }]
    },

    // --- 譜尼主技 ---
    {
      id: "puni_base_mo",
      template: "附加對手最大體力1/8的百分比傷害",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "extra_damage", target: "opponent", params: { dmgType: "percent", ratio: 0.125 } }]
    },
    {
      id: "puni_base_qianlie",
      template: "解除自身能力下降狀態",
      node: "before_skill",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "clear_stat", target: "self", params: { type: "debuff" } }]
    },
    {
      id: "puni_base_xuanmie",
      template: "5回合內每回合附加30點固定傷害",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{
        atom: "turn_effect_apply",
        target: "opponent",
        params: {
          duration: 5,
          polarity: "NEGATIVE",
          clearable: true,
          wraps: "extra_damage",
          wrapParams: { dmgType: "fixed", amount: 30 }
        }
      }]
    },
    {
      id: "puni_base_shengtang",
      template: "消除對方能力增強效果",
      node: "before_skill",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "clear_stat", target: "opponent", params: { type: "buff" } }]
    },
    {
      id: "puni_base_shengying_b",
      template: "消除對手回合類效果",
      node: "before_skill",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "turn_effect_clear", target: "opponent" }]
    },
    {
      id: "puni_base_shengying_c",
      template: "消除成功2回合內對手無法通過自身技能恢復HP",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "2回合內對手無法通過自身技能恢復HP" } }]
    },
    {
      id: "puni_base_shengying_d",
      template: "當回合未擊敗對手則自身特攻、速度+1",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "未擊敗對手自身特攻速度+1" } }]
    },
    {
      id: "puni_base_shengying_e",
      template: "吸取150固定體力，每次使用額外附加100點，最高350點",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "drain_hp", target: "opponent", params: { amount: 150, incremental: { base: 150, step: 100, max: 350, stateKey: "puniShengYingCount" } } }]
    },

    // --- 譜尼備選技能 ---
    {
      id: "puni_base_xuwu",
      template: "先出手時2回合內使對手技能失效",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "先出手2回合使對手技能失效" } }]
    },
    {
      id: "puni_base_yuansu",
      template: "額外附加200點真實傷害",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "extra_damage", target: "opponent", params: { dmgType: "true", amount: 200 } }]
    },
    {
      id: "puni_base_nengliang",
      template: "將所受的傷害2倍反饋對手",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "將受到的傷害2倍反饋對手" } }]
    },
    {
      id: "puni_base_lingguang",
      template: "威力隨對手能力等級遞增",
      node: "before_damage",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "威力隨對手能力等級遞增" } }]
    },
    {
      id: "puni_base_shengming",
      template: "5回合內每回合回復100點固定體力值",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{
        atom: "turn_effect_apply",
        target: "self",
        params: {
          duration: 5,
          polarity: "POSITIVE",
          clearable: true,
          wraps: "heal",
          wrapParams: { amount: 100 }
        }
      }]
    },
    {
      id: "puni_base_duankong",
      template: "額外附加30點傷害",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "extra_damage", target: "opponent", params: { amount: 30 } }]
    },
    {
      id: "puni_base_lunhui",
      template: "回復自身最大體力的100%",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "heal", target: "self", params: { ratio: 1.0 } }]
    },
    {
      id: "puni_base_linghun",
      template: "100%令對手疲憊2回合",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "apply_status", target: "opponent", params: { status: "疲憊", duration: 2 } }]
    },
    {
      id: "puni_base_yongheng",
      template: "回復自身所有PP值",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "pp_op", target: "self", params: { op: "recover" } }]
    },
    {
      id: "puni_base_shengjie",
      template: "5回合內屬性技能對自身必定MISS",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "5回合屬性技能對自身必定MISS" } }]
    },
    {
      id: "puni_base_shengguangqi",
      template: "2回合內攻擊必定致命一擊",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{
        atom: "turn_effect_apply",
        target: "self",
        params: {
          duration: 2,
          polarity: "POSITIVE",
          clearable: true,
          wraps: "crit",
          wrapParams: {}
        }
      }]
    },
    {
      id: "puni_base_canling_1",
      template: "2回合內有100%機率免疫對手的攻擊傷害",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "2回合免疫對手攻擊傷害" } }]
    },
    {
      id: "puni_base_canling_2",
      template: "5回合內每回合恢復自身體力1/3",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{
        atom: "turn_effect_apply",
        target: "self",
        params: {
          duration: 5,
          polarity: "POSITIVE",
          clearable: true,
          wraps: "heal",
          wrapParams: { ratio: 0.3333 }
        }
      }]
    },
    {
      id: "puni_base_canling_3",
      template: "遇到天敵時先制+1",
      node: "before_skill",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "璨靈天敵先制+1" } }]
    },
    {
      id: "puni_base_canling_4",
      template: "下2回合攻擊必定先出手",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "下2回合必定先先手" } }]
    },
    {
      id: "puni_base_canling_5",
      template: "使自身下2回合的攻擊威力翻倍",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "下2回合威力翻倍" } }]
    },
    {
      id: "puni_base_luofang_1",
      template: "吸收對手能力提升",
      node: "before_skill",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "copy_transfer", target: "self", params: { mode: "copy_stages" } }, { atom: "clear_stat", target: "opponent", params: { type: "buff" } }]
    },
    {
      id: "puni_base_luofang_2",
      template: "附加100固定，每次使用額外附加100點，最高400點",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "extra_damage", target: "opponent", params: { dmgType: "fixed", amount: 100, incremental: { base: 100, step: 100, max: 400, stateKey: "puniLuoFangCount" } } }]
    },
    {
      id: "puni_base_luofang_3",
      template: "遇到天敵時效果翻倍",
      node: "before_damage",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "遇天敵落芳效果翻倍" } }]
    },
    {
      id: "puni_base_beihun_1",
      template: "3回合50%對手屬性技能失效",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "3回合50%對手屬性技能失效" } }]
    },
    {
      id: "puni_base_beihun_2",
      template: "先出手時降低對手所有PP2點",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "pp_op", target: "opponent", params: { op: "reduce", amount: 2 } }]
    },

    // --- 聖靈譜尼魂印 ---
    {
      id: "puni_holy_void",
      template: "受攻擊傷害時免疫下1次受到的攻擊傷害",
      node: "on_damaged",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "受攻擊傷害時免疫下1次受到的攻擊傷害" } }]
    },
    {
      id: "puni_holy_element_a",
      template: "登場時消除對手回合類效果",
      node: "on_entered",
      role: "carried",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["trait"],
      atoms: [{ atom: "turn_effect_clear", target: "opponent" }]
    },
    {
      id: "puni_holy_element_b",
      template: "消除成功對手下次技能無效",
      node: "on_entered",
      role: "carried",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "消除成功對手下次技能無效" } }]
    },
    {
      id: "puni_holy_energy",
      template: "戰鬥階段結束時附加自身已損失體力50%百分比傷害",
      node: "battle_phase_end",
      role: "carried",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "戰鬥階段結束時附加自身已損失體力50%百分比傷害" } }]
    },
    {
      id: "puni_holy_life_a",
      template: "戰鬥階段結束恢復自身最大體力1/4",
      node: "battle_phase_end",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "heal", target: "self", params: { ratio: 0.25 } }]
    },
    {
      id: "puni_holy_life_b",
      template: "戰鬥階段結束隨機2個未滿PP技能+1PP",
      node: "battle_phase_end",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "戰鬥階段結束隨機2個未滿PP技能+1PP" } }]
    },
    {
      id: "puni_holy_reincarn_a",
      template: "對手出手回合若自身受致命傷害則殘留1點體力",
      node: "self_fatal",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "對手出手回合若自身受致命傷害則殘留1點體力" } }]
    },
    {
      id: "puni_holy_reincarn_b",
      template: "回合結束後自身體力/PP/能力等級返回當回合操作後狀態",
      node: "round_end",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "回合結束後自身體力/PP/能力等級返回當回合操作後狀態" } }]
    },
    {
      id: "puni_holy_eternal",
      template: "回合開始時若自身體力高於對手則當回合自身必定先手",
      node: "round_start",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "回合開始時若自身體力高於對手則當回合自身必定先手" } }]
    },
    {
      id: "puni_holy_sacred_a",
      template: "天生免疫所有異常狀態",
      node: "passive_always",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "天生免疫所有異常狀態" } }]
    },
    {
      id: "puni_holy_sacred_b",
      template: "天生免疫能力下降狀態",
      node: "passive_always",
      role: "carried",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["trait"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "天生免疫能力下降狀態" } }]
    },

    // --- 聖靈譜尼技能 ---
    {
      id: "puni_holy_touch_1",
      template: "消除對手能力提升",
      node: "before_skill",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "clear_stat", target: "opponent", params: { type: "buff" } }]
    },
    {
      id: "puni_holy_touch_2",
      template: "消除成功對手下1次攻擊技能無效",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "消除成功對手下1次攻擊技能無效" } }]
    },
    {
      id: "puni_holy_touch_3",
      template: "附加對手15%百分比傷害，連用+10%最高45%",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "extra_damage", target: "opponent", params: { dmgType: "percent", ratio: 0.15 } }]
    },
    {
      id: "puni_holy_chant_1",
      template: "100%令對手疲憊",
      node: "on_hit",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "apply_status", target: "opponent", params: { status: "疲憊", duration: 1 } }]
    },
    {
      id: "puni_holy_chant_2",
      template: "未觸發疲憊則對手2回合屬性技能無效",
      node: "on_hit",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "對手2回合屬性技能無效" } }]
    },
    {
      id: "puni_holy_chant_3",
      template: "4回合內受到攻擊時反擊對手最大體力1/3",
      node: "on_damaged",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "4回合內受到攻擊時反擊對手最大體力1/3" } }]
    },
    {
      id: "puni_holy_chant_4",
      template: "下2回合對手受到傷害提升150%",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "下2回合對手受到傷害提升150%" } }]
    },
    {
      id: "puni_holy_revive_1",
      template: "使雙方所有技能PP歸零",
      node: "after_action",
      role: "attached",
      target: "both",
      polarity: "NEUTRAL",
      contexts: ["skill"],
      atoms: [{ atom: "pp_op", target: "both", params: { op: "zero" } }]
    },
    {
      id: "puni_holy_revive_2",
      template: "消除雙方能力提升下降狀態",
      node: "before_skill",
      role: "attached",
      target: "both",
      polarity: "NEUTRAL",
      contexts: ["skill"],
      atoms: [{ atom: "clear_stat", target: "self", params: { type: "buff" } }, { atom: "clear_stat", target: "self", params: { type: "debuff" } }, { atom: "clear_stat", target: "opponent", params: { type: "buff" } }, { atom: "clear_stat", target: "opponent", params: { type: "debuff" } }]
    },
    {
      id: "puni_holy_revive_3",
      template: "消除雙方回合類效果",
      node: "before_skill",
      role: "attached",
      target: "both",
      polarity: "NEUTRAL",
      contexts: ["skill"],
      atoms: [{ atom: "turn_effect_clear", target: "self" }, { atom: "turn_effect_clear", target: "opponent" }]
    },
    {
      id: "puni_holy_revive_4",
      template: "恢復自身最大體力100%",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "heal", target: "self", params: { ratio: 1.0 } }]
    },
    {
      id: "puni_holy_revive_5",
      template: "附加等同恢復量的固傷",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "附加等同恢復量的固傷" } }]
    },
    {
      id: "puni_holy_dream_1",
      template: "全屬性+1，對手非混沌系時翻倍",
      node: "after_action",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "全屬性+1，對手非混沌系時翻倍" } }]
    },
    {
      id: "puni_holy_dream_2",
      template: "3回合每回合吸取對手能力強化狀態",
      node: "round_end",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "3回合每回合吸取對手能力強化狀態" } }]
    },
    {
      id: "puni_holy_dream_3",
      template: "3回合每回合恢復自身最大體力1/2",
      node: "round_end",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{
        atom: "turn_effect_apply",
        target: "self",
        params: {
          duration: 3,
          polarity: "POSITIVE",
          clearable: true,
          wraps: "heal",
          wrapParams: { ratio: 0.5 }
        }
      }]
    },
    {
      id: "puni_holy_dream_4",
      template: "體力低於1/2時3回合每回合造等量固傷",
      node: "round_end",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "體力低於1/2時3回合每回合造等量固傷" } }]
    },
    {
      id: "puni_holy_dream_5",
      template: "下2回合自身所有技能先制+2",
      node: "round_start",
      role: "attached",
      target: "self",
      polarity: "POSITIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "self", params: { template: "下2回合自身所有技能先制+2" } }]
    },
    {
      id: "puni_holy_saviour_1",
      template: "消除對手回合類效果",
      node: "before_skill",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "turn_effect_clear", target: "opponent" }]
    },
    {
      id: "puni_holy_saviour_2",
      template: "消除成功3回合對手無法用技能恢復體力",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "消除成功3回合對手無法用技能恢復體力" } }]
    },
    {
      id: "puni_holy_saviour_3",
      template: "未擊敗對手下回合附加自身最大體力1/3固傷",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "未擊敗對手下回合附加自身最大體力1/3固傷" } }]
    },
    {
      id: "puni_holy_saviour_4",
      template: "吸取對手200體力，自身<1/2時翻倍",
      node: "after_action",
      role: "attached",
      target: "opponent",
      polarity: "NEGATIVE",
      contexts: ["skill"],
      atoms: [{ atom: "condition_gate", target: "opponent", params: { template: "吸取對手200體力，自身<1/2時翻倍" } }]
    }
  ];

  for (const item of customList) {
    if (!item.id) continue;
    const code: EffectCode = {
      id: item.id,
      template: item.template || "",
      paramCount: item.paramCount ?? 0,
      era: "legacy",
      role: item.role || "innate",
      node: item.node || null,
      damageType: item.damageType || null,
      counter: item.counter,
      namedStatus: item.namedStatus ?? false,
      isDual: item.isDual ?? false,
      target: item.target || "self",
      targetInferred: item.targetInferred ?? false,
      polarity: item.polarity || "NEUTRAL",
      contexts: item.contexts || ["skill"],
      atoms: item.atoms && item.atoms.length > 0 ? item.atoms : [],
      clarity: "clear",
      needsReview: false,
      reviewReason: ""
    };
    CODEX[item.id] = code;
  }
})();

export function getEffectCode(id: string): EffectCode | undefined {
  return CODEX[id];
}

export function searchEffectCodes(query: {
  role?: string;
  era?: string;
  keyword?: string;
  context?: string;
}): EffectCode[] {
  let list = Object.values(CODEX);
  if (query.role) {
    list = list.filter(c => c.role === query.role);
  }
  if (query.era) {
    list = list.filter(c => c.era === query.era);
  }
  if (query.keyword) {
    const kw = query.keyword.toLowerCase();
    list = list.filter(c => c.id.includes(kw) || c.template.toLowerCase().includes(kw));
  }
  if (query.context) {
    list = list.filter(c => c.contexts.includes(query.context as any));
  }
  return list;
}
