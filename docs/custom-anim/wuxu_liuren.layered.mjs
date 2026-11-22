// 無序.六刃 分層動畫（2026-11-22）。
// 本體：舊正式版的姿勢圖與待機零件（pose-source/wuxu_liuren）；光效：官方 4930 借用零件換成翠綠色系。
// 六柄飛刃仍由戰鬥畫面的 weaponVolley 繪製（持刃期 4～56 格、命中 32 格不變），這裡只做本體與身邊的光效。
// 風格：暗影刺客——快、低、拖影長；出刀前收身、斬出時綠色殘影一路拉開，命中閃白停頓。
import {clamp, E, key, bump, wave, shake, at, WHITE, HALF_WHITE, glow, ghostTint, loadPoseSource, borrowFx, poseLayers, idleField} from './lib/layeredKit.mjs';

const GREEN = [.3, 1, .5], DEEP = [.04, .2, .1];
const GHOST = ghostTint([.25, 1, .45]);

export default async function makeSpec(io) {
  /** 待機形變場（見 layeredKit.idleField）。 */
  const FIELD = {foot: .62, top: 7.23, cx: 5.9, halfW: 2.8};
  const kit = loadPoseSource(io, 'wuxu_liuren', .85);
  const parts = [...kit.parts, ...borrowFx(io.readPng, undefined, GREEN)];
  const PIVOT = [5.9, .62];
  const tip = pid => kit.pose(pid).muzzle ?? [1, 4];
  const body = (pid, o = {}) => poseLayers(kit, pid, o);
  const fx = (part, x, y, w, o = {}) => ({part, x, y, w, ...o});
  const ghosts = (pid, base, step, n, alpha = [.45, .26, .12]) =>
    Array.from({length: n}, (_, i) => ({part: pid, ...base, dx: (base.dx ?? 0) + step[0] * (n - i), dy: (base.dy ?? 0) + step[1] * (n - i), a: alpha[n - 1 - i] ?? .08, ...GHOST, primary: false}));

  // ── 待機：雙臂交抱的上身隨呼吸起伏，披風下擺左右飄，腳邊綠色暗流上升 ──
  const standby = Array.from({length: 96}, (_, f) => {
    return [
      fx('ring_swirl', 5.9, .75, 4.2, {sy: .18, rot: -f * 1.5, a: .5 + .1 * wave(f, 96)}),
      fx('sparks_a', 5.6, 1.8 + 3 * (f / 96), 2.6, {a: .8 * bump(f, 0, 30, 95)}),
      fx('sparks_b', 6.4, 1.8 + 3 * (((f + 48) % 96) / 96), 2.2, {a: .75 * bump((f + 48) % 96, 0, 30, 95)}),
      // 下身與上身共用同一個形變場：呼吸、擺動、披風外緣波動，接縫不會分開
      {part: 'idleBase', warp: idleField(FIELD, f / 96), pivot: PIVOT},
      {part: 'idleBase.g0', warp: idleField(FIELD, f / 96), primary: false},
      fx('glint_star', 5.5, 6.5, .35 + .25 * bump(f, 58, 62, 70), {rot: f * 8, a: bump(f, 58, 62, 70)}),
    ];
  });

  // ── 普攻／第五：收身 → 拔刀 → 低身疾斬（綠影拖曳）→ 閃白停頓 → 收刀 ──
  const slash = (big) => Array.from({length: 64}, (_, f) => {
    const L = [];
    const hit = 32, sh = shake(f, hit, big ? .2 : .14, big ? 9 : 7);
    if (big) for (const [x, d] of [[3.2, 0], [8.6, 3], [4.4, 6], [7.4, 9]]) {
      const h = key(f, [[d, 0], [d + 10, 1, 'out'], [30, 1], [38, 0]]);
      if (h > .01) L.push(fx(d % 2 ? 'pillar_b' : 'pillar_a', x, .5 + 3 * h, 1.4, {sy: 2 * h, a: .8 * h}));
    }
    if (f < 4) L.push(...body('ready', {sy: key(f, [[0, 1], [3, .97]]), sx: key(f, [[0, 1], [3, 1.02]])}));
    else if (f < 12) {
      const k = key(f, [[4, 0], [11, 1, 'out']]);
      L.push(...body(f < 8 ? 'take' : 'lower', {dx: .35 * k, rot: -3 * k, ...(f >= 9 ? glow(.6 * bump(f, 8, 10, 12), DEEP) : {})}));
      L.push(fx('glint_star', ...at(tip(f < 8 ? 'take' : 'lower')), .3 + .8 * k, {rot: f * 14, a: .5 + .5 * k}));
    } else if (f < 20) {
      const k = key(f, [[12, 0], [19, 1, 'in']]);
      L.push(...body('windup', {dx: .5 - .4 * k, sy: 1 - .05 * k, sx: 1 + .04 * k}));
      if (big) L.push(fx('ring_swirl', ...at(tip('windup'), [1, 0]), 1.2 + 2 * k, {sy: .5, rot: f * 20, a: .7 * k}));
    } else if (f < hit) {
      const pid = f < 26 ? 'cut' : 'melee', dx = key(f, [[20, -.2], [hit, -1.4, 'out']]);
      L.push(...ghosts(pid, {dx}, [.45, 0], f < 28 ? 3 : 2));
      L.push(fx('streak_h', 6 + dx, 2.9, 5, {a: .75 * bump(f, 20, 24, 32)}));
      L.push(...body(pid, {dx}));
      L.push(fx('slash_orange', ...at(tip(pid), [dx, 0]), .8 + .1 * (f - 20), {rot: 180, a: bump(f, 26, 31, 32)}));
    } else {
      const pid = f < 36 ? 'melee' : f < 44 ? 'recover' : f < 48 ? 'windup' : f < 52 ? 'lower' : f < 56 ? 'take' : 'ready';
      const dx = f < 38 ? -1.4 : key(f, [[38, -1.4], [46, -.4, 'out'], [63, 0]]);
      const p = at(tip('melee'), [-1.4 + sh, 0]);
      const flash = f === hit ? WHITE : f === hit + 1 ? HALF_WHITE : {};
      if (f < 44) L.push(fx('ring_swirl', ...p, 1.4 + (f - hit) * (big ? 1 : .7), {sy: .5, rot: (f - hit) * 14, a: .9 * (1 - (f - hit) / 12)}));
      L.push(...body(pid, {dx: dx + sh, ...flash}));
      if (f < 44) {
        L.push(fx('slash_cross', ...p, big ? 3.6 : 2.8, {rot: 20, a: bump(f, hit, hit + 2, hit + 8)}));
        L.push(fx('star_flare', ...p, 2.8 + 4 * E.out(clamp((f - hit) / 3)), {rot: (f - hit) * 5, a: 1 - E.in(clamp((f - hit) / 10))}));
        L.push(fx('burst_gold', ...p, big ? 4 : 3.2, {rot: -(f - hit) * 9, a: bump(f, hit, hit + 1, hit + 8)}));
        L.push(fx('flare_h', ...p, 5 * (1 - .06 * (f - hit)), {a: bump(f, hit, hit, hit + 5)}));
        if (f >= hit + 1) L.push(fx('sparks_b', ...at(p, [-.3, .2 + .05 * (f - hit)]), 3.2, {a: bump(f, hit + 1, hit + 3, 43)}));
        if (big && f >= hit + 2 && f <= hit + 8) L.push(fx(f % 2 ? 'bolt_a' : 'bolt_b', ...at(p, [.4, .5]), 1.5, {rot: 25 * (f % 3 - 1), a: .9}));
      }
    }
    return L;
  });

  // ── 特攻：聚氣（雙手合攏）→ 下令（伸手），綠色暗流自地面湧起、手前爆開 ──
  const command = (frames, hitAt, big) => Array.from({length: frames}, (_, f) => {
    const L = [], up = key(f, [[0, 0], [12, 1, 'out'], [frames - 14, 1], [frames - 2, 0]]);
    const pid = f < 6 ? 'ready' : f < 14 ? 'gather' : f < frames - 14 ? 'command' : f < frames - 6 ? 'gather' : 'ready';
    L.push(fx('ring_swirl', 5.9, .75, 3.6 + 2.6 * up, {sy: .2, rot: f * 6, a: .85 * up}));
    if (big) L.push(fx('rays_fan', 5.9, 7.2, 5, {a: .7 * bump(f, 8, 16, frames - 10)}));
    L.push(fx('sparks_a', 5.9, 1.6 + 4 * (f / frames), 3.4, {a: .7 * up}));
    L.push(...body(pid, {dy: .08 * up, ...(pid !== 'ready' ? glow(.5 * up * (.6 + .4 * wave(f, 8)), DEEP) : {})}));
    const hand = tip('command');
    if (pid === 'gather') L.push(fx('burst_gold', 5.6, 4.4, 1.2 + .8 * up, {rot: f * 9, a: .8 * up}));
    if (pid === 'command') {
      L.push(fx('glint_star', ...hand, 1 + .4 * wave(f, 6), {rot: f * 10, a: .9}));
      if (hitAt !== undefined) {
        L.push(fx('star_flare', ...hand, 1 + 4 * bump(f, hitAt - 2, hitAt, hitAt + 10), {rot: f * 4, a: bump(f, hitAt - 2, hitAt, hitAt + 10)}));
        L.push(fx('streak_h', hand[0] - 2.4, hand[1], 5, {a: bump(f, hitAt - 3, hitAt, hitAt + 6)}));
      }
    }
    return L;
  });

  // ── 受擊：閃紅、後仰、回穩 ──
  const hited = Array.from({length: 12}, (_, f) => {
    const kb = key(f, [[0, 0], [2, .45, 'out'], [11, 0]]);
    return f < 7 ? body('hurt', {dx: kb, rot: 4 * kb, ...(f < 2 ? {m: [1, .35, .35], t: [.55, 0, 0]} : {})})
      : [{part: 'idleBase', dx: kb, pivot: PIVOT}, {part: 'idleBase.g0', dx: kb, primary: false}];
  });

  return {
    id: 'wuxu_liuren', elfId: kit.src.elfId, elfName: kit.src.elfName, fps: 24, facing: kit.src.facing,
    presentation: {...kit.src.presentation, fxSheets: undefined, ambient: false, bakedFx: true}, physicalMotion: kit.src.physicalMotion,
    canvas: kit.src.canvas, pixelsPerUnit: kit.src.pixelsPerUnit, pivot: PIVOT, restPart: 'idleBase', parts, maxAtlasSide: 4096,
    notes: ['2026-11-22 分層試作：本體取自舊正式版姿勢圖；光效借用官方 4930 並換綠色系；飛刃仍由 weaponVolley 繪製'],
    sequences: {
      standby: {frames: standby, loop: true},
      attack: {frames: slash(false), hits: [32]},
      sa: {frames: command(64, 32, false), hits: [32]},
      ultimate: {frames: slash(true), hits: [32]},
      cp: {frames: command(48, undefined, true)},
      extra: {frames: command(48, undefined, false)},
      hited: {frames: hited},
    },
  };
}
