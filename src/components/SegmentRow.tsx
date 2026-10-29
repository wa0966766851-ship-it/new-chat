import React from 'react';
/** 設定列：左側標籤、右側 ios-segment 分段按鈕；細節放按鈕／標籤的 tooltip。窄版排列統一由 CSS（.seg-row）處理。 */
export interface SegmentOption<T extends string = string> { value: T; label: string; tip?: string }
interface SegmentRowProps<T extends string> {
  label: string; tip?: string; ariaLabel: string; value: T;
  options: SegmentOption<T>[]; onChange: (value: T) => void;
  /** compact：控制中心用，不加外框分隔線與左右內距。 */
  compact?: boolean;
}
export function SegmentRow<T extends string>({ label, tip, ariaLabel, value, options, onChange, compact = false }: SegmentRowProps<T>) {
  return <div className={`seg-row ${compact ? 'seg-row-compact' : 'seg-row-card'}`}>
    <span className={compact ? 'text-xs text-slate-300' : 'text-[15px] text-slate-100'} title={tip}>{label}</span>
    <div className="ios-segment" role="radiogroup" aria-label={ariaLabel} data-count={options.length}>
      {options.map(o => <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
        data-value={o.value} data-active={o.value === value} title={o.tip} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  </div>;
}
