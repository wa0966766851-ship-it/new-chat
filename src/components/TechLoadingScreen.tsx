import React from 'react';
import { LoaderCircle } from 'lucide-react';

/** 輕量載入提示：不模擬百分比，不宣稱不存在的引擎／記憶體狀態。 */
export default function TechLoadingScreen() {
  return (
    <div role="status" aria-live="polite" aria-label="正在載入頁面"
      className="fixed inset-0 z-[1000] bg-[#101216]/95 flex items-center justify-center p-6">
      <div className="ios-panel max-w-sm w-full p-8 text-center space-y-3">
        <LoaderCircle aria-hidden="true" className="mx-auto h-8 w-8 text-cyan-400 animate-spin motion-reduce:animate-none" />
        <h2 className="text-lg font-semibold text-white">正在載入頁面</h2>
        <p className="text-sm leading-relaxed text-slate-400">首次開啟需載入此頁的程式與資料，請稍候。</p>
      </div>
    </div>
  );
}
