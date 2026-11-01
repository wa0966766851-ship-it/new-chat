import { rng, TAU } from "../../../design/sketchStroke";

let cached: string | undefined;
/** 紙纖維底紋（固定 seed 20240，與拾光行記 buildPaper 同源）：320×320 的 SVG 磚，只產生一次。 */
export function paperFiberDataUrl(): string {
  if (cached !== undefined) return cached;
  const R = rng(20240), S = 320;
  let body = "";
  for (let i = 0; i < 240; i++) {
    const x = R() * S, y = R() * S, len = 6 + R() * 26, a = R() * TAU, op = 0.045 + R() * 0.07;
    body += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(a) * len).toFixed(1)} ${(Math.sin(a) * len).toFixed(1)}" stroke="${i % 2 ? "#FFFFFF" : "#B9AC97"}" stroke-opacity="${(op * 2.2).toFixed(3)}" stroke-width="1"/>`;
  }
  cached = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${body}</svg>`)}`;
  return cached;
}
