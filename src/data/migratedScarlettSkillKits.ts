// 5014 聖光斯嘉麗 王·凰歌盡霄 Kit：必中、能力下降時固有先制+3、交換成功→無效下次攻擊、本次及下次攻擊增傷150%。
// 威力1.75倍＋雙方每有1個技能PP<1再+30%、吸取等同攻擊傷害100%體力。
// 通用 op：stat_swap（5034 摧妖斬同款）、invalid_next、dmg_mod_uses、boost{power,perInc}（新計數 sides_pp_below_one）、vampire。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n■ 自身處於能力下降時當回合先制+3\n🎯 與對手交換自身低於對手的能力等級，交換成功則令自身無效下次對手的攻擊技能且當回合與下次造成攻擊傷害提升150%\n🎯 技能威力提升75%，敵我雙方每有1個技能當前PP值低於1時提升30%\n🎯 吸取對手等同於當回合自身造成攻擊傷害100%的體力';

export const MIGRATED_SCARLETT_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5014'], name: '王·凰歌盡霄', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'innate', order: 1,
      customText: '■ 自身處於能力下降時當回合先制+3',
      params: { property: 'base_priority', value: 3, conditions: [{ c: 'stage', p: { side: 'self', kind: 'down' }, label: '自身處於能力下降' }] } },
    sequence('與對手交換自身低於對手的能力等級，交換成功則令自身無效下次對手的攻擊技能且當回合與下次造成攻擊傷害提升150%', [
      { acts: [a('stat_swap', {})] },
      { chain: 'success', acts: [
        a('invalid_next', { kind: '攻擊', uses: 1 }),
        a('boost', { mult: 2.5, kind: '攻擊' }),
        a('dmg_mod_uses', { uses: 1, boost: 1.5, kind: '攻擊', attackOnly: true }),
      ] },
    ], 2),
    sequence('技能威力提升75%，敵我雙方每有1個技能當前PP值低於1時提升30%', [
      { acts: [a('boost', { power: true, mult: 1.75, per: 'sides_pp_below_one', perInc: 0.3 })] },
    ], 3),
    sequence('吸取對手等同於當回合自身造成攻擊傷害100%的體力', [
      { acts: [a('vampire', { ratio: 1, kind: '攻擊' })] },
    ], 4),
  ] },
];
