import { lazy, Suspense, useState, type ReactNode } from 'react';
import type { Elf, Skill } from '../types';
const LazyBlocks = lazy(() => import('./LazyBlockProgramView'));
/** 唯讀積木不載入 Blockly SVG 工作區；未開啟時也不載入解析器／登記表。 */
export function EffectBlockToggle(props: { elf?: Elf; skill?: Skill; trait?: { name: string; description: string }; children: ReactNode }) {
  const [blocks, setBlocks] = useState(false);
  return <div><nav aria-label="效果呈現方式" className="ios-segment inline-flex mt-3">
    <button type="button" data-active={!blocks} onClick={() => setBlocks(false)}>描述</button>
    <button type="button" data-active={blocks} onClick={() => setBlocks(true)}>積木／實裝核對</button>
  </nav><div className="mt-3">{blocks ? <Suspense fallback={<p className="text-sm text-slate-400">載入語意積木…</p>}><LazyBlocks {...props} /></Suspense> : props.children}</div></div>;
}
