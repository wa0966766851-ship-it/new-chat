// 2026-11-14 Aegis 精靈培養頁：與舊版詳情同功能（能力／性格／學習力、抗性、魂印特質、刻印、技能替換、資料），
// 但版面與元件全部重做為 Aegis／戰鬥介面風格。資料寫回沿用 StartScreen 的同一個 onChange（倉庫＋隊伍同步）。
import React, { Suspense, lazy, useMemo, useState } from "react";
import { X, Pencil, Info, Crown, ArrowLeftRight } from "lucide-react";
import type { BaseStats, Elf, ElfResistances, Inscription, ResistanceSlot, Skill } from "../../types";
import { ElfAvatar, TypeIcon, SkillTypeIcon } from "../../components/SeerImages";
import { EffectDescription } from "../../components/EffectDescription";
import { InscriptionSlot } from "../../components/InscriptionSlot";
import { ElfSkinPicker } from "../../components/ElfSkinPicker";
import { SEER_NATURES, getNatureFromModifiers, getModifiersFromNature, getDefaultNatureModifiers, EV_PRESETS } from "../../utils/seerNatures";
import { calculateElfStats, getDefaultEvs } from "../../utils/statCalculator";
import { defaultResistances } from "../../battle/resistances";
import { statusOptionsFor } from "../../effects/statusIdentity";
import { fifthSkillSlot } from "../../battle/skillSlot";
import { validateSkillStoneLoadout, skillConfigurationKey } from "../../data/skillStones";
import { getElfDisplayRank } from "../../utils/elfDisplayRank";
import "../art/aegisTraining.css";

const SkillStonePicker = lazy(() => import("../../components/SkillStonePicker"));

type Tab = "stats" | "resist" | "soul" | "insc" | "skill" | "info";
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "stats", icon: "⚔", label: "能力" }, { key: "resist", icon: "🛡", label: "抗性" }, { key: "soul", icon: "✦", label: "魂印" },
  { key: "insc", icon: "◈", label: "刻印" }, { key: "skill", icon: "☰", label: "技能" }, { key: "info", icon: "ⓘ", label: "資料" },
];
const STAT_KEYS = ["hp", "atk", "def", "spatk", "spdef", "speed"] as const;
const STAT_LABEL: Record<string, string> = { hp: "體力", atk: "攻擊", def: "防禦", spatk: "特攻", spdef: "特防", speed: "速度" };
const EV_TOTAL = 510, EV_MAX = 255;
const CONTROL = statusOptionsFor("CONTROL"), WEAKENING = statusOptionsFor("WEAKENING");

export interface AegisTrainingProps {
  elf: Elf;
  /** 技能池來源（倉庫最新版＋內建定義）；由呼叫端提供。 */
  skillSources: Elf[];
  readonly?: boolean;
  onChange: (next: Elf) => void;
  onClose: () => void;
  onEdit?: () => void;
  onIntro?: () => void;
  onEditInscription: (index: number) => void;
}

const withStats = (elf: Elf): Elf => {
  const stats = calculateElfStats(elf.baseStats, elf.level || 100, elf.ivs, elf.evs, elf.natureModifiers,
    elf.inscriptions as Inscription[], elf.guildBonuses, elf.hasAnnualBonus);
  return { ...elf, calculatedStats: stats, maxHp: stats.hp, currentHp: stats.hp };
};

export function AegisTraining({ elf, skillSources, readonly, onChange, onClose, onEdit, onIntro, onEditInscription }: AegisTrainingProps) {
  const [tab, setTab] = useState<Tab>("stats");
  const stats = useMemo(() => withStats(elf).calculatedStats, [elf]);
  const rank = getElfDisplayRank(elf);
  return (
    <div className="atr-root" role="dialog" aria-modal="true" aria-label={`${elf.name} 培養`} data-aegis-training onClick={onClose}>
      <div className="atr-sheet" onClick={e => e.stopPropagation()}>
        <span className="atr-orbit" aria-hidden />
        <header className="atr-head">
          <div className="atr-avatar"><ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" /></div>
          <div className="min-w-0 flex-1">
            <p className="atr-kicker">TRAINING · #{elf.id}</p>
            <h2 className="atr-name"><TypeIcon type={elf.type} size={22} showLabelWhenMissing={false} /><span className="truncate">{elf.name}</span>{rank && <b className="atr-rank" title="命運之輪分級">{rank}</b>}</h2>
            <div className="atr-hp" title={`體力 ${stats.hp}`}><span>HP</span><i /><b>{stats.hp}</b></div>
          </div>
          <div className="atr-actions">
            {onIntro && <button type="button" className="atr-icon" title="精靈介紹" aria-label="精靈介紹" onClick={onIntro}><Info size={16} /></button>}
            {onEdit && <button type="button" className="atr-icon" title="編輯精靈" aria-label="編輯精靈" onClick={onEdit}><Pencil size={16} /></button>}
            <button type="button" className="atr-icon" title="關閉" aria-label="關閉" onClick={onClose}><X size={16} /></button>
          </div>
        </header>
        <div className="atr-body">
          <nav className="atr-rail" role="tablist" aria-label="培養分頁">
            {TABS.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-active={tab === t.key} title={t.label} onClick={() => setTab(t.key)}>
                <span aria-hidden>{t.icon}</span><small>{t.label}</small>
              </button>
            ))}
          </nav>
          <section className="atr-content" data-tab={tab}>
            {tab === "stats" && <StatsTab elf={elf} stats={stats} readonly={readonly} onChange={next => onChange(withStats(next))} />}
            {tab === "resist" && <ResistTab elf={elf} readonly={readonly} onChange={onChange} />}
            {tab === "soul" && <SoulTab elf={elf} />}
            {tab === "insc" && <InscTab elf={elf} readonly={readonly} onEdit={onEditInscription} />}
            {tab === "skill" && <SkillTab elf={elf} sources={skillSources} readonly={readonly} onChange={onChange} />}
            {tab === "info" && <InfoTab elf={elf} readonly={readonly} onChange={onChange} />}
          </section>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode; key?: React.Key }) {
  return <div className="atr-panel"><div className="atr-panel-head"><h3>{title}</h3>{aside}</div>{children}</div>;
}

function StatsTab({ elf, stats, readonly, onChange }: { elf: Elf; stats: BaseStats; readonly?: boolean; onChange: (e: Elf) => void }) {
  const evs = (elf.evs || getDefaultEvs(elf.baseStats)) as BaseStats;
  const mods = (elf.natureModifiers || getDefaultNatureModifiers(elf.baseStats)) as Record<string, number>;
  const nature = getNatureFromModifiers(mods as any, elf.baseStats);
  const total = STAT_KEYS.reduce((n, k) => n + (Number(evs[k]) || 0), 0);
  const setEv = (k: keyof BaseStats, v: number) => {
    const others = total - (Number(evs[k]) || 0);
    const value = Math.max(0, Math.min(EV_MAX, EV_TOTAL - others, Math.floor(v || 0)));
    onChange({ ...elf, evs: { ...evs, [k]: value } });
  };
  const groups = ["物攻", "特攻", "速度", "防禦", "特防", "平衡"] as const;
  return (<>
    <div className="atr-stats">
      {STAT_KEYS.map(k => {
        const m = mods[k] || 1;
        return (
          <div key={k} className="atr-stat" data-up={k !== "hp" && m > 1.01} data-down={k !== "hp" && m < 0.99}
            title={`${STAT_LABEL[k]}：種族 ${(elf.baseStats as any)?.[k] ?? 0}・學習力 ${evs[k] ?? 0}${m !== 1 ? `・性格 ×${m}` : ""}`}>
            <small>{STAT_LABEL[k]}{k !== "hp" && m > 1.01 ? " ▲" : k !== "hp" && m < 0.99 ? " ▼" : ""}</small>
            <b>{(stats as any)[k]}</b>
            <i>{(elf.baseStats as any)?.[k] ?? 0}</i>
          </div>
        );
      })}
    </div>
    <Panel title="性格" aside={<span className="atr-chip">{nature.name}</span>}>
      <select className="atr-select" disabled={readonly} value={nature.name} aria-label="性格"
        onChange={e => onChange({ ...elf, natureModifiers: getModifiersFromNature(e.target.value) })}>
        {groups.map(g => <optgroup key={g} label={g}>{SEER_NATURES.filter(n => n.category === g).map(n => <option key={n.name} value={n.name}>{n.name}　{n.description}</option>)}</optgroup>)}
      </select>
    </Panel>
    <Panel title="學習力" aside={<span className="atr-chip" data-warn={total > EV_TOTAL} title={`總和上限 ${EV_TOTAL}、單項上限 ${EV_MAX}`}>Σ {total}/{EV_TOTAL}</span>}>
      <div className="atr-presets">
        {EV_PRESETS.map(p => <button key={p.name} type="button" className="atr-pill" disabled={readonly} title={p.desc} onClick={() => onChange({ ...elf, evs: { ...p.evs } })}>{p.name}</button>)}
      </div>
      <div className="atr-evs">
        {STAT_KEYS.map(k => (
          <label key={k} className="atr-ev">
            <span>{STAT_LABEL[k]}</span>
            <input type="range" min={0} max={EV_MAX} value={evs[k] ?? 0} disabled={readonly} onChange={e => setEv(k, Number(e.target.value))} aria-label={`${STAT_LABEL[k]}學習力`} />
            <input type="number" min={0} max={EV_MAX} value={evs[k] ?? 0} disabled={readonly} onChange={e => setEv(k, Number(e.target.value))} aria-label={`${STAT_LABEL[k]}學習力數值`} />
          </label>
        ))}
      </div>
    </Panel>
  </>);
}

function ResistTab({ elf, readonly, onChange }: { elf: Elf; readonly?: boolean; onChange: (e: Elf) => void }) {
  const res: ElfResistances = elf.resistances || defaultResistances();
  const set = (next: ElfResistances) => onChange({ ...elf, resistances: next });
  const bonus = res.statusResist.allImmune ? 5 : 0;
  const slots = res.statusResist.slots || [];
  const setSlot = (id: string, patch: Partial<ResistanceSlot>) => set({ ...res, statusResist: { ...res.statusResist,
    slots: slots.map(s => s.id === id ? { ...s, ...patch } : s), selectedStatuses: slots.map(s => s.id === id ? (patch.status ?? s.status) : s.status).filter(Boolean) as string[] } });
  const dmg = [["crit", "致命"], ["fixed", "固定"], ["percent", "百分比"]] as const;
  return (<>
    <Panel title="傷害抗性" aside={<div className="flex gap-1">
      <button type="button" className="atr-pill" disabled={readonly} title="全部設為上限" onClick={() => set(defaultResistances())}>MAX</button>
      <button type="button" className="atr-pill" disabled={readonly} title="傷害抗性歸零" onClick={() => set({ ...res, damageResist: { crit: 0, fixed: 0, percent: 0 } })}>0</button>
    </div>}>
      <div className="atr-evs">
        {dmg.map(([k, l]) => (
          <label key={k} className="atr-ev"><span>{l}</span>
            <input type="range" min={0} max={35} value={res.damageResist[k]} disabled={readonly} aria-label={`${l}傷害抗性`}
              onChange={e => set({ ...res, damageResist: { ...res.damageResist, [k]: Number(e.target.value) } })} />
            <b className="atr-val">{res.damageResist[k]}%</b>
          </label>
        ))}
      </div>
    </Panel>
    <Panel title="異常抗性" aside={<button type="button" className="atr-pill" data-on={res.statusResist.allImmune} disabled={readonly} title="全異常 +5%"
      onClick={() => set({ ...res, statusResist: { ...res.statusResist, allImmune: !res.statusResist.allImmune } })}>全免 +5%</button>}>
      <div className="atr-slots">
        {slots.map(s => (
          <div key={s.id} className="atr-slot" data-cat={s.category}>
            <small>{s.category === "control" ? "控制" : "弱化"}</small>
            <select className="atr-select" value={s.status} disabled={readonly} aria-label="抗性異常" onChange={e => setSlot(s.id, { status: e.target.value })}>
              {(s.category === "control" ? CONTROL : WEAKENING).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input type="range" min={0} max={50} value={s.rate} disabled={readonly} aria-label={`${s.status}抗性`} onChange={e => setSlot(s.id, { rate: Number(e.target.value) })} />
            <b className="atr-val" title={`基礎 ${s.rate}%${bonus ? "＋全免 5%" : ""}`}>{s.rate + bonus}%</b>
          </div>
        ))}
      </div>
    </Panel>
  </>);
}

function SoulTab({ elf }: { elf: Elf }) {
  const traits = [elf.alienTraits?.gen2Trait, (elf.alienTraits as any)?.exclusiveTrait, ...(((elf.alienTraits as any)?.exclusiveTraits) || [])].filter(Boolean) as any[];
  const seen = new Set<string>();
  return (<>
    {elf.soulMark && <Panel title={`魂印「${elf.soulMark.badgeChar || (elf.soulMark.name || "").slice(0, 1)}」`} aside={<span className="atr-chip">{elf.soulMark.name}</span>}>
      <EffectDescription description={elf.soulMark.description} className="atr-text" />
    </Panel>}
    {traits.filter(t => { const k = t.name || t.description; if (seen.has(k)) return false; seen.add(k); return true; }).map((t, i) => (
      <Panel key={i} title={t.name || "特質"}><EffectDescription description={t.description} className="atr-text" /></Panel>
    ))}
    {!elf.soulMark && !traits.length && <p className="atr-empty">—</p>}
  </>);
}

function InscTab({ elf, readonly, onEdit }: { elf: Elf; readonly?: boolean; onEdit: (i: number) => void }) {
  return (
    <Panel title="刻印" aside={<span className="atr-chip">{(elf.inscriptions || []).filter(Boolean).length}/3</span>}>
      <div className="atr-insc">
        {[0, 1, 2].map(i => <InscriptionSlot key={i} index={i} inscription={elf.inscriptions?.[i]} onClick={() => !readonly && onEdit(i)} size="md" />)}
      </div>
    </Panel>
  );
}

function SkillTab({ elf, sources, readonly, onChange }: { elf: Elf; sources: Elf[]; readonly?: boolean; onChange: (e: Elf) => void }) {
  const [replacing, setReplacing] = useState<number | null>(null);
  const fifth = fifthSkillSlot(elf.skills);
  const pool = useMemo(() => {
    const map = new Map<string, Skill>();
    for (const src of [elf, ...sources]) for (const s of [...(src.skillPool || []), ...(src.skills || [])]) if (s?.name) map.set(skillConfigurationKey(s), s);
    return [...map.values()];
  }, [elf, sources]);
  const replace = (slot: number, sk: Skill) => {
    const next = [...elf.skills];
    const at = next.findIndex((s, i) => i !== slot && s && skillConfigurationKey(s) === skillConfigurationKey(sk));
    if (at >= 0) next[at] = { ...next[slot] };
    next[slot] = { ...sk };
    try { validateSkillStoneLoadout(elf, next); } catch (e) { alert((e as Error).message); return; }
    onChange({ ...elf, skills: next }); setReplacing(null);
  };
  if (replacing !== null) {
    const isFifth = replacing === fifth;
    const list = pool.filter(s => isFifth ? s.isFifthSkill : !s.isFifthSkill);
    return (
      <Panel title={`${isFifth ? "第五技能" : `第 ${replacing + 1} 格`} → 替換`} aside={<button type="button" className="atr-icon" aria-label="返回" title="返回" onClick={() => setReplacing(null)}><X size={14} /></button>}>
        {!isFifth && <Suspense fallback={null}><SkillStonePicker elf={elf} slot={replacing} onEquip={next => { onChange(next); setReplacing(null); }} /></Suspense>}
        <div className="atr-skills">
          {list.map(s => {
            const current = skillConfigurationKey(elf.skills[replacing] || ({} as Skill)) === skillConfigurationKey(s);
            const equipped = !current && elf.skills.some(x => x && skillConfigurationKey(x) === skillConfigurationKey(s));
            return <SkillCard key={skillConfigurationKey(s)} skill={s} fifth={isFifth} state={current ? "current" : equipped ? "equipped" : undefined}
              onClick={current ? undefined : () => replace(replacing, s)} />;
          })}
          {!list.length && <p className="atr-empty">—</p>}
        </div>
      </Panel>
    );
  }
  return (
    <div className="atr-skills">
      {elf.skills.map((s, i) => s && <SkillCard key={i} skill={s} fifth={i === fifth}
        action={!readonly ? <button type="button" className="atr-icon" title="替換技能" aria-label={`替換 ${s.name}`} onClick={() => setReplacing(i)}><ArrowLeftRight size={14} /></button> : undefined} />)}
    </div>
  );
}

function SkillCard({ skill, fifth, state, action, onClick }: { skill: Skill; fifth?: boolean; state?: "current" | "equipped"; action?: React.ReactNode; onClick?: () => void; key?: React.Key }) {
  return (
    <div className="atr-skill" data-fifth={fifth || undefined} data-state={state} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} onKeyDown={e => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}>
      <div className="atr-skill-head">
        <SkillTypeIcon skill={skill} size={22} />
        <b className="truncate">{fifth && <Crown size={13} className="inline mr-1 -mt-0.5" />}{skill.name}</b>
        <span className="atr-skill-meta" title={`${skill.category}・威力 ${skill.power || 0}・PP ${skill.pp}/${skill.maxPp ?? skill.pp}${skill.priority ? `・先制 ${skill.priority > 0 ? "+" : ""}${skill.priority}` : ""}`}>
          {skill.category === "屬性" ? "屬性" : `⚡${skill.power || 0}`} · PP {skill.maxPp ?? skill.pp}
        </span>
        {state === "current" && <span className="atr-chip">裝備中</span>}
        {state === "equipped" && <span className="atr-chip" title="選擇後與目前格互換">⇄</span>}
        {action}
      </div>
      <EffectDescription skill={skill} className="atr-text atr-skill-desc" />
    </div>
  );
}

function InfoTab({ elf, readonly, onChange }: { elf: Elf; readonly?: boolean; onChange: (e: Elf) => void }) {
  return (<>
    <Panel title="資料">
      <dl className="atr-info">
        <dt>ID</dt><dd>#{elf.id}</dd>
        <dt>系別</dt><dd><TypeIcon type={elf.type} size={16} showLabelWhenMissing={false} /> {elf.type}系</dd>
        <dt>身高</dt><dd>{elf.height ?? 0} cm</dd>
        <dt>體重</dt><dd>{elf.weight || "—"} kg</dd>
        <dt>性別</dt><dd>{elf.gender || "無性別"}</dd>
        {getElfDisplayRank(elf) && <><dt>分級</dt><dd>{getElfDisplayRank(elf)}</dd></>}
      </dl>
    </Panel>
    {!readonly && <Panel title="造型"><ElfSkinPicker elf={elf} onChange={onChange} /></Panel>}
    {elf.description && <Panel title="備註"><p className="atr-text whitespace-pre-wrap">{elf.description}</p></Panel>}
  </>);
}
