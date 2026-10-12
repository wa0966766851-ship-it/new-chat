import type { Elf, Skill } from '../types';
import type { Program } from './model';
import { getSkillProgram, getSoulProgram, skillMode } from './registry';
import { hasSkillHandler, getSoulMarkRegistry } from '../effects/battleEventRegistry';
import { SOUL_MODE } from './specs';
import { parseSoulMark } from './parse';
import { suggestDamageTypes } from '../effects/damageChoices';
import { compileEffectPlan, type EffectDefinition } from '../effects/effectConnection';
import { usesAuthoredSkill, usesAuthoredSoul, soulDefinition } from '../effects/connectedEffects';

export function describeExecution(input: { elf?: Elf; skill?: Skill; trait?: EffectDefinition }, handlers = { skill: hasSkillHandler, soul: (name: string) => !!getSoulMarkRegistry()[name] }): { program: Program; source: string; route: string } {
  if (input.skill) {
    if (usesAuthoredSkill(input.skill, handlers.skill(input.skill.name), input.elf)) {
      const plan = compileEffectPlan(input.skill, 'skill', handlers.skill(input.skill.name));
      return { program: plan.program, route: plan.route, source: `統一效果來源：${plan.route}；未接通 ${plan.issues.length} 項` };
    }
    const mode = skillMode(input.skill.name, handlers.skill(input.skill.name));
    const route = mode === 'handler' ? 'handler' : mode === 'blocks' ? 'blocks' : 'hybrid';
    return { program: getSkillProgram(input.skill), route, source: route === 'handler' ? '專屬程式（積木僅供語意對照）' : route === 'blocks' ? '積木＋未解析文字 fallback（未保證完整）' : '專屬程式＋指定積木子句' };
  }
  if (input.trait) {
    if (input.trait.effectMode === 'kit' || input.trait.effectMode === 'description') {
      const plan = compileEffectPlan(input.trait, 'soul');
      return { program: plan.program, route: plan.route, source: `特質統一來源：${plan.route}；未接通 ${plan.issues.length} 項` };
    }
    return { program: parseSoulMark(input.trait.name, input.trait.description || ''), route: 'trait-review', source: '特質引擎／專屬程式：須逐條核對，未以解析率證明實裝' };
  }
  const elf = input.elf!;
  if (usesAuthoredSoul(elf, handlers.soul(elf.name))) {
    const plan = compileEffectPlan(soulDefinition(elf), 'soul', handlers.soul(elf.name));
    return { program: plan.program, route: plan.route, source: `統一魂印來源：${plan.route}；未接通 ${plan.issues.length} 項` };
  }
  const mode = SOUL_MODE[String(elf.id)] ?? SOUL_MODE[elf.name];
  const handler = handlers.soul(elf.name);
  return { program: getSoulProgram(elf), route: mode === 'blocks' ? 'blocks' : mode ? 'hybrid' : handler ? 'handler' : 'generic',
    source: mode === 'blocks' ? '魂印積木' : mode ? '專屬程式＋指定積木子句' : handler ? '專屬程式（積木僅供語意對照）' : '通用魂印／Kit（未登記全描述積木執行）' };
}

export function auditProgram(program: Program) {
  return program.clauses.map((clause, index) => ({ index, raw: clause.raw, trigger: clause.trig,
    parsed: clause.parsed, explanation: clause.marker === '§', unresolved: clause.rest || [],
    damage: suggestDamageTypes(clause.raw), semanticVerification: 'pending' as const,
    blocks: { conditions: clause.cond || [], statements: clause.body } }));
}
