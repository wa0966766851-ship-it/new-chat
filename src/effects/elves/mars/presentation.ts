import type { Elf } from '../../../types';
import type { EffectInstance } from '../../../data/effectCatalog';

/** 顯示專用；機甲不是星執／魔王咒怨，也不是一回合異常。不得建立戰鬥印記。 */
export const MARS_MECHA_CATALOG = {
  mars_mech_wall: { id: 'mars_mech_wall', badge: '⚙️', label: '堅壁機甲', categories: ['indicia'],
    color: 'bg-slate-700/60 text-cyan-300 border-cyan-500/50',
    describe: () => '堅壁機甲（魂印機制，非異常）：記錄並免疫解析的異常；回合開始附加最大體力⅓護盾與護罩，兩者存在時首次非真實傷害減半；回合結束恢復最大體力⅓並附加等量百分比傷害，盾罩消失可提前觸發；下場後保留。顯示啟動不代表所有分支已驗收。' },
  mars_mech_speed: { id: 'mars_mech_speed', badge: '⚡', label: '極速機甲', categories: ['indicia'],
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    describe: () => '極速機甲（當前組合）：技能先制額外+2；先出手時攻擊傷害結算前令對手全屬性-1，自身速度提升時翻倍；後出手時下2回合令對手先制效果失效並記錄附加的控制異常。場下支援、被挑戰方及記錄分支仍需逐句驗收。' },
  mars_mech_destroy: { id: 'mars_mech_destroy', badge: '💥', label: '毀滅機甲', categories: ['indicia'],
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    describe: () => '毀滅機甲（當前組合）：攻擊技能威力提升100%，每次使用額外提升10%，最高170%；出手後對手低於30%體力時消耗其所有體力及1點充能以提升自身六維30%；高於30%時消耗1點充能，附加對手最大體力30%百分比傷害並恢復等量體力。場下支援及精確結算仍需逐句驗收。' },
};

export function marsMechanismEffects(elf: Elf, registryState: Record<string, any> = {}): EffectInstance[] {
  if (elf.name !== '變革·馬爾修斯') return [];
  const mode = registryState.marsMechaMode ?? registryState.marsReformActiveMode;
  const active = ['speed', 'destroy', 'wall', 'defense', '堅壁', '極速', '毀滅'].includes(mode);
  const result: EffectInstance[] = [];
  if (registryState.marsShieldActive === true || active) result.push({ catalogId: 'mars_mech_wall', active: true });
  if (mode === 'speed' || mode === '極速') result.push({ catalogId: 'mars_mech_speed', active: true });
  if (mode === 'destroy' || mode === '毀滅') result.push({ catalogId: 'mars_mech_destroy', active: true });
  return result;
}
