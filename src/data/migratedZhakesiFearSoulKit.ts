// 5025 恐懼的化身·咤克斯 魂印「懼」真 Kit（DSH 20261018 第十三批·第一波 legacyWrapped 拆解）。
// 舊 handler：zhakesi-fear/registry.ts handleFearIncarnationSoulMark 整份空殼化（規則3.3——保留匯出名，
//   函數體 return false）。同檔 ZHAKESI_FEAR_SKILLS 四技已全部是 effectMode='kit' 的真 Kit
//   （migratedFeedbackSkillKits／migratedFollowupSkillKits／migratedTypedDefenseSkillKits／
//   migratedInstantKillSkillKits／migratedFinalBKits），其舊支援分支（skillFearTurns／
//   nextAtkFixedDmgCount／damageBoostThisTurn／shieldBlockNextAtk／nextPriorityCount）自技能 Kit 化後
//   即無寫入端，屬死碼，不隨本魂印保留。SOUL_MARK_MAPPING 5025 相關鍵（5025／1019／1037／咤克斯／
//   恐懼的化身·咤克斯／恐懼的化身.咤克斯）與 tests/fixtures/elfRegistryBeforeMove.json souls 同步移除。
// 恐懼之種／恐懼之花的讀取端全為引擎既有端，本 Kit 只負責「寫印記」（marks 系統 effects 欄位）：
//   · 免疫害怕但所選技能 PP 歸 0 且當回合無法行動：utils/traitsEngine.filterStatusInflict ＋
//     engine/battleEngine fearSeedDrainPP（出招前讀取）。
//   · 恐懼之花擋附加異常：utils/traitsEngine.filterStatusInflict。
//   · 禁秒殺：battle/instantKill（instantKillDisabled；MARK_DEFINITIONS 內建）。
//   · 造成／受到非真實傷害倍率：battle/contextBuilders（nonTrueDamageDealt/TakenMultiplier）。
//   · 受到攻擊保底機率（觸發則當回合無法恢復體力＋等同體力上限真實傷害）：battleEngine
//     guaranteedMaxHpDamageChance 讀取端。
// 新通用件：maxhp_absorb_all／opp_active_swap（blocks/ops/fearSeed.ts）；mark_program 擴充
//   nonTrueDamageDealtMultiplier／nonTrueDamageTakenMultiplier／guaranteedMaxHpDamageChance(+PerStack)。
// 既有件：has_mark／mark_count／pre 前置快照／chain 結果連鎖／live 即時條件／hp_full／hp_ratio／
//   status／stat_clear／clear_turn／heal{missingRatio}／pp_op／dmg_from_last／stat／no_switch／
//   resource_mark_remove。
// 與舊 handler 的三處可見差異（機制優先，依原文）：
//   1. 「每回合吸取」由回合結束移至回合開始（team_round_start——背包內存活或在場皆生效；場下精靈的
//      魂印 Kit 沒有回合結束節點，回合開始是唯一正式全隊節點）。
//   2. 戰鬥階段結束的「1點PP值」與「對手全屬性-1／無法切換」分支不再掛在「自身有已損失體力」之下
//      （原文無此條件；舊 handler 把整段包在 lostHp>0 內）。
//   3. 「等同於自身恢復量」以實際恢復量結算（dmg_from_last 讀 heal 結算量）；舊 handler 以請求量結算，
//      禁療時仍會造成百分比傷害——原文語意為恢復量，未恢復即無傷害。
//   4. 「每次己方精靈登場…提高1層」沿用舊 handler 的回合級偵測（回合開始比對對手在場身分），但於
//      battle_start 先記錄對手首發基準——首回合選擇階段的換人也能計數（舊 handler 首次檢查在
//      回合一開始，首回合換人先於基準建立、永不計數）。主動換人於選擇階段完成，回合開始即比出差異；
//      中途死亡換人於下次回合開始偵測（與舊 handler 相同）。
//   另：原句「每次己方精靈登場或受到害怕狀態時提高1層」的「受到害怕」半句——恐懼之種持有方受害怕
//   必被免疫（免疫即未附加成功），舊 handler 亦未實作該半句，維持不實作（已寫進時點規則待確認區）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

/** action(op,p) 不帶 label；需要可讀標籤的動作用本封裝（合約只認 op/p/label 三鍵）。 */
const act = (op: string, p: Record<string, any>, label?: string) => ({ op, p, label: label || op });

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = "自身存活在出戰背包內時（自身在場時也生效）：\n> 每回合吸取敵我雙方所有精靈20點體力上限附加給自身，最多吸取至該精靈體力上限為1\n戰鬥開始時：\n> 為對手種下恐懼之種\n回合開始時，若自身滿體力：\n> 令對手100%害怕\n> 未觸發則消除雙方能力上升、下降狀態與回合類效果\n戰鬥階段結束時：\n> 恢復自身已損失體力50%的體力值與1點PP值\n> 同時對手受到等同於自身恢復量百分比傷害\n> 若對手體力未滿則額外令對手全屬性-1且至少減至1\n> 未觸發則對手下2回合無法主動切換精靈\n恐懼之種：\n> 持有方所有精靈均無法附加害怕異常與觸發秒殺效果\n> 且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0\n> 且當回合若因此PP值為0時則無法行動\n> 造成非真實傷害降低20%\n> 受到非真實傷害提升40%\n> 每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限\n> 觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害\n> 每次己方精靈登場或受到害怕狀態時提高1層\n> 每有1層則上述機率提高2%\n> 最高5層，達到5層時轉變為恐懼之花\n恐懼之花：\n> 持有方所有精靈均無法附加給敵我雙方任一方異常異常狀態與觸發秒殺效果\n> 每回合開始時恐懼之花會令在場精靈進入害怕狀態\n> 造成非真實傷害降低50%\n> 受到非真實傷害提升100%\n> 每次受到對手的攻擊時有50%機率受到攻擊傷害不低於自身當前體力上限\n> 觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害";

// 印記說明（UI彈窗）：沿用舊 handler 既有全文（與官方文本同構，含「異常異常」原樣保留）。
const SEED_MARK_DESC = "恐懼之種:持有方所有精靈均無法附加害怕異常與觸發秒殺效果且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0且當回合若因此PP值為0時則無法行動，造成非真實傷害降低20%，受到非真實傷害提升40%，每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害，每次己方精靈登場或受到害怕狀態時提高1層，每有1層則上述機率提高2%，最高5層，達到5層時轉變為恐懼之花";
const FLOWER_MARK_DESC = "恐懼之花:持有方所有精靈均無法附加給敵我雙方任一方異常異常狀態與觸發秒殺效果，每回合開始時恐懼之花會令在場精靈進入害怕狀態，造成非真實傷害降低50%，受到非真實傷害提升100%，每次受到對手的攻擊時有50%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害";

// 種下／疊層共用同一寫入端：mode 'add' 時 applyMarkProgram 依最終層數折算保底機率（0.20+2%×(層數-1)）。
const seedProgram = (mode: 'set' | 'add') => act('mark_program', {
  id: 'fear_seed', name: '恐懼之種', displayChar: '種', unit: '層', description: SEED_MARK_DESC,
  side: 'opp', scope: 'team', mode, count: 1, maxCount: 5, persistsOffField: true, rules: [],
  nonTrueDamageDealtMultiplier: 0.8, nonTrueDamageTakenMultiplier: 1.4,
  guaranteedMaxHpDamageChance: 0.2, guaranteedMaxHpDamageChancePerStack: 0.02,
}, '恐懼之種');

export const MIGRATED_ZHAKESI_FEAR_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5025'],
  name: '懼',
  description: raw,
  kit: [
    // 0. 戰鬥開始：為對手種下恐懼之種（開局 1.1 對雙方所有存活背包持有者派發；在場或場下皆生效）
    entry('battle_start', 'battle_start', '戰鬥開始時：為對手種下恐懼之種（並記錄對手在場精靈基準）', [
      { acts: [seedProgram('set'), act('opp_active_swap', {}, '記錄對手在場精靈基準')] },
    ], 0),
    // 1. 每回合（背包內存活或在場；team_round_start——在場與場下持有者唯一共同回合節點）：
    //    吸取敵我雙方所有精靈 20 點體力上限附加給自身（最多吸取至 1）；
    //    恐懼之種：對手在場精靈更換（主動換人於選擇階段完成、回合開始即比出差異；死亡換人下次回合開始偵測）
    //    → 未達轉生門檻 +1 層（每層保底機率 +2%，mark_program 寫入時按層數折算）；
    //    達轉生門檻 → 移除恐懼之種、種下恐懼之花（pre 快照杜絕「先疊層又轉生」的連鎖誤觸）；
    //    恐懼之花：每回合開始令在場精靈進入害怕狀態（live 讀印記——轉生當回合即生效；
    //    恐懼之花本身擋附加異常，此附加由引擎讀取端如舊 handler 般被擋下，維持原行為）。
    entry('round_start', 'team_round_start', '每回合吸取敵我雙方所有精靈20點體力上限附加給自身，最多吸取至該精靈體力上限為1；恐懼之種每次己方精靈登場時提高1層，每有1層則機率提高2%，最高5層達到時轉變為恐懼之花；恐懼之花每回合開始時令在場精靈進入害怕狀態', [
      { acts: [a('maxhp_absorb_all', { amount: 20, floor: 1 })] },
      { acts: [act('opp_active_swap', {}, '對手在場精靈更換檢查')] },
      { pre: true, chain: 'success', cond: [
        c('has_mark', { side: 'opp', name: '恐懼之種' }, '對手持有恐懼之種'),
        c('mark_count', { side: 'opp', id: 'fear_seed', op: '低於', amount: 4 }, '層數未達轉生門檻'),
      ], acts: [seedProgram('add')] },
      { pre: true, chain: 'success', cond: [
        c('has_mark', { side: 'opp', name: '恐懼之種' }, '對手持有恐懼之種'),
        c('mark_count', { side: 'opp', id: 'fear_seed', op: '不低於', amount: 4 }, '層數達轉生門檻'),
      ], acts: [
        act('resource_mark_remove', { id: 'fear_seed', side: 'opp', scope: 'team' }, '移除恐懼之種'),
        act('mark_program', {
          id: 'fear_flower', name: '恐懼之花', displayChar: '花', unit: '株', description: FLOWER_MARK_DESC,
          side: 'opp', scope: 'team', mode: 'set', count: 1, maxCount: 1, persistsOffField: true, rules: [],
          nonTrueDamageDealtMultiplier: 0.5, nonTrueDamageTakenMultiplier: 2, guaranteedMaxHpDamageChance: 0.5,
        }, '恐懼之花'),
      ] },
      { cond: [c('has_mark', { side: 'opp', name: '恐懼之花' }, '對手持有恐懼之花')], live: true, acts: [
        act('status', { side: 'opp', status: '害怕', turns: 1, chance: 100 }, '恐懼之花·害怕'),
      ] },
    ], 1),

    // 2. 回合開始，自身滿體力（在場；round_start 對場下持有者不派發＝舊 handler 的在場閘門）：
    //    令對手 100% 害怕；未觸發（被免疫／抵抗）→ 消除雙方能力上升、下降狀態與回合類效果。
    entry('round_start', 'round_start', '回合開始時，若自身滿體力：令對手100%害怕，未觸發則消除雙方能力上升、下降狀態與回合類效果', [
      { cond: [c('hp_full', { side: 'self' }, '自身滿體力')], acts: [
        a('status', { side: 'opp', status: '害怕', turns: 1, chance: 100 }),
      ] },
      { cond: [c('hp_full', { side: 'self' }, '自身滿體力'), c('fail', {}, '害怕未觸發')], acts: [
        a('stat_clear', { side: 'both', kind: 'all' }),
        a('clear_turn', { side: 'both' }),
      ] },
    ], 2),
    // 3. 戰鬥階段結束（在場）：恢復已損失體力 50% 與全部技能 1 點 PP；對手受到等同於實際恢復量的
    //    百分比傷害；live 判讀——對手體力未滿 → 全屬性-1；未觸發（滿體力）→ 對手下 2 回合無法主動切換。
    entry('battle_phase_end', 'phase_end', '戰鬥階段結束時：恢復自身已損失體力50%的體力值與1點PP值，同時對手受到等同於自身恢復量百分比傷害；若對手體力未滿則額外令對手全屬性-1且至少減至1，未觸發則對手下2回合無法主動切換精靈', [
      { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 1 }, '自身有已損失體力')], acts: [
        act('heal', { side: 'self', ratio: 0, missingRatio: 0.5 }, '恢復已損失體力50%'),
      ] },
      { acts: [act('pp_op', { side: 'self', mode: 'add', amount: 1 }, '全部技能+1PP')] },
      { acts: [act('dmg_from_last', { ratio: 1, type: '百分比' }, '對手受等量百分比傷害')] },
      { cond: [c('hp_ratio', { side: 'opp', op: '低於', ratio: 1 }, '對手體力未滿')], live: true, acts: [
        a('stat', { side: 'opp', stats: ['全屬性'], v: -1 }),
      ] },
      { cond: [c('hp_ratio', { side: 'opp', op: '不低於', ratio: 1 }, '對手體力未滿未觸發')], live: true, acts: [
        a('no_switch', { turns: 2 }),
      ] },
    ], 3),
  ],
};
