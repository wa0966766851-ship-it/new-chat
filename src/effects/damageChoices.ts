import { isSkillDamageType, isNonTrueDamageType, normalizeDamageType } from '../battle/damageSemantics';
import type { KitEntry, Node } from './effectSystem.schema';

/** 傷害類別與取值分開：70% 技能傷害仍是技能傷害。 */
export const DAMAGE_CHOICES = [
  { value: 'fixed', label: '固定傷害', help: '不吃屬性克制，由護罩承受。' },
  { value: 'percent', label: '百分比傷害', help: '按目標最大體力取值，由護罩承受。' },
  { value: 'skill', label: 'X 系技能傷害', help: '套用指定屬性克制，由護盾承受。' },
  { value: 'true', label: '真實傷害', help: '不吃屬性克制，不由護盾／護罩承受。' },
] as const;
export type DamageChoice = typeof DAMAGE_CHOICES[number]['value'];
export type DamageKind = DamageChoice | 'attack' | 'hp_adjust' | 'non_true';
export function matchesDamageTypes(types: string[] | undefined, category: string): boolean {
  if (!types?.length) return true; // 舊存檔保留原作用範圍，不默默改語意。
  const normalized = normalizeDamageType({ damageType: category });
  return types.some(type => type === 'skill' ? isSkillDamageType(normalized)
    : type === 'attack' ? normalized === 'skill_attack'
    : type === 'non_true' ? isNonTrueDamageType(normalized)
    : type === normalized);
}
export const damageScopeLabel = (type: string) => type === 'skill' ? '技能傷害（普通攻擊／X 系／額外行動）' : damageChoiceLabel(type);
export const damageChoiceLabel = (type: string) => DAMAGE_CHOICES.find(c => c.value === type)?.label || ({ attack: '攻擊傷害（技能公式）', hp_adjust: '體力調整（不是傷害）', non_true: '非真實傷害（攻擊／技能／固定／百分比）' }[type] ?? '待確認傷害');
/** 只建議，不改寫描述或自動實裝；增減傷的 % 不代表百分比傷害。 */
export function suggestDamageTypes(text: string): { types: DamageKind[]; inferred: boolean; reason: string } | null {
  if (/體力調整|(?:令|將|使)(?:自身|對手)?體力(?:歸|變為|調整為)\s*\d+/.test(text) && !/傷害/.test(text)) return { types: ['hp_adjust'], inferred: false, reason: '調整當前體力，不視為傷害或回血，也不改體力上限。' };
  if (!/傷害|真傷|固傷/.test(text)) return null;
  // 先排除「非真實」範圍，不能因包含「真實傷害」四字而推薦真傷。
  const damageText = text.replace(/非(?:真實傷害|真傷)/g, '');
  const explicit: DamageKind[] = DAMAGE_CHOICES.filter(c => c.value === 'skill' ? /(?:技能|系)傷害/.test(damageText) : c.value === 'true' ? /真實傷害|真傷/.test(damageText) : c.value === 'fixed' ? /固定傷害|固傷/.test(damageText) : /百分比傷害/.test(damageText)).map(c => c.value);
  if (/非(?:真實傷害|真傷)/.test(text)) explicit.push('non_true');
  if (/攻擊傷害/.test(text)) explicit.push('attack');
  if (explicit.length) return { types: explicit, inferred: false, reason: '文本指定；同句多段傷害仍須逐段核對。' };
  if (/傷害(?:提升|提高|增加|減少|降低|翻倍|減半)|(?:增|減)傷/.test(text)) return { types: [], inferred: true, reason: '倍率／減傷的作用類別待確認。' };
  const amountText = text.replace(/\d+(?:\.\d+)?[%％]\s*(?:機率|概率|幾率)/g, '');
  if (/(?:體力|HP).{0,8}(?:\d+(?:\.\d+)?[%％]|[½⅓¼]|\d+\/\d+)|\d+[%％].{0,6}傷害/.test(amountText)) return { types: ['percent'], inferred: true, reason: '建議百分比，取值基準待確認；不自動實裝。' };
  if (/\d+\s*(?:點)?\s*傷害/.test(text)) return { types: ['fixed'], inferred: true, reason: '預設建議固定，技能／真實仍可選。' };
  return { types: [], inferred: true, reason: '請選固定／百分比／X 系技能／真實類別。' };
}
export function createDamageEntry(input: { amount: number; unit: 'points' | 'percent'; type?: DamageChoice; elem?: string; target?: 'self' | 'opponent'; node?: Node; source?: KitEntry['source']; order?: number }): KitEntry {
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1_000_000 || (input.unit === 'percent' && input.amount > 5000)) throw new Error('傷害數值無效；百分比取值限 0–5000%，不將傷害比例限制為體力上限。');
  const damageType = input.type || (input.unit === 'percent' ? 'percent' : 'fixed');
  if (damageType === 'percent' && input.unit !== 'percent') throw new Error('百分比傷害需指定百分比取值。');
  if (damageType === 'skill' && !input.elem?.trim()) throw new Error('X 系技能傷害必須指定屬性。');
  const target = input.target || 'opponent';
  return { codeId: 'extra_damage', node: input.node || 'on_hit', source: input.source || 'skill', order: input.order || 0,
    params: { target, amount: input.amount, damageType, amountMode: input.unit === 'percent' ? 'max_hp_percent' : 'flat', elem: damageType === 'skill' ? input.elem : undefined, damageNode: (input.node || 'on_hit') === 'on_hit' ? 'attack_damage' : 'skill_effect' },
    customText: `${target === 'self' ? '自身' : '對手'}受到${input.unit === 'percent' ? `最大體力 ${input.amount}%` : `${input.amount} 點`}${damageType === 'skill' ? ` ${input.elem}系技能傷害` : damageChoiceLabel(damageType)}` };
}
