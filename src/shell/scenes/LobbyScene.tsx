import React, { useMemo, useState } from 'react';
import { Swords, Target, Trophy, Flame, Disc, Rocket, Settings2, ArrowUpRight, Package, BookOpen, ScrollText } from 'lucide-react';
import type { ShellBridge, BattleFormat } from '../bridge';
import { readLastUsedRecord, summarizeTeam, buildTeamSummary } from '../lastTeam';
import { prepareSavedBattleRoster } from '../../data/prepareSavedBattleRoster';
import { readAnnualBonus } from '../../battle/annualBonusPreference';
import { ElfAvatar } from '../../components/SeerImages';
import { AegisBackdrop } from '../art/backdrop';
import { haptic } from '../haptics';
import { HeroStage, SettingsDrawer } from './LobbyPanels';
import { NoticeSheet } from '../art/NoticeSheet';

type ModeId = 'free' | 'solo' | 'peak6' | 'peak3' | 'destiny' | 'interstellar';
const MODES: { id: ModeId; title: string; detail: string; icon: typeof Swords; format?: BattleFormat; nav?: 'destiny_wheel' | 'interstellar_exploration' }[] = [
  { id: 'free', title: '自由對戰', detail: '6 對 6 · 自由配置', icon: Swords, format: 'normal_6v6' },
  { id: 'solo', title: '單挑', detail: '1 對 1 · 首發出戰', icon: Target, format: 'solo_1v1' },
  { id: 'peak6', title: '巔峰 6V6', detail: '選禁 · 50 回合', icon: Trophy, format: 'peak_6v6' },
  { id: 'peak3', title: '巔峰 3V3', detail: '選禁 · 精選陣容', icon: Flame, format: 'peak_3v3' },
  { id: 'destiny', title: '命運之輪', detail: '挑戰與隊伍養成', icon: Disc, nav: 'destiny_wheel' },
  { id: 'interstellar', title: '星際探索', detail: '探索星域與迴廊', icon: Rocket, nav: 'interstellar_exploration' },
];

/** 橫向以場景及操作雙欄構圖；直向獨立重排，不縮小整個遊戲畫布。 */
export function LobbyScene({ b }: { b: ShellBridge }) {
  const [activeMode, setActiveMode] = useState<ModeId>(() => MODES.find(m => m.format === b.battleFormat)?.id ?? 'free');
  const [drawer, setDrawer] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const p1 = useMemo(() => {
    const record = readLastUsedRecord('p1');
    if (!record) return buildTeamSummary(b.allElvesCombined.slice(0, 12), { hasTeam: false });
    try {
      return summarizeTeam({ ...record, team: prepareSavedBattleRoster(record.team, b.allElvesCombined, readAnnualBonus('p1'), 'p1') });
    } catch { return summarizeTeam(record); }
  }, [b.allElvesCombined]);
  const op = MODES.find(m => m.id === activeMode)!;
  const launch = () => {
    if (op.nav) { b.setView(op.nav); return; }
    b.setBattleFormat(op.format!);
    b.setEditingElf(null);
    b.setEditorTab(undefined);
    b.setView('bag');
  };
  return <section data-scene="lobby" className="lobby-scene">
    <AegisBackdrop image="/aegis/lobby-spatial.png" sceneOpacity={1} />
    <div className="lobby-composition">
      <div className="lobby-character">
        <HeroStage summary={p1} isPreview={!p1.hasTeam} onEdit={() => b.setView('custom')} b={b} />
      </div>
      <div className="lobby-command">
        <div className="lobby-heading"><div><span className="shell-eyebrow">作戰中心</span><h1>下一場，由你決定。</h1></div>
          <button type="button" aria-label="對戰設定" onClick={() => setDrawer(true)}><Settings2 size={20} /></button>
        </div>
        <div className="lobby-modes" aria-label="選擇玩法">
          {MODES.map(m => <button type="button" key={m.id} aria-pressed={m.id === activeMode} onClick={() => setActiveMode(m.id)} className={`lobby-mode mode-${m.id}`}>
            <m.icon size={24} strokeWidth={1.5} /><span><strong>{m.title}</strong><small>{m.detail}</small></span><ArrowUpRight size={16} />
          </button>)}
        </div>
        <button type="button" className="lobby-launch" onClick={launch} disabled={!b.allElvesCombined.length}>
          <Swords size={24} /><span>{op.nav ? '開始探索' : op.format?.startsWith('peak') ? '進入選禁' : '開始對戰'}<small>{op.title} · {b.battleMode === 'PVP' ? '雙人同屏' : '對戰 AI'}</small></span><ArrowUpRight size={24} />
        </button>
        <div className="lobby-squad">
          <span className="shell-eyebrow">SQUAD · {p1.hasTeam ? '已存陣容' : '預覽陣容'}</span>
          <div className="lobby-squad-row"><div className="lobby-heads">
            {p1.active.slice(0, 6).map((elf, i) => <span title={elf.name} key={elf.battleId || `${elf.id}-${i}`}><ElfAvatar elf={elf} kind="head" className="lobby-head" /></span>)}
          </div><button type="button" onClick={() => b.setView("bag")}><Package size={18} />隊伍<span>{p1.count}/{p1.capacity}</span></button></div>
        </div>
      </div>
      <div className="lobby-shortcuts">
        <button type="button" onClick={() => { haptic('light'); setNoticeOpen(true); }}><ScrollText size={18} /><span>航行日誌<small>更新公告與新精靈</small></span><ArrowUpRight size={16} /></button>
        <button type="button" onClick={() => b.setShowEncyclopedia(true)}><BookOpen size={18} />戰鬥圖鑑<ArrowUpRight size={16} /></button>
      </div>
    </div>
    {drawer && <SettingsDrawer b={b} onClose={() => setDrawer(false)} onSetup={() => { setDrawer(false); b.setEditingElf(null); b.setEditorTab(undefined); b.setView('bag'); }} />}
      {noticeOpen && <NoticeSheet onClose={() => setNoticeOpen(false)} elves={b.allElvesCombined} />}
  </section>;
}