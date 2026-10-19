// 5028 瀾 魂印「瀾」真 Kit（DSH 20261018 第二十二批 legacyWrapped 拆解）。
// 舊 handler 的護盾／印記讀取端保留；本 Kit 把效果條款寫成可編輯積木。
// 永恆之水（eternalWater）／千秋一淚（thousandTears）為印記非異常。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import lanText from './lanSoulText.json';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });
const mark = (side: 'self' | 'opp', id: string, name: string, ch: string, desc: string, maxCount: number) =>
  a('resource_mark_add', { id, name, displayChar: ch, unit: '道', side, scope: 'elf', persistsOffField: true, amount: 1, maxCount, description: desc });
const hasShield = c('shield', { side: 'self' }, '場上存在擁有護盾者');
const markCount = (id: string, side: 'self' | 'opp', n = 1) => c('mark_count', { side, id, op: '不小於', amount: n }, '持有' + id);

export const MIGRATED_5028_LAN_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5028'],
  name: '瀾',
  description: lanText.soul,
  kit: [
    // 登場：附加 600 點護盾；若登場前場上存在護盾則額外複製雙方護盾總和
    e('on_entered', 'entrance', '登場時：為自身附加600點護盾；若登場前場上精靈存在護盾則額外複製雙方護盾總和並附加給自身', [
      { acts: [a('shield', { flat: 600, kind: 'shield' })] },
      { cond: [hasShield], acts: [a('shield', { ratio: 1, kind: 'shield' })] },
    ], 0),
    // 回合開始：場上有護盾則當回合所有技能先制+1
    e('round_start', 'round_start', '回合開始時：場上精靈中存在擁有護盾者則當回合自身所有技能先制+1', [
      { cond: [hasShield], acts: [a('prio_turns', { v: 1, turns: 1, next: false })] },
    ], 1),
    // 雙方每存在100點護盾 → 每次受到固定/百分比傷害額外減半一次，減半後不超過雙方護盾總和1/3（下場後保留）
    e('before_damage', 'incoming', '雙方每存在100點護盾則直到下回合結束時每次受到固定傷害、百分比傷害額外減半一次且減半後傷害無法超過雙方當前護盾值總和的1/3（下場後保留）', [
      { cond: [hasShield], acts: [
        a('dmg_mod_turns', { side: 'self', dir: 'in', kind: '固定', reduce: 0.5, turns: 2 }),
        a('dmg_mod_turns', { side: 'self', dir: 'in', kind: '百分比', reduce: 0.5, turns: 2 }),
      ] },
    ], 2),
    // 護盾值每次變化：每達 100 附加 1 道對手千秋一淚
    e('round_start', 'round_start', '雙方護盾值每次發生變化時：每達到100則附加給1道對手千秋一淚', [
      { acts: [a('shield_change_mark', { perStep: 100, markId: 'thousandTears', markName: '千秋一淚', displayChar: '淚', maxCount: 4, side: 'opp' })] },
    ], 3),
    // 使用攻擊技能：附加自身1道永恆之水；場上有護盾則額外1道；場上存在無護盾者則PP不受限且技能後附加對手1道千秋一淚
    e('after_action', 'self_after_attack', '自身使用攻擊技能時：附加給自身1道永恆之水；若場上存在擁有護盾者則額外附加給自身1道永恆之水；場上存在不擁有護盾者則自身使用技能不受PP值限制、不消耗技能PP值且當回合技能使用後附加給對手1道千秋一淚', [
      { acts: [mark('self', 'eternalWater', '永恆之水', '水', '攻擊傷害+40%；異常附加機率提升至100%；護盾減少時至少保留30%', 8)] },
      { cond: [hasShield], acts: [mark('self', 'eternalWater', '永恆之水', '水', '攻擊傷害+40%；異常附加機率提升至100%；護盾減少時至少保留30%', 8)] },
      { cond: [c('shield', { side: 'opp', neg: true }, '場上存在無護盾者')], acts: [
        // 「使用技能不受PP值限制、不消耗技能PP值」→ 引擎既有 ppExemptions 讀取端
        a('pp_unlimited_until_switch', {}),
        mark('opp', 'thousandTears', '千秋一淚', '淚', '體力恢復量下降25%／道；技能傷害減免比例衰減50%／2道；護盾護罩附帶效果失效／3道；抵擋免疫轉化失效／4道', 4),
      ] },
    ], 4),
    // 受到技能傷害：減半；每次受到後恢復自身最大體力1/3並抵擋下次技能傷害
    e('before_damage', 'incoming', '自身受到技能傷害時：受到技能傷害減半；每次受到技能傷害後恢復自身最大體力1/3並使自身抵擋下次受到的技能傷害', [
      { acts: [
        a('dmg_mod_turns', { side: 'self', dir: 'in', kind: '技能', reduce: 0.5, turns: 1 }),
        a('heal', { side: 'self', ratio: 1 / 3 }),
      ] },
    ], 5),
    // 回合結束若自身未受到技能傷害：吸取對手最大體力1/3；下回合開始解除自身異常
    e('round_end', 'round_end', '回合結束時若自身未受到技能傷害：吸取對手最大體力1/3；下回合開始時解除自身所處的異常狀態', [
      { cond: [c('no_damage_kind', { kind: '技能' }, '本回合未受技能傷害')], acts: [
        a('drain', { ratio: 1 / 3 }),
        // 「下回合開始時解除異常」→ 1 回合的回合開始觸發條款
        a('timed', { turns: 1, trig: 'round_start', body: [{ acts: [a('cure_status', { side: 'self' })] }] }),
      ] },
    ], 6),
    // 永恆之水：每有1道造成攻擊傷害提升40%
    e('before_damage', 'outgoing', '永恆之水：每有1道則造成攻擊傷害提升40%', [
      { cond: [markCount('eternalWater', 'self')], acts: [
        a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 0.4, turns: 1 }),
      ] },
    ], 7),
    // 永恆之水：每存在2道且對方有1道千秋一淚 → 死亡時消耗對應道數重生並解除所有異常
    e('self_fatal', 'fatal', '永恆之水：每存在2道時若對方存在1道千秋一淚則死亡時消耗對應的道數令自身重生並解除所有異常狀態', [
      { cond: [markCount('eternalWater', 'self', 2), markCount('thousandTears', 'opp')], acts: [
        a('conditional_rebirth', { afterRounds: 0, ratio: 1 }),
        a('cure_status', { side: 'self' }),
      ] },
    ], 8),
    // 千秋一淚：1道→恢復量下降25%/道；2道→技能傷害減免比例衰減50%/2道；3道→護盾護罩附帶效果失效；4道→抵擋免疫轉化失效
    e('round_start', 'round_start', '千秋一淚：1道持有者體力恢復量下降25%（每有1道額外下降25%）；2道持有者減少降低技能傷害效果比例衰減50%（每2道額外50%）；3道持有者護盾與護罩所有附帶效果失效；4道持有者抵擋、免疫、轉化技能傷害效果失效', [
      { cond: [markCount('thousandTears', 'opp')], acts: [
        a('no_heal', { turns: 1, scope: 'all' }),
      ] },
    ], 9),
  ],
};
