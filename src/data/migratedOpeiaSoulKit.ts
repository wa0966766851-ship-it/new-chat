// 5018 蟲后·奧佩婭 魂印「后」真 Kit（DSH 20261018 第十三批·第一波 legacyWrapped 拆解）。
// 舊 handler：src/effects/elves/opeia/registry.ts handleOpeiaSoulMark 整份空殼化（規則3.3）；
//   五技已全數為真 Kit（migratedOpeiaSkillKits／migratedRandomStageSkillKits／migratedFinalCKits／
//   migratedDeferredDamageSkillKits），本批不動技能。description 以 vite ssr 載入 DEFAULT_ELVES
//   逐字比對（elfSourceText 套用後的實際原文，615 字，測試斷言 equal）。
// 通用件（blocks/ops/rosterStats.ts）：temp_stats_by_last／temp_stats_restore（六維臨時值＋下場還原）、
//   bench_type_stat_transfer（混沌轉移）、attack_bypass_until_switch（無視鍵）、counter_from_last／
//   counter_power_ratio（敵方計數→受方威力比例）、attack_combo_uses_by_last（前n次連擊+1）、
//   pp_no_cost、reduction_override_turns（99% 減傷覆寫）、seal_used_skill_pp_phase_end＋pp_zero_seal
//   （使用技能 PP 封印＝建立時快照、戰鬥階段結束結算，不因中途死亡換人改指向）、
//   until_switch_keys_clear／timer_consume_all（下場清理）。
// 既有件：roster_query（groupC；本批擴充 alive_or_type／dead_or_type OR 篩選）、add_invalid_next、heal、
//   damage_multiplier_turns、status{chanceHpRatio}（本批擴充：以自身體力百分比為機率）、clear_turn、
//   pending_counter＋counter_spend（滿/屬性→出手末中毒轉感染）、pp_op{drain}（不滿/攻擊→吸取2PP）、convert_status。
// 結構教訓遵守：OR 條件拆成多語句各帶守衛（滿/屬性→轉感染：[pp_full]＋[屬性,不滿]；不滿/攻擊→吸取：
//   [不滿]＋[攻擊,滿]），不用 elseActs——守衛失敗誤觸 else 的問題見第十二批登記。
// 跨定義：王·鏽腑喰心讀通用 teamEntranceHistory（recordBattleEntrance）——引擎機制，未動。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = "登場時：\n> 己方背包內所有精靈每有n隻存活或識別帶有蟲系的精靈則自身直到下場獲得等同於所有能力值n*10%總和的臨時能力值\n> 前n次自身攻擊技能連擊次數+1\n> 敵方背包內所有精靈每有一隻陣亡或識別帶有蟲系的精靈則直到下場前對手使用攻擊技能時攻擊威力降低10%\n> 前述效果觸發時若敵我雙方存在識別帶有混沌系的精靈\n>> 則場下所有帶有混沌系精靈所有能力值降低60%並附加給自身\n>> 自身直到下場前無視對手攻擊免疫效果、攻擊免疫/抵擋/轉化傷害效果、攻擊傷害限制效果\n對手使用技能時：\n> 若該技能為攻擊技能時令對手下次屬性技能附加效果失效（下場後保留）\n> 若該技能為屬性技能時令對手下次攻擊技能附加效果失效（下場後保留）\n> 每次觸發前述效果時\n>> 恢復自身最大體力50%\n>> 令對手當回合造成的非真實傷害降低50%且當回合戰鬥階段結束時令使用的技能PP值歸0\n>> 該技能為攻擊技能則額外令對手所有相同類型的技能PP值歸0\n>> 該技能為屬性技能則額外令2回合內自身受到非真實傷害降低效果觸發時比例變為99%\n自身使用技能時：\n> 不消耗技能PP值\n> 100%令對手中毒，未觸發則消除對手回合類效果並有等同於自身體力當前百分比機率令對手害怕\n> 若該技能PP值為滿或為屬性技能\n>> 則當回合出手流程結束時將對手所處的中毒異常狀態轉化為感染\n> 若該技能PP值不為滿或為攻擊技能\n>> 吸取對手所有技能2點PP值";

export const MIGRATED_OPEIA_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5018'],
  name: '后',
  description: raw,
  kit: [
    // A. 登場：己方背包「存活或蟲系」n 隻→六維總和×n×10% 臨時加到每一維（含體力上限）＋前 n 次攻擊連擊+1；
    //    敵方背包「陣亡或蟲系」m 隻→計數鍵（受方威力 −10%×m，直到下場）；
    //    存在混沌系→場下混沌精靈六維 −60% 附加給自身＋直到下場無視攻擊免疫／抵擋／轉化／傷害限制。
    entry('on_entered', 'entrance', '登場時：己方背包每有n隻存活或蟲系→臨時能力值（六維總和×n×10%）＋前n次攻擊連擊+1；敵方每有一隻陣亡或蟲系→對手攻擊威力-10%×m（直到下場）；存在混沌系→場下混沌精靈能力值-60%附加給自身＋無視攻擊免疫/抵擋/轉化/傷害限制（直到下場）', [
      { acts: [a('roster_query', { sides: ['self'], types: ['蟲'], filter: 'alive_or_type', scope: 'team' })] },
      { acts: [a('temp_stats_by_last', { scale: 0.1 })] },
      { acts: [a('attack_combo_uses_by_last', { id: 'blk_queen_combo' })] },
      { acts: [a('roster_query', { sides: ['opp'], types: ['蟲'], filter: 'dead_or_type', scope: 'team' })] },
      { acts: [a('counter_from_last', { key: 'queenFoeInsectCount', label: '敵方蟲群計數' })] },
      { acts: [a('bench_type_stat_transfer', { type: '混沌', ratio: 0.6 })] },
      { chain: 'success', acts: [a('attack_bypass_until_switch', { immunity: true, block: true, conversion: true, limit: true, shield: true })] },
    ], 0),
    // B. 受方威力：對手使用攻擊技能時威力 ×(1−0.1×m)（僅她在場期間；屬性技由事件閘門排除）
    entry('modify_power', 'incoming_power', '敵方背包每有一隻陣亡或蟲系→對手使用攻擊技能時攻擊威力降低10%×m（直到下場）', [
      { acts: [a('counter_power_ratio', { key: 'queenFoeInsectCount', perUnit: 0.1 })] },
    ], 1),
    // C. 對手使用攻擊技能：下次屬性技能附加失效（下場保留）＋恢復50%＋當回合非真實傷害-50%＋
    //    戰鬥階段結束令使用的技能與同類型技能PP歸0（建立時快照身分）。
    entry('on_attacked', 'opp_attack', '對手使用攻擊技能時：令對手下次屬性技能附加效果失效（下場後保留）；恢復自身最大體力50%；令對手當回合造成的非真實傷害降低50%；當回合戰鬥階段結束時令使用的技能與所有相同類型技能PP值歸0', [
      { acts: [a('add_invalid_next', { kind: '屬性', uses: 1 })] },
      { acts: [a('heal', { side: 'self', ratio: 0.5 })] },
      { acts: [a('damage_multiplier_turns', { side: 'opp', dir: 'out', kind: '非真實', mult: 0.5, turns: 1 })] },
      { acts: [a('seal_used_skill_pp_phase_end', { sameCategory: true })] },
    ], 2),
    // D. 對手使用屬性技能：下次攻擊技能附加失效（下場保留）＋恢復50%＋當回合非真實傷害-50%＋
    //    戰鬥階段結束令使用的技能PP歸0＋2回合內受到非真實傷害降低效果觸發時比例變為99%。
    entry('on_attacked', 'opp_status', '對手使用屬性技能時：令對手下次攻擊技能附加效果失效（下場後保留）；恢復自身最大體力50%；令對手當回合造成的非真實傷害降低50%；當回合戰鬥階段結束時令使用的技能PP值歸0；2回合內自身受到非真實傷害降低效果觸發時比例變為99%', [
      { acts: [a('add_invalid_next', { kind: '攻擊', uses: 1 })] },
      { acts: [a('heal', { side: 'self', ratio: 0.5 })] },
      { acts: [a('damage_multiplier_turns', { side: 'opp', dir: 'out', kind: '非真實', mult: 0.5, turns: 1 })] },
      { acts: [a('seal_used_skill_pp_phase_end', { sameCategory: false })] },
      { acts: [a('reduction_override_turns', { turns: 2, percent: 99 })] },
    ], 3),
    // E. 自身使用技能（消耗結算前）：不消耗PP；100%中毒，未觸發→消除對手回合類效果＋自身體力百分比機率害怕；
    //    PP滿或屬性→出手流程結束中毒轉感染（旗標）；PP不滿或攻擊→吸取對手所有技能2點PP。
    //    OR 拆句：轉感染＝[滿]＋[屬性且不滿]（重複觸發僅多一次無害轉化）；吸取＝[不滿]＋[攻擊且滿]（互斥不重複吸取）。
    entry('before_skill', 'before_skill', '自身使用技能時：不消耗技能PP值；100%令對手中毒，未觸發則消除對手回合類效果並有等同於自身體力當前百分比機率令對手害怕；PP為滿或屬性技能→出手流程結束中毒轉感染；PP不為滿或攻擊技能→吸取對手所有技能2點PP值', [
      { acts: [a('pp_no_cost', {})] },
      { acts: [a('status', { side: 'opp', status: '中毒', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [
        a('clear_turn', { side: 'opp' }),
        a('status', { side: 'opp', status: '害怕', turns: 3, chanceHpRatio: true }),
      ] },
      { cond: [c('pp_full', {}, '該技能PP值為滿')], acts: [a('pending_counter', { key: 'queenPoisonConvert', amount: 1, label: '中毒轉感染' })] },
      { cond: [c('skill_kind', { kind: '屬性' }, '屬性技能'), c('pp_full', { neg: true }, 'PP值不為滿')], acts: [a('pending_counter', { key: 'queenPoisonConvert', amount: 1, label: '中毒轉感染' })] },
      { cond: [c('pp_full', { neg: true }, 'PP值不為滿')], acts: [a('pp_op', { side: 'opp', mode: 'drain', amount: 2 })] },
      { cond: [c('skill_kind', { kind: '攻擊' }, '攻擊技能'), c('pp_full', {}, '該技能PP值為滿')], acts: [a('pp_op', { side: 'opp', mode: 'drain', amount: 2 })] },
    ], 4),
    // F. 出手流程結束（成功行動後）：依使用時旗標把對手中毒轉化為感染（感染被免疫時保留原中毒）。
    entry('after_action', 'self_after_skill', '當回合出手流程結束時：將對手所處的中毒異常狀態轉化為感染（PP為滿或屬性技能時）', [
      { acts: [a('counter_spend', { key: 'queenPoisonConvert', amount: 1, label: '中毒轉感染', body: [
        { acts: [a('convert_status', { side: 'opp', status: '感染', turns: 3, from: '中毒' })] },
      ] })] },
    ], 5),
    // G. 下場：還原六維快照、清無視鍵與敵方計數、作廢剩餘連擊次數（重新登場按當次計數重建）。
    entry('on_switch_out', 'switch_out', '下場時：還原臨時能力值、清除無視與計數鍵、作廢剩餘連擊次數', [
      { acts: [a('temp_stats_restore', {})] },
      { acts: [a('until_switch_keys_clear', { keys: ['ignoreAttackImmunityUntilSwitch', 'attackDefenseBypassUntilSwitch', 'queenFoeInsectCount'] })] },
      { acts: [a('timer_consume_all', { id: 'blk_queen_combo' })] },
    ], 6),
  ],
};
