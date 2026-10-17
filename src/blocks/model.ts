// 積木系統資料模型：精靈描述 → 積木（觸發 / 條件 / 動作），同一份結構同時用於「顯示」與「執行」。

export type Side = "self" | "opp" | "both";

/** 觸發時點（魂印標頭、N回合內的持續效果） */
export type Trigger =
  | "opp_damaged_skill"
  | "skill_selected"
  | "outgoing_power" | "incoming_power" // 正式公式前的攻方／受方威力修正
  | "resource_changed" // 資源積木實際改變指定持有者層數後
  | "use" // 技能使用（技能本身的效果）
  | "before_action" // 行動方出手流程開始（先後手已定；魂印先手/後手分支）
  | "before_skill" // 自身本次技能前置時點（PP成本修正、必中查詢；早於命中與傷害）
  | "modify_priority" // 先制判定（priorityComp 修正；尚未決定出手順序）
  | "before_instant_kill" // 秒殺修正前；在場與存活背包持有者共同攔截
  | "extra_action_start" | "extra_action_end" // 額外行動獨立節點（不等同再次使用技能）
  | "after_hit" // 技能傷害結算後（擊敗／未擊敗、造成傷害量相關）
  | "attack_hit" // 每次攻擊命中後，含連擊的逐擊事件
  | "on_invalid" // 技能無效（含未命中）時
  | "self_invalid" // 自身技能無效（持續效果用）
  | "battle_start"
  | "entrance"
  | "round_start"
  | "round_end"
  | "phase_end"
  | "self_skill" | "self_attack" | "self_status" // 自身使用技能／攻擊技能／屬性技能時
  | "self_after_skill" | "self_after_attack" | "self_after_status" | "self_after_physical" | "self_after_special" // 自身使用技能後
  | "self_after_use" // 已使用技能後，包含未命中／技能無效；行動前被打斷不觸發
  | "opp_skill" | "opp_attack" | "opp_status" // 對手使用技能時
  | "opp_after_skill" | "opp_after_attack" | "opp_after_status"
  | "damaged" | "damaged_skill" | "damaged_attack" | "damaged_true" | "damaged_fixed" | "damaged_percent" | "damaged_nontrue" // 自身受到傷害後
  | "incoming" | "incoming_skill" | "incoming_attack" | "incoming_nontrue" // 受到傷害時（可修正傷害）
  | "outgoing" | "outgoing_skill" | "outgoing_attack" // 造成傷害時（可修正傷害）
  | "defeated" // 自身被擊敗時
  | "kill" // 擊敗對手時
  | "not_killed" // 正式出手流程結束後未擊敗，含額外行動後死亡節點一
  | "fatal" // 受到致命傷害時
  | "before_status" // 受方異常附加前，可阻止或替換本次異常
  | "pp_consumed" // 本技能槽的PP確實被消耗，同一因果鏈每槽一次
  | "turn_effects_cleared" // 本持有者的回合效果實際被消除
  | "stat_boost_cleared" // 他方實際消除／吸取本持有者的能力提升
  | "status_end" | "status_immune" | "status_tick" // 持有者異常結束、免疫結果及扣減前
  | "switch_out"
  | "status_received" // 自身受到異常狀態時
  | "bench" // 自身位於背包時
  | "team_round_start" // 存活於背包或在場・回合開始
  | "any_status" // 雙方任一方受到異常時
  | "holder_damaged_attack" | "holder_damaged" | "holder_passive" // 印記持有者
  | "passive" // 常駐（顯示用；由條件式修正在各時點生效）
  | "custom"; // 無法對應（顯示原文）

export interface Cond {
  c: string; // 條件 id
  p?: Record<string, any>;
  label: string;
  neg?: boolean;
}

export interface Act {
  op: string; // 動作 id（見 ops.ts）；"text" = 未解析
  p: Record<string, any>;
  label: string;
}

/** 一句效果：可含條件、主動作、「否則／未觸發則」動作 */
export interface Stmt {
  cond?: Cond[];
  acts: Act[];
  elseActs?: Act[];
  /** 此句依賴上一句的結果（消除成功則／未觸發則） */
  chain?: "success" | "fail" | "any_fail";
  /** 條件即時判定（句中前段剛附加的異常：「令自身混亂，自身處於混亂則…」） */
  live?: boolean;
  /** 傷害結算後才執行（「造成傷害的X%恢復體力，…等量…」的等量＝實際傷害×X%） */
  afterHit?: boolean;
  /** 條件於整句開始前判定（「…時強化效果翻倍」看的是使用前的狀態） */
  pre?: boolean;
}

/** 持續型：N 回合內／下 N 回合 / 下 N 次，於觸發時點執行 */
export interface Timed {
  turns?: number;
  uses?: number;
  from?: "now" | "next";
  trig: Trigger;
  body: Stmt[];
}

export interface Clause {
  raw: string; // 原文（含標記）
  marker?: string; // ■ 🎯 ◇ > >>
  trig: Trigger;
  /** 標頭條件（例如「回合開始時自身擁有護盾：」） */
  cond?: Cond[];
  body: Stmt[];
  /** 印記定義段（「星火之灼：」底下的子句），持有者視角 */
  markDef?: string;
  /** 此句是否完整解析（全部動作可執行） */
  parsed: boolean;
  /** 無法解析的片段 */
  rest?: string[];
}

export interface Program {
  title: string;
  kind: "soul" | "skill";
  clauses: Clause[];
}
