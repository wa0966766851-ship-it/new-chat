/**
 * 原生動畫的「單一顏色」變體。
 *
 * 背景：原廠影格自帶 mulColor／addColor（逐幀調色）。同一段出招裡亮度會在多組數值間跳動
 * （例如咤克斯 attack 有 0.80 / 0.76 / 0.52 三種），整隻播出來就像「三種顏色的分身疊在一起」。
 * 使用者要求「一種顏色就好」，但同時表示原廠顏色本身有價值 —— 所以不是歸零，而是
 * 「每段序列只取一個代表色」，並把這個代表色抽成可命名的變體表，將來的形態直接加一列。
 *
 * 設計原則：
 * 1. 每段序列內顏色固定（同一段不會出現兩種色調）。
 * 2. 待機（standby）保持原色（原廠待機本來就是 mul=1 / add=0），切換到出招才上色。
 * 3. 具名變體（variant）可整隻覆寫，用於「恐懼的化身／憤怒的化身」這類同模型不同色調的形態。
 */

/** 一個顏色變體：乘算色與加算色（RGBA，0..1）。 */
export interface PetColorVariant {
  /** 變體識別碼，也是存檔／測試用的鍵。 */
  id: string;
  /** 顯示名稱（除錯與報告用）。 */
  label: string;
  /** 乘算色；null 表示沿用該段序列的原廠代表色。 */
  mul: readonly [number, number, number, number] | null;
  /** 加算色；null 表示沿用該段序列的原廠代表色。 */
  add: readonly [number, number, number, number] | null;
}

/** 預設：每段序列取原廠最常見的那組顏色（保留原廠色調，但整段只有一種）。 */
export const DEFAULT_VARIANT: PetColorVariant = { id: 'official', label: '原廠代表色', mul: null, add: null };

/**
 * 具名變體表。目前只有原廠代表色與純材質色；
 * 「恐懼的化身／憤怒的化身」等待設計定案後在此加列，不需改播放器。
 * key 以精靈名稱（normalize 後）或素材鍵比對，先比名稱再比素材。
 */
export const PET_COLOR_VARIANTS: Record<string, PetColorVariant> = {
  'official': DEFAULT_VARIANT,
  'raw': { id: 'raw', label: '原始材質色', mul: [1, 1, 1, 1], add: [0, 0, 0, 0] },
  // 咤克斯三個化身：同一個模型、同一張近灰階圖集，靠原廠影格的 addColor 分色。
  // 這裡把該形態最常見的那組色固定套用到整段動畫，形態可辨、但一隻只有一種顏色。
  'zhakesi15008': { id: 'wrath', label: '憤怒的化身', mul: [0.797, 0.797, 0.797, 1], add: [0.121, 0, 0.039, 0] },
  'zhakesi15009': { id: 'greed', label: '貪婪的化身', mul: [0.797, 0.797, 0.797, 1], add: [0.039, 0, 0.078, 0] },
  // 恐懼的化身：15010 的圖集本身已偏青綠（實測與 15008／15009 差 8.3 萬像素），
  // 再疊上原廠的青色 addColor 才是官方那個樣子。
  'zhakesi15010': { id: 'fear', label: '恐懼的化身', mul: [0.797, 0.797, 0.797, 1], add: [0, 0.078, 0.078, 0] },
};

/** 依精靈名稱／素材鍵挑選變體；未登記時回傳預設（原廠代表色）。 */
export function petColorVariant(name: string, assetId?: string): PetColorVariant {
  const norm = (name || '').replace(/[・.·\s]/g, '·');
  // 先看「素材鍵＋名稱」，再看「素材鍵」，最後才用名稱；都沒有就回預設。
  return PET_COLOR_VARIANTS[assetId ? `${assetId}:${norm}` : '']
    ?? (assetId ? PET_COLOR_VARIANTS[assetId] : undefined)
    ?? PET_COLOR_VARIANTS[norm] ?? DEFAULT_VARIANT;
}

/** 影格網格的最小介面（避免此檔依賴 bundle 套件型別）。 */
interface FrameMesh { mulColors: Float32Array | number[]; addColors: Float32Array | number[] }
/** 播放器序列：每格只有 mesh（與 SwfSequence 相容）。 */
interface FrameLike { mesh: FrameMesh }
interface SequenceLike { name: string; frames: readonly FrameLike[] }

const sig = (m: FrameMesh) => {
  let mul = 0, add = 0;
  for (let i = 0; i < m.mulColors.length; i++) mul = mul * 31 + Math.round(m.mulColors[i] * 1000);
  for (let i = 0; i < m.addColors.length; i++) add = add * 31 + Math.round(m.addColors[i] * 1000);
  return `${mul}|${add}`;
};

/**
 * 取一段序列的代表色：出現次數最多的那組 (mul, add)。
 * 完全沒有影格時回傳 null（呼叫端保持原樣）。
 */
export function dominantTint(frames: readonly FrameLike[]): { mul: number[]; add: number[] } | null {
  if (!frames.length) return null;
  const counts = new Map<string, { n: number; index: number }>();
  frames.forEach((frame, index) => {
    const key = sig(frame.mesh);
    const hit = counts.get(key);
    if (hit) hit.n++; else counts.set(key, { n: 1, index });
  });
  let best: { n: number; index: number } | null = null;
  for (const value of counts.values()) if (!best || value.n > best.n) best = value;
  const { mulColors, addColors } = frames[best!.index].mesh;
  return { mul: Array.from(mulColors), add: Array.from(addColors) };
}

/** 把一段序列的每一影格都套成同一個顏色（序列內只會有一種色調）。 */
export function applyUniformTint(frames: readonly FrameLike[], tint: { mul: readonly number[]; add: readonly number[] } | null) {
  if (!tint) return;
  for (const frame of frames) {
    const { mulColors, addColors } = frame.mesh;
    for (let i = 0; i < mulColors.length; i++) mulColors[i] = tint.mul[i % tint.mul.length] ?? 1;
    for (let i = 0; i < addColors.length; i++) addColors[i] = tint.add[i % tint.add.length] ?? 0;
  }
}

/** 整隻覆寫成單一顏色（具名變體用）。 */
export function overrideTint(frames: readonly FrameLike[], variant: PetColorVariant) {
  if (!variant.mul && !variant.add) return false;
  const mul = variant.mul ?? [1, 1, 1, 1];
  const add = variant.add ?? [0, 0, 0, 0];
  applyUniformTint(frames, { mul, add });
  return true;
}

/**
 * 對整份動畫套用「一種顏色」規則：
 * 1. 有具名變體 → 全部序列覆寫成該變體。
 * 2. 否則 → 每段序列各自套用其代表色（待機保持原色）。
 * 回傳每段序列實際採用的顏色，供報告與測試核對。
 */
export function unifyPetColors(
  sequences: readonly SequenceLike[],
  variant: PetColorVariant = DEFAULT_VARIANT,
) {
  const report: Record<string, { mul: number[]; add: number[] } | null> = {};
  // 具名變體：整隻覆寫成該顏色。
  if (overrideTint(sequences.flatMap(s => s.frames), variant)) {
    const tint = { mul: Array.from(variant.mul ?? [1, 1, 1, 1]), add: Array.from(variant.add ?? [0, 0, 0, 0]) };
    for (const sequence of sequences) report[sequence.name] = tint;
    return report;
  }
  // 預設：整隻統一用「待機的原廠色」。待機是所有序列裡唯一沒被調色的一段，
  // 也就是這隻精靈真正的材質色（恐懼的化身＝暗紅、湮滅之主＝暗紫），出招時不會換色。
  const standby = sequences.find(s => s.name === 'standby');
  const base = dominantTint(standby?.frames ?? []) ?? { mul: [1, 1, 1, 1], add: [0, 0, 0, 0] };
  for (const sequence of sequences) { applyUniformTint(sequence.frames, base); report[sequence.name] = base; }
  return report;
}

/**
 * 具名變體：原廠出招的逐段調色（每段序列各自一個代表色）。
 * 目前沒有形態使用；保留給「憤怒的化身」這類同模型、靠出招配色區分的形態。
 */
export const COMBAT_TINT_VARIANT: PetColorVariant = { id: 'combat', label: '原廠出招配色', mul: null, add: null };
