import { EffectCode, AtomBinding, AtomId, Target } from "./effectSystem.schema";

function backfillCustomNumbers(atoms: AtomBinding[], template: string): AtomBinding[] {
  const nums = (template.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length === 0) return atoms;
  let ni = 0;
  for (const a of atoms) {
    if (!a.params) continue;
    for (const k of Object.keys(a.params)) {
      const v = a.params[k];
      if (typeof v === "string" && /^\{\d+\}$/.test(v)) {
        a.params[k] = ni < nums.length ? nums[ni++] : v;
      }
    }
  }
  return atoms;
}

/**
 * P2 - Atom Mapper
 * Maps an EffectCode entry into structured AtomBinding[];
 */
export function mapCodeToAtoms(code: Partial<EffectCode>): AtomBinding[] {
  let template = code.template || "";
  // Strip BOSS annotations: ignore any parenthesized annotations containing "boss"
  template = template.replace(/[（(][^（()）]*[Bb][Oo][Ss][Ss][^（()）]*[)）]/g, "");
  const atoms: AtomBinding[] = [];

  // 1. Dual effect (吸取 / 反彈 / 雙向)
  if (code.isDual) {
    if (template.includes("吸取") || template.includes("汲取")) {
      atoms.push({
        atom: "drain_hp",
        target: "both",
        params: { ratio: code.paramCount > 0 ? "{0}" : 0.125 }
      });
      return atoms;
    }
    if (template.includes("反彈") || template.includes("反饋")) {
      atoms.push({
        atom: "damage_reflect",
        target: "opponent",
        params: { ratio: "{0}" }
      });
      atoms.push({
        atom: "heal",
        target: "self",
        params: { mode: "reflect_equal" }
      });
      return atoms;
    }
  }

  // 2. Status Effects (麻痺/中毒/燒傷/凍傷/害怕/睡眠/石化/混輪/冰封/失明/詛咒/癱瘓)
  if (code.namedStatus || template.includes("麻痺") || template.includes("中毒") || template.includes("燒傷") || template.includes("凍傷") || template.includes("害怕") || template.includes("睡眠") || template.includes("石化") || template.includes("混亂") || template.includes("冰封") || template.includes("失明") || template.includes("詛咒") || template.includes("癱瘓")) {
    let statusName = "麻痺";
    if (template.includes("中毒")) statusName = "中毒";
    else if (template.includes("燒傷")) statusName = "燒傷";
    else if (template.includes("凍傷")) statusName = "凍傷";
    else if (template.includes("害怕")) statusName = "害怕";
    else if (template.includes("睡眠")) statusName = "睡眠";
    else if (template.includes("石化")) statusName = "石化";
    else if (template.includes("混亂")) statusName = "混亂";
    else if (template.includes("冰封")) statusName = "冰封";
    else if (template.includes("失明")) statusName = "失明";
    else if (template.includes("詛咒")) statusName = "詛咒";
    else if (template.includes("癱瘓")) statusName = "癱瘓";

    const chance = template.match(/(\d+)%/)?.[1] || "{0}";
    atoms.push({
      atom: "apply_status",
      target: code.target || "opponent",
      params: { status: statusName, chance, duration: 2 }
    });
  }

  // 3. Stat Changes (全屬性 / 攻擊 / 特攻 / 防禦 / 特防 / 速度 / 命中)
  if (template.includes("等級") || template.includes("全屬性") || template.includes("能力提升") || template.includes("弱化")) {
    if (template.includes("全屬性+")) {
      const stage = template.match(/全屬性\+(\d+|\{\d+\})/)?.[1] || "1";
      atoms.push({
        atom: "stat_change",
        target: "self",
        params: { all: stage }
      });
    } else if (template.includes("全屬性-")) {
      const stage = template.match(/全屬性\-(\d+|\{\d+\})/)?.[1] || "1";
      atoms.push({
        atom: "stat_change",
        target: "opponent",
        params: { all: `-${stage}` }
      });
    } else {
      atoms.push({
        atom: "stat_change",
        target: code.target || "self",
        params: { rawTemplate: template }
      });
    }
  }

  // 4. Fixed / Percent / True Extra Damage
  if (code.damageType === "fixed" || template.includes("固定傷害")) {
    let val = template.match(/(\d+)點固定傷害/)?.[1];
    if (!val && !/\{\d+\}/.test(template)) {
      const m = template.match(/(\d+)\s*點/);
      if (m) val = m[1];
    }
    atoms.push({
      atom: "extra_damage",
      target: "opponent",
      params: { dmgType: "fixed", amount: val || "{0}" }
    });
  } else if (code.damageType === "percent" || template.includes("百分比傷害")) {
    atoms.push({
      atom: "extra_damage",
      target: "opponent",
      params: { dmgType: "percent", ratio: "{0}" }
    });
  } else if (code.damageType === "true" || template.includes("真實傷害")) {
    atoms.push({
      atom: "extra_damage",
      target: "opponent",
      params: { dmgType: "true", amount: "{0}" }
    });
  }

  // 5. Healing
  if (template.includes("恢復") || template.includes("回覆") || template.includes("回血")) {
    let ratioVal: string | null = null;
    let amtVal: string | null = null;
    if (!/\{\d+\}/.test(template)) {
      const ratioMatch = template.match(/最大體力的(\d+\/\d+)/);
      if (ratioMatch) ratioVal = ratioMatch[1];
      const amtMatch = template.match(/(\d+)點/);
      if (amtMatch) amtVal = amtMatch[1];
    }
    atoms.push({
      atom: "heal",
      target: "self",
      params: { 
        ratio: ratioVal || (template.includes("1/") ? "{0}" : null), 
        amount: amtVal || (template.includes("點") ? "{0}" : null) 
      }
    });
  }

  // 6. Shield / Barrier
  if (template.includes("護盾") || template.includes("護罩")) {
    let shieldAmt: string | null = null;
    if (!/\{\d+\}/.test(template)) {
      const match = template.match(/(\d+)\s*點護[盾罩]/);
      if (match) shieldAmt = match[1];
    }
    atoms.push({
      atom: "shield",
      target: "self",
      params: { amount: shieldAmt || "{0}" }
    });
  }

  // 7. Priority
  if (template.includes("先制")) {
    const pVal = template.match(/先制\+(\d+)/)?.[1] || "{0}";
    atoms.push({
      atom: "priority",
      target: "self",
      params: { bonus: pVal }
    });
  }

  // 8. PP Operations
  if (template.includes("PP")) {
    atoms.push({
      atom: "pp_op",
      target: code.target || "opponent",
      params: { op: template.includes("歸零") ? "zero" : "reduce", amount: "{0}" }
    });
  }

  // 9. Clear Stat / Clear Turn Effects
  if (template.includes("消除對手能力提升")) {
    atoms.push({
      atom: "clear_stat",
      target: "opponent",
      params: { type: "buff" }
    });
  }
  if (template.includes("消除對手回合類效果")) {
    atoms.push({
      atom: "turn_effect_clear",
      target: "opponent"
    });
  }

  // 10. Turn Effect Wrapping (if counter is turn_effect and not already handled)
  if (code.counter?.kind === "turn_effect" && atoms.length > 0) {
    const innerAtoms = [...atoms];
    return [{
      atom: "turn_effect_apply",
      target: code.target || "self",
      params: {
        duration: code.counter.duration || "{0}",
        applyMode: code.counter.applyMode || "gate",
        clearable: code.counter.clearable ?? true,
        wraps: innerAtoms[0].atom,
        wrapParams: innerAtoms[0].params
      }
    }];
  }

  // Fallback if no specific atom was matched
  if (atoms.length === 0) {
    atoms.push({
      atom: "condition_gate",
      target: code.target || "self",
      params: { template: code.template }
    });
  }

  if (!/\{\d+\}/.test(template)) {
    return backfillCustomNumbers(atoms, template);
  }
  return atoms;
}
