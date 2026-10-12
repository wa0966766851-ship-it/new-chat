// 精靈自定 → 「積木」模式：大畫布積木編輯，直接綁定目前編輯中的精靈（魂印或技能）
import React, { lazy, Suspense, useMemo, useRef, useState } from "react";
import type { KitEntry } from "../effects/effectSystem.schema";
import type { Elf, Skill } from "../types";
import { isBlocklyEntry } from "../blocks/kitEntries";
import { getSoulMarkRegistry, hasSkillHandler } from "../effects/battleEventRegistry";
import { AlertTriangle } from "lucide-react";
import { isSoulBlocksOnly } from '../blocks/registry';
import { EffectBlockToggle } from './EffectBlockToggle';
import { EffectConnectionInspector } from './EffectConnectionInspector';
import type { EffectDefinition, EffectExecutionMode } from '../effects/effectConnection';
import { describeExecution } from '../blocks/audit';
import { EffectVerificationWorkbench } from './EffectVerificationWorkbench';
import { defaultEffectKit, instantiateEffectPreset, type EffectPreset } from '../effects/effectPresets';
import { DefaultEffectBlocks } from './DefaultEffectBlocks';

const BlocklyBuilder = lazy(() => import('./BlocklyBuilder').then(module => ({ default: module.BlocklyBuilder })));
const ReusableEffectLibrary = lazy(() => import('./ReusableEffectLibrary').then(module => ({ default: module.ReusableEffectLibrary })));

interface Props {
  elfName: string;
  elf: Elf;
  soulKit: KitEntry[];
  onSoulKitChange: (kit: KitEntry[]) => void;
  skills: Skill[];
  onSkillKitChange: (idx: number, kit: KitEntry[]) => void;
  onInsertSoulDesc: (text: string) => void;
  onInsertSkillDesc: (idx: number, text: string) => void;
  onSoulModeChange: (mode: EffectExecutionMode) => void;
  onSkillModeChange: (idx: number, mode: EffectExecutionMode) => void;
  onTraitChange: (key: string, trait: EffectDefinition) => void;
  onReplaceSoulDesc?: (text: string) => void;
  onReplaceSkillDesc?: (idx: number, text: string) => void;
}

export function ElfBlocklyPanel({ elfName, elf, soulKit, onSoulKitChange, skills, onSkillKitChange, onInsertSoulDesc, onInsertSkillDesc, onSoulModeChange, onSkillModeChange, onTraitChange, onReplaceSoulDesc, onReplaceSkillDesc }: Props) {
  const [target, setTarget] = useState<string>("soul"); // "soul" | 技能索引
  const [workspace, setWorkspace] = useState<'review' | 'canvas' | 'verification'>('review');
  const [canvasVisited, setCanvasVisited] = useState(false);
  const [pendingCanvas, setPendingCanvas] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // 匯入／刪除技能後舊索引可能越界；不可把後續畫布寫回不存在的技能。
  const idx = target === "soul" || !skills[Number(target)] ? -1 : Number(target);
  const traits: Array<[string, EffectDefinition | undefined]> = [['trait', elf.trait], ['gen2Trait', elf.alienTraits?.gen2Trait], ['exclusiveTrait', elf.alienTraits?.exclusiveTrait],
    ...(elf.alienTraits?.exclusiveTraits || []).map((t, i): [string, EffectDefinition] => [`exclusiveTraits.${i}`, t]), ['alienTrait', elf.alienTraits?.alienTrait], ['generalTrait', elf.alienTraits?.generalTrait]];
  const traitKey = target.startsWith('trait:') ? target.slice(6) : null;
  const selectedTrait = traits.find(([key]) => key === traitKey)?.[1];
  const definition = selectedTrait || (idx < 0 ? { ...elf.soulMark, name: elf.soulMark?.name || '魂印', kit: soulKit } : skills[idx]);
  const kind = idx < 0 ? 'soul' : 'skill';
  const defaultDraft = useMemo(() => defaultEffectKit(definition, kind), [JSON.stringify(definition), kind]);
  const kit = defaultDraft.kit;
  const draftBlocked = defaultDraft.origin === 'distilled' && !defaultDraft.complete;
  const blocklyPart = useMemo(() => kit.filter(isBlocklyEntry), [kit]);
  const otherPart = useMemo(() => kit.filter(e => !isBlocklyEntry(e)), [kit]);
  const hasHandler = !isSoulBlocksOnly(elf) && !!elfName && !!getSoulMarkRegistry()[elfName];
  const selectedHasHandler = !selectedTrait && (idx < 0 ? hasHandler : hasSkillHandler(definition.name));
  const execution = describeExecution(selectedTrait ? { trait: selectedTrait } : idx < 0 ? { elf } : { elf, skill: skills[idx] });

  // 外部改動（切換目標、其他模式修改）時重建畫布
  const lastEmitted = useRef<string>("");
  const ver = useRef(0);
  const json = target + JSON.stringify(blocklyPart);
  if (json !== lastEmitted.current) { lastEmitted.current = json; ver.current++; }

  const emit = (k: KitEntry[]) => {
    lastEmitted.current = target + JSON.stringify(k);
    const merged = [...otherPart, ...k];
    if (selectedTrait && traitKey) onTraitChange(traitKey, { ...selectedTrait, kit: merged, effectMode: 'kit' });
    else if (idx < 0) onSoulKitChange(merged); else onSkillKitChange(idx, merged);
  };
  const applyPreset = (preset: EffectPreset) => {
    if (pendingCanvas) { window.alert('請先套用或取消尚未同步的畫布。'); return; }
    if (!window.confirm(`以「${preset.elfName}／${preset.definition.name}」的完整效果替換目前效果草稿？名稱、能力與技能PP不會被替換。`)) return;
    const copy = instantiateEffectPreset(preset, kind);
    if (selectedTrait && traitKey) onTraitChange(traitKey, { ...selectedTrait, ...copy });
    else if (idx < 0) {onReplaceSoulDesc?.(copy.description!);onSoulKitChange(copy.kit!);onSoulModeChange('kit');}
    else {onReplaceSkillDesc?.(idx,copy.description!);onSkillKitChange(idx,copy.kit!);onSkillModeChange(idx,'kit');}
    setLibraryOpen(false);
  };

  return (
    <div className="space-y-4" data-effect-workspace>
      <header className="ios-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">效果工作室</h2><p className="text-xs text-slate-400 mt-1">原文 → 戰鬥節點 → 可執行積木 → 情境驗收</p></div>
        <button type="button" disabled={pendingCanvas || (!selectedTrait && (idx < 0 ? !onReplaceSoulDesc : !onReplaceSkillDesc))} className="ios-button-secondary px-3 py-2 text-sm disabled:opacity-40" onClick={()=>setLibraryOpen(!libraryOpen)}>{libraryOpen?'收起效果庫':'套用既存效果'}</button></div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-slate-400">編輯對象</span>
        <select aria-label="積木編輯對象" value={target} onChange={e => {
          if (pendingCanvas) { window.alert('畫布尚未套用，請先回到節點畫布按「套用畫布到草稿」，再切換效果對象。'); return; }
          setTarget(e.target.value);
        }} className="min-w-0 max-w-full flex-1 bg-slate-900 border border-white/15 rounded-xl p-2 text-sm">
          <option value="soul">魂印・{elf.soulMark?.name || '未命名'}</option>
          {skills.map((s, i) => (
            <option key={i} value={String(i)}>
              {s.isFifthSkill ? "第五" : `技能${i + 1}`}・{s.name || "未命名"}
            </option>
          ))}
          {traits.filter(([,t]) => !!t).map(([key,t]) => <option key={key} value={`trait:${key}`}>特質・{t!.name}</option>)}
        </select>
        {otherPart.length > 0 && (
          <span className="text-[12px] text-slate-500" title="編號或換槽模式建立的詞條，請在「手動精確自訂」中編輯">另有 {otherPart.length} 條非積木詞條（保留）</span>
        )}
      </div>
      </header>
      {libraryOpen && <Suspense fallback={<p className="ios-card p-4 text-sm">載入可執行效果庫…</p>}><ReusableEffectLibrary kind={kind} onSelect={applyPreset} onClose={()=>setLibraryOpen(false)} /></Suspense>}
      <nav aria-label="積木工作流程" className="ios-segment grid grid-cols-3 w-full">
        <button className="flex-1" type="button" data-active={workspace === 'review'} aria-pressed={workspace === 'review'} onClick={() => setWorkspace('review')}>1 原文核對</button>
        <button className="flex-1" type="button" data-active={workspace === 'canvas'} aria-pressed={workspace === 'canvas'} onClick={() => {setCanvasVisited(true);setWorkspace('canvas');}}>2 節點畫布</button>
        <button className="flex-1" type="button" data-active={workspace === 'verification'} aria-pressed={workspace === 'verification'} onClick={() => setWorkspace('verification')}>3 驗收清單</button>
      </nav>
      {pendingCanvas && <div className="flex flex-wrap gap-3 items-center"><p role="status" className="text-xs text-amber-200">畫布變更尚未套用。原文核對與驗收清單顯示的是已同步草稿；請先套用，再儲存精靈。</p><button type="button" className="ios-button-secondary p-2 text-xs" onClick={()=>{setCanvasVisited(false);setPendingCanvas(false);}}>放棄未套用畫布</button></div>}
      <p className="text-xs text-slate-400">{workspace === 'review' ? '保留原句，核對執行來源及不能等價轉換的部分。' : workspace === 'canvas' ? '先選戰鬥節點，再設定條件、目標、傷害類型。修改只寫入目前草稿，儲存後才套用。' : '按原句檢查正常、失敗、雙側與下場情境；有入口或畫布不等於測試通過。'}</p>
      {!selectedTrait && idx < 0 && hasHandler && (!elf.soulMark?.effectMode || elf.soulMark.effectMode === 'auto' || elf.soulMark.effectMode === 'registry') && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          「{elfName}」目前保留專屬程式。若要使用畫布，請選「手動積木」；切換後不會重跑原專屬程式。
        </div>
      )}
      {workspace !== 'verification' && <DefaultEffectBlocks draft={defaultDraft} action={defaultDraft.origin === 'distilled' && <button type="button" disabled={!defaultDraft.complete || pendingCanvas} className="ios-button-primary p-2 text-xs disabled:opacity-40" onClick={()=>emit(kit)}>套用完整預設到草稿</button>} />}
      {workspace === 'review' && <><EffectConnectionInspector definition={definition} kind={idx < 0 ? 'soul' : 'skill'} hasHandler={selectedHasHandler}
        legacyExecution={execution}
        onKitChange={k => selectedTrait && traitKey ? onTraitChange(traitKey, { ...selectedTrait, kit: k, effectMode: 'kit' }) : idx < 0 ? onSoulKitChange(k) : onSkillKitChange(idx,k)}
        onModeChange={mode => selectedTrait && traitKey ? onTraitChange(traitKey, { ...selectedTrait, effectMode: mode }) : idx < 0 ? onSoulModeChange(mode) : onSkillModeChange(idx, mode)} />
      <details className="ios-card p-3"><summary className="cursor-pointer text-sm text-blue-200">原描述煉成／實裝核對（不覆寫編輯畫布）</summary>
        <EffectBlockToggle {...(selectedTrait ? { trait: selectedTrait as any } : idx < 0 ? { elf } : { elf, skill: skills[idx] })}><p className="whitespace-pre-wrap text-sm leading-7">{definition.description}</p></EffectBlockToggle>
      </details></>}
      {workspace === 'verification' && <EffectVerificationWorkbench definition={definition} kind={idx < 0 ? 'soul' : 'skill'} hasHandler={selectedHasHandler} elfId={elf.id} execution={execution} />}
      {canvasVisited && <div className={`${workspace !== 'canvas' ? 'hidden' : ''} h-[72vh] min-h-[440px] rounded-2xl overflow-hidden border border-white/10`}>
        <Suspense fallback={<p className="p-6 text-sm text-slate-300">正在載入積木畫布；原文及驗收清單不需載入編輯器。</p>}>
        <BlocklyBuilder
          key={`${target}-${ver.current}`}
          fullPageMode
          initialKit={blocklyPart}
          editingBlockedReason={draftBlocked ? '原文有未接通內容；此畫布僅供核對，不能用部分積木覆蓋完整效果。可另選完整效果庫項目。' : undefined}
          onChange={emit}
          onPendingChange={setPendingCanvas}
          source={idx < 0 ? "soulmark" : "skill"}
          onInsertDescription={selectedTrait && traitKey ? t => onTraitChange(traitKey, { ...selectedTrait, description: [selectedTrait.description, t].filter(Boolean).join('\n') }) : t => (idx < 0 ? onInsertSoulDesc(t) : onInsertSkillDesc(idx, t))}
        />
        </Suspense>
      </div>}
    </div>
  );
}
