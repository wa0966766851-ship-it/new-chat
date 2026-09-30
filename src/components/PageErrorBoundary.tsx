import React from "react";

/** 局部頁面失敗不應令側欄／返回功能一起消失。 */
export class PageErrorBoundary extends React.Component<{ children: React.ReactNode; onBack: () => void }, { failed: boolean }> {
  declare props: { children: React.ReactNode; onBack: () => void };
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error("頁面載入失敗", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="ios-panel m-6 p-6 space-y-4 text-slate-200">
      <h2 className="text-lg font-semibold">這個頁面暫時無法顯示</h2>
      <p className="text-sm text-slate-400">沒有刪除你的存檔。可以返回首頁再開啟，並回報頁面名稱與剛才的操作。</p>
      <button type="button" onClick={this.props.onBack} className="rounded-xl bg-blue-600 px-4 py-2 text-sm">返回首頁</button>
    </section>;
  }
}
