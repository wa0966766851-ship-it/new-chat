import React, { useState } from "react";
import { ElfResistances, ResistanceSlot } from "../types";
import { Shield, RotateCcw, Sliders, Info, Zap, Flame, Snowflake } from "lucide-react";

const CONTROL_STATUS_OPTIONS = [
  "麻痹", "害怕", "疲憊", "睡眠", "石化", "癱瘓", "冰封", "焚燼", "感染", "神游", "空定", "詛咒", "凝滯", "繳械", "失溫", "束縛", "狂信", "沉睡"
];

const WEAKENING_STATUS_OPTIONS = [
  "中毒", "燒傷", "凍傷", "流血", "混亂", "衰弱", "易燃", "寄生", "失明", "失神", "沉默", "臣服", "沸湧", "腐朽", "遲鈍", "窒息"
];

export function getDefaultResistances(): ElfResistances {
  return {
    damageResist: {
      crit: 35,
      fixed: 35,
      percent: 35,
    },
    statusResist: {
      allImmune: true,
      selectedStatuses: ["麻痹", "害怕", "疲憊", "中毒", "燒傷", "凍傷"],
      slots: [
        { id: "c1", category: "control", status: "麻痹", rate: 10 },
        { id: "c2", category: "control", status: "害怕", rate: 10 },
        { id: "c3", category: "control", status: "疲憊", rate: 10 },
        { id: "w1", category: "weakening", status: "中毒", rate: 10 },
        { id: "w2", category: "weakening", status: "燒傷", rate: 10 },
        { id: "w3", category: "weakening", status: "凍傷", rate: 10 },
      ],
    },
  };
}

interface ResistancePanelProps {
  resistances?: ElfResistances;
  onChange: (newResistances: ElfResistances) => void;
  readonly?: boolean;
}

export default function ResistancePanel({ resistances, onChange, readonly = false }: ResistancePanelProps) {
  const current: ElfResistances = resistances || getDefaultResistances();
  const { damageResist, statusResist } = current;
  const currentSlots: ResistanceSlot[] = statusResist.slots || getDefaultResistances().statusResist.slots!;

  const handleDamageChange = (key: keyof typeof damageResist, val: number) => {
    if (readonly) return;
    val = Math.max(0, Math.min(35, Math.floor(val)));
    onChange({
      ...current,
      damageResist: {
        ...damageResist,
        [key]: val,
      },
    });
  };

  const handleSlotChange = (id: string, field: 'status' | 'rate', value: string | number) => {
    if (readonly) return;
    const nextSlots = currentSlots.map(s => {
      if (s.id === id) {
        return {
          ...s,
          [field]: field === 'rate' ? Math.max(0, Math.min(50, Math.floor(Number(value)))) : value
        };
      }
      return s;
    });

    const nextSelected = nextSlots.map(s => s.status);

    onChange({
      ...current,
      statusResist: {
        ...statusResist,
        slots: nextSlots,
        selectedStatuses: nextSelected,
      },
    });
  };

  const handleToggleAllImmune = () => {
    if (readonly) return;
    onChange({
      ...current,
      statusResist: {
        ...statusResist,
        allImmune: !statusResist.allImmune,
      },
    });
  };

  const handleResetToDefault = () => {
    if (readonly) return;
    onChange(getDefaultResistances());
  };

  const handleResetDamageToZero = () => {
    if (readonly) return;
    onChange({
      ...current,
      damageResist: { crit: 0, fixed: 0, percent: 0 },
    });
  };

  const controlSlots = currentSlots.filter(s => s.category === 'control');
  const weakeningSlots = currentSlots.filter(s => s.category === 'weakening');

  const DMG_ROWS: { key: keyof typeof damageResist; label: string; tip: string; accent: string }[] = [
    { key: "crit", label: "致命一擊", tip: "對手致命一擊時，降低其暴擊傷害", accent: "accent-rose-500" },
    { key: "fixed", label: "固定傷害", tip: "受到固定傷害時減免", accent: "accent-amber-500" },
    { key: "percent", label: "百分比傷害", tip: "受到百分比傷害時減免", accent: "accent-violet-500" },
  ];
  const bonus = statusResist.allImmune ? 5 : 0;
  const renderSlot = (slot: ResistanceSlot, options: string[], accent: string, tone: string) => {
    const opts = options.includes(slot.status) ? options : [slot.status, ...options];
    return (
      <div key={slot.id} className="flex items-center gap-2 min-w-0 py-2 border-b border-white/[0.05] last:border-0">
        <select
          disabled={readonly}
          value={slot.status}
          onChange={(e) => handleSlotChange(slot.id, 'status', e.target.value)}
          className={`w-[76px] shrink-0 bg-white/[0.06] rounded-lg px-1.5 py-1.5 text-[13px] font-medium ${tone} focus:outline-none`}
        >
          {opts.map(opt => <option key={opt} value={opt} className="bg-slate-900 text-slate-200">{opt}</option>)}
        </select>
        <input type="range" min={0} max={50} value={slot.rate} disabled={readonly}
          onChange={(e) => handleSlotChange(slot.id, 'rate', e.target.value)}
          className={`flex-1 min-w-0 w-0 ${accent} cursor-pointer`} />
        <span className="w-11 shrink-0 text-right text-[14px] font-semibold tabular-nums" title={`基礎 ${slot.rate}%${bonus ? " + 全免 5%" : ""}`}>
          {slot.rate + bonus}%
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-slate-200 p-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-slate-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" /> 抗性
        </h3>
        {!readonly && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleResetToDefault}
              className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[12px] font-medium text-slate-200 flex items-center gap-1"
              title="傷害抗性 35%；控制 麻痹/害怕/疲憊、弱化 中毒/燒傷/凍傷 各 10%">
              <RotateCcw className="w-3.5 h-3.5" /> 預設
            </button>
            <button type="button" onClick={handleResetDamageToZero}
              className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[12px] font-medium text-rose-300"
              title="傷害抗性全部設為 0%">
              傷害歸零
            </button>
          </div>
        )}
      </div>

      {/* 傷害抗性 */}
      <div>
        <div className="text-[12px] text-slate-500 mb-1 px-1">傷害抗性（0–35%）</div>
        <div className="rounded-xl bg-black/25 px-3">
          {DMG_ROWS.map(r => (
            <div key={r.key} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0" title={r.tip}>
              <span className="w-24 shrink-0 text-[13px] text-slate-200">{r.label}</span>
              <input type="range" min={0} max={35} value={damageResist[r.key]} disabled={readonly}
                onChange={(e) => handleDamageChange(r.key, Number(e.target.value))}
                className={`flex-1 min-w-0 w-0 ${r.accent} cursor-pointer`} />
              <span className="w-12 text-right text-[14px] font-semibold tabular-nums">{damageResist[r.key]}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 異常抗性 */}
      <div>
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[12px] text-slate-500">異常抗性（每格 0–50%）</span>
          <label className="flex items-center gap-2 text-[12px] text-slate-300 cursor-pointer select-none"
            title={statusResist.allImmune ? "各格 +5%，其他常規異常 5% 抵抗" : "未設定的常規異常抵抗 0%"}>
            5% 全免
            <button type="button" disabled={readonly} onClick={handleToggleAllImmune}
              className={`relative inline-flex h-[22px] w-[38px] rounded-full transition-colors ${statusResist.allImmune ? "bg-emerald-500" : "bg-slate-600"}`}>
              <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${statusResist.allImmune ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
            </button>
          </label>
        </div>
        <div className="@container"><div className="grid grid-cols-1 @[30rem]:grid-cols-2 gap-3">
          <div className="rounded-xl bg-black/25 px-3 pt-1">
            <div className="text-[12px] font-semibold text-amber-300 pt-1.5 flex items-center gap-1"><Zap className="w-3.5 h-3.5" />控制類</div>
            {controlSlots.map(slot => renderSlot(slot, CONTROL_STATUS_OPTIONS, "accent-amber-500", "text-amber-200"))}
          </div>
          <div className="rounded-xl bg-black/25 px-3 pt-1">
            <div className="text-[12px] font-semibold text-rose-300 pt-1.5 flex items-center gap-1"><Flame className="w-3.5 h-3.5" />弱化類</div>
            {weakeningSlots.map(slot => renderSlot(slot, WEAKENING_STATUS_OPTIONS, "accent-rose-500", "text-rose-200"))}
          </div>
        </div></div>
      </div>

      <details className="rounded-xl bg-black/20 px-3 py-2 text-[12px] text-slate-400">
        <summary className="cursor-pointer text-slate-300 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />抗性規則</summary>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>觸發抵抗時，該異常轉為 1 回合「異常抵抗」，直接取代原異常（不視為解除）；原為「窒息」時會消耗全部體力。</li>
          <li>附屬類異常與印記不在抗性範圍內。</li>
        </ul>
      </details>
    </div>
  );
}
