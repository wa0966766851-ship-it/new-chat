// 九鼎震八荒（帝辛 5017 第五技能）積木遷移：原文逐句對齊 elfSourceText.json:752-754。
// 載體與受影響者分離：效果描述「影響誰」，runtime 決定「掛哪裡、誰扣」（invalid_turns 自動掛 targetSide）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const raw = [
  '■ 必中',
  '■ 此技能使用成功後效果每場戰鬥只能生效一次，此後該技能失去必中效果且命中率歸0，但選擇該技能時令對方當回合先制-4',
  '🎯 使用後附加自身9層八荒，且9回合內自身八荒層數不再減少',
  '🎯 攜帶此技能且使用成功後效果存在時若擊敗對手，會立刻關閉誅魔天陣並觸發關閉懲罰效果',
  '🎯 技能無效時，消除對方回合類效果，100%令對方神遊',
];

/** 「擊敗對手時」關閉天陣：on_kill 觸發、close_formation 通用 op（體力1、PP0、鎖切換1回合）。 */
const at = (node: KitEntry['node'], trig: string, r: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'carried', order, customText: r,
  params: { clause: { raw: r, marker: '🎯', trig, parsed: true, body } },
});

/** 「技能無效時」補償：on_invalid 視同未命中（引擎 3.4 失敗分支統一觸發）。 */
const atInvalid = (r: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order, customText: r,
  params: { clause: { raw: r, marker: '🎯', trig: 'on_invalid', parsed: true, body } },
});

export const MIGRATED_DIXIN_SKILL_KITS: ReviewedSequenceSkill[] = [
  {
    elfIds: ['5017'],
    name: '九鼎震八荒',
    description: raw.join('\n'),
    kit: [
      // ■ 必中（每場一次的輝煌效果尚未用掉時）
      property(raw[0], 'sure_hit', true, 0),
      // ■ 命中後技能效果階段記錄成功；無效／未命中不消耗資格，其後失必中／命中0／選招時對方先制-4。
      {
        codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'innate', order: 1, customText: raw[1],
        params: {
          clause: {
            raw: raw[1], marker: '■', trig: 'self_skill', parsed: true,
            body: [{ acts: [a('once_used_degrade', { key: 'dixin-jiuding-once', v: 4 })] }],
          },
        },
      },
      // 🎯 使用後 9 層八荒 ＋ 9 回合層數不減
      sequence(raw[2], [
        { acts: [
          a('resource_mark_add', { side: 'self', id: 'bahuang_mark', name: '八荒', displayChar: '荒', unit: '層', scope: 'elf', persistsOffField: true, description: '最高9層，各層效果依魂印描述結算。', amount: 9, maxCount: 9 }),
          a('mark_lock_turns', { id: 'bahuang_mark', turns: 9 }),
        ] },
      ], 2),
      // 🎯 擊敗對手時關閉誅魔天陣＋懲罰（體力1、PP0、鎖切換）。
      // 攜帶監控其他技能擊敗；必須仍持有成功使用後的九回合印記鎖，天陣本身亦須有效。
      at('on_kill', 'kill', raw[3], [
        { cond:[{c:'mark_locked',p:{side:'self',id:'bahuang_mark'},label:'九鼎成功後的八荒遞減鎖仍存在'}],acts: [a('close_formation', { formationId: 'dixin_formation', lockTurns: 1 })] },
      ], 3),
      // 🎯 技能無效時：消除對方回合類效果＋100% 神遊（invalid_next/invalid_turns 絕不寫自身）
      atInvalid(raw[4], [
        { acts: [
          a('clear_turn', { side: 'opp' }),
          a('status', { side: 'opp', status: '神游', chance: 100, turns: 3 }),
        ] },
      ], 4),
    ],
  },
];
