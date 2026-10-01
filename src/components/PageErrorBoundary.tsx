import React from "react";

/** 局部頁面失敗不應令側欄／返回功能一起消失。 */
type PageErrorProps = { children: React.ReactNode; onBack: () => void; onReload?: () => void };

export class PageErrorBoundary extends React.Component<PageErrorProps, { failed: boolean; resourceFailure: boolean }> {
  declare props: PageErrorProps;
  state = { failed: false, resourceFailure: false };
  static getDerivedStateFromError(error: Error) {
    return { failed: true, resourceFailure: /dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(error.message) };
  }
  componentDidCatch(error: Error) { console.error("頁面載入失敗", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="ios-panel m-6 p-6 space-y-4 text-slate-200">
      <h2 className="text-lg font-semibold">這個頁面暫時無法顯示</h2>
      <p className="text-sm text-slate-400">{this.state.resourceFailure
        ? "頁面資源未成功載入，可能是版本更新或連線中斷。請確認服務仍在執行，再重新載入整個應用程式；只返回首頁可能無法恢復。"
        : "沒有刪除你的存檔。可以返回首頁，並回報頁面名稱與剛才的操作。"}</p>
      <p className="text-sm text-amber-300">重新載入會失去未儲存的草稿及當前對戰進度，不會清除已儲存的資料。</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={this.props.onBack} className="rounded-xl bg-slate-700 px-4 py-2 text-sm">返回首頁</button>
        <button type="button" onClick={() => {
          if (window.confirm("重新載入會失去未儲存的草稿及當前對戰進度。確定重新載入？")) {
            if (this.props.onReload) this.props.onReload();
            else window.location.reload();
          }
        }} className="rounded-xl bg-blue-600 px-4 py-2 text-sm">重新載入應用程式</button>
      </div>
    </section>;
  }
}
