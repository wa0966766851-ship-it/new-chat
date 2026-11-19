// 戰鬥百科整合面板（2026-11-14）：總索引、戰鬥節點、戰鬥機制、玩法說明。
// 只讀資料，不含戰鬥邏輯。
import React, { useMemo, useState } from 'react';
import { encyclopediaIndex, INDEX_KIND_LABEL, type IndexEntry, type IndexKind, type IndexTab } from '../../data/encyclopediaIndex';
import { BATTLE_NODES, DEATH_NODE_ID } from '../../engine/nodes';
import { EFFECT_NODES } from '../../effects/effectNodes';
import { TRIGGER_CAPTIONS } from '../../battle/effectPresentation';
import { MECHANIC_GROUPS, MECHANIC_TOPICS, MODE_GUIDES } from '../../data/encyclopediaGuide';
import { searchList } from '../../utils/textSearch';

const KINDS: IndexKind[] = ['mechanic', 'mode', 'battleNode', 'effectNode', 'trigger', 'op', 'status', 'effect', 'rule', 'template'];
const EDITOR_BRIDGE_KEY = 'seer_selected_effect_for_ai';

/** 參考詞庫（原「效果查詢」的標準語法模板）：體積大，進入總索引後才載入。 */
function useTemplateEntries(): IndexEntry[] {
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  React.useEffect(() => {
    let alive = true;
    Promise.all([import('../../data/cardTemplates'), import('../../utils/templateReview')]).then(([cards, review]) => {
      if (!alive) return;
      setEntries(cards.REAL_CARD_EFFECT_MODULES.filter(m => !review.getTemplateReviewReason(m.standardSyntax)).map(m => ({
        id: `tp:${m.id}`, kind: 'template' as const, title: m.name, code: review.getTemplateTimingLabel(m.standardSyntax),
        tags: [m.source, m.effectType, ...m.tags], body: m.standardSyntax, tab: 'search' as const })));
    }).catch(() => { /* 參考詞庫載入失敗時只顯示其他條目 */ });
    return () => { alive = false; };
  }, []);
  return entries;
}
const PAGE = 80;

export const IndexSearchPanel: React.FC<{ onJump: (tab: IndexTab, entry: IndexEntry) => void }> = ({ onJump }) => {
  const templates = useTemplateEntries();
  const all = useMemo(() => [...encyclopediaIndex(), ...templates], [templates]);
  const [sent, setSent] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferred = React.useDeferredValue(query);
  const [kind, setKind] = useState<IndexKind | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(null);

  const matched = useMemo(() => searchList<IndexEntry>(all, deferred, e => ({ title: e.title, tags: [e.code, ...e.tags], body: [e.body, e.id] })), [all, deferred]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of matched) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [matched]);
  const shown = kind === 'all' ? matched : matched.filter(e => e.kind === kind);
  const current = shown.find(e => e.id === selected) ?? shown[0];

  React.useEffect(() => { setLimit(PAGE); }, [deferred, kind]);

  return (
    <div data-enc-index>
      <div className="enc-panel">
        <div className="enc-search">
          <input
            aria-label="搜尋百科"
            placeholder="節點、積木代號、異常、機制、玩法…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="enc-chip" title="符合／總筆數">{matched.length} / {all.length}</span>
        </div>
        <div className="enc-pills" role="tablist">
          <button className="enc-pill" data-on={kind === 'all'} onClick={() => setKind('all')}>全部<b>{matched.length}</b></button>
          {KINDS.map(k => (
            <button key={k} className="enc-pill" data-on={kind === k} data-kind={k} onClick={() => setKind(k)} disabled={!counts[k]}>
              {INDEX_KIND_LABEL[k]}<b>{counts[k] ?? 0}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="enc-split">
        <div className="enc-list">
          {shown.length === 0 && <div className="enc-empty">沒有符合的條目</div>}
          {shown.slice(0, limit).map(e => (
            <button key={e.id} className="enc-row" data-active={current?.id === e.id} onClick={() => setSelected(e.id)} title={e.body.split('\n')[0]}>
              <small>{INDEX_KIND_LABEL[e.kind]}</small>
              <b>{e.title}</b>
              {e.code ? <code>{e.code}</code> : <span />}
            </button>
          ))}
          {shown.length > limit && <button className="enc-more" onClick={() => setLimit(l => l + PAGE)}>再顯示 {Math.min(PAGE, shown.length - limit)} 筆（剩 {shown.length - limit}）</button>}
        </div>
        {current && (
          <aside className="enc-panel enc-detail" data-enc-detail={current.id}>
            <div className="enc-panel-head"><h3>{current.title}</h3><span className="enc-chip">{INDEX_KIND_LABEL[current.kind]}</span></div>
            <dl>
              {current.code && (<><dt>代號</dt><dd className="enc-code">{current.code}</dd></>)}
              {current.tags.length > 0 && (<><dt>標籤</dt><dd>{current.tags.filter(Boolean).join('・')}</dd></>)}
            </dl>
            {current.body && <p className="enc-text" style={{ marginTop: 10 }}>{current.body}</p>}
            {current.kind === 'template' ? (
              <button className="enc-go" title="複製語法並送到精靈編輯器的 AI 提示詞" onClick={() => {
                try { window.localStorage.setItem(EDITOR_BRIDGE_KEY, JSON.stringify({ name: current.title, syntax: current.body })); setSent(current.id); } catch { /* 無法保存時略過 */ }
                try { void navigator.clipboard?.writeText(current.body)?.catch(() => {}); } catch { /* 無剪貼簿權限 */ }
              }}>{sent === current.id ? '已送到編輯器' : '送到精靈編輯器'}</button>
            ) : current.tab !== 'search' && <button className="enc-go" onClick={() => onJump(current.tab, current)}>前往分頁</button>}
          </aside>
        )}
      </div>
    </div>
  );
};

const PHASE_ORDER = ['開局', '選擇與出手', '傷害結算', '行動收尾', '回合收尾', '切換與陣亡', '事件監控'];
const DEATH_IDS = new Set<string>(Object.values(DEATH_NODE_ID));

export const NodeAtlasPanel: React.FC<{ focus?: string }> = ({ focus }) => {
  const [query, setQuery] = useState(focus ?? '');
  const nodes = useMemo(() => Object.entries(EFFECT_NODES).map(([key, n]) => ({ key, ...n })), []);
  const shownNodes = useMemo(() => searchList<typeof nodes[number]>(nodes, query, n => ({ title: n.label, tags: [n.key, n.trigger, n.phase], body: [n.help, n.derived ?? ''] })), [nodes, query]);
  const triggers = useMemo(() => Object.entries(TRIGGER_CAPTIONS).map(([trigger, caption]) => ({ trigger, caption })), []);
  const shownTriggers = useMemo(() => searchList<typeof triggers[number]>(triggers, query, t => ({ title: t.caption, tags: [t.trigger] })), [triggers, query]);

  return (
    <div data-enc-nodes>
      <div className="enc-panel">
        <div className="enc-panel-head"><h3>官方戰鬥節點</h3><span className="enc-chip">{BATTLE_NODES.length}</span></div>
        <div className="enc-timeline">
          {BATTLE_NODES.map(n => (
            <div key={n.id} className="enc-step" data-death={DEATH_IDS.has(n.id)} title={n.id.startsWith('3.') && n.id !== '3.10' ? '後手方沿用同一節點（官方 4.x）' : undefined}>
              <code>{n.id}</code><span>{n.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="enc-panel">
        <div className="enc-search">
          <input aria-label="搜尋節點" placeholder="搜尋效果節點或觸發詞" value={query} onChange={e => setQuery(e.target.value)} />
          <span className="enc-chip">{shownNodes.length + shownTriggers.length}</span>
        </div>
      </div>
      {PHASE_ORDER.map(phase => {
        const list = shownNodes.filter(n => n.phase === phase);
        if (!list.length) return null;
        return (
          <div key={phase} className="enc-panel">
            <div className="enc-panel-head"><h3>{phase}</h3><span className="enc-chip">{list.length}</span></div>
            <table className="enc-table">
              <thead><tr><th>節點</th><th>觸發詞</th><th>說明</th></tr></thead>
              <tbody>
                {list.map(n => (
                  <tr key={n.key} data-node={n.key}>
                    <td><b>{n.label}</b><div className="enc-code">{n.key}</div></td>
                    <td className="enc-code">{n.trigger}</td>
                    <td>{n.help}{n.derived ? <div style={{ color: '#8fb3c4' }}>衍生：{n.derived}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <div className="enc-panel">
        <div className="enc-panel-head"><h3>觸發詞</h3><span className="enc-chip">{shownTriggers.length}</span></div>
        <table className="enc-table">
          <thead><tr><th>觸發詞</th><th>描述前綴</th></tr></thead>
          <tbody>
            {shownTriggers.map(t => (<tr key={t.trigger} data-trigger={t.trigger}><td className="enc-code">{t.trigger}</td><td>{t.caption}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const MechanicsPanel: React.FC = () => (
  <div data-enc-mechanics>
    {MECHANIC_GROUPS.map(g => {
      const topics = MECHANIC_TOPICS.filter(t => t.group === g.id);
      return (
        <div key={g.id} className="enc-panel">
          <div className="enc-panel-head"><h3 title={g.hint}>{g.title}</h3><span className="enc-chip">{topics.length}</span></div>
          <div className="enc-grid">
            {topics.map(t => (
              <div key={t.id} className="enc-card" data-topic={t.id}>
                <div className="enc-card-head"><b>{t.title}</b><span className="enc-chip">{t.tag}</span></div>
                <p className="enc-text">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export const ModeGuidePanel: React.FC = () => (
  <div className="enc-grid" data-enc-modes>
    {MODE_GUIDES.map(g => (
      <div key={g.id} className="enc-card" data-mode={g.id}>
        <div className="enc-card-head"><b>{g.title}</b><span className="enc-chip">{g.tag}</span></div>
        <p className="enc-text">{g.summary}</p>
        <ul>{g.rules.map(r => <li key={r}>{r}</li>)}</ul>
        <div style={{ marginTop: 8, fontSize: 11, color: '#8fb3c4' }}>入口：{g.entry}</div>
      </div>
    ))}
  </div>
);
