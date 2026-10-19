// 5010 星光·魯斯王 魂印「海」真 Kit（DSH 20261018 最後衝刺·組 5）。
// 舊 handler：elves/starlight-rus/registry.ts handleStarlightRusSoulMark 整份空殼化（規則3.3；保留匯出名，
//   STARLIGHT_RUS_SKILLS 的技能 handler 不動）。SOUL_MARK_MAPPING 5010／1007／星光·魯斯王／魯斯王 與
//   tests/fixtures/elfRegistryBeforeMove.json souls 同步移除。
// 星海之浸＝mark_program 自帶規則的持有者印記（與 5011「星芳之纏」／5006「星火之灼」同構，migratedMarkSoulKits.ts）：
//   holderInvalid:'屬性'（新欄位，寫 marks.effects.blkInvalid；battleEngine 技能無效既有讀取端）＝持有者所使用的屬性技能無效；
//   damaged_attack：額外受到傷害值100%百分比傷害＋恢復對方等量體力與1點所有技能PP；對手為草系→解除＋追加等量真實傷害＋
//   恢復等量體力與全部PP。「若對手為草系」＝魯斯王的對手＝印記持有者（舊 handler target.type==='草'；mark 內 self＝持有者）。has_mark('星海之浸')（5011 麗莎布布技能 Kit 讀取）改走 Mark 實體；
//   舊 handler 的狀態鍵 starSeaSoakTurns／utilitySkillInvalidTurns（含 battle/stateSigns 顯示）不再寫入。
// 致死保護：self_fatal＋level_gate{100}＋once（每場戰鬥限1次；等級非100不消耗次數，同舊 handler）：
//   強制存活→消除對手能力提升與回合類效果→體力／PP全滿→護盾護罩＝自身體力值。
// 必定致命：on_skill_use＋crit_now（與舊 handler BEFORE_SKILL 設 nextTurnCrit 同鍵；每次使用技能前重設）。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});

const raw = "每次登場時：\n> 為對手附加3回合的星海之浸\n自身每次使用攻擊後：\n> 附加3回合的星海之浸\n自身所有技能：\n> 必定打出致命一擊\n每場戰鬥限1次，自身受到致死傷害時：\n> 若自身的等級為100則消除對手能力提升狀態\n> 若自身的等級為100則消除對手回合類效果\n> 若自身的等級為100則恢復全部體力值、PP值\n> 若自身的等級為100則獲得等同於自身體力值的護盾、護罩\n星海之浸：\n> 持有者所使用的屬性技能無效\n> 持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害\n> 並恢復對方在場精靈等量體力與1點所有技能PP值\n> 若對手為草系則星海之浸消失並額外附加傷害值100%的真實傷害\n> 並恢復對方在場精靈等量體力與所有技能全部PP值\n> 持續3回合，重複獲取時重置為3回合";

/** 星海之浸：持有者屬性技能無效；受攻擊傷害後追加等量百分比傷害並回復對方；對手為草系則解除並追加等量真實傷害。 */
const soak = {
  id: 'blk_星海之浸', name: '星海之浸', displayChar: '浸',
  description: '持有者所使用的屬性技能無效；持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害，並恢復對方在場精靈等量體力與1點所有技能PP值；若對手為草系則星海之浸消失並額外附加傷害值100%的真實傷害，並恢復對方在場精靈等量體力與所有技能全部PP值。持續3回合，重複獲取時重置為3回合。',
  side: 'opp', mode: 'set', count: 1, maxCount: 1, scope: 'elf', persistsOffField: false, unit: '層', turns: 3,
  holderInvalid: '屬性',
  rules: [{
    raw: '持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害，並恢復對方在場精靈等量體力與1點所有技能PP值；若對手為草系則星海之浸消失並額外附加傷害值100%的真實傷害，並恢復對方在場精靈等量體力與所有技能全部PP值',
    trig: 'damaged_attack', parsed: true, body: [
      { acts: [a('dmg_of_event', { ratio: 1, type: '百分比', source: 'opp' }), a('heal_opp_equal', {}), a('pp_op', { side: 'opp', mode: 'add', amount: 1 })] },
      { cond: [c('type_is', { side: 'self', type: '草' }, '持有者（魯斯王的對手）為草系')], acts: [a('mark_remove_current', {}),
        a('dmg_of_event', { ratio: 1, type: '真實', source: 'opp' }), a('heal_opp_equal', {}), a('pp_op', { side: 'opp', mode: 'recover' })] },
    ],
  }],
};

export const MIGRATED_GROUP5_SEA_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5010'],
  name: '海',
  description: raw,
  kit: [
    entry('on_entered', 'entrance', '每次登場時為對手附加3回合的星海之浸', [{ acts: [a('mark_program', soak)] }], 0),
    entry('after_action', 'self_after_attack', '自身每次使用攻擊後附加3回合的星海之浸', [{ acts: [a('mark_program', soak)] }], 1),
    entry('on_skill_use', 'self_skill', '自身所有技能必定打出致命一擊', [{ acts: [a('crit_now', {})] }], 2),
    entry('self_fatal', 'fatal', '每場戰鬥限1次，自身受到致死傷害時：若自身的等級為100則消除對手能力提升與回合類效果、恢復全部體力值與PP值、獲得等同於自身體力值的護盾與護罩', [
      { acts: [a('level_gate', { level: 100, onceKey: 'seaFatalRevive', body: [
        { acts: [a('survive', {})] },
        { acts: [a('stat_clear', { side: 'opp', kind: 'up' }), a('clear_turn', { side: 'opp' })] },
        { acts: [a('heal', { side: 'self', ratio: 1 }), a('pp_op', { side: 'self', mode: 'recover' })] },
        // 護盾護罩：致命判定當下引擎隨後以「受擊前吸收值」覆寫護盾／護罩（舊 handler 同樣被覆寫而落空），
        // 故掛一次性 damaged 監看，於引擎寫回之後的受擊事件補上（以最大體力計＝回復全滿後的體力值；致命判定當下引擎狀態的體力尚是 1，故不用「當前體力」）。
        { acts: [a('timed', { turns: 1, from: 'now', trig: 'damaged', once: true, label: '海·死地重生護盾護罩', body: [
          { acts: [a('shield', { ratio: 1 }), a('shield', { ratio: 1, kind: 'barrier' })] },
        ] })] },
      ] })] },
    ], 3),
  ],
};
