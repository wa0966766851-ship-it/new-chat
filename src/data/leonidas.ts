import type { Elf } from '../types';
import { authoredEntry as entry, operation as op, actions as act } from './authoredKitTools';
import { LEONIDAS_TEXT } from './strengthenedElfDescriptions';
import { ANCIENT_SLEEP, DEVOUT_HEART, LEONIDAS_SKILLS } from './leonidasSkills';

const extra = { id: 'x_ancient_weight_beast', name: '亙古遺獸', type: '遠古' };
const families = ['喬列尼德', '列奧尼達', '喬特魯德'];
const roundChoice = { id: extra.id, name: '亙古之歌', status: '腐朽' };
const soul = (order: number, text: string, trigger: string, ...body: any[]) => entry(text, trigger, body, order, 'soulmark');

const soulKit = [
  soul(0, '亙古遺獸作為額外精靈加入己方，並紀錄敵我雙方所有精靈的重量。其六項能力值等同於紀錄重量總和',
    'battle_start', act(op('record_weight_extra', extra))),
  soul(1, '若自身選擇使用技能，使用時100%令對手腐朽。成功則令對手下次主動切換上場的精靈重量增加150，速度值降低20%',
    'self_skill', act(op('weight_choice_use'))),
  soul(2, '當回合選擇的技能類型與上次相同時，先制+1且造成的技能傷害提高150%。若自身先制不為0，先制與增傷幅度翻倍',
    'modify_priority', act(op('weight_choice_priority'))),
  soul(3, '當回合選擇的技能類型與上次不同時，出手流程結束時恢復自身最大體力的1/2並造成等量百分比傷害；自身不須出手',
    'team_action_end', act(op('weight_choice_after'))),
  soul(4, '回合開始時，記錄自身選擇的技能類型',
    'before_round_start', act(op('weight_round_choice', roundChoice))),
  soul(5, '上述任一效果觸發時，回合結束吸取對手最大體力的1/3',
    'team_round_end', act(op('weight_choice_drain', { ratio: 1 / 3 }))),
  soul(6, '自身每擁有1個具有攜帶類效果的技能，受到非真實傷害額外降低15%',
    'incoming_nontrue', act(op('weight_carry_passive', { ratio: .15 }))),
  soul(7, '自身每擁有1個具有攜帶類效果的技能，戰鬥階段結束時額外恢復自身最大體力15%',
    'phase_end', act(op('weight_carry_passive', { ratio: .15 }))),
  soul(8, '每次使用帶有攜帶類效果的技能，附加1道歲月之痕，戰鬥階段結束時恢復所有技能1點PP。自身與亙古遺獸皆存活時，觸發對象改為己方在場精靈',
    'team_skill_used', act(op('weight_carry_event', extra))),
  soul(10, '依本回合成功觸發的攜帶類技能效果恢復PP',
    'team_phase_end', act(op('weight_carry_phase'))),
  soul(11, '任意一方每次接受異常附加判定時，亙古遺獸使己方在場精靈獲得紀錄重量總和50%的護盾和護罩，並吸取對手同位技能相當於其PP上限2/5的PP',
    'team_before_status', act(op('recorded_weight_status', { id: extra.id, families, ratio: .5, ppRatio: .4 }))),
  soul(12, '護盾或護罩抵擋傷害或被消耗時，若己方在場精靈當回合受到的固定及百分比傷害達護盾護罩總量60%，2回合內死亡時保留1點體力。保命觸發後亙古遺獸死亡，前述異常判定效果改為僅喬列尼德、列奧尼達、喬特魯德任意型態生效',
    'team_opponent_damage_settled', act(op('recorded_weight_guard', { id: extra.id, threshold: .6, turns: 2 }))),
  soul(14, '戰鬥階段結束時，未選擇使用技能才增加重量並交由額外精靈詠唱',
    'team_phase_end', act(op('weight_phase_choice', roundChoice))),
  soul(13, '選擇主動切換精靈時，記錄本回合未選擇使用技能',
    'switch_out', act(op('weight_round_choice', { ...roundChoice, whenVoluntarySwitch: true }))),
];
for (const item of soulKit) {
  if (item.order === 11) item.params.clause.observer = { includeDead: true, includeBlocked: true };
  if (item.order === 12) item.params.clause.observer = { includeDead: true };
}
soulKit[8].customText += '\n> 己方在場精靈未處於腐朽時，亙古遺獸觸發虔誠之心。觸發時，己方當前回合類效果不被敵方視為回合類效果。\n> 自身存活且亙古遺獸死亡時，為己方觸發3次曠古長眠。對手3回合內無法解除、反轉能力下降狀態，且不被敵方技能效果視為處於能力下降狀態。曠古長眠成功則亙古遺獸重生。';
soulKit[8].params.clause.raw = soulKit[8].customText;

export const LEONIDAS_SEED = {
  id: '5050', seerId: 4125, name: '洪荒·列奧尼達', level: 100, type: '遠古',
  height: 200, weight: 100, gender: '雄性',
  baseStats: { hp: 177, atk: 145, def: 125, spatk: 80, spdef: 125, speed: 138 },
  skills: LEONIDAS_SKILLS,
  skillPool: [...LEONIDAS_SKILLS, ANCIENT_SLEEP, DEVOUT_HEART].map(item => structuredClone(item)),
  soulMark: { name: '洪荒·列奧尼達魂印', effectMode: 'kit', effectType: 'none', effectValue: 0,
    description: LEONIDAS_TEXT.soul, kit: soulKit },
} as Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'>;

