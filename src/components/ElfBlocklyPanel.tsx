// 精靈自定 → 「積木」模式：大畫布積木編輯，直接綁定目前編輯中的精靈（魂印或技能）
import React, { useMemo, useRef, useState } from "react";
import type { KitEntry } from "../effects/effectSystem.schema";
import type { Skill } from "../types";
import { BlocklyBuilder } from "./BlocklyBuilder";
import { isBlocklyEntry } from "./KitEffectBuilder";
import { getSoulMarkRegistry } from "../effects/battleEventRegistry";
import { AlertTriangle } from "lucide-react";

interface Props {
  elfName: string;
  soulKit: KitEntry[];
  onSoulKitChange: (kit: KitEntry[]) => void;
  skills: Skill[];
  onSkillKitChange: (idx: number, kit: KitEntry[]) => void;
  onInsertSoulDesc: (text: string) => void;
  onInsertSkillDesc: (idx: number, text: string) => void;
}

export function ElfBlocklyPanel({ elfName, soulKit, onSoulKitChange, skills, onSkillKitChange, onInsertSoulDesc, onInsertSkillDesc }: Props) {
  const [target, setTarget] = useState<string>("soul"); // "soul" | 技能索引
  const idx = target === "soul" ? -1 : Number(target);
  const kit = (idx < 0 ? soulKit : skills[idx]?.kit) || [];
  const blocklyPart = useMemo(() => kit.filter(isBlocklyEntry), [kit]);
  const otherPart = useMemo(() => kit.filter(e => !isBlocklyEntry(e)), [kit]);
  const hasHandler = !!elfName && !!getSoulMarkRegistry()[elfName];

  // 外部改動（切換目標、其他模式修改）時重建畫布
  const lastEmitted = useRef<string>("");
  const ver = useRef(0);
  const json = target + JSON.stringify(blocklyPart);
  if (json !== lastEmitted.current) { lastEmitted.current = json; ver.current++; }

  const emit = (k: KitEntry[]) => {
    lastEmitted.current = target + JSON.stringify(k);
    const merged = [...otherPart, ...k];
    if (idx < 0) onSoulKitChange(merged); else onSkillKitChange(idx, merged);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-slate-400">編輯對象</span>
        <div className="ios-segment flex-wrap">
          <button data-active={target === "soul"} onClick={() => setTarget("soul")}>魂印</button>
          {skills.map((s, i) => (
            <button key={i} data-active={target === String(i)} onClick={() => setTarget(String(i))} title={s.name}>
              {s.isFifthSkill ? "第五" : `技能${i + 1}`}・{s.name || "未命名"}
            </button>
          ))}
        </div>
        {otherPart.length > 0 && (
          <span className="text-[12px] text-slate-500" title="編號或換槽模式建立的詞條，請在「手動精確自訂」中編輯">另有 {otherPart.length} 條非積木詞條（保留）</span>
        )}
      </div>
      {idx < 0 && hasHandler && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          「{elfName}」的魂印由專屬程式執行，這裡的積木魂印不會在戰鬥中生效。
        </div>
      )}
      <div className="h-[72vh] rounded-2xl overflow-hidden border border-white/10">
        <BlocklyBuilder
          key={`${target}-${ver.current}`}
          fullPageMode
          initialKit={blocklyPart}
          onChange={emit}
          source={idx < 0 ? "soulmark" : "skill"}
          onInsertDescription={(t) => (idx < 0 ? onInsertSoulDesc(t) : onInsertSkillDesc(idx, t))}
        />
      </div>
    </div>
  );
}
