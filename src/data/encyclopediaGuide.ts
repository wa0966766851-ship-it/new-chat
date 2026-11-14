/**
 * 戰鬥百科整合資料（2026-11-14）：機制條目、玩法說明、條件積木名稱。
 * 「戰鬥機制」分頁與「總索引」共用本檔，不再把規則寫死在 JSX 裡。
 * 純資料，不參與戰鬥結算。
 */

export interface MechanicTopic {
  id: string;
  group: string;
  title: string;
  tag: string;
  body: string;
}

export const MECHANIC_GROUPS: { id: string; title: string; hint: string }[] = [
  { id: 'timing', title: '回合與時序', hint: '回合計數與判定條件' },
  { id: 'damage', title: '傷害與吸取', hint: '特殊傷害與粉字結算' },
  { id: 'defense', title: '防禦與反彈', hint: '傷害分類與防無限循環' },
  { id: 'scope', title: '對象與範圍', hint: '團隊標記與能力範圍' },
  { id: 'flow', title: '結算流程', hint: '出手、存活與回合限制' },
];

export const MECHANIC_TOPICS: MechanicTopic[] = [
  { id: 'turn_effect', group: 'timing', title: '回合類效果', tag: '核心時序', body: '由技能效果附加的、以回合為計數的未命名效果；後出手附加時，若當回合因此無法直接觸發收益，則回合數+1。' },
  { id: 'not_triggered', group: 'timing', title: '未觸發', tag: '判定', body: '前置行為的結果未能正確發生，包括不限於未通過機率判定、被免疫、被修改等。' },
  { id: 'changed', group: 'timing', title: '改變', tag: '判定', body: '屬性變化為與變化前不同的狀態才算改變；能力已達上限或下限、變化前後一致時，本次不算改變。' },
  { id: 'status_duration', group: 'timing', title: '真實回合持續', tag: '異常', body: '標記為「n 回合」的異常在經過 n 個完整回合結算後消退；控制類計時器在回合結束時遞減；轉化效果在消退瞬間觸發。描述未寫回合數的異常一律 3 回合。' },
  { id: 'fixed_damage', group: 'damage', title: '固定傷害', tag: '粉字傷害', body: '以固定點數表示的傷害類型，不受防禦與克制影響。' },
  { id: 'percent_damage', group: 'damage', title: '百分比傷害', tag: '比例扣血', body: '以分數、百分數表示的傷害類型（如最大體力的 1/3、20%）。' },
  { id: 'drain', group: 'damage', title: '吸取', tag: 'Drain', body: '附加對手傷害後恢復等量體力；搭配固定點數時為固定傷害，搭配比例時為百分比傷害。' },
  { id: 'true_damage', group: 'damage', title: '真實傷害', tag: '無視減免', body: '不受護盾、護罩與減傷影響的傷害類型；反彈時不會多附加一次。' },
  { id: 'shield', group: 'defense', title: '護盾', tag: '抵擋攻擊傷害', body: '抵消對手攻擊技能造成的攻擊傷害；無法抵擋固定、百分比或真實傷害。' },
  { id: 'barrier', group: 'defense', title: '護罩', tag: '抵擋粉傷', body: '抵擋固定傷害與百分比傷害等特殊傷害；真實傷害與攻擊傷害無法被護罩抵擋。' },
  { id: 'reflect', group: 'defense', title: '反彈', tag: '防死循環', body: '一種特殊的附加，被反彈的效果不會被再次反彈；反彈攻擊傷害不會再彈回自己，真實傷害不受此限但不會多附加一次。' },
  { id: 'all_stats', group: 'scope', title: '全屬性', tag: '六大能力', body: '攻擊、防禦、特攻、特防、速度、命中共 6 種能力等級（不含閃避與體力上限）。' },
  { id: 'team_scope', group: 'scope', title: '對方／己方', tag: '團隊範圍', body: '包含玩家本身與其所有精靈；綁定己方／對方的效果不視為綁定在任一單體精靈上結算。' },
  { id: 'battle_nodes', group: 'flow', title: '官方戰鬥節點', tag: '結算順序', body: '引擎依 1.1 戰鬥開始 → 2.x 回合開始與先手權 → 3.x 出手流程 → 死亡節點 → 5 回合結束 → 6.x 勝敗判定的順序執行；完整清單見「戰鬥節點」。' },
  { id: 'survival', group: 'flow', title: '免死與存活', tag: '存活規則', body: '「體力歸零時保留」只在免死窗口內有效；窗口過期後不再保留，體力為 0 即判定擊敗。' },
  { id: 'pass_turn', group: 'flow', title: '空過', tag: '防卡死', body: '所有操作都被封鎖時可空過本回合；可設定為自動空過或手動確認。' },
  { id: 'turn_limit', group: 'flow', title: '回合上限', tag: '巔峰', body: '巔峰賽滿 50 回合時，依存活精靈數判勝負（額外精靈不計）。' },
  { id: 'potion', group: 'flow', title: '藥劑', tag: '道具', body: '每瓶藥劑最多附加 2 種異常，同一類別最多 1 種；全部異常都至少有一種藥劑可附加。' },
];

export interface ModeGuide {
  id: string;
  title: string;
  tag: string;
  summary: string;
  rules: string[];
  entry: string;
}

export const MODE_GUIDES: ModeGuide[] = [
  { id: 'normal_6v6', title: '自由戰', tag: '6V6', entry: '首頁 → 對戰', summary: '雙方各帶 6 隻精靈，不禁選，打到一方全滅。', rules: ['可自由編隊與設定首發', '無回合上限', '可選 AI 或雙人操作'] },
  { id: 'solo_1v1', title: '單挑', tag: '1V1', entry: '首頁 → 對戰 → 單挑', summary: '只以首發精靈對戰。', rules: ['只出戰 1 隻', '無法切換精靈', '其餘規則同自由戰'] },
  { id: 'peak_6v6', title: '巔峰 6V6', tag: 'BP', entry: '首頁 → 對戰 → 巔峰 6V6', summary: '帶 12 隻進場，禁選後出戰 6 隻。', rules: ['預設禁用 3 隻，可調整', '禁選卡保留卡池編號', '滿 50 回合依存活精靈數判勝負'] },
  { id: 'peak_3v3', title: '巔峰 3V3', tag: 'BP', entry: '首頁 → 對戰 → 巔峰 3V3', summary: '帶至少 8 隻進場，禁選後出戰 3 隻。', rules: ['預設禁用 2 隻，可調整', '禁選卡保留卡池編號', '同樣適用回合上限'] },
  { id: 'destiny_wheel', title: '命運之輪', tag: '抽卡禁選', entry: '首頁 → 命運之輪', summary: '雙方各抽 12 張卡，互禁後從剩下的卡挑 6 隻出戰。', rules: ['每池至少 1S＋3A＋2C，其餘混合', '預設禁用 3 隻（原廠傳統），編隊頁保留卡池編號', 'C 級精靈帶攔截效果，登場或陣亡時觸發', 'S／A／B／C 分級由名單與種族值決定'] },
  { id: 'eclipse', title: '星蝕迴廊', tag: 'Roguelike', entry: '首頁 → 星際探索', summary: '六章隨機路網，沿途戰鬥、事件、商店與星爐，擊敗每章首領推進。', rules: ['節點：遭遇、夢魘（精英）、王座（首領）、異兆、商會、星爐、寶匣、祭壇、？', '生命制：開局永久生命 5，N3／N6／N9 各 −1（最低 2）', '難度 N0–N18，越高禁用上限越少', '蝕度累積會強化敵方；遺物與詛咒影響整局', '可用種子重現同一局；版本更新後失效的場景會自動回到地圖'] },
  { id: 'aegis_training', title: '精靈培養', tag: 'Aegis', entry: '編成 → 精靈詳情 → 培養', summary: '調整性格、學習力、符文抗性與技能配置。', rules: ['學習力總和有上限，可套用預設', '異常抗性預設 55%', '第五技能另行標記'] },
  { id: 'test_runner', title: '自動測試', tag: '工具', entry: '系統 → 自動測試', summary: '讓 AI 自動對戰，檢查效果是否正常觸發。', rules: ['可指定精靈與場次', '日誌與覆蓋報告可搜尋'] },
];

/** 條件積木與內部查詢的顯示名稱（OP_DISPLAY_NAMES 只收動作積木）。 */
export const CONDITION_DISPLAY_NAMES: Record<string, string> = {
  action_priority: '本次行動的先制等級', alien: '對手為異類精靈', atk_gap: '雙方攻擊數值差', chance: '機率判定',
  damage_blocked: '本次傷害被抵擋', dragon_soul: '龍魂狀態判定', either_turn_effect: '任一方有回合類效果', event_crit: '本次事件為致命一擊',
  event_hit: '本次事件命中', event_is_holder: '事件對象為持有者', event_status: '本次事件的異常種類', fail_kind: '技能失敗的原因',
  field_rounds: '場地已持續回合數', field_shield: '場上有護盾', first: '自身先出手', has_skill_invalid: '處於技能無效狀態',
  has_status: '處於指定異常', has_turn_effect: '有回合類效果', holder_active: '持有者在場', hp_ratio: '體力比例',
  hp_value: '體力數值', ignore_success: '不論技能成功與否', invalid: '效果被無效化', kill: '本次擊敗對手',
  last_amount: '前一效果的結算數值', last_damage_immune: '上次傷害被免疫', mark_count: '印記層數', mark_locked: '印記被鎖定',
  no_damage_kind: '未受到指定類型傷害', no_skill_dealt_previous: '上回合未造成技能傷害', no_skill_dmg: '本次未造成技能傷害',
  opp_down_kinds: '對手能力下降的種類數', opp_full_pp_skills: '對手PP全滿的技能數', opp_pp_changed: '對手PP有變化', opp_pp_sum: '對手PP總和',
  opp_pp_zero_skills: '對手PP為0的技能數', opp_used_skill: '對手已使用技能', owner_on_field: '擁有者在場', phase: '目前所處階段',
  player_state: '玩家狀態判定', pp_full: 'PP全滿', resource_crossed: '資源跨過門檻', selected_attack: '對手選擇了攻擊技能',
  self_up_kinds: '自身能力提升的種類數', sides_full_pp_skills: '雙方PP全滿的技能數', sides_lock_switch_effects: '雙方禁止切換的效果數', sides_pp_below_one: '雙方PP不足1的技能數',
  sides_pp_sum: '雙方PP總和', sides_priority_zero: '雙方先制皆為0', skill_kind: '技能類別（物理／特殊／屬性）', skill_slot: '技能欄位',
  stab: '本系加成', summoned_extra_alive: '召喚的額外精靈存活', timer_active: '計時效果生效中', types_equal: '雙方屬性相同',
};
