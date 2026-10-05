import type { Elf, Skill } from '../types';

/** 選擇時保存槽號；PP刷新或幻化換名後仍扣原槽。同名且無槽號時不猜第一格。 */
export function skillSlot(elf: Pick<Elf, 'skills'>, selected?: Skill | null): number {
  if (!selected) return -1;
  const explicit = selected.battleSlot;
  if (Number.isInteger(explicit) && explicit! >= 0 && explicit! < elf.skills.length) return explicit!;
  const reference = elf.skills.indexOf(selected);
  if (reference >= 0) return reference;
  const matches = elf.skills.flatMap((s, i) => s.name === selected.name ? [i] : []);
  return matches.length === 1 ? matches[0] : -1;
}
