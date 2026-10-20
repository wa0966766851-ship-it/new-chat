// ============================================================================
// effectSystem.schema.ts —— 模組化技能/魂印效果系統：正式型別合約
// 這份是「AI 自訂精靈 + 任何新技能直接引用效果」的資料契約。
// codex(2278 筆已分類) 依此結構被查詢/引用；runner 依此執行。
// ============================================================================

// ── 引擎既有節點(對齊 EffectTiming)。技能=隱含節點；魂印=顯式節點 ──────────
export type Node =
  | "on_opponent_damaged"
  | "on_opponent_settlement"
  | "on_skill_selected"
  | "modify_power"
  | "on_resource_changed"
  | "battle_start" | "on_entered" | "before_action" | "before_skill" | "before_instant_kill"
  | "before_damage" | "on_hit" | "after_attack_hit" | "on_damaged" | "after_action"
  | "round_start" | "round_end" | "battle_phase_end"
  | "on_kill" | "on_not_killed" | "self_fatal" | "cthyaat_death" | "battle_end"
  | "on_skill_use" | "on_attacked" | "any_battle_node" | "passive_always" | "modify_priority"
  | "on_invalid" | "before_switch_out" | "on_switch_out" | "opponent_after_action" | "pp_consumed" | "pp_cleared"
  | "extra_action_start" | "extra_action_end" | "before_status_apply" | "opponent_entered"
  | "ally_entered" | "on_status_ended" | "on_status_received" | "on_status_immunized" | "before_status_tick" | "on_turn_effects_cleared" | "on_stat_boost_cleared" | "before_stat_change";

// ── 三分類軸(前面談定的)──────────────────────────────────────────────
export type Role = "innate" | "attached" | "carried";          // ■ 🎯 ◇
export type Era  = "modern" | "legacy" | "unknown";
export type DamageType = "fixed" | "percent" | "true" | "skill_attack" | null;
export type Polarity = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
export type Target = "self" | "opponent" | "both" | "ally_active" | "field" | "mixed" | null;
export type Context = "skill" | "trait";                        // 可用情境

// ── 計數器身分(積木的「身分插槽」)──────────────────────────────────────
export type CounterKind = "turn_effect" | "use_counter" | "named_status_duration" | null;
export type ApplyMode = "gate" | "per_tick" | "on_expire";      // 回合類效果:閘門/每回合/到期
export interface CounterSpec {
  kind: CounterKind;
  duration?: number | string;   // N 或 "{0}" 參數槽
  applyMode?: ApplyMode;
  clearable?: boolean;          // 可否被「消除回合類效果」清除
  lateMoveCarry?: boolean;      // 後出手附加當回合無收益 → 回合數+1
}

// ── 原子操作 id(2278 筆全部歸約到這 28 個；runner 只需實作這些)──────────
export type AtomId =
  | "effect_sequence"     // 明確動作／條件／成功失敗連鎖；不呼叫專屬handler
  | "skill_property"      // 命中／基礎先制的公式前唯讀查詢
  | "soul_property"       // 魂印／特質常駐命中查詢（不以回合timer代替）
  | "extra_damage"        // 追加傷害(依 damageType: fixed/percent/true)
  | "damage_multiplier"   // 威力/傷害倍率(■固有)
  | "damage_reduce"       // 減傷/減半(底層自動跳過 true)
  | "damage_reflect"      // 反彈
  | "heal"                // 恢復體力
  | "drain_hp"            // 吸取：固定／百分比；汲取：真實。恢復及結算由明確參數決定。
  | "hp_cost"             // 消耗自身體力(代價)
  | "maxhp_change"        // 體力上限增減
  | "apply_status"        // 施加具名異常狀態(麻痺/中毒…)
  | "cure_status"         // 解除異常
  | "stat_change"         // 能力等級/全屬性 增減
  | "clear_stat"          // 消除能力提升/下降
  | "shield"              // 護盾/屏障
  | "pp_op"               // PP 歸零/扣除/回復
  | "priority"            // 先制
  | "accuracy"            // 必中/命中率/閃避
  | "pierce"              // 無視防禦/免疫
  | "crit"                // 暴擊/致命一擊
  | "extra_action"        // 額外行動/多次攻擊
  | "summon_extra"        // 召喚額外精靈
  | "vanish"              // 消逝
  | "rebirth"             // 重生/復活
  | "copy_transfer"       // 複製/轉移/交換/竊取
  | "immune"              // 免疫/技能無效
  | "turn_effect_apply"   // 施加回合類效果(包裝器,wraps 另一 atom)
  | "turn_effect_clear"   // 消除回合類效果
  | "copy_stat_sum"       // 複製能力總和(額外精靈用)
  | "condition_gate";     // 條件閘(「…時/若…則」;主語剝離後的條件)

// ── codex 條目(2278 筆的每一筆;以 id 查詢/引用)────────────────────────
export interface EffectCode {
  id: string;                    // "0010"(對應 CSV 編號)
  template: string;              // 原文,不改寫
  paramCount: number;
  // 分類(已由解構器產出)
  era: Era; role: Role | null;
  node: Node | null; nodeInferred?: boolean;
  damageType: DamageType;
  counter?: CounterSpec;         // 有回合類/次數身分才填
  namedStatus?: boolean;
  isDual?: boolean;              // 雙極(吸取/反彈…)
  target: Target; targetInferred?: boolean;
  polarity: Polarity | null;
  contexts: Context[];
  // 綁定到原子(這是 runner 執行的依據;由「解構→原子映射」階段填)
  atoms: AtomBinding[];          // 一碼 → 一或多個原子(複合碼多個)
  encyclopediaRef?: string;
  clarity: "clear" | "vague"; needsReview: boolean; reviewReason?: string;
}

// ── 原子綁定:codex 條目引用哪個原子 + 參數 + 落點 ────────────────────────
export interface AtomBinding {
  atom: AtomId;
  params?: Record<string, any>;  // 由 template 的 {0}{1}… 對應
  target?: Target;               // 子效果各自的 target(雙極時:extra_damage→opponent, heal→self)
  counter?: CounterSpec;         // 若此子效果是回合類/次數,帶計數器身分
}

// ── kit 詞條:技能/魂印引用一個 codex 條目 + 填參 + 觸發節點 ──────────────
export interface KitEntry {
  codeId: string;                // 引用的 codex 編號
  customText?: string;           // 積木換槽後生成的新描述；有值時走文字偵測而非 codeId
  params: Record<string, any>;   // 填入 {0}{1}…
  node: Node;                    // 技能=隱含(由 role 決定);魂印=顯式選擇
  source: "skill" | "soulmark" | "mechanic" | "item";
  order: number;                 // 同節點內執行順序(詞條有序)
  role?: Role;                   // 技能固有／附加／攜帶；舊技能詞條預設附加，魂印不受此分類限制
}

// ── runner 契約:每個原子的執行簽名(接既有引擎 primitive)──────────────────
export type AtomImpl = (params: Record<string, any>, target: Target, ctx: any) => void;
export type AtomTable = Record<AtomId, AtomImpl>;
