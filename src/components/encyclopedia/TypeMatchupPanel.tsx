import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Crosshair, RotateCcw } from 'lucide-react';
import { getTypeMatchup, SEER_TYPES } from '../../utils/statCalculator';
import { typeQueryKey } from '../../utils/typeQuery';
import { TypeIcon } from '../SeerImages';
import { useScopedStyle } from '../destiny/injectStyle';
import styles from './typeMatchupCss';

type Overrides = Record<string, Record<string, number>>;
const label = (n: number) => n === 0 ? '無效' : n < 1 ? '微弱' : n > 1 ? '克制' : '普通';
const pairKey = (atk: string, def: string) => atk + '→' + def;
const resolve = (query: string) => typeQueryKey(query, SEER_TYPES);

function TypeLabel({ type }: { type: string }) {
  return <span className="tm-type"><TypeIcon type={type} size={16} showLabelWhenMissing={false} />{type.replace('.', '·')}</span>;
}

function hasOverride(overrides: Overrides, atk: string, def: string) {
  if (atk === '普通' || atk === '無屬性') return false;
  return atk.split('.').some(a => def.split('.').some(d => overrides[a]?.[d] !== undefined));
}

export function TypeMatchupPanel({ customMatchups }: { customMatchups: Overrides }) {
  useScopedStyle('type-matchup', styles);
  const [attackQuery, setAttackQuery] = useState('');
  const [defenseQuery, setDefenseQuery] = useState('');
  const [location, setLocation] = useState<{ key: string }>();
  const selectedCell = useRef<HTMLButtonElement>(null);
  const atk = resolve(attackQuery);
  const def = resolve(defenseQuery);
  const target = atk && def ? pairKey(atk, def) : undefined;

  useEffect(() => {
    if (location?.key !== target || !location) return;
    const cell = selectedCell.current;
    cell?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    cell?.focus({ preventScroll: true });
  }, [location, target]);

  const locate = () => { if (target) setLocation({ key: target }); };
  const axis = [...new Set([...SEER_TYPES, atk, def].filter((type): type is string => Boolean(type)))];
  const fields = [
    { name: '攻擊屬性', value: attackQuery, resolved: atk, set: setAttackQuery, placeholder: '例如 輪迴' },
    { name: '防守屬性', value: defenseQuery, resolved: def, set: setDefenseQuery, placeholder: '例如 水·混沌' },
  ];
  return <section className="tm-panel" aria-label="屬性克制">
    <form className="tm-search" onSubmit={event => { event.preventDefault(); locate(); }}>
      <div className="tm-fields">
        {fields.map(field => <label key={field.name}>
          <span>{field.name}</span>
          <input value={field.value} onChange={event => field.set(event.target.value)} list="tm-single-types"
            placeholder={field.placeholder} autoComplete="off" aria-invalid={Boolean(field.value.trim() && !field.resolved)} />
          {field.value.trim() && !field.resolved && <small>找不到這個屬性</small>}
        </label>)}
      </div>
      <datalist id="tm-single-types">{SEER_TYPES.map(type => <option key={type} value={type} />)}</datalist>
      <div className="tm-tools">
        <button type="submit" disabled={!target}><Crosshair size={16} />定位表格</button>
        <button type="button" onClick={() => { setAttackQuery(defenseQuery); setDefenseQuery(attackQuery); }}><ArrowLeftRight size={16} />交換攻防</button>
        <button type="button" onClick={() => { setAttackQuery(''); setDefenseQuery(''); setLocation(undefined); }}><RotateCcw size={16} />清除搜尋</button>
      </div>
    </form>
    {atk && def && <div className="tm-results" aria-live="polite">
      {[[atk, def], [def, atk]].map(([from, to], index) => {
        const multiplier = getTypeMatchup(from, to);
        return <div className="tm-result" key={index}>
          <TypeLabel type={from} /><span aria-hidden="true">→</span><TypeLabel type={to} />
          <strong data-relation={label(multiplier)}>×{multiplier}</strong>
          <span>{label(multiplier)}{hasOverride(customMatchups, from, to) && ' · 自訂'}</span>
        </div>;
      })}
    </div>}
    <div className="tm-legend">
      <span>列為攻擊，欄為防守</span>
      {['克制', '普通', '微弱', '無效'].map(kind => <span key={kind} data-relation={kind}>{kind}</span>)}
      <span>＊含自訂倍率</span>
    </div>
    <div className="tm-scroll" role="region" aria-label="屬性倍率表" tabIndex={0}>
      <table>
        <thead><tr><th scope="col">攻 ↘ 守</th>{axis.map(type => <th key={type} scope="col" data-axis={def === type || undefined}><TypeLabel type={type} /></th>)}</tr></thead>
        <tbody>{axis.map(from => <tr key={from}>
          <th scope="row" data-axis={atk === from || undefined}><TypeLabel type={from} /></th>
          {axis.map(to => {
            const multiplier = getTypeMatchup(from, to);
            const selected = from === atk && to === def;
            const custom = hasOverride(customMatchups, from, to);
            return <td key={to} data-axis={from === atk || to === def || undefined}>
              <button type="button" ref={selected ? selectedCell : undefined} data-relation={label(multiplier)}
                aria-pressed={selected} tabIndex={selected ? 0 : -1}
                aria-label={from + '攻擊' + to + '，' + multiplier + '倍' + (custom ? '，含自訂倍率' : '')}
                onClick={() => { setAttackQuery(from); setDefenseQuery(to); }}>
                {multiplier}{custom && <sup aria-hidden="true">＊</sup>}
              </button>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

