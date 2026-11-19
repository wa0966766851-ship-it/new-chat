import type { ReactNode } from 'react';

/** 保留原技能欄位；沒有任何合法行動時，整區可點擊／鍵盤空過。 */
export function SkillActionArea({ passOnly, onPass, children }: { passOnly: boolean; onPass: () => void; children: ReactNode }) {
  return <div className="relative h-full" data-skill-pass-area={passOnly ? 'true' : 'false'}
    role={passOnly ? 'button' : undefined} tabIndex={passOnly ? 0 : undefined} aria-label={passOnly ? '點擊空過這回合' : undefined}
    onClickCapture={passOnly ? e => { e.stopPropagation(); onPass(); } : undefined}
    onKeyDown={passOnly ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPass(); } } : undefined}>
    {children}
    {passOnly && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-slate-100 font-bold pointer-events-none" data-skill-pass-hint>點擊空過這回合</div>}
  </div>;
}
