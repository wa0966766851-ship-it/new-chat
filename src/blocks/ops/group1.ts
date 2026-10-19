// 組1（final-wrapped-plan §6）新 op 聚合入口：共用檔（runtime／sequenceContract）只各一行接這裡。
import { STAT_SUM_AS_ACTION_FIELDS, statSumAsActionIssue, statSumAsOperations } from './statSumAs';
import { DEFEAT_REFLECT_ACTION_FIELDS, defeatReflectActionIssue, defeatReflectOperations } from './defeatReflect';

export const GROUP1_ACTION_FIELDS: Record<string, readonly string[]> = {
  ...STAT_SUM_AS_ACTION_FIELDS,
  ...DEFEAT_REFLECT_ACTION_FIELDS,
};
export function group1ActionIssue(op: string, p: any, trig: string, _nested?: (body: any[], trig: string) => string | null): string | null {
  return statSumAsActionIssue(op, p) ?? defeatReflectActionIssue(op, p, trig);
}
export function group1Operations(_helpers: Record<string, any>) {
  return {
    ...statSumAsOperations(),
    ...defeatReflectOperations(),
  };
}
