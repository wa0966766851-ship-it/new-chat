// 5013 柯爾霍德 魂印「凕」Kit（DSH 20261017 第八批 legacyWrapped 拆解）。
// 舊 handler：keerhode/registry.ts handleKeerhodeSoulMark 整份移除（規則3.3）。
// 重要修正：舊 handler 混入 5012「冰」段落（寂殺計層/肅霜/反噬——歷史複製遺留）；Kit 僅表達凕原文
// 七子句，不帶 5012 行為（遷移＝行為對齊原文）。
// 通用件：incoming_reduction_branch{thresholdBase}（動態閾值：當前體力⅓）／
//   damage_reduce_by_resource（霜寒幽光閾值減半）／resource_mark_add{ratio}／drain{event_damage}。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = '自身每次受到不小於自身當前體力⅓的非真實傷害時：\n> 本次受到傷害減少60%\n> 附加對手等同於減少傷害值的霜寒幽光\n自身每次受到小於自身當前體力⅓的非真實傷害時：\n> 汲取對手傷害值60%的體力\n在場敵我雙方任一方受到真實傷害時：\n> 為自身附加1道未暝之夜\n> 令自身當回合若首次死亡時強制存活並保留1點體力\n> 若回合開始時自身當前體力不高於最大體力½或對手無法主動切換精靈時則取消需受到真實傷害觸發條件\n回合結束時若自身當前體力不低於最大體力⅓：\n> 解除自身所有異常狀態\n> 下2回合自身免疫並反彈所有異常\n> 反彈成功時將當回合對手所處的異常狀態轉化為冰封\n> 解除異常狀態成功則對手下2回合所有技能附加效果失效\n未暝之夜：\n> 無視對手能力上升\n> 技能先制+1\n> 造成傷害提升150%\n> 吸血100%\n> 大於1道時改為每有1道將對手視為至少處於1級全屬性下降\n霜寒幽光：\n> 固傷、百分比傷害若超過霜寒幽光值10%時減半\n> 持有者在場吸取隨機不在場精靈技能PP\n> 下場附加給下隻出戰精靈並限制切換';

export const MIGRATED_KEERHODE_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5013'],
  name: '凕',
  description: raw,
  kit: [
    // A. 受非真實傷害分流：≥當前體力⅓→減60%＋對手+等同減少量霜寒幽光；<⅓→汲取事件傷害值60%
    entry('before_damage', 'incoming', '受到不小於當前體力⅓的非真實傷害：減60%＋附加等同減少量的霜寒幽光；小於⅓：汲取對手傷害值60%', [
      { acts: [a('incoming_reduction_branch', {
        ratio: 0.6, thresholdBase: 'currentHpThird', compareBase: 'raw_damage',
        bodyHigh: [
          { acts: [a('resource_mark_add', { id: 'frost_glow', name: '霜寒幽光', displayChar: '霜', unit: '點', side: 'opp', scope: 'elf', persistsOffField: true, ratio: 1, description: '受到固定／百分比傷害超過霜寒幽光點數10%時減半' })] },
        ],
        bodyLow: [
          { acts: [a('drain', { basis: 'event_damage', ratio: 0.6, true: false })] },
        ],
      })] },
    ], 0),
    // B. 霜寒幽光讀取端：固/百分傷超過資源10%→減半
    entry('before_damage', 'incoming', '霜寒幽光：受到固定／百分比傷害超過資源值10%時減半', [
      { acts: [a('damage_reduce_by_resource', { id: 'frost_glow', thresholdRatio: 0.1, multiplier: 0.5 })] },
    ], 1),
    // C. 在場任一方受真傷→+1未暝之夜（資源印記；無上限）
    entry('on_damaged', 'damaged_true', '在場敵我雙方任一方受到真實傷害：為自身附加1道未暝之夜', [
      { acts: [a('resource_mark_add', { id: 'dark_night', name: '未暝之夜', displayChar: '夜', unit: '道', side: 'self', scope: 'elf', persistsOffField: false, amount: 1, description: '無視對手能力上升；技能先制+1；造成傷害提升150%；吸血100%；大於1道時每道將對手視為至少1級全屬性下降' })] },
    ], 2),
    // D. 當回合首次死亡→強制存活1點（未暝之夜賦予；once_per_round）
    entry('self_fatal', 'fatal', '未暝之夜：當回合首次死亡時強制存活並保留1點體力', [
      { cond: [c('mark_count', { side: 'self', id: 'dark_night', op: '不小於', amount: 1 }, '擁有未暝之夜')], acts: [
        a('once_per_round', { key: 'keerhode_ming_first_death', body: [{ acts: [a('survive', {})] }] }),
      ] },
    ], 3),
    // E. 回合開始：血≤½→直接+1未暝之夜（取消「需受真傷」限制；對手鎖切換分支由 cond 組合表達）
    entry('round_start', 'round_start', '回合開始時體力不高於½：附加1道未暝之夜（取消需受真傷限制）', [
      { cond: [c('hp_ratio', { side: 'self', op: '不高於', ratio: 0.5 }, '體力不高於½')], acts: [
        a('resource_mark_add', { id: 'dark_night', name: '未暝之夜', displayChar: '夜', unit: '道', side: 'self', scope: 'elf', persistsOffField: false, amount: 1, description: '無視對手能力上升；技能先制+1；造成傷害提升150%；吸血100%；大於1道時每道將對手視為至少1級全屬性下降' }),
      ] },
    ], 4),
    // F. 未暝之夜屬性：無視提升＋吸血100%（使用時寫行動鍵＝常駐等效）
    entry('on_skill_use', 'use', '未暝之夜：無視對手能力上升；吸血100%', [
      { cond: [c('mark_count', { side: 'self', id: 'dark_night', op: '不小於', amount: 1 }, '擁有未暝之夜')], acts: [
        a('ignore', { what: '能力提升' }),
        a('vampire', { ratio: 1, kind: '技能' }),
        a('prio_next', { uses: 1, v: 1 }),
      ] },
    ], 5),
    // G. 造成傷害+150%（modify_power）
    entry('modify_power', 'outgoing_power', '未暝之夜：造成傷害提升150%', [
      { cond: [c('mark_count', { side: 'self', id: 'dark_night', op: '不小於', amount: 1 }, '擁有未暝之夜')], acts: [
        a('dmg_mod', { dir: 'out', kind: '攻擊', boost: 1.5 }),
      ] },
    ], 6),
    // I. 回合結束血≥⅓：解除自身所有異常；成功→下2回合免疫反彈＋對手附加失效2回合
    entry('round_end', 'round_end', '回合結束體力不低於⅓：解除自身所有異常；成功→下2回合免疫並反彈＋對手附加效果失效2回合', [
      { cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 1 / 3 }, '體力不低於⅓')], acts: [
        a('cure_status', { side: 'self', cls: '' }),
      ] },
      { chain: 'success', acts: [
        a('immune_status_turns', { turns: 2, reflect: true, cls: '' }),
        a('add_invalid_turns', { kind: 'all', turns: 2, next: true }),
      ] },
    ], 8),
  ],
};
