import type { KitEntry } from '../effects/effectSystem.schema';
import { authoredEntry as entry, authoredSkill as skill, operation as op, actions as act, condition as cond } from './authoredKitTools';
import { LEONIDAS_TEXT } from './strengthenedElfDescriptions';
import { property } from './reviewedSequenceSkillKits';

const sure = () => property('必中', 'sure_hit', true, 0);
const line = (order: number, text: string, ...body: any[]) => entry(text, 'use', body, order);
const innate = (order: number, text: string, trigger: string, ...body: any[]) => entry(text, trigger, body, order, 'skill', true);
const carried = (order: number, text: string, trigger: string, ...body: any[]): KitEntry =>
  {
    const item = entry(text, trigger, body, order);
    if (trigger === 'team_before_status') item.params.clause.observer = { includeBlocked: true };
    return { ...item, role: 'carried' };
  };
const status = (name: string, side = 'opp', turns = 3) => op('status', { status: name, side, turns, chance: 100 });
const abnormal = (side: string, neg = false) => cond('abnormal', { side, neg });
const weight = (side: string, amount: number) => op('weight_adjust', { side, amount });
const harm = op('weight_skill_damage', { side: 'self', ratio: .75, element: '遠古', doublePerInvalid: true });
const guard = op('weight_stage_guard', { turns: 3, mode: 'block_up' });
export const ANCIENT_SLEEP = skill('曠古長眠', '遠古', '特殊', 120, 10, 0, [
  line(1, '100%令對手防禦、特防等級各-2', act(op('stat', { side: 'opp', stats: ['防禦', '特防'], v: -2 }))),
], { accuracy: 95, labelEffects: true });

export const DEVOUT_HEART = skill('虔誠之心', '無屬性', '屬性', 0, 10, 0, [
  sure(),
  line(1, '3回合內，每回合首次使用技能時恢復自身最大體力的1/3', act(op('timed', {
    turns: 3, from: 'now', trig: 'self_skill', initial: true, body: [act(op('once_per_round', {
      key: 'devoutHeart', body: [act(op('heal', { side: 'self', ratio: 1 / 3 }))],
    }))],
  }))),
], { sure: true, accuracy: 100, labelEffects: true });

export const ANCIENT_SONG = skill('亙古之歌', '遠古', '屬性', 0, 1, 0, [
  line(1, '解除己方在場精靈的能力下降狀態並使對手重量增加100',
    act(op('with_active_elf', { body: [act(op('stat_clear', { side: 'self', kind: 'down' }))] }), weight('opp', 100))),
  line(2, '對敵方在場精靈造成等同於其重量的遠古系傷害，並為己方在場精靈附加等量護盾', act(op('weighted_song_damage'))),
  line(3, '消除對手回合類效果並100%令對手疲憊', act(op('clear_turn', { side: 'opp' }), status('疲憊'))),
  line(4, '3回合內對手無法處於能力提升狀態，體力恢復量降低100%', act(guard, op('heal_reduce_turns', { turns: 3, ratio: 1 }))),
  innate(5, '每次詠唱視為當回合列奧尼達選擇使用屬性技能', 'use', act(op('weight_record_song_category'))),
]);

export const LEONIDAS_SKILLS = [
  skill('歲月蹉跎', '無屬性', '屬性', 0, 5, 1, [
    sure(), property('先制+1', 'base_priority', 1, 1),
    carried(2, '對手每次接受異常附加判定時，為對手附加1道歲月之痕。自身免疫歲月之痕降低能力值的效果',
      'team_before_status', { cond: [cond('event_on_opp', {})], acts: [op('age_mark_add', { side: 'opp' })] }),
    line(3, '100%令自身腐朽', act(status('腐朽', 'self'))),
    line(4, '隨機令對手進入2種異常狀態。對手未進入控制類異常或已處於腐朽時，3回合內屬性技能無效',
      act(op('status_random_then_invalid', { count: 2, successClass: '控制類', fallbackStatus: '腐朽', kind: '屬性', turns: 3 }))),
    line(5, '解除自身異常狀態。解除成功則3回合內對手所有技能附加效果失效',
      act(op('cure_status', { side: 'self' })),
      { chain: 'success', acts: [op('add_invalid_turns', { kind: 'all', turns: 3 })] }),
    line(6, '5回合內免疫並反彈所有受到的異常狀態', act(op('immune_status_turns', { turns: 5, reflect: true, cls: '' }))),
    line(7, '以自身重量的75%計算遠古系傷害。雙方每處於1種技能無效效果，傷害翻倍一次', act(harm)),
    innate(8, '本次技能無效時，仍按上述公式重新結算遠古系傷害', 'on_invalid', act(harm)),
  ], { sure: true, labelEffects: true }),
  skill('荒墟辟易', '遠古', '物理', 90, 20, 3, [
    property('先制+3', 'base_priority', 3, 0),
    carried(1, '對手重量高於自身且自身先出手時，令對手所有技能PP值歸1', 'before_action',
      { cond: [cond('first'), cond('weight_compare', { side: 'self', op: '低於' })], acts: [op('weight_pp_set', { amount: 1 })] }),
    line(2, '吸取對手能力提升狀態。吸取成功則自身下次選擇攻擊技能時先制+1，並無視對手等量先制',
      act(op('stat_steal', { mode: '吸取' })), { chain: 'success', acts: [op('next_attack_priority_offset', { amount: 1 })] }),
    entry('命中後降低對手所有技能PP值2點，所選技能PP值歸零時使對手當回合無法行動',
      'after_hit', [act(op('pp_op', { side: 'opp', mode: 'reduce', amount: 2, stopIfEmpty: true }))], 3),
    line(4, '解除雙方異常並各增加50重量，自身進入砥礪1回合。每解除1種，對手1回合內攻擊技能無效且無法進入或附加異常',
      act(op('status_clear_weight', { amount: 50, rewardStatus: '砥礪', kind: '攻擊' }))),
  ], { accuracy: 100, labelEffects: true }),
  skill('末法迪知', '無屬性', '屬性', 0, 5, 0, [
    sure(),
    innate(1, '自身處於異常狀態時，先制+3', 'modify_priority',
      { cond: [abnormal('self')], acts: [op('prio_bonus', { v: 3 })] }),
    line(2, '全屬性+1，自身處於異常狀態時效果翻倍', act(op('stat', { side: 'self', stats: ['全屬性'], v: 1, x2If: abnormal('self') }))),
    line(3, '自身處於異常狀態時，為己方上一隻在場精靈恢復其最大體力的1/3。否則增加對手50重量',
      { cond: [abnormal('self')], acts: [op('weight_previous_heal', { ratio: 1 / 3 })], elseActs: [weight('opp', 50)] }),
    line(4, '恢復自身全部體力，並附加等同於實際恢復量的百分比傷害', act(op('heal_and_percent', { ratio: 1 }))),
    line(5, '下2回合自身所有技能先制+2', act(op('prio_turns', { turns: 2, v: 2, next: true }))),
  ], { sure: true, accuracy: 95, labelEffects: true }),
  skill('王·天衍破霜', '遠古', '物理', 150, 5, 0, [
    sure(),
    carried(1, '自身受到控制類異常時，若對手重量不高於自身則解除所有異常狀態', 'status_received',
      act(op('weight_control_cleanse'))),
    line(2, '3回合內，對手每次執行能力提升效果時，所有攻擊技能PP值歸1',
      act(op('weight_enemy_monitor', { mode: 'stage', turns: 3 }))),
    line(3, '3回合內，對手每次執行恢復體力效果時，扣除相當於雙方重量總和25%的最大體力',
      act(op('weight_enemy_monitor', { mode: 'heal', turns: 3 }))),
    line(4, '雙方每有1種回合類效果，延長雙方既有異常1回合。雙方每有1回合異常，各增加50重量',
      act(op('status_turn_exchange', { amount: 50 }))),
    line(5, '額外威力等於自身重量的50%。對手目前體力每滿20%，整個技能威力額外提升10%',
      act(op('weight_power', { ratio: .5, hpStep: .2, hpBonus: .1 }))),
  ], { sure: true, accuracy: 95, labelEffects: true }),
  skill('王·宿世歸泯', '遠古', '物理', 160, 5, 0, [
    sure(),
    carried(1, '登場時為自身附加腐朽；該次腐朽結束前，每回合扣除自身所有異常3回合，並抵擋受到的攻擊',
      'entrance', act(op('weight_entry_status_window', { status: '腐朽', turns: 3, deduct: 3 }))),
    carried(7, '登場所附加的腐朽仍在時，每回合扣除自身所有異常狀態3回合', 'round_end', act(op('weight_entry_status_tick'))),
    innate(2, '精靈王特權。攻擊克制為微弱時按普通倍率計算', 'before_skill', act(op('no_resist'))),
    line(3, '消除對手回合類效果，成功則吸取對手最大體力的1/3',
      act(op('clear_turn', { side: 'opp' })), { chain: 'success', acts: [op('drain', { ratio: 1 / 3 })] }),
    line(4, '2回合內，對手使用技能的PP消耗量提高至20倍',
      act(op('pp_cost_mult', { turns: 2, mult: 20 }))),
    line(5, '每次使用使自身造成的所有技能傷害提升20%，最多提升120%，持續至下場。使用時自身重量超過300則消耗100重量，該次增傷保留至整場對戰結束，換下再上仍保留',
      act(op('weight_ramp', { step: .2, cap: 1.2, threshold: 300, cost: 100 }))),
    entry('吸取等同於本次技能結算傷害100%的體力。數值低於300則改為汲取',
      'after_hit', [act(op('weight_drain_from_skill', { threshold: 300 }))], 6),
  ], { sure: true, accuracy: 95, fifth: true, labelEffects: true }),
].map(item => ({ ...item, description: LEONIDAS_TEXT.skills[item.name] }));

