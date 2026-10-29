import type { Elf } from '../../types';
import type { AIContext, AIDeps, ElfHint } from './legacyScoring';
import { isStatusActive } from '../../utils/statusManager';
import { isAbnormal } from '../../utils/battleHelpers';
import type { BattleState } from '../../components/BattleManager';
import type { AISide, PlannedAction } from './types';
const anyBuff = (e: Elf) => Object.values(e.statStages || {}).some(v => Number(v) > 0);
const buffCount = (e: Elf) => Object.values(e.statStages || {}).reduce((n, v) => n + Math.max(0, Number(v)), 0);
const hpRatio = (e: Elf) => Math.max(0, Math.min(1, e.currentHp / Math.max(1, e.maxHp)));
export const AI_ELF_HINTS: Record<string, ElfHint> = {
  "鎮魂.巴弗洛": {
    entranceValue: 30,
    skillHints: {
      "鎖魂曲": (c) =>
        (c.opponent.shield ?? 0) > 0
          ? { bonus: 70, reason: "對手持有護盾,鎖魂曲先制+2 直接消除護盾與回合類效果" }
          : { bonus: 20, reason: "干擾技備用,當前對手無明顯增益" },
      "亂魂舞": (c) =>
        !isStatusActive(c.self, "confused")
          ? { bonus: 65, reason: "自身混亂以觸發專屬特性免傷與後續增益" }
          : { bonus: 55, reason: "已混亂,可直接獲得攻擊/速度/命中+2" },
      "訣別": (c) =>
        buffCount(c.opponent) >= 2
          ? { bonus: 85, reason: "對手能力大幅提升,訣別雙倍吸取並反轉為下降" }
          : hpRatio(c.opponent) < 0.4
            ? { bonus: 75, reason: "高威力本系大招,適合收割" }
            : null,
      "贖魂讚詩": (c) => (isAbnormal(c.self) ? { bonus: 40, reason: "自身異常時先制+1 且必中" } : null),
      "引魂咏": (c) => ({ bonus: isAbnormal(c.self) ? 65 : 25, reason: "吸取對手最大體力,續航神技" }),
    },
  },
  "混濁海妖.布林克克": {
    entranceValue: 35,
    skillHints: {
      "溺咒之握": (c) => {
        return isStatusActive(c.opponent, "frostbite") || isStatusActive(c.opponent, "gradual_freeze")
          ? { bonus: 70, reason: "敵方凍傷,溺咒之握觸發冰封並引爆真傷" }
          : null;
      },
      "癡愚之觸": (c) =>
        (c.opponent.shield ?? 0) > 0 || anyBuff(c.opponent)
          ? { bonus: 65, reason: "消除對手護盾/提升並追加 20% 生命真傷" }
          : { bonus: 40, reason: "施加劇毒,為侵蝕鋪路" },
      "深海働哭": (c) =>
        hpRatio(c.self) < 0.65
          ? { bonus: 55, reason: "生命下滑,深海働哭吸取對手並解除異常" }
          : { bonus: 30, reason: "展開吸能光環" },
      "不淨者之約": (c, d) =>
        d.getTypeMatchup(c.opponent.type, "混沌.水") > 1.0
          ? { bonus: 85, reason: "天敵危機!發動不淨者之約先制+3 控場" }
          : { bonus: 40, reason: "架設不淨守護,免疫反彈異常" },
    },
  },
  "變革·馬爾修斯": {
    entranceValue: 45,
    entranceNote: "登場啟動堅壁機甲,獲得最大體力⅓ 護盾",
    bulkModifier: 1.25,
  },
  "誑獅魔軀.魔獅迪露": { entranceValue: 25 },
  "聖靈譜尼": { entranceValue: 40, bulkModifier: 1.2 },
  "治癒.龍魂再臨 次元龍": { entranceValue: 35, bulkModifier: 1.15 },
  "人皇·帝辛": { entranceValue: 40 },
  "聖光斯嘉麗": { entranceValue: 50, entranceNote: "登場召喚珀妮協同作戰" },
  "蓓麗安特": { entranceValue: 45, entranceNote: "戰鬥開始建立星執記錄" },
};
const HINT_IDS: Record<string, string> = { '5008': '鎮魂.巴弗洛', '5007': '混濁海妖.布林克克', '5016': '變革·馬爾修斯', '5009': '誑獅魔軀.魔獅迪露', '5000': '聖靈譜尼', '5021': '治癒.龍魂再臨 次元龍', '5017': '人皇·帝辛', '5014': '聖光斯嘉麗', '5027': '蓓麗安特' };
/** 舊提示只用於回退／候選排序；推演已結算的登場、復活不得再補同一份分。 */
export function elfHint(elf: Elf): ElfHint | undefined {
  if (elf.name === '未知精靈') return undefined;
  return AI_ELF_HINTS[HINT_IDS[String(elf.id)] || elf.name];
}
export interface AIHook {
  /** 只補本回合推演未涵蓋的長期策略；禁止修改state。 */
  strategy?: (state: BattleState, side: AISide, action: PlannedAction) => { bonus: number; reason: string };
}
const hooks = new Map<string, AIHook>();
export const registerAIHook = (id: string, hook: AIHook) => { hooks.set(id, hook); };
export function strategyAdjustment(state: BattleState, side: AISide, action: PlannedAction) {
  const result = hooks.get(String(state[side].id))?.strategy?.(structuredClone(state), side, action);
  return result && Number.isFinite(result.bonus) ? { bonus: Math.max(-100, Math.min(100, result.bonus)), reason: result.reason } : { bonus: 0, reason: '' };
}

