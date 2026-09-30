/** UI 分類只隔離明確的標題／背景敘述；不刪除原始模板，不推定執行語意。 */
export function getTemplateReviewReason(text: string): string | null {
  const value = text.trim().replace(/^\*+|\*+$/g, "");
  if (/^【[^】]+】$/.test(value) || /^[^：:。；;\n]{1,24}[：:]$/.test(value)) {
    return "原段落標題，缺少具體效果；請對照原始 txt。";
  }
  if (/^賽[爾尔]號.*(?:覺醒形態|觉醒形态|登場角色|登场角色|精靈介紹|精灵介绍)/.test(value)) {
    return "疑似角色背景介紹，尚未確認為效果。";
  }
  return null;
}

/** 只承認句首明寫的時點；句中提到回合結束不等於整句在該時點觸發。 */
export function getTemplateTimingLabel(text: string): string {
  const explicit = text.trim().match(/^(?:每次|自身)?(戰鬥開始時|回合開始時|戰鬥階段結束時|回合結束時|登場時|死亡時|被擊敗時|受到攻擊時|受到傷害時|使用攻擊技能時|使用技能時|技能使用時|攻擊命中後|常駐效果)[：:，,]/);
  return explicit?.[1] || "待確認：需原段落時點";
}
