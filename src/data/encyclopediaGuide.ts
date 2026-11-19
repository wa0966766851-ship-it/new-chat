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
  { id: 'skill', title: '技能與選擇', hint: '技能類型、PP、先制與可選條件' },
  { id: 'object', title: '對象與狀態', hint: '能力等級、對象與特殊單位' },
  { id: 'conflict', title: '判定交鋒', hint: '常見效果互相衝突時的結果' },
  { id: 'diff', title: '規則差異', hint: '本專案規則與官方不同或待確認之處' },
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
  // 2026-11-16：補入官方名詞（以本專案用語為主；不同處列於「規則差異」）。
  { id: "round_start", group: 'timing', title: "回合開始時", tag: "時點", body: "回合正式開始的時點；位於雙方先後手判斷之前、登場之後。雙方同時擁有此時點效果時，本專案固定 P1 先、P2 後（官方為房主方先，見規則差異）。" },
  { id: "round_end", group: 'timing', title: "回合結束時", tag: "時點", body: "「戰鬥階段結束／中斷」之後的時點；以回合計數的效果於此減少 1 回合。" },
  { id: "on_enter", group: 'timing', title: "登場時", tag: "時點", body: "精靈來到場上時觸發。戰鬥開始雙方首發依 P1、P2 順序；回合中切換則在切換當下觸發。" },
  { id: "this_round", group: 'timing', title: "當回合", tag: "持續", body: "與「1 回合」基本同義；以「當回合」描述的效果不會因後出手而延長 1 回合。" },
  { id: "turn_effect_extend", group: 'timing', title: "回合類效果延長", tag: "後出手", body: "後出手獲得的回合類效果若當回合無法觸發，回合數+1（例：2 回合內對手攻擊技能無效）；當回合仍能觸發者不延長（例：4 回合內自身免疫異常）。一開始就沒獲得的效果不延長。精靈下場時回合類效果重置。" },
  { id: "turn_effect_owner", group: 'timing', title: "回合類效果的綁定對象", tag: "主語", body: "依效果主語判斷綁定「自身」或「對手」：「n 回合內對手攻擊技能無效」主語為對手；「n 回合內令對手攻擊技能無效」主語為自身。" },
  { id: "damage_types", group: 'damage', title: "傷害類型", tag: "分類", body: "技能傷害（紅）、固定傷害（粉）、百分比傷害（粉）、真實傷害（白）。技能傷害再分攻擊傷害與屬性傷害；攻擊傷害再分物理與特殊。" },
  { id: "attack_damage", group: 'damage', title: "攻擊傷害", tag: "技能傷害", body: "攻擊技能生效時結算一次；被免疫、無效、落空時攻擊傷害為 0。受雙方攻防與克制倍數影響。" },
  { id: "type_damage", group: 'damage', title: "屬性傷害（系別傷害）", tag: "直傷", body: "屬性技能造成的系別傷害（例：使對手直接受到 260 點電系攻擊傷害）；屬技能傷害，不涉及攻防，但受克制與微弱影響。本專案文字統一寫「X點X系技能傷害」。" },
  { id: "non_true", group: 'damage', title: "非真實傷害", tag: "對立概念", body: "真實傷害以外的所有傷害類型。" },
  { id: "true_bench", group: 'diff', title: "真實傷害（場下）", tag: "差異", body: "本專案：真實傷害附加於不在場精靈時照常結算，可致死（官方會保留 1 點體力，見規則差異）。" },
  { id: "damage_extra", group: 'damage', title: "傷害額外提升／減少", tag: "累乘", body: "本專案：每個「提升X%」各自相乘（帶「額外」者同樣獨立相乘）；描述寫明「加法結算」的同組先加總；減少同理。" },
  { id: "lethal", group: 'damage', title: "致死傷害", tag: "判定", body: "不低於受到傷害前體力的傷害；致死攻擊傷害＝不低於當前體力的攻擊傷害。" },
  { id: "feedback", group: 'defense', title: "反饋", tag: "異常", body: "將反饋方所處的異常依次附加給反饋對象；屬於附加異常，可被「免疫異常狀態」免疫。積木：異常複製（自身→對手）。" },
  { id: "attack_immunity", group: 'defense', title: "攻擊免疫效果", tag: "免疫", body: "以回合或次數免疫攻擊技能；被免疫的攻擊計為無效（不計為命中、無法造成技能傷害、附加效果失效），並觸發「技能無效時」。與「抵擋攻擊傷害」不同：抵擋只把傷害歸 0，技能仍算命中。" },
  { id: "skill_invalid", group: 'defense', title: "技能無效", tag: "無效", body: "攻擊技能：無法造成技能傷害且技能附加效果失效；屬性技能：屬性技能附加效果失效。不計為命中，固有效果照常，並觸發「技能無效時」。分攻擊技能無效、屬性技能無效與技能無效（兩類皆是）。" },
  { id: "on_skill_invalid", group: 'defense', title: "技能無效時", tag: "觸發", body: "技能無效、未命中、閃避、免疫受到的攻擊（含 BOSS 技能無效／封魔）時觸發；正常命中、抵擋攻擊傷害、附加效果失效不觸發。同一次行動只觸發一次。" },
  { id: "dodge", group: 'defense', title: "閃避", tag: "落空", body: "只有沒有必中的技能可被閃避；被閃避的攻擊計為無效（不計算傷害、不計為命中、附加效果失效），並觸發「技能無效時」。「n% 使對手攻擊落空」即閃避。" },
  { id: "sure_hit", group: 'defense', title: "必定命中", tag: "必中", body: "未通過命中判定或被閃避時仍以命中結算；不受命中等級下降影響。" },
  { id: "force_execute", group: 'defense', title: "強制執行", tag: "重新生效", body: "使原本無效、附加效果失效的魂印或技能重新視為命中並觸發附加效果；但因無效而歸 0 的攻擊傷害不會恢復。" },
  { id: "execute", group: 'flow', title: "執行", tag: "流程", body: "滿足條件（無則略過）、通過機率（無則略過）且未被中斷時開始觸發，直到觸發結束（無論成功與否）的整個過程。" },
  { id: "switch_rule", group: 'flow', title: "戰鬥切換", tag: "切換", body: "切換登場的精靈本回合無法出手，且默認對手先出手。" },
  { id: "potion_kinds", group: 'flow', title: "藥劑分類", tag: "道具", body: "體力藥劑、PP 藥劑、狀態解除藥劑；部分魂印可干擾藥劑（反轉為扣血、令恢復失效等）。" },
  { id: "revive", group: 'flow', title: "復活", tag: "重生", body: "重置體力與 PP，與「重生」同義。" },
  { id: "extra_action", group: 'flow', title: "額外行動", tag: "追加", body: "行動結束後依魂印或技能追加的一次行動；不占技能欄、不扣 PP、沒有先制。主動造成技能傷害的額外行動登記為具名「額外行動技能」（名稱與系別），列在精靈介紹的技能頁。" },
  { id: "action_phase", group: 'flow', title: "行動階段", tag: "時點", body: "戰鬥階段中雙方各有一個行動階段，拆為行動開始、行動時、行動後、行動結束 4 個時點。" },
  { id: "instant_kill", group: 'flow', title: "秒殺", tag: "歸零", body: "使目標體力歸 0 的效果，不經傷害結算；BOSS 特性「疾行」與部分效果可免疫。" },
  { id: "expel", group: 'flow', title: "驅逐", tag: "強制換下", body: "將對手當前精靈強制換成背包中隨機另一隻存活精靈；無其他存活精靈時不觸發。" },
  { id: "banish", group: 'flow', title: "放逐", tag: "禁止上場", body: "對手背包中的精靈無法主動切換上場（本專案＝對手全隊無法主動切換）；陣亡後的強制換人不受影響。積木：放逐。" },
  { id: "vanish", group: 'flow', title: "消逝", tag: "移除", body: "失去全部體力上限，之後視為不存在於本場戰鬥。" },
  { id: "abolish", group: 'flow', title: "廢除", tag: "一次性", body: "主動使魂印或技能本場完全失效，換取其他效果；之後無法再使用。" },
  { id: "unseal", group: 'flow', title: "解封", tag: "第五技能", body: "技能初始不可選（選招顯示「尚未解封」），滿足條件解封後本場可選，多為第五技能。積木：解封。" },
  { id: "skill_kinds", group: 'skill', title: "技能類型", tag: "攻擊／屬性", body: "攻擊技能（物理、特殊）與屬性技能；物理受攻擊／防禦影響，特殊受特攻／特防影響。" },
  { id: "stab", group: 'skill', title: "本系加成", tag: "+50%", body: "使用與自身系別相同（雙屬性含兩個單屬性）的攻擊技能，傷害額外提升 50%；屬性技能系別視為獨立系別。" },
  { id: "pp_rule", group: 'skill', title: "技能次數（PP）", tag: "選擇", body: "每次使用一般消耗 1 點；PP 為 0 時無法選擇。本專案選招判定由單一函式負責，戰鬥畫面、AI 與引擎一致，並顯示不可選原因。" },
  { id: "pp_unlimited", group: 'skill', title: "不受PP值限制", tag: "0PP 可選", body: "PP 為 0 時仍視為合法技能可選擇。形式包含 PP 消耗反轉、PP 無限、PP 消耗替代、限定回合內不受限制、單一技能不受限制等。" },
  { id: "priority", group: 'skill', title: "技能先制／精靈先制", tag: "出手順序", body: "雙方都選合法技能時，技能先制轉為精靈先制；先制高者先出手，相同比速度。精靈先制維持到回合結束。" },
  { id: "fifth_skill", group: 'skill', title: "第五技能", tag: "獨立欄位", body: "額外開啟的技能欄位，開啟後強制攜帶，無法與一般技能交換。本專案第五技能與一般技能使用同一套可選判定。" },
  { id: "convert_skill", group: 'skill', title: "轉化技能", tag: "PP沿用", body: "技能轉化為其他技能時，類型、系別、威力、先制、效果都可能改變，PP 沿用原技能並正常消耗。本專案：畫面預設顯示轉化後技能（循環鈕暫看原技能），效果以兩框顯示；實際效果＝轉化前固有效果＋轉化後固有效果＋轉化後附加效果。" },
  { id: "copy_skill", group: 'skill', title: "複製技能", tag: "對手技能", body: "調用對手當回合使用的技能作為自身本回合技能（PP 扣原技能欄位）；轉化替換對手持有的技能，複製替換自身持有的技能。積木：複製技能。" },
  { id: "invoke_skill", group: 'skill', title: "調用技能", tag: "外殼", body: "主技能作為外殼：使用外殼時改以指定技能的系別、類型、威力與效果結算，PP 扣外殼。與複製技能同一套判定（複製＝改用對手當回合技能）。積木：調用技能。" },
  { id: "first_slot", group: 'skill', title: "1號位技能／首位技能", tag: "位置", body: "1 號位＝配置的第一個一般技能（第五技能右側）；首位技能＝從 1 到 5 號位第一個符合條件者，無則為 1 號位。" },
  { id: "stat_value", group: 'object', title: "能力值", tag: "面板", body: "體力、攻擊、防禦、特攻、特防、速度六項面板數值；一般不隨回合變化，除非效果主動調整。" },
  { id: "stat_stage", group: 'object', title: "能力等級", tag: "±6", body: "攻擊、防禦、特攻、特防、速度、命中 6 項，-6～+6。攻防等級每 +1 提升 50%；下降呈反比（-2 為 50%）。命中 -1～-3 每級 -15%，-4～-6 每級 -10%。" },
  { id: "boost_invalid", group: 'object', title: "能力提升效果失效", tag: "不參與計算", body: "能力等級不再參與能力值計算（本專案目前作用於傷害公式的攻防等級），但仍算處於能力提升、仍計入等級計數。積木：能力提升效果失效。" },
  { id: "faith", group: 'object', title: "信仰對象", tag: "狂信", body: "無對象為每隻精靈恆有的規則屬性；狂信將對方當前在場精靈設為信仰對象，自身為對手信仰對象時無法行動。" },
  { id: "extra_elf", group: 'object', title: "額外精靈", tag: "不占欄位", body: "由技能或魂印召喚、獨立於出戰背包外的單位；不參與常規切換與勝負計數，陣亡時被消逝清除。" },
  { id: "support", group: 'object', title: "支援", tag: "場下效果", body: "存活的不在場精靈為在場精靈提供的效果。" },
  { id: "temp_maxhp", group: 'object', title: "臨時體力上限", tag: "下場消失", body: "維持一段時間後在特定時點消失的體力上限；未註明時於下場時消失。積木：體力上限（臨時）。" },
  { id: "reach", group: 'object', title: "達到", tag: "≥", body: "測定數值大於或等於閾值即計為達到。" },
  { id: "cf_surehit_invalid", group: 'conflict', title: "必中 vs 技能無效", tag: "無效優先", body: "必中只讓技能不會落空（不受命中判定與閃避影響）。技能無效時技能不計為命中、取消原本傷害、附加效果失效，只觸發固有效果；必中不改變這個結果。攻擊免疫同樣令攻擊計為無效，除非攻擊方有「無視攻擊免疫」。" },
  { id: "cf_kill_survive", group: 'conflict', title: "秒殺 vs 免死", tag: "依免死條件", body: "秒殺直接把體力調為 0，不經傷害結算，不受增減傷、抗性、護盾護罩影響。持有「受到致死時保留體力」類魂印者依其條件保留體力；BOSS 特性「疾行」免疫秒殺。" },
  { id: "cf_pink_barrier", group: 'conflict', title: "固定／百分比傷害 vs 護罩", tag: "護罩先扣", body: "護罩抵擋固定與百分比傷害，扣完護罩才扣體力；真實傷害與攻擊傷害不受護罩影響（攻擊傷害由護盾抵擋）。吸取類效果的恢復量依實際扣除的體力計算。" },
  { id: "cf_additional_vs_invalid", group: 'conflict', title: "附加效果失效 vs 技能無效", tag: "兩者不同", body: "附加效果失效：技能照常使用（扣 PP、算命中、固有效果照常），只是🎯附加效果不生效，不觸發「技能無效時」。技能無效：技能不計為命中、取消傷害、只觸發固有效果，並觸發「技能無效時」。兩者都會正常消耗 PP。" },
  { id: "diff_tie", group: 'diff', title: "同速出手", tag: "差異", body: "官方：先制與速度都相同時房主方優先。本專案：預設 P1 先出手；有「被挑戰方」效果時改由該方優先。" },
  { id: "diff_round_start", group: 'diff', title: "回合開始結算順序", tag: "差異", body: "官方：房主方先結算。本專案：固定 P1 先、P2 後（P1 視為房主方）。" },
  { id: "diff_round_end", group: 'diff', title: "回合結束結算順序", tag: "待確認", body: "官方：獲得先手權的一方優先結算；雙方都不出手時由獲得先手權者優先。本專案目前固定 P1 先、P2 後。" },
  { id: "diff_status_duration", group: 'diff', title: "異常預設回合", tag: "專案規則", body: "官方多數未寫回合的異常依各精靈而定；本專案描述未寫回合數的異常一律 3 回合。" },
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
  { id: 'destiny_wheel', title: '命運之輪', tag: '抽卡禁選', entry: '首頁 → 命運之輪', summary: '雙方各抽 12 張卡，互禁後從剩下的卡挑 6 隻出戰。', rules: ['每池至少 1S＋3A＋2C，其餘混合', '預設禁用 3 隻（傳統），編隊頁保留卡池編號', 'C 級精靈帶攔截效果，登場或陣亡時觸發', 'S／A／B／C 分級由名單與種族值決定'] },
  { id: 'eclipse', title: '星蝕迴廊', tag: 'Roguelike', entry: '首頁 → 星際探索', summary: '六章隨機路網，沿途戰鬥、事件、商店與星爐，擊敗每章首領推進。', rules: ['節點：遭遇、夢魘（精英）、王座（首領）、異兆、商會、星爐、寶匣、祭壇、？', '生命制：開局永久生命 5，N3／N6／N9 各 −1（最低 2）', '難度 N0–N18，越高禁用上限越少', '蝕度累積會強化敵方；遺物與詛咒影響整局', '可用種子重現同一局；版本更新後失效的場景會自動回到地圖'] },
  { id: 'aegis_training', title: '精靈培養', tag: 'Aegis', entry: '編成 → 精靈詳情 → 培養', summary: '調整性格、學習力、符文抗性與技能配置。', rules: ['學習力總和有上限，可套用預設', '異常抗性預設 55%', '第五技能另行標記'] },
  { id: 'test_runner', title: '自動測試', tag: '工具', entry: '系統 → 自動測試', summary: '讓 AI 自動對戰，檢查效果是否正常觸發。', rules: ['可指定精靈與場次', '日誌與覆蓋報告可搜尋'] },
];

/** 條件積木與內部查詢的顯示名稱（OP_DISPLAY_NAMES 只收動作積木）。 */
export const CONDITION_DISPLAY_NAMES: Record<string, string> = {
  action_priority: '本次行動的先制等級', alien: '指定精靈被視為異能精靈', defeated_alien: '被擊敗者被視為異能精靈', elf_group: '精靈團體歸屬', atk_gap: '雙方攻擊數值差', chance: '機率判定',
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
