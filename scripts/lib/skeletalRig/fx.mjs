// 程序化光效（ring / glow / beam / spark）與整格合成。
// 這些都是「預覽與 GIF 用」；正式素材只烘焙光效圖塊，本體只寫頂點。
import { makeCanvas, sampleTrack, EASE, clamp } from './rigCore.mjs';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#ffffff');
  const v = m ? parseInt(m[1], 16) : 0xffffff;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function addPixel(canvas, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return;
  const di = (y * canvas.w + x) * 4;
  canvas.data[di] = Math.min(255, canvas.data[di] + r * a);
  canvas.data[di + 1] = Math.min(255, canvas.data[di + 1] + g * a);
  canvas.data[di + 2] = Math.min(255, canvas.data[di + 2] + b * a);
  canvas.data[di + 3] = Math.min(255, canvas.data[di + 3] + 255 * a);
}

export function drawGlow(canvas, layer, tf, at) {
  const [r, g, b] = hexToRgb(layer.color);
  const radius = layer.radius * (tf.scale || 1);
  const alpha = tf.alpha || 0;
  if (alpha <= 0.004 || radius <= 0) return;
  const power = layer.power == null ? 2.2 : layer.power;
  const ox = at[0], oy = at[1];
  for (let y = Math.max(0, Math.floor(oy - radius)); y < Math.min(canvas.h, Math.ceil(oy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(ox - radius)); x < Math.min(canvas.w, Math.ceil(ox + radius)); x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / radius;
      if (d >= 1) continue;
      const a = Math.pow(1 - d, power) * alpha;
      if (a <= 0.004) continue;
      addPixel(canvas, x, y, r, g, b, a);
    }
  }
}

export function drawRing(canvas, layer, tf, at) {
  const [r, g, b] = hexToRgb(layer.color);
  const radius = layer.radius * (tf.scale || 1);
  const width = layer.width || 4;
  const alpha = tf.alpha || 0;
  if (alpha <= 0.004 || radius <= 0) return;
  const ox = at[0], oy = at[1];
  for (let y = Math.max(0, Math.floor(oy - radius - width)); y < Math.min(canvas.h, Math.ceil(oy + radius + width)); y++) {
    for (let x = Math.max(0, Math.floor(ox - radius - width)); x < Math.min(canvas.w, Math.ceil(ox + radius + width)); x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      const a = Math.max(0, 1 - Math.abs(d - radius) / width) * alpha;
      if (a <= 0.004) continue;
      addPixel(canvas, x, y, r, g, b, a);
    }
  }
}

export function drawBeam(canvas, layer, tf, at) {
  const [r, g, b] = hexToRgb(layer.color);
  const length = layer.length * (tf.scale || 1);
  const width = layer.width;
  const alpha = tf.alpha || 0;
  if (alpha <= 0.004) return;
  const dir = layer.dir === 'left' ? -1 : 1;
  const ox = at[0], oy = at[1];
  for (let i = 0; i < length; i++) {
    const x = Math.floor(ox + dir * i);
    if (x < 0 || x >= canvas.w) continue;
    const taper = 1 - i / length;
    const halfW = width * taper * 0.5;
    if (halfW < 0.5) continue;
    const a0 = alpha * Math.pow(taper, 1.3);
    for (let y = Math.floor(oy - halfW); y <= Math.ceil(oy + halfW); y++) {
      const edge = 1 - Math.abs(y + 0.5 - oy) / halfW;
      if (edge <= 0) continue;
      const a = a0 * Math.min(1, edge * 1.6);
      if (a <= 0.004) continue;
      addPixel(canvas, x, y, r, g, b, a);
    }
  }
}

export function drawSparks(canvas, layer, tf, at, frame) {
  const [r, g, b] = hexToRgb(layer.color);
  const alpha = tf.alpha || 0;
  if (alpha <= 0.004) return;
  const count = layer.count || 24;
  const speed = layer.speed == null ? 1 : layer.speed;
  const spread = layer.spread || 160;
  const ox = at[0], oy = at[1];
  let s = (layer.seed || 12345) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const grow = (tf.scale || 1);
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = spread * speed * (0.25 + rnd() * 0.75) * 0.55 * grow;
    const px = ox + Math.cos(ang) * dist;
    const py = oy + Math.sin(ang) * dist;
    const rad = (1 + rnd() * 2.4) * Math.max(0.6, grow * 0.8);
    const a = alpha * (0.5 + rnd() * 0.5);
    if (a <= 0.004) continue;
    for (let y = Math.floor(py - rad); y <= Math.ceil(py + rad); y++) {
      for (let x = Math.floor(px - rad); x <= Math.ceil(px + rad); x++) {
        if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > rad) continue;
        addPixel(canvas, x, y, r, g, b, a);
      }
    }
  }
}

/**
 * 畫一段序列的「光效層」（不含本體）。
 * @param anchor 每個光效的錨點對映函式 (srcXY) => canvasXY
 */
export function renderFxLayer(seq, frame, W, H, anchor,scale=1) {
  const canvas = makeCanvas(W, H);
  for (const source of seq.fx || []) {
    const layer={...source};
    for(const key of ['radius','width','length','spread'])if(typeof layer[key]==='number')layer[key]*=scale;
    const tf = sampleTrack(layer.track, frame);
    if (!tf || !tf.alpha) continue;
    const at = anchor(layer.at);
    if (layer.kind === 'glow') drawGlow(canvas, layer, tf, at);
    else if (layer.kind === 'ring') drawRing(canvas, layer, tf, at);
    else if (layer.kind === 'beam') drawBeam(canvas, layer, tf, at);
    else if (layer.kind === 'spark') drawSparks(canvas, layer, tf, at, frame);
  }
  return canvas;
}
