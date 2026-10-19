// 5014 斯嘉麗 魂印「燦」真 Kit（DSH 20261018 第二十三批 legacyWrapped 拆解）。
// 舊 handler 的珀妮額外精靈生命週期（addExtraElf／vanishElf）與星贖轉化讀取端保留為引擎層；
// 本 Kit 把可由積木表達的效果條款寫成可編輯件。燦界聖芒（canGlory）／星贖為印記／異常。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import canText from './canSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const glory = a('resource_mark_add', { id: 'canGlory', name: '燦界聖芒', displayChar: '芒', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 3, description: '受到失明時將當前異常轉化為星贖；能力上升不可消除；降低控制類異常回合／降低對手PP' });

export const MIGRATED_5014_CAN_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5014'],
  name: '燦',
  description: canText.soul,
  kit: [
    // 受到非真實傷害：降低至⅓；每次成功則己方+1層燦界聖芒；恢復1/3並於回合結束造成等量百分比傷害
    e('on_damaged', 'damaged_nontrue', '自身每次受到非真實傷害時：降低至原始傷害的⅓；每次降低成功則令己方附加1層燦界聖芒；同時恢復最大體力1/3於當回合結束時造成對手等同於恢復量的百分比傷害', [
      // before_damage 即為「受到傷害」時點；「非真實」由引擎讀取端（damageCategory）判定，
      // 此處只宣告降⅓與恢復轉傷條款（不重複判定，避免與引擎雙重過濾）。
      { acts: [
        a('non_true_damage_third', {}),
        glory,
        a('heal_as_percent_damage', { ratio: 1 / 3, next: false }),
      ] },
    ], 0),
    // 自身下場後：1回合內令己方下隻出戰精靈獲得上述降低與恢復效果，每有1層聖芒延長1回合
    e('on_switch_out', 'switch_out', '自身下場後，1回合內令己方下隻出戰精靈登場前1回合獲得上述降低傷害效果與回合結束時恢復效果，每有1層燦界聖芒則延長1回合', [
      { acts: [a('next_elf_pending', { immunityTurns: 1 })] },
    ], 1),
    // 自身使用技能：特攻速度+2命中+1；對手特防速度-2命中-1
    e('before_skill', 'before_skill', '自身使用技能時：令自身特攻、速度+2、命中+1；附加對手特防、速度-2、命中-1', [
      { acts: [
        a('stat', { side: 'self', stats: ['特攻', '速度'], v: 2 }),
        a('stat', { side: 'self', stats: ['命中'], v: 1 }),
        a('stat', { side: 'opp', stats: ['特防', '速度'], v: -2 }),
        a('stat', { side: 'opp', stats: ['命中'], v: -1 }),
      ] },
    ], 2),
    // 對手使用技能：對手雙攻速度-2命中-1；自身雙防速度命中+1
    e('on_attacked', 'opp_skill', '對手使用技能時：令對手雙攻、速度-2、命中-1；附加自身雙防、速度、命中+1', [
      { acts: [
        a('stat', { side: 'opp', stats: ['雙攻', '速度'], v: -2 }),
        a('stat', { side: 'opp', stats: ['命中'], v: -1 }),
        a('stat', { side: 'self', stats: ['雙防', '速度', '命中'], v: 1 }),
      ] },
    ], 3),
    // 前述效果執行時若雙方能力等級變化不高於10：2回合內以弱點傷害計算；附加對手星贖1回合（已存在則+1）
    e('after_action', 'self_after_skill', '前述效果執行時若雙方能力等級變化不高於10：2回合內自身攻擊技能計算傷害時以弱點傷害計算；附加對手星贖1回合，已存在星贖則改為回合數+1', [
      { cond: [c('last_amount', { op: '不高於', amount: 10 }, '能力等級變化不高於10')], acts: [
        a('weakness_damage_turns', { turns: 2 }),
        a('status_or_extend', { side: 'opp', status: '星贖', turns: 1, extend: 1 }),
      ] },
    ], 4),
    // 燦界聖芒：己方戰鬥階段結束時，敵我每有1回合星贖→降低己方控制類異常回合（層數×2），最高降至1回合
    e('battle_phase_end', 'phase_end', '己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍，異常回合數最高降至1回合', [
      { cond: [c('mark_count', { side: 'self', id: 'canGlory', op: '不小於', amount: 1 }, '持有燦界聖芒')], acts: [
        // 「降低控制類異常回合數至最高1回合」→ 以回合覆寫表達（引擎 status 設定即覆蓋回合數）
        a('status_collection', { side: 'self', scope: 'active', mode: 'class', cls: '控制類', turns: 1 }),
      ] },
    ], 5),
    // 燦界聖芒：對方技能戰鬥階段結束時，敵我每有1回合星贖→降低對手技能PP（層數等量），最多降至1；不大於1時PP上限歸1
    e('battle_phase_end', 'phase_end', '對方技能戰鬥階段結束時敵我雙方每有1回合星贖降低對手等同於燦界聖芒層數所有技能等量技能PP值，最多降低至1點PP值；若對手被降低後PP值不大於1時額外令對手PP值該技能PP值上限歸1', [
      { cond: [c('mark_count', { side: 'self', id: 'canGlory', op: '不小於', amount: 1 }, '持有燦界聖芒')], acts: [
        a('pp_op', { side: 'opp', mode: 'reduce', amount: 1, stopIfEmpty: true }),
        a('pp_max_to_one', { side: 'opp' }),
      ] },
    ], 6),
  ],
};
