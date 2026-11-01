// 5041 岳峙淵渟.卡修斯 測試共用：真實 DEFAULT_ELVES 的卡修斯（含魂印與技能 Kit）跑 headless 正式戰鬥。
import { createHarness } from './migrationHarness';

export async function createCassiusHarness() {
  const h = await createHarness();
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const base = DEFAULT_ELVES.find((x: any) => String(x.id) === '5041');
  const cassius = (o: { id?: string; hp?: number; speed?: number; pp?: Record<string, number> } = {}): any => {
    const e = structuredClone(base);
    e.battleId = o.id || 'cas'; e.id = e.battleId === 'cas' ? '5041' : e.id;
    if (o.hp) { e.maxHp = o.hp; e.currentHp = o.hp; e.calculatedStats = { ...e.calculatedStats, hp: o.hp }; }
    else e.currentHp = e.maxHp;
    if (o.speed) e.calculatedStats.speed = o.speed;
    e.statStages = {};
    return e;
  };
  const sk = (name: string, o: any = {}) => ({ name, category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '', ...o });
  const hit = (power = 60, o: any = {}) => sk('打', { category: '物理', power, ...o });
  /** 固定/百分比/真實傷害技能：以 Kit 精確扣血（不受暴擊、防禦影響）。 */
  const dmgSkill = (name: string, type: '固定' | '真實' | '百分比', flat: number) =>
    h.kitSkill(name, [{ op: 'dmg', p: { flat, type } }]);
  const foe = (id: string, hp: number, skills: any[], o: any = {}) => h.unit(id, hp, skills, { speed: 100, ...o });
  return { ...h, cassius, sk, hit, dmgSkill, foe, base };
}
export type CassiusHarness = Awaited<ReturnType<typeof createCassiusHarness>>;
