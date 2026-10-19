// 5015 混沌·布萊克 魂印「夜」真 Kit（DSH 20261018 第十一批·第一波 legacyWrapped 拆解）。
// 舊 handler：chaos-blake/registry.ts handleChaosBlakeNightSoulMark 整份空殼化（保留匯出名，規則3.3）；
//   另一同檔 handleChaosBlakeSoulMark 是舊 id 1012 魂印「混」，非 5015 定義，維持原狀。
// 新通用件（皆可編輯積木，零專屬分支）：
//   status_immunity_bypass／status_conversion_ban（blocks/ops/statusSovereignty.ts；
//     讀取端 battle/contextBuilders.applyStatusWithImmunityCheck ＋ blocks/runtime.convert_status）
//   fail_kind 條件（引擎 failAction 的 ActionResultInfo.failKind：invalid／miss／evade／immune）
// 既有件：status／status_guard／timed(once)／prio_next／prio_bonus(新)／dmg_mod_uses／immune_status_count／
//   ignore／soul_property(evade)／event_hit／at_round_end／dmg(stat:攻擊)／heal_equal／
//   drain／clear_turn／cure_status／survive／once。
// 語界說明：「下1次異常轉3回合狂暴」以 timed(once, before_status)→status_guard+status(狂暴,3) 實作
//   （阻止本次來襲異常、改附3回合狂暴＝轉化）；「下1次攻擊無視限制」以 timed(once, self_attack)→ignore 實作；
//   死亡分支的回合末解除以 at_round_end→cure_status 全清＋重附狂暴（舊 handler 保留狂暴之語意）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = "常駐效果：\n> 自身所有異常狀態免疫類效果始終無法免疫狂暴且狂暴無法被轉化為其他異常狀態\n自身能力提升狀態被消除或吸取時：\n> 100%使對手害怕\n> 未觸發則將自身受到的下1次異常狀態轉化為3回合的狂暴狀態\n自身處於狂暴狀態時：\n> 所有技能先制+1\n對手使用屬性技能時：\n> 自身免疫下1次受到的異常狀態\n> 自身下1次攻擊技能無視對手傷害限制、傷害免疫、攻擊免疫效果\n對手使用攻擊技能時：\n> 自身有100%的機率閃避對手攻擊\n> 若該效果觸發則下2次攻擊技能先制+2且造成的傷害提升50%\n> 若該效果未觸發則回合結束時附加自身攻擊值50%的百分比傷害並回復等量體力值\n自身死亡時：\n> 100%的機率會殘留1點體力\n> 回合結束時解除自身異常狀態\n> 消除對手回合類效果\n> 100%令對手詛咒\n> 吸取對手最大體力1/3\n> 使自身進入3回合的狂暴狀態（每場戰鬥最多觸發1次）";

export const MIGRATED_NIGHT_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5015'],
  name: '夜',
  description: raw,
  kit: [
    // A. 常駐主權：狂暴不受任何免疫類效果影響、狂暴無法被轉化為其他異常狀態（開局寫入個體範圍鍵）
    entry('battle_start', 'battle_start', '常駐：自身所有異常狀態免疫類效果始終無法免疫狂暴且狂暴無法被轉化為其他異常狀態', [
      { acts: [
        a('status_immunity_bypass', { statuses: ['狂暴'] }),
        a('status_conversion_ban', { statuses: ['狂暴'] }),
      ] },
    ], 0),
    // B. 能力提升被消除／吸取：100%令對手害怕；未觸發→自身受到的下1次異常狀態轉化為3回合狂暴
    entry('on_stat_boost_cleared', 'stat_boost_cleared', '自身能力提升狀態被消除或吸取時：100%使對手害怕，未觸發則將自身受到的下1次異常狀態轉化為3回合的狂暴狀態', [
      { acts: [a('status', { side: 'opp', status: '害怕', turns: 3, chance: 100 })] },
      { chain: 'fail', acts: [a('timed', { turns: 99, from: 'now', trig: 'before_status', once: true, label: '夜·下1次異常轉狂暴', body: [
        { acts: [a('status_guard', { cls: '' }), a('status', { side: 'self', status: '狂暴', turns: 3, chance: 100 })] },
      ] })] },
    ], 1),
    // C. 處於狂暴時：所有技能先制+1（prio_bonus：先制判定事中查詢，與舊 handler priorityComp.bonus 同語意；條件不成立即不加）
    entry('modify_priority', 'modify_priority', '自身處於狂暴狀態時：所有技能先制+1', [
      { cond: [c('has_status', { side: 'self', status: '狂暴' })], acts: [a('prio_bonus', { v: 1 })] },
    ], 2),
    // D. 對手使用屬性技能：免疫下1次受到的異常；下1次攻擊技能無視傷害限制／攻擊免疫
    entry('on_attacked', 'opp_status', '對手使用屬性技能時：自身免疫下1次受到的異常狀態，且自身下1次攻擊技能無視對手傷害限制、傷害免疫、攻擊免疫效果', [
      { acts: [
        a('immune_status_count', { count: 1 }),
        a('timed', { turns: 99, from: 'now', trig: 'self_attack', once: true, label: '夜·下1次攻擊無視限制', body: [
          { acts: [a('ignore', { what: '傷害限制' }), a('ignore', { what: '攻擊免疫' })] },
        ] }),
      ] },
    ], 3),
    // E. 對手使用攻擊技能：100%閃避（被動命中查詢；必中技能不受閃避影響，與引擎常駐閃避同一入口）
    { codeId: 'soul_property', source: 'soulmark', role: 'innate', node: 'passive_always', order: 4,
      customText: '對手使用攻擊技能時：自身有100%的機率閃避對手攻擊（必中技能不受閃避影響）',
      params: { property: 'evade', chance: 100, kind: '攻擊' } } as KitEntry,
    // F. 閃避成功→下2次攻擊技能先制+2且傷害提升50%；未觸發（攻擊實際命中）→回合結束附加攻擊值50%百分比傷害並回復等量體力
    entry('opponent_after_action', 'opp_after_attack', '閃避觸發則下2次攻擊技能先制+2且造成的傷害提升50%；未觸發則回合結束時附加自身攻擊值50%的百分比傷害並回復等量體力值', [
      { cond: [c('fail_kind', { kind: 'evade' })], acts: [
        a('prio_next', { uses: 2, v: 2, attackOnly: true }),
        a('dmg_mod_uses', { uses: 2, boost: 0.5, kind: '攻擊', attackOnly: true }),
      ] },
      { cond: [c('fail_kind', { kind: 'evade', neg: true })], acts: [
        a('at_round_end', { body: [{ acts: [
          a('dmg', { base: 'stat:攻擊', of: 'self', ratio: 0.5, type: '百分比' }),
          a('heal_equal', {}),
        ] }] }),
      ] },
    ], 5),
    // G. 死亡分支（每場戰鬥最多1次）：殘留1點體力；消除對手回合類效果、100%詛咒、吸取最大體力1/3、進入3回合狂暴；
    //    回合結束時解除自身異常狀態（狂暴為死亡分支產物，清除後立即重附，維持舊 handler 保留狂暴之語意）
    entry('self_fatal', 'fatal', '自身死亡時：100%的機率會殘留1點體力；回合結束時解除自身異常狀態、消除對手回合類效果並100%令對手詛咒，吸取對手最大體力1/3，使自身進入3回合的狂暴狀態（每場戰鬥最多觸發1次）', [
      { acts: [a('once', { key: 'blake-night-death', body: [{ acts: [
        a('survive', {}),
        a('clear_turn', { side: 'opp' }),
        a('status', { side: 'opp', status: '詛咒', turns: 3, chance: 100 }),
        a('drain', { ratio: 1 / 3, true: false }),
        a('status', { side: 'self', status: '狂暴', turns: 3, chance: 100 }),
        a('at_round_end', { body: [{ acts: [
          a('cure_status', { side: 'self', cls: '' }),
          a('status', { side: 'self', status: '狂暴', turns: 3, chance: 100 }),
        ] }] }),
      ] }] })] },
    ], 6),
  ],
};
