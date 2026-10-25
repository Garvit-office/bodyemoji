/**
 * Paints skin + tight athletic wear as vertex colours on the realistic body,
 * and returns a "cloth" mask used to give fabric a hair of thickness.
 * Classification uses the unposed (rest) body so colours never swim when posing.
 */
import { REGION } from './humanData.js';
import { OUTFITS } from '../core/catalog.js';

const sm = (e0, e1, v) => { let t = (v - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const below = (v, edge, w = 0.004) => sm(edge + w, edge - w, v);
const above = (v, edge, w = 0.004) => sm(edge - w, edge + w, v);

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const trimOf = (c) => (lum(c) > 0.2 ? [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55] : [c[0] * 0.5 + 0.1, c[1] * 0.5 + 0.1, c[2] * 0.5 + 0.1]);

const HEM = { shorts: 0.27, longshorts: 0.4, bike: 0.34, leggings: 0.955, joggers: 0.96 };
const SLEEVE = { none: -1, bra: -1, tank: -1, tee: 0.27, long: 0.95 };
const SOCK = { none: 2, ankle: 0.9, crew: 0.78 };

export function paintBody(body, config, params) {
  const { rest, region, limbT, landmarks: L } = body;
  const n = body.count;
  const color = new Float32Array(n * 3);
  const cloth = new Float32Array(n);
  const outfit = OUTFITS.find((o) => o.id === config.outfit) || OUTFITS[0];
  const skin = hexToLinear(config.skin);
  const top = hexToLinear(config.top), bottom = hexToLinear(config.bottom), sock = hexToLinear(config.shoes);
  const topTrim = trimOf(top), botTrim = trimOf(bottom);
  const belly = params?.belly || 0;

  const hem = HEM[outfit.bottom] ?? 0.3;
  const sleeve = SLEEVE[outfit.top] ?? -1;
  const sockT = SOCK[config.socks || 'ankle'] ?? 2;
  const waistband = L.hipY + (L.waistY - L.hipY) * 0.62;
  const shY = L.shoulderY;
  const braLow = shY - 0.27 - 0.02 * (params?.cup || 0);
  const braHigh = shY - 0.1;
  const c = [0, 0, 0];
  let cov = 0;
  const put = (col, w) => {
    if (w <= 0) return;
    c[0] += (col[0] - c[0]) * w; c[1] += (col[1] - c[1]) * w; c[2] += (col[2] - c[2]) * w;
    if (col !== skin) cov = Math.max(cov, w);
  };

  for (let i = 0; i < n; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const ax = Math.abs(x);
    const r = region[i], t = limbT[i];
    c[0] = skin[0]; c[1] = skin[1]; c[2] = skin[2]; cov = 0;

    if (r === REGION.TORSO || r === REGION.NECK) {
      const torso = r === REGION.TORSO;
      if (torso && outfit.top === 'bra') {
        const band = above(y, braLow, 0.006) * below(y, braHigh, 0.006);
        const strap = above(y, braHigh - 0.01) * below(Math.abs(ax - L.shoulderX * 0.5), 0.015, 0.006);
        put(top, Math.max(band, strap));
        put(topTrim, band * below(y, braLow + 0.018, 0.003));
      } else if (torso && outfit.top === 'tank') {
        const strapZone = above(y, shY - 0.13, 0.01);
        const strap = below(Math.abs(ax - L.shoulderX * 0.5), L.shoulderX * 0.22, 0.004);
        const scoop = (z > L.neckZ ? 1 : 0) * above(y, shY - 0.14) * below(ax, L.shoulderX * 0.42, 0.006);
        const armhole = above(ax, L.shoulderX * 0.8, 0.008) * above(y, shY - 0.11, 0.012);
        put(top, (1 - Math.max(strapZone * (1 - strap), scoop, armhole)));
      } else if (outfit.top === 'tee' || outfit.top === 'long') {
        // crew neck: open within a ring around the neck, slightly lower at the front
        const dz = z - L.neckZ;
        const rn = Math.sqrt(x * x + dz * dz);
        const ring = L.neckR + 0.014 + (dz > 0 ? 0.012 * sm(0, L.neckR, dz) : 0);
        const open = below(rn, ring, 0.007) * above(y, shY - 0.09, 0.012);
        const covered = 1 - open;
        put(top, covered);
        put(topTrim, covered * below(rn, ring + 0.016, 0.006) * above(y, shY - 0.1, 0.012));
      }
      if (torso) {
        const dip = (z > 0 ? sm(0.0, 0.12, z) : 0) * 0.06 * belly;
        const wb = waistband - dip;
        const cv = below(y, wb, 0.004);
        put(bottom, cv);
        put(botTrim, cv * above(y, wb - 0.032, 0.003));
      }
    } else if (r === REGION.ARM || r === REGION.HAND) {
      if (sleeve > 0 && r === REGION.ARM) {
        const cv = below(t, sleeve, 0.012);
        put(top, cv);
        put(topTrim, cv * above(t, sleeve - 0.04, 0.008));
      }
    } else if (r === REGION.LEG) {
      const cv = below(t, hem, 0.014) * below(y, waistband, 0.004);
      put(bottom, cv);
      put(botTrim, cv * above(y, waistband - 0.032, 0.003));
      if (outfit.bottom === 'joggers') put(botTrim, cv * above(t, hem - 0.06, 0.008));
      else if (outfit.bottom !== 'leggings') put(botTrim, cv * above(t, hem - 0.025, 0.005));
      if (sockT < 1.5 && sockT > hem) {
        const s = above(t, sockT, 0.006);
        put(sock, s);
        put(trimOf(sock), s * below(t, sockT + 0.025, 0.005));
      }
    } else if (r === REGION.FOOT) {
      if (sockT < 1.5) put(sock, 1);
      else if (hem > 0.9) put(bottom, above(y, 0.07, 0.006));
    }
    color[i * 3] = c[0]; color[i * 3 + 1] = c[1]; color[i * 3 + 2] = c[2];
    cloth[i] = cov;
  }
  return { color, cloth, waistband };
}
