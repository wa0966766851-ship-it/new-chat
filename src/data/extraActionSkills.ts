/**
 * 額外行動技能表（2026-11-16）：把「主動打技能傷害的額外行動」登記成具名的特殊技能，統一管理名稱、系別與說明。
 * - 額外行動不是一般技能：不占技能欄、不扣 PP、沒有先制；由效果排入；一般在出手後（3.9）結算，指定戰鬥階段結束的則在 4.10 結算。
 * - 排入時以 skillId 指向本表（ExtraAction.skillId）；戰鬥紀錄、演出與精靈介紹都讀這裡。
 * - 未登記的額外行動照舊只顯示 label（相容既有效果）。
 * 新增精靈的額外行動：在此加一筆，並在排入處（Kit 的 queue_extra_action 或程式）帶 skillId。
 */
import { LEONIDAS_SONG_TEXT } from './strengthenedElfDescriptions';

export interface ExtraActionSkillDef {
  id: string;
  name: string;
  /** 持有者精靈 id（介紹頁依此列出） */
  elfIds: string[];
  /** 顯示系別；「取最佳克制」等動態系別在 typeNote 說明 */
  type: string;
  typeNote?: string;
  /** 傷害類別（額外行動造成的技能傷害屬「額外行動技能傷害」） */
  damage: '技能傷害' | '無';
  /** 發動來源（魂印／技能名） */
  source: string;
  summary: string;
}

export const EXTRA_ACTION_SKILLS: ExtraActionSkillDef[] = [
  { id: 'ancient-weight-song', name: '亙古之歌', elfIds: ['5050'], type: '遠古', damage: '技能傷害', source: '魂印（亙古遺獸）',
    summary: LEONIDAS_SONG_TEXT },
  { id: 'wraith_curse', name: '賽博怨靈·魔咒', elfIds: ['5023'], type: '機械.暗影', typeNote: '機械.暗影／機械／暗影取克制最高者', damage: '技能傷害', source: '魂印',
    summary: '行動階段發動：造成所選技能威力＋n 點技能傷害，附加等量護盾與護罩並恢復等量體力；敵方場下隨機 1 隻受到 n×50% 真實傷害（n＝詛咒回合數）。' },
  { id: 'wraith_doom', name: '賽博怨靈·滅靈魔咒', elfIds: ['5023'], type: '機械.暗影', typeNote: '機械.暗影／機械／暗影取克制最高者', damage: '技能傷害', source: '魂印',
    summary: '戰鬥階段結束時未選擇技能則發動：以技能中最高威力＋n 點造成技能傷害，其餘同魔咒。' },
  { id: 'puni_light', name: '珀妮·光擊', elfIds: ['5014'], type: '光', damage: '技能傷害', source: '魂印（珀妮）',
    summary: '斯嘉麗在場時每次出手流程結束後發動：造成對手最大體力⅓的光系技能傷害，令對手失明（未觸發或已失明則消除對手回合類效果），斯嘉麗下 2 次攻擊傷害提升 150%。' },
  { id: 'astral_memory', name: '變思遷憶', elfIds: ['5032', '5033'], type: '超能', damage: '技能傷害', source: '技能',
    summary: '滿足技能條件時發動，依技能分支對對手、相鄰或分離的精靈造成超能系技能傷害並附加對應效果。' },
  { id: 'six_petal', name: '終焉·六花斬', elfIds: ['5022'], type: '邪靈.戰鬥', typeNote: '邪靈／戰鬥／邪靈.戰鬥各 2 次', damage: '技能傷害', source: '技能',
    summary: '進行 6 次額外行動，期間不造成傷害；行動結束時對方所有精靈受到各次傷害總和。' },
];

const BY_ID = new Map(EXTRA_ACTION_SKILLS.map(s => [s.id, s]));
export const extraActionSkill = (id?: string): ExtraActionSkillDef | undefined => (id ? BY_ID.get(id) : undefined);
export const extraActionSkillsOf = (elfId: string | number | undefined): ExtraActionSkillDef[] =>
  elfId === undefined ? [] : EXTRA_ACTION_SKILLS.filter(s => s.elfIds.includes(String(elfId)));
/** 戰鬥紀錄用名稱：登記過的顯示「【名稱】（系別）」，否則沿用 label。 */
export const extraActionTitle = (action: { label: string; skillId?: string }): string => {
  const def = extraActionSkill(action.skillId);
  return def ? `【${def.name}】（${def.type}系）` : action.label;
};
