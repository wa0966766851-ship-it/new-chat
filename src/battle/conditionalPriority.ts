// 條件式先制（「自身處於能力下降狀態時先制+3」「若對手處於能力提升狀態則先制+1」…）
// 過去只有 SKILL_MODE==="blocks" 的技能（blockCondPriority）與無專屬 handler 的技能
// （conditionalPriorityFromDescription）會套用；有專屬 handler 的技能描述中的條件式先制被靜默略過。
// 這裡沿用積木解析結果（getSkillProgram／matchCond／evalCond），讓所有技能共用同一套判定。
import { getSkillProgram, blockCondPriority } from "../blocks/registry";
import { matchCond } from "../blocks/parse";
import { evalCond } from "../blocks/runtime";
import { CUSTOM } from "../blocks/custom";
import { SKILL_MODE } from "../blocks/specs";

type StatusGetter = (e: any) => Record<string, number>;

/**
 * 條件式先制已由魂印 MODIFY_PRIORITY 以技能名稱自行加算的技能（避免重複計算）。
 * 新增時請同步確認 handler 確實有加先制；移除 handler 內的加算後即可自此清單刪除。
 */
export const COND_PRIORITY_OWNED_BY_HANDLER: ReadonlySet<string> = new Set<string>([
  "王·凰歌盡霄",   // scarlettRegistry MODIFY_PRIORITY
  "帝怒傾天",      // dixinRegistry MODIFY_PRIORITY
  "王·鏽腑喰心",   // opeiaRegistry MODIFY_PRIORITY
  "王·洛浦凌波",   // canglanRegistry MODIFY_PRIORITY
  "九轉輪迴天",    // stagedArena/moiraiRegistry MODIFY_PRIORITY
]);

const PRIO_TAG = /^(.+?時)?(?:額外)?先制\s*([+＋-])\s*(\d+)/;

/** 以積木解析結果計算條件式先制（不受 SKILL_MODE 限制）。 */
export function parsedCondPriority(skill: any, self: any, opp: any, getStatuses: StatusGetter): number {
  if (!skill || !skill.description) return 0;
  const prog = getSkillProgram(skill);
  const ctxLike: any = { self, target: opp, getStatuses, getPlayerState: () => undefined, getOpponentState: () => undefined, getMarks: () => [], actor: "p1", targetSide: "p2", skill };
  const test = (cond: any): boolean => {
    if (!cond) return false;
    try { return evalCond(ctxLike, cond, { last: null, lastAmount: 0 } as any) === true; } catch { return false; }
  };
  let bonus = 0;
  for (const c of prog.clauses) {
    let handled = false;
    for (const b of c.body) for (const a of b.acts) {
      if (a.op === "custom" && CUSTOM[a.p.key]?.prio) { handled = true; bonus += CUSTOM[a.p.key].prio!(self, opp); continue; }
      if (a.op !== "noop") continue;
      const m = String(a.p.tag || "").match(PRIO_TAG);
      if (!m) continue;
      // 「X時先制+N」：條件寫在標籤內；「若X則先制+N」：條件由解析器放在 body.cond
      const cond = m[1] ? (b.cond?.[0] || condOf(m[1].replace(/時$/, ""))) : b.cond?.[0];
      if (!cond) continue;
      handled = true;
      if (test(cond)) bonus += (m[2] === "-" ? -1 : 1) * Number(m[3]);
    }
    if (handled) continue;
    // 解析器未產生先制標籤的寫法（「若自身處於能力下降先制+3並…」「…時當回合先制+3」）：以原文補判
    const raw = String((c as any).raw || "").replace(/^[■🎯\s]+/u, "");
    const r = raw.match(/^(?:若|當回合|當)?((?:自身|對手).{1,12}?)(?:時|則)?(?:當回合)?(?:額外)?先制\s*([+＋])\s*(\d+)/);
    if (r && test(condOf(r[1]))) bonus += Number(r[3]);
  }
  return bonus;
}

/** matchCond 對「自身處於能力下降」這類省略「狀態」的寫法補上後再試一次。 */
function condOf(text: string): any {
  const t = text.replace(/^若/, "").replace(/(時|則)$/, "");
  return matchCond(t) || (/狀態$/.test(t) ? null : matchCond(t + "狀態"));
}

/**
 * 有專屬 handler 的技能之條件式先制：
 * - SKILL_MODE==="blocks"：沿用 blockCondPriority（行為不變）。
 * - 其餘 handler 技能：以積木解析結果計算，已由魂印自行加算者（COND_PRIORITY_OWNED_BY_HANDLER）略過。
 */
export function handlerSkillCondPriority(skill: any, self: any, opp: any, getStatuses: StatusGetter): number {
  if (!skill) return 0;
  if (SKILL_MODE[skill.name] === "blocks") return blockCondPriority(skill, self, opp, getStatuses);
  if (COND_PRIORITY_OWNED_BY_HANDLER.has(skill.name)) return 0;
  return parsedCondPriority(skill, self, opp, getStatuses);
}
