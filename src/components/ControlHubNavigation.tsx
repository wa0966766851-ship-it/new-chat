import { useEffect, useRef } from 'react';
import { Archive, ArrowLeft, Image, Info, Keyboard, LayoutGrid, Monitor, Music, PanelRight, Settings2, Swords } from 'lucide-react';
import { CONTROL_DETAIL_PAGES, type ControlDetailPage, type ControlHubLayout } from '../utils/controlSettings';
import './controlHubNavigation.css';

const icons = { visual: Monitor, background: Image, audio: Music, controls: Keyboard, battle: Swords, backup: Archive, system: Settings2 };

export interface ControlHubNavigationState {
  layout: ControlHubLayout | null;
  setLayout: (layout: ControlHubLayout) => void;
  preferModern: boolean;
  page: ControlDetailPage | null;
  setPage: (page: ControlDetailPage | null) => void;
  showNotes: boolean;
  setShowNotes: (show: boolean) => void;
}

export function SettingsLayoutSwitch({ modern, onSwitch }: { modern: boolean; onSwitch: () => void }) {
  const Icon = modern ? PanelRight : LayoutGrid;
  const label = modern ? '切換為舊版設定' : '切換為新版設定';
  return <button type="button" className="settings-header-action settings-layout-switch" onClick={onSwitch} aria-label={label} title={label}>
    <Icon size={18} aria-hidden="true" />
    <span aria-hidden="true">{modern ? '舊版' : '新版'}</span>
  </button>;
}

export function SettingsNotesButton({ show, onChange }: { show: boolean; onChange: (show: boolean) => void }) {
  const label = show ? '隱藏分類與選項說明' : '顯示分類與選項說明';
  return <button type="button" className="settings-header-action" onClick={() => onChange(!show)}
    aria-label={label} aria-pressed={show} title={label}><Info size={18} aria-hidden="true" /></button>;
}

export function ControlHubNavigation({ page, setPage, showNotes }: Pick<ControlHubNavigationState, 'page' | 'setPage' | 'showNotes'>) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef<ControlDetailPage | null>(null);
  const grid = useRef<HTMLElement>(null);
  useEffect(() => {
    if (page) heading.current?.focus();
    else if (previousPage.current) grid.current?.querySelector<HTMLButtonElement>(`[data-settings-page="${previousPage.current}"]`)?.focus();
    previousPage.current = page;
  }, [page]);

  const detail = CONTROL_DETAIL_PAGES.find(item => item.id === page);
  if (detail) {
    const Icon = icons[detail.id];
    return <div className="settings-route">
      <button type="button" className="settings-header-action" onClick={() => setPage(null)} aria-label="返回設定總覽" title="返回設定總覽">
        <ArrowLeft size={19} aria-hidden="true" />
      </button>
      <Icon size={21} aria-hidden="true" />
      <div>
        <h3 ref={heading} tabIndex={-1}>{detail.title}</h3>
        {showNotes && <p>{detail.description}</p>}
      </div>
    </div>;
  }
  return <nav ref={grid} className="settings-categories" aria-label="設定分類">
    {CONTROL_DETAIL_PAGES.map(item => {
      const Icon = icons[item.id];
      return <button key={item.id} type="button" className="settings-category" data-settings-page={item.id}
        aria-label={item.title} title={item.description} onClick={() => setPage(item.id)}>
        <span className="settings-category-symbol"><Icon size={31} strokeWidth={1.6} aria-hidden="true" /></span>
        <span className="settings-category-title">{item.title}</span>
        {showNotes && <span className="settings-category-description">{item.description}</span>}
      </button>;
    })}
  </nav>;
}
