import type { Elf } from '../types';
import { authoredEntry as entry, operation as op, actions as act, condition as cond } from './authoredKitTools';
import { GRAUEN_TEXT, GRAUEN_TRIAL_TEXT, GRAUEN_FLAME_TEXT } from './strengthenedElfDescriptions';
import { grauenSkills } from './grauenSkills';

const pair = { first: 'grauenTrial', second: 'grauenFlame' };
const trial = GRAUEN_TRIAL_TEXT;
const flame = GRAUEN_FLAME_TEXT;
const highKey = 'healthComparisonRoundStartUses', lowKey = 'healthComparisonPhaseEndUses';

function makeMark(first: boolean, temporary = false) {
  const immunity = first ? '麻痺' : '焚燼';
  const convert = first
    ? { side: 'self', category: 'WEAKENING', status: '雷解' }
    : { side: 'opp', category: 'AUXILIARY', status: '燒傷' };
  return {
    id: first ? pair.first : pair.second,
    name: first ? '九劫之痕' : '百煉之炎',
    description: first ? trial : flame,
    displayChar: first ? '劫' : '炎',
    scope: 'elf', side: 'self',
    count: 1, maxCount: 3, mode: 'add',
    ...(temporary ? { turns: 1 } : {}),
    unit: temporary ? '回合' : '層', persistsOffField: !temporary,
    statusProjection: { target: first ? 'holder' : 'opponent', category: convert.category, status: convert.status },
    rules: [
      { raw: '免疫' + immunity, trig: 'before_status', parsed: true, cond: [cond('event_status', { statuses: [immunity] })], body: [act(op('status_guard', { cls: '' }))] },
      { raw: '回合結束時轉化相應分類的異常', trig: 'round_end', parsed: true, body: [act(op('paired_mark_status_convert', { ...convert, turns: 3 }))] },
      first
        ? { raw: '未擊敗對手且對手體力低於30%時消耗一組印記', trig: 'not_killed', parsed: true, body: [act(op('paired_mark_finish', { ...pair, threshold: .3 }))] }
        : { raw: '致命時消耗一組印記，保留1點體力並清除雙方狀態', trig: 'fatal', parsed: true,
          body: [act(op('paired_mark_lethal', { ...pair, statuses: ['燒傷', '易燃', '焚燼'], turns: 3 }))] },
    ],
  };
}
const soul = (text: string, trig: string, order: number, ...body: any[]) => entry(text, trig, body, order, 'soulmark');
const status = (name: string, side = 'opp') => op('status', { side, status: name, turns: 3, chance: 100 });
const sample = act(op('paired_mark_sample', { highKey, lowKey, uses: 2 }));
const pass = act(op('paired_mark_pass', { ...pair, programs: [makeMark(true, true), makeMark(false, true)] }));

const GRAUEN_SKILLS = grauenSkills([makeMark(true), makeMark(false)]);

const kit = [
  soul('登場後為自身附加1組九劫之痕與百煉之炎', 'entrance', 0, act(op('mark_program', makeMark(true)), op('mark_program', makeMark(false))), sample),
  soul('登場與任一方體力實際變動時比較目前體力。自身體力不低於對手時刷新回合開始效果的2次，自身體力不高於對手時刷新戰鬥階段結束效果的2次',
    'active_hp_changed', 1, sample),
  soul('下2次回合開始時，自身當回合所有技能先制+1、造成的攻擊傷害提升100%，並進入雷解3回合。雷解成功則獲得1層九劫之痕，未觸發則令對手焚燼3回合',
    'round_start', 2, act(op('counter_spend', { key: highKey, amount: 1, label: '回合開始', body: [
      act(op('prio_turns', { turns: 1, v: 1, current: true }), op('dmg_mod_turns', { dir: 'out', kind: '攻擊', boost: 1, turns: 1 })),
      act(status('雷解', 'self')),
      { cond: [cond('success')], acts: [op('mark_program', makeMark(true))], elseActs: [status('焚燼')] },
    ] }))),
  soul('下2次戰鬥階段結束時令對手麻痺3回合。麻痺成功則令對手燒傷3回合，未觸發則獲得1層百煉之炎',
    'phase_end', 3, act(op('counter_spend', { key: lowKey, amount: 1, label: '戰鬥階段結束', body: [
      act(status('麻痺')), { cond: [cond('success')], acts: [status('燒傷')], elseActs: [op('mark_program', makeMark(false))] },
    ] }))),
  soul('回合結束後，任一方處於異常狀態時，自身恢復最大體力的1/2，並造成等同於實際恢復量的百分比傷害。持有至少3組印記時取消異常狀態條件',
    'round_end', 4, act(op('paired_mark_recovery', { ...pair, minimum: 3, ratio: .5 }))),
  soul('回合結束後，若自身未處於雷解且目前體力高於對手，對手下2次屬性技能先制-2，且無法附加異常狀態',
    'round_end', 5, {
      cond: [cond('has_status', { side: 'self', status: '雷解', neg: true }), cond('hp_cmp', { side: 'self', op: '高於' })],
      acts: [op('paired_mark_followup', { ...pair, mode: 'utility', uses: 2, freeAt: 3, status: '焚燼', turns: 3 })],
    }),
  soul('回合結束後，若對手未處於燒傷且自身目前體力低於對手，自身下2次攻擊技能先制+2，使用後令對手焚燼。持有至少3組印記時，上述兩項後續效果不消耗次數',
    'round_end', 6, {
      cond: [cond('has_status', { side: 'opp', status: '燒傷', neg: true }), cond('hp_cmp', { side: 'self', op: '低於' })],
      acts: [op('paired_mark_followup', { ...pair, mode: 'attack', uses: 2, freeAt: 3, status: '焚燼', turns: 3 })],
    }),
  soul('下場時保留成對的印記，並將兩種印記各傳給己方下隻精靈1回合', 'switch_out', 7, pass, act(op('clear_health_comparison', { highKey, lowKey }))),
];

export const GRAUEN_SEED = {
  id: '5049', seerId: 3407, name: '格勞恩斯', level: 100, type: '電.火',
  height: 177, weight: 69, gender: '雄性',
  baseStats: { atk: 145, spatk: 80, def: 132, spdef: 132, speed: 138, hp: 163 },
  skills: GRAUEN_SKILLS, skillPool: GRAUEN_SKILLS.map(skill => structuredClone(skill)),
  soulMark: {
    name: '格勞恩斯魂印',
    description: GRAUEN_TEXT.soul,
    kit, effectMode: 'kit', effectType: 'none', effectValue: 0,
  },
} as Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'>;

