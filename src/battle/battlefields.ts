import { PEAK_TURN_LIMIT } from './turnLimit';
import type { BattleFormatId } from './introPlan';

interface BattlefieldDefinition {
  name: string;
  description: string;
  /** Registry reference for rules attached to a field. */
  effectIds: readonly string[];
}

export const BATTLEFIELDS = {
  duel: { name: '對決場地', description: '公正公開的對決場地，依所選賽制與精靈、配裝的效果結算。', effectIds: [] },
  peak: { name: '巔峰場地', description: '巔峰禁選後展開的對決。', effectIds: [] },
  peak6: {
    name: '巔峰場地',
    description: `巔峰 6V6。第 ${PEAK_TURN_LIMIT} 回合結束仍未分出勝負時，比較雙方存活精靈數。額外精靈不計，同數判平手。`,
    effectIds: ['peak-turn-limit'],
  },
  destiny: {
    name: '命運之輪',
    description: `使 C 級精靈抽到的命運攔截效果生效，依各自描述在登場或陣亡時觸發。適用巔峰 6V6 的 ${PEAK_TURN_LIMIT} 回合判定。`,
    effectIds: ['destiny-interception', 'peak-turn-limit'],
  },
  eclipse: {
    name: '星蝕迴廊',
    description: '依探索關卡結算敵方特性、雙方已取得的遺物與本次道具使用限制。',
    effectIds: ['eclipse-encounter'],
  },
} satisfies Record<string, BattlefieldDefinition>;

export function resolveBattlefield(mode?: 'destiny' | 'interstellar', format?: BattleFormatId,fieldId?:string): BattlefieldDefinition {
  if (mode === 'destiny') return BATTLEFIELDS.destiny;
  if (mode === 'interstellar') return BATTLEFIELDS.eclipse;
  if(fieldId&&Object.hasOwn(BATTLEFIELDS,fieldId))return BATTLEFIELDS[fieldId as keyof typeof BATTLEFIELDS];
  if (format === 'peak_6v6') return BATTLEFIELDS.peak6;
  if (format === 'peak_3v3') return BATTLEFIELDS.peak;
  return BATTLEFIELDS.duel;
}
