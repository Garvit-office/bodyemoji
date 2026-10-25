/**
 * Config → finished, render-ready body (positions, normals, colours, index).
 */
import { buildBody, computeNormals } from './model.js';
import { paintBody } from './clothing.js';
import { adjacency, relax, cavity, inflate } from './finish.js';
import { resolveParams } from '../core/catalog.js';

const smooth = (e0, e1, v) => { let t = (v - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/**
 * Rectus abdominis: rows of rounded blocks either side of the linea alba,
 * pushed out along the normal. Body fat softens them.
 */
function sculptAbs(pos, normal, body, P, cloth) {
  const L = body.landmarks;
  const torsoLen = L.shoulderY - L.hipY;               // ≈ 0.5 m on an average body
  const k = torsoLen / 0.5;
  const top = L.navelY + 0.165 * k;                    // just under the pecs
  const bottom = L.navelY - 0.035 * k;
  const rows = P.absRows || 3;
  const rowH = (top - L.navelY + 0.01 * k) / Math.min(rows, 3);
  const fat = Math.max(0, P.macro.weight - 0.45) * 1.6;
  const amp = 0.005 * P.abs * Math.max(0.15, 1 - fat);
  const colW = 0.047 * k, gap = 0.007 * k, r = 0.012 * k;
  const blocks = [];
  for (let i = 0; i < rows; i++) {
    const y1 = top - i * rowH, y0 = i === 3 ? bottom : y1 - rowH; // 4th row is the lower abs
    blocks.push([(y0 + y1) / 2, (y1 - y0) / 2 - gap]);
  }
  const lowY = top - rows * rowH - 0.02;
  for (let v = 0; v < body.count; v++) {
    if (body.region[v] !== 0) continue;
    const x = body.rest[v * 3], y = body.rest[v * 3 + 1], z = body.rest[v * 3 + 2];
    if (z < L.navelZ - 0.06 || y < lowY - 0.02 || y > top + 0.02) continue;
    const ax = Math.abs(x);
    if (ax > colW * 1.3 + gap) continue;
    let bump = 0;
    for (const [cy, hh] of blocks) {
      const qx = Math.abs(ax - (gap + colW / 2)) - (colW / 2 - r), qy = Math.abs(y - cy) - (hh - r);
      const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
      const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
      const b = smooth(0.003, -0.016 * k, d);
      if (b > bump) bump = b;
    }
    const front = smooth(L.navelZ - 0.06, L.navelZ - 0.02, z);
    const m = amp * bump * front * (1 - cloth[v] * 0.6);
    pos[v * 3] += normal[v * 3] * m; pos[v * 3 + 1] += normal[v * 3 + 1] * m; pos[v * 3 + 2] += normal[v * 3 + 2] * m;
  }
}

/** One blur step of a scalar per-vertex field (max with neighbour mean). */
function spread(f, adj) {
  const { off, nb } = adj; const out = new Float32Array(f.length);
  for (let v = 0; v < f.length; v++) {
    let s = 0; for (let k = off[v]; k < off[v + 1]; k++) s += f[nb[k]];
    out[v] = Math.max(f[v], s / (off[v + 1] - off[v]));
  }
  return out;
}

export function makeBodymoji(config) {
  const P = resolveParams(config);
  const body = buildBody(P);
  const { color, cloth, waistband } = paintBody(body, config, P);
  const adj = adjacency(body.index, body.count);

  // fabric: tops are compression wear → heavily smoothed (Taubin, keeps volume);
  // bottoms get a lighter pass
  const n = body.count, topMask = new Float32Array(n), botMask = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const up = body.rest[v * 3 + 1] > waistband + 0.02 ? 1 : 0;
    topMask[v] = cloth[v] * up; botMask[v] = cloth[v] * (1 - up);
  }
  let pos = relax(body.position, adj, topMask, 24, 0.6, true);
  pos = relax(pos, adj, botMask, 8, 0.6, true);
  let normal = computeNormals(pos, body.index);
  if (P.abs > 0) sculptAbs(pos, normal, body, P, cloth);
  inflate(pos, normal, cloth);
  normal = computeNormals(pos, body.index);

  // cavity shading (skin only, softer on fabric)
  const cav = cavity(pos, normal, adj);
  const L = body.landmarks, absBoost = P.abs || 0;
  for (let v = 0; v < body.count; v++) {
    const y = body.rest[v * 3 + 1], z = body.rest[v * 3 + 2];
    // stronger definition on the front of the abdomen when abs are chosen
    const absZone = absBoost && body.region[v] === 0 && z > 0 && y > waistband && y < L.chestY + 0.05 ? absBoost * 0.9 : 0;
    const k = 1 - Math.min(0.85, cav[v] * (cloth[v] > 0.5 ? 0.12 : 0.42 * (1 + absZone)));
    color[v * 3] *= k; color[v * 3 + 1] *= k; color[v * 3 + 2] *= k;
  }
  return { position: pos, normal, color, cloth, index: body.index, count: body.count, height: P.height, params: P };
}
