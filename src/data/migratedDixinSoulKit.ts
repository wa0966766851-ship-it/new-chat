// 荒魂印（帝辛 5017）積木遷移中，尚非完整驗收。
// 待補：主動切換時點／上回合查詢、5層機率／期限翻倍歧義及完整魂印整合驗收。
// 天陣使用可編輯關閉body及通用formationWindow，不借舊專屬生命週期。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const entry = (node: Node, trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});
const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });
const bahuang = { id: 'bahuang_mark', name: '八荒', displayChar: '荒', unit: '層', scope: 'elf', side: 'self', persistsOffField: true,
  description: '最高9層，各層解鎖效果依魂印描述結算。', maxCount: 9 };
const addB = (amount: number) => a('resource_mark_add', { ...bahuang, amount });
const layers = (n: number) => c('mark_count', { side: 'self', id: 'bahuang_mark', op: '不低於', amount: n }, `八荒至少${n}層`);
// 解鎖門檻仍讀原始層數；只把已解鎖的「每層」數量翻倍，不寫回資源、不提早解鎖。
const perLayerScale = [
  { when: [{ side: 'self', id: 'fumo_mark', min: 1 }], factor: 2 },
  { when: [{ side: 'self', id: 'bahuang_mark', min: 8 }, { side: 'opp', id: 'duomo_mark', min: 1 }], factor: 2 },
];
// 其餘已解鎖效果的數量只受八層＋對手墮魔影響，伏魔不把固定數量也無條件倍增。
const unlockedQuantityScale = perLayerScale.slice(1);

export const MIGRATED_DIXIN_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5017'], name: '荒',
  description: '登場時：\n> 自身獲得2層八荒\n> 若對方上回合主動切換則額外獲得2層\n回合結束時：\n> 對方當回合若使用技能則失去1層八荒\n> 若對方當回合未使用技能則獲得1層八荒\n> 若對方主動切換精靈時則額外獲得2層八荒並附加墮魔印記\n自身擊敗對手時：\n> 消除自身所有的八荒層數\n八荒層數效果（同時獲得該層及以下所有效果）：\n> 1層：每有1層自身攻擊威力提升13%\n> 2層：每有1層技能附加39點固傷\n> 3層：回合結束吸取對手所有技能2點PP與1/3最大體力，若被免疫百分比傷害則改為造成300點真實傷害並自身獲得1層伏魔印記\n> 5層：回合結束恢復自身1/3最大體力與已損失體力1/3，並有50%機率使對下手回合技能失效\n> 7層：回合結束獲得等同於自身伏魔印記層數的防禦護罩，並吸取對手等同於對方墮魔印記層數的能力提升狀態\n> 8層：若對手持有墮魔印記，上述效果翻倍\n> 若自身持有伏魔印記，計算八荒層數時視為翻倍（僅強化已解鎖效果，無法提前解鎖高層效果）\n> 9層：當達到9層時觸發誅魔天陣，持續9回合\n誅魔天陣：\n> 期間對方每次受到任意傷害時體力始終無法高於上次受到傷害前\n> 自身受非真實傷害降低等同於對方已損失體力（可降低至0）\n> 天陣正常結束關閉時，自身體力降為1、清空所有技能PP且1回合內自身無法主動切換精靈',
  kit: [
    // ── 基礎流轉 ──
    entry('on_entered', 'entrance', '登場時獲得2層八荒', [{ acts: [addB(2)] }], 0),
    entry('opponent_entered', 'bench', '對方主動切換登場時：自身額外獲得2層八荒並為對方附加墮魔印記', [{ acts: [
      addB(2),
      a('resource_mark_add', { id: 'duomo_mark', name: '墮魔印記', displayChar: '墮', unit: '層', scope: 'elf', side: 'opp', persistsOffField: true, description: '對方個體墮魔層數。', amount: 1 }),
    ] }], 1),
    entry('round_end', 'round_end', '對方當回合若使用技能則失去1層八荒；未使用則獲得1層', [
      { cond: [c('opp_used_skill', {}, '對方當回合使用過技能')], acts: [
        a('resource_mark_subtract', { id: 'bahuang_mark', name: '八荒', displayChar: '荒', unit: '層', scope: 'elf', side: 'self', persistsOffField: true, description: '最高9層。', amount: 1 }),
      ], elseActs: [addB(1)] },
    ], 2),
    entry('on_kill', 'kill', '自身擊敗對手時消除自身所有八荒層數', [{ acts: [a('resource_mark_remove', { id: 'bahuang_mark', side: 'self', scope: 'elf' })] }], 3),
    // ── 9層開天陣（資源變動反應；resource_changed 禁止直接加資源，開陣不是加資源）──
    entry('on_resource_changed', 'resource_changed', '達到9層時開啟誅魔天陣，持續9回合', [
      { cond: [c('resource_crossed',{id:'bahuang_mark',threshold:9},'八荒由不足9層達到9層')], acts: [a('open_formation', {
        formationId: 'dixin_formation', name: '誅魔天陣', turns: 9, hpCeiling:true,reduceLostHpRatio:1,
        onClose:[{acts:[a('hp_set',{side:'self',value:1}),a('pp_op',{side:'self',mode:'zero'}),a('switch_lock',{side:'self',turns:1,next:true})]}],
      })] },
    ], 4),
    // ── 層數效果鏈（回合結束）──
    entry('round_end', 'round_end', '3層：吸取對手2點PP與1/3最大體力，免疫則300真傷＋1層伏魔', [
      { cond: [layers(3)], acts: [
        a('pp_drain', { v: 2, steal: true, scaleByMarks: unlockedQuantityScale }),
        a('drain', { ratio: 1/3, true: false, scaleByMarks: unlockedQuantityScale }),
      ] },
      { cond: [layers(3), c('last_damage_immune', {}, '本次百分比傷害被免疫')], acts: [
        a('dmg', { flat: 300, type: '真實', scaleByMarks: unlockedQuantityScale }),
        a('resource_mark_add', { id: 'fumo_mark', name: '伏魔印記', displayChar: '伏', unit: '層', scope: 'elf', side: 'self', persistsOffField: true, description: '個體伏魔層數。', amount: 1, scaleByMarks: unlockedQuantityScale }),
      ] },
    ], 5),
    entry('round_end', 'round_end', '5層：恢復自身1/3最大體力與已損失1/3，並50%令對手下回合技能失效', [
      { cond: [layers(5)], acts: [
        a('heal', { side: 'self', ratio: 1/3, missingRatio: 1/3, scaleByMarks: unlockedQuantityScale }),
      ] },
      { cond: [layers(5), c('chance', {pct:50}, '50%機率')], acts: [a('invalid_turns', { kind: '', turns: 1, next: true })] },
    ], 6),
    // 每項吸取上限取對方個體墮魔層數；沒有墮魔就不吸取。
    entry('round_end', 'round_end', '7層：獲得等同伏魔層數的護罩，並吸取對手等同墮魔層數的能力提升狀態', [
      { cond: [layers(7)], acts: [
        a('shield', { flat: 1, kind: 'barrier', perMark: { side: 'self', id: 'fumo_mark' }, scaleByMarks: unlockedQuantityScale }),
        a('stat_steal', { mode: '吸取', double: false, reverse: false, v:1, perMark:{side:'opp',id:'duomo_mark'}, scaleByMarks: unlockedQuantityScale }),
      ] },
    ], 7),
    // ── 常駐威力（1層，每層13%）──
    entry('modify_power', 'outgoing_power', '1層起：每有1層八荒自身攻擊威力提升13%', [
      { cond:[layers(1)], acts: [a('power_mod', { boost: 0.13, perMark: { side: 'self', id: 'bahuang_mark' }, scaleByMarks: perLayerScale })] },
    ], 8),
    // ── 2層固傷（行動後）──
    entry('after_action', 'self_after_skill', '2層起：每有1層八荒技能附加39點固定傷害', [
      { cond: [layers(2)], acts: [a('dmg', { flat: 39, type: '固定', perMark: { side: 'self', id: 'bahuang_mark' }, scaleByMarks: perLayerScale })] },
    ], 9),
  ],
};
