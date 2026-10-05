// 積木系統資料模型：精靈描述 → 積木（觸發 / 條件 / 動作），同一份結構同時用於「顯示」與「執行」。

export type Side = "self" | "opp" | "both";

/** 觸發時點（魂印標頭、N回合內的持續效果） */
export type Trigger =
  | "use" // 技能使用（技能本身的效果）
  | "extra_action_start" | "extra_action_end" // 額外行動獨立節點（不等同再次使用技能）
  | "after_hit" // 技能傷害結算後（擊敗／未擊敗、造成傷害量相關）
  | "on_invalid" // 技能無效（含未命中）時
  | "self_invalid" // 自身技能無效（持續效果用）
  | "battle_start"
  | "entrance"
  | "round_start"
  | "round_end"
  | "phase_end"
  | "self_skill" | "self_attack" | "self_status" // 自身使用技能／攻擊技能／屬性技能時
  | "self_after_skill" | "self_after_attack" | "self_after_status" | "self_after_physical" | "self_after_special" // 自身使用技能後
  | "opp_skill" | "opp_attack" | "opp_status" // 對手使用技能時
  | "opp_after_skill" | "opp_after_attack" | "opp_after_status"
  | "damaged" | "damaged_skill" | "damaged_attack" | "damaged_true" | "damaged_fixed" | "damaged_percent" | "damaged_nontrue" // 自身受到傷害後
  | "incoming" | "incoming_skill" | "incoming_attack" | "incoming_nontrue" // 受到傷害時（可修正傷害）
  | "outgoing" | "outgoing_skill" | "outgoing_attack" // 造成傷害時（可修正傷害）
  | "defeated" // 自身被擊敗時
  | "kill" // 擊敗對手時
  | "fatal" // 受到致命傷害時
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
