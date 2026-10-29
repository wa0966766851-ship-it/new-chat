import React from "react";
import { X } from "lucide-react";
import type { Elf } from "../../types";
import type { ShellBridge } from "../bridge";
import { ElfAvatar } from "../../components/SeerImages";
import { newestElfKeys } from "../elfPool";
import { ElfFilterBar, useElfFilter } from "../../components/shared/ElfPicker";

/** 換立繪用的精靈選擇抽屜 */
export default function HeroPicker({
  b, current, onClose, onPick,
}: {
  b: ShellBridge;
  current: Elf;
  onClose: () => void;
  onPick: (elf: Elf) => void;
}) {
  // 預設依新增順序（新精靈在前）；搜尋沿用全站契約，另有屬性／分級／特徵篩選與排序。全部列出，不截斷。
  const f = useElfFilter({ sort: "newest" });
  const fresh = React.useMemo(() => newestElfKeys(b.allElvesCombined), [b.allElvesCombined]);
  const list = React.useMemo(() => f.filter(b.allElvesCombined, { fresh }), [f.filter, b.allElvesCombined, fresh]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" data-shell-drawer aria-label="換立繪">
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        className="relative p-3 flex flex-col gap-2"
        style={{
          background: "linear-gradient(180deg, #0B1620, #060D14)",
          borderTop: "1px solid var(--p-accent)",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
          maxHeight: "75dvh",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black flex-1" style={{ color: "#F8FAFC" }}>
            換立繪（目前：{current.name}）
          </span>
          <button type="button" onClick={onClose} className="p-1.5" style={{ borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
            <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        <ElfFilterBar state={f} variant="shell" placeholder="搜尋精靈名稱或 ID" count={`${list.length}`} />

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1.5">
            {list.map(elf => (
              <button
                key={elf.id || elf.name}
                type="button"
                onClick={() => onPick(elf)}
                className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                title={elf.name}
              >
                <div className="relative w-full aspect-square overflow-hidden" style={{ borderRadius: 8, background: "rgba(10,20,30,0.9)" }}>
                  <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                  {fresh.has(String(elf.id ?? elf.name)) && <span data-new-elf className="absolute left-0.5 top-0.5 px-1 text-[8px] font-black leading-[12px]" style={{ borderRadius: 4, background: "var(--p-accent)", color: "#06121C" }}>新</span>}
                </div>
                <span className="text-[7px] truncate w-full text-center" style={{ color: "rgba(203,213,225,0.72)" }}>{elf.name}</span>
              </button>
            ))}
          </div>
          {!list.length && (
            <p className="text-center text-[10px] py-6" style={{ color: "rgba(148,163,184,0.6)" }}>沒有符合條件的精靈</p>
          )}
        </div>
      </div>
    </div>
  );
}
