import { ElfSpotlight } from './ElfSpotlight';
import { useState } from 'react';
import type { Elf } from '../types';
import { RELEASE_NOTES } from '../data/releaseNotes';
import { createElfUpdateBlueprint, createElfUpdateHandoff } from '../utils/elfUpdateWorkflow';
import { BlueprintImportButton } from './BlueprintImportButton';

type Tab = 'news' | 'elves' | 'workflow';
type Props = { elves: Elf[]; onBack: () => void; onEditElf: (elf: Elf, tab: 'blockly') => void };

function downloadText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export default function UpdatesPage({ elves, onBack, onEditElf }: Props) {
  const [tab, setTab] = useState<Tab>('news');
  const [selectedId, setSelectedId] = useState('wiki_4937');
  const [request, setRequest] = useState('');
  const [feedback, setFeedback] = useState('');
  const selected = elves.find(elf => elf.id === selectedId);
  const run = async (task: () => void | Promise<void>) => {
    setFeedback('');
    try { await task(); } catch (error) { setFeedback(error instanceof Error ? error.message : '操作未完成，請重試。'); }
  };
  const copyTask = async () => {
    const text = createElfUpdateHandoff(selected!, request);
    try { await navigator.clipboard.writeText(text); }
    catch { throw new Error('無法存取剪貼簿，請改用「下載任務文字檔」。'); }
    setFeedback('任務已複製，貼到你選擇的 AI 對話即可。');
  };
  if(tab==='elves')return <ElfSpotlight elves={elves} onClose={onBack} onBack={()=>setTab('news')} onEdit={elf=>{setSelectedId(elf.id);setTab('workflow');}}/>;
  return <section className="w-full max-w-5xl mx-auto p-4 sm:p-8 space-y-6 text-slate-200" aria-label="更新與精靈">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">更新與精靈</h1><p className="text-sm text-slate-400 mt-2">查看本版本內容、認識新精靈，或開始修改你的精靈。</p></div>
      <button type="button" className="ios-button" onClick={onBack}>返回首頁</button>
    </header>
    <nav className="ios-segment flex flex-wrap" aria-label="更新頁分類">
      {([['news', '更新公告'], ['elves', '新精靈介紹'], ['workflow', '精靈更新指南']] as const).map(([key, label]) => <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} data-active={tab === key} onClick={() => { setTab(key); setFeedback(''); }}>{label}</button>)}
    </nav>
    {tab === 'news' && <div className="space-y-4">
      <p className="text-sm text-slate-400">以下為目前載入版本收錄的內容。檢查伺服器新版，請至控制中心的更新設定。</p>
      {RELEASE_NOTES.map(note => <article key={note.id} className="ios-card p-5 space-y-3">
        <time className="text-xs text-sky-300" dateTime={note.date}>{note.date}</time>
        <h2 className="text-lg font-semibold">{note.title}</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">{note.items.map(item => <li key={item}>{item}</li>)}</ul>
      </article>)}
    </div>}
    {tab === 'workflow' && <div className="space-y-5">
      <div className="ios-card p-5 space-y-3">
        <h2 className="font-semibold text-lg">選擇要更新的精靈</h2>
        <label className="block text-sm" htmlFor="update-elf-select">目前精靈</label>
        <select id="update-elf-select" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3" value={selected ? selectedId : ''} onChange={e => { setSelectedId(e.target.value); setFeedback(''); }}>
          <option value="" disabled>請選擇精靈</option>{elves.map(elf => <option value={elf.id} key={elf.id}>{elf.name} · {elf.id}</option>)}
        </select>
        <p className="text-sm text-slate-400">修改前先匯出圖紙備份。兩種途徑都會回到編輯器確認，按下儲存後才修改本機資料。</p>
        <button type="button" className="ios-button" disabled={!selected} onClick={() => void run(() => { downloadText(createElfUpdateBlueprint(selected!), `seer-elf-${selected!.id}.json`, 'application/json'); setFeedback('已送出圖紙備份下載，請確認檔案已儲存。'); })}>匯出目前圖紙</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="ios-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">途徑一：透過積木整合</h2>
          <ol className="list-decimal pl-5 text-sm space-y-3"><li>開啟所選精靈的積木編輯頁。</li><li>依原文設定觸發、條件、目標、行為及期限，同步更新說明。</li><li>確認技能、魂印與特質的積木內容，儲存後在實戰演練測試雙方結果。</li><li>匯出完成的圖紙，供他人匯入或交由維護者整合。</li></ol>
          <button type="button" className="ios-button-primary" disabled={!selected} onClick={() => onEditElf(selected!, 'blockly')}>用積木編輯</button>
        </article>
        <article className="ios-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">途徑二：交由對話中的 AI 協助</h2>
          <ol className="list-decimal pl-5 text-sm space-y-3"><li>填寫原文、要改的地方與預期結果，複製任務交給你使用的 AI。</li><li>請 AI 保留原資料，優先使用現有積木；缺少機制時由維護者補上。</li><li>取得完整圖紙 JSON 後匯入，確認預覽再開啟編輯器。</li><li>核對實際效果並儲存；匯入成功只代表資料格式可讀。</li></ol>
          <label htmlFor="elf-update-request" className="block text-sm">修改需求與原文</label>
          <textarea id="elf-update-request" rows={5} maxLength={4000} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm" placeholder="例如：技能原文是……，應在命中後取得效果，持續期間每次使用技能觸發……" value={request} onChange={e => setRequest(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className="ios-button" disabled={!selected || !request.trim()} onClick={() => void run(copyTask)}>複製 AI 更新任務</button>
            <button type="button" className="ios-button" disabled={!selected || !request.trim()} onClick={() => void run(() => { downloadText(createElfUpdateHandoff(selected!, request), `seer-elf-${selected!.id}-task.txt`, 'text/plain;charset=utf-8'); setFeedback('已送出 AI 任務文字檔下載。'); })}>下載任務文字檔</button>
          </div>
          <p className="text-xs text-slate-400">產生任務不會呼叫 AI 服務，也不會傳送本機存檔或金鑰。</p>
          <BlueprintImportButton onImport={elf => onEditElf(elf, 'blockly')} />
        </article>
      </div>
      <section className="ios-card p-5 space-y-3"><h2 className="font-semibold">讓所有玩家取得更新</h2><p className="text-sm text-slate-300">本機圖紙儲存只影響這台裝置。公開版本須由維護者整合到 GitHub，補上必要的雙方戰鬥測試並通過發布檢查，再更新網站或發布新 EXE。玩家之後可在控制中心檢查與套用新版。</p><p className="text-sm text-slate-400">若原文需要的行為尚無積木支援，請保留原文與預期範例交給維護者；不要用空動作當成完成。</p></section>
    </div>}
    {tab === 'news' && <aside className="ios-card p-4"><h2 className="font-semibold mb-2">外部資源</h2><p className="text-sm text-slate-300">需要直接查看精靈的官方動作素材（待機／出招／受擊），可使用社群維護的線上查看器 <a className="text-blue-300 underline" href="https://nattsu39.github.io/seer-pet-viewer/" target="_blank" rel="noopener noreferrer">賽爾號精靈動畫查看器（seer-pet-viewer）</a>；輸入精靈編號即可預覽原生動畫。本模擬器的播放核心亦基於其開源渲染套件。</p></aside>}
    {feedback && <p role="status" className="text-sm text-sky-200 whitespace-pre-wrap">{feedback}</p>}

  </section>;
}
