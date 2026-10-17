import React from "react";

/**
 * 拖拉換位＋點選互換（先點一隻再點目標）。背包格與倉庫格共用；
 * 內容只認「成員 id」與「落點」，實際搬移由呼叫端的 onMove 決定。
 */
export function useSlotMover<T>(onMove: (id: string, target: T) => void) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const move = (id: string, target: T) => { onMove(id, target); setSelected(null); setDragging(null); };
  return {
    selected, dragging,
    clear: () => { setSelected(null); setDragging(null); },
    /** 放在可拖曳的成員卡上 */
    source: (id: string) => ({
      draggable: true as const,
      onDragStart: (e: React.DragEvent) => { try { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; } catch { /* 部分瀏覽器／測試環境沒有 dataTransfer */ } setDragging(id); },
      onDragEnd: () => setDragging(null),
    }),
    /** 放在落點（格子或區塊）上 */
    target: (target: T) => ({
      onDragOver: (e: React.DragEvent) => { if (dragging) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; } },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragging) move(dragging, target); },
    }),
    /** 點選：尚未選取→選取此成員；已選取→與此落點互換。回傳 true 代表已處理。 */
    click: (id: string | null, target: T) => {
      if (selected && selected !== id) { move(selected, target); return true; }
      if (id) { setSelected(s => s === id ? null : id); return true; }
      return false;
    },
  };
}
