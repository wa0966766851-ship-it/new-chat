// 無序·蝕言 分層動畫（2026-11-22）。
// 本體：舊正式版的姿勢圖與待機零件（下身、背後怨靈、持書上身三件）；光效：官方 4930 借用零件換成紫色系。
// 遠程施咒型：命中點在對手身上，對手處的爆發仍由戰鬥畫面的序列圖與程式光效繪製；這裡做本體、怨靈與手邊的咒光。
// 額外行動的咒書封印仍由 extraSeal 繪製（72 格不變）。
// 風格：背後怨靈像活物一樣漂浮、施咒時撲向前方；書頁翻動處噴出咒印。
import {clamp, E, key, bump, wave, shake, at, WHITE, HALF_WHITE, glow, ghostTint, loadPoseSource, borrowFx, poseLayers, idleField} from './lib/layeredKit.mjs';

const VIOLET = [.72, .42, 1], DEEP = [.12, .04, .2];
const GHOST = ghostTint([.6, .3, 1]);

export default async function makeSpec(io) {
  /** 待機形變場（見 layeredKit.idleField）。 */
  const FIELD = {foot: .58, top: 7.2, cx: 4.5, halfW: 2.4};
  const kit = loadPoseSource(io, 'wuxu_shiyan', .85);
  const parts = [...kit.parts, ...borrowFx(io.readPng, undefined, VIOLET)];
  const PIVOT = [4.5, .6];
  const book = kit.pose('cast').muzzle ?? [2.4, 4.7];
  const fx = (part, x, y, w, o = {}) => ({part, x, y, w, ...o});
  // 待機零件：idleLower（下身）＋ g0 怨靈 ＋ g2 上身
  const idle = (f, o = {}, ghost = {}) => {
    // 下身與持書上身共用同一個形變場（不會分裂）；背後怨靈是獨立的靈體，單獨緩慢浮沉、明滅。
    const warp = idleField(FIELD, f / 120), fl = wave(f, 120, .2), body = {pivot: PIVOT, dx: o.dx ?? 0, dy: o.dy ?? 0, warp, ...(o.m ? {m: o.m, t: o.t} : {})};
    return [
      {part: 'idleLower', ...body},
      {part: 'idleLower.g0', pivot: [4.4, 6], dy: .08 * fl + (o.dy ?? 0), dx: o.dx ?? 0, sy: 1 + .015 * fl, a: .9 + .1 * wave(f, 60), primary: false, ...ghost},
      {part: 'idleLower.g2', ...body, primary: false},
    ];
  };

  // ── 待機：怨靈浮沉、書頁咒光閃爍、紫色碎屑環繞上升 ──
  const standby = Array.from({length: 120}, (_, f) => [
    fx('ring_swirl', 4.5, .72, 3.6, {sy: .18, rot: f * 1.5, a: .45 + .1 * wave(f, 120)}),
    fx('sparks_b', 4.3, 2 + 3.5 * (f / 120), 2.6, {a: .7 * bump(f, 0, 40, 119)}),
    ...idle(f),
    fx('glint_star', ...book, .4 + .25 * (wave(f, 30) * .5 + .5), {rot: f * 6, a: .55 + .35 * (wave(f, 30) * .5 + .5)}),
    fx('star_white', 4.3, 7.2, .2 + .5 * bump(f, 80, 86, 96), {rot: f * 5, a: bump(f, 80, 86, 96)}),
  ]);

  // ── 施咒：預備（翻書、怨靈縮回）→ 施放（怨靈撲出、書頁咒印噴發）→ 回收 ──
  const cast = (frames, hit, big) => Array.from({length: frames}, (_, f) => {
    const L = [];
    const pre = Math.max(3, hit - 7), end = frames - 6;
    const pid = f < 3 ? null : f < pre ? 'anticipation' : f < end - 4 ? 'cast' : f < end ? 'anticipation' : null;
    const up = key(f, [[0, 0], [hit, 1, 'out'], [end - 2, 1], [frames - 1, 0]]);
    L.push(fx('ring_swirl', 4.5, .72, 3.2 + 2.4 * up, {sy: .2, rot: f * 7, a: .85 * up}));
    if (big) for (const [x, d] of [[2.1, 0], [6.9, 2], [3.1, 4], [5.9, 6]]) {
      const h = key(f, [[d, 0], [d + 8, 1, 'out'], [end - 4, 1], [frames - 1, 0]]);
      if (h > .01) L.push(fx(d % 4 ? 'pillar_b' : 'pillar_a', x, .5 + 3 * h, 1.3, {sy: 2 * h, a: .85 * h}));
    }
    if (!pid) L.push(...idle(f));
    else {
      // 施放瞬間：本體閃白一格；怨靈前撲並拖出殘影
      const lunge = key(f, [[pre, 0], [hit, -.5, 'out'], [hit + 6, -.15], [end, 0]]);
      const flash = f === hit ? WHITE : f === hit + 1 ? HALF_WHITE : pid === 'cast' ? glow(.6 * (.6 + .4 * wave(f, 6)), DEEP) : {};
      if (pid === 'cast' && f >= hit - 2 && f <= hit + 3)
        for (let i = 3; i >= 1; i--) L.push({part: 'cast', dx: lunge + .28 * i, a: [.4, .22, .1][i - 1], ...GHOST, primary: false});
      L.push(...poseLayers(kit, pid, {dx: f >= hit && f < hit + 7 ? shake(f, hit, .1) : 0, ...flash}));
    }
    // 書頁咒印：蓄力 → 噴發
    L.push(fx('glint_star', ...book, .5 + 1.2 * bump(f, pre, hit, hit + 4), {rot: f * 12, a: bump(f, pre, hit, hit + 4)}));
    L.push(fx('burst_gold', ...book, 1 + .8 * up, {rot: -f * 8, a: .8 * bump(f, pre, hit - 1, end)}));
    if (f >= hit) {
      L.push(fx('star_flare', ...book, 2 + 3.5 * E.out(clamp((f - hit) / 3)), {rot: (f - hit) * 4, a: 1 - E.in(clamp((f - hit) / 9))}));
      L.push(fx('streak_h', book[0] - 2.6, book[1], 5.4, {a: bump(f, hit, hit, hit + 6)}));
      L.push(fx('slash_burst', ...at(book, [-.6, 0]), 2.2 + .2 * (f - hit), {rot: 160, a: bump(f, hit, hit + 1, hit + 7)}));
      if (big && f <= hit + 8) L.push(fx(f % 2 ? 'bolt_a' : 'bolt_b', ...at(book, [-.4, .6]), 1.6, {rot: 30 * (f % 3 - 1), a: .9}));
    }
    return L;
  });

  // ── 屬性：怨靈升起、四周紫柱與上升咒屑 ──
  const cp = Array.from({length: 30}, (_, f) => {
    const up = key(f, [[0, 0], [8, 1, 'out'], [22, 1], [29, 0]]);
    const pid = f < 3 || f >= 24 ? null : f < 8 || f >= 20 ? 'anticipation' : 'cast';
    const L = [fx('ring_swirl', 4.5, .72, 3 + 3 * up, {sy: .22, rot: -f * 8, a: .9 * up})];
    for (const [x, d] of [[2, 0], [7, 2], [3, 4], [6, 6]]) {
      const h = key(f, [[d, 0], [d + 6, 1, 'out'], [22, 1], [29, 0]]);
      if (h > .01) L.push(fx(d % 4 ? 'pillar_b' : 'pillar_a', x, .5 + 3 * h, 1.2, {sy: 1.9 * h, a: .8 * h}));
    }
    L.push(fx('sparks_a', 4.5, 1.6 + 4 * (f / 29), 3.4, {a: .8 * up}));
    L.push(...(pid ? poseLayers(kit, pid, {dy: .1 * up, ...glow(.5 * up, DEEP)}) : idle(f, {dy: .1 * up})));
    L.push(fx('star_white', ...book, 2, {rot: f * 5, a: bump(f, 10, 12, 18)}));
    return L;
  });

  // ── 額外行動（72 格，咒書封印由戰鬥畫面繪製）：長時間持咒，怨靈脈動、身邊咒環迴轉 ──
  const extra = Array.from({length: 72}, (_, f) => {
    const up = key(f, [[0, 0], [10, 1, 'out'], [58, 1], [71, 0]]);
    const pid = f < 6 || f >= 64 ? null : f < 18 || f >= 58 ? 'anticipation' : 'cast';
    const L = [fx('ring_swirl', 4.5, .72, 3.4 + 1.6 * up, {sy: .2, rot: f * 9, a: .9 * up}),
      fx('ring_swirl', ...book, 1.6 + .4 * wave(f, 12), {rot: -f * 14, a: .8 * bump(f, 14, 20, 60)})];
    L.push(...(pid ? poseLayers(kit, pid, pid === 'cast' ? glow(.45 * (.6 + .4 * wave(f, 10)), DEEP) : {}) : idle(f)));
    L.push(fx('glint_star', ...book, .8 + .4 * wave(f, 6), {rot: f * 10, a: .9 * bump(f, 14, 20, 60)}));
    if (f % 12 < 6 && f >= 20 && f < 58) L.push(fx('sparks_b', ...at(book, [-.5, .2 + .1 * (f % 12)]), 2.4, {a: .8}));
    return L;
  });

  // ── 受擊：護書（閃紅）→ 回穩 ──
  const hited = Array.from({length: 12}, (_, f) => {
    const kb = key(f, [[0, 0], [2, .4, 'out'], [11, 0]]);
    if (f < 5) return poseLayers(kit, 'hurtGuard', {dx: kb, rot: 3 * kb, ...(f < 2 ? {m: [1, .35, .35], t: [.55, 0, 0]} : {})});
    if (f < 9) return poseLayers(kit, 'hurtRecover', {dx: kb});
    return idle(f, {dx: kb});
  });

  return {
    id: 'wuxu_shiyan', elfId: kit.src.elfId, elfName: kit.src.elfName, fps: 24, facing: kit.src.facing,
    // 自身處（anchor: caster）的序列圖已由分層光效取代；對手處的保留。
    presentation: {...kit.src.presentation, ambient: false, fxSheets: Object.fromEntries(Object.entries(kit.src.presentation.fxSheets ?? {}).filter(([, v]) => v.anchor !== 'caster'))}, physicalMotion: kit.src.physicalMotion,
    canvas: kit.src.canvas, pixelsPerUnit: kit.src.pixelsPerUnit, pivot: PIVOT, restPart: 'idleLower', parts, maxAtlasSide: 4096,
    notes: ['2026-11-22 分層試作：本體取自舊正式版姿勢圖與待機零件；光效借用官方 4930 並換紫色系；對手處爆發與咒書封印仍由戰鬥畫面繪製'],
    sequences: {
      standby: {frames: standby, loop: true},
      attack: {frames: cast(28, 10, false), hits: [10]},
      sa: {frames: cast(34, 12, false), hits: [12]},
      ultimate: {frames: cast(42, 14, true), hits: [14]},
      cp: {frames: cp},
      extra: {frames: extra},
      hited: {frames: hited},
    },
  };
}
