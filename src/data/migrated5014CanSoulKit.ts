// 5014 斯嘉麗 魂印「燦」真 Kit（DSH 20261018 第二十三批 legacyWrapped 拆解）。
// 各條款包含珀妮生命週期均由可編輯動作與正式事件執行，不由舊 handler 代跑。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import canText from './canSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body, ...(trig.startsWith('team_') ? { observer: { includeDead: true } } : {}) } } });
const glory = a('resource_mark_add', { id: 'canGlory', name: '燦界聖芒', displayChar: '芒', unit: '層', side: 'self', scope: 'team', persistsOffField: true, amount: 1, maxCount: 3, description: '受到失明時將當前異常轉化為星贖；能力上升不可消除；降低控制類異常回合／降低對手PP' });
const weakPoint = { live: true, cond: [c('stage_total', { side: 'both', op: '不高於', amount: 10 })], acts: [
  a('weakness_damage_turns', { turns: 2 }),
  a('status_or_extend', { side: 'opp', status: '星贖', turns: 1, extend: 1 }),
] };
const inheritGuard = a('on_next_switch_in', { side: 'self', after: 'now', resource: 'none', ratio: 1, label: '聖光護體', body: [
  { acts: [a('timed', { turns: 1, perMark: { side: 'self', id: 'canGlory', mult: 1 }, from: 'now', trig: 'incoming_nontrue', label: '聖光護體', body: [
    { acts: [a('incoming_reduction_branch', { ratio: 2 / 3, threshold: 0, bodyHigh: [
      { acts: [a('heal_as_percent_damage', { ratio: 1 / 3, next: false })] },
    ] })] },
  ] })] },
] });

export const MIGRATED_5014_CAN_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5014'],
  name: '燦',
  description: canText.soul,
  kit: [
    e('cthyaat_death', 'team_defeated', '自身被擊敗時記錄背包重生：4回合，每層聖芒縮短1回合，須珀妮與可出戰隊友存活', [
      { cond: [c('event_is_holder', {})], acts: [a('delayed_rebirth_arm', { rounds: 4, perMark: { side: 'self', id: 'canGlory', mult: 1 }, requireExtra: '珀妮', ratio: 1 }), inheritGuard] },
    ], 10),
    e('round_end', 'team_round_end', '斯嘉麗死亡後在背包內倒數，珀妮存活且有可出戰隊友時重生，死亡當回合不在場復活', [
      { acts: [a('delayed_rebirth_tick', {})] },
    ], 11),
    e('after_action', 'team_action_end', '斯嘉麗在場且珀妮存活，每次出手流程結束（含未出手）額外造成對手最大體力⅓光系傷害，失明或未觸發時清除回合效果，自身下2次攻擊增傷150%', [
      { cond: [c('holder_active', {}), c('summoned_extra_alive', { name: '珀妮' })], acts: [a('queue_extra_action', {
        label: '珀妮：光系傷害', damageRatio: 1 / 3, elem: '光', body: [
          { cond: [c('has_status', { side: 'opp', status: '失明', neg: true })], acts: [a('status', { side: 'opp', status: '失明', turns: 2, chance: 100 })] },
          { cond: [c('fail', {})], acts: [a('clear_turn', { side: 'opp' })] },
          { cond: [c('has_status', { side: 'opp', status: '失明' })], acts: [a('clear_turn', { side: 'opp' })] },
          { acts: [a('dmg_mod_uses', { uses: 2, boost: 1.5, kind: '攻擊', attackOnly: true })] },
        ],
      })] },
    ], 12),
    e('battle_start', 'team_battle_start', '戰鬥開始時珀妮作為額外精靈加入己方，光系，所有能力值為斯嘉麗⅓', [
      { acts: [a('summon_extra_elf', { name: '珀妮', type: '光', side: 'self', statFromTeamRatio: 1 / 3, statSource: 'holder' })] },
    ], 13),
    e('before_status_apply', 'team_before_status', '珀妮存活時，己方在場精靈受到麻痺，當前異常及該次麻痺合併為星贖，回合類效果保護至階段末', [
      { cond: [c('summoned_extra_alive', { name: '珀妮' }), c('event_status', { statuses: ['麻痺'] })], acts: [
        a('statuses_merge', { status: '星贖', includeIncoming: true }), a('phase_protect', { kind: 'turn' }),
      ] },
    ], 14),
    e('on_status_received', 'team_status_received', '己方持有燦界聖芒時，己方在場精靈受到失明後，全部異常合併為星贖，能力上升保護至階段末', [
      { cond: [c('mark_count', { side: 'self', id: 'canGlory', op: '不小於', amount: 1 }), c('event_status', { statuses: ['失明'] })], acts: [
        a('statuses_merge', { status: '星贖', includeIncoming: false }), a('phase_protect', { kind: 'stat' }),
      ] },
    ], 15),
    // 受到非真實傷害：降低至⅓；每次成功則己方+1層燦界聖芒；恢復1/3並於回合結束造成等量百分比傷害
    e('before_damage', 'incoming_nontrue', '自身每次受到非真實傷害時降低至原始傷害的⅓；降低成功後聖芒+1，恢復最大體力⅓，回合末造成實際恢復量的百分比傷害', [
      { acts: [a('incoming_reduction_branch', { ratio: 2 / 3, threshold: 0, bodyHigh: [
        { acts: [glory, a('heal_as_percent_damage', { ratio: 1 / 3, next: false })] },
      ] })] },
    ], 0),
    // 自身下場後：1回合內令己方下隻出戰精靈獲得上述降低與恢復效果，每有1層聖芒延長1回合
    e('on_switch_out', 'switch_out', '自身下場後，1回合內令己方下隻出戰精靈登場前1回合獲得上述降低傷害效果與回合結束時恢復效果，每有1層燦界聖芒則延長1回合', [
      { acts: [inheritGuard] },
    ], 1),
    // 自身使用技能：特攻速度+2命中+1；對手特防速度-2命中-1
    e('before_skill', 'before_skill', '自身使用技能時：令自身特攻、速度+2、命中+1；附加對手特防、速度-2、命中-1', [
      { acts: [
        a('stat', { side: 'self', stats: ['特攻', '速度'], v: 2 }),
        a('stat', { side: 'self', stats: ['命中'], v: 1 }),
        a('stat', { side: 'opp', stats: ['特防', '速度'], v: -2 }),
        a('stat', { side: 'opp', stats: ['命中'], v: -1 }),
      ] },
      weakPoint,
    ], 2),
    // 對手使用技能：對手雙攻速度-2命中-1；自身雙防速度命中+1
    e('on_attacked', 'opp_skill', '對手使用技能時：令對手雙攻、速度-2、命中-1；附加自身雙防、速度、命中+1', [
      { acts: [
        a('stat', { side: 'opp', stats: ['雙攻', '速度'], v: -2 }),
        a('stat', { side: 'opp', stats: ['命中'], v: -1 }),
        a('stat', { side: 'self', stats: ['雙防', '速度', '命中'], v: 1 }),
      ] },
      weakPoint,
    ], 3),
    // 燦界聖芒：己方戰鬥階段結束時，敵我每有1回合星贖→降低己方控制類異常回合（層數×2），最高降至1回合
    e('on_attacked', 'team_opponent_skill', '觀察對方本回合實際使用技能，供階段末PP條款判定', [
      { acts: [a('turn_key_set', { side: 'self', key: 'observedOpponentSkillTurns', turns: 1 })] },
    ], 4),
    e('battle_phase_end', 'team_phase_end', '己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍，異常回合數最高降至1回合', [
      { cond: [c('mark_count', { side: 'self', id: 'canGlory', op: '不小於', amount: 1 }, '持有燦界聖芒')], acts: [
        a('status_turns_count', { status: '星贖', mult: 2, markId: 'canGlory' }),
        a('control_duration_reduce', { min: 1 }),
      ] },
    ], 5),
    // 燦界聖芒：對方技能戰鬥階段結束時，敵我每有1回合星贖→降低對手技能PP（層數等量），最多降至1；不大於1時PP上限歸1
    e('battle_phase_end', 'team_phase_end', '對方技能戰鬥階段結束時敵我雙方每有1回合星贖降低對手等同於燦界聖芒層數所有技能等量技能PP值，最多降低至1點PP值；若對手被降低後PP值不大於1時額外令對手PP值該技能PP值上限歸1', [
      { cond: [c('mark_count', { side: 'self', id: 'canGlory', op: '不小於', amount: 1 }, '持有燦界聖芒'), c('stored_flag', { key: 'observedOpponentSkillTurns' })], acts: [
        a('status_turns_count', { status: '星贖', mult: 1, markId: 'canGlory' }),
        a('pp_reduce_floor', { side: 'opp', min: 1, capAtFloor: true }),
      ] },
    ], 6),
  ],
};
