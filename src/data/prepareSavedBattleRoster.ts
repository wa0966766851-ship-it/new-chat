import type { Elf } from '../types';
import { normalizeElfStats } from '../utils/elfStats';

/** 保存陣容只決定順序及實例身分；目前倉庫的配置與積木是新戰局的來源。 */
export function prepareSavedBattleRoster(saved: Elf[], warehouse: Elf[], annual: boolean, side: string): Elf[] {
  return saved.map((entry, index) => {
    // 同名自訂版本不能搶先蓋掉精確 id 的設定。
    const latest = warehouse.find(elf => elf.id === entry.id)
      ?? (!entry.isCustom ? warehouse.find(elf => elf.name === entry.name && !elf.isCustom) : undefined);
    const source = structuredClone(latest ?? entry);
    return normalizeElfStats({
      ...source,
      battleId: entry.battleId || `${side}_${entry.id}_${index}`,
      isExtra: false,
      hasAnnualBonus: annual,
    });
  });
}
