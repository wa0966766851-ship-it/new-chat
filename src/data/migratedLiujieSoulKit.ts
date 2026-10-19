// 5031 六界神王 魂印「界」Kit（DSH 20261018 第十五批 legacyWrapped 拆解；讀法B裁定後新描述）。
// 舊 handler：destiny-c/registry.ts handleLiujieSoulMark 僅實作被擊敗分支——其餘從未實裝；
// Kit 依新描述（層次級、讀法B語意內嵌）完整表達＝行為對齊原文。
// 六秘法（random_branch 六選一；領悟標記＝資源印記 maxCount:1；讀法B：疊加並存持續生效到下場）：
//   地葬＝盾罩200／瀚海＝固傷200+heal_equal／混沌＝pp_zero_random{2}（即時，可重複觸發）；
//   幻境＝on_skill_use(self_attack) cond has_mark→crit_uses（每次技能刷新1次必致命）；
//   天玄＝before_damage cond has_mark→damage_cap_by_mark{dir:'in',kind:'攻擊',fixed:400,immune:true}（2026-10-18使用者裁定：超過400整筆免疫）；
//   時空＝modify_priority cond has_mark→prio_bonus{v:1}。
// 下場：六印記移除＋對方使用技能紀錄清除（opp_skill_record_clear）＋體力PP重置為登場時狀態（entry_state_restore；holyMiles ops）。
// 被擊敗：clear_turn＋stat_reverse{opp,up}＋死亡來源等量真傷（reflect_defeat_true：讀本回合已受技能傷害記錄，指名致死來源個體，場下亦可）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

// 六秘法主體（random_branch 分支；每支先掛領悟印記再觸發效果）
const learned = (id: string) => a('resource_mark_add', { id, name: id + '秘法', displayChar: id.slice(0, 1), unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 1, description: id + '秘法已領悟（疊加並存，下場清除）' });
const dizang = [{ acts: [learned('地葬'), a('shield', { flat: 200 }), a('shield', { flat: 200, kind: 'barrier' })] }];
const hanhai = [{ acts: [learned('瀚海'), a('dmg', { flat: 200, type: '固定' })] }, { chain: 'success', acts: [a('heal_equal', {})] }];
const hundun = [{ acts: [learned('混沌'), a('pp_zero_random', { count: 2 })] }];
const huanjing = [{ acts: [learned('幻境')] }];
const tianxuan = [{ acts: [learned('天玄')] }];
const shikong = [{ acts: [learned('時空')] }];

export const MIGRATED_LIUJIE_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5031'],
  name: '界',
  description: '【回合開始時】\n> 若自身處於能力提升狀態，則當回合免疫異常狀態且攻擊技能造成的傷害提升50%\n> 若自身不處於全屬性能力提升狀態，則戰鬥階段結束時令自身全屬性+1且下回合所有技能先制+2\n\n【自身使用攻擊技能時】\n> 將當次受到的攻擊傷害100%以真實傷害形式反饋給對手\n\n【每回合結束時】\n> 隨機領悟六大界神的一個秘法（可重複領悟同一秘法，效果再次觸發）\n> 已領悟的秘法效果疊加並存、持續生效，直到自身下場後全部清除\n> 地葬秘法：為自身附加200點護盾與200點護罩\n> 瀚海秘法：附加200點固定傷害並恢復等量體力\n> 混沌秘法：使對手隨機2個技能的PP值歸零\n> 幻境秘法：攻擊必定打出致命一擊（領悟期間持續生效）\n> 天玄秘法：免疫大於400的攻擊傷害（領悟期間持續生效）\n> 時空秘法：攻擊技能先制+1（領悟期間持續生效）\n> 自身下場時：清除對方使用技能紀錄並重置自身體力狀態與PP值狀態為登場時狀態\n\n【自身被擊敗時】\n> 消除對手回合類效果且能力提升狀態反轉為等量能力下降\n> 令自身死亡的傷害來源受到等同於自身被擊敗時受到的技能傷害等量的真實傷害（位於場下也可觸發）',
  kit: [
    // 登場：記錄體力與各技能PP（下場重置為「登場時狀態」的基準）
    e('on_entered', 'entrance', '登場時記錄體力與PP值狀態', [
      { acts: [a('entry_state_snapshot', {})] },
    ], 0),
    // 回合開始：處於能力提升→當回合免疫異常＋攻擊傷害+50%
    e('round_start', 'round_start', '若自身處於能力提升狀態，則當回合免疫異常狀態且攻擊技能造成的傷害提升50%', [
      { cond: [c('stage', { side: 'self', kind: 'up' }, '處於能力提升狀態')], acts: [
        a('immune_status_turns', { turns: 1, cls: '', reflect: false }),
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 0.5, turns: 1 }),
      ] },
    ], 0),
    // 戰鬥階段結束（回合開始時不處於全屬性提升的延續判定）：全屬性+1＋下回合先制+2
    e('battle_phase_end', 'phase_end', '若自身不處於全屬性能力提升狀態，戰鬥階段結束時令自身全屬性+1且下回合所有技能先制+2', [
      { cond: [c('stage_all', { side: 'self', kind: 'up', neg: true }, '不處於全屬性能力提升狀態')], acts: [
        a('stat', { side: 'self', stats: ['全屬性'], v: 1 }),
        a('turn_key_set', { key: 'priorityBoostTurns', turns: 2, side: 'self', reason: '界·時序', label: '下回合所有技能先制+2' }),
        a('turn_key_set', { key: 'priorityBoostValue', turns: 2, side: 'self', reason: '界·時序', label: '先制+2值' }),
      ] },
    ], 1),
    // 攻擊技能時：將當回合受到的攻擊傷害100%以真實傷害反饋
    e('on_skill_use', 'self_attack', '自身使用攻擊技能時將當次受到的攻擊傷害100%以真實傷害形式反饋給對手', [
      { acts: [a('reflect_received_damage', { ratio: 1, type: '真實' })] },
    ], 2),
    // 每回合結束：隨機領悟一個秘法（六選一，可重複）
    e('round_end', 'round_end', '每回合結束時隨機領悟六大界神的一個秘法（可重複領悟，效果再次觸發）', [
      { acts: [a('random_branch', { branches: [dizang, hanhai, hundun, huanjing, tianxuan, shikong] })] },
    ], 3),
    // 幻境（領悟期間持續）：攻擊必定致命——每次技能前刷新1次必致命
    e('on_skill_use', 'self_attack', '幻境秘法（領悟期間持續生效）：攻擊必定打出致命一擊', [
      { cond: [c('has_mark', { side: 'self', name: '幻境秘法' }, '已領悟幻境秘法')], acts: [
        a('crit_uses', { uses: 1 }),
      ] },
    ], 4),
    // 天玄（領悟期間持續）：單筆攻擊傷害超過400時整筆免疫，400以下照常承受。
    e('before_damage', 'incoming', '天玄秘法（領悟期間持續生效）：免疫大於400的攻擊傷害', [
      { cond: [c('has_mark', { side: 'self', name: '天玄秘法' }, '已領悟天玄秘法')], acts: [
        a('damage_cap_by_mark', { id: '天玄', dir: 'in', kind: '攻擊', fixed: 400, immune: true }),
      ] },
    ], 5),
    // 時空（領悟期間持續）：攻擊技能先制+1
    e('modify_priority', 'modify_priority', '時空秘法（領悟期間持續生效）：攻擊技能先制+1', [
      { cond: [c('has_mark', { side: 'self', name: '時空秘法' }, '已領悟時空秘法')], acts: [
        a('prio_bonus', { v: 1 }),
      ] },
    ], 6),
    // 下場：六印記全部清除＋清除對方使用技能紀錄＋體力PP重置為登場時狀態
    e('on_switch_out', 'switch_out', '自身下場時：清除已領悟的全部秘法、對方使用技能紀錄，並重置自身體力與PP值為登場時狀態', [
      { acts: [
        a('resource_mark_remove', { id: '地葬', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: '瀚海', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: '混沌', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: '幻境', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: '天玄', side: 'self', scope: 'elf' }),
        a('resource_mark_remove', { id: '時空', side: 'self', scope: 'elf' }),
        a('opp_skill_record_clear', {}),
        a('entry_state_restore', {}),
      ] },
    ], 7),
    // 被擊敗：消除對手回合類＋能力提升反轉為下降＋死亡來源等量真傷
    e('cthyaat_death', 'defeated', '自身被擊敗時：消除對手回合類效果且能力提升狀態反轉為等量能力下降，死亡來源受到等量真實傷害', [
      { acts: [
        a('clear_turn', { side: 'opp' }),
        a('stat_reverse', { side: 'opp', kind: 'up' }),
      ] },
      { acts: [a('reflect_defeat_true', { ratio: 1 })] },
    ], 8),
  ] };
