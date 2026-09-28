/**
 * ============================================================================
 * 賽爾號對戰引擎 —— 效果與印記 Template 庫 (Effect Catalog)
 * ============================================================================
 * 本檔案定義了所有可視覺化展示的狀態、印記與機制 Template。
 * 
 * 分類說明：
 * - control/weakening/restrictive/evolutionary/auxiliary: 五大類標準異常
 * - indicia/indicia_hostile: 專屬機制與印記 (非異常)
 * - none: 其他特殊標記
 */

import { StatusRegistry } from '../effects/statusRegistry';

export interface EffectInstance {
  catalogId: string;
  remainingTurns?: number;
  stacks?: number;
  active?: boolean;
  maxStacks?: number;
  unit?: string;
  note?: string;
}

export const EFFECT_CATALOG: Record<string, any> = {
  // --- 4. 專屬機制與印記 (Indicia) ---
  soul_sorrow: { id: 'soul_sorrow', badge: '👻', label: '魂殤', categories: ['indicia_hostile'], color: 'bg-violet-900/40 text-violet-300 border-violet-500/50', describe: (p) => `專屬印記：上限4道；持有者回合結束時，每道令體力調整減少最大體力25%；下場後消失（目前 ${p.stacks ?? 0}/4 道）。` },
  concealment: { 
    id: 'concealment', 
    badge: '👤', 
    label: '隱匿', 
    categories: ['indicia'], 
    color: 'bg-slate-900/40 text-slate-300 border-slate-500/50', 
    describe: () => `專屬印記：變化為未知精靈，無法被選中，無法觸發後續效果，免疫擊敗效果。` 
  },
  star_rule: { 
    id: 'star_rule', 
    badge: '✨', 
    label: '星執', 
    categories: ['indicia'], 
    color: 'bg-indigo-900/40 text-indigo-300 border-indigo-500/50', 
    describe: () => `記錄最高項異常抗性，己方精靈進入該異常時轉化為3回合星賜但失去全免抗性。` 
  },
  star_governor: { 
    id: 'star_governor', 
    badge: '🔱', 
    label: '星執者', 
    categories: ['indicia'], 
    color: 'bg-amber-900/40 text-amber-300 border-amber-500/50', 
    describe: (p) => `己方在場精靈進入異常後轉化為星賜；技能後消耗15%能量造傷，回合結束消耗15%能量回血(目前能量 ${p.stacks ?? 0})。` 
  },
  rune_teiwaz: { 
    id: 'rune_teiwaz', 
    badge: 'ᛏ', 
    label: '符文·ᛏ', 
    categories: ['indicia'], 
    color: 'bg-red-900/40 text-red-100 border-red-500/50', 
    describe: () => `全能力提升 20%，每次登場時與對手發起決鬥。` 
  },
  demon_curse: { 
    id: 'demon_curse', 
    badge: '💀', 
    label: '魔王咒怨', 
    categories: ['indicia_hostile'], 
    color: 'bg-red-900/40 text-red-300 border-red-500/50', 
    describe: (p) => `專屬印記：每層減少受傷提升傷害，5層免疫控制，每層機率秒殺/高傷害 (目前 ${p.stacks ?? 0} 層)。` 
  },
  canglan_water: { 
    id: 'canglan_water', 
    badge: '🌊', 
    label: '永恆之水', 
    categories: ['indicia'], 
    color: 'bg-blue-900/40 text-blue-300 border-blue-500/50', 
    describe: (p) => `附加異常成功率升至100%；護盾消耗時保留30%；每道傷+40%；每2道對手有千秋一淚則重生(目前 ${p.stacks ?? 0} 道)。` 
  },
  canglan_tear: { 
    id: 'canglan_tear', 
    badge: '💧', 
    label: '千秋一淚', 
    categories: ['indicia_hostile'], 
    color: 'bg-indigo-900/40 text-indigo-300 border-indigo-500/50', 
    describe: (p) => {
      const s = p.stacks || 0;
      return `目前 ${s} 道。1道:恢復降25%；2道:減傷效果降50%；3道:盾效失效；4道:擋/免/轉傷害失效。`;
    }
  },
  mars_record_paralyzed: { id: 'mars_record_paralyzed', badge: '🔍⚡', label: '堅壁解析: 麻痺', categories: ['indicia'], color: 'bg-slate-700/60 text-cyan-300 border-cyan-500/50', describe: () => '【堅壁機甲·永久解析】：免疫「麻痺」，且每回合結束時恢復充能。' },
  star_fire_scorch: { id: 'star_fire_scorch', badge: '🔥✨', label: '星火之灼', categories: ['indicia_hostile'], color: 'bg-orange-900/40 text-orange-300 border-orange-500/50', describe: (p) => `專屬機制印記：體力恢復效果減少 100%；每次受到攻擊傷害後額外受傷。` },

  // --- 5. 系統與戰術回合類效果 (System / Tactical Round Effects) ---
  deep_sea_aura: { id: 'deep_sea_aura', badge: '🌊', label: '深海光環', categories: ['positive_turn'], color: 'bg-blue-900/40 text-blue-300 border-blue-500/50', describe: () => '每回合結束時自身全屬性 +1 且對手隨機 2 項能力下降 1 級；造成的攻擊傷害提升 50%。' },
  immune_reflect: { id: 'immune_reflect', badge: '🪞', label: '異常抵抗反彈', categories: ['positive_turn'], color: 'bg-sky-950/40 text-sky-300 border-sky-600/40', describe: () => '免疫並反彈一切受到的異常狀態給對手。' },
  negate_next_attack: { id: 'negate_next_attack', badge: '🛡️', label: '次數免疫', categories: ['count_effect'], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', describe: (p) => `免疫下 ${p.stacks ?? 0} 次受到的攻擊傷害與效果。` },
  damage_boost: { id: 'damage_boost', badge: '💥', label: '傷害提升', categories: ['positive_turn'], color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', describe: (p) => `下回合造成的攻擊傷害提升 50% ${p.note === 'doubled' ? '(效果翻倍，提升 100%！)' : ''}。` },
  odin_damage_boost: { id: 'odin_damage_boost', badge: '👑⚡', label: '神聖霸體', categories: ['positive_turn'], color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', describe: (p) => `奧丁專屬：造成的傷害提升 30% × 雙方無法主動切換精靈數 (目前 ${p.stacks ?? 0} 個，增傷 ${p.stacks ? p.stacks * 30 : 0}%)。` },
  delu_damage_boost: { id: 'delu_damage_boost', badge: '🦁💥', label: '劫盡暴風', categories: ['positive_turn'], color: 'bg-red-500/20 text-red-300 border-red-500/30', describe: () => '魔獅迪露：造成的攻擊傷害提升 50% / 100%。' },
  delu_non_true_dmg_boost: { id: 'delu_non_true_dmg_boost', badge: '🦁☄️', label: '獅魔爪襲', categories: ['positive_turn'], color: 'bg-red-500/20 text-red-300 border-red-500/30', describe: () => '非真實傷害與百分比傷害提升 50%。' },
  opp_priority_debuff: { id: 'opp_priority_debuff', badge: '⏳', label: '先制壓制', categories: ['negative_turn'], color: 'bg-purple-950/40 text-purple-300 border-purple-600/40', describe: () => '受到速度壓制，自身技能先制值減少 3。' },
  half_dmg_taken: { id: 'half_dmg_taken', badge: '🛡️📉', label: '傷害減免', categories: ['positive_turn'], color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', describe: () => '受到的非真實傷害減少 50%。' },
  idiocy_lockdown: { id: 'idiocy_lockdown', badge: '🌀🚫', label: '癡愚鎖定', categories: ['negative_turn'], color: 'bg-purple-950/40 text-purple-300 border-purple-600/40', describe: () => '無法主動切換精靈，且使用的屬性技能 100% 失敗。' },
  immune_status_turns: { id: 'immune_status_turns', badge: '🔰', label: '免疫異常', categories: ['positive_turn'], color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', describe: () => '免疫所有常規異常狀態。' },
  immune_stat_debuff_turns: { id: 'immune_stat_debuff_turns', badge: '🛡️🚫', label: '免疫能力下降', categories: ['positive_turn'], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', describe: () => '自身各項能力等級不會被對手降低。' },
  ningzhi_lock: { id: 'ningzhi_lock', badge: '⏱️', label: '凝滯力場', categories: ['negative_turn'], color: 'bg-amber-950/40 text-amber-300 border-amber-600/40', describe: () => '凝滯狀態：速度降低 50%，且無法獲得任何先制加成。' },
  no_switch_turns: { id: 'no_switch_turns', badge: '🔒🚪', label: '無法切換', categories: ['negative_turn'], color: 'bg-red-950/40 text-red-300 border-red-600/40', describe: () => '受限於戰場力場或特殊機制，無法主動進行切換精靈。' },
  seal_support_turns: { id: 'seal_support_turns', badge: '🚫🔮', label: '屬性封印', categories: ['negative_turn'], color: 'bg-purple-950/40 text-purple-300 border-purple-600/40', describe: () => '屬性技能全部無效且無法發動任何附加效果。' },
  seal_bonus_turns: { id: 'seal_bonus_turns', badge: '🧹🚫', label: '效果封鎖', categories: ['negative_turn'], color: 'bg-red-950/40 text-red-300 border-red-600/40', describe: () => '被施加了效果封鎖，無法附加任何回合類、次數類效果與護盾護罩。' },
  dodge_turns: { id: 'dodge_turns', badge: '💨', label: '高機率閃避', categories: ['positive_turn'], color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', describe: () => '大幅度提升對手攻擊技能的閃避機率。' },
  xingshu_turns: { id: 'xingshu_turns', badge: '✨📜', label: '星贖效果', categories: ['positive_turn'], color: 'bg-amber-400/20 text-amber-300 border-amber-500/30', describe: () => '【星贖】：異常轉化守護，當回合己方能力值上升無法被消除與吸取。' },
  vampire_turns: { id: 'vampire_turns', badge: '🧛', label: '體力吸取', categories: ['positive_turn'], color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', describe: () => '每回合結束時或攻擊造成傷害後，吸取對手一定數值的體力。' },
  true_dmg_turns: { id: 'true_dmg_turns', badge: '☄️', label: '真實傷害附加', categories: ['positive_turn'], color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', describe: () => '使用技能時附加額外的固定或真實傷害。' },
  crit_turns: { id: 'crit_turns', badge: '🎯', label: '機率暴擊', categories: ['positive_turn'], color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', describe: () => '造成的攻擊傷害暴擊機率提升 100%。' },
  priority_boost_turns: { id: 'priority_boost_turns', badge: '⚡💨', label: '技能先制提升', categories: ['positive_turn'], color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', describe: () => '使用的技能優先級（先制值）提升。' },
  no_heal_turns: { id: 'no_heal_turns', badge: '❤️‍🩹🚫', label: '無法恢復體力', categories: ['negative_turn'], color: 'bg-red-950/40 text-red-300 border-red-600/40', describe: () => '體力恢復效果全部失效，無法透過技能或機制恢復生命。' },
  prop_invalid_turns: { id: 'prop_invalid_turns', badge: '🚫🔮', label: '屬性失效', categories: ['negative_turn'], color: 'bg-purple-950/40 text-purple-300 border-purple-600/40', describe: () => '屬性技能失效，無法發揮任何附加作用。' },
  dmg_amplify_turns: { id: 'dmg_amplify_turns', badge: '💥📈', label: '受傷提升', categories: ['negative_turn'], color: 'bg-rose-950/40 text-rose-300 border-rose-600/40', describe: () => '承受額外傷害，受到的攻擊傷害提升 50% 或更高。' },
  dmg_limit_turns: { id: 'dmg_limit_turns', badge: '🛑🧱', label: '傷害限制', categories: ['positive_turn'], color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', describe: () => '每次受到的最大攻擊傷害被限制在特定上限值以內。' },
  insta_kill_turns: { id: 'insta_kill_turns', badge: '💀⚡', label: '斬殺狀態', categories: ['positive_turn'], color: 'bg-red-500/20 text-red-300 border-red-500/30', describe: () => '若對手體力低於特定比例，則 100% 直接擊潰對手。' },
  negate_attack_turns: { id: 'negate_attack_turns', badge: '🛡️🛑', label: '攻擊傷害免疫', categories: ['positive_turn'], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', describe: () => '免疫下一次受到的常規攻擊傷害。' },
  ignore_def_turns: { id: 'ignore_def_turns', badge: '🎯📉', label: '無視防禦', categories: ['positive_turn'], color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', describe: () => '造成的攻擊傷害無視對手部分百分比的防禦力。' },
  frighten_trigger_turns: { id: 'frighten_trigger_turns', badge: '😱🔥', label: '受擊控場觸發', categories: ['positive_turn'], color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', describe: () => '若本回合受到對手攻擊，則回合結束時令對手陷入害怕等控場狀態。' },
  reflect_crit_turns: { id: 'reflect_crit_turns', badge: '🎯🪞', label: '反彈暴擊', categories: ['positive_turn'], color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', describe: () => '若本回合受到暴擊攻擊，則百分之百反彈等量暴擊傷害。' },
  soul_dirge: { id: 'soul_dirge', badge: '💀📜', label: '鎖魂引導', categories: ['indicia_hostile'], color: 'bg-stone-700/40 text-rose-400 border-stone-500/40', describe: (p) => `專屬鎖魂：使對方受攻擊時承受額外固定傷害 (目前 ${p.stacks ?? 0} 層)。` },
  shield_active: { id: 'shield_active', badge: '🛡️🧱', label: '精靈護盾', categories: ['shield_barrier'], color: 'bg-teal-500/20 text-teal-300 border-teal-500/30', describe: (p) => `精靈護盾：抵擋最多 ${p.stacks ?? 0} 點攻擊傷害。` },
  barrier_active: { id: 'barrier_active', badge: '🌐🧱', label: '精靈護罩', categories: ['shield_barrier'], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', describe: (p) => `精靈護罩：抵擋最多 ${p.stacks ?? 0} 點受到的固定傷害與百分比傷害。` },
  brinkk_max_type_matchup: { id: 'brinkk_max_type_matchup', badge: '🌊⚖️', label: '屬性最高克制', categories: ['positive_turn'], color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', describe: () => '混濁海妖.布林克克專屬：自身技能使用時，克制倍率自動調整為當前技能對敵方背包所有屬性中的最高克制倍率。' },
  revive_ready_cleanse: { id: 'revive_ready_cleanse', badge: '👼🔄', label: '不滅重生(淨化)', categories: ['positive_turn'], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', describe: () => '巴弗滅不滅魂：受到致死傷害時100%免死、免異常，且全屬性+1，每場限1次。' },
  revive_ready_reset: { id: 'revive_ready_reset', badge: '👼🔄', label: '不滅重生(重置)', categories: ['positive_turn'], color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', describe: () => '星光·魯斯王不滅魂：受到致死傷害時100%免死、恢復全體力，每場限1次。' },
  mars_mech_speed: { id: 'mars_mech_speed', badge: '🤖💨', label: '迅擊機甲模式', categories: ['indicia'], color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', describe: () => '變革·馬爾修斯專屬：每回合使自身全屬性+1；若對手使用的技能先制高於自身，則當回合受到傷害減少 350 點。' },
  mars_mech_destroy: { id: 'mars_mech_destroy', badge: '🤖💥', label: '毀滅機甲模式', categories: ['indicia'], color: 'bg-red-500/20 text-red-300 border-red-500/30', describe: () => '變革·馬爾修斯專屬：造成的攻擊傷害提升 50%；若對手防禦大於特防，則造成的攻擊傷害提升 100%。' },

  // --- 6. 蓓麗安特專屬回合類效果 (Beliente Specific Round Effects) ---
  star_sea_immersion: { id: 'star_sea_immersion', badge: '💫🌌', label: '星海之浸', categories: ['negative_turn'], color: 'bg-purple-950/40 text-purple-300 border-purple-600/40', describe: () => '蓓麗安特專屬削弱：造成的傷害減少 50% 且屬性技能無效。' },
  star_fang_entangle: { id: 'star_fang_entangle', badge: '🕸️✨', label: '星牙之糾', categories: ['negative_turn'], color: 'bg-amber-950/40 text-amber-300 border-amber-600/40', describe: () => '蓓麗安特專屬削弱：無法主動切換精靈，且每次使用技能後自身全屬性降低 1 級。' },
  star_fire_burn: { id: 'star_fire_burn', badge: '🔥✨', label: '星火之焚', categories: ['negative_turn'], color: 'bg-red-950/40 text-red-300 border-red-600/40', describe: () => '蓓麗安特專屬削弱：體力恢復效果無效，且每回合結束時受到等同於自身最大體力 20% 的真實傷害。' },
  beliente_double_effect: { id: 'beliente_double_effect', badge: '✨x2', label: '星河雙倍效果', categories: ['positive_turn'], color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', describe: () => '下 2 回合內若自身特攻高於對手，則自身攻擊技能附加效果翻倍。' },
  beliente_orbit: { id: 'beliente_orbit', badge: '💫', label: '星軌力場', categories: ['positive_turn'], color: 'bg-violet-900/40 text-violet-300 border-violet-500/50', describe: () => '4 回合內若對手使用屬性技能，則降低對手最大體力 1/3 且消除其回合類效果。' },
  beliente_regen: { id: 'beliente_regen', badge: '💖', label: '每回合恢復1/3體力', categories: ['positive_turn'], color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', describe: () => '星能沐浴：每回合結束時恢復最大體力的 1/3。' },
  beliente_star_prayer: { id: 'beliente_star_prayer', badge: '🛡️✨', label: '星瀾守護', categories: ['positive_turn'], color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', describe: () => '4 回合內，若自身受到攻擊則回合結束吸取對手最大體力 1/3，未受攻擊則全屬性 +1。' },
  beliente_buff_lock: { id: 'beliente_buff_lock', badge: '🔒', label: '星河守護', categories: ['positive_turn'], color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', describe: () => '3 回合內自身能力提升狀態無法被對手消除或吸取。' },
  beliente_priority: { id: 'beliente_priority', badge: '⚡💨', label: '星河之速', categories: ['positive_turn'], color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', describe: () => '2 回合內自身使用所有技能先制 +3。' },
  seal_property: { id: 'seal_property', badge: '🚫🔮', label: '屬性封鎖', categories: ['negative_turn'], color: 'bg-purple-950/40 text-purple-300 border-purple-600/40', describe: () => '被封印了屬性技能，無法使用任何屬性技能。' }
};

const BADGES: Record<string, string> = {
  paralyzed: '⚡',
  feared: '😱',
  sleep: '💤',
  petrified: '🪨',
  paralyzed_lock: '⛓️⚡',
  cursed: '🔮',
  fanatic: '🛐',
  deep_sleep: '🛌',
  ice_sealed: '🧊❄️',
  incinerated: '🔥💀',
  infected: '🦠',
  poisoned: '☣️',
  burned: '🔥',
  parasite: '🌱',
  frostbite: '❄️',
  confused: '💫',
  weakened: '🪫',
  shuairuo: '🪫',
  flammable: '🍂',
  bleeding: '🩸',
  blind: '🌑',
  flame_curse: '🔥🔮',
  shackled: '⛓️',
  stupefied: '🌀',
  silenced: '🔇',
  submit: '🙇',
  boiling: '🌋',
  sluggish: '🐢',
  disarmed: '🚫⚔️',
  decayed: '🦠',
  hypothermia: '🥶',
  suffocated: '😷',
  stagnation: '🧊',
  trance: '💫',
  vacant: '📭',
  gradual_freeze: '⏳❄️',
  mountain_guardian: '🛡️',
  furious: '💢',
  myth: '👑',
  immune: '💎',
  status_immune: '🔰',
  fatal_curse: '💀🔮',
  weak_curse: '🪫🔮',
  star_gift: '✨🎁',
  star_philosopher: '✨🧙',
  overclock: '⚡',
  overclocked: '⚡',
  honing: '💎',
  star_redemption: '✨📜',
  thunder_break: '⚡⚔️',
  star_blessing: '✨🛡️',
  star_protection: '✨🛑',
  calm: '🧘',
};

const COLORS: Record<string, string> = {
  paralyzed: 'bg-amber-400/20 text-amber-300 border-amber-500/30',
  paralyzed_lock: 'bg-amber-600/20 text-amber-500 border-amber-600/30',
  feared: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sleep: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  deep_sleep: 'bg-indigo-900/40 text-indigo-200 border-indigo-500/50',
  petrified: 'bg-stone-700/40 text-stone-300 border-stone-500/40',
  cursed: 'bg-purple-900/40 text-purple-300 border-purple-500/50',
  fanatic: 'bg-rose-900/30 text-rose-300 border-rose-500/40',
  ice_sealed: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  incinerated: 'bg-rose-600/20 text-rose-500 border-rose-600/30',
  infected: 'bg-green-700/20 text-green-300 border-green-600/30',
  poisoned: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  parasite: 'bg-green-600/20 text-green-400 border-green-600/30',
  decayed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  burned: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  flammable: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  flame_curse: 'bg-rose-950/60 text-rose-400 border-rose-600/50',
  frostbite: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  hypothermia: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  confused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sluggish: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  shuairuo: 'bg-amber-950/40 text-amber-300 border-amber-600/40',
  weakened: 'bg-amber-950/40 text-amber-300 border-amber-600/40',
  blind: 'bg-neutral-900/60 text-neutral-400 border-neutral-600/50',
  bleeding: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  boiling: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  shackled: 'bg-red-950/40 text-red-300 border-red-600/40',
  disarmed: 'bg-red-950/40 text-red-300 border-red-600/40',
  suffocated: 'bg-red-950/40 text-red-300 border-red-600/40',
  stupefied: 'bg-purple-950/40 text-purple-300 border-purple-600/40',
  silenced: 'bg-purple-950/40 text-purple-300 border-purple-600/40',
  submit: 'bg-purple-950/40 text-purple-300 border-purple-600/40',
  stagnation: 'bg-blue-900/30 text-blue-300 border-blue-500/40',
  trance: 'bg-violet-950/40 text-violet-300 border-violet-600/40',
  vacant: 'bg-violet-950/40 text-violet-300 border-violet-600/40',
  gradual_freeze: 'bg-sky-950/40 text-sky-300 border-sky-600/40',
  mountain_guardian: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  star_gift: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  star_philosopher: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  star_redemption: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  star_blessing: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  star_protection: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  furious: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  fatal_curse: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  weak_curse: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  myth: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  immune: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  status_immune: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  calm: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  honing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  overclock: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  overclocked: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  thunder_break: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const CATEGORY_MAP: Record<string, string> = {
  "CONTROL": "control",
  "WEAKENING": "weakening",
  "RESTRICTIVE": "restrictive",
  "EVOLUTIONARY": "evolutionary",
  "AUXILIARY": "auxiliary",
  "BOSS_ONLY": "boss_only",
  "NO_EFFECT": "no_effect"
};

// Auto-populate all abnormal statuses from StatusRegistry to ensure 100% compliance
Object.entries(StatusRegistry).forEach(([statusKey, entry]) => {
  const id = statusKey;
  const cats = entry.categories.map(c => CATEGORY_MAP[c] || 'none');

  if (!EFFECT_CATALOG[id]) {
    EFFECT_CATALOG[id] = {
      id: id,
      badge: BADGES[id] || '❓',
      label: entry.name,
      categories: cats,
      color: COLORS[id] || 'bg-slate-800/35 text-slate-300 border-slate-700/50',
      describe: () => entry.description
    };
  } else {
    cats.forEach(c => {
      if (!EFFECT_CATALOG[id].categories.includes(c)) {
        EFFECT_CATALOG[id].categories.push(c);
      }
    });
    EFFECT_CATALOG[id].describe = () => entry.description;
    EFFECT_CATALOG[id].label = entry.name;
  }
});

// Alias for shuairuo (衰弱) pointing to weakened
if (EFFECT_CATALOG['weakened']) {
  EFFECT_CATALOG['shuairuo'] = {
    ...EFFECT_CATALOG['weakened'],
    id: 'shuairuo'
  };
}
if (EFFECT_CATALOG['overclock']) {
  EFFECT_CATALOG['overclocked'] = {
    ...EFFECT_CATALOG['overclock'],
    id: 'overclocked'
  };
}

export const getRuneDisplayName = (runeBadge?: string): string => {
  if (!runeBadge) return "";
  const nameMap: Record<string, string> = {
    'ᛏ': 'ᛏ [決鬥]',
    'ᚨ': 'ᚨ [1位]',
    'ᛉ': 'ᛉ [2位]',
    'ᚱᚷ': 'ᚱᚷ [3位]',
    'ᛇ': 'ᛇ [4位]',
    'ᛖ': 'ᛖ [5位]'
  };
  return nameMap[runeBadge] || runeBadge;
};

export const getRuneDescription = (runeBadge?: string, isRuneActive?: boolean): string => {
  if (!runeBadge) return "";
  const displayName = getRuneDisplayName(runeBadge);
  if (runeBadge === 'ᛏ') return `【${displayName}】獨立印記：提升全屬性 20%，每次登場發起決鬥。`;
  return `【${displayName}】：${isRuneActive ? '【已激活】正在持續觸發獨立印記效果。' : '【未激活】選擇該技能時激活。'}`;
};
