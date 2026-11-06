// 墜星的動作定義（骨骼軌道 + 光效軌道）。
// 全部以「來源立繪方向」撰寫 —— 角色朝畫面左，砲口朝左上。
// 播放器會依 facing:'left' 對 P1 做鏡射，所以這裡不要自己翻。
//
// 時間以「影格」為單位；fps 24。

const FPS = 24;

// ── 光效圖層 ──────────────────────────────────────────────
// 錨點一律用「來源像素座標」，渲染時再換算。muzzle = 砲口 (452,438)。
const MUZZLE = [452, 438];
const CORE = [800, 950];   // 身體能量核心（腰胸之間）
const WING_L = [430, 960];
const WING_R = [1180, 800];

/**
 * 特攻出招 sa：4.0s / 96 幀 / 命中第 58 幀（2.42s ≈ 60%）。
 * 分鏡：蓄能 → 後坐 → 開火 → 彈道 → 命中 → 餘波
 *
 * ★ 第一段緩動一律用 inOut 而不是 charge：charge 是 t³，起步速度接近 0，
 *   實測會讓第 1~3 幀完全靜止（相鄰影格變動率 0%），開頭看起來像卡住。
 *   蓄力的「慢」改用 inOut 前段 + 中段 keyframe 拉長來表達。
 */
export const SA = {
  name: 'sa',
  frames: 96,
  fps: FPS,
  hits: [58],
  pose: {
    // 全身：後坐與回穩。tx 正 = 往右（背離目標）
    root: [
      { t: 0, tx: 0, ty: 0, rot: 0 },
      { t: 20, tx: 6, ty: 2, rot: 0, ease: 'inOut' },
      { t: 38, tx: 20, ty: 4, rot: 0, ease: 'inOut' },
      { t: 46, tx: 34, ty: 6, rot: 0, ease: 'snap' },
      { t: 56, tx: 16, ty: 3, rot: 0, ease: 'out' },
      { t: 68, tx: 22, ty: 4, rot: 0, ease: 'inOut' },
      { t: 82, tx: 8, ty: 1, rot: 0, ease: 'inOut' },
      { t: 95, tx: 0, ty: 0, rot: 0, ease: 'inOut' },
    ],
    // 軀幹：後仰（rot 正 = 上半身往右倒）
    torso: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: -1.2, tx: 0, ty: 0, ease: 'inOut' },
      { t: 38, rot: 3.4, tx: 0, ty: 0, ease: 'inOut' },
      { t: 46, rot: 6.5, tx: 0, ty: 0, ease: 'snap' },
      { t: 54, rot: 2.0, tx: 0, ty: 0, ease: 'out' },
      { t: 64, rot: 4.2, tx: 0, ty: 0, ease: 'inOut' },
      { t: 78, rot: 1.0, tx: 0, ty: 0, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    // 頭：跟軀幹反向，視線一直咬住目標（往左看）
    head: [
      { t: 0, rot: 0 },
      { t: 20, rot: 1.6, ease: 'inOut' },
      { t: 38, rot: -2.4, ease: 'inOut' },
      { t: 46, rot: -4.6, ease: 'snap' },
      { t: 54, rot: -1.4, ease: 'out' },
      { t: 64, rot: -3.0, ease: 'inOut' },
      { t: 78, rot: -0.8, ease: 'inOut' },
      { t: 95, rot: 0, ease: 'inOut' },
    ],
    // 肩砲：蓄能往後拉、開火瞬間往前衝、之後大幅後坐震盪
    cannon: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: 2.2, tx: 14, ty: 4, ease: 'inOut' },
      { t: 38, rot: 3.6, tx: 22, ty: 6, ease: 'inOut' },
      { t: 46, rot: -6.0, tx: -34, ty: -8, ease: 'snap' },
      { t: 52, rot: 5.0, tx: 20, ty: 5, ease: 'out' },
      { t: 58, rot: -3.2, tx: -12, ty: -3, ease: 'inOut' },
      { t: 64, rot: 2.2, tx: 8, ty: 2, ease: 'inOut' },
      { t: 72, rot: -1.0, tx: -4, ty: -1, ease: 'inOut' },
      { t: 82, rot: 0.4, tx: 2, ty: 0, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    // 左浮游機：繞自身緩慢轉，蓄能時加速
    wingL: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: -8, tx: -8, ty: -4, ease: 'inOut' },
      { t: 38, rot: -14, tx: -14, ty: -7, ease: 'inOut' },
      { t: 46, rot: 10, tx: 18, ty: 6, ease: 'snap' },
      { t: 58, rot: -6, tx: -6, ty: -3, ease: 'out' },
      { t: 72, rot: 3, tx: 3, ty: 1, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    // 右浮游機：與左反向，做出「雙翼張合」
    wingR: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: 7, tx: 9, ty: -5, ease: 'inOut' },
      { t: 38, rot: 12, tx: 16, ty: -9, ease: 'inOut' },
      { t: 46, rot: -9, tx: -16, ty: 7, ease: 'snap' },
      { t: 58, rot: 5, tx: 6, ty: -3, ease: 'out' },
      { t: 72, rot: -2, tx: -2, ty: 1, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    // 頭後環：蓄能時收束（縮小），開火時炸開
    ringR: [
      { t: 0, sx: 1, sy: 1, rot: 0 },
      { t: 20, sx: 0.86, sy: 0.86, rot: 18, ease: 'inOut' },
      { t: 38, sx: 0.72, sy: 0.72, rot: 40, ease: 'inOut' },
      { t: 46, sx: 1.5, sy: 1.5, rot: -20, ease: 'snap' },
      { t: 58, sx: 1.12, sy: 1.12, rot: 12, ease: 'out' },
      { t: 72, sx: 1.02, sy: 1.02, rot: -4, ease: 'inOut' },
      { t: 95, sx: 1, sy: 1, rot: 0, ease: 'inOut' },
    ],
    // 披風：被後座力往後（右）扯
    cape: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: -2, tx: -4, ty: 0, ease: 'inOut' },
      { t: 38, rot: 4, tx: 10, ty: 2, ease: 'inOut' },
      { t: 46, rot: 11, tx: 26, ty: 6, ease: 'snap' },
      { t: 58, rot: 6, tx: 12, ty: 3, ease: 'out' },
      { t: 72, rot: 3, tx: 6, ty: 1, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    // 雙腿：後坐時撐住（前腿伸直、後腿彎）
    legL: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: 1.5, tx: -3, ty: 0, ease: 'inOut' },
      { t: 38, rot: 4, tx: -8, ty: 0, ease: 'inOut' },
      { t: 46, rot: 8, tx: -16, ty: 0, ease: 'snap' },
      { t: 58, rot: 4, tx: -8, ty: 0, ease: 'out' },
      { t: 72, rot: 2, tx: -4, ty: 0, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    legR: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 20, rot: -1, tx: 2, ty: 0, ease: 'inOut' },
      { t: 38, rot: -3, tx: 6, ty: 0, ease: 'inOut' },
      { t: 46, rot: -6, tx: 12, ty: 0, ease: 'snap' },
      { t: 58, rot: -3, tx: 6, ty: 0, ease: 'out' },
      { t: 72, rot: -1, tx: 2, ty: 0, ease: 'inOut' },
      { t: 95, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
  },
  fx: [
    // 砲口能量環：蓄能時從大收緊到小（起點就有微光，開頭才不會像靜止圖）
    { kind: 'ring', color: '#5fd0ff', radius: 130, width: 6, at: MUZZLE, track: [
      { t: 0, alpha: 0.12, scale: 1.7 },
      { t: 8, alpha: 0.55, scale: 1.35, ease: 'inOut' },
      { t: 24, alpha: 0.85, scale: 0.95, ease: 'inOut' },
      { t: 38, alpha: 1.0, scale: 0.5, ease: 'inOut' },
      { t: 44, alpha: 1.0, scale: 0.26, ease: 'charge' },
      { t: 46, alpha: 0, scale: 0.1, ease: 'snap' },
    ] },
    // 第二圈反向環，製造「雙環收束」
    { kind: 'ring', color: '#9be8ff', radius: 92, width: 4, at: MUZZLE, track: [
      { t: 0, alpha: 0.08, scale: 2.0 },
      { t: 12, alpha: 0.4, scale: 1.5, ease: 'inOut' },
      { t: 30, alpha: 0.8, scale: 0.85, ease: 'inOut' },
      { t: 42, alpha: 0.95, scale: 0.3, ease: 'charge' },
      { t: 46, alpha: 0, scale: 0.12, ease: 'snap' },
    ] },
    // 砲口蓄能光暈
    { kind: 'glow', color: '#4aa8ff', radius: 110, power: 2.2, at: MUZZLE, track: [
      { t: 0, alpha: 0.16, scale: 0.65 },
      { t: 20, alpha: 0.6, scale: 1.0, ease: 'inOut' },
      { t: 38, alpha: 1.0, scale: 1.35, ease: 'inOut' },
      { t: 45, alpha: 1.0, scale: 1.7, ease: 'charge' },
      { t: 46, alpha: 1.0, scale: 2.4, ease: 'snap' },
      { t: 54, alpha: 0.55, scale: 1.8, ease: 'out' },
      { t: 66, alpha: 0.2, scale: 1.2, ease: 'out' },
      { t: 80, alpha: 0.12, scale: 0.9, ease: 'inOut' },
      { t: 95, alpha: 0.16, scale: 0.65, ease: 'inOut' },
    ] },
    // 身體能量核心：蓄能時亮起
    { kind: 'glow', color: '#7a5cff', radius: 70, power: 2.4, at: CORE, track: [
      { t: 0, alpha: 0.18, scale: 1 },
      { t: 22, alpha: 0.55, scale: 1.2, ease: 'inOut' },
      { t: 38, alpha: 0.8, scale: 1.4, ease: 'inOut' },
      { t: 46, alpha: 0.35, scale: 0.95, ease: 'snap' },
      { t: 70, alpha: 0.22, scale: 1.05, ease: 'inOut' },
      { t: 95, alpha: 0.18, scale: 1, ease: 'inOut' },
    ] },
    // 浮游翼亮起
    { kind: 'glow', color: '#66d4ff', radius: 58, power: 2.6, at: WING_L, track: [
      { t: 0, alpha: 0.14, scale: 0.9 },
      { t: 24, alpha: 0.7, scale: 1.15, ease: 'inOut' },
      { t: 40, alpha: 0.95, scale: 1.3, ease: 'inOut' },
      { t: 50, alpha: 0.4, scale: 1.0, ease: 'out' },
      { t: 95, alpha: 0.14, scale: 0.9, ease: 'inOut' },
    ] },
    { kind: 'glow', color: '#66d4ff', radius: 52, power: 2.6, at: WING_R, track: [
      { t: 0, alpha: 0.14, scale: 0.9 },
      { t: 24, alpha: 0.65, scale: 1.12, ease: 'inOut' },
      { t: 40, alpha: 0.9, scale: 1.26, ease: 'inOut' },
      { t: 50, alpha: 0.38, scale: 1.0, ease: 'out' },
      { t: 95, alpha: 0.14, scale: 0.9, ease: 'inOut' },
    ] },
    // 開火閃光：第 46 幀炸開，兩幀後最亮
    { kind: 'glow', color: '#ffffff', radius: 200, power: 1.6, at: MUZZLE, track: [
      { t: 0, alpha: 0 }, { t: 45, alpha: 0 },
      { t: 46, alpha: 1.0, scale: 1.6, ease: 'snap' },
      { t: 49, alpha: 0.85, scale: 2.2, ease: 'out' },
      { t: 54, alpha: 0, scale: 2.6, ease: 'out' },
    ] },
    // 彈道光束：往左射（角色朝左）
    { kind: 'beam', color: '#bfefff', length: 900, width: 150, dir: 'left', at: MUZZLE, track: [
      { t: 0, alpha: 0 }, { t: 45, alpha: 0 },
      { t: 46, alpha: 1.0, scale: 0.5, ease: 'snap' },
      { t: 50, alpha: 0.95, scale: 1.0, ease: 'out' },
      { t: 56, alpha: 0.7, scale: 1.05, ease: 'out' },
      { t: 62, alpha: 0, scale: 1.1, ease: 'out' },
    ] },
    // 砲口粒子：開火噴出
    { kind: 'spark', color: '#d8f6ff', count: 40, spread: 260, speed: 1.7, seed: 5026, at: MUZZLE, track: [
      { t: 0, alpha: 0 }, { t: 45, alpha: 0 },
      { t: 46, alpha: 1.0, scale: 1, ease: 'snap' },
      { t: 58, alpha: 0.5, scale: 1.3, ease: 'out' },
      { t: 72, alpha: 0, scale: 1.5, ease: 'out' },
    ] },
  ],
};

/** 持砲戒備：3 秒一次輕微呼吸。腳底不漂移、砲不脫離雙手、後環不自轉。
 *  待機不以「一直看得出在動」為目標；此軌道不代表出招姿勢已重製完成。 */
export const STANDBY = {
  name: 'standby',
  frames: 72,
  fps: FPS,
  loop: true,
  hits: [],
  pose: {
    root: [
      { t: 0, tx: 0, ty: 0 },
      { t: 71, tx: 0, ty: 0 },
    ],
    torso: [
      { t: 0, rot: 0 },
      { t: 30, rot: -0.18, ty: -1.5, ease: 'inOut' },
      { t: 42, rot: -0.18, ty: -1.5 },
      { t: 71, rot: 0, ty: 0, ease: 'inOut' },
    ],
    head: [
      { t: 0, rot: 0 },
      { t: 71, rot: 0 },
    ],
    // 原稿是雙手支撐持砲；與軀幹一起微動，不另加砲身旋轉。
    cannon: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 71, rot: 0, tx: 0, ty: 0 },
    ],
    // 裝置保持朝向，只做少量懸停，兩邊稍有時間差。
    wingL: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 32, rot: 0, tx: 0, ty: -2.5, ease: 'inOut' },
      { t: 71, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    wingR: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 39, rot: 0, tx: 0, ty: -2, ease: 'inOut' },
      { t: 71, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    // 原立繪的後環屬於待機構圖，不是必須不停運作的旋轉機構。
    ringR: [
      { t: 0, rot: 0, sx: 1, sy: 1 },
      { t: 71, rot: 0, sx: 1, sy: 1 },
    ],
    cape: [
      { t: 0, rot: 0, tx: 0 },
      { t: 39, rot: 0.25, tx: 0, ease: 'inOut' },
      { t: 71, rot: 0, tx: 0, ease: 'inOut' },
    ],
    legL: [
      { t: 0, rot: 0, ty: 0 },
      { t: 71, rot: 0, ty: 0 },
    ],
    legR: [
      { t: 0, rot: 0, ty: 0 },
      { t: 71, rot: 0, ty: 0 },
    ],
  },
  fx: [
    // 保留原稿裝置自身的藍光；待機不額外疊蓄力光暈。
  ],
};

/** 受擊 hited：0.33s / 8 幀。官方實測中位 0.33s。 */
export const HITED = {
  name: 'hited',
  frames: 8,
  fps: FPS,
  hits: [],
  pose: {
    root: [
      { t: 0, tx: 0, ty: 0 },
      { t: 1, tx: -20, ty: -4, ease: 'out' },
      { t: 3, tx: 10, ty: 2, ease: 'inOut' },
      { t: 5, tx: -5, ty: -1, ease: 'inOut' },
      { t: 7, tx: 0, ty: 0, ease: 'out' },
    ],
    torso: [
      { t: 0, rot: 0 },
      { t: 1, rot: -7, ease: 'out' },
      { t: 3, rot: 3, ease: 'inOut' },
      { t: 5, rot: -1.4, ease: 'inOut' },
      { t: 7, rot: 0, ease: 'out' },
    ],
    head: [
      { t: 0, rot: 0 },
      { t: 1, rot: 9, ease: 'out' },
      { t: 3, rot: -4, ease: 'inOut' },
      { t: 5, rot: 1.6, ease: 'inOut' },
      { t: 7, rot: 0, ease: 'out' },
    ],
    cannon: [
      { t: 0, rot: 0, tx: 0 },
      { t: 1, rot: 5, tx: -14, ease: 'out' },
      { t: 3, rot: -3, tx: 8, ease: 'inOut' },
      { t: 5, rot: 1, tx: -3, ease: 'inOut' },
      { t: 7, rot: 0, tx: 0, ease: 'out' },
    ],
    wingL: [
      { t: 0, rot: 0, tx: 0 },
      { t: 1, rot: 14, tx: 16, ease: 'out' },
      { t: 3, rot: -7, tx: -8, ease: 'inOut' },
      { t: 5, rot: 3, tx: 3, ease: 'inOut' },
      { t: 7, rot: 0, tx: 0, ease: 'out' },
    ],
    wingR: [
      { t: 0, rot: 0, tx: 0 },
      { t: 1, rot: -12, tx: 14, ease: 'out' },
      { t: 3, rot: 6, tx: -7, ease: 'inOut' },
      { t: 5, rot: -2, tx: 3, ease: 'inOut' },
      { t: 7, rot: 0, tx: 0, ease: 'out' },
    ],
    ringR: [
      { t: 0, rot: 0, sx: 1, sy: 1 },
      { t: 1, rot: -30, sx: 1.25, sy: 1.25, ease: 'out' },
      { t: 4, rot: 12, sx: 0.95, sy: 0.95, ease: 'inOut' },
      { t: 7, rot: 0, sx: 1, sy: 1, ease: 'out' },
    ],
    cape: [
      { t: 0, rot: 0 },
      { t: 1, rot: -9, ease: 'out' },
      { t: 4, rot: 4, ease: 'inOut' },
      { t: 7, rot: 0, ease: 'out' },
    ],
    legL: [{ t: 0, rot: 0 }, { t: 1, rot: -4, ease: 'out' }, { t: 4, rot: 2, ease: 'inOut' }, { t: 7, rot: 0 }],
    legR: [{ t: 0, rot: 0 }, { t: 1, rot: -3, ease: 'out' }, { t: 4, rot: 1.5, ease: 'inOut' }, { t: 7, rot: 0 }],
  },
  fx: [
    { kind: 'glow', color: '#ff5a5a', radius: 150, power: 2.6, at: [800, 900], track: [
      { t: 0, alpha: 0 }, { t: 1, alpha: 0.75, scale: 1.1, ease: 'out' },
      { t: 4, alpha: 0.25, scale: 1.35, ease: 'out' }, { t: 7, alpha: 0, scale: 1.5 },
    ] },
    { kind: 'spark', color: '#ffb0a0', count: 18, spread: 150, speed: 1.2, seed: 50261, at: [800, 900], track: [
      { t: 0, alpha: 0 }, { t: 1, alpha: 0.9, scale: 0.6, ease: 'out' },
      { t: 4, alpha: 0.4, scale: 1.1, ease: 'out' }, { t: 7, alpha: 0, scale: 1.3 },
    ] },
  ],
};

/** 第五技能「四象崩壞砲」：5.0s / 120 幀，命中第 72 幀。 */
export const ULTIMATE = {
  name: 'ultimate',
  frames: 120,
  fps: FPS,
  hits: [72],
  pose: {
    root: [
      { t: 0, tx: 0, ty: 0 },
      { t: 26, tx: -8, ty: -6, ease: 'inOut' },
      { t: 50, tx: 10, ty: 2, ease: 'inOut' },
      { t: 62, tx: 46, ty: 10, ease: 'snap' },
      { t: 74, tx: 22, ty: 5, ease: 'out' },
      { t: 90, tx: 30, ty: 6, ease: 'inOut' },
      { t: 108, tx: 10, ty: 2, ease: 'inOut' },
      { t: 119, tx: 0, ty: 0, ease: 'inOut' },
    ],
    torso: [
      { t: 0, rot: 0 },
      { t: 26, rot: -4.0, ease: 'inOut' },
      { t: 50, rot: 2.0, ease: 'inOut' },
      { t: 62, rot: 9.0, ease: 'snap' },
      { t: 74, rot: 3.0, ease: 'out' },
      { t: 90, rot: 5.5, ease: 'inOut' },
      { t: 108, rot: 1.5, ease: 'inOut' },
      { t: 119, rot: 0, ease: 'inOut' },
    ],
    head: [
      { t: 0, rot: 0 },
      { t: 26, rot: 5.0, ease: 'inOut' },
      { t: 50, rot: -3.0, ease: 'inOut' },
      { t: 62, rot: -6.5, ease: 'snap' },
      { t: 74, rot: -2.0, ease: 'out' },
      { t: 90, rot: -4.0, ease: 'inOut' },
      { t: 108, rot: -1.0, ease: 'inOut' },
      { t: 119, rot: 0, ease: 'inOut' },
    ],
    cannon: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 26, rot: 5.0, tx: 26, ty: 8, ease: 'inOut' },
      { t: 50, rot: 7.0, tx: 36, ty: 11, ease: 'inOut' },
      { t: 62, rot: -9.0, tx: -52, ty: -13, ease: 'snap' },
      { t: 70, rot: 7.0, tx: 28, ty: 7, ease: 'out' },
      { t: 78, rot: -4.5, tx: -16, ty: -4, ease: 'inOut' },
      { t: 86, rot: 3.0, tx: 11, ty: 3, ease: 'inOut' },
      { t: 96, rot: -1.4, tx: -5, ty: -1, ease: 'inOut' },
      { t: 108, rot: 0.5, tx: 2, ty: 0, ease: 'inOut' },
      { t: 119, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    wingL: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 26, rot: -16, tx: -16, ty: -8, ease: 'inOut' },
      { t: 50, rot: -26, tx: -24, ty: -12, ease: 'inOut' },
      { t: 62, rot: 18, tx: 28, ty: 10, ease: 'snap' },
      { t: 78, rot: -10, tx: -10, ty: -5, ease: 'out' },
      { t: 96, rot: 5, tx: 4, ty: 2, ease: 'inOut' },
      { t: 119, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    wingR: [
      { t: 0, rot: 0, tx: 0, ty: 0 },
      { t: 26, rot: 14, tx: 16, ty: -9, ease: 'inOut' },
      { t: 50, rot: 23, tx: 24, ty: -14, ease: 'inOut' },
      { t: 62, rot: -16, tx: -26, ty: 11, ease: 'snap' },
      { t: 78, rot: 9, tx: 10, ty: -5, ease: 'out' },
      { t: 96, rot: -4, tx: -4, ty: 2, ease: 'inOut' },
      { t: 119, rot: 0, tx: 0, ty: 0, ease: 'inOut' },
    ],
    ringR: [
      { t: 0, rot: 0, sx: 1, sy: 1 },
      { t: 26, rot: 90, sx: 0.7, sy: 0.7, ease: 'inOut' },
      { t: 50, rot: 200, sx: 0.5, sy: 0.5, ease: 'inOut' },
      { t: 62, rot: 250, sx: 2.2, sy: 2.2, ease: 'snap' },
      { t: 78, rot: 300, sx: 1.3, sy: 1.3, ease: 'out' },
      { t: 96, rot: 340, sx: 1.05, sy: 1.05, ease: 'inOut' },
      { t: 119, rot: 360, sx: 1, sy: 1, ease: 'inOut' },
    ],
    cape: [
      { t: 0, rot: 0, tx: 0 },
      { t: 26, rot: -5, tx: -8, ease: 'inOut' },
      { t: 50, rot: 8, tx: 18, ease: 'inOut' },
      { t: 62, rot: 16, tx: 40, ease: 'snap' },
      { t: 78, rot: 8, tx: 18, ease: 'out' },
      { t: 96, rot: 4, tx: 8, ease: 'inOut' },
      { t: 119, rot: 0, tx: 0, ease: 'inOut' },
    ],
    legL: [
      { t: 0, rot: 0, tx: 0 },
      { t: 26, rot: 3, tx: -6, ease: 'inOut' },
      { t: 50, rot: 5, tx: -10, ease: 'inOut' },
      { t: 62, rot: 11, tx: -24, ease: 'snap' },
      { t: 78, rot: 5, tx: -11, ease: 'out' },
      { t: 119, rot: 0, tx: 0, ease: 'inOut' },
    ],
    legR: [
      { t: 0, rot: 0, tx: 0 },
      { t: 26, rot: -2, tx: 3, ease: 'inOut' },
      { t: 50, rot: -4, tx: 7, ease: 'inOut' },
      { t: 62, rot: -8, tx: 17, ease: 'snap' },
      { t: 78, rot: -4, tx: 8, ease: 'out' },
      { t: 119, rot: 0, tx: 0, ease: 'inOut' },
    ],
  },
  fx: [
    { kind: 'ring', color: '#5fd0ff', radius: 170, width: 7, at: MUZZLE, track: [
      { t: 0, alpha: 0, scale: 2.2 },
      { t: 14, alpha: 0.5, scale: 1.9, ease: 'inOut' },
      { t: 40, alpha: 0.9, scale: 1.2, ease: 'inOut' },
      { t: 56, alpha: 1.0, scale: 0.55, ease: 'inOut' },
      { t: 61, alpha: 1.0, scale: 0.22, ease: 'inOut' },
      { t: 62, alpha: 0, scale: 0.1, ease: 'snap' },
    ] },
    { kind: 'ring', color: '#c9a3ff', radius: 120, width: 5, at: MUZZLE, track: [
      { t: 0, alpha: 0, scale: 2.6 },
      { t: 20, alpha: 0.42, scale: 2.0, ease: 'inOut' },
      { t: 46, alpha: 0.85, scale: 1.0, ease: 'inOut' },
      { t: 60, alpha: 0.95, scale: 0.35, ease: 'inOut' },
      { t: 62, alpha: 0, scale: 0.12, ease: 'snap' },
    ] },
    { kind: 'glow', color: '#4aa8ff', radius: 150, power: 2.2, at: MUZZLE, track: [
      { t: 0, alpha: 0.1, scale: 0.7 },
      { t: 26, alpha: 0.7, scale: 1.2, ease: 'inOut' },
      { t: 50, alpha: 1.0, scale: 1.7, ease: 'inOut' },
      { t: 61, alpha: 1.0, scale: 2.2, ease: 'inOut' },
      { t: 62, alpha: 1.0, scale: 3.4, ease: 'snap' },
      { t: 72, alpha: 0.6, scale: 2.4, ease: 'out' },
      { t: 88, alpha: 0.22, scale: 1.5, ease: 'out' },
      { t: 105, alpha: 0.1, scale: 1.0, ease: 'inOut' },
      { t: 119, alpha: 0.1, scale: 0.7, ease: 'inOut' },
    ] },
    { kind: 'glow', color: '#7a5cff', radius: 96, power: 2.3, at: CORE, track: [
      { t: 0, alpha: 0.16, scale: 1 },
      { t: 28, alpha: 0.7, scale: 1.3, ease: 'inOut' },
      { t: 50, alpha: 0.95, scale: 1.6, ease: 'inOut' },
      { t: 62, alpha: 0.4, scale: 1.0, ease: 'snap' },
      { t: 90, alpha: 0.22, scale: 1.1, ease: 'inOut' },
      { t: 119, alpha: 0.16, scale: 1, ease: 'inOut' },
    ] },
    { kind: 'glow', color: '#66d4ff', radius: 80, power: 2.6, at: WING_L, track: [
      { t: 0, alpha: 0.12, scale: 0.9 },
      { t: 30, alpha: 0.85, scale: 1.3, ease: 'inOut' },
      { t: 56, alpha: 1.0, scale: 1.5, ease: 'inOut' },
      { t: 66, alpha: 0.4, scale: 1.1, ease: 'out' },
      { t: 119, alpha: 0.12, scale: 0.9, ease: 'inOut' },
    ] },
    { kind: 'glow', color: '#66d4ff', radius: 72, power: 2.6, at: WING_R, track: [
      { t: 0, alpha: 0.12, scale: 0.9 },
      { t: 30, alpha: 0.8, scale: 1.28, ease: 'inOut' },
      { t: 56, alpha: 0.98, scale: 1.46, ease: 'inOut' },
      { t: 66, alpha: 0.38, scale: 1.1, ease: 'out' },
      { t: 119, alpha: 0.12, scale: 0.9, ease: 'inOut' },
    ] },
    { kind: 'glow', color: '#ffffff', radius: 260, power: 1.5, at: MUZZLE, track: [
      { t: 0, alpha: 0 }, { t: 61, alpha: 0 },
      { t: 62, alpha: 1.0, scale: 2.0, ease: 'snap' },
      { t: 66, alpha: 0.9, scale: 2.8, ease: 'out' },
      { t: 74, alpha: 0, scale: 3.2, ease: 'out' },
    ] },
    { kind: 'beam', color: '#cfefff', length: 1200, width: 210, dir: 'left', at: MUZZLE, track: [
      { t: 0, alpha: 0 }, { t: 61, alpha: 0 },
      { t: 62, alpha: 1.0, scale: 0.6, ease: 'snap' },
      { t: 67, alpha: 0.98, scale: 1.0, ease: 'out' },
      { t: 74, alpha: 0.7, scale: 1.06, ease: 'out' },
      { t: 84, alpha: 0, scale: 1.12, ease: 'out' },
    ] },
    { kind: 'spark', color: '#d8f6ff', count: 56, spread: 330, speed: 1.8, seed: 50260, at: MUZZLE, track: [
      { t: 0, alpha: 0 }, { t: 61, alpha: 0 },
      { t: 62, alpha: 1.0, scale: 1, ease: 'snap' },
      { t: 78, alpha: 0.55, scale: 1.35, ease: 'out' },
      { t: 96, alpha: 0, scale: 1.6, ease: 'out' },
    ] },
  ],
};

export const SEQUENCES = { standby: STANDBY, sa: SA, ultimate: ULTIMATE, hited: HITED };
