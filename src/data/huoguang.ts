
import type { Elf } from '../types';
import { authoredEntry as entry, authoredSkill as skill, operation as op, actions as act, condition as cond } from './authoredKitTools';
import { property } from './reviewedSequenceSkillKits';

const bladeText = '霍光持有時使用攻擊技能不受當前PP限制且必定打出致命一擊';
const upgradedText = bladeText + '；使用技能後附加上次擊敗對手的回合所造成攻擊傷害100%的真實傷害';
const strongText = '霍光持有時若擁有北冥之刃則造成的致命一擊傷害提升150%，擁有北冥狂刃則增傷效果翻倍';
const unboundText = '霍光持有時若擁有北冥之刃則攻擊技能傷害計算時克制倍數至少為1，擁有北冥狂刃則克制倍數至少為2';
const breakingText = '霍光持有時若擁有北冥之刃則每次對手主動切換精靈，該精靈出戰時100%進入束縛狀態，擁有北冥狂刃則束縛效果附加後額外害怕';
const upgradeText = '霍光英勇善戰，在戰鬥中能熟練使用北冥之刃破敵，且每次自身擊敗對手後，北冥之刃將在3回合內升級為北冥狂刃，3回合後重置，若擊敗對手時自身已持有北冥狂刃則會刷新重置回合數';
const formText = '霍光武力過人，在戰鬥中擁有強擊、無罔、威破三大形態，每種形態具備不同的效果且同時享有所有形態效果，初始主要形態為強擊形態，可以通過使用技能轉換主要形態';
const fatalText = '霍光當回合首次受到致命傷害時，直到當回合結束每次受到致命傷害時保留1點體力，並於回合結束時失去當前主要形態效果，依序令下一形態變為主要形態。每回合最多失去1種主要形態，三種形態皆失去後，此保命效果失效';
const trueText = '每次使用技能額外附加對手最大體力25%的真實傷害';

const display = (id: string, name: string, displayChar: string, description: string) => ({ id, name, displayChar, description });
const cycle = {
  key: 'weaponAndCombatForms',
  blade: display('huoguang-blade', '北冥之刃', '刃', bladeText),
  upgraded: display('huoguang-frenzy', '北冥狂刃', '狂', upgradedText),
  forms: [
    display('huoguang-impact', '強擊形態', '強', strongText),
    display('huoguang-unbound', '無罔形態', '罔', unboundText),
    display('huoguang-breaking', '威破形態', '破', breakingText),
  ],
  upgradeRounds: 3, criticalBonus: 1.5, statusTurns: 3,
};
const change = (step: string, params = {}) => op('form_cycle', { cycle, step, ...params });
const soul = (order: number, text: string, trigger: string, step: string, params = {}) =>
  entry(text, trigger, [act(change(step, params))], order, 'soulmark');
const soulKit = [
  soul(0, formText, 'battle_start', 'init'),
  soul(1, formText, 'entrance', 'init'),
  soul(2, bladeText + '；' + unboundText, 'before_skill', 'prepare'),
  soul(3, strongText, 'outgoing_attack', 'critical'),
  soul(4, upgradedText, 'opp_damage_settled', 'record'),
  soul(5, upgradeText, 'kill', 'upgrade'),
  soul(6, trueText + '；' + upgradedText, 'self_after_use', 'use', { ratio: .25 }),
  soul(7, fatalText, 'fatal', 'fatal'),
  soul(8, fatalText, 'round_end', 'end'),
  soul(9, fatalText, 'team_round_end', 'end'),
  soul(10, breakingText, 'opponent_switch_out', 'intercept'),
];

const soulText = [
  '【常駐效果】',
  '> ' + upgradeText,
  '> ' + formText,
  '>> ' + fatalText,
  '>> 透過技能轉換至已失去的形態時，恢復該形態的效果。',
  '>> ' + trueText,
  '> 北冥之刃、北冥狂刃及三大形態下場後均保留。',
  ...[cycle.blade, cycle.upgraded, ...cycle.forms].flatMap(mark => ['【' + mark.name + '】', '> ' + mark.description]),
].join('\n');

const sure = () => property('必中', 'sure_hit', true, 0);
const hit = (order: number, text: string, ...body: any[]) => entry(text, 'use', body, order);
const status = (name: string) => op('status', { side: 'opp', status: name, turns: cycle.statusTurns, chance: 100 });
const timed = (turns: number, trig: string, body: any[], initial = false) =>
  op('timed', { turns, from: 'now', trig, body, ...(initial ? { initial, initialAfterSettlement: true } : {}) });
const checkedDrain = (flat: number) => op('drain_checked_then', {
  type: '固定', flat, measure: 'lost', threshold: 1,
  belowBody: [act(op('dmg', { type: '真實', flat: 2880 }))],
});
const drain = () => op('drain', { ratio: .25, base: '最大體力', of: 'opp', type: '百分比' });
const blade = cond('mark_count', { side: 'self', id: cycle.upgraded.id, op: '不低於', amount: 1 });
const combined = '水.神秘';

function formSkill(name: string, index: number) {
  const form = cycle.forms[index].name;
  return skill(name, '無屬性', '屬性', 0, 5, 0, [
    sure(),
    hit(1, '自身免疫下2次自身受到的異常狀態（下場後消失）', act(op('immune_status_count', { count: 2, scope: 'self', persistsOffField: false }))),
    hit(2, '若自身當前主要形態不是' + form + '，則轉換為' + form + '；若已是' + form + '，則轉換為強擊形態。\n> 轉換至已失去的形態時，恢復該形態的效果。', act(change('switch', { form: index }))),
    hit(3, '下2次攻擊技能無視對手攻擊免疫效果', act(op('timed_uses', { uses: 2, trig: 'self_attack', kind: '攻擊', label: '無視攻擊免疫', body: [act(op('ignore', { what: '攻擊免疫' }))] }))),
    hit(4, '令自身體力等於最大體力的100%。\n> 調整前自身當前體力高於最大體力的50%時，回合結束後額外觸發一次該效果', {
      cond: [cond('hp_ratio', { side: 'self', op: '高於', ratio: .5 })],
      acts: [timed(1, 'round_end', [act(op('hp_set', { side: 'self', ratio: 1 }))])],
    }, act(op('hp_set', { side: 'self', ratio: 1 }))),
  ], { sure: true, labelEffects: true });
}

function bladeSkill(water: boolean) {
  const kind = water ? '攻擊' : '屬性';
  return skill(water ? '鯤·千里擊濤' : '鵬·萬里遨搖', water ? '水' : '神秘', '物理', 120, 20, 3, [
    sure(),
    property('先制+3', 'base_priority', 3, 1),
    water
      ? hit(2, '消除對手回合類效果。\n> 消除成功則100%令對手害怕。\n> 若對手不處於回合類效果則吸取對手最大體力的1/4',
        { cond: [cond('has_turn_effect', { side: 'opp' })], acts: [op('clear_turn', { side: 'opp' })] },
        { chain: 'success', acts: [status('害怕')] },
        { cond: [cond('has_turn_effect', { side: 'opp', neg: true })], acts: [drain()] })
      : hit(2, '吸取並反轉對手能力提升狀態。\n> 若對手不處於能力提升狀態則吸取對手最大體力的1/4',
        { cond: [cond('stage', { side: 'opp', kind: 'up' })], acts: [op('stat_steal', { mode: '吸取', reverse: true })], elseActs: [drain()] }),
    hit(3, '自身持有北冥狂刃時造成的攻擊傷害提升' + (water ? '150%' : '100%'),
      { cond: [blade], acts: [op('boost', { kind: '攻擊', mult: water ? 2.5 : 2 })] }),
    entry('未擊敗對手則下次自身使用所有技能先制+3', 'not_killed', [act(op('prio_next', { uses: 1, v: 3 }))], 4),
    entry('擊敗對手則令對手下隻出戰精靈首次使用的' + kind + '技能無效', 'kill', [act(op('next_entry_invalid', { kind }))], 5),
  ], { sure: true, accuracy: 95, labelEffects: true });
}

const all = [
  skill('漫江碧透', combined, '特殊', 130, 10, 0, [
    entry('先出手時使對手隨機2個技能PP值歸零', 'after_hit', [act(op('pp_zero_random', { count: 2 }))], 1, 'skill', false, [cond('first')]),
  ], { accuracy: 95, labelEffects: true }),
  skill('百舸爭流', combined, '特殊', 130, 10, 0, [
    entry('後出手時令對手當回合使用的技能的PP值額外-4', 'after_hit', [act(op('selected_opponent_pp_reduce', { amount: 4 }))], 1, 'skill', false, [cond('last')]),
  ], { accuracy: 95, labelEffects: true }),
  formSkill('無罔之心', 1), formSkill('威破之魂', 2), bladeSkill(true), bladeSkill(false),
  skill('光·命問星天', combined, '物理', 0, 5, 0, [
    sure(),
    hit(1, '全屬性+1，先出手時自身強化效果翻倍', act(op('stat', { side: 'self', stats: ['全屬性'], v: 1, x2If: cond('first') }))),
    hit(2, '5回合內免疫並反彈所有受到的異常狀態', act(op('immune_status_turns', { turns: 5, reflect: true, cls: '' }))),
    hit(3, '5回合內每回合使用技能100%令對手隨機進入3種控制類異常狀態',
      act(timed(5, 'self_skill', [act(op('status_random', { count: 3, cls: '控制類' }))], true))),
    hit(4, '5回合內每回合使用技能吸取對手280點體力。\n> 吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍。\n> 若對手受到固定傷害後體力未減少則額外附加2880點真實傷害',
      act(timed(5, 'self_skill', [{
        cond: [cond('hp_ratio', { side: 'self', op: '低於', ratio: .5 })],
        acts: [checkedDrain(560)], elseActs: [checkedDrain(280)],
      }], true))),
    hit(5, '5回合內每回合結束後降低對手所有技能1點PP值並恢復自身所有技能1點PP值',
      act(timed(5, 'round_end', [act(op('pp_op', { side: 'opp', mode: 'reduce', amount: 1 }), op('pp_restore', { v: 1 }))]))),
    hit(6, '下2回合對手正先制效果失效', act(op('no_pos_prio_turns', { turns: 2, next: true }))),
  ], { sure: true, accuracy: 95, fifth: true, labelEffects: true }),
];

export const HUOGUANG_SEED = {
  id: '5051', seerId: 4515, name: '霍光', level: 100, type: combined,
  height: 186, weight: 77, gender: '雄性',
  baseStats: { hp: 170, atk: 148, def: 112, spatk: 70, spdef: 112, speed: 138 },
  groupIds: ['huoguang-huojin', 'huoguang-chair', 'qiongming-ship', 'qiongming-trio', 'huoguang-tao', 'artisan-elf', 'beiming-huo'],
  resourceQueryRules: [cycle.blade, cycle.upgraded].map(mark => ({ id: mark.id, min: 1, ignoreAttackPpLimit: true })),
  skills: all.slice(2),
  skillPool: structuredClone(all),
  soulMark: { name: '光', badgeChar: '光', effectMode: 'kit', effectType: 'none', effectValue: 0, description: soulText, kit: soulKit },
} as Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'>;

