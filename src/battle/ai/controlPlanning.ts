/**
 * AI 控場規劃（2026-11-07 使用者要求）：
 * 「AI 實戰有控場慾望（權重較大），想盡辦法控制對手，並以最有效率的方式維持控場與輸出平衡；
 *  巔峰模式有 50 回合上限時也是追求勝利與控制。」
 *
 * - 技能的控制能力：先讀技能積木（status 動作、對手、機率），沒有積木再讀說明文字。
 * - 控場節奏：對手未受控 → 開控（高分）；控制剩 1 回合 → 續控；仍受控 ≥2 回合 → 不浪費控制，改趁控輸出。
 * - 對手免疫異常（免疫／神話／異常抵抗／免疫異常回合）時控制不加分。
 * - 回合上限（巔峰 6V6：50 回合，滿回合依存活精靈數判勝負）：越接近上限越看重「擊倒數」；
 *   領先時重控制與保命，落後時重輸出與擊倒。
 */
import type { Elf, Skill } from '../../types';

/** 會讓對手無法行動的異常（與 StatusRegistry 的 CANT_ACT 一致；隨 AIDeps.isControlStatus 再確認）。 */
export const CONTROL_WORDS = ['麻痺', '麻痹', '害怕', '睡眠', '石化', '疲憊', '冰封', '焚燼', '感染', '癱瘓', '狂信', '沉睡', '神游', '空定', '詛咒', '神悔', '眩暈'];
const IMMUNE_STATUSES = ['免疫', '神話', '異常抵抗'];

export interface SkillControl { statuses: string[]; chance: number }

/** 從積木找「對對手附加異常」的動作（遞迴，含條件分支）。 */
function kitControl(node: any, isControl: (n: string) => boolean, out: { statuses: Set<string>; chance: number }, depth = 0): void {
  if (!node || depth > 12) return;
  if (Array.isArray(node)) { for (const x of node) kitControl(x, isControl, out, depth + 1); return; }
  if (typeof node !== 'object') return;
  if (node.op === 'status' && node.p && node.p.side !== 'self' && typeof node.p.status === 'string' && isControl(node.p.status)) {
    out.statuses.add(node.p.status);
    out.chance = Math.max(out.chance, Number.isFinite(node.p.chance) ? Math.max(0, Math.min(100, node.p.chance)) : 100);
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') kitControl(v, isControl, out, depth + 1);
}

/** 說明文字：同一行內「（N%）令／使對手…X」；排除「若對手處於X」「免疫／解除／反彈X」與自身陷入。 */
function textControl(text: string, isControl: (n: string) => boolean): SkillControl | null {
  const statuses = new Set<string>(); let chance = 0;
  for (const line of String(text || '').split(/\n/)) {
    for (const w of CONTROL_WORDS) {
      if (!isControl(w)) continue;
      let i = line.indexOf(w);
      while (i >= 0) {
        const before = line.slice(Math.max(0, i - 14), i);
        const negated = /(處於|免疫|解除|反彈|無法附加|轉化|若對手|若自身|自身陷入|自身進入)[^，。；]*$/.test(before);
        const toFoe = /(令|使|附加|造成)?(對手|對方|敵方)/.test(before) || /\d+%/.test(before);
        if (!negated && toFoe) {
          statuses.add(w);
          const pct = before.match(/(\d+)%(?!.*\d+%)/);
          chance = Math.max(chance, pct ? Math.min(100, Number(pct[1])) : 100);
        }
        i = line.indexOf(w, i + w.length);
      }
    }
  }
  return statuses.size ? { statuses: [...statuses], chance } : null;
}

export function skillControl(skill: Skill, isControl: (n: string) => boolean): SkillControl | null {
  const kit = (skill as any).kit;
  if (Array.isArray(kit) && kit.length) {
    const out = { statuses: new Set<string>(), chance: 0 };
    kitControl(kit, isControl, out);
    if (out.statuses.size) return { statuses: [...out.statuses], chance: out.chance };
  }
  return textControl(skill.description || '', isControl);
}

/** 對手目前受控的剩餘回合（0＝未受控）。 */
export function controlTurnsLeft(foe: Elf, getStatuses: (e: Elf) => Record<string, number>, isControl: (n: string) => boolean): number {
  const st = getStatuses(foe) || {};
  return Math.max(0, ...Object.entries(st).filter(([n, t]) => Number(t) > 0 && isControl(n)).map(([, t]) => Number(t)));
}
export function immuneToStatus(foe: Elf, getStatuses: (e: Elf) => Record<string, number>): boolean {
  const st = getStatuses(foe) || {};
  return IMMUNE_STATUSES.some(n => Number(st[n] || 0) > 0) || Number((foe as any).immuneStatusTurns || 0) > 0;
}

/** 控場加分：開控／續控／已在控（不重複浪費）。 */
export function controlValue(ctl: SkillControl | null, foeCtlTurns: number, opponentCanKO: boolean): { value: number; reason: string } {
  if (!ctl) return { value: 0, reason: '' };
  const p = ctl.chance / 100;
  const name = ctl.statuses.join('／');
  if (foeCtlTurns <= 0) return { value: Math.round((64 + (opponentCanKO ? 30 : 0)) * p), reason: `開控：令對手【${name}】${opponentCanKO ? '，阻止對方斬殺' : ''}` };
  if (foeCtlTurns <= 1) return { value: Math.round(50 * p), reason: `續控：對手控制即將解除，再上【${name}】` };
  return { value: 0, reason: '' };
}

/** 回合上限局勢：remaining＝剩餘回合（含本回合），urgency 0~1，lead＝存活數差（我方－對方）。 */
export function turnLimitState(turn: number, limit: number | undefined, team: Elf[], foeTeam: Elf[] | undefined) {
  if (!limit || !foeTeam) return null;
  const remaining = limit - turn + 1;
  const alive = (t: Elf[]) => t.filter(e => e && !e.isExtra && !e.isVanished && e.currentHp > 0).length;
  const urgency = remaining <= 12 ? Math.min(1, (13 - remaining) / 12) : 0;
  return { remaining, urgency, lead: alive(team) - alive(foeTeam) };
}
