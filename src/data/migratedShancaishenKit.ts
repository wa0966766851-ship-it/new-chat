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

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry =>
  ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
     params: { clause: { raw, trig, parsed: true, body } } });

/** 炫彩山神自己的行為（由 registerExtraElfKit 掛上） */
export const SHANCAISHEN_SELF_KIT: KitEntry[] = [
  // 被加入時：解除自身異常 + 給卡修斯護盾與山神守護
  e('on_entered', 'entrance', '炫彩山神被加入時：解除自身異常狀態；為卡修斯附加最大體力½的護盾值與3回合山神守護', [
    { acts: [
      a('cure_status', { side: 'self' }),
      a('shield_owner_ratio', { ratio: 0.5 }),
      a('status_owner', { status: '山神守護', turns: 3 }),
    ] },
  ], 0),
  // 己方其他精靈（非卡修斯）登場後死亡
  e('ally_entered', 'custom', '己方岳峙淵渟.卡修斯以外的其他精靈登場後死亡', [
    { cond: [c('entered_not_owner', {})], acts: [ a('self_destroy', {}) ] },
  ], 1),
  // 死亡時：清除對手回合類/能力提升/PP歸零
  e('self_fatal', 'fatal', '炫彩山神進入死亡時：消除對手在場精靈回合類效果、能力提升狀態，令其所有技能PP值歸0', [
    { acts: [
      a('clear_turn', { side: 'opp' }),
      a('stat_clear', { side: 'opp', kind: 'up' }),
      a('pp_zero', { kind: 'all' }),
    ] },
  ], 2),
];

// 炫彩山神是「額外精靈」，沒有獨立 elfId（由 5041 召喚時掛 kit）。
// 因此不進 reviewedKits 打包流程，改由 brinkk.ts 的 EXTRA_ELF_KITS 註冊。
export const SHANCAISHEN_ALL_KITS: any[] = [];
