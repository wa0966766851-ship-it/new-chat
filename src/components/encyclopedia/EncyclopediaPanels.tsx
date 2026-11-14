/**
 * 戰鬥百科獨立頁面：總索引、結算節點、玩法指南、機制說明。
 * 內容直接來自共用資料表，避免畫面上的規則與引擎定義分歧。
 */
import React, { useMemo, useState } from 'react';
import { BATTLE_NODES } from '../../engine/nodes';
import { EFFECT_NODES } from '../../effects/effectNodes';
import { TRIGGER_CAPTIONS } from '../../battle/effectPresentation';
import { encyclopediaIndex, INDEX_KIND_LABEL } from '../../data/encyclopediaIndex';
import type { IndexEntry, IndexKind, IndexTab } from '../../data/encyclopediaIndex';
import { MECHANIC_GROUPS, MECHANIC_TOPICS, MODE_GUIDES } from '../../data/encyclopediaGuide';
import { searchList } from '../../utils/textSearch';

type JumpToEntry = (tab: IndexTab, entry: IndexEntry) => void;

const KINDS: IndexKind[] = [
  'battleNode', 'effectNode', 'trigger', 'op', 'status', 'effect', 'rule', 'mechanic', 'mode',
];

export function IndexSearchPanel({ onJump }: { onJump: JumpToEntry }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<IndexKind | 'all'>('all');
  const [activeId, setActiveId] = useState('');
  const entries = useMemo(() => encyclopediaIndex(), []);
  const found = useMemo(() => {
    const inKind = kind === 'all' ? entries : entries.filter(e => e.kind === kind);
    return searchList(inKind, query, e => ({
      title: e.title,
      tags: [...e.tags, INDEX_KIND_LABEL[e.kind], e.code ?? '', e.id],
      body: [e.body, e.code ?? '', e.id],
    }));
  }, [entries, query, kind]);
  const selected = found.find(e => e.id === activeId) ?? found[0];
  const shown = found.slice(0, 120);

  return (
    <section className="enc-search" aria-label="百科總索引">
      <div className="enc-intro">
        <div><small>DATABASE / GENERAL INDEX</small><h3>戰鬥百科總索引</h3>
          <p>一次搜尋戰鬥節點、觸發詞、積木、異常、判定規則與玩法，點選條目查看詳細內容。</p></div>
        <strong>{entries.length}<small> 筆索引</small></strong>
      </div>
      <label className="enc-field">
        <span>全文檢索</span>
        <input aria-label="搜尋百科" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="輸入名稱、代號、編號或規則關鍵字…" autoComplete="off" />
      </label>
      <div className="enc-filters" aria-label="篩選資料類別">
        <button type="button" data-active={kind === 'all'} onClick={() => { setKind('all'); setActiveId(''); }}>全部</button>
        {KINDS.map(k => <button type="button" key={k} data-active={kind === k}
          onClick={() => { setKind(k); setActiveId(''); }}>{INDEX_KIND_LABEL[k]}</button>)}
      </div>
      <div className="enc-index-layout">
        <div className="enc-results" aria-label="百科搜尋結果">
          <div className="enc-count">符合 {found.length} 筆{found.length > shown.length ? '（顯示前 120 筆，請繼續輸入關鍵字）' : ''}</div>
          {shown.map(entry => (
            <button type="button" className="enc-row" key={entry.id} data-active={selected?.id === entry.id}
              onClick={() => setActiveId(entry.id)}>
              <div><span>{entry.title}</span>{entry.code && <code>{entry.code}</code>}</div>
              <small>{INDEX_KIND_LABEL[entry.kind]}</small>
            </button>
          ))}
          {found.length === 0 && <p className="enc-empty">沒有符合條件的百科條目，試試其他名稱或代號。</p>}
        </div>
        <div className="enc-detail" aria-live="polite">
          {selected ? (
            <>
              <div className="enc-kicker">{INDEX_KIND_LABEL[selected.kind]}</div>
              <h4>{selected.title}</h4>
              {selected.code && <code className="enc-code">{selected.code}</code>}
              {!!selected.tags.length && <div className="enc-tags">
                {selected.tags.map((tag, i) => <span key={i}>{tag}</span>)}
              </div>}
              <p className="enc-body">{selected.body || '此條目已收錄於原始分頁，可前往查看更多資訊。'}</p>
              <button type="button" className="enc-go" onClick={() => onJump(selected.tab, selected)}>
                前往「{selected.tab === 'opCodes' ? '積木代號' : selected.tab === 'nodes' ? '戰鬥節點' :
                  selected.tab === 'effectQuery' ? '效果查詢' : selected.tab === 'status' ? '異常狀態' :
                  selected.tab === 'mechanics' ? '戰鬥機制' : '玩法說明'}」查看 →
              </button>
            </>
          ) : <p className="enc-empty">選擇一個搜尋結果以查看詳細內容。</p>}
        </div>
      </div>
    </section>
  );
}

export function NodeAtlasPanel({ focus }: { focus?: string }) {
  const [query, setQuery] = useState(focus ?? '');
  const nodeList = useMemo(() => Object.entries(EFFECT_NODES), []);
  const triggerList = useMemo(() => Object.entries(TRIGGER_CAPTIONS), []);
  const q = query.trim().toLowerCase();
  const visibleNodes = nodeList.filter(([key, n]) =>
    !q || [key, n.label, n.trigger, n.phase, n.help].some(t => String(t).toLowerCase().includes(q)));
  const visibleTriggers = triggerList.filter(([key, label]) =>
    !q || [key, label].some(t => String(t).toLowerCase().includes(q)));

  return <section className="enc-atlas">
    <div className="enc-intro">
      <div><small>BATTLE FLOW / NODE ATLAS</small><h3>戰鬥結算與效果節點</h3>
        <p>官方結算順序、效果事件和觸發詞以引擎實際定義為準。</p></div>
    </div>
    <h4>官方戰鬥節點 <small>{BATTLE_NODES.length}</small></h4>
    <div className="enc-steps">
      {BATTLE_NODES.map(node => <div className="enc-step" key={node.id}>
        <code>{node.id}</code><span>{node.name}</span>
      </div>)}
    </div>
    <label className="enc-field"><span>搜尋效果節點與觸發詞</span>
      <input aria-label="搜尋戰鬥節點" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="例如：round_end、登場、damage" />
    </label>
    <h4>效果事件節點 <small>{visibleNodes.length} / {nodeList.length}</small></h4>
    <div className="enc-table-wrap"><table className="enc-table">
      <thead><tr><th>節點代號</th><th>顯示名稱</th><th>階段</th><th>觸發詞</th><th>說明</th></tr></thead>
      <tbody>{visibleNodes.map(([key, n]) => <tr data-node={key} key={key}>
        <td><code>{key}</code></td><td>{n.label}</td><td>{n.phase}</td><td><code>{n.trigger}</code></td><td>{n.help}</td>
      </tr>)}</tbody>
    </table>{visibleNodes.length === 0 && <p className="enc-empty">沒有符合的效果節點。</p>}</div>
    <h4>描述觸發詞 <small>{visibleTriggers.length} / {triggerList.length}</small></h4>
    <div className="enc-table-wrap"><table className="enc-table">
      <thead><tr><th>觸發詞</th><th>顯示名稱</th></tr></thead>
      <tbody>{visibleTriggers.map(([key, label]) => <tr data-trigger={key} key={key}>
        <td><code>{key}</code></td><td>{label}</td>
      </tr>)}</tbody>
    </table>{visibleTriggers.length === 0 && <p className="enc-empty">沒有符合的觸發詞。</p>}</div>
  </section>;
}

export function MechanicsPanel() {
  return <section className="enc-mechanics">
    <div className="enc-intro"><div><small>RULES / MECHANICS</small><h3>戰鬥機制</h3>
      <p>由共用機制資料維護，避免規則頁與模擬器定義分歧。</p></div></div>
    {MECHANIC_GROUPS.map(group => {
      const topics = MECHANIC_TOPICS.filter(topic => topic.group === group.id);
      return <div className="enc-group" key={group.id}>
        <h4>{group.title}<small>{group.hint}</small></h4>
        <div className="enc-card-grid">{topics.map(topic =>
          <article className="enc-card" data-topic={topic.id} key={topic.id}>
            <small>{topic.tag}</small><h5>{topic.title}</h5><p>{topic.body}</p>
          </article>)}</div>
      </div>;
    })}
  </section>;
}

export function ModeGuidePanel() {
  return <section className="enc-modes">
    <div className="enc-intro"><div><small>GAME MODES / PLAYER GUIDE</small><h3>玩法說明</h3>
      <p>對戰模式、特殊挑戰與養成工具的入口和規則。</p></div></div>
    <div className="enc-card-grid">
      {MODE_GUIDES.map(mode => <article className="enc-card" data-mode={mode.id} key={mode.id}>
        <small>{mode.tag}</small><h5>{mode.title}</h5>
        <p>{mode.summary}</p><div className="enc-entry">入口：{mode.entry}</div>
        <ul>{mode.rules.map((rule, i) => <li key={i}>{rule}</li>)}</ul>
      </article>)}
    </div>
  </section>;
}
