// 5034 邪靈主宰·摩哥斯 魂印「邪」Kit：魂珠三態（豐腴/竭擇/混沌）、埒殘銜闕、必中、
// FATAL 轉竭擇、戰鬥階段結束吸取與溢出真傷。
// 相關說明段（平靜/狂暴/驅逐/埒殘銜闕規則/技能固有效果）為規則定義，由引擎
// （statusRegistry、marks、battleEngine）結算；Kit 條款只掛觸發行為與數值。
// 團隊層共享時點（埒殘銜闕吸取、豐腴剝奪、混沌期每回合、竭擇登場轉化、臨時體力上限）
// 仍由 runMogosTeamEffects 承載；該檔已加 kit 退位守衛，附加印記不重複。
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';

const entry = (node: Node, trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});
const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

const PHASE_ABUNDANCE = '豐腴期';
const PHASE_EXHAUST = '竭擇期';
const PHASE_CHAOS = '混沌期';
const MARK = { id: 'mogos_residual', name: '埒殘銜闕', displayChar: '闕', unit: '道', max: 3,
  description: '非真實傷害提升50%；每道獨立吸取該傷害50%；上限3道，下場後保留。',
  effects: { nonTrueDamageTakenMultiplier: 1.5 } };
const ORB_PHASES = [PHASE_ABUNDANCE, PHASE_EXHAUST, PHASE_CHAOS];
const draw = (order: number) => entry('on_entered', 'entrance',
  '出戰時若己方不存在魂珠則獲得魂珠，擁有/獲得魂珠後從中吸取力量並開始根據魂珠狀態變化執行相應效果', [
  { acts: [a('orb_draw', {
    initialPhase: PHASE_ABUNDANCE, remaining: 2, clearStatuses: true, heal: true, restorePp: true,
    calmStatus: '平靜', calmPerAlive: 1, calmPerAlien: 1, calmAlienElem: '邪靈',
    chaosElem: '混沌', chaosPhase: PHASE_CHAOS, abundancePhase: PHASE_ABUNDANCE,
    abundanceFlag: 'orbAbundanceThisRound' })] },
], order);
const hasOrb = (label: string) => c('orb_query', { phase: ORB_PHASES }, label);

export const MIGRATED_MOGOS_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5034'], name: '邪',
  description: "> 出戰時若己方不存在魂珠則獲得魂珠\r\n>> 擁有/獲得魂珠後從中吸取力量並開始根據魂珠狀態變化執行相應效果\r\n>> 之後自身回合開始時若場上存在技能PP值為0的精靈且同時存在處於狂暴異常狀態的精靈時則當回合開始時重新執行出戰效果\r\n\r\n> **自身擁有魂珠時：**\r\n>> 自身所有技能必定命中\r\n>> 敵我雙方任一方使用技能時附加給對手1道埒殘銜闕\r\n>>> 附加成功或對手道數已滿則使用方消耗該技能全部PP值並恢復己方場下體力最低的精靈PP值消耗量×20的體力且該精靈下次出戰時獲得等量臨時體力上限（通過此來源獲得的臨時體力上限最多疊加1次，可與不同來源疊加）\r\n>>> 上述效果觸發同時若對手攜帶技能中識別屬性存在為自身天敵則額外交換雙方克制倍數\r\n>>>> 交換成功後若對手當前克制倍數高於自身時令雙方克制倍數歸1\r\n>>>> 對手每有1道埒殘銜闕時自身克制倍數額外+1(持續到任一方下場)\r\n\r\n> **戰鬥階段結束時：**\r\n>> 吸取對手350點固定體力，自身體力低於最大體力½時吸取效果翻倍\r\n>> 恢復體力後每溢出自身最大體力1%則下回合攻擊技能額外附加對手最大體力1%的真實傷害\r\n\r\n---\r\n\r\n## ◆ 魂珠狀態\r\n\r\n> **魂珠：**\r\n>> 擁有豐腴期、竭擇期與混沌期三種狀態，每次獲得魂珠時初始為豐腴期\r\n>> 每次從魂珠吸取力量時解除己方在場精靈所有異常狀態、恢復全部體力與PP值\r\n>>> 敵我雙方每存活1隻精靈或識別屬性中帶有邪靈系的精靈則額外為在場精靈附加1回合平靜\r\n>> 摩哥斯本場戰鬥中首次於該顆魂珠存在期間死亡時保留自身1點體力，同時將型態轉變為竭擇期\r\n>> 每次從魂珠吸取力量時若敵我雙方在場精靈識別屬性及技能識別屬性中存在混沌系則進入混沌期\r\n>>> 直到本場戰鬥結束時該顆魂珠無法進入竭擇期與觸發保留體力\r\n>> 魂珠下場後保留，上限1顆，狀態保留\r\n\r\n> **豐腴期：**\r\n>> 魂珠為豐腴期時每次從魂珠吸取力量的當回合結束時剝奪對方登場效果與技能固有效果\r\n>> 剝奪成功則對手下1回合內無法行動與恢復體力且受到固定傷害、百分比傷害轉化為真實傷害\r\n\r\n> **竭擇期：**\r\n>> 魂珠進入該狀態時提升摩哥斯所有能力值25%並驅逐下場\r\n>> 此後己方所有精靈出戰時首次受到的攻擊傷害轉化為等量體力並執行摩哥斯出戰效果，最多執行2次失去魂珠\r\n\r\n> **混沌期：**\r\n>> 魂珠每回合開始時將賦予對方在場非神靈系精靈混沌系並取代隨機一種屬性\r\n>>> 賦予識別中帶有聖靈系精靈時有100%觸發湮滅：令對手當回合無法行動與恢復體力並受到238點真實傷害\r\n>>>> 觸發湮滅後對手屬性隨機轉變為虛空系/輪迴系\r\n>> 對方在場精靈為混沌系、神靈系時本次效果執行時該效果失效\r\n>> 在場精靈不處於平靜狀態時每回合開始時令敵我雙方進入狂暴\r\n>>> 任一方未觸發則2回合內對手非真實傷害減半\r\n>>> 進入平靜狀態時解除自身狂暴狀態\r\n\r\n---\r\n\r\n## ◆ 相關說明\r\n\r\n> **埒殘銜闕：**\r\n>> 持有者每次受到非真實傷害時被埒殘銜闕吸取等同於傷害值的體力50%，每次觸發時每道獨立生效1次\r\n>> 持有者受到非真實傷害提升50%\r\n>> 若傷害不等於技能威力值×(1+n)時則100%令自身進入害怕\r\n>> 若低於技能威力值×(1+n)則自身下次所有技能先制-3且至少降至先制-3\r\n>> 每次被埒殘銜闕吸取體力時若對方在場精靈為邪靈主宰·摩哥斯或自身天敵，則埒殘銜闕吸取的體力額外恢復至對手在場精靈\r\n>> n=埒殘銜闕道數，上限3道，下場後保留\r\n\r\n> **驅逐：** 隨機選擇並切換至己方場下的非額外精靈中的存活精靈，主動/死亡切換/登場等相關效果失效\r\n\r\n> **技能固有效果：** 包含任何在技能描述中使用技能時即可觸發的效果，且不因技能無效或附加效果失效的任何技能效果（例如先制+n、必中、無視免疫效果、無視能力提升等等）\r\n\r\n> **平靜：**\r\n>> 附屬類異常，處於該狀態使用技能時不受PP值限制且不消耗PP值\r\n>> 回合結束時受到最大體力1%的真實傷害（不致死）並恢復自身所有技能一定PP值\r\n>>> 恢復量等於自身PP值上限最高者⅕，向上取整\r\n\r\n> **狂暴：** 附屬類異常，處於該狀態造成攻擊傷害翻倍\r\n\r\n---",
  kit: [
    // ── 出戰：獲得／吸取魂珠 ──
    draw(0),
    // ── 回合開始：場上有 PP=0 且有狂暴者 → 重新執行出戰效果 ──
    entry('round_start', 'round_start',
      '之後自身回合開始時若場上存在技能PP值為0的精靈且同時存在處於狂暴異常狀態的精靈時則當回合開始時重新執行出戰效果', [
      { acts: [a('field_pp_zero', {})] },
      { chain: 'success', acts: [a('field_status', { status: '狂暴' })] },
      { chain: 'success', acts: [a('orb_draw', {
        clearStatuses: true, heal: true, restorePp: true,
        calmStatus: '平靜', calmPerAlive: 1, calmPerAlien: 1, calmAlienElem: '邪靈',
        chaosElem: '混沌', chaosPhase: PHASE_CHAOS, abundancePhase: PHASE_ABUNDANCE,
        abundanceFlag: 'orbAbundanceThisRound' })] },
    ], 1),
    // ── 擁有魂珠：所有技能必定命中 ──
    entry('before_skill', 'before_skill', '自身擁有魂珠時自身所有技能必定命中', [
      { acts: [a('orb_query', { phase: ORB_PHASES })] },
      { chain: 'success', acts: [a('sure_hit', {})] },
    ], 2),
    // ── 敵我任一方使用技能時：附加 1 道埒殘銜闕（使用方消耗該技能全部PP＋場下恢復＋克制交換） ──
    entry('before_skill', 'before_skill',
      '敵我雙方任一方使用技能時附加給對手1道埒殘銜闕；附加成功或對手道數已滿則使用方消耗該技能全部PP值並恢復己方場下體力最低的精靈PP值消耗量×20的體力且該精靈下次出戰時獲得等量臨時體力上限', [
      { acts: [a('orb_query', { phase: ORB_PHASES })] },
      { chain: 'success', acts: [a('orb_mark_add', { ...MARK, count: 1, markedSide: 'opp', consumer: 'self', healMult: 20, typeExchange: true })] },
    ], 3),
    entry('on_attacked', 'opp_skill',
      '敵我雙方任一方使用技能時附加給對手1道埒殘銜闕（對手使用時）', [
      { acts: [a('orb_query', { phase: ORB_PHASES })] },
      { chain: 'success', acts: [a('orb_mark_add', { ...MARK, count: 1, markedSide: 'opp', consumer: 'opp', healMult: 20, typeExchange: true })] },
    ], 4),
    // ── 致命抵擋：首次死亡保留1點並轉竭擇期（提升能力25%＋驅逐） ──
    entry('self_fatal', 'fatal',
      '摩哥斯本場戰鬥中首次於該顆魂珠存在期間死亡時保留自身1點體力，同時將型態轉變為竭擇期；魂珠進入該狀態時提升摩哥斯所有能力值25%並驅逐下場；直到本場戰鬥結束時該顆魂珠無法進入竭擇期與觸發保留體力', [
      { acts: [a('orb_query', { phase: [PHASE_ABUNDANCE, PHASE_EXHAUST], fatalUsed: false })] },
      { chain: 'success', acts: [
        a('orb_phase_set', { targetPhase: PHASE_EXHAUST, fatalUsed: true }),
        a('survive', {}),
        a('stat_scale', { ratio: 1.25, includeMaxHp: true }),
        // 同一傷害及其印記等反應全部結束後，最後保留1點再驅逐（與舊 handler 語意一致）。
        a('expel', { side: 'self', deferToDamageChain: true, keepHp: 1 }),
      ] },
    ], 5),
    // ── 戰鬥階段結束：吸取對手350固定體力（低於½翻倍）＋恢復溢出轉下回合攻擊真傷 ──
    entry('battle_phase_end', 'phase_end',
      '戰鬥階段結束時吸取對手350點固定體力，自身體力低於最大體力½時吸取效果翻倍；恢復體力後每溢出自身最大體力1%則下回合攻擊技能額外附加對手最大體力1%的真實傷害', [
      { acts: [a('orb_query', { phase: ORB_PHASES })] },
      { chain: 'success', acts: [a('drain_fixed_overflow', {
        flat: 350, doubleBelowRatio: 0.5, doubleMultiplier: 2, turns: 1, id: 'mogos_overflow', label: '魂珠溢出' })] },
    ], 6),
  ],
};
