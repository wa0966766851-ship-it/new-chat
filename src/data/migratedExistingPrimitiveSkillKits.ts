import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action, property, sequence } from './reviewedSequenceSkillKits';

/**
 * 用「既有通用原子」完成的整份技能遷移：這些句子的 op 早已在 runtime 實作、引擎也有讀取端，
 * 過去只是漏了合約欄位而無法由原文轉換。原文完整相同才套入；每份都有雙側正式引擎測試。
 */
export const MIGRATED_EXISTING_PRIMITIVE_SKILL_KITS: ReviewedSequenceSkill[] = [
  // 5011 星光·麗莎布布：消回合成功才把下回合受傷轉為體力；PP 一降一補；星海之浸與低血各自獨立的增傷；固定傷害遞增且有上限。
  { elfIds: ['5011'], name: '星光·金光綠葉',
    description: '■ 必中\n🎯 消除對手回合類效果，消除成功則下回合受到的傷害轉化為自身體力\n🎯 降低對手所有PP一點\n🎯 恢復自身所有PP一點\n🎯 對手處於星海之浸時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍\n🎯 附加200點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍',
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      sequence('🎯 消除對手回合類效果，消除成功則下回合受到的傷害轉化為自身體力', [
        { acts: [action('clear_turn', { side: 'opp' })] },
        { chain: 'success', acts: [action('dmg_to_heal_turns', { next: true })] },
      ], 1),
      sequence('🎯 降低對手所有PP一點', [{ acts: [action('pp_op', { side: 'opp', mode: 'reduce', amount: 1 })] }], 2),
      sequence('🎯 恢復自身所有PP一點', [{ acts: [action('pp_op', { side: 'self', mode: 'add', amount: 1 })] }], 3),
      sequence('🎯 對手處於星海之浸時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍', [
        { cond: [{ c: 'has_mark', p: { side: 'opp', name: '星海之浸' }, label: '對手處於星海之浸' }],
          acts: [action('boost', { mult: 1.75, kind: '攻擊', power: false, x2If: { c: 'hp_cmp', p: { side: 'self', op: '低於' }, label: '自身體力低於對手' } })] },
      ], 4),
      sequence('🎯 附加200點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍', [
        { acts: [action('dmg', { flat: 200, type: '固定', both: false, rampInc: 100, rampStreak: false, rampCap: 400, x2If: { c: 'enemy', p: {}, label: '遇到天敵' } })] },
      ], 5),
    ] },
  // 5024 湮滅之主・咤克斯：候選池取自正式 StatusRegistry；「非附屬類」＝排除附屬類與 BOSS 專用／無效果類。
  { elfIds: ['5024'], name: '毀傷湧進',
    description: '必中；使對手隨機進入兩種非附屬類異常狀態',
    kit: [
      property('■ 必中', 'sure_hit', true, 0),
      sequence('必中；使對手隨機進入兩種非附屬類異常狀態', [
        { acts: [action('status_random', { count: 2, cls: '非附屬類' })] },
      ], 1),
    ] },
];
