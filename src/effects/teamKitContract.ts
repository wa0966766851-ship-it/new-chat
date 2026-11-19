import type { Node } from './effectSystem.schema';
export const TEAM_KIT_TRIGGERS: Record<string, Node> = {
  team_before_damage:'before_damage', team_action_failed:'after_action',
  team_stat_changed:'stat_changed',
  team_damage_settled:'on_opponent_settlement',team_opponent_damage_settled:'on_opponent_settlement',
  team_modify_priority:'modify_priority',team_opponent_modify_priority:'modify_priority',team_skill_selected:'on_skill_selected',team_opponent_skill_selected:'on_skill_selected',
  team_action_phase_enter:'action_phase_enter',
  team_status_mechanic:'modify_status_mechanic',
  team_battle_start:'battle_start', team_entrance:'opponent_entered', team_after_action:'after_action',
  team_round_end:'round_end', team_before_status:'before_status_apply',
  team_status_received:'on_status_received', team_opponent_status_received:'on_status_received', team_defeated:'cthyaat_death',
  team_phase_end:'battle_phase_end', team_opponent_skill:'on_attacked',
  team_action_end:'after_action', team_skill_used:'on_skill_use',
};
