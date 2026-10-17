// 5022 無序.六刃 靜刃止水 Kit：必中／每PP先制+1連擊+1（pp_priority＋pp_combo_hits 新通用op）／
// 6回合免疫反彈／解除雙方異常→成功→對手3回合附加失效＋雙方3回合無法被附加異常／666固定傷害。
// 舊 handler 用 wuxuComboPp 專屬快照鍵＋preventStatusInflict；Kit 改用正式選擇槽PP即時查詢＋
// status_inflict_guard_turns（受影響者雙方各掛一次）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n■ 該技能每有1點PP值則先制+1且技能連擊次數+1\n🎯 6回合內自身免疫並反彈所有異常狀態\n🎯 解除雙方所有異常狀態，解除成功則3回合對手所有技能附加效果失效且無法附加敵我雙方任一方異常狀態\n🎯 附加對手666點固定傷害';

export const MIGRATED_WUXU_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5022'], name: '靜刃止水', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 每有1點PP值則先制+1（modify_priority 節點即時查詢）
    { codeId: 'effect_sequence', node: 'modify_priority', source: 'skill', role: 'innate', order: 1,
      customText: '■ 該技能每有1點PP值則先制+1且技能連擊次數+1',
      params: { clause: { raw: '該技能每有1點PP值則先制+1', trig: 'modify_priority', parsed: true, body: [
        { acts: [a('pp_priority', { perPp: 1 })] },
      ] } } },
    // 每有1點PP值則技能連擊次數+1（每次消耗PP前查詢，固有效果）
    { ...sequence('該技能每有1點PP值則技能連擊次數+1', [
      { acts: [a('pp_combo_hits', { perPp: 1 })] },
    ], 2), role: 'innate', node:'before_skill', params:{clause:{raw:'該技能每有1點PP值則技能連擊次數+1',trig:'before_skill',parsed:true,body:[{acts:[a('pp_combo_hits',{perPp:1})]}]}} },
    // 6回合內自身免疫並反彈所有異常狀態
    sequence('6回合內自身免疫並反彈所有異常狀態', [
      { acts: [a('immune_status_turns', { turns: 6, reflect: true, cls: '' })] },
    ], 3),
    // 解除雙方所有異常狀態，成功 → 對手3回合附加效果失效 + 雙方3回合無法被附加異常
    sequence('解除雙方所有異常狀態，解除成功則3回合對手所有技能附加效果失效且無法附加敵我雙方任一方異常狀態', [
      { acts: [a('cure_status', { side: 'both' })] },
      { chain: 'success', acts: [
        a('add_invalid_turns', { kind: 'all', turns: 3 }),
        a('status_inflict_guard_turns', { side: 'self', kind: 'all', turns: 3, next: false }),
        a('status_inflict_guard_turns', { side: 'opp', kind: 'all', turns: 3, next: false }),
      ] },
    ], 4),
    // 附加對手666點固定傷害
    sequence('附加對手666點固定傷害', [
      { acts: [a('dmg', { flat: 666, type: '固定' })] },
    ], 5),
  ] },
];
