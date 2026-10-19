/** 僅供呈現的原文關聯。指紋不符就不套用，避免沿用到已修改的自訂效果。 */
export interface DescriptionRelation {
  text: string;
  parentText: string;
  role: 'effect' | 'note';
}
export const DESCRIPTION_LAYOUTS: Record<string, DescriptionRelation[]> = {
  // 雷伊魂印：補充歸屬已由使用者於2026-10-12確認；只調整呈現，不改戰鬥邏輯。
  '10931485': [
    { text: '複製成功則令自身麻痺。', parentText: '複製對手能力提升狀態。', role: 'effect' },
    { text: '觸發成功則當回合令自身麻痺。', parentText: '對手每次回合類效果開始時變為1回合。', role: 'effect' },
    { text: '每減少1回合令自身麻痺回合數+1。', parentText: '對手每次回合類效果開始時變為1回合。', role: 'effect' },
    { text: '吸取前若自身處於異常狀態，則汲取對手等同於自身當前重量的體力值，且上述吸取體力改為汲取體力。', parentText: '吸取對手雙方能力等級總和*70的體力值。', role: 'effect' },
  ],
  // 神明（DSH 20261020：神降效果段由雷神搬入神明，hash 重算）：退出／下場保留描述屬於神降整體。
  '248ac347': [
    { text: '並開始觸發上列效果，直到自身體力恢復為正數時結束神降。', parentText: '神降效果', role: 'note' },
    { text: '神降狀態下場後保留。', parentText: '神降效果', role: 'note' },
  ],
};
