import { useLayoutEffect } from "react";

/** 把作用域 CSS 字串注入 <head>（只注入一次）。不 import .css 檔，因此 node 測試與 lazy chunk 都能直接用。 */
export function useScopedStyle(id: string, css: string) {
  useLayoutEffect(() => {
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id; el.textContent = css;
    document.head.appendChild(el);
  }, [id, css]);
}
