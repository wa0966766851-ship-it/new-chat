import { authoredEntry as entry, authoredSkill as skill, operation as op, actions as act, condition as cond } from './authoredKitTools';
import { GRAUEN_TEXT } from './strengthenedElfDescriptions';
import { property } from './reviewedSequenceSkillKits';

const sure = () => property('必中', 'sure_hit', true, 0);
const hit = (order: number, text: string, ...body: any[]) => entry(text, 'use', body, order);
const status = (name: string, side = 'opp') => op('status', { side, status: name, turns: 3, chance: 100 });
const heal = (ratio: number) => op('heal', { side: 'self', ratio });
const timed = (turns: number, trig: string, body: any[], initial = false) =>
  op('timed', { turns, from: 'now', trig, body, ...(initial ? { initial, initialAfterSettlement: true } : {}) });
export function grauenSkills(markPrograms: any[]) {
  const unsettledHeal = op('recovery_checked_then', { ratio: 1, noHealBody: [act(status('焚燼'))] });

  return [
  skill('火之風息', '無屬性', '屬性', 0, 5, 0, [
    sure(),
    hit(1, '4回合內免疫並反彈自身受到的所有異常狀態', act(op('immune_status_turns', { turns: 4, reflect: true, cls: '' }))),
    hit(2, '3回合內，對手使用屬性技能時，100%令其麻痺', act(timed(3, 'opp_used_status', [act(status('麻痺'))]))),
    hit(3, '3回合內，對手使用攻擊技能後，令自身下2回合屬性技能的附加效果失效', act(timed(3, 'opp_after_attack', [
      act(op('attached_effect_lock', { side: 'self', kind: '屬性', turns: 2 })),
    ]))),
    hit(4, '3回合內，對手使用攻擊技能後，隨機為其附加2種異常狀態', act(timed(3, 'opp_after_attack', [
      act(op('status_random', { count: 2 })),
    ]))),
  ], { sure: true, labelEffects: true }),

  skill('雲燁竭天', '電.火', '物理', 90, 20, 3, [
    property('先制+3', 'base_priority', 3, 0),
    hit(1, '消除對手能力提升狀態。消除成功則2回合內對手無法造成攻擊傷害，且技能附加效果失效',
      act(op('stat_clear', { side: 'opp', kind: 'up' })),
      { chain: 'success', acts: [op('attack_damage_lock', { turns: 2, kind: 'all' })] }),
    hit(2, '100%令對手麻痺。未觸發則2回合內對手屬性技能無效',
      act(status('麻痺')), { chain: 'fail', acts: [op('invalid_turns', { kind: '屬性', turns: 2, next: false })] }),
    hit(3, '附加自身當前體力1/3的百分比傷害',
      act(op('dmg', { of: 'self', base: '當前體力', ratio: 1 / 3, type: '百分比' }))),
    entry('未擊敗對手則恢復自身最大體力的1/3', 'not_killed', [act(heal(1 / 3))], 4),
    entry('出手流程結束後解除自身異常狀態。每解除1項，恢復自身最大體力的30%，並額外獲得1次非真實傷害減半',
      'self_after_skill', [act(op('cure_status', { side: 'self' }), op('reward_cured_statuses', { healRatio: .3, damageMultiplier: .5 }))], 5),
    hit(6, '自身體力低於對手時，造成的攻擊傷害提升75%。先出手時，增傷幅度翻倍至150%', {
      cond: [cond('hp_cmp', { side: 'self', op: '低於' }), cond('first')],
      acts: [op('boost', { kind: '攻擊', mult: 2.5 })],
    }, {
      cond: [cond('hp_cmp', { side: 'self', op: '低於' }), cond('last')],
      acts: [op('boost', { kind: '攻擊', mult: 1.75 })],
    }),
  ], { accuracy: 100, labelEffects: true }),

  skill('雷之脈動', '無屬性', '屬性', 0, 5, 0, [
    sure(),
    hit(1, '全屬性+1。任一方處於異常狀態時，提升幅度翻倍',
      act(op('stat', { side: 'self', stats: ['全屬性'], v: 1, x2If: cond('abnormal', { side: 'any' }) }))),
    hit(2, '自身未處於任何異常狀態時，進入雷解3回合。若自身已處於雷解，則改為消除對手回合類效果',
      { cond: [cond('has_status', { side: 'self', status: '雷解' })], acts: [op('clear_turn', { side: 'opp' })] },
      { cond: [cond('abnormal', { side: 'self', neg: true })], acts: [status('雷解', 'self')] }),
    hit(3, '將雙方目前體力調整為相同值，取兩者平均並受雙方最大體力上限限制', act(op('average_current_health'))),
    hit(4, '5回合內，每回合首次使用技能時吸取對手最大體力的1/3。吸取前自身體力低於最大體力的1/2時，吸取量翻倍。對手體力未減少則2回合內無法恢復體力',
      act(timed(5, 'self_skill', [act(op('once_per_round', { key: 'timed-health-drain', body: [act(op('drain_checked_then', {
        type: '百分比', ratio: 1 / 3, extraRatio: 1 / 3, extraBelowHpRatio: .5, measure: 'lost', threshold: 1,
        belowBody: [act(op('no_heal', { turns: 2 }))],
      }))] }))], true))),
    hit(5, '下2回合自身造成的攻擊傷害提升150%', act(op('dmg_mod_turns', { dir: 'out', kind: '攻擊', boost: 1.5, turns: 2, next: true }))),
    hit(6, '免疫下次受到的攻擊', act(op('immune_attack_count', { count: 1 }))),
    hit(7, '下2回合自身所有技能先制+2', act(op('prio_turns', { turns: 2, v: 2, next: true }))),
  ], { sure: true, accuracy: 95, labelEffects: true }),

  skill('王·祭煉昭灼', '電.火', '物理', 150, 5, 0, [
    sure(),
    entry('雙方在場精靈每處於1項異常狀態，先制+1', 'modify_priority',
      [act(op('status_count_priority', { side: 'both', amount: 1 }))], 1, 'skill', true),
    hit(2, '對手同時擁有護盾與護罩時將兩者消除。消除成功則令對手麻痺、焚燼，任一項異常未成功附加則另外令其燒傷、易燃、束縛',
      act(op('clear_both_protections', { statuses: ['麻痺', '焚燼'], fallback: ['燒傷', '易燃', '束縛'], turns: 3 }))),
    hit(3, '對手本回合每成功受到1次異常，或目前每處於1項異常，自身攻擊傷害額外提升100%。兩種計數分開計算',
      act(op('status_count_snapshot', { side: 'opp', includeApplications: true }), op('boost', { kind: '攻擊', mult: 1, perLastAmount: 1 }))),
    entry('按同一計數，每次獨立附加對手最大體力30%的百分比傷害', 'after_hit',
      [act(op('status_count_damage', { ratio: .3 }))], 4),
    hit(5, '恢復自身所有技能5點PP', act(op('pp_restore', { v: 5 }))),
  ], { sure: true, accuracy: 95, labelEffects: true }),

  skill('王·焚罡九虺', '電.火', '物理', 160, 5, 0, [
    sure(),
    entry('自身處於能力下降狀態時，先制+3', 'modify_priority',
      [act(op('prio_bonus', { v: 3 }))], 1, 'skill', true, [cond('stage', { side: 'self', kind: 'down' })]),
    entry('攻擊時若克制關係為微弱，按普通倍率計算', 'before_skill', [act(op('no_resist'))], 2, 'skill', true),
    hit(3, '消除對手回合類效果。消除成功則令對手焚燼，無法消除或沒有回合類效果時，對手所有技能PP歸零',
      act(op('clear_turn', { side: 'opp' })), { cond: [cond('success')], acts: [status('焚燼')], elseActs: [op('pp_zero_all')] }),
    hit(4, '反轉自身能力下降狀態。反轉成功則恢復全部體力，若無法恢復則令對手焚燼',
      act(op('stat_reverse', { side: 'self', kind: 'down' })), { chain: 'success', acts: [unsettledHeal] }),
    entry('未擊敗對手時，取兩種印記層數的平均值。每層九劫之痕令自身下2次技能先制+1，每層百煉之炎令自身下2次攻擊技能連擊次數+1',
      'not_killed', [act(op('balance_paired_marks', { first: 'grauenTrial', second: 'grauenFlame', uses: 2, programs: markPrograms }))], 5),
    hit(6, '下次擊敗對手時，每有1組九劫之痕與百煉之炎，依序為對手下隻精靈附加束縛、麻痺、焚燼中的1種，並吸取其最大體力的15%',
      act(op('watch', { trig: 'kill', text: '下次擊敗後施加異常與吸取', persistsOffField: false, key: 'paired-entry-status', body: [
        act(op('paired_mark_enemy_entry', { first: 'grauenTrial', second: 'grauenFlame', statuses: ['束縛', '麻痺', '焚燼'], ratio: .15, turns: 3 })),
      ] }))),
  ], { sure: true, accuracy: 95, fifth: true, labelEffects: true }),
].map(item => ({ ...item, description: GRAUEN_TEXT.skills[item.name] }));
}

