import { getMaxPp } from "../utils/battleHelpers";
// ============================================================================
// effectRunner.ts —— 模組化 28 原子執行器 (Effect Runner)
// 接既有引擎 primitive: applyTrueDamage, applyFixedDamage, applyPercentDamage,
// applyHeal, applyStatChange, applyShield, applyStatusWithImmunityCheck, etc.
// ============================================================================

import type { AtomId, AtomTable, KitEntry, EffectCode, Node, Target } from "./effectSystem.schema";
import { mapCodeToAtoms } from "./atomMapper";
import { blockEntryToAtom } from "./blockParams";
import { prdPercent } from "../utils/prd";

// 底層不變式：真實傷害不可被護盾與減傷抵擋 (減傷/護盾原子自動跳過 true 傷害)
export const isReducible = (dmgType: string) => dmgType !== "true";

// ── 28 個原子操作完整實作 ──────────────────────────────────────────────────
export const ATOMS: AtomTable = {
  // 1. 追加傷害: 依 params.dmgType 走對應傷害管線
  extra_damage: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    let amt = typeof p.amount === "number" ? p.amount : Number(p.amount) || 0;
    
    if (p.incremental) {
      const stateKey = p.incremental.stateKey;
      let count = (ctx.getPlayerState?.(stateKey) || 0) + 1;
      ctx.setPlayerState?.(stateKey, count);
      amt = Math.min(p.incremental.max, p.incremental.base + (count - 1) * p.incremental.step);
    }
    
    if (p.dmgType === "true") {
      ctx.applyTrueDamage(side, amt, p.label || "追加真實傷害");
    } else if (p.dmgType === "fixed") {
      ctx.applyFixedDamage(side, amt, p.label || "追加固定傷害");
    } else if (p.dmgType === "percent") {
      ctx.applyPercentDamage(side, p.ratio || amt || 10);
    } else {
      ctx.applyPinkDamage?.(side, amt, p.label || "追加技能傷害");
    }
  },

  // 2. 傷害/威力倍率
  damage_multiplier: (p, _target, ctx) => {
    const mult = p.multiplier || p.value || 1.5;
    if (ctx.damageComp && !ctx.damageComp.isIncoming) {
      ctx.damageComp.multiplier *= mult;
    }
  },

  // 3. 減傷/減半 (底層跳過 true)
  damage_reduce: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    if (ctx.damageComp && ctx.damageComp.isIncoming !== false && isReducible(ctx.damageComp.damageCategory)) {
      const reducePercent = p.percent || p.amount || 50;
      ctx.damageComp.decreasePercent += reducePercent;
    }
  },

  // 4. 傷害反彈
  damage_reflect: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const ratio = p.ratio || 0.5;
    const lastDmg = ctx.getPlayerState?.(`${side}_lastDamageTaken`) || 100;
    const reflectAmt = Math.floor(lastDmg * ratio);
    ctx.applyTrueDamage(side, reflectAmt, "傷害反彈");
  },

  // 5. 恢復體力
  heal: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    let amt = p.amount || 0;
    if (!amt && p.ratio) {
      const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
      amt = Math.floor((elf?.maxHp || 100) * p.ratio);
    }
    ctx.applyHeal(side, amt || 50);
  },

  // 6. 吸取 (對手扣血 + 自身等量回血)
  drain_hp: (p, _target, ctx) => {
    const me = ctx.actor || "p1";
    const opp = me === "p1" ? "p2" : "p1";
    let amt = p.amount || 100;
    
    if (p.incremental) {
      const stateKey = p.incremental.stateKey;
      let count = (ctx.getPlayerState?.(stateKey) || 0) + 1;
      ctx.setPlayerState?.(stateKey, count);
      amt = Math.min(p.incremental.max, p.incremental.base + (count - 1) * p.incremental.step);
    }
    
    const dealt = ctx.applyTrueDamage(opp, amt, "吸取體力");
    ctx.applyHeal(me, dealt || amt);
  },

  // 7. 消耗自身體力 (代價, 保留至少 1 HP)
  hp_cost: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (!elf) return;
    const cost = p.amount || Math.floor(elf.maxHp * (p.ratio || 0.2));
    const newHp = Math.max(1, elf.currentHp - cost);
    ctx.updateElf(side, { currentHp: newHp });
    ctx.addLog(`💔 【體力消耗】：【${elf.name}】消耗了 ${elf.currentHp - newHp} 點體力！`, "effect");
  },

  // 8. 體力上限增減
  maxhp_change: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (!elf) return;
    const delta = p.amount || 100;
    const newMax = Math.max(1, elf.maxHp + delta);
    ctx.updateElf(side, { maxHp: newMax, currentHp: Math.min(elf.currentHp, newMax) });
    ctx.addLog(`📈 【體力上限變更】：【${elf.name}】體力上限變更為 ${newMax}！`, "effect");
  },

  // 9. 施加具名異常狀態
  apply_status: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const status = p.status || "麻痺";
    const duration = p.duration || p.turns || 2;
    const chance = Number(p.chance ?? 100);
    if (chance < 100 && !prdPercent(`kit_status_${ctx.actor || "p1"}_${status}`, chance)) return;
    ctx.applyStatusWithImmunityCheck(side, status, duration);
  },

  // 10. 解除異常狀態
  cure_status: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (!elf) return;
    const currentStatuses = ctx.getStatuses(elf);
    if (Object.keys(currentStatuses).length > 0) {
      ctx.setPlayerState(`${side}_statuses`, {});
      ctx.addLog(`✨ 【異常解除】：【${elf.name}】解除所有異常狀態！`, "effect");
      if (ctx.getPlayerState("DeluStatusEndHeal") || ctx.getPlayerState(`${side}_DeluStatusEndHeal`)) {
        ctx.addLog(`✨ 【劫盡歸塵】：異常狀態結束或解除，恢復全部體力！`, "heal");
        ctx.applyHeal(side, elf.maxHp);
        ctx.setPlayerState("DeluStatusEndHeal", false);
      }
    }
  },

  // 11. 能力等級增減
  stat_change: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const changes: Record<string, number> = {};
    if (p.all) {
      const val = Number(p.all) || 1;
      ["atk", "def", "spatk", "spdef", "speed", "accuracy"].forEach(k => { changes[k] = val; });
    } else if (p.stat) {
      changes[p.stat] = p.value || 1;
    } else {
      changes.atk = p.atk || 1;
      changes.def = p.def || 0;
    }
    ctx.applyStatChange(side, changes);
  },

  // 12. 消除能力提升/下降
  clear_stat: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const mode = p.type || "buff";
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (!elf) return;
    const stages = { ...elf.statStages };
    let cleared = false;
    for (const k of Object.keys(stages)) {
      if ((mode === "buff" || mode === "all") && (stages[k] || 0) > 0) {
        stages[k] = 0;
        cleared = true;
      } else if ((mode === "debuff" || mode === "all") && (stages[k] || 0) < 0) {
        stages[k] = 0;
        cleared = true;
      }
    }
    if (cleared) {
      ctx.updateElf(side, { statStages: stages });
      ctx.addLog(`🧹 【能力消除】：【${elf.name}】的${mode === "buff" ? "能力提升" : mode === "debuff" ? "能力下降" : "能力等級變化"}已被消除！`, "effect");
    }
  },

  // 13. 護盾/屏障
  shield: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const amt = p.amount || 200;
    ctx.applyShield(side, amt);
  },

  // 14. PP 歸零/扣除/回復
  pp_op: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (!elf) return;
    if (p.op === "zero") {
      const updatedSkills = elf.skills.map(s => ({ ...s, pp: 0 }));
      ctx.updateElf(side, { skills: updatedSkills });
      ctx.addLog(`⚡ 【PP歸零】：【${elf.name}】的所有技能 PP 歸零！`, "effect");
    } else if (p.op === "recover") {
      const updatedSkills = elf.skills.map(s => ({ ...s, pp: s.maxPp }));
      ctx.updateElf(side, { skills: updatedSkills });
      ctx.addLog(`🔋 【PP回復】：【${elf.name}】恢復所有技能 PP！`, "effect");
    } else if (p.op === "drain") {
      // 吸取：對手扣 PP，自身當前技能等量回復
      const dec = p.amount || 1;
      ctx.updateElf(side, { skills: elf.skills.map(s => ({ ...s, pp: Math.max(0, (s.pp ?? 0) - dec) })) });
      const meSide: "p1" | "p2" = ctx.actor || "p1";
      const me = meSide === "p1" ? ctx.activeP1 : ctx.activeP2;
      if (me) ctx.updateElf(meSide, { skills: me.skills.map(s => ({ ...s, pp: Math.min(getMaxPp(s, me), (s.pp ?? 0) + dec) })) });
      ctx.addLog(`🔋 【PP吸取】：吸取【${elf.name}】技能 PP ${dec} 點！`, "effect");
    } else if (p.op === "add") {
      const inc = p.amount || 1;
      const updatedSkills = elf.skills.map(s => ({ ...s, pp: Math.min(getMaxPp(s, elf), (s.pp ?? 0) + inc) }));
      ctx.updateElf(side, { skills: updatedSkills });
      ctx.addLog(`🔋 【PP增加】：【${elf.name}】技能 PP 增加 ${inc}！`, "effect");
    } else {
      const dec = p.amount || 1;
      const updatedSkills = elf.skills.map(s => ({ ...s, pp: Math.max(0, (s.pp ?? 0) - dec) }));
      ctx.updateElf(side, { skills: updatedSkills });
      ctx.addLog(`🔻 【PP扣除】：【${elf.name}】技能 PP 減少 ${dec}！`, "effect");
    }
  },

  // 15. 先制調整
  priority: (p, _target, ctx) => {
    const bonus = p.bonus || 1;
    if (ctx.priorityComp) {
      ctx.priorityComp.bonus += bonus;
    } else {
      ctx.setPlayerState(`${ctx.actor}_priorityBonus`, bonus);
    }
  },

  // 16. 必中 / 閃避 / 命中率
  accuracy: (p, target, ctx) => {
    if (p.alwaysHit) {
      ctx.isHit = true;
    } else if (p.evade) {
      const side = resolveSide(target, ctx);
      ctx.setPlayerState(`${side}_evasionActive`, true);
      ctx.addLog(`🌀 【攻擊閃避】：進入閃避姿態！`, "effect");
    }
  },

  // 17. 無視防禦 / 護盾貫穿
  pierce: (_p, _target, ctx) => {
    if (ctx.damageComp && !ctx.damageComp.isIncoming) {
      ctx.damageComp.damageCategory = "true";
    }
  },

  // 18. 暴擊 / 致命一擊
  crit: (_p, _target, ctx) => {
    if (ctx.damageComp) {
      if (ctx.damageComp.isIncoming) return;
      ctx.damageComp.isCrit = true;
    } else {
      ctx.setPlayerState(`${ctx.actor}_mustCrit`, true);
    }
  },

  // 19. 額外行動
  extra_action: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    ctx.setPlayerState(`${side}_extraAction`, true);
    ctx.addLog(`⚡ 【額外行動】：獲得連擊/額外行動機會！`, "effect");
  },

  // 20. 召喚額外精靈
  summon_extra: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    if (p.extraElf) {
      ctx.addExtraElf(side, p.extraElf);
      ctx.addLog(`🔮 【召喚】：召喚了助戰精靈 ${p.extraElf.name}！`, "effect");
    }
  },

  // 21. 消逝
  vanish: (_p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (elf) {
      ctx.vanishElf(side, elf);
      ctx.addLog(`🌌 【消逝】：【${elf.name}】離場消逝！`, "effect");
    }
  },

  // 22. 重生 / 免疫致命
  rebirth: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    ctx.applyDeathImmunity(side, {
      guardTurns: p.turns || 2,
      deathImmuneTurns: p.turns || 2,
      fixedPercentCap: p.fixedCap
    });
  },

  // 23. 複製 / 轉移 / 交換
  copy_transfer: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const oppSide = side === "p1" ? "p2" : "p1";
    const myElf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    const oppElf = oppSide === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (!myElf || !oppElf) return;

    if (p.mode === "swap_hp") {
      const myHp = myElf.currentHp;
      ctx.updateElf(side, { currentHp: Math.min(myElf.maxHp, oppElf.currentHp) });
      ctx.updateElf(oppSide, { currentHp: Math.min(oppElf.maxHp, myHp) });
      ctx.addLog(`🔄 【體力對調】：雙方體力互換！`, "effect");
    } else {
      ctx.updateElf(side, { statStages: { ...oppElf.statStages } });
      ctx.addLog(`📋 【能力複製】：複製了對手的能力等級！`, "effect");
    }
  },

  // 24. 免疫 / 技能無效
  immune: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    ctx.setPlayerState(`${side}_immuneAll`, true);
    ctx.addLog(`🛡️ 【全防禦】：獲得技能免疫護罩！`, "effect");
  },

  // 25. 施加回合類效果 (包裝器)
  turn_effect_apply: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const timerId = p.timerId || p.id || ("te_" + Math.random().toString(36).substring(2, 8));
    const name = p.timerName || p.name || "具名回合效果";
    const displayChar = p.displayChar || p.char || "印";
    ctx.addTimerTo(side, {
      id: timerId,
      name: name,
      kind: "turn_effect",
      source: "skill",
      remaining: p.duration || 1,
      tickAt: p.tickAt || "round_end",
      clearable: p.clearable ?? true,
      polarity: p.polarity || "NEGATIVE",
      displayChar: displayChar,
      payload: { wraps: p.wraps, params: p.wrapParams, applyMode: p.applyMode || "gate", timerName: name, displayChar }
    }, ctx.goesFirst === false);
  },

  // 26. 消除回合類效果
  turn_effect_clear: (_p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    const cleared = ctx.clearTurnEffectsOf(side, elf);
    if (cleared) {
      ctx.addLog(`✨ 【回合類效果消除】：成功消除對手的回合類效果！`, "effect");
    }
  },

  // 27. 複製能力總和 (額外精靈用)
  copy_stat_sum: (_p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const elf = side === "p1" ? ctx.activeP1 : ctx.activeP2;
    if (elf) {
      ctx.addLog(`📊 【能力複製】：助戰精靈繼承主體能力總和！`, "effect");
    }
  },

  // 28. 條件閘
  condition_gate: (p, target, ctx) => {
    const side = resolveSide(target, ctx);
    const actorSide = ctx.actor || "p1";
    const oppSide = actorSide === "p1" ? "p2" : "p1";
    
    const selfElf = actorSide === "p1" ? ctx.activeP1 : ctx.activeP2;
    const oppElf = oppSide === "p1" ? ctx.activeP1 : ctx.activeP2;
    
    let isTrue = true;

    if (p.hp_below !== undefined) {
      const ratio = Number(p.hp_below);
      if (selfElf) {
        const currentRatio = selfElf.currentHp / selfElf.maxHp;
        if (currentRatio >= ratio) isTrue = false;
      }
    }
    if (p.hp_above !== undefined) {
      const ratio = Number(p.hp_above);
      if (selfElf) {
        const currentRatio = selfElf.currentHp / selfElf.maxHp;
        if (currentRatio <= ratio) isTrue = false;
      }
    }
    if (p.has_shield !== undefined) {
      const hasShield = !!(selfElf?.shield && selfElf.shield > 0);
      if (hasShield !== !!p.has_shield) isTrue = false;
    }
    if (p.is_gender !== undefined) {
      const selfGender = selfElf?.gender || "none";
      if (selfGender !== p.is_gender) isTrue = false;
    }
    if (p.enemy_type !== undefined) {
      const enemyType = oppElf?.type;
      if (enemyType !== p.enemy_type) isTrue = false;
    }
    if (p.layer_gte !== undefined && p.timerId) {
      const timersKey = `${actorSide}Timers` as "p1Timers" | "p2Timers";
      const list = ctx[timersKey] || (actorSide === "p1" ? ctx.p1Timers : ctx.p2Timers) || [];
      const timer = list.find((t: any) => t.id === p.timerId);
      const currentLayers = timer?.layers || (timer ? 1 : 0);
      if (currentLayers < Number(p.layer_gte)) isTrue = false;
    }
    if (p.has_status !== undefined) {
      const statuses = ctx.getStatuses?.(selfElf) || {};
      if (!statuses[p.has_status]) isTrue = false;
    }
    if (p.is_first !== undefined) {
      const goesFirst = ctx.goesFirst !== undefined ? ctx.goesFirst : (ctx.moveIndex === 0);
      if (goesFirst !== !!p.is_first) isTrue = false;
    }
    if (p.is_second !== undefined) {
      const goesSecond = ctx.goesFirst !== undefined ? !ctx.goesFirst : (ctx.moveIndex === 1);
      if (goesSecond !== !!p.is_second) isTrue = false;
    }

    if (isTrue && p.inner) {
      const innerAtom = p.inner;
      const impl = ATOMS[innerAtom];
      if (impl) {
        ctx.addLog?.(`🎯 【條件閘門滿足】：滿足條件，觸發【${innerAtom}】！`, "effect");
        const innerParams = p.innerParams || {};
        const innerTarget = p.innerTarget || target;
        impl(innerParams, innerTarget, ctx);
      }
    } else {
      ctx.trackCodeExec?.("condition_gate", p.template || "條件閘門未滿足", p.template);
    }
  }
};

export function runWrappedAtom(wraps: string | string[], params: any, wrapTarget: string, ownerSide: "p1" | "p2", ctx: any) {
  const wrapList = Array.isArray(wraps) ? wraps : [wraps];
  for (const wrap of wrapList) {
    const impl = ATOMS[wrap];
    if (!impl) {
      console.warn("[effectRunner] Wrapped atom not implemented:", wrap);
      continue;
    }
    const subCtx = Object.create(ctx);
    subCtx.actor = ownerSide;
    try {
      impl(params, wrapTarget, subCtx);
    } catch (err) {
      console.error(`[effectRunner] Error running wrapped atom ${wrap}:`, err);
    }
  }
}

// ── Target → 引擎 side (p1 / p2) 剖析 ─────────────────────────────────────
export function resolveSide(target: Target, ctx: any): "p1" | "p2" {
  const me = ctx.actor || "p1";
  const opp = me === "p1" ? "p2" : "p1";
  if (target === "opponent") return opp;
  if (target === "both") return opp; // Secondary target resolves to opp for negative operations
  return me;
}

function resolveParams(obj: Record<string, any>, slots: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in obj) {
    let v = obj[k];
    if (typeof v === "string") {
      v = v.replace(/\{(\d+)\}/g, (_, i) => {
        if (slots[i] !== undefined) return String(slots[i]);
        if (slots[`{${i}}`] !== undefined) return String(slots[`{${i}}`]);
        return `{${i}}`;
      });
      if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);   // 純數字字串轉回數字
    }
    out[k] = v;
  }
  return out;
}

// ── runner 核心：在節點 N，取精靈 kit 中 node === N 的詞條，按 order 逐一執行 ────
export function runNode(node: Node, kit: KitEntry[], codex: Record<string, EffectCode>, ctx: any) {
  if (!kit || !Array.isArray(kit)) return;
  const entries = kit.filter(e => e.node === node).sort((a, b) => a.order - b.order);
  for (const entry of entries) {
    // 積木工坊詞條：codeId 即原子名，直接依結構化參數執行（不再重新解析 customText）
    const direct = blockEntryToAtom(entry, ATOMS);
    if (direct) {
      try { ATOMS[direct.atom](resolveParams(direct.params, entry.params || {}), direct.target, ctx); }
      catch (err) { console.error(`[effectRunner] Error running block atom ${direct.atom}:`, err); }
      continue;
    }
    // 積木換槽後的自訂效果:無 codeId,對 customText 即時跑文字偵測
    let code = codex[entry.codeId];
    let atomList;
    if (entry.customText) {
      const cleanText = entry.customText.replace(/[（(][^（()）]*[Bb][Oo][Ss][Ss][^（()）]*[)）]/g, "");
      atomList = mapCodeToAtoms({ template: cleanText, target: (code && code.target) || "opponent" });
    } else {
      if (!code || code.era === "unknown") continue;
      atomList = code.atoms && code.atoms.length > 0 ? code.atoms : [];
    }
    for (const bind of atomList) {
      const impl = ATOMS[bind.atom];
      if (!impl) {
        console.warn("[effectRunner] Atom not implemented:", bind.atom);
        continue;
      }
      const params = resolveParams({ ...bind.params, ...entry.params }, entry.params);
      const target = bind.target || code?.target || "self";
      try {
        impl(params, target, ctx);
      } catch (err) {
        console.error(`[effectRunner] Error running atom ${bind.atom}:`, err);
      }
    }
  }
}
