# 額外精靈 id 標準與通用事件入口（2026-10-31）

## id
- 額外精靈（`isExtra: true`）的 id 一律英文字母開頭，格式 `x_<小寫英數底線>`，不占用數字序號（5xxx）。
- 種類 id 登錄在 `src/utils/extraElf.ts` 的 `EXTRA_ELF_KINDS`（名稱 → 種類 id），`createExtraElf` 寫入 `extraKind`。
- 同隊同時只會有一隻的額外精靈（例：炫彩山神 `x_shancaishen`）：實例 id＝種類 id，召喚時傳 `id`。已死亡／消逝的同 id 實例，下次加入由 `addExtraElf` 原位換成新實例；存活者不重複加入。
- 可能並存多隻者：實例 id＝`<種類id>_<時間>_<亂數>`（舊的 `extra_<中文名>_…` 已廢止），以 `extraKind` 辨識種類。
- 新增額外精靈：先在 `EXTRA_ELF_KINDS` 登錄，不得使用數字或中文 id。

## 通用事件入口（`src/battle/extraElfKit.ts`）
額外精靈自己的 Kit（`elf.kit`，註冊於 `registerExtraElfKit`）由引擎通用派發，派發 frame：`ctx.self`＝額外精靈、`ctx.actor`＝其所在方、`ctx.kitOwner`＝額外精靈。
| 節點 | 時機 |
|---|---|
| `on_entered` | `addExtraElf` 完成後執行一次（隊友出戰不會重複觸發） |
| `ally_entered` | 任一精靈登場（`broadcastElfEntered`）；條件 `entered_not_owner` ＝同隊、非額外精靈、非召喚者（同名亦視為召喚者） |
| `self_fatal` | `killExtraElf` 在消逝前執行（進入死亡時） |

通用 op：`kill_owned_extra{id, ownerShield?:'gone', resetOwnerRounds?}`（召喚者令自己的額外精靈死亡）、`reset_field_rounds{side}`、`extra_die`、`extra_cure_self`、`extra_owner_shield{ratio}`、`extra_owner_status{status,turns}`。
`summon_extra_elf` 新增 `statSource:'highest_of_name'`＋`statName`＋`statMode:'total'|'each'`。
