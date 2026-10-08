import type { Elf, BaseStats } from '../types';
import { calculateElfStats, getDefaultEvs } from './statCalculator';
import { validateKit } from '../effects/kitValidation';
import { StatusRegistry } from '../effects/statusRegistry';
import { canonicalStatusName } from '../effects/statusIdentity';
import { SKILL_STONE_GRADES, SKILL_STONE_ATTRIBUTES, getPerfectEffectsForAttribute, validateSkillStoneLoadout, isSkillStone } from '../data/skillStones';
export const MAX_BLUEPRINT_BYTES = 2_000_000;
const stats = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
function fail(message: string): never { throw new Error(`圖紙格式錯誤：${message}`); }
function text(value: unknown, label: string, limit = 100000) { if (typeof value !== 'string' || value.length > limit) fail(label); }
function number(value: unknown, label: string, min = 0, max = 1_000_000) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(label); }
function numericStats(value: unknown, label: string, max: number) {
  if (!object(value)) fail(label);
  for (const key of stats) number(value[key], `${label}.${key}`, 0, max);
}
function trait(value: unknown, label: string) {
  if (!object(value)) fail(label);
  text(value.name, `${label}.name`, 200); text(value.description, `${label}.description`);
  if (value.customCode !== undefined) text(value.customCode, `${label}.customCode`);
  if (value.mechanics !== undefined) {
    if (!object(value.mechanics) || Object.keys(value.mechanics).length > 200) fail(`${label}.mechanics`);
    let visited = 0;
    const visit = (v: unknown, path: string, depth: number) => {
      if (++visited > 2000 || depth > 12) fail(`${path}（巢狀機制過深或過多）`);
      if (v === null || typeof v === 'boolean') return;
      if (typeof v === 'number') { number(v, path, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER); return; }
      if (typeof v === 'string') { text(v, path, 2000); return; }
      if (Array.isArray(v)) { if (v.length > 200) fail(path); v.forEach((child, i) => visit(child, `${path}[${i}]`, depth + 1)); return; }
      if (!object(v) || Object.keys(v).length > 200) fail(path);
      for (const [key, child] of Object.entries(v)) { text(key, `${path} key`, 200); visit(child, `${path}.${key}`, depth + 1); }
    };
    // 機制資料原樣保留；通過 JSON 校驗不代表存在對應的戰鬥 handler。
    visit(value.mechanics, `${label}.mechanics`, 0);
  }
}
function kit(value: unknown, label: string) {
  validateKit(value, label);
}
/** 解析與檢查不寫存檔、不執行 customCode／Kit，戰鬥執行與語意另行驗證。 */
export function parseElfBlueprint(json: string): { elf: Elf; warnings: string[]; version: number } {
  if (new TextEncoder().encode(json).length > MAX_BLUEPRINT_BYTES) fail('檔案超過 2 MB');
  let doc: any;
  try { doc = JSON.parse(json, (key, value) => { if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('不允許原型欄位'); return value; }); }
  catch (e) { throw new Error(`無法讀取圖紙：${(e as Error).message}`); }
  if (!object(doc)) fail('根節點需為物件');
  let count = 0;
  const checkTree = (value: any, depth = 0) => {
    if (++count > 100000 || depth > 25) fail('資料過深或過多');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('非有限數值');
    if (value && typeof value === 'object') for (const child of Object.values(value)) checkTree(child, depth + 1);
  };
  checkTree(doc);
  const version = doc.schemaVersion ?? 1;
  if (version !== 1 && version !== 2) fail(`不支援版本 ${String(version)}`);
  const warnings: string[] = [];
  let source: any;
  if (version === 2) { if (!object(doc.manualElf)) fail('缺少 manualElf'); source = doc.manualElf; }
  else {
    const old = doc.manualStats;
    if (!object(old)) fail('舊版缺少 manualStats，不可推定完整草稿');
    source = { ...old, name: old.elfName, type: old.elfType, id: 'legacy_blueprint',
      soulMark: { name: old.soulMarkName || '', description: old.soulMarkDesc || '', effectType: 'none', effectValue: 0 } };
    warnings.push('舊版圖紙不含完整特質、抗性與個體值；缺少欄位採預設，不能還原當年未匯出的資料。');
  }
  text(source.name, 'name', 200); text(source.type, 'type', 100);
  numericStats(source.baseStats, 'baseStats', 100000);
  if (source.evs !== undefined) { numericStats(source.evs, 'evs', 255); if (stats.reduce((sum, k) => sum + source.evs[k], 0) > 510) fail('學習力總和超過 510'); }
  if (source.ivs !== undefined) numericStats(source.ivs, 'ivs', 31);
  if (source.guildBonuses !== undefined) numericStats(source.guildBonuses, 'guildBonuses', 100000);
  if (source.natureModifiers !== undefined) { if (!object(source.natureModifiers)) fail('natureModifiers'); for (const key of stats) if (source.natureModifiers[key] !== undefined) number(source.natureModifiers[key], `natureModifiers.${key}`, 0.1, 2); }
  for (const key of ['height', 'weight']) if (source[key] !== undefined) number(source[key], key, 0, Number.MAX_SAFE_INTEGER);
  for (const key of ['id', 'gender', 'path', 'specialModeRating', 'destinyRank', 'description', 'imageUrl', 'avatarUrl', 'badge', 'category', 'rawPrompt']) if (source[key] !== undefined) text(source[key], key);
  if (source.seerId !== undefined && typeof source.seerId !== 'string' && typeof source.seerId !== 'number') fail('seerId');
  if (source.critValue !== undefined) number(source.critValue, 'critValue', 0, 10000);
  for (const key of ['isAlienElf', 'hasAnnualBonus']) if (source[key] !== undefined && typeof source[key] !== 'boolean') fail(key);
  for (const field of ['skills', 'skillPool']) {
    const list = source[field];
    if (field === 'skillPool' && list === undefined) continue;
    if (!Array.isArray(list) || list.length > 500) fail(field);
    for (const skill of list) {
      trait(skill, field); text(skill.type, `${field}.type`, 100);
      if (!['物理', '特殊', '屬性'].includes(skill.category)) fail(`${field}.category`);
      number(skill.power, `${field}.power`); number(skill.pp, `${field}.pp`, 0, 10000);
      if (skill.priority !== undefined) number(skill.priority, `${field}.priority`, -100, 100);
      if (skill.accuracy !== undefined) number(skill.accuracy, `${field}.accuracy`, 0, 10000);
      for (const key of ['id', 'effectType', 'effectDetail']) if (skill[key] !== undefined) text(skill[key], `${field}.${key}`);
      for (const key of ['maxPp', 'currentPp']) if (skill[key] !== undefined) number(skill[key], `${field}.${key}`, 0, 10000);
      for (const key of ['isFifthSkill', 'isGuaranteedHit', 'isSureHit', 'isCarrying', 'isInherent', 'isSkillStone', 'isPerfectSkillStone']) if (skill[key] !== undefined && typeof skill[key] !== 'boolean') fail(`${field}.${key}`);
      if (skill.skillStoneRuleset !== undefined && !['standard', 'project'].includes(skill.skillStoneRuleset)) fail(`${field}.skillStoneRuleset`);
      if (skill.skillStoneGrade !== undefined && !Object.hasOwn(SKILL_STONE_GRADES, skill.skillStoneGrade)) fail(`${field}.skillStoneGrade`);
      if (skill.skillStoneOriginalGrade !== undefined && !Object.hasOwn(SKILL_STONE_GRADES, skill.skillStoneOriginalGrade)) fail(`${field}.skillStoneOriginalGrade`);
      if (isSkillStone(skill)) {
        if (!SKILL_STONE_ATTRIBUTES.includes(skill.type) || skill.category === '屬性' || skill.isFifthSkill) fail(`${field}.技能石類型或槽位`);
        if (skill.skillStoneEffect !== undefined && !getPerfectEffectsForAttribute(skill.type).some(e => e.id === skill.skillStoneEffect)) fail(`${field}.skillStoneEffect`);
        if (skill.isPerfectSkillStone && !getPerfectEffectsForAttribute(skill.type).some(e => e.id === (skill.skillStoneEffect || skill.effectDetail))) fail(`${field}.完美技能石缺少合法效果`);
      }
      if (skill.statChanges !== undefined) {
        if (!Array.isArray(skill.statChanges) || skill.statChanges.length > 100) fail(`${field}.statChanges`);
        for (const change of skill.statChanges) { if (!object(change) || !['atk','def','spatk','spdef','speed','accuracy','all'].includes(change.stat)) fail(`${field}.statChanges.stat`); number(change.value, `${field}.statChanges.value`, -6, 6); }
      }
      if (skill.statusEffects !== undefined) {
        if (!Array.isArray(skill.statusEffects) || skill.statusEffects.length > 100) fail(`${field}.statusEffects`);
        for (const effect of skill.statusEffects) {
          if (!object(effect) || !StatusRegistry[canonicalStatusName(effect.name)]) fail(`${field}.statusEffects.name`);
          number(effect.duration, `${field}.statusEffects.duration`, 0, 10000);
          if (!Number.isInteger(effect.duration)) fail(`${field}.statusEffects.duration`);
          if (effect.category !== undefined && !StatusRegistry[canonicalStatusName(effect.name)].categories.includes(effect.category)) fail(`${field}.statusEffects.category`);
        }
      }
      if (skill.templateId !== undefined) text(skill.templateId, `${field}.templateId`, 200);
      if (skill.templateArgs !== undefined) {
        if (!Array.isArray(skill.templateArgs) || skill.templateArgs.length > 100) fail(`${field}.templateArgs`);
        for (const arg of skill.templateArgs) {
          if (!['number','string','boolean'].includes(typeof arg)) fail(`${field}.templateArgs（槽位僅接受數值／文字／布林）`);
          if (typeof arg === 'number') number(arg, `${field}.templateArgs`, -1_000_000, 1_000_000);
          if (typeof arg === 'string') text(arg, `${field}.templateArgs`, 2000);
        }
      }
      if (skill.kit !== undefined) kit(skill.kit, `${field}.kit`);
    }
  }
  if (source.soulMark) { trait(source.soulMark, 'soulMark'); if (source.soulMark.customCode) warnings.push('包含魂印自訂程式；匯入不會執行，請在實戰前審查程式與效果。'); }
  if (source.trait) trait(source.trait, 'trait');
  if (source.alienTraits) {
    if (!object(source.alienTraits)) fail('alienTraits');
    for (const key of ['gen2Trait', 'exclusiveTrait', 'alienTrait', 'generalTrait']) if (source.alienTraits[key]) trait(source.alienTraits[key], `alienTraits.${key}`);
    if (source.alienTraits.exclusiveTraits !== undefined) {
      if (!Array.isArray(source.alienTraits.exclusiveTraits) || source.alienTraits.exclusiveTraits.length > 100) fail('exclusiveTraits');
      source.alienTraits.exclusiveTraits.forEach((t: unknown) => trait(t, 'exclusiveTraits'));
    }
  }
  if (source.kit !== undefined) kit(source.kit, 'kit');
  if (source.inscriptions !== undefined && (!Array.isArray(source.inscriptions) || source.inscriptions.length > 3)) fail('inscriptions');
  if (source.inscriptions) for (const ins of source.inscriptions) if (ins !== null) {
    if (!object(ins)) fail('inscriptions');
    text(ins.name, 'inscriptions.name', 200); numericStats(ins.stats, 'inscriptions.stats', 100000);
  }
  if (source.resistances) {
    if (!object(source.resistances) || !object(source.resistances.damageResist) || !object(source.resistances.statusResist)) fail('resistances');
    for (const value of Object.values(source.resistances.damageResist)) number(value, 'damageResist', 0, 100);
    const slots = source.resistances.statusResist.slots;
    const sr = source.resistances.statusResist;
    if (sr.allImmune !== undefined && typeof sr.allImmune !== 'boolean') fail('statusResist.allImmune');
    if (sr.selectedStatuses !== undefined && (!Array.isArray(sr.selectedStatuses) || sr.selectedStatuses.length > 200 || sr.selectedStatuses.some((s: unknown) => typeof s !== 'string' || s.length > 200))) fail('statusResist.selectedStatuses');
    if (slots !== undefined) { if (!Array.isArray(slots) || slots.length > 20) fail('resistance slots'); for (const slot of slots) { if (!object(slot)) fail('slot'); text(slot.id, 'slot.id', 200); text(slot.status, 'slot.status', 200); if (!['control', 'weakening'].includes(slot.category)) fail('slot.category'); number(slot.rate, 'slot.rate', 0, 100); } }
  }
  // 僅接收編輯配置，不匯入戰鬥中狀態、存活規則、印記及 currentHp。
  const allowed = ['id','name','type','baseStats','evs','ivs','natureModifiers','guildBonuses','inscriptions','resistances','isAlienElf','hasAnnualBonus','height','weight','gender','path','specialModeRating','destinyRank','description','soulMark','trait','alienTraits','skills','skillPool','kit','imageUrl','avatarUrl','seerId','badge','critValue','category','rawPrompt'];
  const skipped = Object.keys(source).filter(k => !allowed.includes(k) && !['level','isCustom','calculatedStats','currentHp','maxHp'].includes(k));
  if (skipped.length) warnings.push(`未匯入戰鬥狀態或尚不支援欄位：${skipped.join('、')}。請保留原始圖紙。`);
  const elf: any = Object.fromEntries(allowed.filter(k => source[k] !== undefined).map(k => [k, source[k]]));
  if (elf.skills.length > 5) {
    const names = new Set((elf.skillPool || []).map((s: any) => s.name));
    elf.skillPool = [...(elf.skillPool || []), ...elf.skills.slice(5).filter((s: any) => !names.has(s.name))];
    elf.skills = elf.skills.slice(0, 5);
    warnings.push('舊資料超過五個攜帶技能；超出者移入預備技能池，未丟棄技能。');
  }
  elf.id ||= 'imported_blueprint'; elf.level = 100; elf.isCustom = true;
  validateSkillStoneLoadout(elf, elf.skills);
  elf.evs ||= getDefaultEvs(elf.baseStats as BaseStats);
  elf.inscriptions = (elf.inscriptions || []).map((i: unknown) => i === null ? undefined : i);
  elf.calculatedStats = calculateElfStats(elf.baseStats, 100, elf.ivs, elf.evs, elf.natureModifiers, elf.inscriptions, elf.guildBonuses, elf.hasAnnualBonus);
  elf.maxHp = elf.currentHp = elf.calculatedStats.hp;
  warnings.push('匯入只替換目前草稿；不自動儲存、不證明技能／魂印已實裝。');
  return { elf, warnings, version };
}
