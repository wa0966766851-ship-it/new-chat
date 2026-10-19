// 5012 冰魄·柯爾德 魂印「冰」Kit（DSH 20261017 第七批 legacyWrapped 拆解）。
// 舊 handler：keld/registry.ts handleKeldSoulMark 整份移除（規則3.3 整份轉）。
// 通用件：incoming_reduction_branch／damage_cap_by_mark／backlash_percent／
//   event_damage_type／first_hit（keldSoul.ts）；drain{event_damage}；opp_priority_ceiling。
// 跨定義：frost_ban 寫入端由本 Kit 維持（凝寒止喧 Kit multi_hit perMarkHits 讀取依賴）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = '常駐效果：\n> 自身受到的非真實傷害額外減少60%\n> 若以此法減少的傷害值不高於200點則戰鬥階段結束時自身受到25%的真實傷害\n> 若不低於200點且自身擁有寂殺之魄則令對手凍傷3回合，未觸發則消除對手回合類效果且下2回合對手無法主動切換精靈\n自身受到真實傷害時：\n> 獲得1道寂殺之魄，汲取對手受到傷害值2倍的體力值\n受到致死真實傷害時：\n> 自身強制存活並恢復自身1點體力\n自身無視對手的能力提升效果：\n> 若存在1道寂殺之魄額外無視自身能力下降\n> 存在2道改為視為對手能力下降與自身能力上升並觸發對應效果\n> 存在3道攻擊時無視對手傷害限制、免疫攻擊且對手1回合內回血下降100%\n自身使用攻擊技能後：\n> 若對手處於能力提升狀態100%令對手冰封，未觸發附加200點肅霜之禁\n寂殺之魄：\n> 異常狀態時無視對手不高於層數的先制（異常時3倍），最高3層下場保留\n肅霜之禁：\n> 造成的技能傷害無法超過點數，觸發或主動下場減少200點\n> 對手每有寂殺之魄減少效果下降50點，最高200點（boss無效）';

export const MIGRATED_KELD_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5012'],
  name: '冰',
  description: raw,
  kit: [
    // A. 常駐：受到非真實傷害減免60%＋閾值分支（before_damage 每次計算生效）
    entry('before_damage', 'incoming', '常駐：受到非真實傷害額外減少60%；減免量與200比較分支', [
      { acts: [a('incoming_reduction_branch', {
        ratio: 0.6, threshold: 200,
        bodyLow: [
          { acts: [a('pending_counter', { key: 'keldBacklash', amount: 1, label: '冰魄反噬' })] },
        ],
        bodyHigh: [
          { cond: [c('mark_count', { side: 'self', id: 'keld_soul', op: '不小於', amount: 1 }, '擁有寂殺之魄')], acts: [
            a('status', { side: 'opp', status: '凍傷', turns: 3, chance: 100 }),
          ] },
          { cond: [c('mark_count', { side: 'self', id: 'keld_soul', op: '低於', amount: 1 }, '未觸發')], acts: [
            a('clear_turn', { side: 'opp' }),
            a('switch_lock', { side: 'opp', turns: 2, next: true }),
          ] },
          // 持有寂殺之魄但凍傷未觸發（對手免疫／附加失敗）：同樣視為「未觸發」，消除回合類效果＋下2回合無法主動切換。
          { chain: 'fail', cond: [c('mark_count', { side: 'self', id: 'keld_soul', op: '不小於', amount: 1 }, '擁有寂殺之魄')], acts: [
            a('clear_turn', { side: 'opp' }),
            a('switch_lock', { side: 'opp', turns: 2, next: true }),
          ] },
        ],
      })] },
    ], 0),
    // B. 戰鬥階段結束：反噬 25%×計數（真實傷害）
    entry('battle_phase_end', 'phase_end', '戰鬥階段結束時：冰魄反噬（每點計數25%最大體力真實傷害）', [
      { acts: [a('backlash_percent', { key: 'keldBacklash', ratio: 0.25, type: '真實', consume: true })] },
    ], 1),
    // C. 受到真實傷害：+1道寂殺之魄（上限3、下場保留）＋汲取對手受到傷害值2倍
    entry('on_damaged', 'damaged_true', '受到真實傷害：獲得1道寂殺之魄，汲取對手受到傷害值2倍的體力', [
      { acts: [
        a('resource_mark_add', { id: 'keld_soul', name: '寂殺之魄', displayChar: '魄', unit: '道', description: '異常狀態時無視對手不高於層數的先制（異常時3倍），最高3層下場保留', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 3 }),
        a('drain', { basis: 'event_damage', ratio: 2, true: false }),
      ] },
    ], 2),
    // D. 受到致死真實傷害：強制存活並保留1點體力（僅真實傷害致死）
    entry('self_fatal', 'fatal', '受到致死真實傷害：強制存活並保留1點體力', [
      { cond: [c('event_damage_type', { type: '真實' }, '本次為真實傷害')], acts: [
        a('survive', {}),
      ] },
    ], 3),
    // E. 無視對手能力提升（常駐）；依層數加成（每次攻擊前寫行動鍵＝常駐等效）
    entry('on_skill_use', 'use', '自身無視對手的能力提升效果；依寂殺之魄層數加成', [
      { acts: [a('ignore', { what: '能力提升' })] },
      { cond: [c('mark_count', { side: 'self', id: 'keld_soul', op: '不小於', amount: 1 }, '1道以上')], acts: [
        // 1道：額外無視自身能力下降（行動鍵 selfDropIgnoredThisAction；damageCalculator 讀取端）
        a('ignore', { what: '自身能力下降' }),
      ] },
      { cond: [c('mark_count', { side: 'self', id: 'keld_soul', op: '不小於', amount: 2 }, '2道以上')], acts: [
        // 2道：改為視為對手能力下降與自身能力上升（行動鍵，每次攻擊前重寫＝常駐等效）
        a('ignore', { what: '對手提升視為下降' }),
        a('ignore', { what: '自身能力下降' }),
      ] },
      { cond: [c('mark_count', { side: 'self', id: 'keld_soul', op: '不小於', amount: 3 }, '3道')], acts: [
        // 3道：攻擊時無視傷害限制、免疫攻擊＋對手1回合回血下降100%
        a('ignore', { what: '傷害限制' }),
        a('ignore', { what: '攻擊免疫' }),
        a('recovery_reduce_turns', { side: 'opp', ratio: 1, turns: 1, includePotions: false, next: false }),
      ] },
    ], 4),
    // F. 使用攻擊技能後（首擊）：對手提升→冰封 else +200肅霜之禁
    entry('after_attack_hit', 'attack_hit', '使用攻擊技能後：對手處於能力提升→100%冰封；未觸發→附加200點肅霜之禁', [
      { cond: [c('first_hit', {}, '本行動首擊'), c('stage', { side: 'opp', kind: 'up' }, '對手能力提升')], acts: [
        a('status', { side: 'opp', status: '冰封', turns: 3, chance: 100 }),
      ], elseActs: [
        a('once', { key: 'keld_frost_ban_this_action', body: [{ acts: [
          a('resource_mark_add', { id: 'frost_ban', name: '肅霜之禁', displayChar: '禁', unit: '點', description: '造成的技能傷害無法超過點數；觸發或主動下場減少200點', side: 'opp', scope: 'elf', persistsOffField: true, amount: 200 }),
        ] }] }),
      ] },
    ], 5),
    // G. 寂殺之魄先制屬性：異常狀態時無視對手不高於層數×3的先制（先制結算前寫封頂）
    entry('modify_priority', 'modify_priority', '寂殺之魄：異常狀態時無視對手不高於層數×3的先制', [
      { cond: [c('abnormal', { side: 'self' }, '自身處於異常狀態')], acts: [
        a('opp_priority_ceiling', { perMark: { id: 'keld_soul', side: 'self', mult: 3 } }),
      ] },
    ], 6),
    // H. 肅霜之禁讀取端：對手的技能傷害無法超過點數；觸發時減200（on_damaged）
    entry('before_damage', 'outgoing', '肅霜之禁：對手造成的技能傷害無法超過點數', [
      { acts: [a('damage_cap_by_mark', { id: 'frost_ban', deduct: 200 })] },
    ], 7),
    // 肅霜之禁「主動下場減少200點」：on_switch_out carried（headless 切換驅動受限，結構存在＋ deduct 由 damage_cap_by_mark 觸發時扣）
  ],
};
