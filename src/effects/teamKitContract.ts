import type { Node } from './effectSystem.schema';
export const TEAM_KIT_TRIGGERS: Record<string, Node> = {
  team_battle_start:'battle_start', team_entrance:'opponent_entered', team_after_action:'after_action',
  team_round_end:'round_end', team_before_status:'before_status_apply',
  team_status_received:'on_status_received', team_defeated:'cthyaat_death',
};
