// 炫彩山神（額外精靈，id: shancaishen；DSH 2026-10-31）
// 由 5041 岳峙淵渟.卡修斯 召喚。
//
// 官方：
//   額外精靈炫彩山神：
//   >能力值等同於任一方岳峙淵渟.卡修斯中能力最高者
//   >己方岳峙淵渟.卡修斯以外的其他精靈登場後死亡
//   炫彩山神被加入時：
//   >解除自身異常狀態
//   >為岳峙淵渟.卡修斯附加最大體力½的護盾值
//   >為岳峙淵渟.卡修斯附加3回合山神守護
//   炫彩山神進入死亡時：
//   >消除對手在場精靈回合類效果
//   >消除對手在場精靈能力提升狀態
//   >令對手在場精靈所有技能PP值歸0
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import texts from './cassiusShanText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry =>
  ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
     params: { clause: { raw, trig, parsed: true, body } } });

/**
 * 炫彩山神自己的行為（由 brinkk.ts 的 EXTRA_ELF_KITS 掛到 elf.kit；執行端見 battle/extraElfKit.ts）。
 * 能力值句（「等同於任一方卡修斯中能力最高者」）屬召喚參數，寫在卡修斯召喚子句：
 *   summon_extra_elf { statSource:'highest_of_name', statName:'岳峙淵渟.卡修斯', statMode:'each' }
 *   決議（DSH）：敵我雙方所有岳峙淵渟.卡修斯，每一項能力各取最高值（statMode:'each'，亦為預設）。
 */
/**
 * 炫彩山神的魂印文字（原文，與 5041 魂印中該段逐字相同，cassiusShanText.json 的 shancaishen）。
 * 召喚時由 summon_extra_elf 以名稱查註冊表掛到額外精靈 soulMark，詳情面板／提示即可顯示。
 */
export const SHANCAISHEN_DESCRIPTION: string = (texts as any).shancaishen;
export const SHANCAISHEN_SOULMARK = { name: '炫彩山神', badgeChar: '神', description: SHANCAISHEN_DESCRIPTION, effectType: 'none' as const, effectValue: 0 };
/** 額外精靈 Kit 定義（description 與 kit 條款同一來源；條款句與描述各行對齊）。 */
export const SHANCAISHEN_KIT_DEF = (): { kind: 'soul'; name: string; description: string; kit: KitEntry[] } =>
  ({ kind: 'soul', name: '炫彩山神', description: SHANCAISHEN_DESCRIPTION, kit: SHANCAISHEN_SELF_KIT });

export const SHANCAISHEN_SELF_KIT: KitEntry[] = [
  // 被加入時（addExtraElf 完成後派發一次）：解除自身異常；為卡修斯附加最大體力½護盾與3回合山神守護
  e('on_entered', 'entrance', '炫彩山神被加入時：解除自身異常狀態；為岳峙淵渟.卡修斯附加最大體力½的護盾值；為岳峙淵渟.卡修斯附加3回合山神守護', [
    { acts: [ a('extra_cure_self', {}) ] },
    { acts: [ a('extra_owner_shield', { ratio: 0.5 }) ] },
    { acts: [ a('extra_owner_status', { status: '山神守護', turns: 3 }) ] },
  ], 0),
  // 己方岳峙淵渟.卡修斯以外的其他精靈登場後死亡
  e('ally_entered', 'ally_entered', '己方岳峙淵渟.卡修斯以外的其他精靈登場後死亡', [
    { cond: [c('entered_not_owner', {})], acts: [ a('extra_die', {}) ] },
  ], 1),
  // 進入死亡時：消除對手回合類效果、能力提升，令對手所有技能PP歸0
  e('self_fatal', 'fatal', '炫彩山神進入死亡時：消除對手在場精靈回合類效果；消除對手在場精靈能力提升狀態；令對手在場精靈所有技能PP值歸0', [
    { acts: [
      a('clear_turn', { side: 'opp' }),
      a('stat_clear', { side: 'opp', kind: 'up' }),
      a('pp_zero', {}),
    ] },
  ], 2),
];

// 炫彩山神是「額外精靈」，沒有獨立 elfId（由 5041 召喚時掛 kit）。
// 因此不進 reviewedKits 打包流程，改由 brinkk.ts 的 EXTRA_ELF_KITS 註冊。
export const SHANCAISHEN_ALL_KITS: any[] = [];
