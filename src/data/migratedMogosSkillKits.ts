// 5034 邪靈主宰·摩哥斯 四技 Kit（摧妖斬/妖靈天性/王·墮落絕語/王·潰墮妖族）。
// 背隳誓盟已在 migratedReactionSkillKits（本檔不含）。全部效果走既有＋astral 通用 op。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const c3 = (name: string, p: any, label: string) => ({ c: name, p, label });
const inv34 = (raw: string, acts: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'innate', order, customText: raw,
  params: { clause: { raw, marker: '■', trig: 'self_invalid', parsed: true, body: [{ cond:[{c:'skill_invalid',p:{},label:'技能實際無效'}],acts }] } },
});

const cuiyao = ['■ 先制+3','🎯 與對手交換自身低於對手的能力等級，交換成功則100%令對手害怕','> 觸發後對手處於能力下降則自身無效下次對手的攻擊技能','> 觸發後自身處於能力提升狀態則當回合攻擊連擊次數+2','🎯 3回合內，對手屬性技能附加效果失效且造成非真實傷害無法超過280','🎯 附加對手已損失體力50%的百分比傷害，對手受到此傷害後體力未減少則轉為附加對手已損失體力50%的真實傷害','🎯 恢復自身所有技能5點PP值'];
const tianxing = ['■ 必中','🎯 全屬性+1，對手處於異常狀態時強化狀態翻倍','🎯 4回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍','🎯 下2回合自身所有技能先制+2'];
const duoluo = ['■ 先制+1','🎯 若當前HP低於對手，則造成攻擊傷害翻倍','🎯 造成傷害的100%恢復自身體力，若對手處於異常狀態則附加等量百分比傷害','🎯 解除自身異常狀態，解除成功則2回合內對手所有技能固有效果失效','🎯 技能無效時，開始令己方所有精靈直到下次摩哥斯使用第五技能成功後強制執行命中效果','> 摩哥斯使用第五技能時強制執行命中效果額外提升技能威力50點','> 對手每有1道埒殘銜闕時額外提升25點'];
const kuiduo = ['🎯 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）','🎯 消除對手回合類效果，消除成功則對手3回合內攻擊技能無效','🎯 吸取對手最大體力⅓並提升自身造成攻擊傷害25%','> 對手每有1道埒殘銜闕時上述吸取體力時其中25%百分比傷害轉化為汲取體力','> 雙方有存在1種技能無效、技能附加效果時造成攻擊傷害提升效果額外提升25%','🎯 未擊敗對手則使自身下次受到的攻擊傷害減半1次，對手每有1道埒殘銜闕時額外減半1次','🎯 擊敗對手則自身全屬性+1','>同時下次對手出戰時額外觸發一次自身出戰效果並令對手100%害怕'];

export const MIGRATED_MOGOS_SKILLS: ReviewedSequenceSkill[] = [
  { elfIds: ['5034'], name: '摧妖斬', description: cuiyao.join('\r\n'), kit: [
    property(cuiyao[0], 'base_priority', 3, 0),
    sequence(cuiyao[1], [
      { acts: [a('stat_swap', {})] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '害怕', chance: 100, turns: 3 })] },
      { cond: [c3('stage', { side: 'opp', kind: 'down' }, '對手能力下降')], acts: [a('invalid_next', { uses: 1, kind: '攻擊' })] },
      { cond: [c3('stage', { side: 'self', kind: 'up' }, '自身能力提升')], acts: [a('combo_add', { amount: 2 })] },
    ], 1),
    sequence(cuiyao[4], [{ acts: [
      a('add_invalid_turns', { kind: '屬性', turns: 3, next: false }),
      a('effect_turns', { keys: { nonTrueOutputLimit: 280 }, turns: 3, side: 'opp', label: '非真實上限280' }),
    ] }], 2),
    sequence(cuiyao[5], [
      { acts: [a('dmg', { base: '已損失體力', of: 'opp', ratio: 0.5, type: '百分比' })] },
      { chain: 'fail', acts: [a('dmg', { base: '已損失體力', of: 'opp', ratio: 0.5, type: '真實' })] },
    ], 3),
    sequence(cuiyao[6], [{ acts: [a('pp_op', { side: 'self', mode: 'add', amount: 5 })] }], 4),
  ] },
  { elfIds: ['5034'], name: '妖靈天性', description: tianxing.join('\r\n'), kit: [
    property(tianxing[0], 'sure_hit', true, 0),
    sequence(tianxing[1], [{ acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1, x2If: c3('abnormal', { side: 'opp' }, '對手處於異常狀態') })] }], 1),
    sequence(tianxing[2], [{ acts: [
      a('timed', { turns: 4, from: 'now', trig: 'self_skill', initial: true, body: [
        { live: true, cond: [c3('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於½')], acts: [
          a('drain', { ratio: 2 / 3, true: false }),
        ], elseActs: [
          a('drain', { ratio: 1 / 3, true: false }),
        ] },
      ] }),
    ] }], 2),
    sequence(tianxing[3], [{ acts: [a('prio_turns', { turns: 2, v: 2 })] }], 3),
  ] },
  { elfIds: ['5034'], name: '王·墮落絕語', description: duoluo.join('\r\n'), kit: [
    property(duoluo[0], 'base_priority', 1, 0),
    sequence(duoluo[1], [
      { cond: [c3('hp_cmp', { side: 'self', op: '低於' }, '當前HP低於對手')], acts: [a('dmg_mod', { dir: 'out', kind: '攻擊', boost: 1 })] },
    ], 1),
    sequence(duoluo[2], [
      { acts: [a('vampire', { ratio: 1, kind: '攻擊' })] },
      { cond: [c3('abnormal', { side: 'opp' }, '對手處於異常狀態')], acts: [a('dmg_equal', { type: '百分比' })] },
    ], 2),
    sequence(duoluo[3], [
      { acts: [a('cure_status', { side: 'self', cls: '' })] },
      { chain: 'success', acts: [a('effect_turns', { keys: { inherentInvalid: true }, turns: 2, side: 'opp', label: '技能固有效果失效' })] },
    ], 3),
    inv34(duoluo.slice(4).join('\r\n'), [a('team_force_hit', {untilSkill:'王·潰墮妖族',powerAdd:50,perMarkId:'mogos_residual',perMarkAdd:25})], 4),
  ] },
  { elfIds: ['5034'], name: '王·潰墮妖族', description: kuiduo.join('\r\n'), kit: [
    sequence(kuiduo[0], [{ acts: [a('no_resist', {})] }], 0),
    sequence(kuiduo[1], [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('invalid_turns', { kind: '攻擊', turns: 3, next: false })] },
    ], 1),
    sequence(kuiduo[2], [{ acts: [
      a('drain', { ratio: 1 / 3, true: false }),
      a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 0.25, turns: 1 }),
    ] }], 2),
    // 未擊敗→下次受擊減半；擊敗→全屬性+1＋下隊出戰效果＋害怕（on_hit 分支）
    { codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order: 3,
      customText: kuiduo[5] + '\r\n' + kuiduo[6],
      params: { clause: { raw: kuiduo[5] + '\r\n' + kuiduo[6], marker: '🎯', trig: 'after_hit', parsed: true, body: [
        { cond: [c3('nokill', {}, '未擊敗')], acts: [
          a('effect_turns', { keys: { nextAttackHalves: 1 }, turns: 1, side: 'self', label: '下次受擊減半' }),
        ] },
        { cond: [c3('kill', {}, '擊敗')], acts: [
          a('stat', { side: 'self', stats: ['全屬性'], v: 1 }),
          a('next_elf_pending', { shield: 0, immunityTurns: 0 }),
          a('status', { side: 'opp', status: '害怕', chance: 100, turns: 3 }),
        ] },
      ] } },
    },
  ] },
];
