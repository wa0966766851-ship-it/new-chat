// 無序.墜星 分層動畫（2026-11-22）。
// 本體：舊正式版的姿勢圖與待機零件（雙腿、持砲上身、紅色腰帶、兩架浮游砲）；光效：官方 4930 借用零件換成冷藍色系。
// 遠程砲擊型：軌道砲彈道與對手處爆發仍由戰鬥畫面的程式光效與序列圖繪製；這裡做本體、浮游砲與砲口的蓄能／後座。
// 風格：重砲——舉砲時浮游砲歸位、砲口蓄能越聚越亮，開火瞬間閃白、強烈後座把人推退，砲口噴焰與震動。
import {clamp, E, key, bump, wave, shake, at, WHITE, HALF_WHITE, glow, loadPoseSource, borrowFx, poseLayers, idleField} from './lib/layeredKit.mjs';

const BLUE = [.35, .65, 1], DEEP = [.05, .12, .25];
// 砲管朝左上（世界座標 y 向上）：開火光束沿砲管方向射出。
const AIM = 40, AX = -Math.cos(AIM * Math.PI / 180), AY = Math.sin(AIM * Math.PI / 180);

export default async function makeSpec(io) {
  /** 待機形變場（見 layeredKit.idleField）。 */
  const FIELD = {foot: .53, top: 9.1, cx: 3.9, halfW: 3};
  const kit = loadPoseSource(io, 'wuxu_zhuixing', .8);
  const parts = [...kit.parts, ...borrowFx(io.readPng, undefined, BLUE)];
  const PIVOT = [3.9, .55];
  const fx = (part, x, y, w, o = {}) => ({part, x, y, w, ...o});
  const muzzle = pid => kit.pose(pid).muzzle;
  // 待機零件：ready（雙腿）＋ g0 持砲上身 ＋ g2 腰帶 ＋ g3／g4 浮游砲
  const idle = (f, o = {}, drones = 1) => {
    // 雙腿、持砲上身、腰帶共用同一個形變場（接縫不會分開）；兩架浮游砲是分離物件，各自漂移。
    const body = {pivot: PIVOT, dx: o.dx ?? 0, dy: o.dy ?? 0, warp: idleField(FIELD, f / 96), ...(o.m ? {m: o.m, t: o.t} : {})};
    return [
      {part: 'ready', ...body},
      {part: 'ready.g0', ...body, primary: false},
      {part: 'ready.g2', ...body, primary: false},
      {part: 'ready.g3', dx: (o.dx ?? 0) + .12 * wave(f, 72) * drones, dy: .18 * wave(f, 48, .1) * drones + (o.dy ?? 0), rot: 4 * wave(f, 96) * drones, pivot: [1.5, 4.7], primary: false},
      {part: 'ready.g4', dx: (o.dx ?? 0) + .1 * wave(f, 60, .4) * drones, dy: .15 * wave(f, 40, .6) * drones + (o.dy ?? 0), rot: -5 * wave(f, 80) * drones, pivot: [6.1, 5.5], primary: false},
    ];
  };

  // ── 待機：浮游砲各自漂移、腰帶飄動、雙腿間能量格閃爍、腳下冷光環 ──
  const standby = Array.from({length: 96}, (_, f) => [
    fx('ring_swirl', 3.9, .7, 3.8, {sy: .18, rot: f * 2, a: .5 + .1 * wave(f, 96)}),
    fx('sparks_a', 3.8, 1.6 + 3.4 * (f / 96), 2.6, {a: .6 * bump(f, 0, 30, 95)}),
    ...idle(f),
    fx('glint_star', 1.5, 4.7, .3 + .2 * (wave(f, 24) * .5 + .5), {rot: f * 9, a: .7}),
    fx('glint_star', 6.1, 5.5, .25 + .2 * (wave(f, 24, .5) * .5 + .5), {rot: -f * 9, a: .6}),
    fx('glint_star', ...muzzle('ready'), .4 + .3 * bump(f, 50, 54, 62), {rot: f * 6, a: bump(f, 50, 54, 62)}),
  ]);

  // ── 砲擊：舉砲 → 瞄準蓄能（砲口光越聚越亮、浮游砲回收）→ 開火閃白＋後座 → 回位 ──
  const fire = (frames, hit, level) => Array.from({length: frames}, (_, f) => {
    const L = [];
    const raiseAt = Math.min(4, hit - 8), aimAt = Math.max(raiseAt + 4, Math.round(hit * .35)), back = Math.min(frames - 10, hit + 8);
    const pid = f < raiseAt ? null : f < aimAt ? 'raise' : f < hit ? 'aim' : f < hit + 4 ? 'recoil' : f < back ? 'aim' : f < frames - 5 ? 'raise' : null;
    const charge = clamp((f - aimAt) / Math.max(1, hit - aimAt));
    const kick = f >= hit ? key(f, [[hit, .7, 'out'], [hit + 3, .55], [back, 0]]) : 0;
    const sh = shake(f, hit, .12 + .05 * level, 8);
    if (level >= 2) for (const [x, d] of [[1.2, 0], [6.8, 3], [2.4, 6], [5.6, 9]]) {
      const h = key(f, [[aimAt + d * .5, 0], [aimAt + d * .5 + 8, 1, 'out'], [hit + 2, 1], [hit + 12, 0]]);
      if (h > .01) L.push(fx(d % 2 ? 'pillar_b' : 'pillar_a', x, .5 + 3.4 * h, 1.3, {sy: 2.2 * h, a: .8 * h}));
    }
    L.push(fx('ring_swirl', 3.9, .7, 3.4 + 2 * charge * (level ? 1 : .6), {sy: .2, rot: f * 8, a: .5 + .4 * charge}));
    if (!pid) L.push(...idle(f));
    else {
      const flash = f === hit ? WHITE : f === hit + 1 ? HALF_WHITE : pid === 'aim' && f < hit ? glow(.5 * charge, DEEP) : {};
      // 開火後座：整個人往後（＋x）推、微微上仰
      L.push(...poseLayers(kit, pid, {dx: kick + sh, rot: -4 * kick, ...flash}));
    }
    const m = pid ? at(muzzle(pid), [kick + sh, 0]) : muzzle('ready');
    if (pid === 'aim' && f < hit) {
      // 蓄能：砲口光球漸大、周圍光環收縮、吸入光屑
      L.push(fx('ring_swirl', ...m, 2.6 - 1.8 * charge, {rot: -f * 18, a: .9 * charge}));
      L.push(fx('glint_star', ...m, .4 + 1.6 * charge, {rot: f * 15, a: .6 + .4 * charge}));
      L.push(fx('burst_gold', ...m, .6 + 1.4 * charge, {rot: f * 10, a: .8 * charge}));
      if (level >= 1 && f % 2) L.push(fx(f % 4 === 1 ? 'bolt_a' : 'bolt_b', ...at(m, [.3, .3]), .8 + .6 * charge, {rot: 40 * (f % 3 - 1), a: .8 * charge}));
    }
    if (f >= hit && f < hit + 10) {
      const t = f - hit;
      L.push(fx('star_flare', ...m, 2.4 + (3 + level) * E.out(clamp(t / 3)), {rot: t * 6, a: 1 - E.in(clamp(t / 9))}));
      L.push(fx('flare_h', m[0] + 1.6 * AX, m[1] + 1.6 * AY, 5 + 1.5 * level, {rot: 90 - AIM, a: bump(f, hit, hit, hit + 5)}));
      L.push(fx('streak_h', m[0] + 3 * AX, m[1] + 3 * AY, 6, {rot: -AIM, a: bump(f, hit, hit, hit + 6)}));
      L.push(fx('burst_gold', ...m, 2.4 + .6 * level, {rot: -t * 10, a: bump(f, hit, hit + 1, hit + 8)}));
      L.push(fx('sparks_b', ...at(m, [.6, -.2 - .06 * t]), 2.8, {a: bump(f, hit + 1, hit + 3, hit + 9)}));
      if (level >= 1) L.push(fx('shock_bowl', ...at(m, [.4, 0]), 1.4 + .3 * t, {rot: 90, a: bump(f, hit, hit + 2, hit + 9)}));
    }
    return L;
  });

  // ── 屬性／額外：浮游砲高速環繞、能量自地面升起、本體微浮 ──
  const charge = (frames, big) => Array.from({length: frames}, (_, f) => {
    const up = key(f, [[0, 0], [8, 1, 'out'], [frames - 8, 1], [frames - 1, 0]]);
    const L = [fx('ring_swirl', 3.9, .7, 3 + 3 * up, {sy: .22, rot: -f * 10, a: .9 * up})];
    if (big) for (const [x, d] of [[1.2, 0], [6.8, 2], [2.4, 4], [5.6, 6]]) {
      const h = key(f, [[d, 0], [d + 6, 1, 'out'], [frames - 8, 1], [frames - 1, 0]]);
      if (h > .01) L.push(fx(d % 4 ? 'pillar_b' : 'pillar_a', x, .5 + 3.2 * h, 1.2, {sy: 2 * h, a: .8 * h}));
    }
    L.push(fx('sparks_a', 3.9, 1.6 + 4.5 * (f / frames), 3.4, {a: .8 * up}));
    L.push(...idle(f * 3, {dy: .12 * up, ...glow(.4 * up * (.6 + .4 * wave(f, 8)), DEEP)}, 2.5));
    L.push(fx('star_white', 3.6, 6.8, 2, {rot: f * 5, a: bump(f, 8, 11, 18)}));
    return L;
  });

  // ── 受擊：閃紅、被打退、回穩 ──
  const hited = Array.from({length: 10}, (_, f) => {
    const kb = key(f, [[0, 0], [2, .45, 'out'], [9, 0]]);
    if (f < 3) return poseLayers(kit, 'hit', {dx: kb, rot: 4 * kb, ...(f < 2 ? {m: [1, .35, .35], t: [.55, 0, 0]} : {})});
    if (f < 5) return poseLayers(kit, 'raise', {dx: kb});
    return idle(f, {dx: kb});
  });

  return {
    id: 'wuxu_zhuixing', elfId: kit.src.elfId, elfName: kit.src.elfName, fps: 24, facing: kit.src.facing,
    // 自身處（anchor: caster）的序列圖已由分層光效取代；對手處的保留。
    presentation: {...kit.src.presentation, ambient: false, fxSheets: Object.fromEntries(Object.entries(kit.src.presentation.fxSheets ?? {}).filter(([, v]) => v.anchor !== 'caster'))}, physicalMotion: kit.src.physicalMotion,
    canvas: kit.src.canvas, pixelsPerUnit: kit.src.pixelsPerUnit, pivot: PIVOT, restPart: 'ready', parts, maxAtlasSide: 4096,
    notes: ['2026-11-22 分層試作：本體取自舊正式版姿勢圖與待機零件；光效借用官方 4930 並換藍色系；彈道與對手處爆發仍由戰鬥畫面繪製'],
    sequences: {
      standby: {frames: standby, loop: true},
      attack: {frames: fire(40, 23, 0), hits: [23]},
      sa: {frames: fire(52, 34, 1), hits: [34]},
      ultimate: {frames: fire(68, 47, 2), hits: [47]},
      cp: {frames: charge(36, true)},
      extra: {frames: charge(32, false)},
      hited: {frames: hited},
    },
  };
}
