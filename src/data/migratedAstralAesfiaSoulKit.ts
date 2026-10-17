// 5032 星核寰宇·艾斯菲亞 魂印「核」Kit：寰宇星幻（五星＋幻化）、空間躍遷/後手減半、
// 鄰位 PP 竊取、星附屬結束→回合末解除幻化。相關說明段（幻化/空間躍遷/星異常）為規則定義，
// 由引擎（illusion.ts）與 statusRegistry（星異常 mechanics）結算，Kit 條款只掛觸發行為。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const entry = (node: Node, trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});
const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });
const stars = ['星賜', '星哲', '星贖', '星佑', '星護'];
const descHead = '> **出戰時執行寰宇星幻**\r\n\r\n> **先出手則執行空間躍遷，後出手則當回合受到非真實傷害減半且當回合結束時吸取對方等同於自身最大體力½的體力值：**\r\n>> 每次執行上述效果時吸取對方當前在場精靈的所有鄰位精靈的所有技能1點PP值恢復至自身相應技能位\r\n>> 若本次吸取令目標精靈技能PP值歸0則下回合對手無法主動切換精靈\r\n>> 同時將對方當前在場精靈中與目標精靈相同位數的技能PP值扣減至0\r\n\r\n> **寰宇星幻：**\r\n>> 為該精靈附加所有星附屬類異常（默認各3回合）且幻化為對方在場精靈\r\n>> 此後若任意星附屬類異常結束或被解除時則當回合結束時解除幻化';

export const MIGRATED_ASTRAL_AESFIA_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5032'], name: '核',
  description: descHead + '\r\n\r\n---\r\n\r\n## ◆ 相關說明\r\n\r\n> **幻化：**\r\n>> 立繪與顯示變為目標精靈並獲得特性、專屬特性、特質、二代特質、專屬特質\r\n>> 並於原始能力基礎上額外提升該目標精靈等量能力值\r\n>> 使用技能時轉化為該目標精靈相同技能位數的技能並觸發轉化前技能中的變思遷憶效果\r\n>> 幻化解除時失去上述效果，下場時解除幻化\r\n\r\n> **空間躍遷：** 對手施放的攻擊技能無法造成技能傷害且附加效果失效，觸發成功則該技能PP值歸0且當回合自身體力恢復至1/1\r\n\r\n> **沉睡：** 控制類異常狀態；衍化類異常；處於該異常狀態無法行動且期間受到致命一擊傷害時轉化為睡眠；異常結束後轉化為睡眠3回合\r\n\r\n> **睡眠：** 控制類異常狀態；處於該異常狀態則每回合無法行動，若受到攻擊技能命中則睡眠解除\r\n\r\n> **星賜：** 附屬類異常；星附屬類異常狀態；該狀態下的精靈造成的攻擊傷害提升30%，每回合結束後恢復2點PP值\r\n\r\n> **星哲：** 附屬類異常；星附屬類異常狀態；該狀態下的精靈造成的固定傷害、百分比傷害提升30%，每回合結束後恢復最大體力的1/4\r\n\r\n> **星贖：** 附屬類異常；星附屬類異常狀態；處於該異常狀態則體力恢復效果提升30%，戰鬥階段結束時（每回合結束時）所有非限制類異常狀態的回合數+1\r\n\r\n> **星佑：** 附屬類異常；星附屬類異常狀態；處於該異常狀態受到技能傷害降低30%且對手帶有正先制的技能無效；自身體力歸0時100%令自身重生一次並解除所有非控制類異常狀態\r\n\r\n> **星護：** 附屬類異常；星附屬類異常狀態；處於該異常狀態受到固定傷害、百分比傷害降低30%，100%閃避對手所有技能且對手帶有必中的技能使用後該PP值歸1；自身存在技能PP值被消耗歸0時令自身強制保留該技能最大PP值100%並解除自身所有非弱化類異常狀態\r\n\r\n---',
  kit: [
    // 出戰：寰宇星幻——五星各3回合＋幻化為對方在場精靈
    entry('on_entered', 'entrance', '為該精靈附加所有星附屬類異常（默認各3回合）且幻化為對方在場精靈', [
      { acts: [
        ...stars.map(s => a('status', { side: 'self', status: s, chance: 100, turns: 3 })),
        a('illusion_start', { source: '寰宇星幻', pick: 'opp_active', ppBonus: 0 }),
      ] },
    ], 0),
    // 先出手：空間躍遷——本回合受到的技能傷害無效（blockSkillDamage+spaceShift）
    // ＋對手攻擊技能附加效果失效（addInvalid 攻擊，掛對手）＋鄰位 PP 竊取
    entry('before_action', 'before_action', '先出手則執行空間躍遷且每次執行時吸取對方鄰位精靈各1點PP', [
      { cond: [c('first', {}, '先出手')], acts: [
        a('effect_turns', { keys: { blockSkillDamage: true, spaceShift: true }, turns: 1, side: 'self', label: '空間躍遷' }),
        a('add_invalid_turns', { kind: '攻擊', turns: 1 }),
        a('pp_slot_steal', { from: 'opp_adjacent', to: 'self', amount: 1, zeroThen: 'lock_switch' }),
      ] },
    ], 1),
    // 後出手：本回合受到非真實傷害減半＋回合結束吸取對方等同自身最大體力½＋鄰位 PP 竊取
    entry('before_action', 'before_action', '後出手則當回合受到非真實傷害減半且回合結束時吸取對方等同於自身最大體力½的體力值', [
      { cond: [c('last', {}, '後出手')], acts: [
        a('effect_turns', { keys: { halveNonTrue: true }, turns: 1, side: 'self', label: '後手減半' }),
        a('pp_slot_steal', { from: 'opp_adjacent', to: 'self', amount: 1, zeroThen: 'lock_switch' }),
        a('timed', { turns: 1, from: 'now', trig: 'round_end', once: true, label: '後手吸取½', body: [
          // 原文：吸取對方「等同於自身最大體力½」——基數為自身 maxHp；先結算百分比傷害再等量自回。
          { acts: [a('dmg', { base: '最大體力', of: 'self', ratio: 0.5, type: '百分比' }), a('heal_equal', {})] },
        ] }),
      ] },
    ], 2),
    // 空間躍遷反擊：對手攻擊技能被擋下（damage_blocked＋spaceShift 生效中）→ 該槽 PP 歸 0＋自身全恢復
    entry('opponent_after_action', 'opp_after_skill', '空間躍遷觸發成功則該技能PP值歸0且當回合自身體力恢復至1/1', [
      { cond: [c('timer_active', { key: 'spaceShift' }, '空間躍遷生效中'), c('damage_blocked', {}, '本次技能傷害被擋')], acts: [
        a('pp_zero_selected', {}),
        a('heal', { side: 'self', ratio: 1 }),
      ] },
    ], 3),
    // 星附屬結束→回合末解除幻化（監看五星的 status_end；回合末檢查旗標）
    // 星附屬結束事件帶 status 名——用五個條款分別監看（status_end 的 event_status 條件）：
    ...stars.map((s, i) => entry('on_status_ended', 'status_end', `若${s}結束或被解除則當回合結束時解除幻化`, [
      { cond: [c('event_status', { statuses: [s] }, `${s}結束`)], acts: [
        a('timed', { turns: 1, from: 'now', trig: 'round_end', once: true, label: '星幻解除', body: [
          { acts: [a('illusion_end', {})] },
        ] }),
      ] },
    ], 4 + i)),
  ],
};
