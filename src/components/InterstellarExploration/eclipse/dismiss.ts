import React from "react";

/** 疊層堆疊：Esc 只關最上層，避免帳冊與其上的彈窗一起被關。 */
const stack: symbol[] = [];

/** 掛上後，按 Esc 會關閉（僅限目前最上層的）面板。 */
export function useEscDismiss(onClose: () => void, enabled = true) {
  const ref = React.useRef(onClose); ref.current = onClose;
  React.useEffect(() => {
    if (!enabled) return;
    const id = Symbol("ecl-dismiss"); stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || stack[stack.length - 1] !== id) return;
      e.preventDefault(); ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1); };
  }, [enabled]);
}

/** 點擊空白背板（目標就是背板本身）才關閉；面板內的點擊不會觸發。 */
export const backdropClose = (onClose: () => void) => ({
  // 從面板內按下、拖到背板放開，不算點背板
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.dataset.down = e.target === e.currentTarget ? "1" : "0"; },
  onClick: (e: React.MouseEvent<HTMLElement>) => { if (e.target === e.currentTarget && e.currentTarget.dataset.down !== "0") onClose(); },
});

/** 兩段式選擇：點選只標記（可改選），確認才送出。 */
export function useConfirmPick<T extends string>(valid: readonly T[], locked: boolean, commit: (id: T) => void) {
  const [sel, setSel] = React.useState<T | null>(null);
  const cur = sel && valid.includes(sel) && !locked ? sel : null;
  const confirm = React.useCallback((id?: T) => { const t = id ?? cur; if (t && !locked) { setSel(null); commit(t); } }, [cur, locked, commit]);
  const ref = React.useRef(confirm); ref.current = confirm;
  React.useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (t && t.tagName === "BUTTON" && !t.hasAttribute("data-pick")) return; // 其他按鈕自己處理 Enter
      if (document.querySelector("[role=dialog]")) return;
      e.preventDefault(); ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur]);
  return { sel: cur, select: setSel, confirm };
}
