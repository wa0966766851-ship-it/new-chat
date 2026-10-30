import {portableSkillCapabilities} from './portableSkillMarks';
// PP選招與扣費查詢；戰鬥頁與AI載入時才需要，不拖入首頁共用狀態工具。
import type {Elf,Skill} from '../types';
import {getStatuses,getMinPp,AUXILIARY_STATUSES} from '../utils/battleHelpers';
import {resourceQueryActive} from './resourceQueryRules';
import {effectSourceViews} from './effectSources';
import {skillSlot} from './skillSlot';
import {hasStoneThrowerMythic} from '../data/skillStones';
import {authoredPpExemption} from '../effects/skillPpProperty';

// isZeroPpExempt：PP 為 0 時仍可選擇（「不受PP值限制」）
// isPpCostFree：使用時不消耗 PP（「不消耗PP值」）

const hasStatDown = (elf: Elf) => Object.values(elf.statStages || {}).some(v => (v as number) < 0);
const hasAnyStatus = (elf: Elf) => Object.entries(getStatuses(elf)).some(([k, v]) => !!v && !AUXILIARY_STATUSES.includes(k));
const isSerene = (elf: Elf) => {
  const st = getStatuses(elf);
  return (st["serenity"] || 0) > 0 || (st["平靜"] || 0) > 0 || elf.battleStatus === "serenity" || elf.battleStatus === "平靜";
};
const isCanglan = (elf: Elf) => !!(elf.name?.includes("滄嵐") || elf.soulMark?.name === "瀾" || elf.id === "canglan");
/** 滄嵐：場上存在不擁有護盾者則使用技能不受PP值限制、不消耗技能PP值 */
const canglanActive = (elf: Elf, opp?: Elf | null) => {
  const field = [elf, opp].filter(Boolean) as Elf[];
  return field.some(e => !((e.shield || 0) > 0));
};

/** 描述中「不受PP值限制」的條件判定（例：自身處於能力下降狀態時…不受PP值限制） */
const textPpExempt = (elf: Elf, text?: string): boolean => {
  if (!text) return false;
  for (const seg of text.split(/[；;\n]/)) {
    const k = seg.search(/不受\s*(技能)?\s*PP/);
    if (k < 0) continue;
    const pre = seg.slice(0, k);
    if (/能力下降狀態時/.test(pre)) { if (hasStatDown(elf)) return true; continue; }
    if (/異常狀態時/.test(pre)) { if (hasAnyStatus(elf)) return true; continue; }
    if (/時/.test(pre) && !/選擇技能時|使用技能時/.test(pre)) continue; // 其他條件無法判定時不給豁免
    return true;
  }
  return false;
};

const nativeZeroPpExempt = (elf: Elf, sk: Skill, opp?: Elf | null): boolean => {
  if (!elf || !sk || !elf.name) return false;
  if((elf as any).ppLimitIgnoredUntilSwitch===true)return true;
  if(authoredPpExemption(elf,sk,opp))return true;
  // 2026-10-30：可攜技能標記（符文）的能力必須「已激活」才生效。
  // 原寫法不看 isRuneActive，導致 ᚱᚷ 未激活也讓所有技能豁免 PP。
  if(portableSkillCapabilities(elf).ppUnrestricted)return true;
  if((sk as any).portableSkillMark?.capabilities?.ppUnrestricted&&(sk as any).isRuneActive===true)return true;
  if(sk.ppUnlimited===true)return true; // 原廠 PP 0/0

  // 1. 專屬機制
  if (elf.name === "變革·馬爾修斯") return true; // 充能系統
  if (isCanglan(elf) && canglanActive(elf, opp)) return true;
  if (hasStoneThrowerMythic(elf)) return true;
  if (resourceQueryActive(elf,'ignorePpLimit')) return true;
  if (sk.name === "星光·光合作用" || sk.name === "星光·花草能量") return true;
  if ((elf.ppLimitIgnoredWhenParalyzedTurns || 0) > 0) {
    const st = getStatuses(elf);
    const turns = Math.max(st["麻痺"] || 0, st["麻痹"] || 0, st.paralyzed || 0);
    if (turns >= (elf.ppLimitIgnoredWhenParalyzedTurns || 0) && (!(elf as any).ppLimitIgnoredRequiresNonFull || elf.currentHp < elf.maxHp)) return true;
  }

  // 通用：技能本身被效果標記為「不受PP值限制」（例如英雄之耀達到3層）
  if ((sk as any).ignorePpLimit === true) return true;

  // 2. 平靜：不受PP值限制且不消耗PP值
  if (isSerene(elf)) return true;
  if (elf.soulMark && (elf.soulMark as any).ignorePpLimit === true) return true;

  // 3. 奧丁 ᚱᚷ 符文：激活後所有技能選擇時不受PP值限制；附有 ᚱᚷ 的技能選擇時即激活
  const isRG = (s: Skill) => !(s as any).portableSkillMark&&(s.skillRune === 'ᚱᚷ' || s.specialBadge?.text === 'ᚱᚷ' || !!s.specialBadge?.id?.includes('ᚱᚷ'));
  if ((elf.skills || []).some(s => isRG(s) && s.isRuneActive === true)) return true;
  if (isRG(sk) && (sk as any).isRuneActive === true) return true;

  // 4. 已激活標記中的「不受PP」
  const hasPpExemptBadge = (elf.skills || []).some(s => {
    if((s as any).portableSkillMark)return false;
    const badge = s.specialBadge;
    if (!badge?.description) return false;
    if (!/不受\s*(技能)?\s*PP/.test(badge.description)) return false;
    if (s.isRuneActive === false || badge.description.includes("【未激活】")) return false;
    return true;
  });
  if (hasPpExemptBadge) return true;

  // 5. 技能描述（含條件判定）
  if (sk.effectMode!=='kit'&&!elf.isInherentInvalid && textPpExempt(elf, sk.description)) return true;

  // 6. PP 下限透支
  if (sk.isPpPenalized) return false;
  const minPp = getMinPp(sk, elf);
  if (minPp < 0 && (sk.pp || 0) > minPp) return true;
  return false;
};

/** 使用技能時不消耗 PP */
const nativePpCostFree = (elf: Elf, sk: Skill, opp?: Elf | null): boolean => {
  if (!elf || !sk) return false;
  if (sk.ppUnlimited === true) return true; // 原廠 PP 0/0：使用不消耗PP
  if (hasStoneThrowerMythic(elf)) return true;
  if (elf.name === "變革·馬爾修斯") return true;               // 充能系統另計
  if (elf.name?.includes("奧佩婭")) return true;               // 自身使用技能時：不消耗技能PP值
  if (isCanglan(elf) && canglanActive(elf, opp)) return true;
  if (isSerene(elf)) return true;                               // 平靜
  if (sk.name === "星光·光合作用" || sk.name === "星光·花草能量") return true;
  if (sk.description && /不消耗\s*(技能)?\s*PP/.test(sk.description) && textPpExempt(elf, sk.description.replace(/不消耗\s*(技能)?\s*PP/g, "不受PP"))) return true;
  return false;
};

/** 選招及扣PP都保留自身來源，並納入幻化取得的效果定義。 */
export const isZeroPpExempt = (elf: Elf, sk: Skill, opp?: Elf | null): boolean =>
  !!elf && !!sk && effectSourceViews(elf).some((source, i) => nativeZeroPpExempt(source,
    i ? { ...(elf.illusion?.target.skills[skillSlot(elf, sk)] || sk), pp: sk.pp } : sk, opp));
export const isPpCostFree = (elf: Elf, sk: Skill, opp?: Elf | null): boolean =>
  !!elf && !!sk && effectSourceViews(elf).some((source, i) => nativePpCostFree(source,
    i ? { ...(elf.illusion?.target.skills[skillSlot(elf, sk)] || sk), pp: sk.pp } : sk, opp));

