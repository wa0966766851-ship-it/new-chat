// arena_12 無為龍者：魂印「無為之境」＋五技能 真 Kit
// （DSH 20261018 第十六批 legacyWrapped 拆解；同精靈整批轉換＝規則3.4）。
// 核心機制：
//   萬相乖離——以 0 PP 使用技能時必定命中、強制執行命中效果，並「依序永久取消下一條尚未取消的觸發條件」
//     且本技能威力 +50（六項全消後不再增威）。以資源印記 wuweiCancelled（層 0..6，下場清除）記錄已取消數，
//     無相諦內六條觸發條件各自帶 cond（已取消數 < N）守衛；威力由 modify_power 讀層數。
//   無為——未使用技能的回合結束時，依技能條件消耗該技能全部 PP 觸發對應效果（各技能 ◇ 句）。
// 舊 handler：staged-arena/wuweiRegistry.ts 已空殼化；wrapped 清單移出。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
// 「已取消數 < N」守衛（萬相乖離依序取消）
const notCancelled = (n: number) => c('mark_count', { side: 'self', id: 'wuweiCancelled', op: '低於', amount: n }, '萬相乖離尚未取消此條（<' + n + '）');

const SOUL_RAW = '戰鬥開始時，自身所有能力值變為全部能力值之和的一半。使用技能不受 PP 限制；技能使用後，不扣除固定 PP，改為互換該技能的目前 PP 與已損失 PP。以非 0 PP 使用技能時，解除自身異常狀態並免疫下一次異常狀態；以 0 PP 使用時必定命中、強制執行命中效果並觸發【萬相乖離】。未使用技能的回合結束時，依技能條件觸發【無為】效果。';

export const MIGRATED_ARENA12_WUWEI_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['arena_12'],
  name: '無為之境',
  description: SOUL_RAW,
  kit: [
    // 戰鬥開始：六維全部變為總和的一半
    entry('battle_start', 'battle_start', '戰鬥開始時，自身所有能力值變為全部能力值之和的一半', [
      { acts: [a('stat_set_sum_half', {})] },
    ], 0),
    // 使用技能不受 PP 限制
    entry('before_skill', 'before_skill', '使用技能不受 PP 限制', [
      { acts: [a('pp_no_cost', {})] },
    ], 1),
    // 技能使用後：互換該技能的目前 PP 與已損失 PP
    entry('after_action', 'self_after_skill', '技能使用後，不扣除固定 PP，改為互換該技能的目前 PP 與已損失 PP', [
      { acts: [a('pp_swap_selected', {})] },
    ], 2),
    // 以非 0 PP 使用技能：解除自身異常＋免疫下一次異常
    entry('before_skill', 'before_skill', '以非 0 PP 使用技能時，解除自身異常狀態並免疫下一次異常狀態', [
      { cond: [c('selected_pp', { side: 'self', op: '高於', amount: 0 }, '以非0PP使用技能')], acts: [
        a('cure_status', { side: 'self', cls: '' }),
        a('immune_status_count', { count: 1, reflect: false }),
      ] },
    ], 3),
    // 以 0 PP 使用技能：必定命中＋強制命中效果＋觸發萬相乖離（累計取消數）
    entry('before_skill', 'before_skill', '以 0 PP 使用時必定命中、強制執行命中效果並觸發【萬相乖離】', [
      { cond: [c('selected_pp', { side: 'self', op: '不高於', amount: 0 }, '以0PP使用技能')], acts: [
        a('sure_hit_force', {}),
        a('resource_mark_add', { id: 'wuweiCancelled', name: '萬相乖離', displayChar: '離', unit: '層', side: 'self', scope: 'elf', persistsOffField: false, amount: 1, maxCount: 6, description: '已取消的觸發條件數（每層使無相諦威力+50）' }),
      ] },
    ], 4),
    // 已使用但未命中／無效仍屬技能使用後；無法出手不會進此正式節點。
    entry('on_invalid', 'self_invalid', '技能使用後，不扣除固定 PP，改為互換該技能的目前 PP 與已損失 PP', [
      { acts: [a('pp_swap_selected', {})] },
    ], 5),
  ],
};

const skillEntry=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({...entry(node,trig,raw,body,order),source:'skill',role:'attached'});

const SKILLS: ReviewedSequenceSkill[] = [
  {
    elfIds: ['arena_12'], name: '千秋虔',
    description: '■ 必中\n🎯 100% 恢復自身所有技能 4 PP\n🎯 解除自身能力下降，成功時令對手【臣服】\n🎯 若對手本回合切換精靈，令其【臣服】；否則令其【束縛】\n🎯 若擊敗臣服的對手，下一隻出場的對手也進入臣服\n◇ 無為：自身未滿體力時，消耗此技能全部 PP，使對手下回合先制 −2',
    kit: [
      prop('必中', 'sure_hit', true, 0),
      seq('🎯 100% 恢復自身所有技能 4 PP', [{ acts: [a('pp_op', { side: 'self', mode: 'add', amount: 4 })] }], 1),
      seq('🎯 解除自身能力下降，成功時令對手【臣服】', [
        { acts: [a('stat_clear', { side: 'self', kind: 'down' })] },
        { chain: 'success', acts: [a('status', { side: 'opp', status: '臣服', chance: 100 })] },
      ], 2),
      seq('🎯 若對手本回合切換精靈，令其【臣服】；否則令其【束縛】', [
        { cond: [c('opp_switched', {}, '對手本回合切換精靈')], acts: [a('status', { side: 'opp', status: '臣服', chance: 100 })] },
        { cond: [c('opp_switched', { neg: true }, '對手未切換')], acts: [a('status', { side: 'opp', status: '束縛', chance: 100 })] },
      ], 3),
      // 「若擊敗臣服的對手，下一隻出場的對手也進入臣服」須在擊敗後節點設定（引擎規則）——見檔尾 on_kill 條目。
      skillEntry('on_kill', 'kill', '🎯 若擊敗臣服的對手，下一隻出場的對手也進入臣服', [
        { cond: [c('has_status', { side: 'opp', status: '臣服' }, '被擊敗者處於臣服')], acts: [a('next_entry_status', { status: '臣服', turns: 3 })] },
      ], 4),
      seq('◇ 無為：自身未滿體力時，消耗此技能全部 PP，使對手下回合先制 −2', [
        { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 1 }, '自身未滿體力'), c('unacted', {}, '未使用技能')], acts: [
          a('pp_op', { side: 'self', mode: 'zero', kind: '屬性' }),
          a('prio_turns', { side: 'opp', v: -2, turns: 1, next: true }),
        ] },
      ], 5),
    ],
  },
  {
    elfIds: ['arena_12'], name: '百法拜',
    description: '■ 必中\n🎯 全屬性 +1；自身滿體力時強化效果翻倍\n🎯 4 回合內，每次使用技能吸取對手最大體力的 1/3；自身低於一半體力時吸取翻倍\n> 若對手免疫百分比傷害，額外附加 300 點真實傷害\n🎯 下 2 回合自身所有技能先制 +2\n◇ 無為：對手具有能力提升時，消耗此技能全部 PP，消除對手回合類效果',
    kit: [
      prop('必中', 'sure_hit', true, 0),
      seq('🎯 全屬性 +1；自身滿體力時強化效果翻倍', [
        { cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 1 }, '自身滿體力')], acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 2 })] },
        { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 1 }, '自身非滿體力')], acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
      ], 1),
      seq('🎯 4回合內每次使用技能吸取對手最大體力1/3，低於半血翻倍；對手免疫百分比時追加300真傷', [
        {acts:[a('timed',{turns:4,from:'now',trig:'self_skill',initial:true,label:'百法拜吸取',body:[
          {cond:[c('hp_ratio',{side:'self',op:'低於',ratio:0.5})],acts:[a('drain',{ratio:2/3})]},
          {cond:[c('hp_ratio',{side:'self',op:'不低於',ratio:0.5})],acts:[a('drain',{ratio:1/3})]},
          {cond:[c('last_damage_immune',{})],acts:[a('dmg',{flat:300,type:'真實'})]},
        ]})]},
      ], 2),
      seq('🎯 下 2 回合自身所有技能先制 +2', [
        { acts: [a('prio_turns', { v: 2, turns: 2, next: true })] },
      ], 4),
      seq('◇ 無為：對手具有能力提升時，消耗此技能全部 PP，消除對手回合類效果', [
        { cond: [c('stage', { side: 'opp', kind: 'up' }, '對手具有能力提升'), c('unacted', {}, '未使用技能')], acts: [
          a('pp_op', { side: 'self', mode: 'zero', kind: '屬性' }),
          a('clear_turn', { side: 'opp' }),
        ] },
      ], 5),
    ],
  },
  {
    elfIds: ['arena_12'], name: '十玄釋',
    description: '■ 必中\n🎯 5 回合內免疫所有異常狀態及能力下降\n🎯 4 回合內，對手使用屬性技能後，自身恢復最大體力的 1/3 並造成等量百分比傷害；對手使用攻擊技能後，100% 使其【束縛】\n◇ 無為：未行動時，消耗此技能全部 PP，使對手所有技能 PP −2',
    kit: [
      prop('必中', 'sure_hit', true, 0),
      seq('🎯 5 回合內免疫所有異常狀態及能力下降', [
        { acts: [
          a('immune_status_turns', { turns: 5, cls: '', reflect: false }),
          a('stat_drop_immune_turns', { turns: 5 }),
        ] },
      ], 1),
      seq('🎯 4 回合內，對手使用屬性技能後，自身恢復最大體力的 1/3 並造成等量百分比傷害；對手使用攻擊技能後，100% 使其【束縛】', [
        {acts:[
          a('timed',{turns:4,from:'now',trig:'opp_after_status',label:'十玄釋屬性回應',body:[{acts:[
            a('heal',{side:'self',ratio:1/3}),
            a('dmg',{base:'最大體力',of:'self',ratio:1/3,type:'百分比'}),
          ]}]}),
          a('timed',{turns:4,from:'now',trig:'opp_after_attack',label:'十玄釋攻擊回應',body:[{acts:[a('status',{side:'opp',status:'束縛',chance:100,turns:3})]}]}),
        ]},
      ], 2),
      seq('◇ 無為：未行動時，消耗此技能全部 PP，使對手所有技能 PP −2', [
        { cond: [c('unacted', {}, '未使用技能')], acts: [
          a('pp_op', { side: 'self', mode: 'zero', kind: '屬性' }),
          a('pp_op', { side: 'opp', mode: 'reduce', amount: 2 }),
        ] },
      ], 3),
    ],
  },
  {
    elfIds: ['arena_12'], name: '孑身誡',
    description: '■ 先制 +3\n🎯 消除對手回合類效果\n> 若無法消除，令對手所有技能 PP 歸零\n🎯 吸取對手能力提升\n> 成功時令對手所有技能 PP 歸零\n🎯 對手所有技能 PP −1；若其本回合所選技能 PP 變為 0，則無法行動\n◇ 無為：自身處於異常狀態時，消耗此技能全部 PP，使對手下一回合無法主動切換精靈',
    kit: [
      prop('先制 +3', 'base_priority', 3, 0),
      seq('🎯 消除對手回合類效果\n> 若無法消除，令對手所有技能 PP 歸零', [
        { acts: [a('clear_turn', { side: 'opp' })] },
        { chain: 'fail', acts: [a('pp_op', { side: 'opp', mode: 'zero' })] },
      ], 1),
      seq('🎯 吸取對手能力提升\n> 成功時令對手所有技能 PP 歸零', [
        { acts: [a('stat_steal', { mode: '吸取' })] },
        { chain: 'success', acts: [a('pp_op', { side: 'opp', mode: 'zero' })] },
      ], 2),
      seq('🎯 對手所有技能 PP −1；若其本回合所選技能 PP 變為 0，則無法行動', [
        { acts: [a('pp_op', { side: 'opp', mode: 'reduce', amount: 1, stopIfEmpty: true })] },
        { cond: [c('selected_pp', { side: 'opp', op: '不高於', amount: 0 }, '對手所選技能PP為0')], acts: [a('action_prevent_on_empty', {})] },
      ], 3),
      seq('◇ 無為：自身處於異常狀態時，消耗此技能全部 PP，使對手下一回合無法主動切換精靈', [
        { cond: [c('abnormal', { side: 'self' }, '自身處於異常狀態'), c('unacted', {}, '未使用技能')], acts: [
          a('pp_op', { side: 'self', mode: 'zero', kind: '屬性' }),
          a('no_switch', { turns: 1, next: true }),
        ] },
      ], 4),
    ],
  },
  {
    elfIds: ['arena_12'], name: '無相諦',
    description: '■ 必中\n■ 威力 0、PP 0\n■ 自身與技能同屬性時威力 +170\n🎯 先出手時令對手所有技能 PP −1，後出手時消除對手回合類效果\n🎯 對手無異常時吸取其最大體力 1/3，有異常時令其【臣服】\n🎯 對手體力不足 300 時直接秒殺\n> 萬相乖離會依此順序永久取消下一條尚未取消的觸發條件，並使本技能威力 +50；六項條件全部取消後不再增加威力；自身擊敗對手後，令對方全部陣亡精靈消逝',
    kit: [
      prop('必中', 'sure_hit', true, 0),
      prop('自身與技能同屬性時威力 +170', 'base_power', 170, 1),
      // ① 先出手→對手PP-1；後出手→消除回合類（守衛：已取消數<1）
      seq('🎯 先出手時令對手所有技能 PP −1，後出手時消除對手回合類效果', [
        { cond: [notCancelled(1), c('first_move', {}, '先出手')], acts: [a('pp_op', { side: 'opp', mode: 'reduce', amount: 1 })] },
        { cond: [notCancelled(1), c('first_move', { neg: true }, '後出手')], acts: [a('clear_turn', { side: 'opp' })] },
      ], 2),
      // ② 對手無異常→吸取1/3；有異常→臣服（守衛：<2）
      seq('🎯 對手無異常時吸取其最大體力 1/3，有異常時令其【臣服】', [
        { cond: [notCancelled(2), c('abnormal', { side: 'opp', neg: true }, '對手無異常')], acts: [a('drain', { ratio: 1 / 3 })] },
        { cond: [notCancelled(2), c('abnormal', { side: 'opp' }, '對手有異常')], acts: [a('status', { side: 'opp', status: '臣服', chance: 100 })] },
      ], 3),
      // ③ 對手體力不足300→秒殺（守衛：<3）
      seq('🎯 對手體力不足 300 時直接秒殺', [
        { cond: [notCancelled(3), c('hp_value', { side: 'opp', op: '低於', amount: 300 }, '對手體力不足300點')], acts: [a('instant_kill', { chance: 100 })] },
      ], 4),
      // 萬相乖離：威力 +50×層數（六層後不再增）
      skillEntry('modify_power', 'outgoing_power', '> 萬相乖離使本技能威力 +50（每層，讀已取消層數），六項全部取消後不再增加威力', [
        { acts: [a('power_mod', { flat: 50, perMark: { side: 'self', id: 'wuweiCancelled' } })] },
      ], 5),
      // 「自身擊敗對手後，令對方全部陣亡精靈消逝」在正式擊敗後節點選取全部陣亡隊員逐一消逝。
      skillEntry('on_kill', 'kill', '> 自身擊敗對手後，令對方全部陣亡精靈消逝', [
        { acts: [a('select_elf', { all:true, side: 'opp', scope: 'team', state: 'dead', orderBy: 'team_order', direction: 'asc', body: [{ acts: [a('vanish_selected', {})] }] })] },
      ], 6),
    ],
  },
];

export const MIGRATED_ARENA12_SKILL_KITS = SKILLS;
