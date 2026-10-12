# 積木 op 寫入的狀態鍵與讀取端

自動產生：`node --import tsx scripts/audit_op_keys.ts`。只比對字串字面量；用變數組成的鍵不在此列，需人工檢查。
「無」表示整個 src 沒有其他地方出現這個鍵（含 runtime.ts 的其他 op）。死鍵候選 0 個，需逐一確認後修成接上讀取端，或刪除。

| op | 鍵 | 其他出現處 |
|---|---|---|
| immune_status_perm | `immuneStatusTurns` | battle/contextBuilders.ts、blocks/runtime.ts、components/BattleScreen.tsx |
| immune_statdown_turns | `immuneStatDownTurns` | battle/contextBuilders.ts、components/BattleScreen.tsx、data/elfProfiles/wuxuRegistry.ts |
| heal_equal | `vampireRatio` | battle/lifesteal.ts、battle/stateScopes.ts、blocks/runtime.ts |
| heal_equal | `vampireDamageTypesThisAction` | battle/lifesteal.ts、blocks/runtime.ts、components/BattleScreen.tsx |
| vampire | `vampireRatio` | battle/lifesteal.ts、battle/stateScopes.ts、blocks/runtime.ts |
| vampire | `vampireDamageTypesThisAction` | battle/lifesteal.ts、blocks/runtime.ts、components/BattleScreen.tsx |
| mercy | `mercyThisAction` | components/BattleScreen.tsx、effects/genericSkillText.ts |
| no_resist | `noResistedThisAction` | battle/skillTypeOverride.ts、components/BattleScreen.tsx、effects/elves/mogos/registry.ts |
| crit_now | `nextTurnCrit` | components/BattleScreen.tsx、effects/elves/puni/registry.ts、effects/elves/starlight-rus/registry.ts |
| dmg_taken_x2 | `damageTakenBoostTurns` | components/BattleScreen.tsx、effects/elves/keerhode/registry.ts、effects/elves/lisa/registry.ts |
| dmg_cap_turns | `incomingSkillDmgCapTurns` | components/BattleScreen.tsx、effects/genericSkillText.ts、tests/blocks.semantic.test.ts |
| prio_turns | `priorityBoostTurns` | blocks/custom.ts、components/BattleScreen.tsx、effects/elves/delu/registry.ts |
| immune_attack_count | `blockAttackCount` | battle/attackImmunity.ts、effects/elves/canglan/registry.ts、effects/elves/holy-miles/registry.ts |
| immune_attack_turns | `immuneAttackTurns` | battle/attackImmunity.ts、effects/elves/scarlett/registry.ts |
| invalid_turns | `attackSkillInvalidTurns` | components/BattleScreen.tsx、effects/elves/dixin/registry.ts、effects/elves/otherworld-rey/registry.ts |
| invalid_turns | `utilitySkillInvalidTurns` | components/BattleScreen.tsx、effects/elves/holy-miles/registry.ts、effects/elves/imperial-shield/registry.ts |
| no_switch | `noSwitchTurns` | effects/elves/odin/registry.ts、effects/elves/scarlett/registry.ts、effects/elves/zhakesi-fear/registry.ts |
| ignore_def_turns | `ignoreDef25Turns` | components/BattleScreen.tsx、effects/elves/starlight-rus/registry.ts |
| ignore_def_turns | `ignoreDefPercentTurns` | effects/elves/zhakesi-annihilation/registry.ts |
| attack_inflict_turns | `attackInflictStatus` | components/BattleScreen.tsx、effects/genericSkillText.ts |
| attack_inflict_turns | `attackInflictStatusTurns` | components/BattleScreen.tsx、effects/genericSkillText.ts |
| atk_sum_calc | `blkAtkSpatkSum` | components/BattleScreen.tsx、effects/elves/hamo/registry.ts、effects/elves/otherworld-rey/registry.ts |
| no_pos_prio_turns | `blkNoPosPrioTurns` | components/BattleScreen.tsx、effects/elves/holy-miles/registry.ts、tests/blocks.semantic.test.ts |
