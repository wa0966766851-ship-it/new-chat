import type { Elf } from '../types';
import type { EffectDefinition } from './effectConnection';

/** 顯示、效果庫與執行共同使用此來源；技能詞條不能混入魂印。明確的空 kit 不退回舊資料。 */
export function soulDefinition(elf: Elf): EffectDefinition {
  return { ...elf.soulMark, name: elf.soulMark?.name || elf.name,
    kit: elf.soulMark?.kit ?? elf.kit?.filter(e => e.source !== 'skill') };
}
