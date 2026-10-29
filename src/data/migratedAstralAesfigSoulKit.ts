// 5033 星軌重構·艾斯菲格 魂印「格」Kit：思維固化（paired_initial 幻化+10臨時PP）、
// 思維干涉/空間跳躍（先手減半反彈/後手抵擋+對手-2）、每次執行吸取⅓、三條件解除。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const entry33 = (node: Node, trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});
const c3 = (name: string, p: any, label: string) => ({ c: name, p, label });

export const MIGRATED_ASTRAL_AESFIG_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5033'], name: '格',
  description: '> **每次登場時執行思維固化**\r\n\r\n> **自身先出手時執行思維干涉，後出手時執行空間跳躍且下回合對手先制-2：**\r\n>> 每次上述效果執行時額外吸取對手最大體力⅓\r\n>> 對手受到百分比傷害後若體力減少量低於200則2回合內技能附加效果失效\r\n\r\n> **思維固化：**\r\n>> 若自身初始位於出戰背包則使幻化為己方初始待命背包中的對應相同位數的精靈\r\n>> 若自身初始位於待命背包中則使自身幻化為己方初始出戰背包中的對應相同位數的精靈\r\n>> 之後下列條件均滿足則解除幻化：\r\n>>> 1. 本次在場累計分別受到5次技能傷害、固定傷害、百分比傷害、真實傷害\r\n>>> 2. 本次在場受到5次異常狀態\r\n>>> 3. 自身登場次數高於5\r\n>> 未滿足條件前所有技能PP值獲得10點臨時上限\r\n\r\n---\r\n\r\n## ◆ 相關說明\r\n\r\n> **幻化：**\r\n>> 立繪與顯示變為目標精靈並獲得特性、專屬特性、特質、二代特質、專屬特質\r\n>> 並於原始能力基礎上額外提升該目標精靈等量能力值\r\n>> 使用技能時轉化為該目標精靈相同技能位數的技能並觸發轉化前技能中的變思遷憶效果\r\n>> 幻化解除時失去上述效果，下場時解除幻化\r\n\r\n> **思維干涉：** 將自身當回合受到的技能傷害減半並以真實傷害形式將原始技能傷害100%反彈給對手\r\n\r\n> **空間跳躍：** 抵擋當回合受到的技能傷害\r\n\r\n> **沉睡：** 控制類異常狀態；衍化類異常；處於該異常狀態無法行動且期間受到致命一擊傷害時轉化為睡眠；異常結束後轉化為睡眠3回合\r\n\r\n> **睡眠：** 控制類異常狀態；處於該異常狀態則每回合無法行動，若受到攻擊技能命中則睡眠解除\r\n\r\n> **星賜：** 附屬類異常；星附屬類異常狀態；該狀態下的精靈造成的攻擊傷害提升30%，每回合結束後恢復2點PP值\r\n\r\n> **星哲：** 附屬類異常；星附屬類異常狀態；該狀態下的精靈造成的固定傷害、百分比傷害提升30%，每回合結束後恢復最大體力的1/4\r\n\r\n> **星贖：** 附屬類異常；星附屬類異常狀態；處於該異常狀態則體力恢復效果提升30%，戰鬥階段結束時（每回合結束時）所有非限制類異常狀態的回合數+1\r\n\r\n> **星佑：** 附屬類異常；星附屬類異常狀態；處於該異常狀態受到技能傷害降低30%且對手帶有正先制的技能無效；自身體力歸0時100%令自身重生一次並解除所有非控制類異常狀態\r\n\r\n> **星護：** 附屬類異常；星附屬類異常狀態；處於該異常狀態受到固定傷害、百分比傷害降低30%，100%閃避對手所有技能且對手帶有必中的技能使用後該PP值歸1；自身存在技能PP值被消耗歸0時令自身強制保留該技能最大PP值100%並解除自身所有非弱化類異常狀態\r\n\r\n---',
  kit: [
    entry33('on_entered', 'entrance', '每次登場時執行思維固化：幻化為己方初始背包對應相同位數的精靈且所有技能PP值獲得10點臨時上限', [
      { acts: [a('illusion_start', { source: '思維固化', pick: 'paired_initial', ppBonus: 10 })] },
    ], 0),
    // 先後手被確定後，任一方出手前即開啟本回合被動（不等後手挨打完才生效）；
    // 自己出手（before_action）與對手出手（on_attacked）兩個時點各派發一次，以 round_once 去重。
    entry33('before_action', 'before_action', '先出手執行思維干涉（技能傷害減半）且額外吸取對手最大體力⅓', [
      { acts: [a('round_once', { key: 'aesfigRoundEffect' })] },
      { chain: 'success', cond: [c3('first', {}, '先出手')], acts: [
        a('effect_turns', { keys: { halveNonTrue: true }, turns: 1, side: 'self', label: '思維干涉' }),
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
      { chain: 'success', cond: [c3('last', {}, '後出手')], acts: [
        a('effect_turns', { keys: { blockSkillDamage: true }, turns: 1, side: 'self', label: '空間跳躍' }),
        a('prio_turns', { side: 'opp', v: -2, turns: 1 }),
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
    ], 1),
    entry33('on_attacked', 'opp_skill', '對手出手前開啟本回合先後手被動（後手方在受擊前即建立抵擋）', [
      { acts: [a('round_once', { key: 'aesfigRoundEffect' })] },
      { chain: 'success', cond: [c3('first', {}, '先出手')], acts: [
        a('effect_turns', { keys: { halveNonTrue: true }, turns: 1, side: 'self', label: '思維干涉' }),
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
      { chain: 'success', cond: [c3('last', {}, '後出手')], acts: [
        a('effect_turns', { keys: { blockSkillDamage: true }, turns: 1, side: 'self', label: '空間跳躍' }),
        a('prio_turns', { side: 'opp', v: -2, turns: 1 }),
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
    ], 2),
    // 三條件解除：aesfig_release_check（條件型動作）→ chain success → illusion_end
    entry33('round_end', 'round_end', '下列條件均滿足則解除幻化：五類傷害各5次、5次異常、登場次數高於5', [
      { acts: [a('aesfig_release_check', {})] },
      { chain: 'success', acts: [a('illusion_end', {})] },
    ], 3),
  ],
};
