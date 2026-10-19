// 5002 帝皇之盾 魂印「盾」Kit（DSH 20261018 第十一批 legacyWrapped 拆解·第一波）。
// 舊 handler：imperial-shield/registry.ts handleImperialShieldSoulMark 整份移除（規則3.3）。
// 通用件：defer_shield_to_next（陣亡轉贈護盾值＋守護印記旗標——nextElfPending／battleRule 讀取端）、
//   shield／status_guard／stat／stat_clear／turn_key_set 皆既有。
// 守護印記的層數曲線（25%＋每層10%，上限55%）與 4 回合期限由 effects/guardianMarkRegistry ＋
//   elves/imperial-shield/battleRule 的通用規格承擔（維持原讀取端，未改寫）。
// 封技攔截是「命運之輪 C 級攔截卡」效果（destinyInterceptors），非魂印條目——不進本 Kit
//   （原文末段【命運之輪 C 級專屬攔截】僅附註於 description；魂印本身不封技，一般戰鬥不得封鎖對手攻擊技能）。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

// body 已是 stmt 陣列（{acts:[...]} 或 {cond,acts}）；純 op 由 a() 包一層。
const e = (node: Node, trig: string, raw: string, body: any[], order: number, role: KitEntry['role'] = 'innate'): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role, node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });

export const MIGRATED_IMPERIAL_SHIELD_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5002'],
  name: '盾',
  description: '登場時：\n> 獲得自身最大體力1/3的護盾\n回合開始時自身擁有護盾：\n> 免疫所有異常狀態\n> 令對手全屬性-1\n自身被擊敗時：\n> 將剩餘護盾值轉化為守護印記附加給下一隻登場的己方精靈\n> 消除對手能力提升狀態，消除成功則令對手2回合內攻擊技能PP消耗提升3倍\n守護印記：\n> 持有者受到攻擊傷害減少25%，每層額外+10%，最高55%\n> 持續4回合\n\n【命運之輪 C 級專屬攔截：封技攔截】\n登場時：\n> 使對手當前精靈下1回合無法選擇使用攻擊技能',
  kit: [
    // 登場時：獲得自身最大體力1/3的護盾
    e('on_entered', 'entrance', '登場時獲得自身最大體力1/3的護盾', [{ acts: [a('shield', { ratio: 1 / 3 })] }], 0),
    // 回合開始（自身擁有護盾）：令對手全屬性-1
    e('round_start', 'round_start', '回合開始時自身擁有護盾：令對手全屬性-1', [
      { cond: [c('shield', { side: 'self' })], acts: [a('stat', { side: 'opp', stats: ['全屬性'], v: -1 })] },
    ], 1),
    // 常駐（自身擁有護盾）：免疫所有異常狀態（異常附加前查詢）
    e('before_status_apply', 'before_status', '自身擁有護盾時免疫所有異常狀態', [
      { cond: [c('shield', { side: 'self' })], acts: [a('status_guard', { cls: '' })] },
    ], 2),
    // 被擊敗時：剩餘護盾→守護印記給下一隻；消除對手能力提升（成功→對手2回合攻擊PP消耗3倍）
    e('cthyaat_death', 'defeated', '自身被擊敗時將剩餘護盾值轉化為守護印記附加給下一隻登場的己方精靈，並消除對手能力提升狀態（消除成功則令對手2回合內攻擊技能PP消耗提升3倍）', [
      { acts: [a('defer_shield_to_next', { guardianMark: true })] },
      { acts: [a('stat_clear', { side: 'opp', kind: 'up' })] },
      { chain: 'success', acts: [
        a('turn_key_set', { key: 'attackPpMultiplierTurns', turns: 2, side: 'opp', reason: '盾·盾碎', label: '攻擊技能PP消耗提升3倍' }),
        a('turn_key_set', { key: 'attackPpMultiplierValue', turns: 2, side: 'opp', reason: '盾·盾碎倍率', label: 'PP消耗提升倍率' }),
      ] },
    ], 3),
  ] };
