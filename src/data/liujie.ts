import type { Elf, Skill } from '../types';

/** 六界神王轉正資料；目前僅同步卡牌描述，不代表專屬效果已完整實裝。 */
export const LIUJIE_ID = '5031';
export const LIUJIE_SOUL_DESCRIPTION = `【回合開始時】
若自身處於能力提升狀態，則當回合免疫異常狀態且攻擊技能造成的傷害提升50%。
若自身不處於全屬性能力提升狀態，則戰鬥階段結束時令自身全屬性+1且下回合所有技能先制+2。

【自身使用攻擊技能時】
將當次受到的攻擊傷害100%以真實傷害形式反饋給對手。

【每回合結束時】
隨機領悟六大界神的一個秘法：
地葬秘法：為自身附加200點護盾和200點護罩。
瀚海秘法：附加200點固定傷害並恢復等量體力。
混沌秘法：使對手隨機2個技能的PP值歸零。
幻境秘法：下回合攻擊必定打出致命一擊。
天玄秘法：下回合免疫大於400的攻擊傷害。
時空秘法：下回合攻擊技能先制+1。
領悟成功則直到下場前保留，下場後清除對方使用技能紀錄並重置自身體力狀態與PP值狀態為登場時狀態。

【自身被擊敗時】
消除對手回合類效果且能力提升狀態反轉為等量能力下降。
令自身死亡的傷害來源受到等同於自身被擊敗時受到的技能傷害等量的真實傷害（位於場下也可觸發）。`;

const skill = (name: string, category: Skill['category'], power: number, pp: number, priority: number,
  description: string, sureHit = true, fifth = false): Skill => ({
  name, category, type: category === '屬性' ? '無屬性' : '光·次元', power, pp, maxPp: pp,
  accuracy: sureHit ? 100 : 99, priority, isSureHit: sureHit, isFifthSkill: fifth,
  description, effectType: 'none', effectDetail: '',
});

export const LIUJIE_SKILLS_DATA: Skill[] = [
  skill('界・裁決之劍', '物理', 85, 20, 3, `■ 先制+3
■ 命中率99%
🎯 若自身處於能力下降狀態則先制+1且必定命中
🎯 消除對手回合類效果，消除成功則令對手疲憊
🎯 消除對手能力提升狀態，消除成功則對手失明
🎯 反轉自身能力下降狀態，反轉成功則恢復自身最大體力1/3`, false),
  skill('禁靈領域', '屬性', 0, 5, 0, `■ 必中
🎯 全屬性+1，自身處於能力提升狀態時強化效果翻倍
🎯 4回合內每回合恢復自身最大體力的1/3並造成等量固定傷害
  > 自身體力低於1/2時恢復效果和固定傷害翻倍
🎯 3回合內自身能力強化狀態被消除、吸取時則對手2回合使用屬性技能附加效果失效`),
  skill('升臨恩澤', '屬性', 0, 5, 0, `■ 必中
🎯 5回合內免疫並反彈異常狀態
🎯 3回合內每回合附加200點固定傷害，若自身體力低於對手則固定傷害翻倍
🎯 免疫下1次受到的攻擊
🎯 下2回合自身所有技能先制+3`),
  skill('超界審判', '物理', 150, 5, 0, `■ 必中
🎯 當回合處於能力下降狀態則先制+3
🎯 反轉自身能力下降狀態
🎯 使對手隨機2個技能PP歸零
🎯 造成攻擊傷害提升50%，自身處於能力提升狀態時效果翻倍`),
  skill('界·六神歸一', '物理', 160, 5, 0, `■ 必中
🎯 無視對手護盾任意附加效果
🎯 消除對手回合類效果，消除成功則對手疲憊，未觸發則100%令對手麻痺
🎯 為自身附加300點護盾，若後出手則附加效果翻倍
🎯 附加對手300點固定傷害，若先出手則固定傷害提高100點並恢復自身等量體力`, true, true),
];

export const LIUJIE_SEED: Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'> = {
  id: LIUJIE_ID, name: '六界神王', type: '光·次元', level: 100, seerId: 3045,
  baseStats: { hp: 175, atk: 135, def: 115, spatk: 70, spdef: 113, speed: 137 },
  // 沿用命運之輪既有 C 級，不在描述轉正時改動特殊模式的評級與規則。
  destinyRank: 'C',
  description: '由命運之輪轉入卡牌倉庫。專屬特性與技能描述已同步原始TXT；效果執行仍待逐條補全與驗證。',
  soulMark: { name: '界', badgeChar: '界', description: LIUJIE_SOUL_DESCRIPTION, effectType: 'none', effectValue: 0 },
  skills: LIUJIE_SKILLS_DATA.map(s => ({ ...s })),
  skillPool: LIUJIE_SKILLS_DATA.map(s => ({ ...s })),
};
