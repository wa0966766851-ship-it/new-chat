import type { Elf } from '../types';
import { availableElfSkins } from './elfSkins';
import { DEFAULT_ART_SOURCE, SEER_GROUPS, SEER_GROUP_IDS } from './seerElfGroups';

export interface ElfGroupDefinition {
  id: string;
  name: string;
  kind: 'group' | 'origin' | 'special';
  source?: string;
  /** Effect registration reserved for reviewed rules. */
  effectId?: string;
}

export const ELF_GROUPS: readonly ElfGroupDefinition[] = [
  { id: 'alien', name: '異能精靈', kind: 'group', source: '精靈本身的異能身分與專屬特質' },
  { id: 'battle-alliance', name: '戰神聯盟', kind: 'group', source: '淘米官方戰神聯盟成員介紹' },
  { id: 'chaos-apostle', name: '無序使徒', kind: 'group', source: '專案的無序星魂使徒專屬特質' },
  { id: 'planet-klose', name: '來自克洛斯星', kind: 'origin', source: '皮皮的原型資料' },
  { id: 'elf-king', name: '精靈王', kind: 'group', source: '專案精靈王分類' },
  { id: 'dragon-soul', name: '龍魂精靈', kind: 'group', source: '專案龍魂系列' },
  ...SEER_GROUPS,
  { id: 'huoguang-huojin', name: '霍金', kind: 'special', source: '使用者提供' },
  { id: 'huoguang-chair', name: '輪椅霍大將軍', kind: 'special', source: '使用者提供' },
  { id: 'qiongming-ship', name: '穹明號', kind: 'group', source: '使用者提供' },
  { id: 'qiongming-trio', name: '穹明三杰', kind: 'group', source: '使用者提供' },
  { id: 'huoguang-tao', name: '千里擊濤濤濤濤濤濤濤!!!!!', kind: 'special', source: '使用者提供' },
  { id: 'artisan-elf', name: '匠心精靈', kind: 'group', source: '使用者提供' },
  { id: 'beiming-huo', name: '北冥霍氏', kind: 'group', source: 'Seer API 精靈圖鑑' },
  { id: 'pool-manager', name: '泳館經理', kind: 'special', source: 'Seer API 蒂朵圖鑑' },
  { id: 'summer-chime', name: '靈籟之夏', kind: 'group', source: 'Seer API 皮膚系列25，持有泳裝皮膚' },
  { id: 'detective', name: '偵探', kind: 'special', source: '使用者指定偵探皮膚' },
  { id: 'extra', name: '額外精靈', kind: 'special', source: '本場戰鬥的召喚身分' },
];

/** 固定團體編號。新增團體時使用新序號，排序不得改動既有編號。 */
export const ELF_GROUP_CODES: Readonly<Record<string,string>> = {
  'alien': 'EG-001',
  'battle-alliance': 'EG-002',
  'chaos-apostle': 'EG-003',
  'planet-klose': 'EG-004',
  'elf-king': 'EG-005',
  'dragon-soul': 'EG-006',
  'starters': 'EG-007',
  'star-forms': 'EG-008',
  'combat-arena': 'EG-009',
  'saint-coalition': 'EG-010',
  'stars-assembly': 'EG-011',
  'insect-tribe': 'EG-012',
  'dragon-tribe': 'EG-013',
  'annual-pets': 'EG-014',
  'star-emperor-ally': 'EG-015',
  'heroes-society': 'EG-016',
  'klose-encounter': 'EG-017',
  'helka-encounter': 'EG-018',
  'beta-encounter': 'EG-019',
  'helka-origin': 'EG-020',
  'helka-founder': 'EG-021',
  'phantom-planet': 'EG-022',
  'alpha-planet': 'EG-023',
  'white-planet': 'EG-024',
  'white-guardian': 'EG-025',
  'eddy-guardian': 'EG-026',
  'grace-guardian': 'EG-027',
  'light-guardian': 'EG-028',
  'six-realms': 'EG-029',
  'zone-twin': 'EG-030',
  'extra': 'EG-031',
  'huoguang-huojin': 'EG-032',
  'huoguang-chair': 'EG-033',
  'qiongming-ship': 'EG-034',
  'qiongming-trio': 'EG-035',
  'huoguang-tao': 'EG-036',
  'artisan-elf': 'EG-037',
  'beiming-huo': 'EG-038',
  'pool-manager': 'EG-039',
  'summer-chime': 'EG-040',
  'detective': 'EG-041',
};

export const ELF_GROUP_EFFECTS: Readonly<Record<string,{description:string; ops:readonly string[]}>> = {
  alien: {description:'異能通用特質須有此標籤。戰鬥中被視為異能另有條件。',ops:['alien','defeated_alien','alien_category']},
  'elf-king': {description:'技能原有精靈王特權時，攻擊克制倍率由微弱轉為普通。',ops:['no_resist']},
  'chaos-apostle': {description:'持有無序星魂使徒專屬特質時，對異能精靈增傷及擊敗事件按該特質結算。',ops:['alien','damage_scale','defeated_alien','vanish_defeated']},
  'dragon-soul': {description:'龍魂狀態由各精靈自身效果建立。團體歸屬和龍魂狀態可分別查詢。',ops:['dragon_soul']},
  extra: {description:'戰鬥中召喚的額外精靈身分，可與召喚及召喚物存活查詢搭配。',ops:['summon_extra_elf','summoned_extra_alive']},
};

const groupsById = new Map(ELF_GROUPS.map(group => [group.id,group]));
const groupsByCode = new Map(Object.entries(ELF_GROUP_CODES).map(([id,code])=>[code,id]));
export function resolveElfGroupId(id: string): string {
  return groupsByCode.get(id) ?? id;
}

export function elfGroupDefinition(id: string): ElfGroupDefinition | undefined {
  return groupsById.get(resolveElfGroupId(id));
}

export function validElfGroupId(id: unknown): id is string {
  return typeof id==='string' && (!!elfGroupDefinition(id) || /^custom:(?:group|origin|special):[^\s].{0,99}$/u.test(id));
}

export const ELF_GROUP_TARGETS = {self:'自身',opp:'對手',defeated:'被擊敗的精靈'} as const;
export function elfGroupCondition(id: string, target:keyof typeof ELF_GROUP_TARGETS='self') {
  const groupId = resolveElfGroupId(id);
  return {c:'elf_group',p:{id:groupId,target},label:`${ELF_GROUP_TARGETS[target]}屬於${elfGroupDefinition(groupId)?.name ?? groupId}`};
}

const ALLIANCE_MEMBERS = new Set(['雷伊', '普通雷伊', '蓋亞', '滅戰神決蓋亞', '卡修斯', '聖地卡修斯', '布萊克', '繆斯']);
const ALLIANCE_SOURCE_IDS = new Set(['70', '261', '4766', '798', '3568']);
const ALLIANCE_PROJECT_IDS = new Set(['5005', '5015', '5029', '7070', '707070', '5041', '5043', '5053']);
// 依專案已核對的特權與使用者指定成員。
const KING_PRIVILEGE_HOLDERS = new Set(['5012', '5013', '5014', '5015', '5016', '5018', '5028', '5034', '5035', '5038', '5041', '5049']);
const kingPrivilege = (elf: Partial<Elf>) => KING_PRIVILEGE_HOLDERS.has(String(elf.id))
  || [...(elf.skills ?? []), ...(elf.skillPool ?? [])].some(skill =>
    /精[靈灵]王特[權权]/.test(skill.description ?? ''));

const verifiedSkinOwners: Readonly<Record<string, number>> = {
  'oscar-genesis': 3425, // Seer API pet_skin/599
  'rey-thunder-dragon-v1': 70,
  'zhakesi-fear': 4762,
  'zhakesi-wrath': 4762,
  'zhakesi-greed': 4762,
};
const APOSTLES = new Set(['5022', '5023', '5026']);
const DRAGON_SOUL = new Set(['5021', 'arena_12', 'arena_13', 'arena_14', 'arena_15', 'arena_16']);

function defaultAlienGroup(elf: Partial<Elf>): boolean {
  const identity = elf.illusion?.original ?? elf;
  return !!identity.isAlienElf || identity.category === '異能精靈' || APOSTLES.has(String(elf.id));
}

/** 只有實際持有此標籤的個體可以啟用異能通用特質；手動移除優先於舊身分。 */
export function hasAlienGroup(elf: Partial<Elf>): boolean {
  return !elf.isExtra && (elf.groupIds?.includes('alien') ?? defaultAlienGroup(elf));
}

export function activeAlienTrait(elf: Partial<Elf>) {
  return hasAlienGroup(elf) ? elf.alienTraits?.alienTrait : undefined;
}

export function borrowedAlienTraits(owner: Elf, source: Elf): Elf['alienTraits'] {
  const traits = source.alienTraits;
  return traits?.alienTrait && !(hasAlienGroup(owner) && hasAlienGroup(source)) ? { ...traits, alienTrait: undefined } : traits;
}

const bodyOwner = (path?: string) => path?.match(/\/seer\/body\/(\d+)\.png$/)?.[1];

/** 合併預設外觀與全部已登記皮膚；切換使用中的皮膚不改變團體。 */
export function suggestedElfGroupIds(elf: Partial<Elf>): string[] {
  if (elf.isExtra) return ['extra'];
  const skins = elf.id && elf.name ? availableElfSkins({ id: elf.id, name: elf.name }) : [];
  const sources = [DEFAULT_ART_SOURCE[String(elf.id)], elf.seerId, bodyOwner(elf.path),
    ...skins.map(skin => verifiedSkinOwners[skin.id] ?? bodyOwner(skin.body))];
  const sourceIds = [...new Set(sources.map(value => Number(value) === 1400599 ? 3425 : Number(value)))];
  const ids = sourceIds.flatMap(id => SEER_GROUP_IDS[id] ?? []);
  if (kingPrivilege(elf)) ids.push('elf-king');
  if (defaultAlienGroup(elf)) ids.push('alien');
  if (DRAGON_SOUL.has(String(elf.id))) ids.push('dragon-soul');
  if (ALLIANCE_PROJECT_IDS.has(String(elf.id)) || sourceIds.some(id => ALLIANCE_SOURCE_IDS.has(String(id))) || ALLIANCE_MEMBERS.has(elf.name ?? '')) {
    ids.push('battle-alliance');
  }
  if (APOSTLES.has(String(elf.id))) ids.push('chaos-apostle');
  if (elf.name === '皮皮' || sourceIds.includes(10)) ids.push('planet-klose');
  return [...new Set(ids)];
}

/** 查詢實際團體歸屬。幻化期間仍用原持有者的標籤。 */
export function hasElfGroup(elf: Partial<Elf> | null | undefined, group: string): boolean {
  if (!elf) return false;
  const id = resolveElfGroupId(group);
  if (id==='extra') return elf.isExtra===true;
  if (id==='alien') return hasAlienGroup(elf);
  return (elf.isExtra ? [] : (elf.groupIds ?? suggestedElfGroupIds(elf))).includes(id)
    || !!elf.groupTags?.some(tag=>tag.id===id && id.startsWith('custom:'));
}

export function elfGroups(elf: Partial<Elf>): ElfGroupDefinition[] {
  const ids = new Set(elf.isExtra ? ['extra'] : (elf.groupIds ?? suggestedElfGroupIds(elf)));
  return [...ELF_GROUPS.filter(group => ids.has(group.id) && (group.id !== 'extra' || elf.isExtra)), ...(elf.groupTags ?? [])];
}

export const ELF_GROUP_KIND_LABEL = { group: '團體', origin: '出身', special: '特殊' } as const;
