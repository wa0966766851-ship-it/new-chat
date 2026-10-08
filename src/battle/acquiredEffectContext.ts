import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { battleIdentity, isTeamRegistryKey } from './stateScopes';

/** 自身後續寫入優先於取得效果：解除時不能回滾自己新得到的同名旗標。 */
export function trackNativeRegistryWrite(elf: Elf, key: string, value: any, source?: string): Partial<Elf> | undefined {
  const illusion = elf.illusion, entry = illusion?.registryWrites?.[key];
  if (!illusion || !entry || source) return;
  return { illusion: { ...illusion, registryWrites: { ...illusion.registryWrites,
    [key]: { ...entry, before: value } } } };
}

/** 取得定義與持有者分離；self與本方active保持同一個即時視圖。
 * 不冒用目標ID、不複製目標印記，也不重播ON_ENTRANCE。
 * 舊handler的直接欄位寫入經過updateElf，不能寫在被丟棄的暫存物件上。 */
export function acquiredEffectContext(ctx: BattleEventContext): BattleEventContext {
  const source = ctx.self.illusion!.target;
  const key = ctx.self.illusion!.effectKey || source.name;
  const definition: Partial<Elf> = { name: source.name, soulMark: source.soulMark,
    trait: source.trait, alienTraits: source.alienTraits, kit: source.kit, illusion: undefined };
  const view = new Proxy({} as Elf, {
    get: (_t, prop) => Object.prototype.hasOwnProperty.call(definition, prop)
      ? definition[prop as keyof Elf] : ctx.self[prop as keyof Elf],
    set: (_t, prop, value) => {
      if (!['id', 'battleId', 'name', 'soulMark', 'trait', 'alienTraits', 'illusion'].includes(String(prop))) {
        ctx.updateElf(ctx.actor, { [prop]: value });
      }
      return true;
    },
    ownKeys: () => Reflect.ownKeys(ctx.self),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    has: (_t, prop) => prop in ctx.self,
  });
  const copy = Object.create(ctx);
  copy.illusionDepth = 1;
  copy.illusionEffectKey = key;
  Object.defineProperties(copy, {
    self: { get: () => view },
    activeP1: { get: () => ctx.actor === 'p1' && battleIdentity(ctx.activeP1) === battleIdentity(ctx.self) ? view : ctx.activeP1 },
    activeP2: { get: () => ctx.actor === 'p2' && battleIdentity(ctx.activeP2) === battleIdentity(ctx.self) ? view : ctx.activeP2 },
  });
  copy.setPlayerState = (name: string, value: any) => {
    const illusion = ctx.self.illusion;
    if (!illusion || (illusion.effectKey || illusion.target.name) !== key) return;
    // 明文的己方／指定下一隻狀態不能在解除時被回收。
    if (isTeamRegistryKey(name)) { ctx.setPlayerState(name, value, key); return; }
    const old = illusion.registryWrites?.[name];
    ctx.updateElf(ctx.actor, { illusion: { ...illusion, registryWrites: {
      ...illusion.registryWrites, [name]: { before: old ? old.before : ctx.getPlayerState(name), value },
    } } });
    ctx.setPlayerState(name, value, key);
  };
  return copy;
}

/** 僅回復取得效果寫入且仍由它持有的私有值，既存／後續自身值不可被清掉。
 * 已施加的N回合效果與陣營傳遞不是私有初始化，不在此盲目清除。 */
export function releaseAcquiredRegistry(ctx: BattleEventContext): void {
  for (const [key, entry] of Object.entries(ctx.self.illusion?.registryWrites || {})) {
    const current = ctx.getPlayerState(key);
    let matches = current === entry.value;
    if (!matches && current && entry.value && typeof current === 'object' && typeof entry.value === 'object') {
      try { matches = JSON.stringify(current) === JSON.stringify(entry.value); } catch { /* 不可序列化的舊私有值保留，不誤刪 */ }
    }
    if (matches) {
      ctx.setPlayerState(key, entry.before, ctx.self.illusion?.effectKey || ctx.self.illusion?.target.name);
    }
  }
}
