import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import { TypeIcon } from "./SeerImages";
import { ElfEditorDraftSummary, ElfEditorSectionNav, type EditorSection } from "./ElfEditorSections";
import { ExclusiveTraitsEditor } from './ExclusiveTraitsEditor';
import { BlueprintImportButton } from './BlueprintImportButton';
import { Elf, Skill, BaseStats, Inscription, DecompositionReport } from "../types";
import { KitEntry } from "../effects/effectSystem.schema";
import { calculateElfStats, SEER_TYPES, getDefaultEvs, getAttributeBadgeColor } from "../utils/statCalculator";
import { getElfDisplayRank as getElfDestinyRank } from "../utils/elfDisplayRank";
import { validateSeerNature, getDefaultNatureModifiers } from "../utils/seerNatures";
import EvNaturePanel from "./EvNaturePanel";
import ResistancePanel, { getDefaultResistances } from "./ResistancePanel";
import { InscriptionSlot, InscriptionModal } from "./InscriptionSystem";
import { getEffectiveInscriptions } from "../data/inscriptionsCatalog";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { GENERAL_TRAITS } from "../data/generalTraits";
import { ALIEN_TRAITS } from "../data/alienTraits";
import { motion, AnimatePresence } from "motion/react";
import { Puzzle, ArrowLeft, Sparkles, Save, ListPlus, Edit, Eye, ShieldAlert, Check, Shuffle, Crown, AlertCircle, X, BookOpen, Plus, Maximize2, Minimize2, ZoomIn, Search, Copy, Trash2, RefreshCw, Send, Share2 } from "lucide-react";
const EffectLibraryModal = lazy(() => import("./EffectLibraryModal").then(module => ({ default: module.EffectLibraryModal })));
import { parseEffectDescriptionWithAI } from "../utils/aiTextParser";
import { parseFullElfData } from "../utils/fullElfParser";
import { parseRawAbilityEffect } from "../utils/effectParser";
import { SKILL_STONE_ATTRIBUTES, SKILL_STONE_GRADES, SkillStoneGrade, PERFECT_SKILL_STONE_EFFECTS, getPerfectEffectsForAttribute, createSkillStone, isStoneThrower, equipSkillStone, stoneIconUrl } from "../data/skillStones";
import { ClauseBreakdownCard } from "./ClauseBreakdownCard";
const LazyKitEffectBuilder = lazy(() => import("./KitEffectBuilder").then(m => ({ default: m.KitEffectBuilder })));
const LazyElfBlocklyPanel = lazy(() => import("./ElfBlocklyPanel").then(m => ({ default: m.ElfBlocklyPanel })));
const editorLoading = <p role="status" className="p-4 text-sm text-slate-400">載入積木編輯工具…</p>;
function KitEffectBuilder(props: ComponentProps<typeof LazyKitEffectBuilder>) {
  return <Suspense fallback={editorLoading}><LazyKitEffectBuilder {...props} /></Suspense>;
}
function ElfBlocklyPanel(props: ComponentProps<typeof LazyElfBlocklyPanel>) {
  return <Suspense fallback={editorLoading}><LazyElfBlocklyPanel {...props} /></Suspense>;
}

const enrichSkillPoolWithStones = (pool: Skill[], elf?: Partial<Elf> | null): Skill[] => {
  const isST = elf && isStoneThrower(elf as Elf);
  const stonePool = isST ? SKILL_STONE_ATTRIBUTES.map(attr => {
    const effect = PERFECT_SKILL_STONE_EFFECTS.find(e => e.targetAttribute === attr);
    return createSkillStone(attr, 'S', '特殊', true, effect?.id, 'project');
  }) : [];
  const combined = [...pool, ...stonePool];
  const map = new Map<string, Skill>();
  combined.forEach(sk => {
    if (sk && sk.name && !map.has(sk.name)) map.set(sk.name, sk);
  });
  return Array.from(map.values());
};

interface DualTypeSelectProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
  label1?: string;
  label2?: string;
}

function DualTypeSelect({ id, value, onChange, className, label1, label2 }: DualTypeSelectProps) {
  const [t1, t2] = value.includes('.') ? value.split('.') : [value, '無屬性'];
  
  const handleT1Change = (newT1: string) => {
    if (newT1 === '普通' || newT1 === '無屬性' || newT1 === t2) {
      onChange(newT1);
    } else if (t2 === '無屬性') {
      onChange(newT1);
    } else {
      onChange(`${newT1}.${t2}`);
    }
  };

  const handleT2Change = (newT2: string) => {
    if (t1 === '普通' || t1 === '無屬性') {
      onChange(t1);
    } else if (newT2 === '無屬性' || newT2 === '普通' || newT2 === t1) {
      onChange(t1);
    } else {
      onChange(`${t1}.${newT2}`);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        {label1 && <label className="block text-[10px] text-slate-400 mb-1">{label1}</label>}
        <select value={t1 || ''} onChange={e => handleT1Change(e.target.value)} className={className} id={id}>
          {SEER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex-1">
        {label2 && <label className="block text-[10px] text-slate-400 mb-1">{label2}</label>}
        <select value={t1 === '普通' || t1 === '無屬性' ? '無屬性' : (t2 || '無屬性')} onChange={e => handleT2Change(e.target.value)} className={className} disabled={t1 === '普通' || t1 === '無屬性'}>
          <option value="無屬性">單屬性</option>
          {SEER_TYPES.filter(t => t !== '無屬性' && t !== '普通' && t !== t1).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}

// ---------------- Smart Description System ----------------
const TIMING_KEYWORDS = [
  '回合開始', '回合結束', '登場', '陣亡', '被擊敗', '受擊', '攻擊時', '技能使用時', '切換時', '先手', '後手', '對手使用技能後', '受傷後',
  '出手流程結束後', '出手流程結束', '戰鬥階段結束時', '戰鬥階段結束', '戰鬥階段結束前', '結束前', '每次受到', '每次出手', '戰鬥開始時', '下場後', '死亡後',
  '當回合', '在場期間'
];
const CONDITION_KEYWORDS = [
  '若', '低於', '大於', '超過', '滿', '百分比', 'HP', '體力', '異常狀態', '提升', '下降', '未擊敗對手', '擊敗對手', '命中後', '未命中', '暴擊', '使用技能成功時', '技能無效時',
  '每次', '未觸發', '已處於', '因故未能', '選擇技能', '每有', '死亡', '受傷', '當前', '所處', '每', '有'
];
const CONNECTIVE_KEYWORDS = [
  '則', '並', '且', '否則', '同時', '之後', '改為', '將', '直到', '轉化為', '轉化', '降低', '引導其',
  '時', '後', '為', '被', '在', '內', '或', '令', '下'
];
const EFFECT_KEYWORDS = [
  '吸取', '恢復', '附加', '消除', '傷害', '封印', '回血', '免控', '必中', '翻倍', '固定傷害', '真傷', '瞬殺', '封屬', '免死', '鎖血', '吸血', '護盾', '減傷', '消回合', '減少',
  '進行額外行動', '額外行動', '重生', '無法被消除', '無法消除', '等同於', '減免', '扣減', '削弱'
];
const STATUS_KEYWORDS = [
  // 控制類
  "麻痹", "麻痺", "害怕", "睡眠", "石化", "癱瘓", "詛咒", "狂信", "沉睡", "冰封", "焚燼", "感染",
  // 弱化類
  "中毒", "燒傷", "寄生", "凍傷", "混亂", "衰弱", "易燃", "流血", "失明", "烈焰詛咒", "束縛", "失神", "沉默", "臣服", "沸湧", "遲鈍", "繳械", "腐朽", "失溫", "窒息",
  // 限制類
  "凝滯",
  // 衍化類
  "神游", "空定", "漸凍",
  // 附屬類
  "山神守護", "狂暴", "神話", "免疫", "異常抵抗", "致命詛咒", "虛弱詛咒", "星賜", "星哲", "超頻", "砥礪", "星贖", "雷解", "漸凍", "星佑", "星護", "平靜",
  // 通用或分類
  "異常狀態", "控制類異常狀態", "控制類異常", "弱化類異常", "限制類異常", "衍化類異常", "附屬類異常"
];
const OTHER_KEYWORDS = [
  '最大體力', '增傷', '先制+1', '先制', '免疫異常', '強化', '消強', '窒息', '連擊', '回合類效果', '印記', '星執者', '恐懼之花',
  '所有能力值', '能力值', '在場精靈', '己方', '對方', '對手', '背包', '背包內', '燦界聖芒', '弱點傷害', '光系傷害', '攻擊傷害', '能力上升狀態', '控制類異常狀態', '斯嘉麗', '珀妮', '百分比傷害', '能力上升', '能力等級',
  '自身', '等量', '百分比', '%', '⅓'
];

const KEYWORD_DETAILS: Record<string, string> = {
  // 時點
  "回合開始": "每回合動作執行前（含換人後、出招前）觸發，適合預熱防禦。",
  "回合結束": "每回合所有動作結算完畢後觸發，用於回復或狀態結算。",
  "登場": "精靈進入戰鬥位置時立即發動，用於初始化被動或進場威壓。",
  "陣亡": "精靈體力變為0下場時發動，常見於「遺言」類效果。",
  "被擊敗": "特指被對手技能直接擊殺時的判定時點。",
  "受擊": "受到對手攻擊（含傷害或效果）時觸發。",
  "攻擊時": "自身主動發動技能進攻時觸發。",
  "技能使用時": "主動使用任何技能時（含屬性與攻擊）觸發，適合做技能前置效果判定。",
  "切換時": "精靈替換上場或被替換下場時觸發，多見於傳遞增益。",
  "先手": "在本回合比對手先行行動的情況下觸發。",
  "後手": "在本回合比對手後行行動的情況下觸發。",
  "對手使用技能後": "在對手完成技能釋放與結算後觸發，適合反制或削減資源。",
  "受傷後": "受到實質體力扣減傷害後觸發。",
  "出手流程結束後": "精靈完成出招（含技能生效、傷害結算及被動觸發）後的時點。",
  "出手流程結束": "精靈在戰鬥中的一整套出手動作結算完畢。",
  "戰鬥階段結束時": "當回合敵我雙方戰鬥出招及當回合效果處理完畢後的時點。",
  "戰鬥階段結束": "當回合戰鬥出招及主要被動完畢。",
  "戰鬥階段結束前": "在戰鬥階段結算前進行的最終判定。",
  "結束前": "在某個時間序列結束前進行的判定。",
  "每次受到": "每當自身或己方受到特定傷害或狀態時觸發判定。",
  "每次出手": "精靈在當回合主動使用技能或執行行動時觸發。",
  "戰鬥開始時": "進入戰鬥的第一個時間點，可用於添加額外精靈、設定初始狀態。",
  "下場後": "精靈退場進入背包或瀕死後，觸發的遺留、傳遞或轉移效果。",
  "死亡後": "體力歸零陣亡退場後觸發的生命判定。",
  
  // 條件
  "若": "引導邏輯判定。若後續條件成立，則執行對應效果。",
  "HP": "精靈的體力值。",
  "體力": "精靈的體力，多數機制判定的核心基準。",
  "異常狀態": "包含控制（害怕、麻痺）與持續損血（燒傷、中毒）等狀態。",
  "提升": "能力等級（攻、防、速、命、閃）上升。",
  "下降": "能力等級（攻、防、速、命、閃）下降。",
  "百分比": "以最大或當前數值的比例進行計算。",
  "低於": "數值嚴格小於目標值時條件成立。",
  "超過": "數值嚴格大於目標值時條件成立。",
  "滿": "數值達到 100% 飽和狀態。",
  "命中後": "技能成功命中目標（未被閃避或免疫）後觸發。",
  "未命中": "技能被閃避、抵擋或因命中率不足失敗時觸發補償。",
  "擊敗對手": "成功將對手體力清零下場後觸發。",
  "未擊敗對手": "技能結束後對手依然存活時觸發的後續或補償效果。",
  "暴擊": "觸發致命一擊（1.5倍物理/特殊傷害）時觸發。",
  "使用技能成功時": "精靈順利放出並完成技能結算時觸發（未被封印、害怕等中斷）。",
  "技能無效時": "精靈技能未能造成實質影響或被對方免疫、閃避時觸發補償。",
  "控制類異常狀態": "包含害怕、癱瘓、麻痺、凍結等使精靈無法行動的狀態。",
  "斯嘉麗": "聖光·斯嘉麗：與珀妮具有強烈協同與重生機制的至高精靈。",
  "珀妮": "光系額外精靈：斯嘉麗的守護精靈，具備異常轉化、額外行動協戰與重生奇蹟。",
  "百分比傷害": "根據目標的最大體力或當前體力百分比造成的傷害，無視防禦。",
  "能力上升": "能力等級（攻、防、速、特攻、特防、精度、閃避）上升。",
  "能力等級": "攻、防、速、特攻、特防、命中、閃避的階段值（-6 到 +6）。",
  "當回合": "在此回合的常規與戰鬥階段結算生命週期內。",
  "在場期間": "精靈處於首發出戰格且未戰敗或下場的時間範圍內。",
  "當前": "精靈或環境此時此刻所處的實際狀態或數值。",
  "所處": "指精靈此時所在的異常狀態、能力等級或印記狀態。",
  "每": "依據計數器、層數或回合數進行線性累加。",
  "有": "存在判定：檢查目標是否具備某個印記、狀態 or 屬性。",
  "時": "引導特定時間判定。",
  "後": "在特定事件或階段結束後觸發。",
  "為": "賦值或轉換，使狀態變更為指定項。",
  "被": "被動判定，代表來自對手或系統的施加。",
  "在": "定位詞，指定效果發生的場所或對象。",
  "內": "限定範圍，在指定的容器、回合或位置內部。",
  "或": "邏輯或：多個條件只要有一個成立即執行。",
  "令": "使動詞，命令系統強制附加、消除或變更狀態。",
  "下": "引導後續動作、回合或攻擊判定。",
  "背包內": "己方的後備精靈欄位中。",

  // 連接詞
  "則": "引導條件滿足後執行的具體效果指令。",
  "並": "並列關係，表示多個效果同時發生。",
  "且": "邏輯與關係，用於複合條件判定或並列效果執行。",
  "否則": "當前置條件不成立時，執行的替代方案。",
  "同時": "多個效果在同一個結算幀內同步執行。",
  "改為": "強制轉換原有的結算邏輯、數值路徑或判定結果。",
  "之後": "順序執行，在前一效果結算完畢後接著執行。",

  // 效果
  "附加": "施加異常狀態、能力印記或特殊 Buffer 到目標身上。",
  "消除": "移除目標身上的能力提升（消強）或回合類增益。",
  "吸取": "奪取對手的資源（HP/PP/能力）並補給自身。",
  "恢復": "補充自身的體力、PP點數或增加護盾。",
  "傷害": "對目標造成體力扣減。",
  "必中": "無視命中與閃避修正，確保攻擊 100% 命中。",
  "免控": "免疫一切來自對手的異常狀態控制效果。",
  "回血": "補充自身體力值。",
  "翻倍": "將數值（通常是傷害）乘以二。",
  "真傷": "真實傷害：無視防禦與減傷機制的固定扣血。",
  "封印": "使目標在一定回合內無法使用特定類型的技能。",
  "封屬": "特指封印對手的屬性技能（變換類、增益類）。",
  "瞬殺": "機率性一擊必殺效果，直接清空對手體力。",
  "免死": "受到致命傷害時，使自身免疫該次傷害並保留至少 1 點體力。",
  "鎖血": "在受到致死性攻擊時鎖定最低體力，防止被高爆發秒殺。",
  "吸血": "將對手損失的體力按比例吸取並回復給自身。",
  "護盾": "附加能吸收一定數額傷害的護盾，通常在護盾存在時免控。",
  "固定傷害": "無視防禦與克制關係的直接傷害，適合攻克高防禦精靈。",
  "減傷": "減少受到的所有非真實傷害（如物理、特殊、固定傷害等）。",
  "消回合": "移除對手身上剩餘的回合類增益（如回合免傷、回合免控等）。",
  "減少": "直接削減目標體力、PP值或下調對手能力等級。",
  "進行額外行動": "獲得額外的攻擊或行動次數，不消耗當回合常規行動。",
  "額外行動": "在常規回合出手之外進行的附加動作。",
  "重生": "陣亡後以特定狀態重新返回戰場或背包。",
  "無法被消除": "回合類效果或增益受強效保護，無法被對手的消強、消回合技能清除。",
  "無法消除": "受強力保護，對手的任何清除技能皆無效。",
  "等同於": "數值與特定變量完全一致。",
  "減免": "按固定數值或百分比降低受到的傷害。",
  "扣減": "直接扣除目標的體力、PP或能力。",
  "削弱": "降低目標的能力、層數 or 狀態。",

  // 異常狀態 (Status Ailments)
  "麻痹": "控制類異常：處於該狀態則每回合無法行動，且其速度能力值減半。",
  "麻痺": "控制類異常：處於該狀態則每回合無法行動，且其速度能力值減半。",
  "害怕": "控制類異常：處於該狀態則每回合無法行動（最經典控場）。",
  "睡眠": "控制類異常：無法行動，但若受到對手攻擊技能命中，則睡眠解除。",
  "石化": "控制類異常：處於該狀態則每回合無法行動，全身僵硬石化。",
  "癱瘓": "控制類異常：無法行動，且無法主動切換精靈下場（具限制屬性）。",
  "詛咒": "控制類與衍化類：無法行動。異常結束後隨機轉化為烈焰詛咒、虛弱詛咒、失控詛咒 3 回合。",
  "狂信": "控制類異常：若對手為信仰對象則無法行動。若無對象，進入時來源精靈成為其信仰對象。",
  "沉睡": "控制類與衍化類：無法行動。受到暴擊傷害轉為睡眠；異常結束轉為睡眠 2-3 回合。",
  "冰封": "控制類與衍化類：每回合無法行動（核心冰王/寒冰控場）。結束後轉為速度-1與凍傷2-3回合。",
  "焚燼": "控制類與衍化類：每回合無法行動。結束後轉為命中-1與燒傷狀態 2-3 回合。",
  "感染": "控制與衍化類異常：每回合無法行動。結束後轉化為攻擊-1、特攻-1與中毒狀態。",
  "中毒": "弱化類異常：每回合對手出手時受到最大體力 1/8 真實傷害。再度陷入則額外附加一次 1/8 真傷。",
  "燒傷": "弱化類異常：每回合對手出手時受到最大體力 1/8 真實傷害，且物理攻擊技能初始威力降低 50%。",
  "寄生": "弱化類異常：每回合出手時受到最大體力 1/8 真傷，並使對手恢復同等數值之體力。",
  "凍傷": "弱化類異常：每回合對手出手時受到等同於其最大體力 1/8 的真實傷害。",
  "混亂": "弱化類異常：攻擊技能初始命中率降低 80%，且每回合對手出手時受到 50 點真實傷害。",
  "衰弱": "弱化類異常：受到的攻擊傷害額外提升。依回合數分別提升 25%/50%/100%/250%/500%。",
  "易燃": "弱化類異常：攻擊技能初始命中率降低 30%，且受到火系攻擊時將直接轉化為燒傷狀態。",
  "流血": "弱化類異常：每回合對手出手時受到 80 點真實傷害。",
  "失明": "弱化類異常：命中率極大降低。50%概率攻擊丟失，非必中以MISS呈現，必中則無傷害且效果失效。",
  "烈焰詛咒": "弱化類異常：每回合結束時受到等同於自身最大體力 1/8 的百分比傷害。",
  "束縛": "弱化類異常：所有先制效果失效，每回合對手出手時受到最大體力 1/8 的百分比傷害。",
  "失神": "弱化類異常：50% 概率屬性技能失效。",
  "沉默": "弱化類異常：自身第五技能無效，且每回合結束時受到最大體力 1/8 的百分比傷害。",
  "臣服": "弱化類異常：所造成的傷害（包括固定傷害、百分比傷害）將被對方精靈直接免疫。",
  "沸湧": "弱化類異常：受到的攻擊傷害至少為其最大體力的 30%，對手打出致命一擊時提升至 50%。",
  "遲鈍": "弱化類異常：速度能力值、正先制等級、造成非真實傷害減半，受到非真實傷害翻倍。",
  "繳械": "弱化與限制異常：無法使用藥劑，選擇技能阶段令PP歸0，PP為0則當回合無法行動。",
  "腐朽": "弱化類異常：降傷效果衰減至0%，受攻擊傷害提升30%且額外受150點傷害，未受傷則受300點真傷且異常+2回合。",
  "失溫": "弱化與限制異常：無法選擇使用藥劑，回合（戰鬥階段）結束時受到 180 點真傷與減少 4 點 PP。",
  "窒息": "弱化類異常：使用攻擊技能時轉化為撞擊（威力 35）；異常結束或被解除時消耗全部體力令自身死亡。",
  "凝滯": "限制類異常：無法主動切換下場，但免疫受到的控制類異常狀態。",
  "神游": "控制與衍化異常：無法行動，異常結束後轉化為 2-3 回合失神狀態。",
  "空定": "控制與衍化異常：無法行動，異常結束後轉化為 2-3 回合沉默狀態。",
  "漸凍": "附屬與衍化異常：異常結束後轉化為 2 回合冰封。（具備衍化屬性）",
  "山神守護": "附屬類異常：每回合受到對手的攻擊傷害減少 80%。",
  "狂暴": "附屬類異常：造成傷害翻倍（大幅提升進攻壓迫）。",
  "神話": "附屬類異常：BOSS專屬。免疫能力下降、免疫異常狀態、PP無限、技能必中（黃色圖標）。",
  "免疫": "附屬類異常：免疫異常狀態，PP 無限（藍色圖標）。",
  "異常抵抗": "附屬類異常：自身觸發異常狀態抗性抵抗時產生的異常狀態（僅為抗性骰判定成功後的結果標記，與天生免疫機制不同）。",
  "致命詛咒": "附屬類異常：受到的攻擊傷害提高 50%（附屬詛咒之一）。",
  "虛弱詛咒": "附屬類異常：造成的攻擊傷害減少 50%（附屬詛咒之一）。",
  "星賜": "星附屬異常：造成的攻擊傷害提升 30%，每回合結束後回復 2 點 PP 值。",
  "星哲": "星附屬異常：造成的固定、百分比傷害提升 30%，每回合結束後恢復最大體力 1/4。",
  "超頻": "附屬與衍化異常：技能先制 +1，且行動開始時恢復所選技能全部 PP；解除後轉化為 1~2 回合癱瘓。",
  "砥礪": "附屬類異常：受到真傷後，若當回合未執行過附加異常效果，則直接回復該傷害 80% 的體力。",
  "星贖": "星附屬異常：體力恢復提升 30%，每回合結束時所有非限制類異常狀態的回合數 +1。",
  "雷解": "附屬類異常：造成攻擊傷害後，附加傷害值 60% 的真實傷害。",
  "星佑": "星附屬異常：受技能傷害降低 30% 且正先制技能無效；體力歸 0 時 100% 重生並解非控制異常。",
  "星護": "星附屬異常：受固傷、百分比傷害降低 30%，100% 閃避技能且必中技能使用後 PP 歸 1；PP 歸 0 時強制回復 100% 並解非弱化異常。",
  "平靜": "附屬類異常：不受PP限制且不消耗PP，結束時受1%真傷並恢復最高PP上限1/5的PP點數。",

  // 數值與特殊項
  "回合類效果": "技能附加的帶有剩餘回合數的增益 or 減益狀態。",
  "印記": "自定義的戰鬥印記或層數系統，獨立於異常與能力等級。",
  "星執者": "蓓麗安特專屬印記，解鎖真傷制裁與回復效果。",
  "恐懼之花": "咤克斯專屬印記，疊滿後引導真傷並附加控制效果。",
  "最大體力": "精靈戰鬥時的最大體力上限值。",
  "增傷": "按比例提升自身造成的技能傷害。",
  "先制+1": "技能出手速度優先度提升 1 級。",
  "先制": "技能出手的優先度，先制等級越高越先發動技能。",
  "免疫異常": "在一定回合內免疫所有來自對手的異常狀態控制與流血效果。",
  "強化": "主動提升自身一項 or 多項能力等級（攻擊、防禦、速度等）。",
  "消強": "消除對手身上已有的能力提升狀態。",
  "連擊": "技能連續發動多次攻擊，可用於快速消耗對方免傷次數護盾。",
  "所有能力值": "指精靈的六項基礎屬性（體力、攻擊、防禦、特攻、特防、速度）加權。",
  "能力值": "精靈的基本能力點數。",
  "在場精靈": "目前處於對戰欄位中的精靈。",
  "己方": "指玩家自己（或當前觸發方的隊伍及在場精靈）。",
  "對方": "指敵方/對手的隊伍及在場精靈。",
  "對手": "敵方的在場精靈或隊伍。",
  "背包": "精靈的後備欄位，重生效果通常在此處觸發。",
  "燦界聖芒": "斯嘉麗與珀妮專屬神聖印記：每層可降低己方控制異常回合數、降低對手PP。",
  "弱點傷害": "計算傷害時，以對手雙防中較低者的60%作為防禦計算，大幅提升傷害。",
  "光系傷害": "來自光系的屬性傷害或技能傷害判定。",
  "攻擊傷害": "來自技能攻擊直接造成的體力扣減傷害。",
  "能力上升狀態": "能力強化等級大於0的狀態。",
  "自身": "觸發此效果 of 精靈自己。底層戰鬥引擎會透過 playerId / activeElf 獲取其動態屬性。",
  "等量": "與前置判定的流失量、回復量、或傷害值完全相等之具體數值。",
  "%": "百分比標識。常用於動態扣減、回復、機率判定等。",
  "⅓": "特指 33.3%（三分之一）的特殊比例。底層引擎代碼以 Math.floor(maxHp / 3) 處理。",
};

const KEYWORD_CODE_REFS: Record<string, string> = {
  "回合開始": "onTurnStart() / checkTriggers(EffectTiming.BEFORE_ACTION)",
  "回合結束": "onTurnEnd() / processEndTurnEffects()",
  "登場": "onEnterBattle() / handleEntranceEffects()",
  "陣亡": "onDeath() / handle临终遗言()",
  "被擊敗": "onDefeated() / checkDefeatedPunishments()",
  "受擊": "onHit() / checkDefenseReactions()",
  "攻擊時": "onAttack() / checkOffensiveIncrements()",
  "技能使用時": "onBeforeSkill() / checkSkillPreConditions()",
  "先手": "onActFirst() / checkSpeedPriority()",
  "後手": "onActLast() / checkReverseCounter()",
  "在場期間": "whileInBattleSlot() / activeStaticPassive()",
  "若": "if (checkCondition(clause)) { execute() }",
  "HP": "elf.currentHp / elf.maxHp",
  "體力": "elf.currentHp / elf.maxHp",
  "低於": "elf.currentHp < targetValue",
  "超過": "elf.currentHp > targetValue",
  "滿": "elf.currentHp === elf.maxHp",
  "異常狀態": "elf.statusEffects.length > 0",
  "提升": "ctx.adjustAbilityLevel(elf, attribute, amount)",
  "下降": "ctx.adjustAbilityLevel(elf, attribute, -amount)",
  "百分比": "val = baseValue * percentage / 100",
  "自身": "const self = ctx.getPlayerState(playerId).activeElf",
  "對手": "const opp = ctx.getOpponentState(playerId).activeElf",
  "對方": "const opp = ctx.getOpponentState(playerId).activeElf",
  "等量": "const damage = previousDamageLossAmount",
  "附加": "ctx.applyStatusWithImmunityCheck(target, status, duration)",
  "消除": "ctx.removeAbilityBuffs(target) / ctx.clearTurnEffects(target)",
  "吸取": "ctx.stealResources(self, opponent, resourceType, amount)",
  "恢復": "ctx.healElf(self, amount) / ctx.restorePP(self, amount)",
  "固定傷害": "ctx.applyPinkDamage(opponent, value)",
  "真傷": "ctx.applyTrueDamage(opponent, value)",
  "害怕": "ctx.applyStatusWithImmunityCheck(opponent, '害怕', duration)",
  "麻痹": "ctx.applyStatusWithImmunityCheck(opponent, '麻痹', duration)",
  "麻痺": "ctx.applyStatusWithImmunityCheck(opponent, '麻痺', duration)",
  "失明": "ctx.applyStatusWithImmunityCheck(opponent, '失明', duration)",
  "冰封": "ctx.applyStatusWithImmunityCheck(opponent, '冰封', duration)",
  "焚燼": "ctx.applyStatusWithImmunityCheck(opponent, '焚燼', duration)",
  "感染": "ctx.applyStatusWithImmunityCheck(opponent, '感染', duration)",
  "中毒": "ctx.applyStatusWithImmunityCheck(opponent, '中毒', duration)",
  "燒傷": "ctx.applyStatusWithImmunityCheck(opponent, '燒傷', duration)",
  "寄生": "ctx.applyStatusWithImmunityCheck(opponent, '寄生', duration)",
  "凍傷": "ctx.applyStatusWithImmunityCheck(opponent, '凍傷', duration)",
  "混亂": "ctx.applyStatusWithImmunityCheck(opponent, '混亂', duration)",
  "衰弱": "ctx.applyStatusWithImmunityCheck(opponent, '衰弱', duration)",
  "易燃": "ctx.applyStatusWithImmunityCheck(opponent, '易燃', duration)",
  "流血": "ctx.applyStatusWithImmunityCheck(opponent, '流血', duration)",
  "烈焰詛咒": "ctx.applyStatusWithImmunityCheck(opponent, '烈焰詛咒', duration)",
  "束縛": "ctx.applyStatusWithImmunityCheck(opponent, '束縛', duration)",
  "失神": "ctx.applyStatusWithImmunityCheck(opponent, '失神', duration)",
  "沉默": "ctx.applyStatusWithImmunityCheck(opponent, '沉默', duration)",
  "臣服": "ctx.applyStatusWithImmunityCheck(opponent, '臣服', duration)",
  "沸湧": "ctx.applyStatusWithImmunityCheck(opponent, '沸湧', duration)",
  "遲鈍": "ctx.applyStatusWithImmunityCheck(opponent, '遲鈍', duration)",
  "繳械": "ctx.applyStatusWithImmunityCheck(opponent, '繳械', duration)",
  "腐朽": "ctx.applyStatusWithImmunityCheck(opponent, '腐朽', duration)",
  "失溫": "ctx.applyStatusWithImmunityCheck(opponent, '失溫', duration)",
  "窒息": "ctx.applyStatusWithImmunityCheck(opponent, '窒息', duration)",
  "凝滯": "ctx.applyStatusWithImmunityCheck(opponent, '凝滯', duration)",
  "神游": "ctx.applyStatusWithImmunityCheck(opponent, '神游', duration)",
  "空定": "ctx.applyStatusWithImmunityCheck(opponent, '空定', duration)",
  "漸凍": "ctx.applyStatusWithImmunityCheck(opponent, '漸凍', duration)",
  "山神守護": "ctx.applyStatusWithImmunityCheck(self, '山神守護', duration)",
  "狂暴": "ctx.applyStatusWithImmunityCheck(self, '狂暴', duration)",
  "神話": "ctx.applyStatusWithImmunityCheck(self, '神話', duration)",
  "免疫": "ctx.applyStatusWithImmunityCheck(self, '免疫', duration)",
  "異常抵抗": "ctx.applyStatusWithImmunityCheck(self, '異常抵抗', duration)",
  "致命詛咒": "ctx.applyStatusWithImmunityCheck(opponent, '致命詛咒', duration)",
  "虛弱詛咒": "ctx.applyStatusWithImmunityCheck(opponent, '虛弱詛咒', duration)",
  "星賜": "ctx.applyStatusWithImmunityCheck(self, '星賜', duration)",
  "星哲": "ctx.applyStatusWithImmunityCheck(self, '星哲', duration)",
  "超頻": "ctx.applyStatusWithImmunityCheck(self, '超頻', duration)",
  "砥礪": "ctx.applyStatusWithImmunityCheck(self, '砥礪', duration)",
  "星贖": "ctx.applyStatusWithImmunityCheck(opponent, '星贖', duration)",
  "雷解": "ctx.applyStatusWithImmunityCheck(self, '雷解', duration)",
  "星佑": "ctx.applyStatusWithImmunityCheck(self, '星佑', duration)",
  "星護": "ctx.applyStatusWithImmunityCheck(self, '星護', duration)",
  "平靜": "ctx.applyStatusWithImmunityCheck(self, '平靜', duration)",
  "免控": "ctx.applyStatusImmunity(self, duration)",
  "免死": "ctx.applyFatalResist(self, duration)",
  "重生": "ctx.rebirthElfInBag(player, elfId, delayTurns)",
  "額外行動": "ctx.queueExtraAction(player, actionData)",
  "消回合": "ctx.clearTurnEffects(opponent)",
  "無法被消除": "effect.isProtected = true",
  "燦界聖芒": "ctx.addPlayerState(player, '燦界聖芒', 1)",
  "百分比傷害": "ctx.applyPinkDamage(opponent, opponent.maxHp * pct)",
  "⅓": "Math.floor(target.maxHp / 3)"
};

const getKeywordStyle = (part: string) => {
  if (STATUS_KEYWORDS.includes(part) || part.includes("異常") || part.includes("狀態")) {
    return "text-pink-300 bg-pink-500/10 border-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.25)]";
  }
  if (TIMING_KEYWORDS.includes(part)) {
    return "text-amber-300 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.25)]";
  }
  if (CONDITION_KEYWORDS.includes(part)) {
    return "text-blue-300 bg-blue-500/10 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.25)]";
  }
  if (CONNECTIVE_KEYWORDS.includes(part)) {
    return "text-slate-300 bg-slate-500/10 border-slate-500/20 shadow-[0_0_10px_rgba(100,116,139,0.25)]";
  }
  if (EFFECT_KEYWORDS.includes(part)) {
    return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.25)]";
  }
  if (OTHER_KEYWORDS.includes(part) || part.match(/^[0-9]+%|[0-9]+點|1\/[0-9]+|LV[0-9]+$/)) {
    return "text-rose-300 bg-rose-500/10 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.25)]";
  }
  return "text-slate-300 bg-slate-500/10 border-slate-500/20";
};

const SmartDescription = ({ text, className = "" }: { text?: string, className?: string }) => {
  if (!text) return <span className="text-slate-500 italic">（無描述內容）</span>;

  const CATEGORIES = {
    status: {
      label: "🌀 異常狀態",
      keywords: STATUS_KEYWORDS,
      style: "text-pink-300 bg-pink-500/10 border-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.25)]",
      desc: "包含控制類、弱化類、限制類、衍化類與附屬類異常狀態。底層戰鬥引擎會透過對應狀態處理器進行生命週期維護與效果結算。"
    },
    timing: { 
      label: "描述時點", 
      keywords: TIMING_KEYWORDS, 
      style: "text-amber-300 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.25)]",
      desc: "指示效果發生的特定系統時間序列。"
    },
    condition: { 
      label: "描述條件", 
      keywords: CONDITION_KEYWORDS, 
      style: "text-blue-300 bg-blue-500/10 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.25)]",
      desc: "系統判斷效果是否觸發的邏輯前提。"
    },
    connective: { 
      label: "連接詞", 
      keywords: CONNECTIVE_KEYWORDS, 
      style: "text-slate-300 bg-slate-500/10 border-slate-500/20 shadow-[0_0_10px_rgba(100,116,139,0.25)]",
      desc: "決定效果執行流向與先後關係的連接標識。"
    },
    effect: { 
      label: "描述具體效果", 
      keywords: EFFECT_KEYWORDS, 
      style: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.25)]",
      desc: "戰鬥引擎最終執行的原子化效果指令。"
    },
    other: { 
      label: "數值與特殊項", 
      keywords: [...OTHER_KEYWORDS, '[0-9]+%', '[0-9]+點', '1/[0-9]+', 'LV[0-9]+'], 
      style: "text-rose-300 bg-rose-500/10 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.25)]",
      desc: "精確的數值比例、數值點位、特殊印記或特殊等級標識。"
    }
  };

  const allWords = [
    ...STATUS_KEYWORDS,
    ...TIMING_KEYWORDS,
    ...CONDITION_KEYWORDS,
    ...CONNECTIVE_KEYWORDS,
    ...EFFECT_KEYWORDS,
    ...OTHER_KEYWORDS
  ].sort((a, b) => b.length - a.length);

  const regexStr = `(${allWords.join('|')}|[0-9]+%|[0-9]+點|1/[0-9]+|LV[0-9]+)`;
  const regex = new RegExp(regexStr, 'g');

  const parts = text.split(regex);

  return (
    <div className={`leading-relaxed font-sans ${className}`}>
      {parts.map((part, i) => {
        let catKey: keyof typeof CATEGORIES | null = null;
        if (STATUS_KEYWORDS.includes(part) || part.includes("異常") || part.includes("狀態")) catKey = 'status';
        else if (TIMING_KEYWORDS.includes(part)) catKey = 'timing';
        else if (CONDITION_KEYWORDS.includes(part)) catKey = 'condition';
        else if (CONNECTIVE_KEYWORDS.includes(part)) catKey = 'connective';
        else if (EFFECT_KEYWORDS.includes(part)) catKey = 'effect';
        else if (OTHER_KEYWORDS.includes(part) || part.match(/^[0-9]+%|[0-9]+點|1\/[0-9]+|LV[0-9]+$/)) catKey = 'other';

        if (catKey) {
          const config = CATEGORIES[catKey];
          const detail = KEYWORD_DETAILS[part] || config.desc;
          return (
            <span key={i} className="relative inline-block mx-0.5 group/word">
              <span className={`px-1 rounded-md border text-[0.95em] font-bold cursor-help transition-all duration-300 hover:brightness-150 hover:-translate-y-0.5 ${config.style}`}>
                {part}
              </span>
              {/* Enhanced Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 pointer-events-none group-hover/word:opacity-100 transition-all duration-200 transform scale-90 group-hover/word:scale-100 z-[100]">
                <div className="bg-[#050608]/95 backdrop-blur-xl border border-slate-700 p-3 rounded-xl shadow-2xl ring-1 ring-white/10">
                  <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${config.style.split(' ')[1]}`} />
                      <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">{config.label}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">#{catKey}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-normal font-medium">{detail}</p>
                  {KEYWORD_CODE_REFS[part] && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[9px] text-emerald-400 font-bold block flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                        底層引擎實裝 CJS/API:
                      </span>
                      <code className="text-[10px] font-mono text-slate-400 bg-black/50 px-1 py-0.5 rounded block border border-slate-900 break-all leading-tight">{KEYWORD_CODE_REFS[part]}</code>
                    </div>
                  )}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-[#050608] border-b border-r border-slate-700 rotate-45 -mt-1.5" />
              </div>
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

const LiveDeconstructPreview = ({ text, title }: { text?: string, title: string }) => {
  if (!text) return null;

  const timings: string[] = [];
  const conditions: string[] = [];
  const effects: string[] = [];
  const others: string[] = [];

  const words = [
    ...TIMING_KEYWORDS,
    ...CONDITION_KEYWORDS,
    ...CONNECTIVE_KEYWORDS,
    ...EFFECT_KEYWORDS,
    ...OTHER_KEYWORDS
  ].sort((a, b) => b.length - a.length);

  const regexStr = `(${words.join('|')}|[0-9]+%|[0-9]+點|1/[0-9]+|LV[0-9]+)`;
  const regex = new RegExp(regexStr, 'g');
  const found = text.match(regex) || [];

  found.forEach(w => {
    if (TIMING_KEYWORDS.includes(w)) timings.push(w);
    else if (CONDITION_KEYWORDS.includes(w)) conditions.push(w);
    else if (EFFECT_KEYWORDS.includes(w)) effects.push(w);
    else if (OTHER_KEYWORDS.includes(w) || w.match(/^[0-9]+%|[0-9]+點|1\/[0-9]+|LV[0-9]+$/)) others.push(w);
  });

  return (
    <div className="mt-3 p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3 shadow-lg animate-fade-in">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 animate-pulse" />
        <span className="text-xs font-bold text-slate-200">{title}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Timings */}
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5">
          <div className="text-[10px] text-amber-400 font-bold mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            1. 觸發時點 ({timings.length})
          </div>
          {timings.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {timings.map((t, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono font-bold">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 italic">無時點</span>
          )}
        </div>

        {/* Conditions */}
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5">
          <div className="text-[10px] text-blue-400 font-bold mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            2. 判定條件 ({conditions.length})
          </div>
          {conditions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {conditions.map((c, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono font-bold">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 italic">無條件</span>
          )}
        </div>

        {/* Effects */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
          <div className="text-[10px] text-emerald-400 font-bold mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            3. 發揮效果 ({effects.length})
          </div>
          {effects.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {effects.map((e, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono font-bold">
                  {e}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 italic">無效果</span>
          )}
        </div>

        {/* Others */}
        <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5">
          <div className="text-[10px] text-rose-400 font-bold mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            4. 數值與特殊 ({others.length})
          </div>
          {others.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {others.map((o, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono font-bold">
                  {o}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 italic">無特殊項</span>
          )}
        </div>
      </div>
    </div>
  );
};

const GrammarLegend = ({ currentText = "" }: { currentText?: string }) => {
  const [activeCategory, setActiveCategory] = useState<string>("timing");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const categories = [
    {
      id: "timing",
      label: "🕒 描述時點 (Timings)",
      style: "text-amber-300 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.25)]",
      desc: "指示效果發生的特定戰鬥系統時間序列。戰鬥引擎會在此時點對應狀態機進行觸發與結算。",
      keywords: TIMING_KEYWORDS
    },
    {
      id: "condition",
      label: "⛭ 描述條件 (Conditions)",
      style: "text-blue-300 bg-blue-500/10 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.25)]",
      desc: "系統判斷效果是否觸發的邏輯前提與狀態。必須滿足這些判定，效果才能順利下發。",
      keywords: CONDITION_KEYWORDS
    },
    {
      id: "connective",
      label: "⛓ 連接詞 (Connectives)",
      style: "text-purple-300 bg-purple-500/10 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.25)]",
      desc: "決定效果執行流向與先後關係的連接標識。",
      keywords: CONNECTIVE_KEYWORDS
    },
    {
      id: "effect",
      label: "⚡ 描述效果 (Effects)",
      style: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.25)]",
      desc: "戰鬥引擎最終執行的原子化效果指令。",
      keywords: EFFECT_KEYWORDS
    },
    {
      id: "status",
      label: "🌀 異常狀態 (Status Ailments)",
      style: "text-pink-300 bg-pink-500/10 border-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.25)]",
      desc: "包含控制類、弱化類、限制類、衍化類與附屬類異常狀態。底層戰鬥引擎會透過對應狀態處理器進行生命週期維護與效果結算。",
      keywords: STATUS_KEYWORDS
    },
    {
      id: "other",
      label: "💎 數值與特殊 (Others)",
      style: "text-rose-300 bg-rose-500/10 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.25)]",
      desc: "精確的數值比例、數值點位、特殊印記、自身/對手對象或特殊等級標識。",
      keywords: OTHER_KEYWORDS
    }
  ];

  const currentCat = categories.find(c => c.id === activeCategory) || categories[0];

  const filteredWords = currentCat.keywords.filter(word => {
    const isMatched = word.toLowerCase().includes(searchQuery.toLowerCase());
    const detail = KEYWORD_DETAILS[word] || "";
    const code = KEYWORD_CODE_REFS[word] || "";
    return isMatched || detail.includes(searchQuery) || code.includes(searchQuery);
  });

  return (
    <div className="border border-slate-800/80 rounded-xl p-4 bg-[#050608]/60 backdrop-blur-md space-y-4 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-200 tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            🔮 協定分詞：戰鬥引擎語意與代碼對照圖鑑 (Interactive Rule Blueprint)
          </span>
          <p className="text-[10px] text-slate-400 leading-normal">
            綠色高亮代表目前文字框中「已包含」此關鍵字。點擊任意字詞，即可於右側即時載入其在戰鬥狀態機（BattleContext）中的**底層代碼/API 映射**。
          </p>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋字詞、語意或 API 代碼..."
            className="text-[10px] w-full md:w-56 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-[10px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categories Tabs (分流顯示) */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          const matchedCount = cat.keywords.filter(w => currentText.includes(w)).length;
          
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setSelectedWord(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all duration-200 flex items-center gap-1.5 ${
                isActive 
                  ? cat.style 
                  : "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              {cat.label}
              {matchedCount > 0 && (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black scale-90">
                  {matchedCount} matched
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Keywords Cloud List */}
        <div className="md:col-span-2 space-y-3">
          <div className="bg-[#050608]/40 rounded-xl p-3 border border-slate-900 space-y-2">
            <p className="text-[10px] text-slate-400 italic leading-normal">
              {currentCat.desc}
            </p>

            <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto p-1 leading-relaxed custom-scrollbar">
              {filteredWords.map((word) => {
                const isMatched = currentText.includes(word);
                const isSelected = selectedWord === word;
                
                let wordColor = "border-slate-800 text-slate-400 bg-slate-950/40 hover:bg-slate-900 hover:text-slate-200";
                if (isMatched) {
                  wordColor = "border-emerald-500/40 text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
                }
                if (isSelected) {
                  wordColor = "border-emerald-400 text-emerald-200 bg-emerald-400/20 scale-[1.03] ring-1 ring-emerald-400/30 font-black";
                }

                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() => setSelectedWord(word === selectedWord ? null : word)}
                    className={`text-[10px] px-2 py-1 rounded-md border font-mono transition-all duration-150 cursor-pointer flex items-center gap-1 ${wordColor}`}
                  >
                    {isMatched && <span className="text-emerald-400 text-[8px] animate-pulse">●</span>}
                    {word}
                  </button>
                );
              })}
              {filteredWords.length === 0 && (
                <span className="text-[10px] text-slate-600 italic">無匹配關鍵字</span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Word Details Panel */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex flex-col justify-between min-h-[160px]">
          {selectedWord ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-bold text-slate-100 font-mono flex items-center gap-1">
                  🔍 語法：<span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black">{selectedWord}</span>
                </span>
                {currentText.includes(selectedWord) && (
                  <span className="text-[9px] bg-emerald-950/80 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black animate-pulse">
                    已匹配
                  </span>
                )}
              </div>
              
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider">📝 引擎語意與判定作用:</span>
                <p className="text-[11px] text-slate-300 leading-normal">
                  {KEYWORD_DETAILS[selectedWord] || "系統標準分詞，用於戰鬥動作序列或狀態關聯判斷。"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-500 block flex items-center gap-1 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  💻 底層戰鬥引擎代碼 (TS/CJS API):
                </span>
                <code className="text-[10px] font-mono text-slate-200 bg-slate-900/80 p-1.5 rounded border border-slate-800 block break-all leading-tight">
                  {KEYWORD_CODE_REFS[selectedWord] || "/* 引擎自動映射與執行，無需手動掛鉤 */"}
                </code>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <span className="text-lg">💡</span>
              <span className="text-[10px] text-slate-500 font-bold mt-2">
                請點選左方雲端關鍵字
              </span>
              <p className="text-[9px] text-slate-600 leading-normal max-w-[180px] mt-1">
                即時查閱該分詞所關聯之戰鬥代碼 API 與屬性狀態判定規則！
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ElfEditorProps {
  initialElf?: Elf;
  onSaveElf: (elf: Elf) => void;
  onBack: () => void;
  initialTab?: "ai" | "manual" | "blockly";
}

export default function ElfEditor({ initialElf: suppliedElf, onSaveElf, onBack, initialTab }: ElfEditorProps) {
  const [initialElf, setInitialElf] = useState(suppliedElf);
  useEffect(() => setInitialElf(suppliedElf), [suppliedElf?.id, suppliedElf?.name]);
  const [manualDraftId] = useState(() => `custom_${Date.now()}`);
  const [activeTab, setActiveTab] = useState<"ai" | "manual" | "blockly">(initialTab || (initialElf ? "manual" : "ai"));
  const [manualSection, setManualSection] = useState<EditorSection>("basic");
  // AI（Gemini）是否可用：未設定 GEMINI_API_KEY 時停用 AI 按鈕，改用本地解析
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/ai-status").then(r => r.json()).then(d => setAiEnabled(!!d.enabled)).catch(() => setAiEnabled(false));
  }, []);
  const [prompt, setPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeywordInfo, setSelectedKeywordInfo] = useState<any>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<string>("detect");
  const [copiedEffect, setCopiedEffect] = useState<string | null>(null);
  const [unimplementedEffects, setUnimplementedEffects] = useState<any[]>([]);
  const [selectedDissectElfId, setSelectedDissectElfId] = useState<string | null>(null);
  const [isParsingEffect, setIsParsingEffect] = useState<boolean>(false);
  const [tokenDissectText, setTokenDissectText] = useState<string>("");
  const [isDissectingWithAI, setIsDissectingWithAI] = useState<boolean>(false);
  const [aiDissectedResult, setAiDissectedResult] = useState<any | null>(null);

  const handleAIDissectTokens = async (textToParse: string) => {
    if (!textToParse) return;
    setIsDissectingWithAI(true);
    setAiDissectedResult(null);
    try {
      const response = await fetch("/api/dissect-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: textToParse }),
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setAiDissectedResult(resData.data);
      } else {
        console.error("AI 語義分詞解構失敗:", resData.error);
      }
    } catch (err) {
      console.error("語義分詞請求出錯:", err);
    } finally {
      setIsDissectingWithAI(false);
    }
  };
  const DETECTION_KEYWORDS = [
    // 1. 描述時點
    { keyword: "回合開始", tag: "時點", moduleName: "時間控制狀態機", moduleId: "core_turn_start", suggestion: "每回合雙方正式發起進攻前觸發，適合設定防禦或預熱效果。", effectReference: "onTurnStart()" },
    { keyword: "回合結束", tag: "時點", moduleName: "回合結束結算模組", moduleId: "core_turn_end", suggestion: "回合所有結算完成後觸發，通常用於生命回復、固傷結算或狀態清除。", effectReference: "onTurnEnd()" },
    { keyword: "登場", tag: "時點", moduleName: "登場威壓初始化器", moduleId: "core_on_enter", suggestion: "從待機區進入戰鬥位時立即觸發，是「進場威壓」類效果的核心時點。", effectReference: "onEnterBattle()" },
    { keyword: "陣亡", tag: "時點", moduleName: "臨終遺言觸發器", moduleId: "core_on_death", suggestion: "自身體力歸零並下場時觸發，常見於「臨終遺言」或「自爆反傷」機制。", effectReference: "onDeath()" },
    { keyword: "被擊敗", tag: "時點", moduleName: "擊敗結算判定機", moduleId: "core_on_defeated", suggestion: "精靈被對手技能直接擊殺下場時發動，適合附帶對手懲罰或我方繼承效果。", effectReference: "onDefeated()" },
    { keyword: "受擊", tag: "時點", moduleName: "受擊防禦反應堆", moduleId: "core_on_hit_by_enemy", suggestion: "受到對手主動攻擊（包含傷害或效果）時觸發，最適合設定反彈或減傷護盾。", effectReference: "onHit()" },
    { keyword: "攻擊時", tag: "時點", moduleName: "主動出招增益器", moduleId: "core_on_attack", suggestion: "自身主動發起攻擊時觸發，可用於暴擊率提升、無視防禦或額外傷害加成。", effectReference: "onAttack()" },
    { keyword: "先手", tag: "時點", moduleName: "高速先制判定機", moduleId: "core_act_first", suggestion: "在本回合比對手先行行動的情況下觸發，極大限度提升壓制力。", effectReference: "onActFirst()" },
    { keyword: "後手", tag: "時點", moduleName: "後發制人防衛機", moduleId: "core_act_last", suggestion: "在本回合比對手後行行動的情況下觸發，適合後手控場或反制強攻。", effectReference: "onActLast()" },
    { keyword: "受傷後", tag: "時點", moduleName: "受傷反擊反彈器", moduleId: "core_on_damaged", suggestion: "受到實質體力扣減傷害後觸發，可用於吸血反擊、反彈固傷 or 保命鎖血。", effectReference: "onDamaged()" },
    { keyword: "技能使用時", tag: "時點", moduleName: "技能發動監聽器", moduleId: "core_on_skill_use", suggestion: "主動施放任何技能時（含屬性與攻擊）觸發，適合前置判定。", effectReference: "onSkillUse()" },
    { keyword: "切換時", tag: "時點", moduleName: "切換調度器", moduleId: "core_on_switch", suggestion: "主動替換下場或換上場時觸發，通常用於換人後的資源傳遞或保護機制。", effectReference: "onSwitch()" },
    { keyword: "對手使用技能後", tag: "時點", moduleName: "對手行動監聽器", moduleId: "core_after_enemy_skill", suggestion: "對手順利發動技能並結算完畢後觸發，用於反制或能力剝奪。", effectReference: "afterEnemySkill()" },

    // 2. 描述條件
    { keyword: "若", tag: "邏輯", moduleName: "邏輯條件分流器", moduleId: "core_logic_if", suggestion: "邏輯判定的起點，若後續條件成立則執行後置效果。", effectReference: "if (checkCondition())" },
    { keyword: "HP", tag: "數值", moduleName: "體力上限與比例器", moduleId: "core_hp_ratio", suggestion: "精靈的體力百分比或具體值，是多數血量判定機制的基準線。", effectReference: "elf.hpPercent" },
    { keyword: "體力", tag: "數值", moduleName: "體力上限與比例器", moduleId: "core_hp_ratio", suggestion: "精靈的血量狀態，是多數機制判定的核心基準值。", effectReference: "elf.currentHp" },
    { keyword: "異常狀態", tag: "狀態", moduleName: "異常狀態檢測器", moduleId: "core_status_checker", suggestion: "包含麻痺、害怕等控制類，以及燒傷、中毒等非控制損血類狀態。", effectReference: "elf.hasStatusEffect()" },
    { keyword: "低於", tag: "判定", moduleName: "數值低限判定機", moduleId: "core_less_than", suggestion: "數值低於特定閾值時觸發（如體力低於50%），最常見的逆境爆發條件。", effectReference: "value < threshold" },
    { keyword: "超過", tag: "判定", moduleName: "數值高限判定機", moduleId: "core_greater_than", suggestion: "數值高於特定值時觸發，常用於健康狀態下的額外壓制與優勢加成。", effectReference: "value > threshold" },
    { keyword: "滿", tag: "判定", moduleName: "滿值飽和判定機", moduleId: "core_is_full", suggestion: "數值達到100%飽和狀態。例如：體力滿時、PP滿時。", effectReference: "value === maxValue" },
    { keyword: "命中後", tag: "判定", moduleName: "命中觸發過濾器", moduleId: "core_on_skill_hit", suggestion: "技能成功擊中目標時觸發，是絕大多數技能效果生效的前提。", effectReference: "onSkillHit()" },
    { keyword: "未命中", tag: "判定", moduleName: "未命中補償器", moduleId: "core_on_skill_miss", suggestion: "技能被對手閃避或因命中率不足失敗時觸發補償（如未命中則附加固傷）。", effectReference: "onSkillMiss()" },
    { keyword: "擊敗對手", tag: "判定", moduleName: "連斬滾雪球判定機", moduleId: "core_kill_trigger", suggestion: "成功將對手體力清零時觸發，適合啟動「下隻登場精靈封屬」或全能力提升。", effectReference: "onDefeatEnemy()" },
    { keyword: "未擊敗對手", tag: "判定", moduleName: "未擊敗補償判定機", moduleId: "core_not_kill_trigger", suggestion: "通常用於大招或高威力技能，若無法秒殺則附加額外懲罰或強力吸血。", effectReference: "onNotDefeatEnemy()" },
    { keyword: "百分比", tag: "條件", moduleName: "比例換算器", moduleId: "core_percentage", suggestion: "以最大值或當前值的比例進行判斷或效果折算。", effectReference: "ratio * 100" },
    { keyword: "暴擊", tag: "條件", moduleName: "暴擊判定器", moduleId: "core_critical_hit", suggestion: "技能觸發致命一擊（1.5倍傷害）時判定，常用於暴擊後附加狀態。", effectReference: "isCritical" },

    // 3. 連接詞
    { keyword: "則", tag: "邏輯", moduleName: "邏輯分支執行器", moduleId: "core_then", suggestion: "條件成立後的執行動作引動作，指示後續效果的執行。", effectReference: "thenExecute()" },
    { keyword: "並", tag: "連接", moduleName: "並行效果分配器", moduleId: "core_and", suggestion: "表示兩個效果同時或順序發生，互不衝突。", effectReference: "executeA(); executeB();" },
    { keyword: "且", tag: "連接", moduleName: "複合條件過濾器", moduleId: "core_logical_and", suggestion: "邏輯與關係，要求前後多個條件同時成立時，效果才下發。", effectReference: "condA && condB" },
    { keyword: "否則", tag: "連接", moduleName: "替代方案執行器", moduleId: "core_else", suggestion: "當前置條件不成立時，執行的替代方案或補償效果。", effectReference: "elseExecute()" },
    { keyword: "同時", tag: "連接", moduleName: "同步結算調度器", moduleId: "core_sync", suggestion: "多個效果在同一個結算幀內同步執行，通常用於多個屬性同時改變。", effectReference: "syncExecute()" },
    { keyword: "改為", tag: "連接", moduleName: "重置與路由覆蓋器", moduleId: "core_override", suggestion: "強制轉換原有的結算邏輯、數值路徑或判定結果。例如傷害改為真傷。", effectReference: "overrideValue()" },
    { keyword: "之後", tag: "連接", moduleName: "順序執行佇列", moduleId: "core_sequence", suggestion: "順序執行，在前一效果結算完畢後接著執行下一個動作。", effectReference: "sequenceNext()" },

    // 4. 描述具體效果
    { keyword: "附加", tag: "附加", moduleName: "狀態附加引擎", moduleId: "core_add_status", suggestion: "將特定的異常狀態、屬性印記或特殊 Buffer 施加到目標身上。", effectReference: "target.addStatusEffect()" },
    { keyword: "消除", tag: "消除", moduleName: "能力消除管理器", moduleId: "core_dispel", suggestion: "移除目標身上的能力提升（消強）或所有回合類增益效果。", effectReference: "target.dispelBuffs()" },
    { keyword: "吸取", tag: "吸取", moduleName: "資源掠奪器", moduleId: "core_drain", suggestion: "奪取對手的體力、PP或能力等級，並直接補給給自身。", effectReference: "drainResource()" },
    { keyword: "恢復", tag: "恢復", moduleName: "體力PP修復器", moduleId: "core_recover", suggestion: "補充自身的體力值、回復技能PP點數或增加防禦護盾值。", effectReference: "self.recoverHp()" },
    { keyword: "傷害", tag: "攻擊", moduleName: "傷害輸出結算器", moduleId: "core_damage_calc", suggestion: "對目標造成體力扣減。包含物理傷害、特殊傷害、固定傷害。", effectReference: "calculateAndApplyDamage()" },
    { keyword: "害怕", tag: "控制", moduleName: "窒息恐懼控場模組", moduleId: "sk_status_lock", suggestion: "極為強力的異常狀態控制：使目標在 1~2 回合內無法行動。", effectReference: "target.addStatus('fear')" },
    { keyword: "癱瘓", tag: "控制", moduleName: "雷電癱瘓控制模組", moduleId: "sm_thunder_control", suggestion: "強力控制：無法行動且閃避率與命中率歸零，是電系精靈招牌效果。", effectReference: "target.addStatus('paralyzed')" },
    { keyword: "必中", tag: "特性", moduleName: "絕對命中判定器", moduleId: "core_always_hit", suggestion: "無視對方的閃避率與命中率修正，確保技能 100% 命中。", effectReference: "skill.isAlwaysHit = true" },
    { keyword: "免控", tag: "免疫", moduleName: "水天反彈免疫模組", moduleId: "sm_status_reflect", suggestion: "在當前戰鬥環境下極為重要，可 100% 免疫任何來自對手的異常狀態控制。", effectReference: "self.immuneToStatus = true" },
    { keyword: "回血", tag: "續航", moduleName: "深淵體力滋養模組", moduleId: "sm_hp_boost_heal", suggestion: "補充自身體力值，可依據最大體力百分比或當前損血量計算。", effectReference: "self.heal()" },
    { keyword: "翻倍", tag: "爆發", moduleName: "威力爆發增傷器", moduleId: "core_multiplier", suggestion: "將數值（通常是傷害值）乘以二。常用於機率翻倍、低血翻倍。", effectReference: "damage *= 2" },
    { keyword: "真傷", tag: "真實傷害", moduleName: "極寒禁錮冰魂模組", moduleId: "sm_ice_king_soul", suggestion: "真實傷害：無視對手護盾、防禦與一切減傷機制，直接扣減等額體力。", effectReference: "applyTrueDamage()" },
    { keyword: "封印", tag: "控制", moduleName: "技能禁錮封鎖器", moduleId: "core_seal", suggestion: "使目標在一定回合內無法使用特定類型的技能（如大招、屬性技能）。", effectReference: "target.sealSkills()" },
    { keyword: "封屬", tag: "封印", moduleName: "先制消強封印模組", moduleId: "sk_dispel_seal", suggestion: "封印對手屬性技能，使其無法使用 any 變化、增益、削弱或回復技能。", effectReference: "target.sealAttributeSkills()" },
    { keyword: "瞬殺", tag: "機制", moduleName: "先制消強封印模組", moduleId: "sk_dispel_seal", suggestion: "機率性一擊必殺效果，直接清空對手剩餘體力，建議判定機率設為 3% 或 5%。", effectReference: "target.instantKill()" },
    { keyword: "麻痺", tag: "控制", moduleName: "雷電麻痺控制模組", moduleId: "sm_thunder_control", suggestion: "核心控制：使對手無法行動，且速度減半，增加對局優勢。", effectReference: "target.addStatus('paralysis')" },
    { keyword: "免死", tag: "生存", moduleName: "意志殘留保命模組", moduleId: "sm_fatal_survival", suggestion: "在致命傷害時保留 1 點血量，常伴隨「免疫該次傷害並消除對手效果」。", effectReference: "self.preventFatalDamage()" },
    { keyword: "鎖血", tag: "生存", moduleName: "意志殘留保命模組", moduleId: "sm_fatal_survival", suggestion: "受到致死傷害時，體力最低保留至 1 點，避免被高威力爆發直接擊殺。", effectReference: "self.lockHpAtOne()" },
    { keyword: "吸血", tag: "續航", moduleName: "吸血排山護盾模組", moduleId: "sk_vampire_shield", suggestion: "吸取對手體力值補給自身，溢出部分還能轉化為等額護盾防禦高傷害。", effectReference: "drainHp()" },
    { keyword: "護盾", tag: "防禦", moduleName: "吸血排山護盾模組", moduleId: "sk_vampire_shield", suggestion: "吸收一定數值的傷害。護盾存續期間可防止特定異常狀態。", effectReference: "self.addShield()" },
    { keyword: "固定傷害", tag: "固傷", moduleName: "固定傷害計算器", moduleId: "core_fixed_dmg", suggestion: "固定傷害（粉碎傷害）能無視防禦等級，穩定消耗高防坦客精靈。", effectReference: "applyFixedDamage()" },
    { keyword: "減傷", tag: "生存", moduleName: "減傷護甲狀態機", moduleId: "core_dmg_reduce", suggestion: "常駐減少受到的非真實傷害（如減少 60% 傷害），極大增強續航生存力。", effectReference: "damage *= 0.4" },
    { keyword: "消回合", tag: "消除", moduleName: "回合類效果驅散器", moduleId: "core_remove_round_buffs", suggestion: "驅散對手身上由技能附帶的回合類效果（如 3 回合免傷、免疫等）。", effectReference: "target.removeRoundEffects()" },
    { keyword: "減少", tag: "削弱", moduleName: "資源削減器", moduleId: "core_reduce_resource", suggestion: "直接減少對手的體力、PP值或下調對手能力等級。", effectReference: "target.reduceHp()" },
    { keyword: "燒傷", tag: "控制", moduleName: "灼燒持續流血模組", moduleId: "sk_burn_dot", suggestion: "持續異常狀態：每回合損失最大體力，且物理攻擊傷害減半。", effectReference: "target.addStatus('burn')" },
    { keyword: "凍結", tag: "控制", moduleName: "極寒冰凍控場模組", moduleId: "sk_freeze_lock", suggestion: "異常狀態控制：使目標無法行動，且無法回復體力與PP。", effectReference: "target.addStatus('freeze')" },
    { keyword: "中毒", tag: "控制", moduleName: "猛毒持續損血模組", moduleId: "sk_poison_dot", suggestion: "持續異常狀態：每回合損失最大體力或當前體力比例。", effectReference: "target.addStatus('poison')" },

    // 5. 其他（未分類內容）
    { keyword: "回合類效果", tag: "機制定義", moduleName: "狀態定義模組", moduleId: "def_round_effect", suggestion: "專指透過使用技能所附帶的，具備倒數回合數的狀態（如 3回合內免疫異常）。被動或魂印觸發的非技能附帶效果不屬於此類。", effectReference: "elf.getRoundEffects()" },
    { keyword: "印記", tag: "印記", moduleName: "特殊印記模組", moduleId: "def_mark", suggestion: "自定義的標記/印記系統，獨立於異常與能力升降之外，具有專屬的層數 or 持續機制。", effectReference: "elf.getMarks()" },
    { keyword: "星執者", tag: "印記", moduleName: "星執者模組", moduleId: "mark_star_bearer", suggestion: "蓓麗安特專屬的能量消耗與真傷/恢復機制化身。", effectReference: "elf.getMark('star_bearer')" },
    { keyword: "恐懼之花", tag: "印記", moduleName: "恐懼之花模組", moduleId: "mark_flower_of_fear", suggestion: "恐懼化身·咤克斯專屬的封印異常狀態與高額真傷制裁。", effectReference: "elf.getMark('fear_flower')" },

    // 6. 建議/推薦關鍵字
    { keyword: "最大體力", tag: "生命", moduleName: "深淵體力滋養模組", moduleId: "sm_hp_boost_heal", suggestion: "建議增加「最大體力上限提升」被動效果，能有效增強面對高固傷對手時的生存力。", effectReference: "self.maxHp" },
    { keyword: "增傷", tag: "爆發", moduleName: "絕境破釜增傷模組", moduleId: "sm_low_hp_boost", suggestion: "建議配備「絕境破釜增傷模組」或「破記」，在低體力時大幅提高傷害與先制。", effectReference: "damage *= (1 + boost)" },
    { keyword: "先制+1", tag: "先制", moduleName: "絕境破釜增傷模組", moduleId: "sm_low_hp_boost", suggestion: "推薦搭配先制+1被動，能在低血量狀態下掌握出手先權。", effectReference: "priority += 1" },
    { keyword: "先制", tag: "先制", moduleName: "先制消強封印模組", moduleId: "sk_dispel_seal", suggestion: "先制技能極為重要，建議配備具有「先制+3 且必中」的消除能力提升技能。", effectReference: "priority += 3" },
    { keyword: "免疫異常", tag: "免疫", moduleName: "水天反彈免疫模組", moduleId: "sm_status_reflect", suggestion: "建議使用「水天反彈免疫模組」或「免疫印記」，防止被麻痺、害怕等異常控死。", effectReference: "self.immuneToStatus = true" },
    { keyword: "強化", tag: "屬性", moduleName: "全能劍舞強化模組", moduleId: "sk_sword_dance", suggestion: "強化技能是提升輸出的關鍵，推薦使用「全能劍舞強化模組」，100% 提攻速與命中。", effectReference: "self.boostStats()" },
    { keyword: "消強", tag: "屬性", moduleName: "先制消強封印模組", moduleId: "sk_dispel_seal", suggestion: "消除對手能力提升（消強）是核心反制手段，若消除成功可附帶 2 回合封印屬性。", effectReference: "target.dispelStatBuffs()" },
    { keyword: "窒息", tag: "固傷", moduleName: "窒息恐懼控場模組", moduleId: "sk_status_lock", suggestion: "窒息可對對手造成持續的最大體力百分比流失，並阻斷對手的體力修復。", effectReference: "target.addStatus('suffocation')" },
    { keyword: "連擊", tag: "連擊", moduleName: "連擊多段疊加模組", moduleId: "sk_multi_hit_buff", suggestion: "連擊多段攻擊可以快速突破對手的次數免傷護盾，且機率提升攻擊等級。", effectReference: "skill.hits = 3" },
    { keyword: "使用技能成功時", tag: "條件", moduleName: "觸發條件模組", moduleId: "cond_on_use", suggestion: "「使用技能成功時」表示技能只要發動（未被封印 or 中斷）即可觸發。", effectReference: "onSkillUse()" },
    { keyword: "技能無效時", tag: "條件", moduleName: "觸發條件模組", moduleId: "cond_on_invalid", suggestion: "當攻擊技能被對手免疫 or 閃避時的補償機制（如未命中則附加固傷等）。", effectReference: "onSkillMiss()" }
  ];

  const fullDetectionKeywords = useMemo(() => {
    const list = [...DETECTION_KEYWORDS];
    const existing = new Set(list.map(k => k.keyword));
    
    const addToFullList = (word: string, tag: string, fallbackModule: string) => {
      if (existing.has(word)) return;
      existing.add(word);
      const detail = KEYWORD_DETAILS[word] || `系統自動識別之【${tag}】。`;
      list.push({
        keyword: word,
        tag: tag,
        moduleName: fallbackModule,
        moduleId: `auto_${word}`,
        suggestion: detail,
        effectReference: `check_${word}()`
      });
    };

    TIMING_KEYWORDS.forEach(w => addToFullList(w, "時點", "時間控制狀態機"));
    CONDITION_KEYWORDS.forEach(w => addToFullList(w, "條件", "邏輯條件判定器"));
    CONNECTIVE_KEYWORDS.forEach(w => addToFullList(w, "連接", "邏輯分支執行器"));
    EFFECT_KEYWORDS.forEach(w => addToFullList(w, "效果", "戰鬥引擎效果指令"));
    STATUS_KEYWORDS.forEach(w => addToFullList(w, "異常", "異常狀態處理器"));
    OTHER_KEYWORDS.forEach(w => addToFullList(w, "數值", "數值與特殊印記"));

    return list;
  }, []);

  const analyzedKeywords = useMemo(() => prompt ? fullDetectionKeywords.filter(k => prompt.includes(k.keyword)) : [], [prompt, fullDetectionKeywords]);

  // Form State
  const [elfName, setElfName] = useState<string>("自訂星皇");
  const [elfType, setElfType] = useState<string>("聖靈");
  const [path, setPath] = useState<string>("");
  const [isAlienElf, setIsAlienElf] = useState<boolean>(initialElf?.isAlienElf || false);
  const [baseStats, setBaseStats] = useState<BaseStats>({
    hp: 135,
    atk: 125,
    def: 95,
    spatk: 80,
    spdef: 95,
    speed: 115,
  });
  const [elfDescription, setElfDescription] = useState<string>("");
  const [height, setHeight] = useState<number>(0);
  const [weight, setWeight] = useState<number>(0);
  const [gender, setGender] = useState<string>("無性別");
  const [specialModeRating, setSpecialModeRating] = useState<string>("未評級");
  const [destinyRank, setDestinyRank] = useState<string>("");
  
  // Custom nature modifiers
  const [natureModifiers, setNatureModifiers] = useState<{ [key in keyof BaseStats]?: number }>(
    () => getDefaultNatureModifiers({ hp: 0, atk: 125, def: 95, spatk: 80, spdef: 95, speed: 115 }),
  );

  // Custom effort values (EVs / 學習力)
  const [evs, setEvs] = useState<BaseStats>({
    hp: 255,
    atk: 255,
    def: 0,
    spatk: 0,
    spdef: 0,
    speed: 0,
  });

  const [soulMarkName, setSoulMarkName] = useState<string>("諸神之怒");
  const [soulMarkDesc, setSoulMarkDesc] = useState<string>("每回合結束時有30%機率使對手麻痺；若自身體力低於50%則每回合結束回復15%最大體力");
  const [soulMarkBadgeChar, setSoulMarkBadgeChar] = useState<string>("");
  const [soulMarkEffectType, setSoulMarkEffectType] = useState<any>("paralyze_chance");
  const [soulMarkValue, setSoulMarkValue] = useState<number>(30);
  const [soulMarkCustomCode, setSoulMarkCustomCode] = useState<string>("");
  const [kit, setKit] = useState<KitEntry[]>(initialElf?.kit || []);
  const [guildBonuses, setGuildBonuses] = useState<BaseStats>(initialElf?.guildBonuses || {
    hp: 30,
    atk: 15,
    def: 15,
    spatk: 15,
    spdef: 15,
    speed: 10,
  });

  const [gen2TraitName, setGen2TraitName] = useState<string>("");
  const [gen2TraitDesc, setGen2TraitDesc] = useState<string>("");
  const [exTraitName, setExTraitName] = useState<string>("");
  const [exTraitDesc, setExTraitDesc] = useState<string>("");
  const [exclusiveTraits, setExclusiveTraits] = useState<NonNullable<NonNullable<Elf['alienTraits']>['exclusiveTraits']>>([]);
  const [alienTraitName, setAlienTraitName] = useState<string>("");
  const [generalTraitName, setGeneralTraitName] = useState<string>("");

  const [skills, setSkills] = useState<Skill[]>([
    {
      name: "星皇碎宇裂",
      type: "聖靈",
      category: "物理",
      power: 150,
      pp: 5,
      description: "威力巨大。30%機率使對手害怕 1 回合",
      priority: 0,
      effectType: "status_inflict",
      effectDetail: "fear:30",
    },
    {
      name: "星皇閃",
      type: "普通",
      category: "物理",
      power: 85,
      pp: 15,
      description: "先制+1。迅捷無比的衝擊",
      priority: 1,
      effectType: "none",
      effectDetail: "",
    },
    {
      name: "萬世尊威",
      type: "無屬性",
      category: "屬性",
      power: 0,
      pp: 10,
      description: "自身攻擊+2、防禦+1、速度+1",
      priority: 0,
      effectType: "stat_up",
      effectDetail: "atk+2,def+1,speed+1",
    },
    {
      name: "星月迴天",
      type: "無屬性",
      category: "屬性",
      power: 0,
      pp: 5,
      description: "回復自身最大體力的 50%",
      priority: 0,
      effectType: "heal",
      effectDetail: "heal:50",
    },
  ]);
  const [skillPool, setSkillPool] = useState<Skill[]>([]);
  const [replacingSkillIdx, setReplacingSkillIdx] = useState<number | null>(null);
  const [inscriptions, setInscriptions] = useState<(Inscription | undefined)[]>(getEffectiveInscriptions(initialElf?.inscriptions));
  const [resistances, setResistances] = useState(initialElf?.resistances || getDefaultResistances());
  const [editingInscIndex, setEditingInscIndex] = useState<number | null>(null);
  const [expandedSkillKey, setExpandedSkillKey] = useState<string | null>(null);
  const [showSkillPool, setShowSkillPool] = useState(false);
  const [zoomedSkillModal, setZoomedSkillModal] = useState<{ idx: number; isPoolSkill: boolean } | null>(null);
  const [zoomedTraitModal, setZoomedTraitModal] = useState<'gen2' | 'ex' | null>(null);
  const [isSkillStoneModalOpen, setIsSkillStoneModalOpen] = useState<boolean>(false);
  const [stoneAttr, setStoneAttr] = useState<string>("草");
  const [stoneGrade, setStoneGrade] = useState<SkillStoneGrade>("S");
  const [stoneCategory, setStoneCategory] = useState<'物理' | '特殊'>("物理");
  const [stoneIsPerfect, setStoneIsPerfect] = useState<boolean>(true);
  const [stoneEffectId, setStoneEffectId] = useState<string>("");
  const [stoneTargetSlot, setStoneTargetSlot] = useState<number>(0);

  useEffect(() => {
    if (initialElf) {
      setElfName(initialElf.name);
      setElfType(initialElf.type);
      setBaseStats(initialElf.baseStats);
      if (initialElf.evs) {
        setEvs(initialElf.evs);
      } else {
        setEvs(getDefaultEvs(initialElf.baseStats));
      }
      if (initialElf.natureModifiers) {
        setNatureModifiers(initialElf.natureModifiers);
      } else {
        setNatureModifiers(getDefaultNatureModifiers(initialElf.baseStats));
      }
      setElfDescription(initialElf.description || "");
      setHeight(initialElf.height || 0);
      setWeight(initialElf.weight || 0);
      setGender(initialElf.gender || "無性別");
      setSpecialModeRating(initialElf.specialModeRating || "未評級");
      setDestinyRank(initialElf.destinyRank || "");
      setPath(initialElf.path || "");
      const isZhakesi = initialElf.name === "湮滅之主・咤克斯" || initialElf.id === "zhakesi" || initialElf.soulMark?.name === "咤";
      setIsAlienElf(isZhakesi ? false : !!initialElf.isAlienElf);
      setSoulMarkName(initialElf.soulMark?.name || "");
      setSoulMarkDesc(initialElf.soulMark?.description || "");
      setSoulMarkBadgeChar(initialElf.soulMark?.badgeChar || "");
      setSoulMarkEffectType(initialElf.soulMark?.effectType || "none");
      setSoulMarkValue(initialElf.soulMark?.effectValue || 0);
      setSoulMarkCustomCode(initialElf.soulMark?.customCode || "");
      setKit(initialElf.kit || []);
      if (initialElf.guildBonuses) {
        setGuildBonuses(initialElf.guildBonuses);
      } else {
        setGuildBonuses({ hp: 30, atk: 15, def: 15, spatk: 15, spdef: 15, speed: 10 });
      }
      setGen2TraitName(isZhakesi ? "" : (initialElf.alienTraits?.gen2Trait?.name || ""));
      setGen2TraitDesc(isZhakesi ? "" : (initialElf.alienTraits?.gen2Trait?.description || ""));
      setExTraitName(isZhakesi ? "" : (initialElf.alienTraits?.exclusiveTrait?.name || ""));
      setExTraitDesc(isZhakesi ? "" : (initialElf.alienTraits?.exclusiveTrait?.description || ""));
      setExclusiveTraits(isZhakesi ? [] : (initialElf.alienTraits?.exclusiveTraits || []));
      setAlienTraitName(isZhakesi ? "" : (initialElf.alienTraits?.alienTrait?.name || ""));
      setGeneralTraitName(isZhakesi ? "" : (initialElf.alienTraits?.generalTrait?.name || ""));
      const eqSkills = (initialElf.skills || []).slice(0, 5);
      setSkills(eqSkills);
      const defMatch = DEFAULT_ELVES.find(e => e.name === initialElf.name || e.id === initialElf.id);
      const rawPool = [...(initialElf.skillPool || []), ...(defMatch?.skillPool || []), ...(initialElf.skills || [])];
      const uniquePoolMap = new Map<string, Skill>();
      rawPool.forEach(sk => {
        if (sk && sk.name && !uniquePoolMap.has(sk.name)) {
          uniquePoolMap.set(sk.name, sk);
        }
      });
      setSkillPool(enrichSkillPoolWithStones(Array.from(uniquePoolMap.values()), initialElf));
      setInscriptions(getEffectiveInscriptions(initialElf.inscriptions));
      setResistances(initialElf.resistances || getDefaultResistances());
    }
  }, [initialElf]);

  // Memoized available pool for replacing skills to avoid recalculation and UI freezes during typing or small changes
  const { isFifthSlot, availablePool } = useMemo(() => {
    if (replacingSkillIdx === null) {
      return { isFifthSlot: false, availablePool: [] };
    }
    const isFifth = replacingSkillIdx === 4 || (skills[replacingSkillIdx] && skills[replacingSkillIdx].isFifthSkill);
    const poolSource = skillPool && skillPool.length > 0 ? skillPool : skills;
    const enriched = enrichSkillPoolWithStones(poolSource, {
      name: elfName,
      alienTraits: { gen2Trait: { name: gen2TraitName, description: "" } }
    });
    const filtered = enriched.filter(sk => {
      const skIsFifth = sk.isFifthSkill || sk.name.includes("第五") || sk.power >= 160;
      return isFifth ? skIsFifth : !skIsFifth;
    });
    return { isFifthSlot: isFifth, availablePool: filtered };
  }, [replacingSkillIdx, skills, skillPool, elfName, gen2TraitName]);

  // AI Generated Elf Cache (before saving)
  const [rightColumnTab, setRightColumnTab] = useState<"input" | "analysis" | "preview">("input");
  const [previewElf, setPreviewElf] = useState<Elf | null>(null);
  const [isEffectModalOpen, setIsEffectModalOpen] = useState<boolean>(false);
  const [decompositionReport, setDecompositionReport] = useState<DecompositionReport | undefined>(initialElf?.decompositionReport);

  // Trigger Gemini AI Elf Parsing API
  const handleAIGenerate = async () => {
    if (!prompt.trim()) {
      setError("請輸入精靈的中文描述");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewElf(null);

    try {
      const res = await fetch("/api/generate-elf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "AI 解析精靈失敗");
      }

      const generated = result.data;
      
      // Sanitize property skills
      if (generated.skills) {
        generated.skills = generated.skills.map((s: any) => {
          if (s.category === '屬性') {
            s.type = '無屬性';
            s.power = 0;
          }
          return s;
        });
      }
      
      // Calculate derived stats using level 100 formulas
      const calculated = calculateElfStats(generated.baseStats, 100, undefined, generated.evs || evs, generated.natureModifiers || natureModifiers, undefined, generated.guildBonuses || guildBonuses);

      const finalElf: Elf = {
        id: initialElf?.id || `custom_${Date.now()}`,
        name: generated.name,
        type: generated.type,
        level: 100,
        baseStats: generated.baseStats,
        evs: generated.evs || evs,
        natureModifiers: generated.natureModifiers || natureModifiers,
        soulMark: generated.soulMark,
        skills: generated.skills,
        description: generated.description || "",
        calculatedStats: calculated,
        currentHp: calculated.hp,
        maxHp: calculated.hp,
        isCustom: true,
        decompositionReport: generated.decompositionReport,
      };

      setPreviewElf(finalElf);
      setRightColumnTab("preview");
      if (generated.decompositionReport) {
        setDecompositionReport(generated.decompositionReport);
      }

      // Load into manual form as well so they can edit it
      setElfName(finalElf.name);
      setElfType(finalElf.type);
      setBaseStats(finalElf.baseStats);
      if (generated.evs) setEvs(generated.evs);
      if (generated.natureModifiers) setNatureModifiers(generated.natureModifiers);
      if (generated.guildBonuses) setGuildBonuses(generated.guildBonuses);
      setElfDescription(finalElf.description);
      setIsAlienElf(!!finalElf.isAlienElf);
      setSoulMarkName(finalElf.soulMark?.name || "");
      setSoulMarkDesc(finalElf.soulMark?.description || "");
      setSoulMarkEffectType(finalElf.soulMark?.effectType || "none");
      setSoulMarkValue(finalElf.soulMark?.effectValue || 0);
      setSoulMarkCustomCode(finalElf.soulMark?.customCode || "");
      setGen2TraitName(finalElf.alienTraits?.gen2Trait?.name || "");
      setGen2TraitDesc(finalElf.alienTraits?.gen2Trait?.description || "");
      setExTraitName(finalElf.alienTraits?.exclusiveTrait?.name || "");
      setExTraitDesc(finalElf.alienTraits?.exclusiveTrait?.description || "");
      setExclusiveTraits(finalElf.alienTraits?.exclusiveTraits || []);
      setAlienTraitName(finalElf.alienTraits?.alienTrait?.name || "");
      setGeneralTraitName(finalElf.alienTraits?.generalTrait?.name || "");
      const genEqSkills = (finalElf.skills || []).slice(0, 5);
      setSkills(genEqSkills);
      const genPoolRaw = [...(generated.skillPool || []), ...(finalElf.skills || []), ...skillPool];
      const genUniqueMap = new Map<string, Skill>();
      genPoolRaw.forEach((sk: Skill) => {
        if (sk && sk.name && !genUniqueMap.has(sk.name)) {
          genUniqueMap.set(sk.name, sk);
        }
      });
      setSkillPool(enrichSkillPoolWithStones(Array.from(genUniqueMap.values()), finalElf));

    } catch (err: any) {
      console.error(err);
      setError(err.message || "系統繁忙，無法調用 Gemini AI，請手動輸入精靈配置或重試。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalParse = () => {
    if (!prompt.trim()) {
      setError("請輸入精靈的中文描述");
      return;
    }
    
    try {
      const generated = parseFullElfData(prompt);
      if (!generated.name && !generated.skills?.length) {
         setError("本地解析失敗，無法識別有效格式。請確認文字是否包含【精靈名稱】、【核心技能組】等關鍵字。");
         return;
      }
      
      // Calculate derived stats
      const bs = generated.baseStats || { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
      const calculated = calculateElfStats(bs, 100, undefined, evs, natureModifiers, undefined, guildBonuses);

      const finalElf: Elf = {
        id: initialElf?.id || `custom_${Date.now()}`,
        name: generated.name || "未知精靈",
        type: generated.type || "無屬性",
        level: 100,
        baseStats: bs,
        evs: evs,
        natureModifiers: natureModifiers,
        soulMark: generated.soulMark || { name: "", description: "", effectType: "none", effectValue: 0 },
        skills: generated.skills || [],
        description: generated.rawPrompt || "",
        calculatedStats: calculated,
        currentHp: calculated.hp,
        maxHp: calculated.hp,
        isCustom: true,
      };

      setPreviewElf(finalElf);
      setRightColumnTab("preview");
      setError(null);

      // Load into manual form
      setElfName(finalElf.name);
      setElfType(finalElf.type);
      setBaseStats(finalElf.baseStats);
      if (finalElf.soulMark) {
        setSoulMarkName(finalElf.soulMark.name || "");
        setSoulMarkDesc(finalElf.soulMark.description || "");
        setSoulMarkCustomCode(finalElf.soulMark.customCode || "");
      }
      if (finalElf.skills) {
        const genEqSkills = finalElf.skills.slice(0, 5);
        setSkills(genEqSkills);
        setSkillPool(enrichSkillPoolWithStones(finalElf.skills, finalElf));
      }

    } catch (err: any) {
      setError("解析錯誤: " + err.message);
    }
  };

  // 儲存與匯出使用相同完整草稿；匯出並不代表效果已實裝。
  const buildManualElf = (): Elf => {
    const calculated = calculateElfStats(baseStats, 100, initialElf?.ivs, evs, natureModifiers,
      inscriptions as Inscription[], guildBonuses, initialElf?.hasAnnualBonus);
    const isZhakesi = elfName === "湮滅之主・咤克斯" || initialElf?.id === "zhakesi" || soulMarkName === "咤";

    return {
      ...initialElf,
      id: initialElf?.id || manualDraftId,
      name: elfName,
      type: elfType,
      level: 100,
      baseStats: baseStats,
      evs: evs,
      natureModifiers: natureModifiers,
      inscriptions: inscriptions as Inscription[],
      resistances: resistances,
      guildBonuses: guildBonuses,
      isAlienElf: isZhakesi ? false : isAlienElf,
      path: path || undefined,
      height,
      weight,
      gender,
      specialModeRating,
      destinyRank: destinyRank || undefined,
      description: elfDescription,
      soulMark: {
        ...initialElf?.soulMark,
        name: soulMarkName,
        description: soulMarkDesc,
        effectType: soulMarkEffectType,
        effectValue: soulMarkValue,
        badgeChar: soulMarkBadgeChar,
        customCode: soulMarkCustomCode,
      },
      kit: kit,
      alienTraits: (!isZhakesi && (gen2TraitName || exTraitName || alienTraitName || generalTraitName || exclusiveTraits.length)) ? {
        gen2Trait: gen2TraitName ? { name: gen2TraitName, description: gen2TraitDesc } : undefined,
        exclusiveTrait: exTraitName ? { name: exTraitName, description: exTraitDesc } : undefined,
        exclusiveTraits: exclusiveTraits.length ? exclusiveTraits : undefined,
        alienTrait: alienTraitName ? { name: alienTraitName, description: ALIEN_TRAITS[alienTraitName]?.description || "" } : undefined,
        generalTrait: generalTraitName ? { name: generalTraitName, description: GENERAL_TRAITS[generalTraitName]?.description || "" } : undefined,
      } : undefined,
      skills: skills.slice(0, 5),
      skillPool: (() => {
        const pRaw = [...skillPool, ...skills];
        const pMap = new Map<string, Skill>();
        pRaw.forEach(sk => {
          if (sk && sk.name && !pMap.has(sk.name)) pMap.set(sk.name, sk);
        });
        return enrichSkillPoolWithStones(Array.from(pMap.values()), { name: elfName, alienTraits: { gen2Trait: { name: gen2TraitName, description: "" } } });
      })(),
      calculatedStats: calculated,
      currentHp: calculated.hp,
      maxHp: calculated.hp,
      isCustom: true,
    };

  };

  // 匯出允許未完成草稿，正式儲存才檢查必填及性格。
  const handleSaveManual = () => {
    if (!elfName.trim()) {
      alert("請輸入精靈名稱！");
      return;
    }
    const natureCheck = validateSeerNature(natureModifiers);
    if (!natureCheck.valid) {
      alert(natureCheck.message);
      return;
    }
    const savedElf = buildManualElf();
    onSaveElf(savedElf);
    alert(`精靈「${savedElf.name}」已儲存至精靈倉庫！`);
    onBack();
  };

  // Handle AI preview save
  const handleSavePreview = () => {
    if (previewElf) {
      const mergedElf: Elf = {
        ...previewElf,
        destinyRank: destinyRank || undefined,
        height,
        weight,
        gender,
        specialModeRating,
        path: path || previewElf.path
      };
      onSaveElf(mergedElf);
      alert(`精靈「${previewElf.name}」已成功儲存至倉庫！`);
      onBack();
    }
  };

  // Update specific manual base stat (已解除單項上限限制)
  const handleStatChange = (stat: keyof BaseStats, value: number) => {
    const val = Math.max(1, value || 0);
    setBaseStats({ ...baseStats, [stat]: val });
  };

  // Update specific manual equipped skill
  const handleSkillChange = (index: number, field: keyof Skill, value: any) => {
    setSkills(prevSkills => {
      const updated = [...prevSkills];
      if (!updated[index]) return prevSkills;
      const oldName = updated[index].name;
      let newSkill = { ...updated[index], [field]: value };
      
      if (field === 'type' && value === '無屬性') {
        newSkill.category = '屬性';
        newSkill.power = 0;
      }
      if (field === 'category' && value === '屬性') {
        newSkill.type = '無屬性';
        newSkill.power = 0;
      }
      if (field === 'type' && value !== '無屬性' && newSkill.category === '屬性') {
        newSkill.category = '物理'; 
      }
      if (field === 'category' && value !== '屬性' && newSkill.type === '無屬性') {
        newSkill.type = '普通';
      }
      if (field === 'pp') {
        newSkill.maxPp = typeof value === 'number' && !isNaN(value) ? value : parseInt(value) || 0;
      }

      updated[index] = newSkill;

      // Keep skillPool in sync if the skill exists in pool
      setSkillPool(prevPool => {
        return prevPool.map(poolSk => {
          if (poolSk.name === oldName || poolSk.name === newSkill.name) {
            return { ...newSkill };
          }
          return poolSk;
        });
      });

      return updated;
    });
  };

  // Atomic update for AI semantic mapping on equipped skills
  const handleSkillAIMap = (idx: number, description: string, effectType?: string, effectDetail?: string, templateId?: string, templateArgs?: any[]) => {
    setSkills(prevSkills => {
      const updated = [...prevSkills];
      if (!updated[idx]) return prevSkills;
      const oldName = updated[idx].name;
      let newSkill = { ...updated[idx], description };
      if (effectType && effectType !== "none") newSkill.effectType = effectType;
      if (effectDetail) newSkill.effectDetail = effectDetail;
      if (templateId) newSkill.templateId = templateId;
      if (templateArgs) newSkill.templateArgs = templateArgs;
      updated[idx] = newSkill;

      setSkillPool(prevPool => {
        return prevPool.map(poolSk => {
          if (poolSk.name === oldName || poolSk.name === newSkill.name) {
            return { ...newSkill };
          }
          return poolSk;
        });
      });

      return updated;
    });
  };

  // Update specific reserve pool skill
  const handlePoolSkillChange = (poolIdx: number, field: keyof Skill, value: any) => {
    setSkillPool(prevPool => {
      const updated = [...prevPool];
      if (!updated[poolIdx]) return prevPool;
      const oldName = updated[poolIdx].name;
      let newSkill = { ...updated[poolIdx], [field]: value };

      if (field === 'type' && value === '無屬性') {
        newSkill.category = '屬性';
        newSkill.power = 0;
      }
      if (field === 'category' && value === '屬性') {
        newSkill.type = '無屬性';
        newSkill.power = 0;
      }
      if (field === 'type' && value !== '無屬性' && newSkill.category === '屬性') {
        newSkill.category = '物理'; 
      }
      if (field === 'category' && value !== '屬性' && newSkill.type === '無屬性') {
        newSkill.type = '普通';
      }
      if (field === 'pp') {
        newSkill.maxPp = typeof value === 'number' && !isNaN(value) ? value : parseInt(value) || 0;
      }

      updated[poolIdx] = newSkill;

      // Keep equipped skills in sync if equipped
      setSkills(prevSkills => {
        return prevSkills.map(eqSk => {
          if (eqSk.name === oldName || eqSk.name === newSkill.name) {
            return { ...newSkill };
          }
          return eqSk;
        });
      });

      return updated;
    });
  };

  // Atomic update for AI semantic mapping on pool skills
  const handlePoolSkillAIMap = (poolIdx: number, description: string, effectType?: string, effectDetail?: string, templateId?: string, templateArgs?: any[]) => {
    setSkillPool(prevPool => {
      const updated = [...prevPool];
      if (!updated[poolIdx]) return prevPool;
      const oldName = updated[poolIdx].name;
      let newSkill = { ...updated[poolIdx], description };
      if (effectType && effectType !== "none") newSkill.effectType = effectType;
      if (effectDetail) newSkill.effectDetail = effectDetail;
      if (templateId) newSkill.templateId = templateId;
      if (templateArgs) newSkill.templateArgs = templateArgs;
      updated[poolIdx] = newSkill;

      setSkills(prevSkills => {
        return prevSkills.map(eqSk => {
          if (eqSk.name === oldName || eqSk.name === newSkill.name) {
            return { ...newSkill };
          }
          return eqSk;
        });
      });

      return updated;
    });
  };

  // Add custom normal skill to reserve pool
  const handleAddPoolNormalSkill = () => {
    const newSkill: Skill = {
      name: `自製普通技 ${skillPool.length + 1}`,
      type: elfType || "普通",
      category: "物理",
      power: 100,
      pp: 10,
      description: "造成傷害時有10%機率傷害翻倍",
      priority: 0,
      effectType: "damage_multiplier",
      effectDetail: "double_on_status",
      isFifthSkill: false
    };
    setSkillPool(prev => [...prev, newSkill]);
    setShowSkillPool(true);
    alert("✨ 已成功將新普通技能加入【技能預備替換池】！您可以點擊上方出戰配置格的【🔄 從預備池替換】按鈕將其裝備上場！");
  };

  // Add custom fifth skill to reserve pool
  const handleAddPoolFifthSkill = () => {
    const fifthCount = skillPool.filter(s => s.isFifthSkill).length + 1;
    const newFifth: Skill = {
      name: `自製第五技 ${fifthCount}`,
      type: elfType || "普通",
      category: "特殊",
      power: 160,
      pp: 5,
      description: "必中；消除對手回合類效果，消除成功則對手麻痺；未擊敗對手則吸取對手最大體力 1/4",
      priority: 0,
      effectType: "stat_down",
      effectDetail: "clear_turn",
      isSureHit: true,
      isFifthSkill: true
    };
    setSkillPool(prev => [...prev, newFifth]);
    setShowSkillPool(true);
    alert("👑 已成功將新第五技能加入【技能預備替換池】！您可以點擊上方第五技能格的【🔄 從預備池替換】按鈕將其裝備上場！");
  };

  // Remove custom skill from reserve pool
  const handleRemovePoolSkill = (poolIdx: number) => {
    const targetSkill = skillPool[poolIdx];
    if (!targetSkill) return;
    const equippedIndex = skills.findIndex(s => s && s.name === targetSkill.name);
    if (equippedIndex !== -1) {
      alert(`⚠️ 招式【${targetSkill.name}】目前已裝備在第 ${equippedIndex + 1} 格出戰技能中！請先從上方出戰欄位替換為其他招式後，再進行刪除。`);
      return;
    }
    setSkillPool(prev => prev.filter((_, idx) => idx !== poolIdx));
    alert(`已將預備招式【${targetSkill.name}】從技能池刪除。`);
  };

  const handleEquipSkillStone = () => {
    
    // Check if current elf is stone thrower
    const currentElfForCheck: Elf = {
      id: "temp", name: elfName, type: elfType, level: 100, baseStats, calculatedStats: baseStats, currentHp: 100, maxHp: 100,
      soulMark: { name: soulMarkName, description: soulMarkDesc, effectType: soulMarkEffectType, effectValue: soulMarkValue },
      alienTraits: { gen2Trait: gen2TraitName ? { name: gen2TraitName, description: gen2TraitDesc } : undefined },
      skills: skills, skillPool
    };
    try {
      const newStone = createSkillStone(stoneAttr, stoneGrade, stoneCategory, stoneIsPerfect, stoneEffectId, isStoneThrower(currentElfForCheck) ? 'project' : 'standard');
      const equipped = equipSkillStone(currentElfForCheck, newStone, stoneTargetSlot);
      setSkills(equipped.skills);
      setSkillPool(equipped.skillPool);
    } catch (error) { alert((error as Error).message); return; }
    setIsSkillStoneModalOpen(false);
  };

  // Reusable Skill Card Renderer for both Equipped Skills and Pool Skills
  const renderSkillCard = (skill: Skill, idx: number, isPoolSkill: boolean) => {
    const isFifth = isPoolSkill
      ? (skill.isFifthSkill || skill.name.includes("第五") || skill.power >= 160)
      : (idx === 4 || skill.isFifthSkill);
    const equippedSlotIdx = isPoolSkill ? skills.findIndex(s => s && s.name === skill.name) : idx;
    const isEquippedInPool = isPoolSkill && equippedSlotIdx !== -1;
    const idPrefix = isPoolSkill ? `skill-pool-${idx}` : `skill-eq-${idx}`;
    const skillKey = `${isPoolSkill ? "pool" : "eq"}-${idx}`;
    const isExpanded = expandedSkillKey === skillKey;

    return (
      <div
        key={`${isPoolSkill ? "pool" : "eq"}-${idx}-${skill.name}`}
        className={`border rounded-xl p-4 space-y-4 transition-all ${
          isEquippedInPool
            ? "bg-slate-900/50 border-slate-800/80 opacity-80"
            : isFifth
            ? "bg-gradient-to-br from-amber-950/20 via-[#050608] to-[#050608] border-amber-500/40 shadow-sm shadow-amber-500/5"
            : "bg-[#050608] border-slate-800 hover:border-slate-700"
        }`}
      >
        <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-bold flex items-center gap-1 ${skill.isSkillStone ? "text-emerald-400" : isFifth ? "text-amber-400" : "text-blue-400"}`}>
              {skill.isSkillStone && <span title="技能石招式">💎</span>}
              {isFifth && !skill.isSkillStone && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              {isPoolSkill ? `預備招式 ${idx + 1}` : `技能 ${idx + 1}`}
              {skill.isSkillStone
                ? `【💎 ${skill.skillStoneGrade || 'S'}級技能石 — ${skill.isPerfectSkillStone ? '完美特效' : '普通'}】`
                : isFifth
                ? "【👑 第五技能 / 專屬大招】"
                : isPoolSkill
                ? "【普通預備招式】"
                : idx === 0
                ? "【核心大招】"
                : idx === 1
                ? "【先手/快招】"
                : idx === 2
                ? "【屬性強化】"
                : "【戰術/防禦】"}
            </span>
            {/* 預備特殊印記/標記動態顯示區 (資料驅動，有標記物件時自動映射渲染，無標記時不佔用空間與顯示) */}
            {skill.specialBadge && (
              <span className={`text-[10px] border font-bold px-2 py-0.5 rounded ${skill.specialBadge.bg || 'bg-purple-900/60'} ${skill.specialBadge.color || 'text-purple-300'} ${skill.specialBadge.border || 'border-purple-500/40'} ${skill.specialBadge.animate || ''}`}>
                ✨ {skill.specialBadge.text}
              </span>
            )}
            {skill.specialMarks?.map((mark, mIdx) => (
              <span
                key={mark.id || mIdx}
                className={`text-[10px] border font-bold px-2 py-0.5 rounded ${mark.bg || 'bg-cyan-900/60'} ${mark.color || 'text-cyan-300'} ${mark.border || 'border-cyan-500/40'} ${mark.animate || ''}`}
              >
                🏷️ {mark.text}
              </span>
            ))}
            {isPoolSkill && (
              isEquippedInPool ? (
                <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded">
                  ✅ 已出戰裝備: 第 {equippedSlotIdx + 1} 格
                </span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
                  📦 預備替換池 (可替換上場)
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPoolSkill ? (
              <button
                type="button"
                onClick={() => setReplacingSkillIdx(idx)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  isFifth
                    ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                    : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30"
                }`}
              >
                <Shuffle className="w-3 h-3" /> 🔄 從預備池替換
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleRemovePoolSkill(idx)}
                className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 cursor-pointer transition-all"
                title="從預備池刪除此招式"
              >
                <X className="w-3 h-3" /> 刪除
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">技能名稱</label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              value={skill.name}
              onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "name", e.target.value) : handleSkillChange(idx, "name", e.target.value)}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <DualTypeSelect
              id={`${idPrefix}-type`}
              value={skill.type}
              onChange={(val) => isPoolSkill ? handlePoolSkillChange(idx, "type", val) : handleSkillChange(idx, "type", val)}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-1.5 py-1.5 text-[10px] text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              label1="主"
              label2="副"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">技能類型</label>
            <select
              id={`${idPrefix}-cat`}
              value={skill.category}
              onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "category", e.target.value) : handleSkillChange(idx, "category", e.target.value)}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="物理">物理</option>
              <option value="特殊">特殊</option>
              <option value="屬性">屬性</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">威力 (Power)</label>
            <input
              id={`${idPrefix}-power`}
              type="number"
              value={skill.power}
              disabled={skill.category === "屬性"}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const num = isNaN(val) ? 0 : val;
                isPoolSkill ? handlePoolSkillChange(idx, "power", num) : handleSkillChange(idx, "power", num);
              }}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 font-mono disabled:opacity-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">PP點數</label>
            <input
              id={`${idPrefix}-pp`}
              type="number"
              value={skill.pp}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const num = isNaN(val) ? 0 : val;
                isPoolSkill ? handlePoolSkillChange(idx, "pp", num) : handleSkillChange(idx, "pp", num);
              }}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">先制等級 (Priority)</label>
            <input
              id={`${idPrefix}-priority`}
              type="number"
              value={skill.priority || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const num = isNaN(val) ? 0 : val;
                isPoolSkill ? handlePoolSkillChange(idx, "priority", num) : handleSkillChange(idx, "priority", num);
              }}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              title="大於0則為先手技能"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">特效分類</label>
            <select
              id={`${idPrefix}-effect-type`}
              value={skill.effectType || "none"}
              onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "effectType", e.target.value) : handleSkillChange(idx, "effectType", e.target.value)}
              className="w-full bg-[#0F1117] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="none">無特殊特效</option>
              <option value="stat_up">提升自身能力</option>
              <option value="stat_down">削弱對手能力/消強</option>
              <option value="heal">回復體力/恢復</option>
              <option value="status_inflict">使對手陷入異常</option>
              <option value="damage_multiplier">機率傷害翻倍</option>
              <option value="absorb">吸取HP</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <label className="block text-[10px] text-emerald-400 mb-1">公共模板引擎編號 (可選)</label>
            <input
              id={`${idPrefix}-templateId`}
              type="text"
              value={skill.templateId || ""}
              placeholder="例如: 0008, 0015"
              onChange={(e) => {
                isPoolSkill ? handlePoolSkillChange(idx, "templateId", e.target.value) : handleSkillChange(idx, "templateId", e.target.value);
              }}
              className="w-full bg-[#0F1117] border border-emerald-900 rounded px-2.5 py-1 text-xs text-emerald-200 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              title="輸入模板 ID，如果提供將在運行時自動套用公共模板引擎的邏輯"
            />
          </div>
          <div>
            <label className="block text-[10px] text-emerald-400 mb-1">模板參數 (JSON Array 格式)</label>
            <input
              id={`${idPrefix}-templateArgs`}
              type="text"
              value={skill.templateArgs ? JSON.stringify(skill.templateArgs) : ""}
              placeholder="例如: [3, 100]"
              onChange={(e) => {
                try {
                  const val = e.target.value;
                  if (!val) {
                    isPoolSkill ? handlePoolSkillChange(idx, "templateArgs", undefined) : handleSkillChange(idx, "templateArgs", undefined);
                    return;
                  }
                  const parsed = JSON.parse(val);
                  if (Array.isArray(parsed)) {
                    isPoolSkill ? handlePoolSkillChange(idx, "templateArgs", parsed) : handleSkillChange(idx, "templateArgs", parsed);
                  }
                } catch(err) {
                  // Ignore invalid JSON while typing
                }
              }}
              className="w-full bg-[#0F1117] border border-emerald-900 rounded px-2.5 py-1 text-xs text-emerald-200 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              title="輸入 JSON 陣列格式的參數，對應模板需要的參數，例如 [3, 100]"
            />
          </div>
        </div>

        <div className={`transition-all mt-3 rounded-xl ${isExpanded ? "bg-[#0c0f17] border-2 border-blue-500/80 p-3 shadow-xl shadow-blue-500/10 my-2" : ""}`}>
          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <label
                onClick={() => setExpandedSkillKey(isExpanded ? null : skillKey)}
                className="block text-[11px] font-bold text-slate-300 cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-1"
                title="點擊放大編輯框"
              >
                對戰描述說明與特效細節值
                <span className="text-[10px] text-blue-400 font-normal">
                  (點擊欄位自動放大)
                </span>
              </label>
              <button
                type="button"
                onClick={() => setExpandedSkillKey(isExpanded ? null : skillKey)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  isExpanded
                    ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                    : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30"
                }`}
                title={isExpanded ? "收合欄位" : "放大此編輯框"}
              >
                {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                {isExpanded ? "收合編輯框" : "🔍 放大編輯"}
              </button>
              <button
                type="button"
                onClick={() => setZoomedSkillModal({ idx, isPoolSkill })}
                className="px-2 py-0.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="開啟全螢幕獨立放大彈窗進行編輯"
              >
                <ZoomIn className="w-3 h-3 text-purple-400" />
                獨立大視窗
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                const res = await parseEffectDescriptionWithAI(skill.description || skill.name);
                if (isPoolSkill) {
                  handlePoolSkillAIMap(idx, res.structuredTemplate, res.recommendedEffectType, res.recommendedEffectDetail, res.recommendedTemplateId, res.recommendedTemplateArgs);
                } else {
                  handleSkillAIMap(idx, res.structuredTemplate, res.recommendedEffectType, res.recommendedEffectDetail, res.recommendedTemplateId, res.recommendedTemplateArgs);
                }
                if (res.templateSuggestions.length > 0) {
                  alert(`🤖【${skill.name}】結構化映射報告：\n\n${res.templateSuggestions.join("\n")}`);
                }
              }}
              disabled={!skill.description && !skill.name}
              className="px-2 py-0.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              AI 語意映射
            </button>
          </div>

          <textarea
            id={`${idPrefix}-desc`}
            rows={isExpanded ? 4 : 2}
            value={skill.description || ""}
            onFocus={() => setExpandedSkillKey(skillKey)}
            onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "description", e.target.value) : handleSkillChange(idx, "description", e.target.value)}
            className={`w-full rounded transition-all focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              isExpanded
                ? "bg-[#06080e] border border-blue-500/60 px-3 py-2 text-sm text-slate-100 font-medium leading-relaxed mb-2 shadow-inner"
                : "bg-[#0F1117] border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 mb-1 resize-none"
            }`}
            placeholder="點擊此處自動放大！說明文字，如：10%機率傷害翻倍；必中；消除對手回合類效果..."
          />
          {isExpanded && (
            <div className="bg-[#050608]/50 border border-slate-800/50 rounded-xl p-3 mb-2">
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <Eye className="w-3 h-3" />
                語法即時解析預覽
              </div>
              <SmartDescription text={skill.description} className="text-xs text-slate-300" />
            </div>
          )}
          {isExpanded && <LiveDeconstructPreview text={skill.description} title="技能觸發條件解析" />}

          <input
            id={`${idPrefix}-detail`}
            type="text"
            value={skill.effectDetail || ""}
            onFocus={() => setExpandedSkillKey(skillKey)}
            onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "effectDetail", e.target.value) : handleSkillChange(idx, "effectDetail", e.target.value)}
            className={`w-full rounded font-mono transition-all focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              isExpanded
                ? "bg-[#06080e] border border-cyan-500/60 px-3 py-2 text-xs text-cyan-300 font-bold shadow-inner"
                : "bg-[#0F1117] border border-slate-800 px-2.5 py-1 text-[10px] text-slate-400"
            }`}
            placeholder="代碼值，例如：'atk+2'、'heal:50'、'clear_turn'、'fear:30'"
          />

          {isExpanded && (
            <div className="mt-3">
              <KitEffectBuilder
                kit={skill.kit || []}
                onChange={(newKit) =>
                  isPoolSkill
                    ? handlePoolSkillChange(idx, "kit", newKit)
                    : handleSkillChange(idx, "kit", newKit)
                }
                source="skill"
                onInsertDescription={(text) => {
                  const oldDesc = skill.description || "";
                  const newDesc = oldDesc ? oldDesc + "\n" + text : text;
                  isPoolSkill
                    ? handlePoolSkillChange(idx, "description", newDesc)
                    : handleSkillChange(idx, "description", newDesc);
                }}
              />
            </div>
          )}

          {isExpanded && (
            <div className="mt-2 space-y-1 bg-slate-950/40 p-2 border border-slate-800 rounded-lg">
              <label className="text-[9px] font-mono font-bold text-cyan-400 block flex items-center gap-1">
                ⚡ [開發者特權] 技能真實對戰 JS 代碼 (戰鬥中直接動態執行，並支援即時執行日誌監視)：
              </label>
              <textarea
                rows={4}
                value={skill.customCode || ""}
                onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "customCode", e.target.value) : handleSkillChange(idx, "customCode", e.target.value)}
                className="w-full bg-[#050608] border border-slate-800 rounded p-1.5 text-[10px] text-green-400 font-mono focus:outline-none focus:border-cyan-500 leading-normal"
                placeholder="// 範例: 回復 300HP，且對手受到 200 點固定傷害&#10;context.addLog('✨ 使用了強大的自訂技能！');&#10;context.actor.currentHp = Math.min(context.actor.maxHp, context.actor.currentHp + 300);&#10;context.applyDamage(200, 'pink_damage');"
              />
            </div>
          )}

          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 pt-3 border-t border-slate-800 space-y-2"
            >
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="text-[11px] font-bold text-amber-400">
                  💡 點擊下方標籤快速附加特效代碼至特效細節欄位：
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedSkillKey(null)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  ✅ 完成並收合
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "攻擊+2", code: "atk+2" },
                  { label: "特攻+2", code: "spatk+2" },
                  { label: "速度+1", code: "spd+1" },
                  { label: "全屬性+1", code: "all+1" },
                  { label: "消除回合", code: "clear_turn" },
                  { label: "消除強化", code: "clear_stat" },
                  { label: "必中", code: "sure_hit" },
                  { label: "恢復50%HP", code: "heal:50" },
                  { label: "恢復100%HP", code: "heal:100" },
                  { label: "護盾200", code: "shield:200" },
                  { label: "護盾300", code: "shield:300" },
                  { label: "30%麻痺", code: "paralyze:30" },
                  { label: "40%害怕", code: "fear:40" },
                  { label: "50%燒傷", code: "burn:50" },
                  { label: "傷害翻倍", code: "double_dmg" },
                  { label: "吸取1/4", code: "absorb:25" },
                  { label: "免疫異常", code: "immune_status" },
                ].map((tag, tagIdx) => (
                  <button
                    key={tagIdx}
                    type="button"
                    onClick={() => {
                      const currentVal = skill.effectDetail || "";
                      const nextVal = currentVal ? `${currentVal},${tag.code}` : tag.code;
                      if (isPoolSkill) {
                        handlePoolSkillChange(idx, "effectDetail", nextVal);
                      } else {
                        handleSkillChange(idx, "effectDetail", nextVal);
                      }
                    }}
                    className="px-2 py-0.5 bg-slate-800/80 hover:bg-cyan-950/80 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50 rounded text-[10px] font-mono cursor-pointer transition-all"
                  >
                    {tag.label} <span className="text-cyan-400 font-normal">({tag.code})</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  const handleSelectDissectElf = (elfId: string) => {
    const selected = DEFAULT_ELVES.find(e => e.id === elfId);
    if (!selected) return;

    let text = "";
    if (selected.rawPrompt) {
      text = selected.rawPrompt;
    } else {
      text = `【精靈名稱】：${selected.name}\n`;
      text += `【精靈屬性】：${selected.type}系\n`;
      text += `【基礎種族值】：體力 ${selected.baseStats.hp} / 攻擊 ${selected.baseStats.atk} / 防禦 ${selected.baseStats.def} / 特攻 ${selected.baseStats.spatk} / 特防 ${selected.baseStats.spdef} / 速度 ${selected.baseStats.speed}\n\n`;
      
      if (selected.soulMark) {
        text += `【魂印 / 專屬特性】 - ${selected.soulMark.name}\n${selected.soulMark.description}\n\n`;
      }
      
      if (selected.skills && selected.skills.length > 0) {
        text += `【核心技能組】\n`;
        selected.skills.forEach(sk => {
          const typeStr = sk.type && sk.type !== '無屬性' ? `${sk.type}系` : '';
          const fifthStr = sk.isFifthSkill ? ' (第五技能)' : '';
          text += `[${sk.name}] ${typeStr} ${sk.category}技能${fifthStr}\n威力：${sk.power} | PP：${sk.pp}\n效果：${sk.description}\n\n`;
        });
      }
    }

    setPrompt(text.trim());
    setSelectedDissectElfId(elfId);
    if (selected.soulMark) {
      setTokenDissectText(selected.soulMark.description);
      setAiDissectedResult(null);
    }
  };

  const renderHighlightedText = (text: string, matches: any[]) => {
    if (!text) return <span className="text-slate-600">（目前無輸入內容，請在上方輸入故事描述或在下方載入經典精靈）</span>;
    if (matches.length === 0) return <span className="text-slate-300 leading-relaxed">{text}</span>;

    // Sort matched keywords by length descending so that longer keywords get matched first!
    const sortedKeywords = [...matches].map(m => m.keyword).sort((a, b) => b.length - a.length);
    
    // Construct a regex from keywords
    const escapedKeywords = sortedKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'g');
    
    const parts = text.split(regex);
    
    return (
      <div className="leading-relaxed font-sans text-xs text-slate-300 break-all select-text whitespace-pre-wrap">
        {parts.map((part, index) => {
          const matchInfo = matches.find(m => m.keyword === part);
          if (matchInfo) {
            const styleClass = getKeywordStyle(part);
            return (
              <span 
                key={index} 
                onClick={() => {
                  setSelectedKeywordInfo(matchInfo);
                  setActiveAnalysisTab("detect");
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer border font-bold hover:brightness-125 transition-all mx-0.5 animate-pulse inline-flex items-center gap-0.5 ${styleClass}`}
                title="點擊右側將自動定位並查看底層匹配模組、代碼與對接印記"
              >
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  const calculatedManualStats = useMemo(() => calculateElfStats(
    baseStats, 100, initialElf?.ivs, evs, natureModifiers, inscriptions as Inscription[],
    guildBonuses, initialElf?.hasAnnualBonus
  ), [baseStats, evs, natureModifiers, inscriptions, guildBonuses, initialElf?.ivs, initialElf?.hasAnnualBonus]);

  const manualDraft = { ...initialElf, id: initialElf?.id || "editor-draft", name: elfName, type: elfType,
    level: 100, path: path || undefined, baseStats, calculatedStats: calculatedManualStats,
    currentHp: calculatedManualStats.hp, maxHp: calculatedManualStats.hp, skills, skillPool,
    soulMark: { ...initialElf?.soulMark, name: soulMarkName, description: soulMarkDesc,
      effectType: soulMarkEffectType, effectValue: soulMarkValue },
  } as Elf;

  return (
    <div className="elf-editor-page w-full max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-8" id="elf-editor-container">
      {/* Back Header */}
      <div className="ios-panel p-5 flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            id="btn-editor-back"
            onClick={onBack}
            className="p-2.5 bg-[#0F1117] border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer flex items-center justify-center group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-4 bg-blue-500 rounded-sm"></span>
              精靈自定
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">AI 解析／手動表單／積木 三種方式編輯同一隻精靈</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BlueprintImportButton onImport={elf => {
            setInitialElf({ ...elf, id: suppliedElf?.id || manualDraftId });
            setPreviewElf(null); setError(null); setActiveTab('manual'); setManualSection('basic');
            setReplacingSkillIdx(null); setZoomedSkillModal(null); setZoomedTraitModal(null);
          }} />
          <button
            type="button"
            onClick={() => {
              const exportData = {
                schemaVersion: 2,
                activeTab,
                manualElf: buildManualElf(),
                aiPreview: previewElf,
                manualStats: {
                  elfName,
                  elfType,
                  isAlienElf,
                  baseStats,
                  natureModifiers,
                  evs,
                  guildBonuses,
                  soulMarkName,
                  soulMarkDesc,
                  skills,
                  inscriptions
                }
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `seer_elf_blueprint_${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              alert("已匯出完整精靈草稿 (JSON)。可用匯入圖紙還原；匯出不代表效果已實裝或通過驗證。");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F1117] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-all"
            title="匯出精靈圖紙設定檔 (JSON)"
          >
            <Share2 className="w-3.5 h-3.5" />
            匯出圖紙
          </button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="ios-segment flex mb-6" id="editor-tabs">
        <button
          id="tab-ai-select"
          data-active={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "ai"
              ? "bg-[#050608] text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI 精靈生成
        </button>
        <button
          id="tab-manual-select"
          data-active={activeTab === "manual"}
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "manual"
              ? "bg-[#050608] text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Edit className="w-3.5 h-3.5" />
          手動精確自訂
        </button>
        <button
          id="tab-blockly-select"
          data-active={activeTab === "blockly"}
          onClick={() => setActiveTab("blockly")}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "blockly"
              ? "bg-[#050608] text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="用積木組合魂印／技能效果（綁定目前編輯中的精靈）"
        >
          <Puzzle className="w-3.5 h-3.5" />
          積木
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "blockly" ? (
          <motion.div key="blockly-panel" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }} className="space-y-4">
            <ElfBlocklyPanel
              elfName={elfName}
              elf={buildManualElf()}
              soulKit={kit}
              onSoulKitChange={setKit}
              skills={skills}
              onSkillKitChange={(i, k) => handleSkillChange(i, "kit", k)}
              onInsertSoulDesc={(text) => setSoulMarkDesc((prev) => (prev ? prev + "\n" + text : text))}
              onInsertSkillDesc={(i, text) => handleSkillChange(i, "description", (skills[i]?.description ? skills[i].description + "\n" : "") + text)}
            />
            <div className="flex justify-end">
              <button type="button" onClick={handleSaveManual}
                className="py-3 px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center gap-2">
                <Save className="w-4 h-4" /> 儲存精靈
              </button>
            </div>
          </motion.div>
        ) : activeTab === "ai" ? (
          <motion.div
            key="ai-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
            id="ai-panel-grid"
          >
            <nav className="ios-segment w-full" aria-label="AI 編輯分類">{([['input', '輸入'], ['analysis', '解析'], ['preview', '預覽']] as const).map(([key, label]) => <button key={key} type="button" className="flex-1" data-active={rightColumnTab === key} disabled={key === 'preview' && !previewElf} onClick={() => setRightColumnTab(key)}>{label}</button>)}</nav>
            {/* Input Box Column */}
            {rightColumnTab === 'input' && <div className="space-y-4">
              <div className="bg-[#0F1117] border border-slate-800 rounded-2xl p-3 sm:p-6 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    AI 精靈設定解析
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsEffectModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                    效果引用與標準詞庫
                  </button>
                </div>
                {aiEnabled === false && (
                  <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200" title="在專案根目錄建立 .env，寫入 GEMINI_API_KEY=你的金鑰 後重新啟動">
                    AI 未啟用（未設定 GEMINI_API_KEY）。請用「全文本一鍵導入」本地解析。
                  </div>
                )}
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  貼上精靈設定文字（名稱、屬性、魂印、技能）。
                </p>

                <AnimatePresence>
                  {copiedEffect && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex items-start justify-between gap-3 text-xs overflow-hidden"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                          <span>偵測到自訂百科引用：【{copiedEffect.name}】</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-[280px] sm:max-w-[340px] truncate">
                          {copiedEffect.syntax}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const insertText = `\n[引用百科效果-${copiedEffect.name}]: ${copiedEffect.syntax}\n`;
                            setPrompt(prev => prev + insertText);
                            localStorage.removeItem('seer_selected_effect_for_ai');
                            setCopiedEffect(null);
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all text-[11px] cursor-pointer"
                        >
                          導入提示詞
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem('seer_selected_effect_for_ai');
                            setCopiedEffect(null);
                          }}
                          className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea
                  id="ai-prompt-input"
                  rows={9}
                  className="w-full bg-[#050608] border border-slate-800 focus:border-blue-500 rounded-xl p-4 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed custom-scrollbar font-sans"
                  placeholder="請在此輸入精靈的故事描述..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />

                {/* Preloader section */}
                <details className="mt-3 border-t border-slate-800/60 pt-3 space-y-2">
                    <summary className="text-xs font-bold text-slate-400 cursor-pointer">
                      📁 載入既有精靈進行字段解構與分析
                    </summary>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {DEFAULT_ELVES.map((elf, index) => (
                      <button
                        key={`${elf.id}-${index}`}
                        type="button"
                        onClick={() => handleSelectDissectElf(elf.id)}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer truncate ${
                          selectedDissectElfId === elf.id
                            ? "bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm"
                            : "bg-[#050608] hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 border-slate-800/80"
                        }`}
                        title={`載入並解構【${elf.name}】的技能與魂印`}
                      >
                        {elf.name}
                      </button>
                    ))}
                  </div>
                </details>

                {error && (
                  <div className="mt-4 p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-rose-300 leading-relaxed">{error}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <button
                    id="btn-ai-generate-submit"
                    disabled={isLoading || aiEnabled === false}
                    title={aiEnabled === false ? "未設定 GEMINI_API_KEY" : undefined}
                    onClick={handleAIGenerate}
                    className="flex-1 py-3.5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all transform hover:-translate-y-0.5 disabled:transform-none disabled:shadow-none disabled:bg-slate-800/40 disabled:text-slate-500 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>研發基地調配中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>AI 智能分析</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleLocalParse}
                    disabled={isLoading}
                    className="flex-1 py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all transform hover:-translate-y-0.5 disabled:transform-none disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    title="從文字區域直接擷取屬性與技能資料，不經過 AI 簡化處理"
                  >
                    <Copy className="w-4 h-4" />
                    <span>全文本一鍵導入 (保留原始文本)</span>
                  </button>
                </div>
              </div>

              {/* Tips for prompts */}
              <details className="bg-[#0F1117]/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <summary className="text-xs font-bold text-slate-300 cursor-pointer">💡 輸入文本技巧</summary>
                <p className="text-xs text-slate-500 leading-relaxed">
                  在文本中包含「名字是『XXX』」、「『XX』系精靈」、「專屬特性叫作『XXX』其效果為XX」、「主力技能是『XX』擁有威力150，PP 5」等關鍵詞，可使 AI 生成的數值和特殊效果更完美貼近你的預期！
                </p>
              </details>
            </div>}
            {/* Right Column: Dynamic View (Analysis or Preview) */}
            {rightColumnTab !== 'input' && <div className="space-y-4">
              {rightColumnTab === "analysis" ? (
                // --- Analysis & Pre-Processing View ---
                <div className="bg-[#0F1117] border border-slate-800 rounded-2xl shadow-xl p-3 sm:p-5">
                  <details className="ios-card p-3 mb-3"><summary className="text-sm text-amber-200 cursor-pointer">關鍵字標示／語法與模組對照</summary>
                    <div className="mt-3 max-h-[180px] overflow-y-auto whitespace-pre-wrap text-sm leading-7">{renderHighlightedText(prompt, analyzedKeywords)}</div>
                    <GrammarLegend currentText={prompt} />
                  </details>
                  <div className="flex items-center gap-2 mb-5">
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab("detect")}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${
                        activeAnalysisTab === "detect" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-transparent text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      即時文本偵測
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab("unimplemented")}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${
                        activeAnalysisTab === "unimplemented" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-transparent text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      效果草稿池 ({unimplementedEffects.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab("dissect")}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${
                        activeAnalysisTab === "dissect" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-transparent text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      AI 解構報告
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAnalysisTab("token_dissect")}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${
                        activeAnalysisTab === "token_dissect" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-transparent text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      🔮 語義分詞拆解
                    </button>
                  </div>

                  {activeAnalysisTab === "detect" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {!selectedKeywordInfo ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4 border border-dashed border-slate-800 rounded-xl bg-[#050608]">
                          <Search className="w-8 h-8 text-slate-700 mb-3" />
                          <p className="text-xs text-slate-400 font-bold mb-1">等待選擇偵測關鍵字</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">點擊左側文本區塊中高亮的關鍵字，即可在此查看該詞彙在底層對接的邏輯模組、相關代碼及系統處理建議。</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[14px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                              {selectedKeywordInfo.keyword}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 font-bold">
                              類型：{selectedKeywordInfo.type || selectedKeywordInfo.tag}
                            </span>
                          </div>
                          
                          <div className="bg-[#050608] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                            <h5 className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                              底層對接模組
                            </h5>
                            <div className="text-xs text-blue-300 font-mono bg-blue-950/20 px-2.5 py-1.5 rounded border border-blue-900/30">
                              {selectedKeywordInfo.mappedModule || selectedKeywordInfo.moduleName}
                            </div>
                          </div>

                          <div className="bg-[#050608] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                            <h5 className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              規範化模板與印記參考
                            </h5>
                            <div className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800">
                              {selectedKeywordInfo.effectReference}
                            </div>
                          </div>

                          <div className="bg-[#050608] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                            <h5 className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              AI 處理建議
                            </h5>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {selectedKeywordInfo.aiSuggestion || selectedKeywordInfo.suggestion}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAnalysisTab === "unimplemented" && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {unimplementedEffects.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-64 text-center px-4 border border-dashed border-slate-800 rounded-xl bg-[#050608]">
                             <BookOpen className="w-8 h-8 text-slate-700 mb-3" />
                             <p className="text-[11px] text-slate-400 font-bold mb-1">暫存庫目前為空</p>
                             <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">當系統發現無法完全匹配或解析的效果時，將會暫存在此處供開發者後續實作對接。</p>
                           </div>
                        ) : (
                          <div className="space-y-3">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                                  累積待處理草稿：{unimplementedEffects.length} 筆
                                </span>
                                <button
                                   type="button"
                                   onClick={() => setUnimplementedEffects([])}
                                   className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-2 py-1 rounded hover:bg-rose-950/30 transition-colors"
                                >
                                  清空草稿
                                </button>
                             </div>
                             <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                                {unimplementedEffects.map((eff) => (
                                   <div key={eff.id} className="bg-[#050608] border border-slate-800/80 rounded-xl p-3 relative group hover:border-blue-900/50 transition-colors">
                                      <div className="flex justify-between items-start mb-1.5">
                                         <h5 className="text-[11px] font-bold text-blue-300">{eff.name}</h5>
                                         <button 
                                            onClick={() => setUnimplementedEffects(prev => prev.filter(e => e.id !== eff.id))}
                                            className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="移除此草稿"
                                         >
                                            <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                      </div>
                                      <p className="text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed mb-2">{eff.description}</p>
                                      
                                      <div className="flex flex-col gap-1.5">
                                        {eff.notes && (
                                          <div className="text-[9px] text-amber-500/90 italic bg-amber-950/20 px-2 py-1 rounded border border-amber-900/30">
                                            📝 AI 備註：{eff.notes}
                                          </div>
                                        )}
                                        {eff.source && (
                                          <div className="text-[9px] bg-slate-800/80 text-slate-400 px-2 py-1 rounded w-fit border border-slate-700">
                                            📌 來源：{eff.source}
                                          </div>
                                        )}
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                        )}
                     </div>
                  )}

                  {activeAnalysisTab === "dissect" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {!decompositionReport ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4 border border-dashed border-slate-800 rounded-xl bg-[#050608]">
                          <Sparkles className="w-8 h-8 text-slate-700 mb-3" />
                          <p className="text-[11px] text-slate-400 font-bold mb-1">無解構報告</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">請先在左側載入既有精靈進行分析，或生成新精靈後在此處查看 AI 分析解構的完整報告。</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                           <div className="bg-gradient-to-r from-violet-900/20 via-blue-900/20 to-cyan-900/20 border border-violet-500/30 rounded-xl p-4 shadow-sm">
                             <div className="flex items-center justify-between border-b border-violet-500/20 pb-3 mb-3">
                               <h4 className="text-[11px] font-bold text-violet-300 flex items-center gap-1.5">
                                 <Sparkles className="w-4 h-4 text-violet-400" />
                                 AI 效果解構與庫存引用報告
                               </h4>
                               <span className="text-[9px] bg-violet-500/20 text-violet-300 px-2.5 py-1 rounded-full font-mono font-bold border border-violet-500/30">
                                 規範化實裝
                               </span>
                             </div>

                             {decompositionReport.decomposedTags && (
                               <div className="flex flex-wrap items-center gap-1.5 mb-4">
                                 <span className="text-[10px] text-slate-400 font-bold mr-1">解構標籤：</span>
                                 {decompositionReport.decomposedTags.map((tag, i) => (
                                   <span key={i} className="text-[9px] bg-[#050608] text-cyan-400 px-2 py-1 rounded border border-cyan-900/50 font-bold shadow-sm">
                                     #{tag}
                                   </span>
                                 ))}
                               </div>
                             )}

                             {decompositionReport.referencedEffects && decompositionReport.referencedEffects.length > 0 && (
                               <div className="space-y-2 mb-4">
                                 <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                   <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                                   引用已入庫系統效果：
                                 </span>
                                 {decompositionReport.referencedEffects.map((ref, i) => (
                                   <div key={i} className="bg-[#050608]/80 border border-amber-900/30 rounded-lg p-2.5">
                                     <div className="flex justify-between items-center font-bold text-amber-300 mb-1">
                                       <span className="text-[10px]">【{ref.name}】</span>
                                       <span className="text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">{ref.source}</span>
                                     </div>
                                     <p className="text-[10px] text-slate-300 font-mono leading-relaxed bg-black/30 p-2 rounded">{ref.syntax}</p>
                                   </div>
                                 ))}
                               </div>
                             )}

                             {decompositionReport.newCatalogedEffects && decompositionReport.newCatalogedEffects.length > 0 && (
                               <div className="space-y-2 mb-4">
                                 <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                   <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                   新入庫規範化模板效果：
                                 </span>
                                 {decompositionReport.newCatalogedEffects.map((cat, i) => (
                                   <div key={i} className="bg-[#050608]/80 border border-emerald-900/30 rounded-lg p-2.5">
                                     <div className="flex justify-between items-center font-bold text-emerald-300 mb-1">
                                       <span className="text-[10px]">【{cat.name}】</span>
                                       <span className="text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">{cat.reason}</span>
                                     </div>
                                     <p className="text-[10px] text-slate-300 font-mono leading-relaxed bg-black/30 p-2 rounded">{cat.syntax}</p>
                                   </div>
                                 ))}
                               </div>
                             )}

                             {decompositionReport.templateSummary && (
                               <div className="mt-4 pt-3 border-t border-violet-500/20">
                                 <p className="text-[10px] text-slate-300 bg-black/40 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed font-sans flex items-start gap-2">
                                   <span className="text-[11px]">💡</span>
                                   <span><strong className="text-violet-300 font-bold">規範化摘要：</strong>{decompositionReport.templateSummary}</span>
                                 </p>
                               </div>
                             )}
                           </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAnalysisTab === "token_dissect" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-[#050608] border border-emerald-500/20 rounded-xl p-4 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            協定分詞即時解構控台
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "scarlet") {
                                  setTokenDissectText("所有能力值/己方/在場精靈/每次/受到/麻痺/時/將/當前/所處/異常狀態/轉化/為/星贖/且/當回合/直到/戰鬥階段/結束前/回合類效果/無法/被/消除/在場期間/每次/出手流程/結束/後(含/選擇/技能/因故/未能/出手/)進行/一/次/額外行動/造成/對方/等同於/最大體力/⅓/的/光系傷害/且/100%/令/對手/失明//未觸發/失明/或/對手/已處於/失明/則/消除/對手/回合類效果/且/令//下/2次/造成/的/攻擊傷害/提升/150%/；己方/死亡/4/回合/後/在/背包/內/重生/，己方/每/有/1層/燦界/聖芒/則/重生/所需/回合/降低/1回合/");
                                  setAiDissectedResult(null);
                                } else if (val) {
                                  const found = DEFAULT_ELVES.find(elf => elf.id === val || elf.name === val);
                                  if (found && found.soulMark) {
                                    setTokenDissectText(found.soulMark.description);
                                    setAiDissectedResult(null);
                                  }
                                }
                              }}
                              className="text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                              <option value="">🔮 快速載入系統既有精靈...</option>
                              <option value="scarlet">斯嘉麗 (經典斜線分詞範例)</option>
                              {DEFAULT_ELVES.filter(e => e.soulMark?.description).map((elf, index) => (
                                <option key={`${elf.id}-${index}`} value={elf.id}>{elf.name} ({elf.soulMark?.name || "無魂印名"})</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setTokenDissectText(soulMarkDesc);
                                setAiDissectedResult(null);
                              }}
                              className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-all cursor-pointer"
                            >
                              帶入當前編輯精靈
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={4}
                          value={tokenDissectText || soulMarkDesc}
                          onChange={(e) => {
                            setTokenDissectText(e.target.value);
                            // 重設 AI 結果以觸發重新載入提示
                            setAiDissectedResult(null);
                          }}
                          className="w-full bg-black/60 border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                          placeholder="在此輸入斜線分割或普通描述文字，系統會即時分詞..."
                        />

                        {/* 螢光筆分詞即時對齊預覽 */}
                        <div className="space-y-1.5 bg-[#050608]/50 border border-slate-900 rounded-xl p-3">
                          <span className="text-[10px] font-bold text-slate-400 block flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            🔮 螢光筆分詞即時重點標示 (Interactive Token Highlighter View)：
                          </span>
                          <div className="flex flex-wrap gap-1 leading-relaxed break-all select-text whitespace-pre-wrap max-h-[120px] overflow-y-auto p-1 text-slate-300">
                            {(aiDissectedResult ? aiDissectedResult.tokens : parseRawAbilityEffect(tokenDissectText || soulMarkDesc || "").tokens).map((token: any, idx: number, arr: any[]) => {
                              let badgeStyle = "text-slate-400 bg-slate-900 border-slate-800";
                              if (token.type === "status") badgeStyle = "text-pink-300 bg-pink-500/15 border-pink-500/30 shadow-[0_0_8px_rgba(236,72,153,0.15)]";
                              if (token.type === "timing") badgeStyle = "text-amber-300 bg-amber-500/15 border-amber-500/30";
                              if (token.type === "condition") badgeStyle = "text-blue-300 bg-blue-500/15 border-blue-500/30";
                              if (token.type === "connective") badgeStyle = "text-purple-300 bg-purple-500/15 border-purple-500/30";
                              if (token.type === "effect") badgeStyle = "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
                              if (token.type === "other") badgeStyle = "text-rose-300 bg-rose-500/15 border-rose-500/30";

                              return (
                                <span key={idx} className="inline-flex items-center">
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold transition-all hover:brightness-125 hover:scale-[1.02] cursor-help ${badgeStyle}`}
                                    title={`類型: ${token.type}`}
                                  >
                                    {token.text}
                                  </span>
                                  {idx < arr.length - 1 && (
                                    <span className="text-slate-700 font-bold mx-0.5 select-none">/</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={isDissectingWithAI || aiEnabled === false}
                            title={aiEnabled === false ? "未設定 GEMINI_API_KEY" : undefined}
                            onClick={() => handleAIDissectTokens(tokenDissectText || soulMarkDesc || "")}
                            className={`w-full sm:w-auto text-[10px] font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isDissectingWithAI 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed" 
                                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/10 font-bold"
                            }`}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isDissectingWithAI ? "animate-spin" : ""}`} />
                            {isDissectingWithAI ? "AI 分詞中…" : "AI 分詞"}
                          </button>

                          {aiDissectedResult ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] px-2.5 py-2 rounded-lg flex items-center gap-1.5 font-bold ">
                              <span>已套用 AI 分詞結果（僅供閱讀，不影響戰鬥）</span>
                            </div>
                          ) : (
                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px] px-2.5 py-2 rounded-lg flex items-center gap-1.5 font-mono">
                              <span>目前為本地分詞（僅供閱讀，不影響戰鬥）</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Token 流與詞組對應 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400">🔍 語法分詞偵測流 (Token Lexical Flow)：</span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            共 {aiDissectedResult ? aiDissectedResult.tokens.length : parseRawAbilityEffect(tokenDissectText || soulMarkDesc || "").tokens.length} 個 Tokens
                          </span>
                        </div>
                        <div className="bg-[#050608]/60 border border-slate-800 rounded-xl p-3 flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                          {(aiDissectedResult ? aiDissectedResult.tokens : parseRawAbilityEffect(tokenDissectText || soulMarkDesc || "").tokens).map((token: any, idx: number) => {
                            let badgeStyle = "text-slate-400 bg-slate-900 border-slate-800";
                            if (token.type === "status") badgeStyle = "text-pink-300 bg-pink-500/10 border-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.1)]";
                            if (token.type === "timing") badgeStyle = "text-amber-300 bg-amber-500/10 border-amber-500/20";
                            if (token.type === "condition") badgeStyle = "text-blue-300 bg-blue-500/10 border-blue-500/20";
                            if (token.type === "connective") badgeStyle = "text-purple-300 bg-purple-500/10 border-purple-500/20";
                            if (token.type === "effect") badgeStyle = "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
                            if (token.type === "other") badgeStyle = "text-rose-300 bg-rose-500/10 border-rose-500/20";

                            return (
                              <span
                                key={idx}
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${badgeStyle}`}
                                title={`類型: ${token.type}`}
                              >
                                {token.text}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* 語義協定對齊 - 被動特性 */}
                      <div className="space-y-2.5">
                        <span className="text-[10px] font-bold text-slate-400 block">📋 語義對齊註冊表結果 (Semantic Clauses Matching)：</span>
                        {(aiDissectedResult ? aiDissectedResult.clauses : parseRawAbilityEffect(tokenDissectText || soulMarkDesc || "").clauses).map((clause: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300"
                          >
                            <div className="absolute right-2 top-2 text-[8px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/10 uppercase tracking-wider">
                              Clause {idx + 1}
                            </div>
                            <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                              {clause.title}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] pt-1">
                              {clause.trigger && (
                                <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded">
                                  <span className="text-amber-400 font-bold block mb-0.5">觸發 (Trigger):</span>
                                  <span className="text-slate-300 font-mono bg-amber-500/5 px-1 rounded border border-amber-500/10">{clause.trigger}</span>
                                </div>
                              )}
                              {clause.condition && (
                                <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded">
                                  <span className="text-blue-400 font-bold block mb-0.5">條件 (Condition):</span>
                                  <span className="text-slate-300 font-mono bg-blue-500/5 px-1 rounded border border-blue-500/10">{clause.condition}</span>
                                </div>
                              )}
                              {clause.target && (
                                <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded col-span-1 md:col-span-2">
                                  <span className="text-rose-400 font-bold block mb-0.5">目標 (Target):</span>
                                  <span className="text-slate-300 font-mono bg-rose-500/5 px-1 rounded border border-rose-500/10">{clause.target}</span>
                                </div>
                              )}
                              {clause.modifier && (
                                <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded col-span-1 md:col-span-2">
                                  <span className="text-cyan-400 font-bold block mb-0.5">動態縮減 (Modifier):</span>
                                  <span className="text-slate-300 font-mono bg-cyan-500/5 px-1 rounded border border-cyan-500/10">{clause.modifier}</span>
                                </div>
                              )}
                            </div>
                            {clause.actions && clause.actions.length > 0 && (
                              <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded">
                                <span className="text-emerald-400 font-bold block mb-1">行為 (Actions):</span>
                                <ul className="list-disc pl-4 space-y-1 text-slate-300 font-mono text-[9px]">
                                  {clause.actions.map((act: string, i: number) => (
                                    <li key={i} className="hover:text-white transition-all">{act}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {clause.branch && (
                              <div className="border-t border-slate-800/80 mt-2 pt-2 space-y-2">
                                <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded">
                                  <span className="text-purple-400 font-bold block mb-0.5">分支條件 (Branch):</span>
                                  <span className="text-slate-300 font-mono bg-purple-500/5 px-1 rounded border border-purple-500/10">{clause.branch}</span>
                                </div>
                                {clause.branchActions && clause.branchActions.length > 0 && (
                                  <div className="bg-[#050608]/40 border border-slate-900 p-2 rounded">
                                    <span className="text-emerald-400 font-bold block mb-1">分支行為 (Branch Actions):</span>
                                    <ul className="list-disc pl-4 space-y-1 text-slate-300 font-mono text-[9px]">
                                      {clause.branchActions.map((act: string, i: number) => (
                                        <li key={i} className="hover:text-white transition-all">{act}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 模組化積木被動/魂印效果 */}
                      <div className="mb-4">
                        <KitEffectBuilder
                          kit={kit}
                          onChange={setKit}
                          source="soulmark"
                          onInsertDescription={(text) => setSoulMarkDesc((prev) => (prev ? prev + "\n" + text : text))}
                        />
                      </div>

                      {/* 魂印真實戰鬥 JS 代碼 */}
                      <div className="space-y-1.5 bg-slate-950/40 p-3.5 border border-slate-800 rounded-xl">
                        <label className="text-[10px] font-mono font-bold text-emerald-400 block flex items-center gap-1">
                          ⚡ [開發者特權] 魂印真實對戰 JS 代碼 (戰鬥多時點動態執行)：
                        </label>
                        <textarea
                          rows={4}
                          value={soulMarkCustomCode}
                          onChange={(e) => setSoulMarkCustomCode(e.target.value)}
                          className="w-full bg-[#050608] border border-slate-800 rounded-lg p-2 text-[10px] text-green-400 font-mono focus:outline-none focus:border-emerald-500 leading-normal"
                          placeholder="// context為戰鬥上下文，timing為時點 ('ON_TURN_START', 'BEFORE_SKILL', 'AFTER_SKILL', 'ON_TURN_END')&#10;if (timing === 'ON_TURN_START') {&#10;  context.addLog('🔥 魂印：回合開始，攻擊+1！');&#10;  context.actor.statStages.atk = Math.min(6, context.actor.statStages.atk + 1);&#10;}"
                        />
                        <div className="text-[9px] text-slate-500 leading-relaxed pl-1">
                          支援時點: <code className="text-amber-400 font-mono">ON_TURN_START</code> (回合開始), <code className="text-amber-400 font-mono">BEFORE_SKILL</code> (出招前), <code className="text-amber-400 font-mono">AFTER_SKILL</code> (出招後), <code className="text-amber-400 font-mono">ON_TURN_END</code> (回合結束)。
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // --- Preview View ---
                <div className="min-h-[500px]">
                  <AnimatePresence mode="wait">
                    {previewElf ? (
                      <motion.div
                    key="preview-success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0F1117] border border-slate-800 rounded-2xl shadow-xl relative overflow-hidden"
                    id="ai-preview-card"
                  >
                    {/* Premium Thin Border Indicator */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500"></div>

                    <div className="p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                              AI 研發研製成功
                            </span>
                            <span className="text-xs text-slate-500">等級 100</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-100">{previewElf.name}</h3>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-mono">
                            <span>📏 {height || previewElf.height || 0}cm</span>
                            <span>⚖️ {weight || previewElf.weight || 0}kg</span>
                            {(destinyRank || getElfDestinyRank(previewElf)) && (
                              <span className="text-cyan-400 font-bold">🎡 命運之輪 {destinyRank || getElfDestinyRank(previewElf)}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${getAttributeBadgeColor(previewElf.type)} inline-flex items-center gap-1`}><TypeIcon type={previewElf.type} size={14} showLabelWhenMissing={false} />
                          {previewElf.type}系精靈
                        </span>
                      </div>

                      {/* Calculated Stats Formula Block */}
                      <div className="bg-[#050608] border border-slate-800 rounded-xl p-4 mb-6">
                        <h4 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center justify-between">
                          <span>最終能力值 (Level 100 實戰算式)</span>
                          <span className="text-[9px] text-slate-500 lowercase">基於標準公式動態計算</span>
                        </h4>
                        <div className="grid grid-cols-3 gap-2.5">
                          {Object.entries(previewElf.calculatedStats).map(([key, val]) => (
                            <div key={key} className="bg-[#0F1117] border border-slate-800/80 p-2 rounded-lg text-center">
                              <span className="text-[10px] text-slate-500 block">
                                {key === "hp" ? "體力" :
                                 key === "atk" ? "攻擊" :
                                 key === "def" ? "防禦" :
                                 key === "spatk" ? "特攻" :
                                 key === "spdef" ? "特防" : "速度"}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-100">{val}</span>
                              <span className="text-[9px] text-slate-600 block mt-0.5 font-mono">
                                種族: {previewElf.baseStats[key as keyof BaseStats]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Soul Mark */}
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          <h4 className="text-[11px] font-bold text-blue-400">專屬被動特性：【{previewElf.soulMark.name}】</h4>
                        </div>
                        <div className="pl-3.5">
                          <SmartDescription text={previewElf.soulMark.description} className="text-[11px] text-slate-400" />
                        </div>
                      </div>

                      {/* Alien Traits */}
                      {previewElf.alienTraits && (
                        <div className="space-y-3 mb-6">
                          {previewElf.alienTraits.gen2Trait && (
                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                                <h4 className="text-[11px] font-bold text-amber-300">二代異能特質：【{previewElf.alienTraits.gen2Trait.name}】</h4>
                              </div>
                              <div className="pl-3.5">
                                <SmartDescription text={previewElf.alienTraits.gen2Trait.description} className="text-[11px] text-amber-100/80" />
                              </div>
                            </div>
                          )}
                          {previewElf.alienTraits.exclusiveTrait && (
                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                                <h4 className="text-[11px] font-bold text-red-300">專屬異能特質：【{previewElf.alienTraits.exclusiveTrait.name}】</h4>
                              </div>
                              <div className="pl-3.5">
                                <SmartDescription text={previewElf.alienTraits.exclusiveTrait.description} className="text-[11px] text-red-100/80" />
                              </div>
                            </div>
                          )}
                          {previewElf.alienTraits.generalTrait && (
                            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                                <h4 className="text-[11px] font-bold text-blue-300">通用特性：【{previewElf.alienTraits.generalTrait.name}】 ({previewElf.alienTraits.generalTrait.description})</h4>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Skills */}
                      <div className="space-y-3 mb-6">
                        <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                          <ListPlus className="w-3.5 h-3.5 text-blue-400" />
                          解析出的四大對戰技能
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {previewElf.skills.map((skill, index) => (
                            <div key={index} className="p-3 bg-[#050608] border border-slate-800 rounded-xl">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-slate-200 text-xs">{skill.name}</span>
                                <span className={`text-[9px] px-1.5 rounded ${getAttributeBadgeColor(skill.type)} inline-flex items-center gap-0.5`}><TypeIcon type={skill.type} size={11} showLabelWhenMissing={false} />
                                  {skill.type}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mb-1.5 font-mono">
                                <span>類型: <strong className="text-slate-300">{skill.category === '物理' ? '物理攻擊' : skill.category === '特殊' ? '特殊攻擊' : skill.category === '屬性' ? '屬性技能' : skill.category}</strong></span>
                                <span>命中: <strong className="text-slate-300">{skill.accuracy !== undefined ? `${skill.accuracy}%` : '100%'}</strong></span>
                                <span>威力: <strong className="text-slate-300">{skill.power}</strong></span>
                                <span>PP: <strong className="text-slate-300">{skill.pp}</strong></span>
                              </div>
                              <SmartDescription text={skill.description} className="text-[10px] text-slate-300" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-4 border-t border-slate-800 pt-4">
                        <button
                          id="btn-edit-ai-params"
                          onClick={() => setActiveTab("manual")}
                          className="flex-1 py-3 px-4 bg-[#050608] border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit className="w-4 h-4 text-blue-400" />
                          微調配置參數
                        </button>
                        <button
                          id="btn-save-ai-elf"
                          onClick={handleSavePreview}
                          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          儲存精靈卡牌
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="preview-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[450px] bg-[#0F1117] border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8 text-slate-500"
                  >
                    <Eye className="w-12 h-12 text-slate-700 mb-4 stroke-1" />
                    <h3 className="font-bold text-slate-400 text-sm mb-1">等待精靈分析中</h3>
                    <p className="text-xs text-slate-600 max-w-xs">
                      在左側輸入您自訂的小說精靈大綱，點擊送入對戰艙按鈕發送，Gemini AI 會在此渲染出完整的對戰卡牌！
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}
            </div>}
          </motion.div>
        ) : (
          <motion.div
            key="manual-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="editor-workspace"
            id="manual-panel-container"
          >
            <ElfEditorDraftSummary elf={manualDraft} />
            <div className="editor-form-panel ios-panel ios-dialog p-4 sm:p-6 min-w-0">
            <ElfEditorSectionNav active={manualSection} onChange={setManualSection} />
            <div id="manual-section-content" className="space-y-6 mt-6">
            {manualSection === "basic" && <>
            {/* Part 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">精靈名稱</label>
                <input
                  id="manual-elf-name"
                  type="text"
                  maxLength={15}
                  value={elfName}
                  onChange={(e) => setElfName(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="自訂精靈"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">圖片網址 / 圖標路徑</label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="https://... 或是本地路徑"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">精靈屬性與類型</label>
                <div className="space-y-2">
                  <DualTypeSelect id="manual-elf-type" value={elfType} onChange={setElfType} className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" label1="主屬性" label2="副屬性" />
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isAlienElf}
                      onChange={(e) => setIsAlienElf(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      標記為「異能精靈」
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">專屬特性與特質 (異能精靈限定)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#050608]/40 border border-slate-800/80 rounded-xl px-2 py-2 text-[10px] text-slate-400 font-bold">專屬特性: {soulMarkName || "無"}</div>
                  <div className="bg-[#050608]/40 border border-slate-800/80 rounded-xl px-2 py-2 text-[10px] text-slate-400 font-bold">二代: {gen2TraitName || "無特質存在"}</div>
                  <div className="bg-[#050608]/40 border border-slate-800/80 rounded-xl px-2 py-2 text-[10px] text-slate-400 font-bold col-span-2">專屬: {exTraitName || "無特質存在"}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">精靈備註描述 (字面描述調整)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEffectModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3 text-violet-400" />
                    引用效果庫
                  </button>
                  <button
                    id="btn-ai-analyze-manual"
                    disabled={isLoading}
                    onClick={async () => {
                      if (!elfDescription.trim()) {
                        alert("請先在描述框輸入一些文字描述，AI 才能根據描述修復配置！");
                        return;
                      }
                      setIsLoading(true);
                      try {
                        const res = await fetch("/api/analyze-elf", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ 
                            elf: { name: elfName, type: elfType, baseStats, soulMark: { name: soulMarkName, description: soulMarkDesc, effectType: soulMarkEffectType, effectValue: soulMarkValue }, skills }, 
                            description: elfDescription 
                          }),
                        });
                        const result = await res.json();
                        if (result.success) {
                          const generated = result.data;
                          
                          if (generated.skills) {
                            generated.skills = generated.skills.map((s: any) => {
                              if (s.category === '屬性') {
                                s.type = '無屬性';
                                s.power = 0;
                              }
                              return s;
                            });
                          }
                          
                          setElfName(generated.name);
                          setElfType(generated.type);
                          setBaseStats(generated.baseStats);
                          setSoulMarkName(generated.soulMark.name);
                          setSoulMarkDesc(generated.soulMark.description);
                          setSoulMarkEffectType(generated.soulMark.effectType);
                          setSoulMarkValue(generated.soulMark.effectValue || 0);
                          const genEqSkills = (generated.skills || []).slice(0, 5);
                          setSkills(genEqSkills);
                          const genPoolRaw = [...(generated.skillPool || []), ...(generated.skills || []), ...skillPool];
                          const genUniqueMap = new Map<string, Skill>();
                          genPoolRaw.forEach((sk: Skill) => {
                            if (sk && sk.name && !genUniqueMap.has(sk.name)) {
                              genUniqueMap.set(sk.name, sk);
                            }
                          });
                          setSkillPool(enrichSkillPoolWithStones(Array.from(genUniqueMap.values()), generated));
                          if (generated.decompositionReport) {
                            setDecompositionReport(generated.decompositionReport);
                          }
                          alert("AI 已產生配置草稿；效果是否正確生效仍需語意驗證。");
                        }
                      } catch (err) {
                        console.error(err);
                        alert("AI 分析失敗，請重試");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    {isLoading ? "解析中..." : "AI 智能解析修正 Bug"}
                  </button>
                </div>
              </div>
              <textarea
                id="manual-elf-description"
                rows={2}
                value={elfDescription}
                onChange={(e) => setElfDescription(e.target.value)}
                className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="在此輸入對精靈的額外備註或背景描述，點擊上方 AI 按鈕可自動同步配置..."
              />
              {decompositionReport && (
                <div className="mt-4 bg-gradient-to-r from-violet-900/20 via-blue-900/20 to-cyan-900/20 border border-violet-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-violet-500/20 pb-2">
                    <h4 className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      AI 效果解構與規範化報告（待驗證草稿）
                    </h4>
                    <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono font-bold">
                      描述模板參考
                    </span>
                  </div>
                  {decompositionReport.decomposedTags && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold mr-1">解構標籤：</span>
                      {decompositionReport.decomposedTags.map((tag, i) => (
                        <span key={i} className="text-[10px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-bold">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {decompositionReport.referencedEffects && decompositionReport.referencedEffects.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-amber-400 block">📚 引用已入庫系統效果：</span>
                      {decompositionReport.referencedEffects.map((ref, i) => (
                        <div key={i} className="bg-[#050608]/80 border border-amber-500/20 rounded-lg p-2.5 text-[10px]">
                          <div className="flex justify-between items-center font-bold text-amber-300 mb-0.5">
                            <span>【{ref.name}】</span>
                            <span className="text-[9px] text-slate-500">{ref.source}</span>
                          </div>
                          <p className="text-slate-300 font-mono leading-relaxed">{ref.syntax}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {decompositionReport.newCatalogedEffects && decompositionReport.newCatalogedEffects.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-emerald-400 block">🆕 新入庫規範化模板效果：</span>
                      {decompositionReport.newCatalogedEffects.map((cat, i) => (
                        <div key={i} className="bg-[#050608]/80 border border-emerald-500/20 rounded-lg p-2.5 text-[10px]">
                          <div className="flex justify-between items-center font-bold text-emerald-300 mb-0.5">
                            <span>【{cat.name}】</span>
                            <span className="text-[9px] text-slate-500">{cat.reason}</span>
                          </div>
                          <p className="text-slate-300 font-mono leading-relaxed">{cat.syntax}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {decompositionReport.templateSummary && (
                    <p className="text-[10px] text-slate-400 bg-black/40 p-2 rounded border border-slate-800 leading-relaxed font-sans italic">
                      💡 <strong className="text-slate-300">規範化摘要：</strong>{decompositionReport.templateSummary}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Part 1.5: Profile & Rating */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">身高 (cm)</label>
                <input
                  type="number"
                  min="0"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">體重 (kg)</label>
                <input
                  type="number"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">性別</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="無性別">無性別</option>
                  <option value="雄性">雄性</option>
                  <option value="雌性">雌性</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">特殊模式評級</label>
                <select
                  value={specialModeRating}
                  onChange={(e) => setSpecialModeRating(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="未評級">未評級</option>
                  <option value="SS">SS</option>
                  <option value="S">S</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">命運之輪評級</label>
                <select
                  value={destinyRank}
                  onChange={(e) => setDestinyRank(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">無</option>
                  <option value="S">S</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
            </div>

            {/* Part 2: Race Stats editing & new Learning Points / Nature Calibration Panel */}
            <div className="border-t border-slate-800 pt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm"></span>
                    1️⃣ 種族值設定（基礎屬性設定）
                  </h3>
                  <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono">
                    🔓 自訂精靈已解除總和與單項限制，可設定任意超模數值
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {(["hp", "atk", "def", "spatk", "spdef", "speed"] as (keyof BaseStats)[]).map((stat) => (
                    <div key={stat} className="bg-[#050608] border border-slate-800/80 rounded-xl p-3 text-center">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">
                        {stat === "hp" ? "體力" :
                         stat === "atk" ? "攻擊" :
                         stat === "def" ? "防禦" :
                         stat === "spatk" ? "特攻" :
                         stat === "spdef" ? "特防" : "速度"}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[10px] text-slate-500">種族:</span>
                        <input
                          id={`manual-stat-${stat}`}
                          type="number"
                          value={baseStats[stat]}
                          onChange={(e) => handleStatChange(stat, parseInt(e.target.value))}
                          className="w-16 bg-[#0F1117] border border-slate-800 rounded px-2 py-1 text-xs text-center font-mono text-slate-100 font-bold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            </>}
            {manualSection === "training" && <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-green-500 rounded-sm"></span>
                  戰隊加成設定 (個別精靈)
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {(['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const).map((stat) => (
                    <div key={`guild-${stat}`} className="bg-[#0b1414] border border-green-500/20 rounded-xl p-3 flex flex-col items-center">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                        {stat === 'hp' ? '體力' : stat === 'atk' ? '攻擊' : stat === 'def' ? '防禦' : stat === 'spatk' ? '特攻' : stat === 'spdef' ? '特防' : '速度'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={stat === 'hp' ? 30 : stat === 'speed' ? 10 : 15}
                        value={guildBonuses[stat]}
                        onChange={(e) => {
                          const maxVal = stat === 'hp' ? 30 : stat === 'speed' ? 10 : 15;
                          const val = Math.max(0, Math.min(maxVal, parseInt(e.target.value) || 0));
                          setGuildBonuses(prev => ({ ...prev, [stat]: val }));
                        }}
                        className="w-full bg-[#050608] border border-slate-800 rounded px-2 py-1 text-xs text-center font-mono text-green-400 font-bold focus:outline-none focus:border-green-500"
                      />
                      <span className="text-[9px] text-slate-600 mt-1">上限 +{stat === 'hp' ? 30 : stat === 'speed' ? 10 : 15}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
                  2️⃣ 學習力與性格配置（正統演算實裝）
                </h3>
                <EvNaturePanel
                  baseStats={baseStats}
                  ivs={initialElf?.ivs || { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 }}
                  evs={evs}
                  natureModifiers={natureModifiers}
                  inscriptions={inscriptions as Inscription[]}
                  guildBonuses={guildBonuses}
                  hasAnnualBonus={initialElf?.hasAnnualBonus}
                  onEvsChange={(newEvs) => setEvs(newEvs)}
                  onNatureChange={(newMods) => setNatureModifiers(newMods)}
                />
              </div>
            </div>}
            {manualSection === "resistance" && <>
                {/* Part 2.2: Resistance Configuration */}
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-emerald-500 rounded-sm"></span>
                    3️⃣ 抗性屬性配置（傷害抗性與異常抗性）
                  </h3>
                  <ResistancePanel
                    resistances={resistances}
                    onChange={(newRes) => setResistances(newRes)}
                  />
                </div>
            </>}

            {manualSection === "traits" && <>
            {/* Part 2.5: Passive Soul Mark */}
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-1.5">
                <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm"></span>
                專屬被動特性
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">專屬特性名稱</label>
                    <input
                      id="manual-soul-name"
                      type="text"
                      maxLength={10}
                      value={soulMarkName}
                      onChange={(e) => setSoulMarkName(e.target.value)}
                      className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">效果數值 (機率或百分比)</label>
                    <input
                      id="manual-soul-value"
                      type="number"
                      value={soulMarkValue}
                      onChange={(e) => setSoulMarkValue(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 focus:ring-1"
                      placeholder="e.g. 30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">專屬特性代表字 (顯示在對戰頭像旁)</label>
                    <input
                      id="manual-soul-badge"
                      type="text"
                      maxLength={1}
                      value={soulMarkBadgeChar}
                      onChange={(e) => setSoulMarkBadgeChar(e.target.value)}
                      className="w-full bg-[#050608] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 text-center font-bold focus:outline-none focus:border-blue-500 focus:ring-1"
                      placeholder="如: 濁"
                    />
                  </div>
                </div>

                <div className="md:col-span-8">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-400">詳細專屬特性文字說明 (繁體中文)</label>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsParsingEffect(true);
                        const res = await parseEffectDescriptionWithAI(soulMarkDesc);
                        setSoulMarkDesc(res.structuredTemplate);
                        if (res.recommendedEffectType !== "none") {
                          setSoulMarkEffectType(res.recommendedEffectType);
                        }
                        if (res.templateSuggestions.length > 0) {
                          alert(`🤖 AI 結構化映射報告：\n\n${res.templateSuggestions.join("\n")}`);
                        }
                        setIsParsingEffect(false);
                      }}
                      disabled={isParsingEffect || !soulMarkDesc.trim()}
                      className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      {isParsingEffect ? "AI 結構化分析中..." : "🧠 AI 語意映射與結構化規範"}
                    </button>
                  </div>
                  <textarea
                    id="manual-soul-desc"
                    rows={6}
                    value={soulMarkDesc}
                    onChange={(e) => setSoulMarkDesc(e.target.value)}
                    className="w-full bg-[#050608] border border-slate-800 rounded-xl p-4 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-2"
                    placeholder="在此寫下對應專屬特性的完整技能敘述..."
                  />
                  <div className="bg-[#050608]/50 border border-slate-800/50 rounded-xl p-3 mb-4">
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <Eye className="w-3 h-3" />
                      語法即時解析預覽
                    </div>
                    <SmartDescription text={soulMarkDesc} className="text-xs text-slate-300" />
                  </div>
                  <div className="mt-4">
                    <ClauseBreakdownCard
                      title={soulMarkName || "專屬特性"}
                      description={soulMarkDesc}
                      elfId="custom_edit"
                      elfName={elfName || "自訂精靈"}
                      badgeChar={soulMarkBadgeChar}
                    />
                  </div>
                  <GrammarLegend currentText={soulMarkDesc} />
                  <LiveDeconstructPreview text={soulMarkDesc} title="魂印觸發條件解析" />
                </div>
              </div>

              {/* Part 2.6: Alien Traits (Between Soul Mark and Inscriptions) */}
              <div className="mt-6 pt-6 border-t border-slate-800/80">
                <h3 className="text-sm font-bold text-amber-400 mb-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
                  異能精靈特質配置 (二代特質與專屬特質)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>二代異能特質</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setZoomedTraitModal('gen2')}
                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        title="開啟獨立放大彈窗編輯二代特質"
                      >
                        <ZoomIn className="w-3 h-3 text-amber-400" />
                        <span>放大編輯</span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">特質名稱 (如: 無我 / 戰士)</label>
                      <input
                        type="text"
                        value={gen2TraitName}
                        onChange={(e) => setGen2TraitName(e.target.value)}
                        className="w-full bg-[#050608] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        placeholder="無我 / 戰士"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">特質詳細效果描述</label>
                      <textarea
                        rows={3}
                        value={gen2TraitDesc}
                        onChange={(e) => setGen2TraitDesc(e.target.value)}
                        className="w-full bg-[#050608] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 mb-2"
                        placeholder="輸入二代特質詳細說明..."
                      />
                      <div className="bg-black/20 p-2 rounded-lg border border-slate-800/50">
                        <SmartDescription text={gen2TraitDesc} className="text-[10px] text-slate-400" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-300 font-bold text-xs uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        <span>專屬異能特質</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setZoomedTraitModal('ex')}
                        className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        title="開啟獨立放大彈窗編輯專屬特質"
                      >
                        <ZoomIn className="w-3 h-3 text-red-400" />
                        <span>放大編輯</span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">特質名稱 (如: 無序星魂使徒)</label>
                      <input
                        type="text"
                        value={exTraitName}
                        onChange={(e) => setExTraitName(e.target.value)}
                        className="w-full bg-[#050608] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                        placeholder="無序星魂使徒"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">特質詳細效果描述</label>
                      <textarea
                        rows={3}
                        value={exTraitDesc}
                        onChange={(e) => setExTraitDesc(e.target.value)}
                        className="w-full bg-[#050608] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-red-500 mb-2"
                        placeholder="輸入專屬異能特質詳細說明..."
                      />
                      <div className="bg-black/20 p-2 rounded-lg border border-slate-800/50">
                        <SmartDescription text={exTraitDesc} className="text-[10px] text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alien Trait Section (Alien Elves only) */}
            <ExclusiveTraitsEditor traits={exclusiveTraits} onChange={setExclusiveTraits} />
            {isAlienElf && (
              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-sm font-bold text-blue-400 flex items-center gap-1.5 mb-4">
                  <Sparkles className="w-4 h-4" />
                  一代通用特質設定 (Alien Trait - 異能精靈限定)
                </h3>
                <div className="bg-[#0b1414] border border-blue-500/20 rounded-2xl p-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 ml-1">特質選擇</label>
                      <select
                        value={alienTraitName}
                        onChange={(e) => setAlienTraitName(e.target.value)}
                        className="w-full bg-[#050608] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">無 (None)</option>
                        {Object.keys(ALIEN_TRAITS).map(trait => (
                          <option key={trait} value={trait}>{ALIEN_TRAITS[trait].name}</option>
                        ))}
                      </select>
                    </div>
                    {alienTraitName && ALIEN_TRAITS[alienTraitName] && (
                      <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/20">
                        <p className="text-xs text-blue-300 font-bold mb-1">【{ALIEN_TRAITS[alienTraitName].name}】</p>
                        <div className="mt-1">
                          <SmartDescription text={ALIEN_TRAITS[alienTraitName].description} className="text-[11px] text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Part 2.6.5: 通用特性 (General Traits) */}
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 mb-4">
                <span className="w-1.5 h-3.5 bg-blue-400 rounded-sm"></span>
                通用特性設定 (General Trait)
              </h3>
              <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 ml-1">特性選擇</label>
                    <select
                      value={generalTraitName}
                      onChange={(e) => setGeneralTraitName(e.target.value)}
                      className="w-full bg-[#050608] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">無 (None)</option>
                      {Object.keys(GENERAL_TRAITS).map(trait => (
                        <option key={trait} value={trait}>{trait} ({GENERAL_TRAITS[trait].description})</option>
                      ))}
                    </select>
                  </div>
                  {generalTraitName && GENERAL_TRAITS[generalTraitName] && (
                    <div className="bg-[#050608]/50 p-3 rounded-lg border border-slate-800/50">
                      <p className="text-xs text-blue-300 font-bold mb-1">【{generalTraitName}】</p>
                      <div className="mt-1">
                        <SmartDescription text={GENERAL_TRAITS[generalTraitName].description} className="text-[11px] text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Part 2.7: Inscription System (Engravings) */}
            </>}
            {manualSection === "training" && <div className="border-t border-slate-800 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
                  專屬六角形刻印孔配置（最多 3 孔，點擊嵌入與調校）
                </h3>
                <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  刻印數值將動態累加至精靈對戰最終能力
                </span>
              </div>
              
              <div className="bg-[#080B11] border border-slate-800/80 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-around gap-6 shadow-inner">
                {[0, 1, 2].map((slotIdx) => (
                  <InscriptionSlot
                    key={slotIdx}
                    index={slotIdx}
                    inscription={inscriptions[slotIdx]}
                    onClick={() => setEditingInscIndex(slotIdx)}
                    size="lg"
                  />
                ))}
              </div>
            </div>}

            {manualSection === "skills" && <>
            {/* Part 4: Dynamic Skills Editor (Strictly 5 equipped slots) */}
            <div className="border-t border-slate-800 pt-6 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm"></span>
                    入戰攜帶招式配置（嚴格規範 5 招出戰配置）
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    對戰規定可攜帶 4 個普通招式 + 1 個第五技能/專屬大招。點擊【🔄 從預備池替換】可將下方預備池技能換上場。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const avail = getPerfectEffectsForAttribute(stoneAttr);
                      if (avail.length > 0 && !stoneEffectId) {
                        setStoneEffectId(avail[0].id);
                      }
                      setIsSkillStoneModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/50 hover:to-teal-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                    title="為當前精靈配置並綁定強力技能石"
                  >
                    <span>💎 裝備 / 生成技能石</span>
                  </button>
                  <span className="text-[11px] bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                    ⚡ 當前已出戰配置: {skills.length} / 5 招
                  </span>
                  {skillPool && skillPool.length > 0 && (
                    <span className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                      👑 預備技能池: 共 {skillPool.length} 招
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {skills.map((skill, idx) => renderSkillCard(skill, idx, false))}
              </div>
            </div>

            {/* Part 5: Skill Pool & Custom Skill Development */}
            <div className="border-t border-slate-800 pt-6 mt-8 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    技能預備替換池與自製招式研發庫 (Skill Pool)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    在此自製新招式或第五技能！研發後的技能會放入預備替換池，可在上方出戰配置中替換上場。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setShowSkillPool(open => !open)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold">
                    {showSkillPool ? "收起預備技能" : `展開預備技能（${skillPool.length}）`}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPoolNormalSkill}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> ➕ 新增普通預備招式
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPoolFifthSkill}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" /> 👑 新增第五技能/專屬大招
                  </button>
                </div>
              </div>

              {!showSkillPool ? null : skillPool.length === 0 ? (
                <div className="text-center py-10 bg-[#050608] border border-slate-800/80 rounded-xl text-slate-500 text-xs">
                  目前預備替換池中無技能。點擊上方按鈕立即研發自製招式！
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {skillPool.map((skill, idx) => renderSkillCard(skill, idx, true))}
                </div>
              )}
            </div>

            </>}
            </div>
              {/* Editor Skill Replacement Modal */}
              <AnimatePresence>
                {replacingSkillIdx !== null && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="w-full max-w-xl bg-[#0F1117] border border-slate-700 rounded-2xl p-5 max-h-[85vh] flex flex-col shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          {isFifthSlot ? (
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                              <Crown className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                              <Shuffle className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <h3 className={`text-sm font-bold ${isFifthSlot ? "text-amber-300" : "text-blue-400"}`}>
                              {isFifthSlot ? "👑 第五技能獨一無二專屬替換池" : "⚡ 普通技能替換池"}
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              正在為第 {replacingSkillIdx + 1} 格【{skills[replacingSkillIdx]?.name}】挑選新技能
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplacingSkillIdx(null)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl mb-3 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
                        <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isFifthSlot ? "text-amber-400" : "text-blue-400"}`} />
                        <div>
                          {isFifthSlot ? (
                            <span>
                              <strong className="text-amber-300">第五技能專屬規則：</strong>第五技能只能由另一個第五技能替換，完全無法與普通技能混用或佔用普通技能欄位！
                            </span>
                          ) : (
                            <span>
                              <strong className="text-blue-400">普通技能替換庫：</strong>在此選擇普通招式來替換當前技能（第五技能獨立存放，不在普通池顯示）。
                            </span>
                          )
                          }
                        </div>
                      </div>

                      <div className="overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
                        {availablePool.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 text-xs">
                            當前技能庫中沒有可選的{isFifthSlot ? "其他第五技能" : "普通技能"}。
                          </div>
                        ) : (
                          availablePool.map((sk, skIdx) => {
                            const equippedIdx = skills.findIndex((s, idx) => s && s.name === sk.name && idx !== replacingSkillIdx);
                            const isEquipped = equippedIdx !== -1;
                            const isCurrent = skills[replacingSkillIdx]?.name === sk.name;

                            return (
                              <div
                                key={skIdx}
                                onClick={() => {
                                  const nextSkills = [...skills];
                                  if (isEquipped && equippedIdx !== -1) {
                                    const currentSkill = nextSkills[replacingSkillIdx];
                                    nextSkills[equippedIdx] = { ...currentSkill };
                                    nextSkills[replacingSkillIdx] = { ...sk };
                                  } else {
                                    nextSkills[replacingSkillIdx] = { ...sk };
                                  }
                                  setSkills(nextSkills);
                                  setReplacingSkillIdx(null);
                                }}
                                className={`p-3 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                                  isCurrent
                                    ? "bg-blue-950/40 border-blue-500/50"
                                    : isEquipped
                                    ? "bg-purple-950/30 border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/30"
                                    : isFifthSlot
                                    ? "bg-slate-950 border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20"
                                    : "bg-slate-950 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`font-bold text-xs flex items-center gap-1.5 ${isFifthSlot ? "text-amber-300" : isEquipped ? "text-purple-300" : "text-blue-400"}`}>
                                    {sk.type && <TypeIcon type={sk.type} size={14} showLabelWhenMissing={false} />}
                                    {sk.name}
                                    {isCurrent && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">當前裝備</span>}
                                    {isEquipped && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Shuffle className="w-2.5 h-2.5" />點擊與第 {equippedIdx + 1} 格互換</span>}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-slate-400">
                                    <span>類型: <strong className="text-slate-300">{sk.category === '物理' ? '物理攻擊' : sk.category === '特殊' ? '特殊攻擊' : sk.category === '屬性' ? '屬性技能' : sk.category}</strong></span>
                                    <span>命中: <strong className="text-slate-300">{sk.accuracy !== undefined ? `${sk.accuracy}%` : '100%'}</strong></span>
                                    <span>威力: <strong className="text-slate-300">{sk.power}</strong></span>
                                    <span>PP: <strong className="text-slate-300">{sk.pp}</strong></span>
                                  </div>
                                </div>
                                <div className="mt-1">
                                  <SmartDescription text={sk.description} className="text-[11px] text-slate-300" />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            {/* Save Manual */}
            <div className="editor-save-bar flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-slate-400">所有分類共用一份草稿，儲存時一併保存。</p>
              <button
                id="btn-save-manual-elf"
                onClick={handleSaveManual}
                className="py-3.5 px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{initialElf ? "儲存精靈修改" : "儲存自訂精靈卡牌"}</span>
              </button>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editingInscIndex !== null && (
        <InscriptionModal
          slotIndex={editingInscIndex}
          inscription={inscriptions[editingInscIndex]}
          onSave={(updated) => {
            const nextInsc = [...inscriptions];
            nextInsc[editingInscIndex] = updated;
            setInscriptions(nextInsc);
          }}
          onClose={() => setEditingInscIndex(null)}
        />
      )}

      {zoomedSkillModal !== null && (() => {
        const { idx, isPoolSkill } = zoomedSkillModal;
        const targetSkill = isPoolSkill ? skillPool[idx] : skills[idx];
        if (!targetSkill) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0b0e17] border-2 border-blue-500/80 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl shadow-blue-500/20 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ZoomIn className="w-5 h-5 text-blue-400" />
                    【{targetSkill.name || "未命名招式"}】— 對戰描述與特效細節 放大編輯視窗
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isPoolSkill ? `預備技能池 第 ${idx + 1} 招` : `出戰配置 第 ${idx + 1} 招`}。在大視窗下更輕鬆地撰寫複雜的戰鬥機制與特效參數！
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomedSkillModal(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-blue-300">
                    對戰描述說明 (Battle Description)
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await parseEffectDescriptionWithAI(targetSkill.description || targetSkill.name);
                      if (isPoolSkill) {
                        handlePoolSkillAIMap(idx, res.structuredTemplate, res.recommendedEffectType, res.recommendedEffectDetail, res.recommendedTemplateId, res.recommendedTemplateArgs);
                      } else {
                        handleSkillAIMap(idx, res.structuredTemplate, res.recommendedEffectType, res.recommendedEffectDetail, res.recommendedTemplateId, res.recommendedTemplateArgs);
                      }
                      if (res.templateSuggestions.length > 0) {
                        alert(`🤖【${targetSkill.name}】結構化映射報告：\n\n${res.templateSuggestions.join("\n")}`);
                      }
                    }}
                    disabled={!targetSkill.description && !targetSkill.name}
                    className="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    AI 語意智能映射特效
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={targetSkill.description || ""}
                  onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "description", e.target.value) : handleSkillChange(idx, "description", e.target.value)}
                  className="w-full bg-[#05070c] border-2 border-blue-500/60 rounded-xl p-3.5 text-sm text-slate-100 font-medium leading-relaxed shadow-inner focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                  placeholder="請在此輸入詳細的對戰技能說明，例如：必中；消除對手能力提升狀態，消除成功則使對手麻痺；未擊敗對手則吸取對手最大體力 1/4..."
                />
                <div className="bg-[#050608]/50 border border-slate-800/50 rounded-xl p-3 mt-2 mb-4">
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    語法即時解析預覽
                  </div>
                  <SmartDescription text={targetSkill.description} className="text-sm text-slate-300" />
                </div>
                <GrammarLegend currentText={targetSkill.description || ""} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-cyan-300 block">
                  特效細節參數代碼 (Effect Detail Code)
                </label>
                <input
                  type="text"
                  value={targetSkill.effectDetail || ""}
                  onChange={(e) => isPoolSkill ? handlePoolSkillChange(idx, "effectDetail", e.target.value) : handleSkillChange(idx, "effectDetail", e.target.value)}
                  className="w-full bg-[#05070c] border-2 border-cyan-500/60 rounded-xl px-4 py-2.5 text-sm text-cyan-300 font-mono font-bold shadow-inner focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all"
                  placeholder="例如：'atk+2,def+1,heal:50,clear_turn'"
                />
                <p className="text-[11px] text-slate-400">
                  💡 點擊下方常用特效標籤，可直接為技能追加參數代碼：
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: "攻擊+2", code: "atk+2" },
                    { label: "特攻+2", code: "spatk+2" },
                    { label: "速度+1", code: "spd+1" },
                    { label: "全屬性+1", code: "all+1" },
                    { label: "消除回合", code: "clear_turn" },
                    { label: "消除強化", code: "clear_stat" },
                    { label: "必中", code: "sure_hit" },
                    { label: "恢復50%HP", code: "heal:50" },
                    { label: "恢復100%HP", code: "heal:100" },
                    { label: "護盾200", code: "shield:200" },
                    { label: "護盾300", code: "shield:300" },
                    { label: "30%麻痺", code: "paralyze:30" },
                    { label: "40%害怕", code: "fear:40" },
                    { label: "50%燒傷", code: "burn:50" },
                    { label: "50%疲憊", code: "fatigue:50" },
                    { label: "50%睡眠", code: "sleep:50" },
                    { label: "傷害翻倍", code: "double_dmg" },
                    { label: "吸取1/4", code: "absorb:25" },
                    { label: "自爆送死", code: "suicide_buff" },
                    { label: "免疫異常", code: "immune_status" },
                  ].map((tag, tagIdx) => (
                    <button
                      key={tagIdx}
                      type="button"
                      onClick={() => {
                        const currentVal = targetSkill.effectDetail || "";
                        const nextVal = currentVal ? `${currentVal},${tag.code}` : tag.code;
                        if (isPoolSkill) {
                          handlePoolSkillChange(idx, "effectDetail", nextVal);
                        } else {
                          handleSkillChange(idx, "effectDetail", nextVal);
                        }
                      }}
                      className="p-2 bg-slate-800/90 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-mono cursor-pointer transition-all flex flex-col items-center justify-center text-center"
                    >
                      <span className="font-bold">{tag.label}</span>
                      <span className="text-[10px] text-cyan-400/80">({tag.code})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoomedSkillModal(null)}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> 確認儲存並關閉
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Zoomed Trait Modal */}
      {zoomedTraitModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`bg-[#0b0e17] border-2 ${zoomedTraitModal === 'gen2' ? 'border-amber-500/80 shadow-amber-500/20' : 'border-red-500/80 shadow-red-500/20'} rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ZoomIn className={`w-5 h-5 ${zoomedTraitModal === 'gen2' ? 'text-amber-400' : 'text-red-400'}`} />
                  【{zoomedTraitModal === 'gen2' ? (gen2TraitName || '未命名二代特質') : (exTraitName || '未命名專屬特質')}】— {zoomedTraitModal === 'gen2' ? '二代異能特質' : '專屬異能特質'} 放大編輯視窗
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  在大視窗下更輕鬆地撰寫與調整複雜的異能特質效果、觸發條件與進階機制描述！
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedTraitModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold ${zoomedTraitModal === 'gen2' ? 'text-amber-300' : 'text-red-300'} mb-1.5`}>
                  特質名稱 (Name)
                </label>
                <input
                  type="text"
                  value={zoomedTraitModal === 'gen2' ? gen2TraitName : exTraitName}
                  onChange={(e) => zoomedTraitModal === 'gen2' ? setGen2TraitName(e.target.value) : setExTraitName(e.target.value)}
                  className={`w-full bg-[#050608] border ${zoomedTraitModal === 'gen2' ? 'border-amber-500/50 focus:border-amber-400' : 'border-red-500/50 focus:border-red-400'} rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none`}
                  placeholder={zoomedTraitModal === 'gen2' ? "例如: 豪邁 / 投石者 / 無我 / 戰士" : "例如: 無序星魂使徒"}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold ${zoomedTraitModal === 'gen2' ? 'text-amber-300' : 'text-red-300'} mb-1.5 flex justify-between items-center`}>
                  <span>特質詳細說明描述 (Detailed Effect Description)</span>
                  <span className="text-[10px] text-slate-500 font-normal">支持多行換行與條列</span>
                </label>
                <textarea
                  rows={8}
                  value={zoomedTraitModal === 'gen2' ? gen2TraitDesc : exTraitDesc}
                  onChange={(e) => zoomedTraitModal === 'gen2' ? setGen2TraitDesc(e.target.value) : setExTraitDesc(e.target.value)}
                  className={`w-full bg-[#050608] border ${zoomedTraitModal === 'gen2' ? 'border-amber-500/50 focus:border-amber-400' : 'border-red-500/50 focus:border-red-400'} rounded-xl p-4 text-sm text-slate-100 font-mono leading-relaxed focus:outline-none`}
                  placeholder="輸入詳細特質效果說明，例如：戰鬥中被視為異能精靈；技能位可攜帶4種不同屬性的技能石且任意技能石時轉化為同屬系的SS級技能石..."
                />
              </div>

              {zoomedTraitModal === 'gen2' && (
                <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 text-xs text-amber-300/90 space-y-1">
                  <div className="font-bold">💡 二代異能特質小貼士：</div>
                  <div>• 特質名稱中包含「投石者」或精靈為「無序.墜星」時，系統將自動啟動技能石全能轉化機制（SS級240威力、戰鬥神話效果）。</div>
                  <div>• 特質名稱中包含「戰士」或「無我」將對應啟用經典的傷害穿透與轉化狀態判定。</div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setZoomedTraitModal(null)}
                className={`px-6 py-2.5 ${zoomedTraitModal === 'gen2' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'} font-bold rounded-xl shadow-lg transition-all cursor-pointer`}
              >
                完成設定 (Done)
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Skill Stone Equipment Modal */}
      {isSkillStoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0b0e17] border-2 border-emerald-500/80 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl shadow-emerald-500/20 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <img src={stoneIconUrl(stoneAttr, stoneGrade)} alt={`${stoneAttr}系 ${stoneGrade} 級技能石`} className="w-12 h-12 object-contain" />
                  <span>技能石系統</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  為精靈配置並綁定各系技能石。等級越高威力越強，完美技能石更附帶強大的命中/回合後特效！
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSkillStoneModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {isStoneThrower({ id: "temp", name: elfName, type: elfType, level: 100, baseStats, calculatedStats: baseStats, currentHp: 100, maxHp: 100, soulMark: { name: soulMarkName, description: soulMarkDesc, effectType: soulMarkEffectType, effectValue: soulMarkValue }, alienTraits: { gen2Trait: gen2TraitName ? { name: gen2TraitName, description: gen2TraitDesc } : undefined }, skills }) ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1">🌟 【投石者】異能特質共鳴：</div>
                <div>• 該精靈可同時攜帶高達 <b>4</b> 種不同屬性的技能石（無法重複屬性）。</div>
                <div>• 戰鬥中使用任意等級技能石，都將轉化為使用同屬系 <b>SS級</b> 技能石，威力躍升至 <b>240</b>，且本系PP上限+10！</div>
                <div>• 攜帶 4 顆不同屬性技能石，PVP／PVE 均解鎖 <b>神話</b>，PP 免消耗（不是改成 99），攻擊傷害增減 50%。</div>
              </div>
            ) : (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-slate-200">ℹ️ 常規精靈技能石綁定規則：</div>
                <div>• 精靈綁定技能石後，將占用常規技能槽（前4槽）的一個格子。</div>
                <div>• 每隻最多一顆；更換請選原槽位。被替換的技能保留在預備技能池，不會覆蓋其他技能。</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1.5">1. 選擇技能石屬性 (Attribute)</label>
                <select
                  value={stoneAttr}
                  onChange={(e) => {
                    const newAttr = e.target.value;
                    setStoneAttr(newAttr);
                    const avail = getPerfectEffectsForAttribute(newAttr);
                    if (avail.length > 0) setStoneEffectId(avail[0].id);
                  }}
                  className="w-full bg-[#050608] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  {SKILL_STONE_ATTRIBUTES.map((attr) => (
                    <option key={attr} value={attr}>{attr}系 技能石</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1.5">2. 選擇技能石等級 (Grade)</label>
                <select
                  value={stoneGrade}
                  onChange={(e) => setStoneGrade(e.target.value as SkillStoneGrade)}
                  className="w-full bg-[#050608] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  {(Object.keys(SKILL_STONE_GRADES) as SkillStoneGrade[]).filter(g => g !== 'SS').map((g) => (
                    <option key={g} value={g}>{SKILL_STONE_GRADES[g].label} (威力: {SKILL_STONE_GRADES[g].power}, PP: {SKILL_STONE_GRADES[g].pp})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1.5">3. 攻擊分類 (Category)</label>
                <div className="flex gap-2">
                  {(['物理', '特殊'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setStoneCategory(cat)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${stoneCategory === cat ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                    >
                      {cat}攻擊
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1.5">4. 綁定目標槽位 (Target Slot)</label>
                <select
                  value={stoneTargetSlot}
                  onChange={(e) => setStoneTargetSlot(Number(e.target.value))}
                  className="w-full bg-[#050608] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  {[0, 1, 2, 3].map((s) => (
                    <option key={s} value={s}>技能欄位 #{s + 1} ({skills[s] ? skills[s].name : "空位"})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>5. 是否賦予「完美技能石」特效？ (Perfect Stone Effect)</span>
                </label>
                <input
                  type="checkbox"
                  checked={stoneIsPerfect}
                  onChange={(e) => setStoneIsPerfect(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                />
              </div>

              {stoneIsPerfect && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
                  <label className="block text-[11px] text-slate-400 font-bold">選擇完美技能石機率特效：</label>
                  <select
                    value={stoneEffectId}
                    onChange={(e) => setStoneEffectId(e.target.value)}
                    className="w-full bg-[#050608] border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold"
                  >
                    <optgroup label={`【${stoneAttr}系】專屬完美特效`}>
                      {getPerfectEffectsForAttribute(stoneAttr).filter(e => e.targetAttribute).map((eff) => (
                        <option key={eff.id} value={eff.id}>
                          {eff.name} — {eff.description} ({eff.chance}%機率)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="全屬性通用能力提升特效">
                      {PERFECT_SKILL_STONE_EFFECTS.filter(e => !e.targetAttribute).map((eff) => (
                        <option key={eff.id} value={eff.id}>
                          {eff.name} — {eff.description} ({eff.chance}%機率)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {stoneEffectId && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      效果預覽：使用時 {PERFECT_SKILL_STONE_EFFECTS.find(e => e.id === stoneEffectId)?.description || ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSkillStoneModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-xs"
              >
                取消 (Cancel)
              </button>
              <button
                type="button"
                onClick={handleEquipSkillStone}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 text-xs"
              >
                <Check className="w-4 h-4" /> 確認綁定並裝備技能石
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isEffectModalOpen && <Suspense fallback={<p role="status" className="ios-panel fixed inset-x-4 top-1/3 z-[300] p-6 text-slate-300">載入效果引用資料庫…</p>}><EffectLibraryModal
        isOpen={isEffectModalOpen}
        onClose={() => setIsEffectModalOpen(false)}
        onSelectModule={(mod) => {
          const insertText = `\n[引用系統庫-${mod.name}]: ${mod.standardSyntax}\n`;
          if (activeTab === "ai") {
            setPrompt((prev) => prev + insertText);
          } else {
            setElfDescription((prev) => (prev ? prev + insertText : mod.standardSyntax));
            if (mod.category === "soul_mark" || mod.category === "survival") {
              setSoulMarkDesc((prev) => (prev ? prev + insertText : mod.standardSyntax));
            }
          }
        }}
      /></Suspense>}
    </div>
  );
}
