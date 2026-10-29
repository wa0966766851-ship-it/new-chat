/**
 * 戰鬥規則掛點：與某隻精靈／某套機制有關、但不屬於任何單一魂印事件的全局規則
 * （例如「場上有次元龍時所有精靈累積詩章」「陣亡後下一隻上場精靈獲得守護印記」）。
 *
 * 引擎只在固定節點依序呼叫已註冊的規則，不認識任何精靈名稱。
 * 規則檔放在各自精靈的資料夾（src/effects/elves/<id>/battleRule.ts）或 src/effects/rules/，
 * 並在 src/effects/battleRules.index.ts 匯入以完成註冊。
 */
import type { BattleEventContext } from '../effects/types';
import type { Elf, Skill } from '../types';

export type Side = 'p1' | 'p2';

export interface BattleRuleApi {
  /** 目前的戰鬥狀態（引擎唯一真實狀態）。 */
  getState(): any;
  /** 直接覆寫戰鬥狀態（與原本 syncStateRef.current = … 相同語意）。 */
  setState(next: any): void;
  dispatch(action: any): void;
  ctx(side: Side, isHit?: boolean, moveIndex?: number, elf?: Elf): BattleEventContext;
  log(side: Side, text: string, type?: string): void;
}

export interface ActionFlags {
  /** 本次攻擊技能不受「攻擊技能無效」類效果影響。 */
  ignoreAttackInvalidation?: boolean;
  /** 本次攻擊無視對手攻擊免疫；值為來源名稱（顯示用）。 */
  ignoreAttackImmunitySource?: string | null;
}

export interface BattleRule {
  id: string;
  /** 2.1 回合開始時：在魂印 ROUND_START 派發之前。cur＝回合開始時的狀態物件（可原地修改，與舊行為相同）。 */
  roundStart?(api: BattleRuleApi, cur: any): void;
  /** 死亡節點：雙方在場精靈陣亡判定後、被擊敗事件派發前。mid＝判定當下的狀態物件。 */
  faint?(api: BattleRuleApi, mid: any): void;
  /** 精靈登場後（首發、主動切換、陣亡換人）。回傳要寫入該方 RegistryState 的更新。 */
  entered?(api: BattleRuleApi, side: Side, elf: Elf, ctx: BattleEventContext, regState: Record<string, any>): Record<string, any> | void;
  /** 回合結束：魂印 ROUND_END 之後、回合收尾合併之前。reg＝該方最新 RegistryState（可原地修改，與舊行為相同）。 */
  roundEnd?(api: BattleRuleApi, side: Side, reg: Record<string, any>): void;
  /** 出手判定：技能無效與攻擊免疫判定前讀取。 */
  actionFlags?(state: any, side: Side, skill: Skill): ActionFlags | void;
}

const rules: BattleRule[] = [];

export function registerBattleRule(rule: BattleRule): void {
  const i = rules.findIndex(r => r.id === rule.id);
  if (i >= 0) rules[i] = rule; else rules.push(rule);
}

export function battleRules(): readonly BattleRule[] {
  return rules;
}

export function collectActionFlags(state: any, side: Side, skill: Skill): ActionFlags {
  const out: ActionFlags = {};
  for (const r of rules) {
    const f = r.actionFlags?.(state, side, skill);
    if (!f) continue;
    if (f.ignoreAttackInvalidation) out.ignoreAttackInvalidation = true;
    if (f.ignoreAttackImmunitySource && !out.ignoreAttackImmunitySource) out.ignoreAttackImmunitySource = f.ignoreAttackImmunitySource;
  }
  return out;
}
