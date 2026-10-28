// 5036 九青：技能 Kit（積木化實裝）。
// 以固定原文快照對齊積木；修改來源文案不能自動視為已審核。
// 魂印「汨」的額外精靈召喚／死亡連動／雙攻合併走 src/blocks/ops/ownerLinks.ts 的通用積木。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { JIUQING_SKILL_TEXT } from './jiuqingDefinition';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

/** 固有效果（沿用 migratedFeedbackSkillKits 既有寫法）：技能本身的前置判定，不因「附加效果失效」而失效。 */
const innate = (raw: string, op: string, p: any, order: number): KitEntry => ({
  ...sequence(raw, [{ acts: [a(op, p)] }], order), role: 'innate',
  params:{clause:{raw,marker:'■',trig:'use',parsed:true,body:[{acts:[a(op,p)]}]}},
});
/** 攻擊傷害的獨立乘區，在正式傷害結算前執行。 */
const outgoingDamage = (raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'before_damage' as const, source: 'skill' as const, role: 'attached' as const, order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'outgoing_attack', parsed: true, body } },
});
/** 結果類條件（dmg_cmp／kill／nokill／crit）只能在傷害結算後判斷。 */
const afterHit = (raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_hit' as const, source: 'skill' as const, role: 'attached' as const, order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } },
});

/** 技能原文一律取自資料檔，避免手抄造成 description 不一致而套不上 Kit。 */
const text = (skillName: string): string => {
  if (!JIUQING_SKILL_TEXT[skillName]) throw new Error('九青缺少技能原文：' + skillName);
  return JIUQING_SKILL_TEXT[skillName];
};

const FIFTH = '清璨星辰落';
const SPEED = '生塵眷盼';
const DEFEND = '如日方升';
const BUFF = '遂心快意';
const KILL = '蒼靈銜樂';
const ANHUN = '安魂曲';
const ZHUSHEN = '誅神巨闕';
const YONGSHI = '永世相約';
const SHENGJUN = '聖鈞無雙隕';

export const MIGRATED_JIUQING_KITS: ReviewedSequenceSkill[] = [
  {
    elfIds: ['5036'], name: FIFTH,
    description: text(FIFTH),
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      // 攻擊傷害高於 300 → 石化
      // 結果類條件（dmg_cmp／nokill／kill）必須在傷害結算後判斷，用 after_hit 節點。
      afterHit('🎯 造成的攻擊傷害高於300則100%令對手石化', [
        { cond: [c('dmg_cmp', { op: '高於', v: 300 })], acts: [a('status', { side: 'opp', status: '石化', turns: 2 })] },
      ], 1),
      // 未擊敗 → 己方下 1 次攻擊必定致命一擊
      {codeId:'effect_sequence',node:'on_not_killed',source:'skill',role:'attached',order:2,customText:'🎯 未擊敗對手，則己方下1次攻擊技能必定致命一擊',params:{clause:{raw:'未擊敗對手，則己方下1次攻擊技能必定致命一擊',marker:'🎯',trig:'not_killed',parsed:true,body:[{acts:[a('crit_uses',{uses:1,scope:'team'})]}]}}},
      // 擊敗 → 對手下 1 次屬性技能無效
      {codeId:'effect_sequence',node:'on_kill',source:'skill',role:'attached',order:3,customText:'🎯 擊敗對手，則令對手下1次屬性技能無效',params:{clause:{raw:'擊敗對手，則令對手下1次屬性技能無效',marker:'🎯',trig:'kill',parsed:true,body:[{acts:[a('invalid_next',{kind:'屬性',uses:1,scope:'team'})]}]}}},
      // 附加 (最大體力 + 速度) × 25%，每次使用 +10%，上限 45%
      sequence('🎯 附加自身最大體力與速度之和25%的百分比傷害，每次使用增加10%，最高45%', [
        { acts: [a('dmg', { base: '最大體力和速度', of: 'self', ratio: 0.25, type: '百分比', rampInc: 10, rampCap: 45 })] },
      ], 4),
    ],
  },
  {
    elfIds: ['5036'], name: SPEED,
    description: text(SPEED),
    kit: [
      property('■ 先制+3', 'base_priority', 3, 0),
      sequence('🎯 消除對手能力提升。消除成功，則2回合內對手造成的攻擊傷害不超過250', [
        { cond: [c('stage', { side: 'opp', kind: 'up', neg: false })], acts: [
          a('stat_clear', { side: 'opp', kind: 'up' }),
        ] },
        {chain:'success',acts:[a('damage_cap_turns', { side: 'opp', dir: 'out', kind: '攻擊', cap: 250, turns: 2 })]},
      ], 1),
      sequence('🎯 對手本來就沒有能力提升，則改為2回合內對手所有體力恢復減少100%', [
        { cond: [c('stage', { side: 'opp', kind: 'up', neg: true })], acts: [
          a('recovery_reduce_turns', { side:'opp',ratio: 1, turns: 2,includePotions:true }),
        ] },
      ], 2),
      outgoingDamage('🎯 自身處於能力提升時，本次攻擊傷害額外提升50%', [
        { cond: [c('stage', { side: 'self', kind: 'up', neg: false })], acts: [a('damage_scale', { kind:'攻擊', mult:1.5 })] },
      ], 3),
    ],
  },
  {
    elfIds: ['5036'], name: DEFEND,
    description: text(DEFEND),
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      sequence('🎯 4回合內免疫並反彈受到的異常狀態', [
        { acts: [a('immune_status_turns', { turns: 4, reflect: true })] },
      ], 1),
      // 對手使用屬性技能 → 疲憊（監控對手技能使用）
      sequence('🎯 3回合內，對手使用屬性技能則命中前100%令其疲憊', [
        { acts: [a('timed', { turns: 3, from: 'now', trig: 'opp_before_status', body: [
          { acts: [a('status', { side: 'opp', status: '疲憊', turns: 2 })] },
          {chain:'fail',acts:[a('heal',{side:'self',ratio:1/3}),a('dmg',{base:'最大體力',of:'self',ratio:1/3,type:'百分比'})]},
        ] })] },
      ], 2),
      sequence('🎯 令對手下1次威力高於100的攻擊技能無效', [
        { acts: [a('invalid_next', { kind: '攻擊', uses: 1, powerAbove: 100 })] },
      ], 3),
      sequence('🎯 下2回合自身所有技能先制+2', [
        { acts: [a('prio_turns', { v: 2, turns: 2, next: true })] },
      ], 4),
    ],
  },
  {
    elfIds: ['5036'], name: BUFF,
    description: text(BUFF),
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      sequence('🎯 反轉自身能力下降。全屬性+1', [
        { acts: [a('stat_reverse', { side: 'self', kind: 'down' }), a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
      ], 1),
      sequence('🎯 對手不處於能力提升時，這次強化翻倍', [
        { cond: [c('stage', { side: 'opp', kind: 'up', neg: true })], acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
      ], 2),
      sequence('🎯 4回合內，每回合使用技能吸取對手最大體力的1/3', [
        { acts: [a('timed', { turns: 4, from: 'now', trig: 'self_after_use', body: [
          { acts: [a('drain', { ratio: 1/3 })] },
        ] })] },
      ], 2),
      sequence('🎯 下2回合造成的攻擊傷害額外提升100%', [
        { acts: [a('damage_multiplier_turns', { side: 'self', dir: 'out', kind: '攻擊', mult: 2, turns: 2, next:true })] },
      ], 3),
    ],
  },
  {
    elfIds: ['5036'], name: KILL,
    description: text(KILL),
    kit: [
      innate('■ 無視對手免疫受到的攻擊效果', 'ignore', { what: '攻擊免疫' }, 1),
      innate('■ 無視對手護盾附加效果', 'ignore', { what: '護盾' }, 2),
      sequence('🎯 附加自身最大體力30%的百分比傷害並恢復等量體力；自身體力低於1/3時，恢復和百分比傷害都翻倍', [
        { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 1/3 })], acts: [
          a('dmg', { base: '最大體力', of: 'self', ratio: 0.6, type: '百分比' }),
          a('heal', { side: 'self', ratio: 0.6 }),
        ] },
        { cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 1/3 })], acts: [
          a('dmg', { base: '最大體力', of: 'self', ratio: 0.3, type: '百分比' }),
          a('heal', { side: 'self', ratio: 0.3 }),
        ] },
      ], 2),
    ],
  },
  {
    elfIds: ['5036'], name: ANHUN,
    description: text(ANHUN),
    kit: [sequence('🎯 命中後100%令對手睡眠', [{ acts: [a('status', { side: 'opp', status: '睡眠', turns: 3 })] }], 1)],
  },
  {
    elfIds: ['5036'], name: ZHUSHEN,
    description: text(ZHUSHEN),
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      sequence('🎯 2回合內，每回合附加150點固定傷害', [
        { acts: [a('timed', { turns: 2, from: 'now', trig: 'round_end', body: [{ acts: [a('dmg', { flat: 150, type: '固定' })] }] })] },
      ], 1),
    ],
  },
  {
    elfIds: ['5036'], name: YONGSHI,
    description: text(YONGSHI),
    kit: [
      {codeId:'skill_property',node:'before_skill',source:'skill',role:'innate',order:0,customText:'■ 1回合攻擊7到25次',params:{property:'attack_hits',value:{min:7,max:25},conditions:[]}},
      {codeId:'effect_sequence',node:'after_attack_hit',source:'skill',role:'attached',order:1,customText:'🎯 每次攻擊5%附加20點固定傷害',params:{clause:{raw:'每次攻擊5%附加20點固定傷害',marker:'🎯',trig:'attack_hit',parsed:true,body:[{cond:[c('chance',{pct:5})],acts:[a('dmg',{flat:20,type:'固定'})]}]}}},
    ],
  },
  {
    elfIds: ['5036'], name: SHENGJUN,
    description: text(SHENGJUN),
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      sequence('🎯 2回合內每回合100%閃避對手攻擊，並令對手隨機進入2種弱化類異常', [
        { acts: [
          a('evade_turns', { chance: 100, turns: 2, kind: '攻擊' }),
          a('timed',{turns:2,from:'now',trig:'round_end',body:[{acts:[a('status_random',{count:2,cls:'弱化類'})]}]}),
        ] },
      ], 1),
    ],
  },
];
