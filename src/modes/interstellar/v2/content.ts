/** 星蝕回廊：章節、節點、詞綴、事件文本。數值見 engine.ts。 */

export interface ActDef { id: number; name: string; epithet: string; hue: string; accent: string; npc: number; }
/** hue／accent：該章的主色（地圖霧色、標題漸層） */
export const ACTS: ActDef[] = [
  { id: 1, name: "殘響星港", epithet: "沉船的鐘聲仍在響", hue: "#2dd4bf", accent: "#0f3d3a", npc: 4621 },
  { id: 2, name: "鏡蝕之海", epithet: "倒影比你先抵達", hue: "#a5b4fc", accent: "#1e1b4b", npc: 3808 },
  { id: 3, name: "灰燼聖堂", epithet: "祈禱已經燒完了", hue: "#f97316", accent: "#431407", npc: 4313 },
  { id: 4, name: "千眼回廊", epithet: "每一扇門後都有人在看", hue: "#c084fc", accent: "#3b0764", npc: 3870 },
  { id: 5, name: "虛空子宮", epithet: "這裡孕育的不是生命", hue: "#f472b6", accent: "#500724", npc: 4590 },
  { id: 6, name: "星蝕王座", epithet: "太陽背面，空無一人", hue: "#fbbf24", accent: "#1c1917", npc: 4940 },
];
export const FINAL_ACT = ACTS.length;

export type NodeKind = "combat" | "elite" | "boss" | "event" | "shop" | "rest" | "treasure" | "altar" | "mystery";
export const NODE_META: Record<NodeKind, { name: string; glyph: string; hint: string }> = {
  combat: { name: "遭遇", glyph: "⚔", hint: "一般戰鬥" },
  elite: { name: "夢魘", glyph: "☠", hint: "精英戰：帶詞綴，必掉遺物" },
  boss: { name: "王座", glyph: "♛", hint: "章節首領" },
  event: { name: "異兆", glyph: "✶", hint: "未知的相遇" },
  shop: { name: "瞳孔商會", glyph: "⚖", hint: "以賽爾豆、星晶交易" },
  rest: { name: "星爐", glyph: "♨", hint: "修復、復甦或淬鍊" },
  treasure: { name: "寶匣", glyph: "✧", hint: "擇一遺物" },
  altar: { name: "蝕之祭壇", glyph: "☾", hint: "以代價換取力量" },
  mystery: { name: "？", glyph: "?", hint: "踏入之前無從得知" },
};

export interface AffixDef { id: string; name: string; desc: string; stat?: Partial<Record<"hp" | "atk" | "def" | "spatk" | "spdef" | "speed", number>>; }
/** 敵方詞綴：stat 為面板倍率（開戰前），其餘為戰鬥效果（relicEffectRegistry 的 affix_*）。 */
export const AFFIXES: AffixDef[] = [
  { id: "affix_frenzy", name: "狂暴", desc: "攻擊傷害 +25%" },
  { id: "affix_armored", name: "堅甲", desc: "受到的攻擊傷害 −25%" },
  { id: "affix_regen", name: "再生", desc: "回合結束恢復 8% 最大體力" },
  { id: "affix_hex", name: "咒怨", desc: "回合開始 25% 令對手害怕" },
  { id: "affix_sapping", name: "汲魂", desc: "回合結束造成對手 5% 最大體力固定傷害" },
  { id: "affix_giant", name: "巨化", desc: "體力 +50%", stat: { hp: 1.5 } },
  { id: "affix_swift", name: "迅捷", desc: "速度 +30%", stat: { speed: 1.3 } },
  { id: "affix_keen", name: "銳利", desc: "攻擊、特攻 +20%", stat: { atk: 1.2, spatk: 1.2 } },
];
export const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map(a => [a.id, a]));

/** 蝕度門檻 */
export const ECLIPSE_STAGES = [
  { at: 0, name: "新月", desc: "一切如常。" },
  { at: 25, name: "眉月", desc: "敵人能力 +10%。" },
  { at: 50, name: "半蝕", desc: "精英多 1 個詞綴；戰鬥賽爾豆 +25%。" },
  { at: 75, name: "盈蝕", desc: "所有敵人帶詞綴；首領能力 +15%。" },
  { at: 100, name: "全蝕", desc: "每次移動全隊失去 5% 最大體力；獎勵 +50%。" },
];
export const eclipseStage = (e: number) => [...ECLIPSE_STAGES].reverse().find(s => e >= s.at)!;

/* ───────────── 事件 ───────────── */
export interface EventChoice {
  label: string;
  /** 代價／結果提示（介面小字） */
  hint?: string;
  /** 條件不符時顯示但不可選 */
  require?: (run: any) => string | null;
  /** 回傳結果文字；可透過 ops 修改局面 */
  apply: (ops: EventOps) => string;
}
export interface EventDef { id: string; title: string; npc: number; text: string; minAct?: number; choices: EventChoice[]; }

/** 事件可用的局面操作（由 engine 實作） */
export interface EventOps {
  run: any;
  dice: { chance(p: number): boolean; int(a: number, b: number): number; next(): number };
  beans(n: number): void;
  shards(n: number): void;
  potions(n: number): void;
  eclipse(n: number): void;
  healTeam(pct: number): void;
  hurtTeam(pct: number): void;
  restorePp(): void;
  relic(rarity: "common" | "rare" | "legendary" | "boss"): string;
  relicId(id: string): string;
  curse(): string;
  removeCurse(): string | null;
  empowerRandom(pct: number): string | null;
  recruitOffer(tier: "low" | "mid" | "high", count: number): void;
  battle(kind: "combat" | "elite", reward?: "relic" | "legendary"): void;
  reveal(): void;
  sacrifice(): string | null;
}

const needBeans = (n: number) => (run: any) => run.beans >= n ? null : `需要 ${n} 賽爾豆`;
const needShards = (n: number) => (run: any) => run.shards >= n ? null : `需要 ${n} 星晶`;
const needPotion = (run: any) => run.potions > 0 ? null : "沒有藥劑";
const needCurse = (run: any) => run.relics.some((id: string) => id.startsWith("curse_")) ? null : "沒有詛咒";

export const EVENTS: EventDef[] = [
  {
    id: "lighthouse", title: "低語的燈塔", npc: 4621,
    text: "霧裡亮著一盞燈。守燈人沒有臉，只有一圈火在原本該是頭的地方轉動。「燈油不夠了，」它說，「你要借我一點光，還是借我一點黑？」",
    choices: [
      { label: "添燈油", hint: "全隊恢復 30% 體力；蝕度 +6", apply: o => { o.healTeam(.3); o.eclipse(6); return "火焰舔過你的手指。隊伍的傷口在光裡慢慢合上，但影子變長了。"; } },
      { label: "吹熄它", hint: "蝕度 −12；全隊失去 12% 體力", apply: o => { o.eclipse(-12); o.hurtTeam(.12); return "黑暗湧回來的瞬間，有什麼從你們身上被抽走了。可是星空清楚了一些。"; } },
      { label: "離開", apply: () => "你沒有回頭。燈在背後熄了又亮。" },
    ],
  },
  {
    id: "pupil_merchant", title: "瞳孔商人", npc: 3870,
    text: "她的披風上縫滿了眼睛，每一隻都在估價。「好東西，便宜賣——只收賽爾豆，或者一點點你的未來。」",
    choices: [
      { label: "買下布包", hint: "120 賽爾豆：隨機稀有遺物", require: needBeans(120), apply: o => { o.beans(-120); return `布包裡是【${o.relic("rare")}】。一隻眼睛眨了眨，像是在笑。`; } },
      { label: "以星晶換藥", hint: "1 星晶：藥劑 +2", require: needShards(1), apply: o => { o.shards(-1); o.potions(2); return "兩瓶冒著冷光的藥劑。標籤上的字在你讀之前就換了。"; } },
      { label: "盯回去", hint: "蝕度 +5：獲得 60 賽爾豆", apply: o => { o.eclipse(5); o.beans(60); return "你看得太久。她丟下幾枚豆子，像打發乞丐，然後所有眼睛同時閉上。"; } },
    ],
  },
  {
    id: "mirror", title: "鏡中倒影", npc: 3808,
    text: "冰面一樣的鏡子懸在虛空。鏡裡的你們站得更直、傷得更少，而且正在等你做決定。",
    choices: [
      { label: "擁抱倒影", hint: "隨機一隻精靈能力 +12%；獲得鏡像詛咒", apply: o => { const n = o.empowerRandom(.12); const c = o.curse(); return `【${n ?? "無"}】與倒影重疊，力量灌進四肢。你身上多了【${c}】，從此每一步都有兩個回聲。`; } },
      { label: "擊碎鏡面", hint: "獲得 80 賽爾豆；蝕度 +5", apply: o => { o.beans(80); o.eclipse(5); return "碎片落成一地硬幣。每一片裡都還有一個你在看。"; } },
    ],
  },
  {
    id: "ash_sprites", title: "灰燼之靈的請求", npc: 4891,
    text: "一群煤球似的小東西擠在一起發抖。「冷……給一點暖暖的就好。」牠們盯著你的藥劑腰帶。",
    choices: [
      { label: "分一瓶藥劑", hint: "藥劑 −1：隨機稀有遺物", require: needPotion, apply: o => { o.potions(-1); return `牠們把藥喝光，吐出一個發燙的小東西：【${o.relic("rare")}】。`; } },
      { label: "驅趕牠們", hint: "精英戰：勝利得稀有遺物", apply: o => { o.battle("elite", "relic"); return "煤灰聚成一隻巨大的手。牠們不冷了。"; } },
      { label: "離開", apply: () => "小小的哭聲跟了你一段路，然後散成灰。" },
    ],
  },
  {
    id: "giant_bones", title: "沉睡的巨骸", npc: 4590,
    text: "一具比星艦還大的骸骨橫在航道上。肋骨間有東西在發光，也有東西在呼吸。",
    choices: [
      { label: "伸手去拿", hint: "60%：普通遺物；40%：遭遇戰", apply: o => { if (o.dice.chance(.6)) return `你摸到一個冰冷的東西——【${o.relic("common")}】。巨骸沒有醒。`; o.battle("combat"); return "骨縫裡睜開了一隻眼睛。"; } },
      { label: "繞行", hint: "蝕度 +3", apply: o => { o.eclipse(3); return "繞過去花了很久。你總覺得它在你背後翻了個身。"; } },
    ],
  },
  {
    id: "thousand_arms", title: "千臂賭桌", npc: 4432,
    text: "賭桌另一端坐著一位巫師，袖子裡伸出太多隻手。「押豆子，或押運氣。輸的人留下一點東西。」",
    choices: [
      { label: "押 100 賽爾豆", hint: "45%：贏 300；否則輸掉", require: needBeans(100), apply: o => { o.beans(-100); if (o.dice.chance(.45)) { o.beans(300); return "骰子停在你要的那面。巫師的每一隻手同時鼓掌。"; } return "骰子在桌上滾到第七面才停下。這顆骰子只有六面。"; } },
      { label: "押 1 星晶", hint: "50%：傳說遺物；否則得到詛咒", require: needShards(1), apply: o => { o.shards(-1); if (o.dice.chance(.5)) return `你贏了。他推來一個包著黑布的東西：【${o.relic("legendary")}】。`; return `你輸了。他微笑著把【${o.curse()}】縫進你的影子。`; } },
      { label: "起身離席", apply: () => "所有手同時停下來，看著你走。" },
    ],
  },
  {
    id: "eclipse_priest", title: "星蝕祭司", npc: 4557,
    text: "紅月下的祭司向你伸出手。「太陽終將被吞沒，你可以站在吞沒它的那一邊。」",
    choices: [
      { label: "接受祝福", hint: "傳說遺物＋詛咒；蝕度 +15", apply: o => { const r = o.relic("legendary"); const c = o.curse(); o.eclipse(15); return `她的指尖在你額上畫了一道。你得到【${r}】，也得到【${c}】。月亮紅得更深了。`; } },
      { label: "拒絕", hint: "蝕度 −6", apply: o => { o.eclipse(-6); return "她沒有生氣，只是把手收回袖子裡。「你會回來的。」" ; } },
    ],
  },
  {
    id: "lifepod", title: "漂流救生艙", npc: 4188,
    text: "一艘救生艙撞上你的船殼。艙門結霜，裡面有東西在敲。",
    choices: [
      { label: "打開艙門", hint: "從 3 隻精靈中擇一加入", apply: o => { o.recruitOffer("mid", 3); return "冷氣散去，裡面不只一個生命。"; } },
      { label: "拆解零件", hint: "獲得 90 賽爾豆", apply: o => { o.beans(90); return "敲擊聲停了。你告訴自己那只是金屬冷縮。"; } },
    ],
  },
  {
    id: "blood_spring", title: "血月泉", npc: 3474,
    text: "泉水是溫的，紅得像剛流出來。牧魂者坐在泉邊：「喝一口，就有一部分的你不會再死。」",
    choices: [
      { label: "讓一隻精靈飲下", hint: "隨機精靈能力 +10%；全隊失去 10% 體力", apply: o => { const n = o.empowerRandom(.1); o.hurtTeam(.1); return `【${n ?? "無"}】的瞳孔變成了泉水的顏色。其他夥伴打了個寒顫。`; } },
      { label: "裝瓶帶走", hint: "藥劑 +1", apply: o => { o.potions(1); return "瓶子在你手裡跳動，像一顆心。"; } },
    ],
  },
  {
    id: "silent_library", title: "無聲圖書館", npc: 4249,
    text: "書架高到看不見頂。每本書都寫著同一個名字——你的。館員把手指放在唇上。",
    choices: [
      { label: "閱讀", hint: "看穿本章所有「？」；蝕度 +8", apply: o => { o.reveal(); o.eclipse(8); return "你讀到了接下來的路。也讀到了自己的結局，但你決定忘記那一頁。"; } },
      { label: "偷走一本", hint: "隨機稀有遺物＋貪婪詛咒", apply: o => { const r = o.relic("rare"); o.relicId("curse_greed"); return `書在你懷裡變成了【${r}】。從此你看什麼都想要。`; } },
      { label: "安靜離開", apply: () => "館員點點頭，在你的書上翻過一頁。" },
    ],
  },
  {
    id: "chain_lord", title: "鎖魂領主的鎖鏈", npc: 3483, minAct: 2,
    text: "鐵鏈從四面八方收束到一個點，鎖著一個不停掙扎的影子。鎖頭上刻著：「解開者，代之。」",
    choices: [
      { label: "斬斷鎖鏈", hint: "精英戰：勝利得傳說遺物", apply: o => { o.battle("elite", "legendary"); return "鎖鏈斷裂的聲音像一聲嘆息。被鎖住的東西站了起來，向你行禮，然後撲了上來。"; } },
      { label: "加固鎖鏈", hint: "蝕度 −10；失去 50 賽爾豆", require: needBeans(50), apply: o => { o.beans(-50); o.eclipse(-10); return "你把豆子熔成新的鎖扣。影子安靜了，星空也安靜了一點。"; } },
    ],
  },
  {
    id: "bone_piper", title: "骨笛手", npc: 3005,
    text: "無常鬼吹著一支骨笛，曲子你聽過——在夢裡。「你身上纏著不屬於你的東西。我能吹走它，價格公道。」",
    choices: [
      { label: "吹走詛咒", hint: "80 賽爾豆：移除一個詛咒", require: r => needCurse(r) ?? needBeans(80)(r), apply: o => { o.beans(-80); const c = o.removeCurse(); return `笛聲裡，【${c}】像一條黑蛇從你影子裡游走。`; } },
      { label: "學這首曲子", hint: "獲得【骨笛】；蝕度 +6", apply: o => { o.relicId("bone_flute"); o.eclipse(6); return "你學會了。吹的時候，總有別的聲音在合奏。"; } },
      { label: "離開", apply: () => "曲子在你離開很久之後才停。" },
    ],
  },
  {
    id: "twin_moons", title: "雙月交匯", npc: 4642,
    text: "白月與黑月在你頭頂重疊。逆世之瞳低聲說：「選一個，另一個會記住你。」",
    choices: [
      { label: "白月", hint: "全隊恢復 40% 體力，技能 PP 全滿", apply: o => { o.healTeam(.4); o.restorePp(); return "月光像水一樣洗過每一道傷。黑月在你背後慢慢轉過臉。"; } },
      { label: "黑月", hint: "星晶 +2；蝕度 +12", apply: o => { o.shards(2); o.eclipse(12); return "黑月落下兩顆冰冷的結晶，落在你掌心，還在跳。"; } },
    ],
  },
  {
    id: "stopped_clock", title: "停擺的鐘", npc: 4620,
    text: "所有的鐘都停在同一刻。燭燈使者說，如果你願意，它可以把時間往回撥一點點。",
    choices: [
      { label: "往回撥", hint: "技能 PP 全滿；蝕度 −8", apply: o => { o.restorePp(); o.eclipse(-8); return "指針倒轉。你們回到了剛出發的那一刻——幾乎。"; } },
      { label: "往前撥", hint: "獲得 150 賽爾豆；蝕度 +10", apply: o => { o.beans(150); o.eclipse(10); return "時間快轉，你的口袋裝滿了未來才會賺到的豆子。未來少了一些。"; } },
    ],
  },
  {
    id: "night_parade", title: "百鬼夜行", npc: 3020, minAct: 2,
    text: "燈籠排成一條河，遊行的隊伍從你們身邊經過。領頭的王回過頭：「要一起走嗎？」",
    choices: [
      { label: "混入隊伍", hint: "兩件普通遺物＋詛咒", apply: o => { const a = o.relic("common"), b = o.relic("common"); const c = o.curse(); return `你跟著走了一段。離開時手裡多了【${a}】【${b}】，身上多了【${c}】。`; } },
      { label: "躲起來", hint: "全隊失去 10% 體力", apply: o => { o.hurtTeam(.1); return "隊伍經過時，冷氣割傷了每一個人。但沒有誰發現你們。"; } },
      { label: "攔住夜王", hint: "精英戰：勝利得稀有遺物", apply: o => { o.battle("elite", "relic"); return "燈籠一盞接一盞熄滅。夜王笑了。"; } },
    ],
  },
  {
    id: "moth_shrine", title: "蛾的祭壇", npc: 3623,
    text: "成千上萬的蛾圍著一個空的燈座。鬼面幽蝶停在上面：「把你最亮的東西放上來。」",
    choices: [
      { label: "獻上一隻精靈", hint: "失去一隻精靈：獲得傳說遺物", require: r => (r.team?.length ?? 0) > 1 ? null : "隊伍只剩一隻", apply: o => { const n = o.sacrifice(); const r = o.relic("legendary"); return `【${n}】走進蛾群，再也沒有出來。燈座上留下了【${r}】。`; } },
      { label: "獻上賽爾豆", hint: "150 賽爾豆：稀有遺物", require: needBeans(150), apply: o => { o.beans(-150); return `蛾群散開，燈座上是【${o.relic("rare")}】。`; } },
      { label: "什麼都不給", apply: () => "蛾群撲上來又散去，只帶走了你的一點體溫。" },
    ],
  },
  {
    id: "star_fragment", title: "墜落的星圖", npc: 2656,
    text: "一顆燃燒的星墜在甲板上，燒穿的洞裡是一張地圖，標記著你還沒去過的地方。",
    choices: [
      { label: "拾起星圖", hint: "獲得【星圖殘頁】", apply: o => { o.relicId("star_chart"); return "地圖燙手，但上面的路比你想的還清楚。"; } },
      { label: "用它點火取暖", hint: "全隊恢復 20% 體力", apply: o => { o.healTeam(.2); return "火燒得很亮。地圖上的路在火裡一條一條消失。"; } },
    ],
  },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));

/** 各類 NPC 立繪（SeerAPI 精靈全身圖 ID） */
export const NPC = { shop: 3870, rest: 4620, treasure: 2656, altar: 3580, boss: 2803, reward: 4642, draft: 4621, defeat: 4590, victory: 4940 };

/** 開局「契約詛咒」（難度詞條）：每個 +10% 經驗與戰鬥獎勵經驗 */
export const START_PACTS = [
  { id: "weak_body", name: "衰弱之契", desc: "我方體力 −20%" },
  { id: "strong_boss", name: "王權之契", desc: "首領多 1 個詞綴" },
  { id: "no_potions", name: "禁藥之契", desc: "初始藥劑 −2" },
  { id: "cost_recruit", name: "匱乏之契", desc: "商會精靈契約 +1 星晶" },
  { id: "high_gravity", name: "重力之契", desc: "我方速度 −15%" },
] as const;
