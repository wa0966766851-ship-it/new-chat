// 5036 九青 魂印「汨」：積木化實裝。
// 固定原文快照與可編輯積木分開管理。
// 旭／清的召喚、死亡連動、雙攻合併走 src/blocks/ops/ownerLinks.ts 的通用積木。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { JIUQING_SOUL_TEXT } from './jiuqingDefinition';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

const SOUL_DESC = JIUQING_SOUL_TEXT;
const panelBody = [{cond:[c('summoned_extra_alive',{name:'旭'})],acts:[a('combine_panel_stats',{stats:['atk','spatk'],mode:'sum',key:'attackPair'})],elseActs:[a('combine_panel_stats',{stats:['atk','spatk'],mode:'max',key:'attackPair'})]}];

/** 魂印節點：指定觸發器 + 子句。 */
const soul = (raw: string, trig: string, body: any[], order: number, node: any = 'battle_start'): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'soulmark', role: 'innate', order, customText: raw,
  params: { clause: { raw, marker: '>', trig, parsed: true, body } },
});

export const MIGRATED_JIUQING_SOUL_KIT: ReviewedSequenceSkill & { kind: 'soul' } = {
  kind: 'soul',
  elfIds: ['5036'], name: '汨',
  description: SOUL_DESC,
  kit: [
    // 開場：旭（雄性・超能・全能力 520）與清（雌性・次元・全能力 8000）作為額外精靈加入己方
    soul('> **開場召喚**：於戰鬥開始時令旭與清作為額外精靈加入己方', 'battle_start', [
      { acts: [
        a('summon_fixed_extra', { name: '旭', type: '超能', value: 520, gender: '雄性',
          description: '九青魂印「汨」的額外精靈。雄性；超能系；攻擊、防禦、特攻、特防、速度、體力各為 520；僅九青陣亡時，受到 8000 點真實傷害並陣亡。' }),
        a('summon_fixed_extra', { name: '清', type: '次元', value: 8000, gender: '雌性',
          description: '九青魂印「汨」的額外精靈。雌性；次元系；攻擊、防禦、特攻、特防、速度、體力各為 8000；僅九青陣亡時，自身轉變為雄性並陣亡。' }),
      ] },
    ], 1, 'battle_start'),

    // 雙攻合一：在場期間攻擊、特攻取較高者
    soul('> 在場雙攻取較高值；旭存活時改為面板原值之和', 'entrance', panelBody, 2, 'on_entered'),

    // 旭存活期間：改為攻擊、特攻各等於面板原值之和
    soul('> 回合開始重新查詢額外精靈存活與雙攻', 'round_start', panelBody, 3, 'round_start'),
    soul('> 自身行動前重新查詢雙攻', 'before_action', panelBody, 12, 'before_action'),
    soul('> 對手行動前重新查詢雙攻', 'opp_skill', panelBody, 13, 'on_attacked'),
    soul('> 下場還原雙攻面板', 'switch_out', [{acts:[a('combine_panel_stats',{stats:['atk','spatk'],mode:'restore',key:'attackPair'})]}], 14, 'on_switch_out'),
    {...soul('> 隊友確認陣亡後在場持有者重算雙攻', 'team_defeated', panelBody, 15, 'cthyaat_death'),params:{clause:{raw:'隊友確認陣亡後在場持有者重算雙攻',marker:'>',trig:'team_defeated',parsed:true,body:panelBody,cond:[c('holder_active',{})],observer:{includeDead:false}}}},

    // 自身使用攻擊技能時消除對手回合類效果
    soul('> **攻勢壓制**：自身使用攻擊技能時消除對手回合類效果', 'self_attack', [
      { acts: [a('clear_turn', { side: 'opp' })] },
    ], 4, 'on_skill_use'),

    // 對手使用攻擊技能時吸取對手最大體力的 1/3
    soul('> 對手使用攻擊技能時吸取對手最大體力的1/3；清存活時並消除對手回合類效果', 'opp_used_attack', [
      {cond:[c('summoned_extra_alive',{name:'清'})],acts:[a('clear_turn',{side:'opp'})]},
      { acts: [a('drain', { ratio: 1/3 })] },
    ], 5, 'on_opponent_skill_use'),

    // 清存活期間：改為雙方使用攻擊技能時消除回合類效果並吸取 1/3
    soul('> 清存活期間，改為雙方使用攻擊技能時消除對手回合類效果並吸取對手最大體力的1/3', 'self_attack', [
      { cond: [c('summoned_extra_alive', { name: '清' })], acts: [
        a('drain', { ratio: 1/3 }),
      ] },
    ], 6, 'on_skill_use'),

    // 回合結束：對手先出手 → 免疫異常
    soul('> **回合結算**：回合結束時若當回合對手先出手則直至下回合結束後自身免疫異常狀態', 'round_end', [
      { cond: [c('round_first_user', { side: 'opp', key: 'roundSkillUseOrder' })], acts: [
        a('immune_status_turns', { turns: 2 }),
      ] },
    ], 7, 'round_end'),

    // 回合結束：自身先出手 → 免疫能力下降
    soul('> 若當回合自身先出手則直至下回合結束後自身免疫能力下降狀態', 'round_end', [
      { cond: [c('round_first_user', { side: 'self', key: 'roundSkillUseOrder' })], acts: [
        a('immune_statdown_turns', { turns: 2 }),
      ] },
    ], 8, 'round_end'),

    // 回合結束：雙方均未出手 → 雙攻、速度 +1
    soul('> 若當回合雙方均未出手則令自身雙攻、速度+1', 'round_end', [
      { cond: [c('round_first_user', { side: 'none', key: 'roundSkillUseOrder' })], acts: [
        a('stat', { side: 'self', stats: ['雙攻', '速度'], v: 1 }),
      ] },
    ], 9, 'round_end'),

    // 九青陣亡 → 旭受到 8000 真實傷害並陣亡
    soul('> 旭：僅九青陣亡時，受到 8000 點真實傷害並陣亡', 'defeated', [
      { acts: [a('retire_summoned_extra', { name: '旭', trueDamage: 8000 })] },
    ], 10, 'cthyaat_death'),

    // 九青陣亡 → 清轉為雄性並陣亡
    soul('> 清：僅九青陣亡時，自身轉變為雄性並陣亡', 'defeated', [
      { acts: [a('retire_summoned_extra', { name: '清', gender: '雄性' })] },
    ], 11, 'cthyaat_death'),
  ],
};
