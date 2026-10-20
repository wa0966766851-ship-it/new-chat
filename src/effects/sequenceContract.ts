import {RESOURCE_PANEL_FIELDS,resourcePanelIssue} from './resourcePanelOperations';
/** 可編輯的條件／結果連鎖合約。只放已知結算動作，不接受專屬 handler、腳本或文字 fallback。 */
import {SUPPORT_ACTION_FIELDS,supportActionIssue} from './mechSupportLifecycle';
import type { Clause } from '../blocks/model';
import {TEAM_KIT_TRIGGERS} from './teamKitContract';
import type { KitEntry } from './effectSystem.schema';
import { DAMAGE_BASE_CHOICES } from './damageBases';
import { CLOSURE_ACTION_FIELDS, closureActionIssue } from './sequenceClosureContract';
import { MARK_PROGRAM_FIELDS, markProgramIssue } from './markProgram';
import { ASTRAL_ACTION_FIELDS, astralActionIssue } from './astralContract';
import { LEGACY_ACTION_FIELDS, legacyActionIssue } from '../blocks/ops/legacyHandler';
import { StatusRegistry } from './statusRegistry';
import { canonicalStatusName } from './statusIdentity';
import {stageQueryIssue,stageKindScaleIssue} from './stageQueries';
import {MARK_SCALE_FIELDS,actionMarkScaleIssue} from './actionMarkScale';
import {ppExemptionIssue} from './skillPpProperty';
import {markDamageReductionIssue} from '../battle/markDamageReduction';
import {isKnownBattleType} from './attackTypeView';
import {damageTermsIssue} from './damageSum';
import {GROUP_A_CONDITION_FIELDS,groupAConditionIssue} from '../blocks/ops/groupA';
import {GROUP_B_ACTION_FIELDS,GROUP_B_PER_NAMES,groupBActionIssue} from '../blocks/ops/groupB';
import {ITEM_USE_ACTION_FIELDS,itemUseActionIssue} from '../blocks/ops/itemUse';
import {POWER_STAT_ACTION_FIELDS,POWER_STAT_CONDITION_FIELDS,powerStatActionIssue,powerStatConditionIssue} from '../blocks/ops/powerStat';
import {ENTRANCE_STACK_ACTION_FIELDS,ENTRANCE_STACK_CONDITION_FIELDS,entranceStackActionIssue,entranceStackConditionIssue} from '../blocks/ops/entranceStack';
import {STAGE_DAMAGE_ACTION_FIELDS,STAGE_DAMAGE_CONDITION_FIELDS,stageDamageActionIssue,stageDamageConditionIssue} from '../blocks/ops/stageDamage';
import {KELD_SOUL_ACTION_FIELDS,KELD_SOUL_CONDITION_FIELDS,keldSoulActionIssue,keldSoulConditionIssue} from '../blocks/ops/keldSoul';
import {STATUS_SOVEREIGNTY_ACTION_FIELDS,statusSovereigntyActionIssue} from '../blocks/ops/statusSovereignty';
import {PRIORITY_BONUS_ACTION_FIELDS,priorityBonusActionIssue} from '../blocks/ops/priorityBonus';
import {ARENA_SHARED_ACTION_FIELDS,HP_STEPS_ACTION_FIELDS,ARENA12_ACTION_FIELDS,ARENA12_CONDITION_FIELDS,arenaSharedActionIssue,hpStepsIssue,arena12ActionIssue,arena12ConditionIssue} from '../blocks/ops/arenaShared';
import {HOLY_MILES_ACTION_FIELDS,holyMilesActionIssue} from '../blocks/ops/holyMiles';
import {DRAGON_HEALING_ACTION_FIELDS,dragonHealingActionIssue} from '../blocks/ops/dragonHealing';
import {SHIELD_MARK_ACTION_FIELDS,shieldMarkActionIssue} from '../blocks/ops/shieldMark';
import {CAN_ACTION_FIELDS,canActionIssue} from '../blocks/ops/can';
import {BRINKK_ACTION_FIELDS,brinkkActionIssue} from '../blocks/ops/brinkk';
import {ODIN_ACTION_FIELDS,odinActionIssue} from '../blocks/ops/odinRune';
import {MECH_ACTION_FIELDS,mechActionIssue} from '../blocks/ops/mech';
import {PP_ABSORB_ACTION_FIELDS,ppAbsorbActionIssue} from '../blocks/ops/ppAbsorb';
import {FEAR_SEED_ACTION_FIELDS,fearSeedActionIssue} from '../blocks/ops/fearSeed';
import {ROSTER_STATS_ACTION_FIELDS,rosterStatsActionIssue} from '../blocks/ops/rosterStats';
import {GROUP1_ACTION_FIELDS,group1ActionIssue} from '../blocks/ops/group1';
import {FINAL_EXTRA_TRAIT_ACTION_FIELDS,finalExtraTraitActionIssue} from '../blocks/ops/finalExtraTraits';
import {FINAL_MARS_LAN_DRAGON_ACTION_FIELDS,finalMarsLanDragonActionIssue} from '../blocks/ops/finalMarsLanDragon';
import {TYPED_CYCLE_ACTION_FIELDS,typedCycleActionIssue} from '../blocks/ops/typedDamageCycle';
import {RESOURCE_DEFENSE_FIELDS,resourceDefenseIssue} from '../blocks/ops/resourceDefenses';
import {MISSING_HP_SCALING_FIELDS,missingHpScalingIssue} from '../blocks/ops/missingHpScaling';
import {REMOVED_EFFECT_FIELDS,removedEffectIssue} from '../blocks/ops/removedEffects';
import {FINAL_ODB_ACTION_FIELDS,FINAL_ODB_CONDITION_FIELDS,finalOdbActionIssue,finalOdbConditionIssue} from '../blocks/ops/finalOdinDeluBeliente';
import {EXTRA_ELF_ACTION_FIELDS,extraElfActionIssue} from '../blocks/ops/extraElf';
import {THUNDER_GOD_ACTION_FIELDS,THUNDER_GOD_CONDITION_FIELDS,thunderGodActionIssue,skillTransformIssue} from '../blocks/ops/thunderGod';
import {GROUP5_ACTION_FIELDS,group5ActionIssue} from '../blocks/ops/group5';
import {GROUP_C_ACTION_FIELDS,GROUP_C_CONDITION_FIELDS,groupCActionIssue,groupCConditionIssue} from '../blocks/ops/groupCContract';
export const SEQUENCE_ACTION_FIELDS: Record<string, readonly string[]> = {
  next_power_nonfull:['perElf','scope','aliveOnly'],heal_main_settled:['ratio'],
  checked_percent_drain:['ratio','failTrue','ofSelf','replaceWithTrue'],
  type_damage_floor_turns:['side','base','list','turns'],
  damage_reduction_steps:['unit'],
  match_max_hp:['side','source','reduceStats'],
  stat_floor_opponent:[],body_maxhp_resource_loss:['side','unit','cap','resourceId'],
  power_ratio_turns:['side','ratio','turns','bound'],
  incoming_panel_attack:['ratio'],
  rebirth_after_ally_turns:['afterRounds','ratio'],
  dmg_sum:['terms','type'],
  attack_type_view_uses:['uses','attackType','targetType'],change_type:['side','type','untilSwitch'],peel_types:['side'],
  stage_guard_turns:['kind','turns'],
  instant_kill:['chance'], prevent_instant_kill:['dir','scope'], instant_kill_same_hp_targets:[],
  damage_to_heal_turns:['turns','kind','next'],
  block_damage_uses:['uses','kind','key','onBlock'],
  abolish_selected:['side'],consume_selected_pp:['side'],
  heal_then:['side','ratio','body'],
  select_elf:['all','side','scope','state','orderBy','direction','body'],raise_max_hp:['source','ratio'],
  heal_selected_then:['ratio','body'],stat_points:['stats','direction','ratio','cap','floor'],vanish_selected:[],
  stat_apply_last:['side','direction'],next_entry_priority:['turns'],
  snapshot_value:['side','key','fields'],heal_snapshot:['key','ratio','consume'],count_team_trait:['side','name','state','traitText'],
  resource_mark_add:['id','name','side','scope','displayChar','unit','persistsOffField','description','ratio','amount','maxCount','incomingDamageReduction'],
  damage_floor:['side','base','ratio'],
  ...CLOSURE_ACTION_FIELDS,
  ...SUPPORT_ACTION_FIELDS,
  ...RESOURCE_PANEL_FIELDS,
  // B 組新通用 op（blocks/ops/groupB.ts）
  ...GROUP_B_ACTION_FIELDS,
  // 戰鬥藥劑（blocks/ops/itemUse.ts；DSH 20261017）
  ...ITEM_USE_ACTION_FIELDS,
  // 能力值威力／能力互比（blocks/ops/powerStat.ts；DSH 20261017）
  ...POWER_STAT_ACTION_FIELDS,
  // 登場計數疊層（blocks/ops/entranceStack.ts；DSH 20261017）
  ...ENTRANCE_STACK_ACTION_FIELDS,
  // 能力等級傷害／場下PP上限（blocks/ops/stageDamage.ts；DSH 20261017）
  ...STAGE_DAMAGE_ACTION_FIELDS,
  // 受擊減免分支／印記點數傷害上限（blocks/ops/keldSoul.ts；DSH 20261017）
  ...KELD_SOUL_ACTION_FIELDS,
  // 常駐主權規則（blocks/ops/statusSovereignty.ts；DSH 20261018）：免疫讓路／轉化保護。
  ...STATUS_SOVEREIGNTY_ACTION_FIELDS,
  // 先制即時修正（blocks/ops/priorityBonus.ts；DSH 20261018）：狂暴條件先制等事中查詢。
  ...PRIORITY_BONUS_ACTION_FIELDS,
  // 隨機分支（blocks/ops/arenaShared.ts；DSH 20261018）
  ...ARENA_SHARED_ACTION_FIELDS,
  // HP階梯（blocks/ops/arenaShared.ts；DSH 20261018）
  ...HP_STEPS_ACTION_FIELDS,
  // 無為龍者（arena_12）PP／屬性重設（blocks/ops/arenaShared.ts；DSH 20261018）
  ...ARENA12_ACTION_FIELDS,
  // 逐次減半／迴圈／登場快照還原（blocks/ops/holyMiles.ts；DSH 20261018）
  ...HOLY_MILES_ACTION_FIELDS,
  // 龍之治癒（arena_16）赤龍累計／真龍額外使用／PP無視（DSH 20261018）
  ...DRAGON_HEALING_ACTION_FIELDS,
  // 5028 瀾：護盾變化發放印記／條件重生（DSH 20261018）
  ...SHIELD_MARK_ACTION_FIELDS,
  // 5014 燦：非真實降⅓／弱點傷害／恢復轉百分比／PP上限歸一（DSH 20261018）
  ...CAN_ACTION_FIELDS,
  // 5007 濁：額外精靈召喚／真實傷害疊層／場下消耗／死亡消逝（DSH 20261018）
  ...BRINKK_ACTION_FIELDS,
  // 5019 ᛏ：決鬥／符文激活剝離／下次先制／PP上限歸零（DSH 20261018）
  ...ODIN_ACTION_FIELDS,
  // 5016 械：機甲組合／充能轉傷／異常解析記錄（DSH 20261019）
  ...MECH_ACTION_FIELDS,
  // 纏根：回合吸取對手PP並恢復自身同位（DSH 20261019）
  ...PP_ABSORB_ACTION_FIELDS,
  // 恐懼之種寫入端（blocks/ops/fearSeed.ts；DSH 20261018 第十三批）：全場體力上限吸取／對手在場身分變化。
  ...FEAR_SEED_ACTION_FIELDS,
  // 背包名單統計與登場能力調整（blocks/ops/rosterStats.ts；DSH 20261018 第十三批·第一波，5018 魂印「后」）。
  ...ROSTER_STATS_ACTION_FIELDS,
  ...GROUP1_ACTION_FIELDS,
  ...FINAL_EXTRA_TRAIT_ACTION_FIELDS,
  ...FINAL_MARS_LAN_DRAGON_ACTION_FIELDS,
  ...TYPED_CYCLE_ACTION_FIELDS,
  ...RESOURCE_DEFENSE_FIELDS,
  ...MISSING_HP_SCALING_FIELDS,
  ...REMOVED_EFFECT_FIELDS,
  ...FINAL_ODB_ACTION_FIELDS,
  ...EXTRA_ELF_ACTION_FIELDS,
  ...THUNDER_GOD_ACTION_FIELDS,
  ...GROUP5_ACTION_FIELDS,
  mark_program: MARK_PROGRAM_FIELDS,
  mark_remove_current: [],
  power_per_hp:['side','unit','boost'],
  power_mod:['boost','flat','perMark','perStageLevel','perLevelAmount'],
  power_growth_add:['key','step','cap'],power_growth_apply:['key','baseBoost'],
  power_add_hp_iv:['side','ratio','iv'],damage_cap_turns:['side','dir','kind','cap','capRatio','turns','next'],
  recovery_reduce_turns:['side','ratio','turns','includePotions','next'],
  status_inflict_guard_turns:['side','kind','turns','next'],
  damage_scale:['kind','mult'],vanish_defeated:[],
  dmg_after_action:['base','of','ratio','type'],
  reflect_event_damage:['ratio'],
  recoil: ['ratio'], incoming_utility_invalid_turns:['turns'],
  reflect_received_skill:['ratio','floor','ignoreBlock','ignoreLimit'],
  reflect_received_damage:['ratio','type'],flat_reduction_uses:['uses','flat','kind'],
  timed_uses:['uses','trig','body','label','kind'],ignore_def_action:['stat','ratio'],next_entry_pp_zero:[],pp_zero_selected:[],
  crit_received_turns:['turns','next'],damage_multiplier_turns:['side','dir','kind','mult','turns','next'],consume_shield:[],pp_zero_from_last:['unit'],
  status: ['side','status','turns','chance','chanceIncrement','chanceCap','chanceHpRatio'], status_seq: ['list','chance','side','turns','countFrom','countFailures'], status_random: ['count','cls','per'],
  status_collection:['side','scope','mode','cls','turns'],
  status_or_extend:['side','status','turns','extend'],
  cure_status: ['side','cls'],
  convert_status: ['side','status','turns','from'],
  stat: ['side','stats','v','chance','stats2','side2','v2','hpGapUnit'],
  stat_clear: ['side','kind','captureLevels'], stat_reverse: ['side','kind','transfer','failClear'], stat_steal: ['mode','double','reverse','v','perMark'],
  heal: ['side','ratio','missingRatio'], heal_flat: ['amount'],
  // shield 支援 perMark（每層印記倍率）；見 blocks/runtime.shield。
  shield: ['flat','ratio','base','kind','perMark'],
  heal_collection:['side','scope','amount'],
  pp_op: ['side','mode','amount','stopIfEmpty','kind','captureRestored'],
  drain_from_last:['ratio','type'],
  dmg: ['flat','both','type','elem','base','of','ratio','stepUnit','stepBonus','perStage','perMark','per'], drain: ['flat','cur','ratioCur','ratio','true','ofSelf','perMark','perStatusTurns','basis','per','perStageDown','ppDiffDouble'],
  clear_shield: ['side','kind'], clear_turn: ['side'],
  invalid_turns: ['kind','turns','next','perMarkTurns'], invalid_next: ['kind','uses','followupRounds','followupSameCategory','timerId'],
  no_heal: ['turns','next','scope','perStageKinds'], no_switch: ['turns','next'],
  timed: ['turns','from','trig','body','label','initial','once','onExpire','skillKind','onRoundMiss'],
  dmg_mod: ['dir','kind','boost','reduce','perMark'],
  dmg_mod_turns: ['side','dir','kind','boost','reduce','chance','turns','next','lateCompensation','doubleIfAnyStatus'],
  boost: ['mult','power','kind','chance','add','per','perInc','perLastAmount'], ignore: ['what'], no_resist: [],
  heal_equal: [], dmg_equal: ['type'], dmg_from_last: ['ratio','type','elem','basis'],
  maxhp: ['side','ratio','direction','perStageKinds'],stat_value:['side','stats','amount','direction','floor'],
  // P2：已實作且有讀取端的先制／免疫 op，補上參數合約後放行。
  prio_turns: ['turns','v','attackOnly','side','per','next'],
  noop: ['tag'],
  immune_status_turns: ['turns','reflect','cls','exclude'], immune_status_count: ['count','reflect','scope','persistsOffField'],
  // 「該技能每有1點PP值則先制+N／連擊+N」（使用前PP；5022 無序系）。
  pp_priority: ['perPp'], pp_combo_hits: ['perPp'],
  immune_statdown_turns: ['turns'], immune_attack_count: ['count'],
  // P2 第二批（2026-10-12）：已實作且有讀取端
  vampire: ['ratio','kind'],
  pp_zero: ['kind'],
  dmg_cap_turns: ['turns','cap'],
  at_round_end: ['body','text','originalTarget'],
  // 機率先制／致命等獨立回合效果：有讀取端（damage 公式 critChanceBonus）的通用 op
  crit_bonus_turns: ['turns','bonus','next'],
  // 目標精靈準備（2026-10-12）
  watch: ['key','trig','body','text','actionOnly'], stat_protect_turns: ['turns'], ignore_next: ['what'], heal_reduce_turns: ['turns','ratio'],
  next_entry_status:['status','turns'],
  stop_status_tick:[],
  heal_overflow: ['unit','reduce','shield','kind'], battle_boost: ['inc','cap','kind'],
  // 陣形／印記鎖／每場一次衰變（2026-10-15）：讀取端見 markQueries、battleEventRegistry.transformSkillBeforeResolve、battleEngine.onSkillSelect。
  mark_lock_turns: ['id','turns'],
  close_formation: ['formationId','lockTurns'],
  once_used_degrade: ['key','v'],
  // 資源印記移除（2026-10-15）：依正式 id 清空層數；讀取端 blocks/runtime.resource_mark_remove。
  resource_mark_remove: ['id','side','scope'],
  // 資源印記遞減：與 add 對稱；讀取端 blocks/runtime.resource_mark_subtract。
  resource_mark_subtract: ['id','name','displayChar','unit','scope','side','persistsOffField','description','amount'],
  // 已損失體力比例恢復：基於 maxHp-currentHp；讀取端 blocks/runtime.heal_missing。
  heal_missing: ['side','ratio'],
  // 開啟陣形：與 close_formation 對稱；讀取端 blocks/runtime.open_formation。
  open_formation: ['formationId','name','turns','hpCeiling','reduceLostHpRatio','onClose'],
  switch_lock:['side','turns','next'],
  // 體力設定與待觸發計數（2026-10-15，影之牢籠遷移）：讀取端 blocks/runtime.hp_set、pending_counter。
  hp_set: ['side','value','ratio'],
  pending_counter: ['key','amount','label'],
  // 計數器花用（2026-10-17，劫盡歸塵遷移）：與 pending_counter 同鍵空間；讀取端 blocks/runtime.counter_spend。
  counter_spend: ['key','amount','body','label'],
  // 通用回合鍵寫入（2026-10-15，黯魂印遷移）：寫 *Turns 鍵＋鏡像計時器；讀取端 blocks/runtime.turn_key_set。
  turn_key_set: ['key','turns','side','reason','label'],
  // 陣亡轉贈：寫 nextElf* 標準鍵；讀取端 effects/rules/nextElfPending（blocks/runtime.next_elf_pending）。
  next_elf_pending: ['shield','immunityTurns'],
  next_ally_entry: ['resource','ratio','excludeSource','body','label'],
  // 計數器轉回合鍵（讀取清零＋base 疊加；blocks/runtime.counter_into_turns）。
  counter_into_turns: ['counterKey','turnKey','base','side','reason','label'],
  // 星核系（5032/5033/5034）：獨立 astralContract 模組（協作分工 20261015 預先核准追加）。
  ...ASTRAL_ACTION_FIELDS,
  // legacy_handler（過渡）：原專屬程式唯讀包裝；見 blocks/ops/legacyHandler.ts。
  ...LEGACY_ACTION_FIELDS,
  ...GROUP_C_ACTION_FIELDS,
};
export const SEQUENCE_CONDITION_FIELDS: Record<string, readonly string[]> = {
  ...FINAL_ODB_CONDITION_FIELDS,
  first: [],
  // 無為龍者（arena_12）條件（blocks/ops/arenaShared.ts；DSH 20261018）
  ...ARENA12_CONDITION_FIELDS, last: [], success: [], triggered: [], fail: [],
  has_status: ['side','status','neg'], abnormal: ['side','neg','cls'], stage: ['side','kind','neg'],stage_all:['side','kind','neg'],
  hp_ratio: ['side','op','ratio'], hp_cmp: ['side','op'], hp_full: ['side'], shield: ['side','neg'],
  hp_value:['side','op','amount'],alive:['side'],
  invalid: [], weak: [], type_is: ['side','type','neg'], enemy: ['above'], self_enemy: [],
  // P2 第二批：結果類條件只在傷害結算後的事件可用（見 AFTER_RESULT_TRIGS）；印記層數任何時點可查
  kill: [], nokill: [], crit: [], last_no_dmg: [], has_mark: ['side','name','neg'],
  stab: [], dmg_cmp: ['op','v'],
  // 對手當回合使用過技能（round_end 判讀；非回合事件時讀當前選招僅供監看）
  opp_used_skill: ['neg'],
  // 「當自身處於龍魂時」（次元龍覺醒鍵 dimensionalDragonSoul）。
  dragon_soul: [],
  // 目前所用技能的槽位序（0 起；引擎 skillSlot(elf, skill) 既有讀取端）
  skill_slot: ['index'],
  // 讀取 playerState 的布林／數值鍵（flag_set 等寫入端；通用）
  player_state: ['key', 'equals', 'fallback'],
  // 本回合未受到指定類技能傷害（讀取端 blocks/runtime evalCond：blkSkillDmgTakenRound／blkAttackDmgTakenRound）
  no_skill_dmg: ['kind'],
  // 本回合未受到指定類（固定／百分比）傷害（recordBattleFacts 寫入；殞星衝擊）。
  no_damage_kind: ['kind'],
  // 對手在場期間 PP 曾變化（newElfLifecycle 寫入；變思遷憶 kind3）。
  opp_pp_changed: [],
  // 「處於回合類效果」＝該側存在回合類計時器（5032 變思遷憶／星核脈衝；blocks/runtime hasTurnEffectOn）
  has_turn_effect: ['side','neg'],
  // 本次在場回合數（引擎 âturnsInBattle 計數；op：低於/不高於/高於/不小於/等於）
  field_rounds: ['op', 'amount'],
  // 空間躍遷反擊事實（blockedSkillDamageThisAction）與 payload 布林鍵計時器存在（5032 魂印核）。
  damage_blocked: [],
  timer_active: ['key'],
  resource_crossed:['id','threshold'],
  mark_locked:['side','id'],
  // 「N%機率」：偽隨機（PRD），使用技能時擲一次
  chance: ['pct'],
  pp_full:['neg'],
  stage_value:['side','stat','op','amount'],selected_charge:['side','op','amount'],selected_pp:['side','op','amount'],skill_pp_any:['side','op','amount'], skill_pp_all:['side'],
  atk_gap:['side','op','amount'],
  skill_kind:['kind'],skill_invalid:[],skill_fifth:['neg'],
  // 本次行動失敗原因（invalid／miss／evade／immune；引擎 failAction 寫入 ActionResultInfo.failKind）。
  fail_kind:['kind','neg'],
  alien:['side'],defeated_alien:[],
  last_amount:['op','amount'],
  last_damage_immune:[],
  event_status:['statuses'],
  event_crit:[],
  event_hit:['requireAdditional'],
  mark_count:['side','id','op','amount'],mark_chance:['side','id','pct'],death_node:['node'],
  // 「無視成功時」條件（2026-10-17，剛莖棍壓遷移）：讀 attackImmunityIgnoredThisAction／ignoreDamageLimitSucceededThisAction。
  ignore_success:['what'],
  // 能力互比（blocks/ops/powerStat.ts；DSH 20261017）
  ...POWER_STAT_CONDITION_FIELDS,
  // 能力等級存在查詢（blocks/ops/stageDamage.ts；DSH 20261017）
  ...STAGE_DAMAGE_CONDITION_FIELDS,
  // 事件傷害類型／首擊（blocks/ops/keldSoul.ts；DSH 20261017）
  ...KELD_SOUL_CONDITION_FIELDS,
  // 出戰段數（blocks/ops/entranceStack.ts；DSH 20261017）
  ...ENTRANCE_STACK_CONDITION_FIELDS,
  ...GROUP_A_CONDITION_FIELDS,
  ...GROUP_C_CONDITION_FIELDS,
  ...THUNDER_GOD_CONDITION_FIELDS,
};
/** 「擊敗／未擊敗／致命一擊／對手體力未減少」只在結算後才有意義；在使用技能時判斷會讀到出手前的狀態。 */
const AFTER_RESULT_CONDS = new Set(['kill','nokill','crit','dmg_cmp']);
const AFTER_RESULT_TRIGS = new Set(['after_hit','kill','not_killed','self_after_skill','self_after_attack','self_after_status','self_after_physical','self_after_special']);
export const SEQUENCE_TRIGGERS: Record<string,string> = {
  ...TEAM_KIT_TRIGGERS,
  opp_damaged_skill:'on_opponent_damaged',
  skill_selected:'on_skill_selected',
  attack_hit:'after_attack_hit',
  outgoing_power:'modify_power',incoming_power:'modify_power',
  resource_changed:'on_resource_changed',
  before_instant_kill:'before_instant_kill',
  stat_boost_cleared:'on_stat_boost_cleared',
  turn_effects_cleared:'on_turn_effects_cleared',
  pp_consumed:'pp_consumed',
  pp_cleared:'pp_cleared',
  self_invalid:'on_invalid',
  status_end:'on_status_ended',status_received:'on_status_received',status_immune:'on_status_immunized',status_tick:'before_status_tick',
  fatal:'self_fatal',before_status:'before_status_apply',bench:'opponent_entered',team_round_start:'round_start',
  // 能力等級變更前攔截（引擎 contextBuilders.applyStatChange 派發；5035 藍色龍鱗免疫能力下降）。
  before_stat_change:'before_stat_change',
  use:'on_skill_use', after_hit:'on_hit', on_invalid:'on_invalid', entrance:'on_entered', ally_entered:'ally_entered',
  before_action:'before_action', before_skill:'before_skill', modify_priority:'modify_priority',
  battle_start:'battle_start', round_start:'round_start', round_end:'round_end', phase_end:'battle_phase_end',
  kill:'on_kill',not_killed:'on_not_killed', defeated:'cthyaat_death', switch_out:'on_switch_out', damaged:'on_damaged',
  self_skill:'on_skill_use', opp_skill:'on_attacked', opp_after_skill:'opponent_after_action',
  self_after_use:'after_action', self_after_skill:'after_action', passive:'passive_always', incoming:'before_damage',
  self_attack:'on_skill_use', self_status:'on_skill_use',
  self_after_attack:'after_action',self_after_status:'after_action',self_after_physical:'after_action',self_after_special:'after_action',
  opp_attack:'on_attacked',opp_status:'on_attacked',opp_after_attack:'opponent_after_action',opp_after_status:'opponent_after_action',
  damaged_skill:'on_damaged',damaged_attack:'on_damaged',damaged_true:'on_damaged',damaged_fixed:'on_damaged',damaged_percent:'on_damaged',damaged_nontrue:'on_damaged',
  incoming_skill:'before_damage', incoming_attack:'before_damage', incoming_nontrue:'before_damage',
  outgoing:'before_damage', outgoing_skill:'before_damage', outgoing_attack:'before_damage',
  extra_action_start:'extra_action_start', extra_action_end:'extra_action_end',
};
const object = (v: any): v is Record<string,any> => !!v && typeof v === 'object' && !Array.isArray(v);
const sides = ['self','opp','both','auto','any'];
const compare = ['低於','小於','高於','大於','不低於','不小於','不高於','不大於'];
const timerTriggers=['self_invalid','before_status','round_start','round_end','phase_end','self_skill','self_attack','self_status','self_after_skill','self_after_attack','self_after_status','self_after_physical','self_after_special','opp_skill','opp_attack','opp_status','opp_after_skill','opp_after_attack','opp_after_status','damaged','damaged_attack','damaged_skill','damaged_true','damaged_fixed','damaged_percent','damaged_nontrue','incoming','incoming_attack','incoming_skill','incoming_nontrue','outgoing','outgoing_attack','outgoing_skill','switch_out','kill','defeated','extra_action_start','extra_action_end','turn_effects_cleared','stat_boost_cleared'];
function paramsIssue(value: unknown, fields: readonly string[], path: string, numberLimit=1e6): string | null {
  if (!object(value)) return `${path}需為參數物件`;
  for (const [key,v] of Object.entries(value)) {
    if (!fields.includes(key)) return `${path}.${key}尚無已核對的參數合約`;
    if (v === undefined) continue;
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v)>(key==='value'?numberLimit:1e6))) return `${path}.${key}需為有限數值`;
    if (['side','side2','of'].includes(key) && !sides.includes(v)) return `${path}.${key}目標不明`;
    if (['turns','uses','count','chance','ratio','ratioCur','flat','amount','boost','reduce','mult','cap','rampInc','rampCap','bonus','pct'].includes(key) && (typeof v !== 'number' || v<0)) return `${path}.${key}需為非負數值`;
    if (key === 'chance' && v>100) return `${path}.chance超過100`;
    if (['turns','uses','count'].includes(key) && (!Number.isInteger(v)||v>10000)) return `${path}.${key}需為有限整數期限`;
    if (['v','v2'].includes(key) && path !== 'condition' && (typeof v !== 'number'||!Number.isInteger(v)||Math.abs(v)>6)) return `${path}.${key}需為-6至6能力等級`;
    // next 允許 'auto'（原廠先後手規則：先出手＝當回合生效；後出手＝補償+1回合；20261017 使用者澄清）。
    if (['neg','both','cur','ofSelf','true','double','now','power','attackOnly','reflect','rampStreak','stopIfEmpty','initial','persistsOffField','perStack','consume','lateCompensation','originalTarget','once','requireAdditional','actionOnly','captureLevels','captureRestored','chanceHpRatio'].includes(key) && typeof v !== 'boolean') return `${path}.${key}需為布林值`;
    if (key==='next' && !(typeof v === 'boolean' || v === 'auto')) return `${path}.next需為布林值或auto`;
    if (['ids','stats','stats2','list','statuses','exclude','fields','phase'].includes(key) && (!Array.isArray(v)||!v.length||v.length>30||v.some(x=>typeof x!=='string'||x.length>200))) return `${path}.${key}需為有限名稱陣列`;
    if (key==='cls' && (typeof v!=='string'||!['','控制類','弱化類','限制類','衍化類','附屬類','非附屬類'].includes(v))) return `${path}.cls異常分類不明`;
    if (['label','text'].includes(key) && (typeof v!=='string'||v.length>100000)) return `${path}.${key}需為有限文字`;
    if (typeof v === 'object' && !['ids','terms','stats','stats2','list','statuses','exclude','fields','phase','effects','body','bodyLow','bodyHigh','onMatch','onMismatch','choices','onExpire','onRoundMiss','branches','perStageDown','from','onClose','onBlock','rules','marks','recoveryReduction','incomingDamageReduction','perMark','perMarkTurns','perStage','perStageKinds','perStageLevel','perMarkHits','scaleByMarks','perNonFullPp','keys','sides','types','resources','pool','repeat','fallback'].includes(key)) return `${path}.${key}不接受程式或巢狀行為`;
  }
  return null;
}
/** 包含嚴格的動作白名單，防止舊死鍵/no-op被當作可用積木。 */
export function sequenceIssue(value: unknown, node?: string, depth=0, inMark=false,inSelected=false): string | null {
  if(depth>8)return '持續連鎖超過8層';
  if (!object(value)) return '連鎖需為子句物件';
  if (Object.keys(value).some(k=>!['raw','marker','trig','cond','body','parsed','observer'].includes(k))) return '連鎖包含未支援的子句欄位';
  if (value.observer !== undefined && (!TEAM_KIT_TRIGGERS[value.trig] || !object(value.observer) || Object.keys(value.observer).some(k=>k!=='includeDead') || typeof value.observer.includeDead !== 'boolean')) return '隊伍觀察者需已接通事件及明確死亡後規則';
  if (value.parsed !== true || !SEQUENCE_TRIGGERS[value.trig] || (node && SEQUENCE_TRIGGERS[value.trig]!==node)) return '連鎖觸發尚無等價事件或與節點不符';
  if (typeof value.raw !== 'string'||value.raw.length>100000) return '連鎖原文格式不符';
  if(value.marker!==undefined&&!['■','🎯','◇','>','>>'].includes(value.marker))return '連鎖分類標記不明';
  const conds = (list: any): string | null => {
    if (!Array.isArray(list)||list.length>30) return '條件過多或格式不符';
    for(const c of list) {
      if(!object(c)||Object.keys(c).some(k=>!['c','p','label','neg'].includes(k))||!SEQUENCE_CONDITION_FIELDS[c.c]) return '條件尚無等價查詢';
      // 既有條件引擎只對p.neg作反向；不把未實作的頂層neg吞掉。
      if(c.neg !== undefined && c.neg !== false) return '頂層反向條件尚未接通';
      if(c.label !== undefined && typeof c.label !== 'string')return '條件名稱需為文字';
      const finalIssue=finalOdbConditionIssue(c);if(finalIssue)return finalIssue;
      const issue=paramsIssue(c.p || {},SEQUENCE_CONDITION_FIELDS[c.c],'condition')||groupAConditionIssue(c)||powerStatConditionIssue(c)||stageDamageConditionIssue(c)||keldSoulConditionIssue(c)||entranceStackConditionIssue(c);if(issue)return issue;
      const conditionSides=c.c==='has_status'?['self','opp','both']:c.c==='abnormal'?['self','opp','any']:['stage_any','stage_total'].includes(c.c)?['self','opp','both']:['self','opp'];
      if(SEQUENCE_CONDITION_FIELDS[c.c].includes('side')&&!conditionSides.includes(c.p?.side))return '條件缺少明確持有者';
      if(c.c.startsWith('hp') && c.p?.op && !compare.includes(c.p.op)) return '體力比較運算不明';
      if(c.c==='stage_all'&&!['up','down'].includes(c.p?.kind))return '全部能力查詢需明確上升／下降方向';
      if(['hp_ratio','hp_cmp','hp_value'].includes(c.c) && (!['self','opp'].includes(c.p?.side)||!compare.includes(c.p?.op)))return '體力比較缺少目標或運算';
      if(c.c==='hp_value'&&(!Number.isFinite(c.p?.amount)||c.p.amount<0))return '體力比較需非負有限點數';
      if(c.c==='alive'&&!['self','opp'].includes(c.p?.side))return '存活判定需明確目標';
      if(c.c==='selected_pp'&&(!compare.includes(c.p?.op)||!Number.isInteger(c.p?.amount)||c.p.amount<0))return '所選技能PP比較需明確運算與非負整數';
      if(c.c==='selected_charge'&&(!['self','opp'].includes(c.p?.side)||!compare.includes(c.p.op)||!Number.isInteger(c.p.amount)||c.p.amount<0))return '所選槽充能需明確目標、比較與非負整數';
      if(c.c==='stage_value'&&(!['atk','def','spatk','spdef','speed','accuracy'].includes(c.p?.stat)||!compare.includes(c.p.op)||!Number.isInteger(c.p.amount)||Math.abs(c.p.amount)>6))return '單項能力等級需正式能力名稱、比較及-6至6整數';
      if(c.c==='skill_pp_any'&&(!['self','opp'].includes(c.p.side)||!compare.includes(c.p.op)||!Number.isInteger(c.p.amount)||c.p.amount<0))return '任一技能PP查詢需單一持有者、比較與非負整數';
      if(c.c==='skill_pp_all'&&!['self','opp'].includes(c.p.side))return 'PP均滿查詢需明確陣營';
      if(c.c==='atk_gap'&&(!['self','opp'].includes(c.p.side)||!compare.includes(c.p.op)||!Number.isInteger(c.p.amount)||c.p.amount<0))return '雙攻差值查詢需明確陣營、比較與非負整數';
      if(c.c==='mark_count'&&(typeof c.p?.id!=='string'||!c.p.id||c.p.id.length>200||!compare.includes(c.p.op)||!Number.isInteger(c.p.amount)||c.p.amount<0))return '印記層數需明確識別碼、比較與非負整數';
      if(c.c==='mark_chance'&&(typeof c.p?.id!=='string'||!c.p.id||c.p.id.length>200||!Number.isFinite(c.p.pct)||c.p.pct<0||c.p.pct>100))return '每層機率需明確印記與每層0至100%；實際機率最高100%';
      if(c.c==='death_node'&&(!['kill','not_killed','defeated'].includes(value.trig)||![1,2,3].includes(c.p?.node)))return '死亡節點只能讀正式擊敗／未擊敗／被擊敗事件的1至3節點';
      const groupCCondIssue=groupCConditionIssue(c.c,c.p);if(groupCCondIssue)return groupCCondIssue;
      if(c.c==='hp_ratio'&&typeof c.p?.ratio!=='number')return '體力比較缺少比例';
      if(c.c==='stage'&&!['up','down'].includes(c.p?.kind))return '能力等級條件方向不明';
      if(c.c==='skill_kind'&&!['攻擊','屬性','物理','特殊'].includes(c.p?.kind))return '技能類型條件缺少明確分類';
      if(c.c==='skill_fifth'&&c.p.neg!==undefined&&typeof c.p.neg!=='boolean')return '第五技能查詢反向需為布林值';
      if(c.c==='fail_kind'&&!['invalid','miss','evade','immune'].includes(c.p?.kind))return '出手失敗原因需為無效／未命中／閃避／免疫';
      if(c.c==='skill_invalid'&&value.trig!=='self_invalid')return '無效原因需正式失敗事件';
      if(c.c==='defeated_alien'&&value.trig!=='kill')return '被擊敗者分類需正式擊敗事件';
      if(c.c==='event_crit'&&!value.trig.startsWith('damaged'))return '本次受傷致命一擊需正式受傷事件';
      if(c.c==='event_hit'&&!['self_after_skill','self_after_attack','self_after_status','self_after_physical','self_after_special','opp_after_skill','opp_after_attack','opp_after_status'].includes(value.trig))return '本次命中與附加有效需正式行動結果事件';
      if(['has_status','type_is'].includes(c.c) && typeof c.p?.[c.c==='has_status'?'status':'type']!=='string') return '條件缺少名稱';
      if(AFTER_RESULT_CONDS.has(c.c) && !AFTER_RESULT_TRIGS.has(value.trig) && !(value.trig==='phase_end'&&['kill','nokill'].includes(c.c))) return '擊敗／致命一擊條件需在傷害結算後的事件判斷';
      if(c.c==='has_mark' && (typeof c.p?.name!=='string'||!c.p.name)) return '印記條件缺少名稱';
      if(c.c==='dmg_cmp' && (!compare.includes(c.p?.op)||typeof c.p?.v!=='number')) return '傷害比較缺少運算或數值';
      if(c.c==='last_amount'&&(!compare.includes(c.p?.op)||!Number.isFinite(c.p?.amount)))return '前次結算量比較需運算與有限數值';
      if(c.c==='resource_crossed'&&(value.trig!=='resource_changed'||typeof c.p?.id!=='string'||!c.p.id||!Number.isInteger(c.p.threshold)||c.p.threshold<=0))return '資源跨越需正式變動事件、資源ID及正整數門檻';
      if(c.c==='mark_locked'&&(typeof c.p?.id!=='string'||!c.p.id))return '印記遞減鎖查詢需資源ID';
      if(c.c==='chance' && !(typeof c.p?.pct==='number'&&c.p.pct>0&&c.p.pct<=100)) return '機率條件需為大於0、不超過100的百分比';
      if(c.c==='event_status'&&(!['before_status','status_end','status_received','status_immune','status_tick'].includes(value.trig)||!Array.isArray(c.p?.statuses)))return '本次異常查詢需正式異常事件及明確名稱';
      if(c.c==='ignore_success'&&!['攻擊免疫','傷害限制'].includes(c.p?.what))return '無視成功查詢需明確攻擊免疫或傷害限制';
    }
    return null;
  };
  const header=conds(value.cond || []);if(header)return header;
  if(!Array.isArray(value.body)||!value.body.length||value.body.length>100)return '連鎖需有1至100個分支';
  for(const stmt of value.body) {
    if(!object(stmt)||Object.keys(stmt).some(k=>!['acts','elseActs','cond','chain','live','pre'].includes(k)))return '延遲命中分支需獨立事件入口';
    if(stmt.chain!==undefined&&!['success','fail','any_fail'].includes(stmt.chain))return '未知的結果連鎖';
    if(stmt.live!==undefined&&typeof stmt.live!=='boolean')return '即時條件需為布林值';
    if(stmt.pre!==undefined&&typeof stmt.pre!=='boolean')return '前置快照需為布林值';
    const issue=conds(stmt.cond || []);if(issue)return issue;
    if(!Array.isArray(stmt.acts)||!stmt.acts.length||stmt.acts.length>100)return '連鎖分支需有明確動作';
    if(stmt.elseActs!==undefined&&(!Array.isArray(stmt.elseActs)||stmt.elseActs.length>100))return '否則分支格式不符';
    for(const act of [...stmt.acts,...(stmt.elseActs||[])]) {
      if(!object(act)||Object.keys(act).some(k=>!['op','p','label'].includes(k))||!SEQUENCE_ACTION_FIELDS[act.op])return `動作${act?.op || ''}尚無已核對的可編輯合約`;
      if(act.label !== undefined && typeof act.label !== 'string')return '動作名稱需為文字';
      if(!object(act.p))return '動作需為參數物件';
      const fields=[...SEQUENCE_ACTION_FIELDS[act.op],...(MARK_SCALE_FIELDS[act.op]?['scaleByMarks']:[]),...(['stat','heal','heal_flat','dmg','drain','shield','boost','dmg_mod'].includes(act.op)?['x2If']:[]),
        // 「每次使用額外+N（最高M）」：runAct 依使用次數遞增數值欄位
        ...(['heal','heal_flat','dmg','drain','shield','boost'].includes(act.op)?['rampInc','rampCap','rampStreak','rampReset']:[])];
      const {x2If,...basicParams}=act.p || {};
      const issue=paramsIssue(basicParams,fields,'action',act.op==='maximum_health_lock'?1e9:1e6);if(issue)return issue;
      if(act.p.perStageKinds!==undefined){const issue=stageKindScaleIssue(act.p.perStageKinds,act.op==='no_heal');if(issue)return issue;}
      if(act.op==='no_heal'&&act.p.perStageKinds&&act.p.turns+6*act.p.perStageKinds.amount>10000)return '每種能力加量後禁療期限不得超過10000回合';
      const scaleIssue=actionMarkScaleIssue(act.op,act.p);if(scaleIssue)return scaleIssue;
      if(act.op==='drain'&&act.p.perStatusTurns!==undefined&&(!['self','opp','both'].includes(act.p.perStatusTurns)||!Number.isFinite(act.p.flat)||act.p.flat<=0||act.p.cur!==undefined||act.p.ratio!==undefined||act.p.ratioCur!==undefined||act.p.perMark!==undefined))return '異常回合吸取需明確持有者與固定正點數，不混用其他比例／印記';
      if(act.op==='status_seq'&&(act.p.side!==undefined&&!['self','opp','both'].includes(act.p.side)||act.p.turns!==undefined&&(!Number.isInteger(act.p.turns)||act.p.turns<=0)))return '逐個異常附加需明確目標與正整數期限';
      if(act.op==='power_ratio_turns'&&(!['self','opp'].includes(act.p.side)||!Number.isFinite(act.p.ratio)||act.p.ratio<=0||act.p.ratio>100||!Number.isSafeInteger(act.p.turns)||act.p.turns<1||act.p.turns>10000||typeof act.p.bound!=='boolean'||inMark))return '持續攻擊威力比例需明確持有者、正比例、整數回合及個體綁定選項';
      if(act.op==='drain'&&act.p.basis!==undefined&&(  (act.p.basis==='attack_damage'&&(value.trig!=='after_hit'||act.p.flat!==undefined||act.p.cur||!(act.p.ratio>0)||act.p.perMark||act.p.perStatusTurns))  ||(act.p.basis==='event_damage'&&(!/^damaged/.test(value.trig)||act.p.flat!==undefined||act.p.cur||!(act.p.ratio>0)||act.p.perMark||act.p.perStatusTurns))  ||!['attack_damage','event_damage'].includes(act.p.basis)))return '等量吸取需命中後實際主技能傷害或受傷事件值及正比例';
      if(act.op==='power_mod'&&act.p.perStageLevel===undefined&&!['outgoing_power','incoming_power'].includes(value.trig))return '攻擊威力修正需正式公式前事件與有限正增量';
      if(['power_growth_add','power_growth_apply'].includes(act.op)){
        if(typeof act.p.key!=='string'||!act.p.key||act.p.key.length>100)return '威力成長需有限紀錄鍵';
        if(act.op==='power_growth_add'&&(value.trig!=='before_skill'||!Number.isFinite(act.p.step)||act.p.step<=0||!Number.isFinite(act.p.cap)||act.p.cap<act.p.step||act.p.cap>100))return '威力成長累積需使用前事件、正步進及有限上限';
        if(act.op==='power_growth_apply'&&(value.trig!=='outgoing_power'||!Number.isFinite(act.p.baseBoost)||act.p.baseBoost<0||act.p.baseBoost>100))return '威力成長讀取需公式前事件及有限基礎增幅';
      }
      if(act.op==='power_mod'&&act.p.perStageLevel===undefined&&((act.p.flat===undefined)===(act.p.boost===undefined)||!Number.isFinite(act.p.flat??act.p.boost)||(act.p.flat??act.p.boost)<=0||(act.p.flat??act.p.boost)>1000000))return '攻擊威力修正需有限正增量';
      if(act.op==='power_mod'&&act.p.perStageLevel!==undefined){
        const sq=stageQueryIssue(act.p.perStageLevel);if(sq)return `威力逐級加成：${sq}`;
        if(!Number.isFinite(act.p.perLevelAmount)||act.p.perLevelAmount<=0||act.p.perLevelAmount>1000000)return '每級威力增量需有限正數';
        if(act.p.perStageLevel.side!=='opp'||act.p.perStageLevel.kind!=='up')return '威力逐級加成僅支援對手能力提升等級';
      }
      if(act.op==='heal'&&act.p.missingRatio!==undefined&&(!Number.isFinite(act.p.missingRatio)||act.p.missingRatio<0||act.p.missingRatio>1000000))return '同次恢復的已損失體力比例需有限非負數';
      const closureIssue=closureActionIssue(act.op,act.p);if(closureIssue)return closureIssue;
      const astralIssue=astralActionIssue(act.op,act.p,value.trig,inMark);if(astralIssue)return astralIssue;
      const legacyIssue=legacyActionIssue(act.op,act.p,value,stmt,depth,inMark);if(legacyIssue)return legacyIssue;
      const groupCIssue=groupCActionIssue(act.op,act.p,value.trig,inMark);if(groupCIssue)return groupCIssue;
      if(act.op==='next_ally_entry'){
        if(inMark||!['defeated','switch_out','kill','use','self_skill'].includes(value.trig))return '隊友登場交付需正式死亡／換人／使用事件';
        if(!['none','last_amount','maxHp','currentHp','shield','barrier'].includes(act.p.resource)||!Number.isFinite(act.p.ratio)||act.p.ratio<=0||typeof act.p.excludeSource!=='boolean')return '隊友交付需明確資源快照、正比例及是否排除來源';
        if(act.p.label!==undefined&&(typeof act.p.label!=='string'||act.p.label.length>200))return '隊友交付標籤需有限文字';
        const issue=sequenceIssue({raw:'下次隊友登場子流程',trig:'entrance',parsed:true,body:act.p.body},undefined,depth+1);if(issue)return issue;
      }
      if(act.op==='rebirth_after_ally_turns'&&(inMark||!['use','after_hit','self_skill'].includes(value.trig)||!Number.isSafeInteger(act.p.afterRounds)||act.p.afterRounds<0||act.p.afterRounds>10000||!Number.isFinite(act.p.ratio)||act.p.ratio<=0||act.p.ratio>1))return '接力重生需自身使用事件、有限整數超過回合門檻及0至1的正重生比例';
      if(act.op==='incoming_panel_attack'&&(inMark||value.trig!=='incoming_power'||!Number.isFinite(act.p.ratio)||act.p.ratio<=0||act.p.ratio>100))return '受方公式面板攻擊值需正式受方威力事件與有限正比例';
      if(['pp_max_offset_selected','damage_selected','heal_selected_pp'].includes(act.op)&&!inSelected)return '選取者動作必須位於明確隊員選取子流程';
      if(['astral_select','queue_extra_action'].includes(act.op)){
        // 額外行動使用獨立frame，不能繼承排隊時的selectedElf；集合子流程才提供選定目標。
        const child=sequenceIssue({raw:'集合／額外行動子流程',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark,act.op==='astral_select');
        if(child)return `集合／額外行動：${child}`;
      }
      if(act.op==='attack_type_view_uses'&&(!(act.p.uses>0)||!(act.p.attackType||act.p.targetType)||['attackType','targetType'].some(k=>act.p[k]!==undefined&&!isKnownBattleType(act.p[k]))))return '攻擊屬性視圖需正次數及已知自身／對手屬性';
      if(act.op==='change_type'&&(!['self','opp'].includes(act.p.side)||!isKnownBattleType(act.p.type)||act.p.untilSwitch!==true))return '屬性轉變需明確持有者、已知屬性與下場復原';
      if(act.op==='maxhp'&&(!Number.isFinite(act.p.ratio)||act.p.direction!==undefined&&!['increase','decrease'].includes(act.p.direction)||act.p.direction==='decrease'&&act.p.ratio>1))return '體力上限更改需有限比例與增加／減少方向，減少比例不得超過100%';
      if(act.op==='stat_value'&&(!['self','opp'].includes(act.p.side)||!['increase','decrease'].includes(act.p.direction)||!Number.isInteger(act.p.amount)||act.p.amount<=0||!Number.isInteger(act.p.floor)||act.p.floor<1||!Array.isArray(act.p.stats)||!act.p.stats.length||new Set(act.p.stats).size!==act.p.stats.length||act.p.stats.some((key:string)=>!['hp','atk','def','spatk','spdef','speed'].includes(key))))return '固定能力點數需單一目標、明確六項能力、正整數點數／下限與增減方向';
      if(act.op==='shield'&&(act.p.kind!==undefined&&!['shield','barrier'].includes(act.p.kind)||act.p.base!==undefined&&(!['最大體力','當前體力','已損失體力'].includes(act.p.base)||act.p.flat!==undefined)||!Number.isFinite(act.p.flat??act.p.ratio)||act.p.flat!==undefined&&act.p.ratio!==undefined))return '護盾／護罩需明確種類，固定值或明確體力基數比例擇一';
      if(['snapshot_value','heal_snapshot'].includes(act.op)&&(typeof act.p.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(act.p.key)))return '資源快照需有限明確鍵名';
      if(act.op==='snapshot_value'&&(!['self','opp'].includes(act.p.side)||value.trig!=='round_start'||!Array.isArray(act.p.fields)||!act.p.fields.length||new Set(act.p.fields).size!==act.p.fields.length||act.p.fields.some((key:string)=>!['currentHp','maxHp','shield','barrier'].includes(key))))return '資源快照需回合開始、單一來源及已接通資源欄位';
      if(act.op==='heal_snapshot'&&(!['phase_end','round_end'].includes(value.trig)||!(act.p.ratio>0)||typeof act.p.consume!=='boolean'))return '快照恢復需階段末／回合末、正比例及明確消耗規則';
      // traitText 模式：依「特性描述是否含指定效果」統計（不需精確名稱）；其餘需精確名稱。
      if(act.op==='count_team_trait'){
        if(!['self','opp','both'].includes(act.p.side)||!['any','alive','dead'].includes(act.p.state))return '特質計數需背包陣營與存活範圍';
        if(act.p.traitText!==undefined){
          if(act.p.traitText!=='lowChanceStatus')return '特質文字判定僅支援低機率異常附加';
        }else if(typeof act.p.name!=='string'||!act.p.name||act.p.name.length>200)return '特質計數需精確特質名稱';
      }
      if(act.op==='select_elf'){
        if(act.p.all!==undefined&&typeof act.p.all!=='boolean')return '集合全選選項需布林值';
        if(!['self','opp'].includes(act.p.side)||!['team','bench'].includes(act.p.scope)||!['any','alive','dead'].includes(act.p.state)||!['max_hp','team_order'].includes(act.p.orderBy)||!['asc','desc'].includes(act.p.direction))return '集合選取需陣營、場下／全隊、存活範圍及確定排序';
        const issue=sequenceIssue({raw:'選定隊員子流程',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark,true);if(issue)return `集合選取：${issue}`;
      }
      if(inSelected&&!['raise_max_hp','heal_selected_then','stat_points','vanish_selected','pp_max_offset_selected','damage_selected','heal_selected_pp'].includes(act.op))return '選定隊員子流程只接受綁定目標的正式數值／恢復／消逝動作';
      if(['raise_max_hp','heal_selected_then','stat_points','vanish_selected'].includes(act.op)&&!inSelected)return '此動作需在選定隊員子流程內執行';
      if(act.op==='raise_max_hp'&&(!['self','opp'].includes(act.p.source)||!(act.p.ratio>0)))return '體力上限提升需明確來源與正比例';
      if(act.op==='heal_selected_then'){
        if(!(act.p.ratio>0))return '選定隊員恢復需正比例';
        const issue=sequenceIssue({raw:'選定隊員恢復結算後',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark,true);if(issue)return issue;
      }
      if(act.op==='stat_points'&&(!['increase','decrease'].includes(act.p.direction)||!(act.p.ratio>0)||!Number.isInteger(act.p.cap)||act.p.cap<0||!Number.isInteger(act.p.floor)||act.p.floor<1||!Array.isArray(act.p.stats)||!act.p.stats.length||new Set(act.p.stats).size!==act.p.stats.length||act.p.stats.some((k:string)=>!['atk','def','spatk','spdef','speed'].includes(k))))return '能力點數更改需五項非體力數值、方向、正比例及整數上限／下限';
      if(act.op==='stat_apply_last'&&(!['self','opp'].includes(act.p.side)||!['same','opposite'].includes(act.p.direction)))return '能力結算量附加需明確目標與同向／反向';
      if(act.op==='next_entry_priority'&&(value.trig!=='kill'||!Number.isInteger(act.p.turns)||act.p.turns<=0))return '下隻先制失效需正式擊敗事件與正整數期限';
      if(act.op==='power_per_hp'&&(!['self','opp'].includes(act.p.side)||!(act.p.unit>0&&act.p.unit<=1)||!(act.p.boost>0)||!['use','self_skill','self_attack'].includes(value.trig)))return '體力比例威力需正比例單位、增量及使用事件';
      if(act.op==='power_add_hp_iv'&&(!['self','opp'].includes(act.p.side)||!(act.p.ratio>0)||!['hp','atk','def','spatk','spdef','speed'].includes(act.p.iv)||!['use','self_skill','self_attack'].includes(value.trig)))return '體力上限威力加值需基數、比例、自身個體項及使用事件';
      if(act.op==='damage_cap_turns'&&(!['self','opp'].includes(act.p.side)||!['in','out'].includes(act.p.dir)||!['攻擊','技能','非真實','固定','百分比'].includes(act.p.kind)||!(act.p.turns>0)||( !Number.isFinite(act.p.cap)&&!(Number.isFinite(act.p.capRatio)&&act.p.capRatio>0&&act.p.capRatio<=1) )||act.p.cap<0))return '傷害上限需持有者、方向、傷害類別、期限及有限或0至100%比例上限';
      if(act.op==='damage_to_heal_turns'&&(!(act.p.turns>0)||!['攻擊','技能','非真實','固定','百分比'].includes(act.p.kind)))return '傷害轉療需正整數期限及明確非真實傷害範圍';
      if(act.op==='recovery_reduce_turns'&&(!['self','opp'].includes(act.p.side)||!(act.p.ratio>0&&act.p.ratio<=1)||!(act.p.turns>0)||typeof act.p.includePotions!=='boolean'))return '回復減少需持有者、比例、期限及藥劑範圍';
      if(act.op==='status_inflict_guard_turns'&&(!['self','opp'].includes(act.p.side)||!['all','攻擊','屬性','物理','特殊'].includes(act.p.kind)||!Number.isInteger(act.p.turns)||act.p.turns<=0))return '異常施加限制需單一持有者、技能類型或全部來源與正整數期限';
      if(act.op==='heal_collection'&&(!['self','opp'].includes(act.p.side)||!['bench','team'].includes(act.p.scope)||!Number.isInteger(act.p.amount)||act.p.amount<=0))return '集合恢復需單一陣營、場下／全隊範圍與正整數點數';
      if(act.op==='damage_scale'&&(!['outgoing','outgoing_skill','outgoing_attack'].includes(value.trig)||!['','攻擊','技能','非真實','固定','百分比','真實'].includes(act.p.kind)||!(act.p.mult>0)))return '獨立傷害倍率需造成傷害事件、類別與正倍率';
      if(act.op==='vanish_defeated'&&value.trig!=='kill')return '消逝被擊敗者需正式擊敗事件';
      if(!['status_collection','cure_status'].includes(act.op)&&act.p.cls!==undefined&&!['','控制類','弱化類','非附屬類'].includes(act.p.cls))return '此動作的異常分類尚無讀取端';
      if(act.op==='status_collection'&&(!['self','opp','both'].includes(act.p.side)||!['active','team'].includes(act.p.scope)||!['current','class'].includes(act.p.mode)||!['','控制類','弱化類','限制類','衍化類','附屬類'].includes(act.p.cls)||!Number.isInteger(act.p.turns)||act.p.turns<=0||act.p.mode==='current'&&act.p.cls!==''))return '異常集合需明確目標、在場／全隊範圍、目前／分類來源與期限';
      if(act.op==='status'&&(act.p.chanceIncrement!==undefined||act.p.chanceCap!==undefined)&&(!(act.p.chanceIncrement>0&&act.p.chanceIncrement<=100)||!(act.p.chanceCap>=(act.p.chance ?? 100)&&act.p.chanceCap<=100)||!['use','self_skill','self_attack','self_status'].includes(value.trig)))return '機率成長需正增量、百分比上限及自身使用事件';
      // 體力百分比機率（「有等同於自身體力當前百分比機率…」；5018 后）：以持有者當前體力百分比為機率，不與機率成長混用。
      if(act.op==='status'&&act.p.chanceHpRatio===true&&(act.p.chanceIncrement!==undefined||act.p.chanceCap!==undefined))return '體力百分比機率不支援機率成長';
      if(['abolish_selected','consume_selected_pp'].includes(act.op)&&(!['self','opp'].includes(act.p.side)||!['use','self_skill','self_attack','self_status'].includes(value.trig)))return '所選槽變更需明確持有者與使用事件';
      if(act.op==='heal_then'){
        if(!['self','opp'].includes(act.p.side)||!(act.p.ratio>0)||!['use','self_skill','self_attack','self_status','self_after_use','round_end'].includes(value.trig))return '恢復後連鎖需明確目標、正比例及自身使用事件';
        const issue=sequenceIssue({raw:'恢復結算後連鎖',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark);if(issue)return `恢復結算後連鎖：${issue}`;
      }
      if(act.op==='resource_mark_add'){
        if(value.trig==='resource_changed')return '資源變動反應不能直接遞迴增加資源';
        if(act.p.maxCount!==undefined&&(!Number.isSafeInteger(act.p.maxCount)||act.p.maxCount<1||act.p.maxCount>1000000))return '資源上限需1至1000000整數';
        const literal=act.p.amount!==undefined;
        if(literal ? act.p.ratio!==undefined||!Number.isSafeInteger(act.p.amount)||act.p.amount<=0 : !(act.p.ratio>0))return '資源印記需擇一指定正整數固定量或上一結算量正比例';
        if(!['self','opp'].includes(act.p.side)||!['elf','team'].includes(act.p.scope)||typeof act.p.persistsOffField!=='boolean'||!['層','道','點','篇','枚','株','回合'].includes(act.p.unit))return '資源印記需明確持有者、作用域、保留規則與單位';
        for(const key of ['id','name','displayChar','description'])if(typeof act.p[key]!=='string'||!act.p[key]||act.p[key].length>(key==='description'?100000:200))return '資源印記需完整有限文字欄位';
        if(act.p.incomingDamageReduction!==undefined){
          const issue=markDamageReductionIssue(act.p.incomingDamageReduction);if(issue)return issue;
        }
      }
      if(act.op==='mark_lock_turns'&&(typeof act.p.id!=='string'||!act.p.id||act.p.id.length>200||!Number.isSafeInteger(act.p.turns)||act.p.turns<1||act.p.turns>1000000))return '印記遞減鎖需有限識別碼及正整數期限';
      if(['resource_mark_subtract','resource_mark_remove'].includes(act.op)&&(typeof act.p.id!=='string'||!act.p.id||act.p.id.length>200||!['self','opp'].includes(act.p.side)||!['elf','team'].includes(act.p.scope)||act.op==='resource_mark_subtract'&&(!Number.isSafeInteger(act.p.amount)||act.p.amount<1||act.p.amount>1000000)))return '資源遞減／移除需有限識別碼、單一持有者、作用域及正整數減量';
      if(act.op==='type_damage_floor_turns'&&(!['self','opp'].includes(act.p.side)||!Number.isFinite(act.p.base)||act.p.base<=0||act.p.base>1e6||!Number.isSafeInteger(act.p.turns)||act.p.turns<1||act.p.turns>10000||!Array.isArray(act.p.list)||act.p.list.length<1||act.p.list.length>12||!act.p.list.every((t:any)=>typeof t==='string'&&t.split('.').length<=2&&t.split('.').every(isKnownBattleType)&&new Set(t.split('.')).size===t.split('.').length)||new Set(act.p.list).size!==act.p.list.length||inMark))return '克制保底需明確目標、正基數、整數回合與不重複的已知屬性';
      if(act.op==='damage_floor'&&(value.trig!=='outgoing_attack'||!['self','opp'].includes(act.p.side)||!['最大體力','全隊體力上限'].includes(act.p.base)||!(act.p.ratio>0)))return '攻擊保底需正式造成攻擊傷害前、明確基數與正比例';
      if(act.op==='block_damage'&&!['incoming','incoming_skill','incoming_attack','incoming_nontrue'].includes(value.trig))return '抵擋只能在受到傷害前登記';
      if(GROUP_B_ACTION_FIELDS[act.op]){const issue=groupBActionIssue(act.op,act.p,value.trig,(body,trig)=>sequenceIssue({raw:'下隻登場交付子流程',trig,parsed:true,body},undefined,depth+1));if(issue)return issue;}
      if(ITEM_USE_ACTION_FIELDS[act.op]){const issue=itemUseActionIssue(act.op,act.p);if(issue)return issue;}
      if(POWER_STAT_ACTION_FIELDS[act.op]){const issue=powerStatActionIssue(act.op,act.p);if(issue)return issue;}
      if(ENTRANCE_STACK_ACTION_FIELDS[act.op]){const issue=entranceStackActionIssue(act.op,act.p);if(issue)return issue;}
      if(STAGE_DAMAGE_ACTION_FIELDS[act.op]){const issue=stageDamageActionIssue(act.op,act.p);if(issue)return issue;}
      if(KELD_SOUL_ACTION_FIELDS[act.op]){const issue=keldSoulActionIssue(act.op,act.p,(body,trig)=>sequenceIssue({raw:'減免分支主體',trig,parsed:true,body},undefined,depth+1,inMark));if(issue)return issue;}
      const sovereigntyIssue=statusSovereigntyActionIssue(act.op,act.p);if(sovereigntyIssue)return sovereigntyIssue;
      const priorityBonusIssue=priorityBonusActionIssue(act.op,act.p,value.trig);if(priorityBonusIssue)return priorityBonusIssue;
      if(ARENA_SHARED_ACTION_FIELDS[act.op]){const issue=arenaSharedActionIssue(act.op,act.p,(body,trig)=>sequenceIssue({raw:'隨機分支主體',trig,parsed:true,body},undefined,depth+1,inMark));if(issue)return issue;}
      if(HP_STEPS_ACTION_FIELDS[act.op]){const issue=hpStepsIssue(act.op,act.p);if(issue)return issue;}
      if(ARENA12_ACTION_FIELDS[act.op]){const issue=arena12ActionIssue(act.op,act.p);if(issue)return issue;}
      if(HOLY_MILES_ACTION_FIELDS[act.op]){const issue=holyMilesActionIssue(act.op,act.p,(body,trig)=>sequenceIssue({raw:'迴圈主體',trig,parsed:true,body},undefined,depth+1,inMark),value.trig);if(issue)return issue;}
      if(FEAR_SEED_ACTION_FIELDS[act.op]){const issue=fearSeedActionIssue(act.op,act.p);if(issue)return issue;}
      if(ROSTER_STATS_ACTION_FIELDS[act.op]){const issue=rosterStatsActionIssue(act.op,act.p,value.trig);if(issue)return issue;}
      if(GROUP1_ACTION_FIELDS[act.op]){const issue=group1ActionIssue(act.op,act.p,value.trig,(body,trig)=>sequenceIssue({raw:'組1子流程',trig,parsed:true,body},undefined,depth+1,inMark));if(issue)return issue;}
      if(FINAL_EXTRA_TRAIT_ACTION_FIELDS[act.op]){const issue=finalExtraTraitActionIssue(act.op,act.p);if(issue)return issue;}
      if(FINAL_MARS_LAN_DRAGON_ACTION_FIELDS[act.op]){const issue=finalMarsLanDragonActionIssue(act.op,act.p,(body,trig)=>sequenceIssue({raw:'末批子流程',trig,parsed:true,body},undefined,depth+1,inMark),value.trig);if(issue)return issue;}
      if(TYPED_CYCLE_ACTION_FIELDS[act.op]){const issue=typedCycleActionIssue(act.op,act.p,value.trig,(body,trig)=>sequenceIssue({raw:'屬性循環子流程',trig,parsed:true,body},undefined,depth+1,inMark));if(issue)return issue;}
      if(RESOURCE_DEFENSE_FIELDS[act.op]){const issue=resourceDefenseIssue(act.op,act.p,value.trig,body=>sequenceIssue({raw:'資源消耗副作用',trig:value.trig,parsed:true,body},undefined,depth+1,inMark));if(issue)return issue;}
      if(MISSING_HP_SCALING_FIELDS[act.op]){const issue=missingHpScalingIssue(act.op,act.p,value.trig);if(issue)return issue;}
      if(REMOVED_EFFECT_FIELDS[act.op]){const issue=removedEffectIssue(act.op,act.p,value.trig);if(issue)return issue;}
      if(FINAL_ODB_ACTION_FIELDS[act.op]){const issue=finalOdbActionIssue(act.op,act.p);if(issue)return issue;}
      if(act.op==='skill_marks_assign')for(const mark of act.p.marks||[]){
        if(Object.keys(mark).some(k=>!['symbol','description','rules','capabilities','strip'].includes(k)))return '技能印記包含未知欄位';
        const caps=mark.capabilities||{};
        for(const [key,v]of Object.entries(caps)){
          if(['statMultiplier','nonTrueOutputMultiplier'].includes(key)){if(!Number.isFinite(v)||Number(v)<=0||Number(v)>10)return '印記倍率不合法';}
          else if(key==='priorityCeiling'){if(!Number.isInteger(v)||Number(v)<0||Number(v)>20)return '先制上限不合法';}
          else if(!['innateDisabled','statusImmune','opponentBoostDisabled','suppressBenchEffects','sureHit','forceHitEffects','ppUnrestricted','opponentKillDisabled','mirrorOpponentSlot','shieldsBlocked','notKilledDisabled'].includes(key)||typeof v!=='boolean')return '印記能力尚無已核對讀取端';
        }
        if(mark.strip){const issue=finalOdbActionIssue('skill_marks_strip',{side:'self',...mark.strip});if(issue)return issue;}
        for(const rule of mark.rules){const {activationOnly,...clause}=rule;if(activationOnly!==undefined&&(typeof activationOnly!=='boolean'||rule.trig!=='skill_selected'))return '激活限定規則需選招事件';const issue=sequenceIssue(clause,undefined,depth+1,true);if(issue)return issue;}
      }
      if(act.op==='portable_mark')for(const rule of act.p.rules||[]){const issue=sequenceIssue(rule,undefined,depth+1,true);if(issue)return issue;}
      if(EXTRA_ELF_ACTION_FIELDS[act.op]){const issue=extraElfActionIssue(act.op,act.p);if(issue)return issue;}
      if(THUNDER_GOD_ACTION_FIELDS[act.op]){const issue=thunderGodActionIssue(act.op,act.p,value.trig);if(issue)return issue;}
      if(GROUP5_ACTION_FIELDS[act.op]){const issue=group5ActionIssue(act.op,act.p,(body,trig)=>sequenceIssue({raw:'子流程主體',trig,parsed:true,body},undefined,depth+1,inMark),value.trig);if(issue)return issue;}
      if(act.op==='block_damage_uses') {
        if(!(act.p.uses>0)||!['攻擊','技能'].includes(act.p.kind)||typeof act.p.key!=='string'||!act.p.key||act.p.key.length>200||!['use','self_skill','self_attack','self_status','on_invalid','entrance'].includes(value.trig))return '次數抵擋需正次數、攻擊／技能範圍、計數鍵及使用時入口';
        if(act.p.onBlock!==undefined){const issue=sequenceIssue({raw:'抵擋成功反應',trig:act.p.kind==='攻擊'?'incoming_attack':'incoming_skill',parsed:true,body:act.p.onBlock},undefined,depth+1);if(issue)return `抵擋成功反應：${issue}`;}
      }
      if(act.op==='status_replace'&&value.trig!=='before_status')return '替換本次異常只能在附加前執行';
      if(act.op==='pp_op'&&act.p.captureRestored&&(!['recover','add'].includes(act.p.mode)||act.p.stopIfEmpty))return '實際恢復PP計量只接受恢復操作，不混用耗盡阻止行動';
      if(act.op==='drain_from_last'&&(!(act.p.ratio>0)||!['固定','百分比','真實'].includes(act.p.type)))return '前筆數值吸取需正比例與明確固定／百分比／真實傷害';
      if(act.op==='dmg_of_event'&&!['damaged','damaged_skill','damaged_attack','damaged_true','damaged_fixed','damaged_percent','damaged_nontrue'].includes(value.trig))return '事件傷害需受到傷害後的正式傷害資料';
      if(inMark && !['status_duration_floor','held_resources_damage','drain_to_opponent','skill_mark_pp_match','status_collection','hp_adjust','heal','heal_flat','stat','stat_clear','stat_reverse','cure_status','status','status_seq','convert_status','dmg','drain','dmg_mod','pp_op','pp_zero','pp_zero_random','clear_shield','clear_turn','stat_mirror','pp_lost_damage','heal_equal','heal_opp_equal','dmg_equal','dmg_from_last','dmg_of_event','mark_remove_current','portable_mark_transfer','noop'].includes(act.op))return '印記規則只能使用同步結算動作，不能留下脫離印記的計時／額外行動';
      if(act.op==='mark_remove_current'&&!inMark)return '移除目前印記需持有者印記程式上下文';
      if(act.op==='recoil'&&(!(act.p.ratio>0&&act.p.ratio<=1)||!['self_after_attack','self_after_skill'].includes(value.trig)))return '反作用體力扣減需0至100%比例與自身行動後事件';
      if(act.op==='incoming_utility_invalid_turns'&&(!Number.isInteger(act.p.turns)||act.p.turns<=0))return '對持有者使用的屬性技能無效需正整數期限';
      if(act.op==='reflect_received_skill'&&(!(act.p.ratio>0)||typeof act.p.floor!=='boolean'||typeof act.p.ignoreBlock!=='boolean'||typeof act.p.ignoreLimit!=='boolean'||!['use','self_skill','self_attack'].includes(value.trig)))return '技能受傷反饋需明確比例、保底／抵擋／上限與使用時事件';
      if(act.op==='reflect_received_damage'&&(!(act.p.ratio>0)||!['技能','固定','百分比','真實'].includes(act.p.type)||!['use','self_skill','self_attack'].includes(value.trig)))return '全部受傷反饋需比例、明確傷害類型及使用事件';
      if(act.op==='reflect_event_damage'&&(!(act.p.ratio>0)||!value.trig.startsWith('damaged')))return '本次傷害反彈需正比例與正式受傷事件';
      if(act.op==='flat_reduction_uses'&&(!Number.isInteger(act.p.uses)||act.p.uses<=0||!(act.p.flat>0)||!['','非真實','攻擊','技能','固定','百分比'].includes(act.p.kind)))return '固定點數防護需次數、減少值與非真實傷害範圍';
      if(act.op==='crit_received_turns'&&(!Number.isInteger(act.p.turns)||act.p.turns<=0))return '受攻擊必定致命一擊需回合期限';
      if(act.op==='damage_multiplier_turns'&&(!['self','opp'].includes(act.p.side)||!['in','out'].includes(act.p.dir)||!['攻擊','技能','非真實','固定','百分比'].includes(act.p.kind)||!Number.isInteger(act.p.turns)||act.p.turns<=0||!(act.p.mult>0)))return '持續傷害倍率需目標、方向、非真實範圍、期限及正倍率';
      if(act.op==='pp_zero_from_last'&&!(act.p.unit>0))return '前次消耗量轉PP清空需正換算單位';
      if(act.op==='next_entry_pp_zero'&&value.trig!=='kill')return '下隻登場PP清空需擊敗事件';
      if(act.op==='pp_zero_selected'&&!['opp_skill','opp_attack','opp_status','opp_after_skill','opp_after_attack','opp_after_status'].includes(value.trig))return '指定對手使用槽需正式對手使用事件';
      if(act.op==='timed_uses'){
        if(!Number.isInteger(act.p.uses)||act.p.uses<=0||!timerTriggers.includes(act.p.trig))return '事件次數容器需正整數次數與正式觸發';
        if(act.p.kind!==undefined&&(!['攻擊','物理','特殊','屬性'].includes(act.p.kind)||! /^(self|opp)(_after)?_(skill|attack|status|physical|special)$/.test(act.p.trig)))return '分類次數監控需明確技能類型與技能使用事件';
        const issue=sequenceIssue({raw:'事件次數監控',trig:act.p.trig,parsed:true,body:act.p.body},undefined,depth+1);if(issue)return `事件次數監控：${issue}`;
      }
      if(act.op==='ignore_def_action'&&(!['防禦','特防','雙防'].includes(act.p.stat)||!(act.p.ratio>0&&act.p.ratio<=1)||!['use','self_skill','self_attack','self_status'].includes(value.trig)))return '本次忽略防禦需明確防禦項、0至100%比例與使用事件';
      if(act.p.perStack && !inMark)return '按印記層數結算只能存在於持有者印記程式內';
      if(act.op==='mark_program') {
        if(inMark)return '印記規則不能遞迴產生印記程式';
        const issue=markProgramIssue(act.p);if(issue)return issue;
        for(const rule of act.p.rules){const issue=sequenceIssue(rule,undefined,depth+1,true);if(issue)return `印記規則：${issue}`;}
      }
      if(act.op==='status_guard'&&value.trig!=='before_status')return '常駐異常防護必須在附加前查詢';
      if(act.op==='stop_status_tick'&&value.trig!=='status_tick')return '阻止異常扣減只能修改本次扣減前請求';
      if(act.op==='survive'&&value.trig!=='fatal')return '致死存活只能在致死節點執行';
      if(['once','once_per_round'].includes(act.op)) {
        const issue=sequenceIssue({raw:'一次性容器',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark);
        if(issue)return `一次性容器：${issue}`;
      }
      if(act.op==='counter_spend'){
        if(typeof act.p.key!=='string'||!act.p.key||act.p.key.length>200)return '計數花用需穩定有限識別碼';
        if(!Number.isInteger(act.p.amount)||act.p.amount<=0)return '計數花用需正整數點數';
        const issue=sequenceIssue({raw:'計數花用主體',trig:value.trig,parsed:true,body:act.p.body},undefined,depth+1,inMark);
        if(issue)return `計數花用主體：${issue}`;
      }
      if(x2If!==undefined) {
        if(!fields.includes('x2If'))return '此動作尚無效果翻倍的完整定義';
        const issue=conds([x2If]);if(issue)return `翻倍條件：${issue}`;
      }
      if(['heal','stat_reverse','maxhp'].includes(act.op)&&!['self','opp'].includes(act.p.side))return '此動作需單一明確目標';
      if(act.op==='pp_op'&&(!['self','opp'].includes(act.p.side)||!['add','reduce','zero','recover','drain'].includes(act.p.mode)))return 'PP操作目標或模式不明';
      if(act.op==='pp_op'&&['add','reduce','drain'].includes(act.p.mode)&&(!Number.isInteger(act.p.amount)||act.p.amount<0))return 'PP操作需非負整數點數';
      if(['status','cure_status','clear_shield','stat_clear','clear_turn'].includes(act.op)&&!['self','opp','both'].includes(act.p.side))return '此動作目標不明';
      if(act.op==='clear_shield' && !['shield','barrier','both'].includes(act.p.kind ?? 'shield'))return '清除護盾／護罩範圍不明';
      if(act.op==='convert_status'&&(!['self','opp'].includes(act.p.side)||typeof act.p.status!=='string'||!act.p.status||!(act.p.turns>0)))return '異常轉化需單一目標、名稱與期限';
      if(act.op==='convert_status'&&act.p.from!==undefined&&(typeof act.p.from!=='string'||!act.p.from||act.p.from===act.p.status))return '指定轉化需不同的來源與目標異常';
      if(act.op==='status_or_extend'&&(!['self','opp','both'].includes(act.p.side)||typeof act.p.status!=='string'||!act.p.status||!Number.isInteger(act.p.turns)||act.p.turns<=0||!Number.isInteger(act.p.extend)||act.p.extend<=0))return '異常延長／附加需目標、名稱、正整數初始期限與延長量';
      if(act.op==='stat'&&!['self','opp','both','auto'].includes(act.p.side))return '能力變化目標不明';
      if(act.op==='stat'&&act.p.hpGapUnit!==undefined&&(!['self','opp'].includes(act.p.side)||!Number.isInteger(act.p.hpGapUnit)||act.p.hpGapUnit<=0||!Number.isInteger(act.p.v)||act.p.v<1||act.p.stats2!==undefined))return '體力差強化需單一目標、正整數單位及正能力等級';
      if(act.op==='switch_lock'&&(!['self','opp'].includes(act.p.side)||!Number.isInteger(act.p.turns)||act.p.turns<=0))return '切換限制需明確持有者與正整數期限';
      if(act.op==='body_maxhp_resource_loss'&&(inMark||!['self','opp'].includes(act.p.side)||!Number.isFinite(act.p.unit)||act.p.unit<=0||!Number.isSafeInteger(act.p.cap)||act.p.cap<1||act.p.cap>1000000||typeof act.p.resourceId!=='string'||!(/^[a-zA-Z][a-zA-Z0-9_.:-]{0,119}$/).test(act.p.resourceId)))return '體重對上限及資源扣除需明確個體、有限正單位、整數上限及資源印記識別碼';
      if(act.op==='stat_floor_opponent'&&inMark)return '能力調整需明確自身技能入口';
      if(act.op==='hp_set'&&(!['self','opp'].includes(act.p.side)||( !Number.isInteger(act.p.value)&&!(Number.isFinite(act.p.ratio)&&act.p.ratio>0&&act.p.ratio<=1) )))return '體力設定需明確持有者與非負整數或0至100%比例';
      if(act.op==='open_formation'&&(act.p.onClose!==undefined||act.p.hpCeiling!==undefined||act.p.reduceLostHpRatio!==undefined)) {
        if(typeof act.p.formationId!=='string'||!act.p.formationId||!Number.isInteger(act.p.turns)||act.p.turns<=0||!Array.isArray(act.p.onClose)||!act.p.onClose.length)return '陣形生命周期需ID、正整數期限與關閉動作';
        if(act.p.hpCeiling!==undefined&&typeof act.p.hpCeiling!=='boolean')return '傷害體力上限需布林值';
        if(act.p.reduceLostHpRatio!==undefined&&(!Number.isFinite(act.p.reduceLostHpRatio)||act.p.reduceLostHpRatio<0))return '已損失體力減傷需非負有限倍率';
        const issue=sequenceIssue({raw:'陣形關閉',trig:'round_end',parsed:true,body:act.p.onClose},undefined,depth+1);
        if(issue)return `陣形關閉：${issue}`;
      }
      if(act.op==='timed') {
        if(act.p.onRoundMiss!==undefined){
          if(act.p.once || !['self_skill','self_attack','self_status'].includes(act.p.trig))return '每回合未成功分支限重複自身使用監控';
          const missed=sequenceIssue({raw:'本回合未成功',trig:'round_end',parsed:true,body:act.p.onRoundMiss},undefined,depth+1);
          if(missed)return `本回合未成功：${missed}`;
        }
        if(act.p.skillKind!==undefined&&!['攻擊','屬性'].includes(act.p.skillKind))return '監控技能類型限攻擊或屬性';
        if(act.p.initial&&act.p.once)return '一次性監控不支援建立時立即觸發';
        if(act.p.initial && (act.p.from==='next'||!['self_skill','self_attack','self_status'].includes(act.p.trig)))return '初次觸發只適用於當回合起的自身使用監控';
        if(!(act.p.turns>0)||!(timerTriggers.includes(act.p.trig)||act.p.trig==='self_after_use')||!['now','next'].includes(act.p.from??'now'))return '持續連鎖的期限／起算／事件不明';
        if(inMark)return '印記規則的期限由印記持有者管理，不能建立脱離印記的計時器';
        const issue=sequenceIssue({raw:'持續連鎖',trig:act.p.trig,parsed:true,body:act.p.body},undefined,depth+1);
        if(issue)return `持續連鎖：${issue}`;
        if(act.p.onExpire!==undefined){
          if(!act.p.once)return '到期分支需明確一次性監控';
          const expired=sequenceIssue({raw:'自然到期',trig:'round_end',parsed:true,body:act.p.onExpire},undefined,depth+1);
          if(expired)return `自然到期：${expired}`;
        }
      }
      if(act.op==='evade_turns'&&act.p.onExpire!==undefined){
        const expired=sequenceIssue({raw:'閃避自然到期',trig:'round_end',parsed:true,body:act.p.onExpire},undefined,depth+1);
        if(expired)return `閃避到期：${expired}`;
      }
      if(['status','status_seq'].includes(act.op) && !(act.op==='status'?typeof act.p.status==='string':Array.isArray(act.p.list)))return '異常動作缺少名稱';
      if(act.op==='stat' && (!Array.isArray(act.p.stats)||typeof act.p.v!=='number'||!act.p.side))return '能力變化缺少目標／數值';
      if(act.op==='stat'&&[...(act.p.stats||[]),...(act.p.stats2||[])].some(s=>!['全屬性','全能力','所有能力','雙攻','雙防','攻擊','防禦','特攻','特防','速度','命中'].includes(s)))return '能力名稱不明';
      if(act.op==='stat'&&act.p.stats2 && (!act.p.side2||typeof act.p.v2!=='number'))return '第二組能力變化缺少目標／數值';
      if(['stat_clear','stat_reverse'].includes(act.op)&&!['up','down','all'].includes(act.p.kind))return '能力狀態方向不明';
      if(act.op==='stat_steal'&&!['吸取','複製'].includes(act.p.mode))return '能力複製／吸取模式不明';
      if(act.op==='stat_steal'&&(act.p.v!==undefined&&(!Number.isInteger(act.p.v)||act.p.v<1||act.p.v>6)||act.p.perMark!==undefined&&act.p.v===undefined||act.p.reverse&&act.p.v!==undefined))return '定量能力吸取需每項1至6級；逐層基數需明確數量且不可混用反轉';
      if(act.op==='dmg'&&(act.p.stepUnit!==undefined||act.p.stepBonus!==undefined)&&
        (act.p.flat!==undefined||!DAMAGE_BASE_CHOICES.includes(act.p.base)||!['self','opp'].includes(act.p.of)||!Number.isInteger(act.p.stepUnit)||act.p.stepUnit<=0||!Number.isInteger(act.p.stepBonus)||act.p.stepBonus<0))return '階梯附加傷害需明確面板基數、目標、正整數單位及非負整數增量';
      // reverse 只在「吸取」分支有讀取端；複製不得帶 reverse，避免靜默無效參數。
      if(act.op==='stat_steal'&&act.p.reverse&&act.p.mode!=='吸取')return '反轉只適用於吸取對手能力提升';
      if(act.op==='ignore'&&!['傷害限制','抵擋傷害','護盾','能力提升','攻擊免疫','免疫攻擊','免疫','自身能力下降','對手提升視為下降'].includes(act.p.what))return '指定無視尚無正式讀取端';
      if(act.op==='boost'&&(typeof act.p.mult!=='number'||act.p.mult<0 || !['use','self_skill','self_attack','self_status','incoming','incoming_skill','incoming_attack','incoming_nontrue','outgoing','outgoing_skill','outgoing_attack','passive'].includes(value.trig)))return '增傷／威力需要公式前入口';
      if(act.op==='boost'&&act.p.power&&!['use','self_skill','self_attack','self_status'].includes(value.trig))return '威力倍率不能在公式後執行';
      if(act.op==='boost'&&!['攻擊','技能','非真實','固定','百分比','真實',''].includes(act.p.kind??''))return '增傷範圍不明';
      if(['ignore','no_resist'].includes(act.op)&&!['use','self_skill','self_attack','self_status'].includes(value.trig))return '本次攻擊旗標需在技能使用時設定';
      if(['dmg_equal','dmg_from_last'].includes(act.op)&&!['固定','百分比','真實'].includes(act.p.type)&&!(act.op==='dmg_from_last'&&act.p.type==='技能'&&typeof act.p.elem==='string'&&act.p.elem))return '等量傷害類型不明';
      if(act.op==='dmg_from_last'&&!(act.p.ratio>0))return '轉化傷害缺少比例';
      if(act.op==='dmg_from_last'&&act.p.basis!==undefined&&act.p.basis!=='requested_damage')return '轉化傷害快照基準不明';
      if(['dmg','drain','heal','shield'].includes(act.op) && act.p.flat===undefined&&act.p.amount===undefined&&act.p.ratio===undefined&&act.p.ratioCur===undefined&&!(act.op==='drain'&&act.p.perStageDown))return '動作缺少確切數值';
      if(act.op==='dmg'&&!['固定','百分比','真實','技能'].includes(act.p.type))return '傷害類型不明';
      if(act.op==='dmg_sum'){
        const issue=damageTermsIssue(act.p.terms);if(issue)return issue;
        if(!['固定','百分比','真實'].includes(act.p.type))return '合計傷害需明確附加傷害類型';
      }
      if(act.op==='dmg'&&act.p.type==='技能'&&!act.p.elem)return '技能傷害缺少屬性';
      if(act.op==='dmg'&&act.p.base!==undefined&&!DAMAGE_BASE_CHOICES.includes(act.p.base))return '傷害基數未接通';
      if(act.op==='dmg'&&act.p.flat===undefined&&(!act.p.base||!['self','opp'].includes(act.p.of)||typeof act.p.ratio!=='number'))return '比例傷害需基數、持有者與比例';
      if(act.op==='dmg'&&act.p.both&&act.p.flat===undefined)return '雙方比例傷害尚無雙目標結算';
      if(act.op==='dmg_after_action'&&(!['use','self_skill','self_attack','self_status'].includes(value.trig)||!DAMAGE_BASE_CHOICES.includes(act.p.base)||!['self','opp'].includes(act.p.of)||!(act.p.ratio>0)||!['固定','百分比','真實'].includes(act.p.type)))return '行動後快照傷害需使用時入口、基数、持有者、比例與明確類型';
      if(act.op==='instant_kill'&&typeof act.p.chance!=='number')return '秒殺需明確0至100%機率';
      if(act.op==='prevent_instant_kill'&&(value.trig!=='before_instant_kill'||!['in','out'].includes(act.p.dir)||!['self','team'].includes(act.p.scope)))return '禁秒殺需正式前置事件、方向及持有者／陣營範圍';
      if(act.op==='instant_kill_same_hp_targets'&&value.trig!=='before_instant_kill')return '等體力秒殺目標需正式秒殺前置快照';
      if(act.op==='heal_main_settled'&&(!['self_after_attack','self_after_skill'].includes(value.trig)||!(act.p.ratio>0)||act.p.ratio>100||inMark))return '主技能結算量恢復限成功行動後正比例，不能置於印記';
      if(act.op==='next_power_nonfull'&&(value.trig!=='opp_damaged_skill'||!Number.isFinite(act.p.perElf)||act.p.perElf<=0||act.p.perElf>100||!['team','bench'].includes(act.p.scope)||typeof act.p.aliveOnly!=='boolean'||inMark))return '下次威力需正式對手技能受傷事件、正比例、隊伍範圍與存活選項';
      if(act.op==='damage_reduction_steps'&&(!['after_hit','self_after_attack','self_after_skill'].includes(value.trig)||!Number.isSafeInteger(act.p.unit)||act.p.unit<1||act.p.unit>1e6))return '減傷步數需正式主技能結算後與有限正整數單位';
      if(act.op==='match_max_hp'&&(!['self','opp'].includes(act.p.side)||!['self','opp'].includes(act.p.source)||act.p.side===act.p.source||typeof act.p.reduceStats!=='boolean'))return '體力上限對齊需不同來源與受方及明確能力點數扣減選項';
      if(act.op==='status_seq'&&act.p.countFailures!==undefined&&typeof act.p.countFailures!=='boolean')return '異常未觸發數回執需布林值';
      if(act.op==='boost'&&act.p.perLastAmount!==undefined&&(!Number.isFinite(act.p.perLastAmount)||act.p.perLastAmount<=0||act.p.perLastAmount>100))return '逐回執增傷需有限正倍率';
      if(act.op==='peel_types'&&!['self','opp'].includes(act.p.side))return '剝離屬性需單一目標';
      if(act.op==='checked_percent_drain'&&act.p.replaceWithTrue!==undefined&&typeof act.p.replaceWithTrue!=='boolean')return '失敗改真實吸取需布林值';
      if(act.op==='checked_percent_drain'&&(!Number.isFinite(act.p.ratio)||act.p.ratio<=0||act.p.ratio>100||!Number.isSafeInteger(act.p.failTrue)||act.p.failTrue<0||act.p.failTrue>1e6||inMark))return '結算檢查吸取需正比例與有限非負整數追加真傷，不能放在印記規則';
      if(act.op==='drain'&&act.p.cur&&typeof act.p.ratioCur!=='number')return '當前體力吸取缺少比例';
      if(act.op==='dmg'&&act.p.perStage!==undefined){
        const issue=stageQueryIssue(act.p.perStage);if(issue)return issue;
        if(!(Number.isFinite(act.p.flat)&&act.p.flat>0)||['both','base','of','ratio','stepUnit','stepBonus'].some(k=>act.p[k]!==undefined))return '逐能力等級傷害需正固定量及單一查詢基數';
      }
      if(act.op.startsWith('dmg_mod')&&!['攻擊','技能','非真實','固定','百分比','真實',''].includes(act.p.kind??''))return '增減傷範圍不明';
      if(['dmg_mod','dmg_mod_turns'].includes(act.op)&&!['in','in_boost','out','out_reduce','taken'].includes(act.p.dir))return '增減傷方向不明';
      if(act.op==='dmg_mod'&&act.p.dir==='taken')return '即時受到增傷需選in_boost；taken只用於持續效果';
      if(['dmg_mod','drain','dmg','shield','stat_steal','power_mod'].includes(act.op)&&act.p.perMark!==undefined){
        const q=act.p.perMark;
        if(!object(q)||Object.keys(q).some(k=>!['side','id'].includes(k))||!['self','opp'].includes(q.side)||typeof q.id!=='string'||!q.id||q.id.length>200)return '逐層增減傷需明確印記識別碼及單一持有者';
        if(act.op==='drain'&&(!Number.isFinite(act.p.flat)||act.p.flat<=0||['cur','ratio','ratioCur'].some(k=>act.p[k]!==undefined)))return '逐層吸取需正固定量，不能混用百分比基數';
      }
      if(act.op==='dmg_mod_turns'&&(!['in','out','taken','out_reduce'].includes(act.p.dir)||!Number.isInteger(act.p.turns)||act.p.turns<=0))return '持續增減傷方向或期限不明';
      if(['dmg_mod','dmg_mod_turns'].includes(act.op)&&(['in','out_reduce'].includes(act.p.dir)?!Number.isFinite(act.p.reduce):!Number.isFinite(act.p.boost)))return '增減傷方向需對應減傷或增傷數值';
      if(act.op==='dmg_mod_turns'&&act.p.dir==='out_reduce'&&!(act.p.reduce>0&&act.p.reduce<=1))return '持續輸出減傷需大於0、不超過100%';
      if(act.op==='dmg_mod_turns'&&act.p.doubleIfAnyStatus!==undefined&&(act.p.doubleIfAnyStatus!==true||act.p.dir!=='out'))return '雙方異常翻倍僅限持續增傷（輸出）且值為true';
      if(act.op==='dmg_mod_turns'&&act.p.lateCompensation&&(act.p.next||!['in','taken'].includes(act.p.dir)||act.p.side==='opp'))return '後手受傷補償僅限自身當回合起的受傷修正';
      if(act.op==='invalid_turns'&&act.p.perMarkTurns!==undefined){
        const q=act.p.perMarkTurns;
        if(!object(q)||Object.keys(q).some(k=>!['side','id'].includes(k))||!['self','opp'].includes(q.side)||typeof q.id!=='string'||!q.id||q.id.length>200||!Number.isInteger(act.p.turns)||act.p.turns<1)return '印記剩餘回合需明確持有者、識別碼及正整數倍率';
      }
      if(['invalid_turns','invalid_next'].includes(act.op)&&!['攻擊','屬性','all',''].includes(act.p.kind??''))return '技能無效範圍不明';
      if(['invalid_turns','no_heal','no_switch'].includes(act.op)&&!(act.p.turns>0))return '持續效果缺少期限';
      if(act.op==='no_heal'&&act.p.scope!==undefined&&!['all','own_skill'].includes(act.p.scope))return '禁療範圍需全部回復或自身技能回復';
      if(act.op==='invalid_next'&&!(act.p.uses>0))return '次數型無效缺少次數';
      if(act.op==='noop'&&act.p.tag!==undefined&&!/^[（(]?無特殊效果[）)]?$/.test(String(act.p.tag)))return '空動作只允許「無特殊效果」；必中／先制等技能屬性不能用空動作冒充';
      if(act.op==='prio_turns'&&(!(act.p.turns>0)||!Number.isInteger(act.p.v)||act.p.v===0||(act.p.side!==undefined&&act.p.side!=='opp')||(act.p.next!==undefined&&typeof act.p.next!=='boolean')))return '先制回合效果需有期限、非零整數與明確對象';
      if(['immune_status_turns','immune_statdown_turns'].includes(act.op)&&!(act.p.turns>0))return '免疫效果缺少期限';
      if(['pp_combo_hits','pp_priority'].includes(act.op)&&!(Number.isInteger(act.p.perPp)&&act.p.perPp>=1&&act.p.perPp<=100))return 'PP查詢需1至100整數倍率';
      if(act.op==='pp_priority'&&value.trig!=='modify_priority')return 'PP先制需在正式先制判定時查詢';
      if(act.op==='pp_combo_hits'&&value.trig!=='before_skill')return 'PP連擊需在每次正式消耗PP前查詢';
      if(act.op==='immune_status_turns'&&act.p.exclude!==undefined&&(!Array.isArray(act.p.exclude)||act.p.exclude.some((name:any)=>typeof name!=='string'||!StatusRegistry[canonicalStatusName(name)])))return '免疫排除項需已登記的異常名稱列表';
      if(['immune_status_count','immune_attack_count'].includes(act.op)&&!(act.p.count>0))return '次數型免疫缺少次數';
      if(act.op==='immune_status_count'){
        if(!Number.isInteger(act.p.count))return '異常免疫次數需正整數';
        if(act.p.reflect!==undefined&&typeof act.p.reflect!=='boolean')return '異常反彈需布林值';
        if(act.p.scope!==undefined&&!['self','team'].includes(act.p.scope))return '異常免疫範圍需自身或己方全隊';
        if(act.p.persistsOffField!==undefined&&typeof act.p.persistsOffField!=='boolean')return '下場保留需布林值';
        if(act.p.scope==='team'&&act.p.persistsOffField===false)return '己方全隊免疫不能下場清除';
      }
      if(act.p.per!==undefined&&!['self_up_kinds','opp_down_kinds','sides_priority_zero','sides_pp_below_one','sides_lock_switch_effects','opp_pp_sum','sides_pp_sum','sides_full_pp_skills','opp_pp_zero_skills',...GROUP_B_PER_NAMES].includes(act.p.per))return '計數來源不明';
      if(act.p.perInc!==undefined&&(!['sides_pp_below_one','sides_lock_switch_effects','stat_level_unequal_kinds','stat_level_equal_kinds','opp_pp_zero_skills'].includes(act.p.per||'')||!(act.p.perInc>0)||!Number.isFinite(act.p.perInc)))return '每計數增量需計數來源為雙方PP低於1技能數或雙方鎖切換效果數';
      if(act.op==='boost'&&act.p.add!==undefined&&(!act.p.power||!Number.isInteger(act.p.add)||act.p.add<=0||act.p.add>1000))return '威力加值需為威力且為正整數';
      if(act.op==='vampire'&&(!(act.p.ratio>0)||!['攻擊','技能'].includes(act.p.kind)))return '吸血需比例與傷害範圍（攻擊／技能）';
      if(act.op==='pp_op'&&act.p.stopIfEmpty&&(act.p.side!=='opp'||!['reduce','zero','drain'].includes(act.p.mode)))return '「歸0則無法行動」只適用於對手的PP扣除／清空';
      if(act.op==='crit_bonus_turns'&&(!(act.p.turns>0)||!(act.p.bonus>0&&act.p.bonus<=1)))return '致命機率加成需期限與0～1的加成值';
      if(act.op==='pp_zero'&&!['','攻擊','屬性'].includes(act.p.kind??''))return 'PP歸零範圍不明';
      if(act.op==='dmg_cap_turns'&&(!(act.p.turns>0)||!(act.p.cap>=0)))return '受傷上限需期限與上限值';
      if(act.op==='priority_tie_role'&&value.trig!=='modify_priority')return '同速角色需排序前查詢';
      if(RESOURCE_PANEL_FIELDS[act.op]){const issue=resourcePanelIssue(act.op,act.p);if(issue)return issue;}
      if(SUPPORT_ACTION_FIELDS[act.op]){const issue=supportActionIssue(act.op,act.p);if(issue)return issue;}
      if(act.op==='watch') {
        if(act.p.key!==undefined&&(typeof act.p.key!=='string'||!act.p.key||act.p.key.length>100))return '監看識別需有限鍵';
        if(!['held_resource_lost','shield_broken','kill','not_killed','phase_end','self_skill'].includes(act.p.trig))return '監看事件尚未開放';
        if(act.p.actionOnly&&(!['kill','not_killed'].includes(act.p.trig)||!['use','self_skill','self_attack','self_status'].includes(value.trig)))return '本次出手監控限使用時建立的擊敗／未擊敗事件';
        const issue=sequenceIssue({raw:'事件監看',trig:['shield_broken','held_resource_lost'].includes(act.p.trig)?'round_end':act.p.trig,parsed:true,body:act.p.body},undefined,depth+1);
        if(issue)return `事件監看：${issue}`;
      }
      if(act.op==='next_entry_status'&&(value.trig!=='kill'||typeof act.p.status!=='string'||!act.p.status||!(act.p.turns>0)))return '對手下隻登場異常只能由擊敗後節點設定並明確指定期限';
      if(act.op==='stat_protect_turns'&&!(act.p.turns>0))return '保護效果缺少期限';
      if(act.op==='stage_guard_turns'&&(!['up','down'].includes(act.p.kind)||!Number.isInteger(act.p.turns)||act.p.turns<1||act.p.turns>10000))return '能力等級操作保護需明確提升／下降及正整數期限';
      if(act.op==='heal_overflow'&&(!(act.p.unit>0)||(act.p.reduce===undefined&&act.p.shield===undefined)||(act.p.reduce!==undefined&&!(act.p.reduce>0&&act.p.reduce<=1))||(act.p.kind!==undefined&&act.p.kind!=='攻擊')))return '溢出換算需單位、減傷比例或護盾';
      if(act.op==='battle_boost'&&(!(act.p.inc>0)||(act.p.cap!==undefined&&!(act.p.cap>=act.p.inc))||(act.p.kind??'攻擊')!=='攻擊'))return '本場累積增傷需每次增量與上限（目前只限攻擊傷害）';
      if(act.op==='ignore_next'&&act.p.what!=='攻擊免疫')return '下次無視範圍不明';
      if(act.op==='heal_reduce_turns'&&(!(act.p.turns>0)||!(act.p.ratio>0&&act.p.ratio<=1)))return '恢復減少需期限與0至100%';
      if(act.op==='at_round_end') {
        const issue=sequenceIssue({raw:'回合結束時',trig:'round_end',parsed:true,body:act.p.body},undefined,depth+1);
        if(issue)return `回合結束時：${issue}`;
      }
      if(act.p.rampInc!==undefined&&(act.p.rampCap!==undefined&&act.p.rampCap<0))return '遞增上限需非負';
      if(act.p.rampCap!==undefined&&act.p.rampInc===undefined)return '遞增上限缺少每次增量';
      if(act.p.rampReset!==undefined&&(act.p.rampReset!=='switch'||act.p.rampInc===undefined))return '遞增計數重置只接受下場重置，且需有每次增量';
      if(value.trig==='passive'&&!['dmg_mod','legacy_handler','advanced_mechanic','team_stat_anchor','special_attack_panel_formula'].includes(act.op))return '常駐動作需查詢入口，不能每次傷害重播';
    }
  }
  return null;
}
export function sequenceClause(clause: Clause): Clause {
  const clean=(v:any):any=>Array.isArray(v)?v.map(clean):object(v)?Object.fromEntries(Object.entries(v).filter(([,value])=>value!==undefined).map(([key,value])=>[key,clean(value)])):v;
  // 只移除未填欄位；NaN／未知參數仍交由嚴格合約拒絕，不洗成合法的0。
  return clean({raw:clause.raw,marker:clause.marker,trig:clause.trig,cond:clause.cond,body:clause.body,parsed:true});
}

/** 純資料檢查，編輯／首頁不必為了驗證而載入戰鬥執行器。 */
export function skillPropertyIssue(entry: KitEntry): string | null {
  const {property,value,conditions=[]}=entry.params;
  if(property==='combat_stat_extrema'){
    if(!object(value)||Object.keys(value).some(k=>!['attackScale','defenseScale'].includes(k))||![value.attackScale,value.defenseScale].every(n=>Number.isFinite(n)&&n>0&&n<=10))return '雙方能力極值需有限正攻防倍率';
    return skillPropertyIssue({...entry,params:{...entry.params,property:'sure_hit',value:true}});
  }
  if(property==='fixed_type_multiplier'){
    if(!Number.isFinite(value)||value<=0||value>4)return '固定克制需大於0且最高4倍';
    return skillPropertyIssue({...entry,params:{...entry.params,property:'sure_hit',value:true}});
  }
  if(property==='cap_opponent_priority'){
    if(entry.node!=='modify_priority'||value!==true)return '對手先制封頂需排序前布林查詢';
    return skillPropertyIssue({...entry,params:{...entry.params,property:'forced_first',value:true}});
  }
  if(['attack_stat_sum','preferred_types','force_stab'].includes(property)){
    if(Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k)))return '公式查詢包含未知參數';
    if(property==='force_stab'&&value!==true)return '本系加成查詢需為true';
    if(property!=='force_stab'&&(!Array.isArray(value)||value.length<1||value.length>8||new Set(value).size!==value.length||value.some(v=>property==='attack_stat_sum'?!['atk','spatk'].includes(v):!isKnownBattleType(v))))return '公式查詢需不重複的已知能力或屬性';
    return skillPropertyIssue({...entry,params:{property:'sure_hit',value:true,conditions}});
  }
  if(property==='skill_transform')return skillTransformIssue(entry);
  if(property==='ignore_pp_limit')return ppExemptionIssue(entry);
  if(property==='ignore_positive_priority'){
    if(entry.source!=='skill'||entry.role!=='innate'||entry.node!=='modify_priority'||value!==true||Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k)))return '無視對手正先制需排序前固有布林查詢';
    return skillPropertyIssue({...entry,node:'before_skill',params:{property:'sure_hit',value:true,conditions}});
  }
  if(property==='attack_hits'){
    if(entry.node!=='before_skill'||Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k))||!object(value)||Object.keys(value).some(k=>!['min','max'].includes(k))||!Number.isInteger(value.min)||!Number.isInteger(value.max)||value.min<1||value.max<value.min||value.max>100)return '攻擊次數需公式前明確1至100整數範圍';
    return skillPropertyIssue({...entry,params:{...entry.params,property:'sure_hit',value:true}});
  }
  if(property==='stage_power'){
    const issue=stageQueryIssue(entry.params.perStage);if(issue)return issue;
    if(entry.source!=='skill'||entry.role!=='innate'||entry.node!=='before_damage'||!Number.isInteger(value)||value<1||value>1000000||!Array.isArray(conditions)||conditions.length||Object.keys(entry.params).some(k=>!['property','value','conditions','perStage'].includes(k)))return '逐能力等級威力需公式前固有、正整數加值與明確等級查詢';
    return null;
  }
  if(property==='ignore_damage_reduction'){
    if(entry.source!=='skill'||entry.role!=='innate'||entry.node!=='before_damage'||value!==true||Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k)))return '無視受方減傷需攻擊公式前固有布林查詢';
    return skillPropertyIssue({...entry,node:'before_skill',params:{property:'sure_hit',value:true,conditions}});
  }
  if(property==='mark_priority'){
    const q=entry.params.perMark;
    if(!object(q)||Object.keys(q).some(k=>!['side','id'].includes(k))||!['self','opp'].includes(q.side)||typeof q.id!=='string'||!q.id||q.id.length>200)return '逐層先制需明確持有者與印記識別碼';
    if(!Number.isInteger(value)||!value||Math.abs(value)>100||Object.keys(entry.params).some(k=>!['property','value','conditions','perMark'].includes(k)))return '逐層先制需非零整數倍率且不含未知參數';
    return skillPropertyIssue({...entry,params:{property:'base_priority',value,conditions}});
  }
  if(property==='conditional_sure_hit') {
    if(entry.source!=='skill'||entry.role!=='attached'||entry.node!=='before_skill'||value!==true||!conditions.length)return '條件必中需為技能附加、命中前條件查詢';
    return skillPropertyIssue({...entry,role:'innate',params:{...entry.params,property:'sure_hit'}});
  }
  if(property==='conditional_priority') {
    if(entry.source!=='skill'||entry.role!=='attached'||entry.node!=='modify_priority')return '條件先制需為技能附加查詢';
    if(!Number.isInteger(value)||value===0||Math.abs(value)>100)return '條件先制需非零整數';
    // perPPDiff（第五技能PP差逐點先制）：倍率基準本身即條件——不需 conditions（通用讀取端 arenaShared）。
    const ppDiffMode = entry.params.perPPDiff === true;
    if(!ppDiffMode && !conditions.length)return '條件先制需明確條件';
    if(Object.keys(entry.params).some(k=>!['property','value','conditions','perPPDiff'].includes(k)))return '條件先制包含未知參數';
    return skillPropertyIssue({...entry,role:'innate',params:{property:'base_priority',value,conditions}});
  }
  // 機率先制是附加效果（🎯，可被附加效果失效封印），不是固有屬性；機率由 pct 表示，不接受條件。
  if(property==='chance_priority') {
    if(entry.source!=='skill'||entry.role!=='attached'||entry.node!=='modify_priority')return '機率先制只能是技能的附加效果，且在先制判定節點';
    if(!Number.isInteger(value)||value<1||value>100)return '機率先制需為1至100整數';
    if(!(entry.params.pct>0&&entry.params.pct<=100))return '機率先制的機率需大於0、不超過100';
    if(conditions.length)return '機率先制不接受其他條件';
    if(Object.keys(entry.params).some(k=>!['property','value','conditions','pct'].includes(k)))return '機率先制包含未支援參數';
    return null;
  }
  if(property==='stage_view') {
    if(entry.source!=='skill'||entry.role!=='innate'||entry.node!=='before_damage'||conditions.some(c=>c.c!=='pp_full'))return '能力視為需為技能固有、公式前查詢，條件僅接受PP滿';
    if(!['opp_up_as_down','self_down_as_opp_down','self_down_as_up','self_down_as_double_up','self_down_ignore'].includes(value))return '能力視為方向未接通';
    if(Object.keys(entry.params).some(k=>!['property','value','conditions'].includes(k)))return '能力視為含未知參數';
    return null;
  }
  if(!['sure_hit','base_priority','base_accuracy','base_power','hit_requirement','forced_first'].includes(property))return '未知技能本體屬性';
  if(entry.source!=='skill'||entry.role!=='innate')return '技能本體屬性只能是技能固有';
  if(entry.node!==(['base_priority','forced_first'].includes(property)?'modify_priority':'before_skill'))return '技能本體屬性查詢節點不符';
  if(property==='forced_first'&&(value!==true||!conditions.length))return '必定先手需為true且有明確前置條件';
  if(property==='sure_hit'&&value!==true)return '必中屬性需為true';
  if(property==='hit_requirement'&&(value!==true||!conditions.length))return '命中必要條件需為true且有明確條件';
  if(property==='base_power'&&(!Number.isInteger(value)||value<0||value>1000000))return '固有威力需為0至1000000整數';
  if(property==='base_accuracy'&&(!Number.isInteger(value)||value<0||value>100))return '固有命中率需為0至100整數';
  if(property==='base_priority'&&(!Number.isInteger(value)||Math.abs(value)>100))return '基礎先制需為-100至100整數';
  if(!Array.isArray(conditions)||conditions.some(c=>!['dragon_soul','mark_count','pp_full','has_status','abnormal','stage','hp_ratio','hp_value','hp_cmp','hp_full','shield','type_is','enemy','self_enemy','stat_cmp','atk_gap'].includes(c?.c)))return '技能本體查詢不能引用尚未發生的出手／成敗結果';
  return sequenceIssue({raw:'技能本體查詢',trig:'use',parsed:true,cond:conditions,body:[{acts:[{op:'heal_flat',p:{amount:0},label:''}]}]});
}
