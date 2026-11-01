import type { Elf } from '../types';

/** 僅用於組隊／載入陣容邊界。待命與 BP 候選仍是正常精靈，不能沿用舊戰局的額外身分。
 * 禁止用於正在進行的戰局：效果加入的額外精靈必須保留 isExtra。
 */
export function asRosterMember<T extends Elf>(elf: T): T {
  return { ...elf, isExtra: false };
}
