/**
 * Surface finishing on the subdivided body:
 *  - fabric smoothing: covered areas are relaxed so tops/shorts read as
 *    stretched fabric (no anatomical detail through clothing)
 *  - cavity shading: concave areas (armpits, ab lines, folds) darken slightly,
 *    a cheap stand-in for ambient occlusion that makes muscle definition read.
 */
import { computeNormals } from './model.js';

let cachedAdj = null;
/** Vertex adjacency (CSR) from the triangle index of the subdivided mesh. */
export function adjacency(index, count) {
  if (cachedAdj && cachedAdj.count === count && cachedAdj.index === index) return cachedAdj;
  const sets = Array.from({ length: count }, () => new Set());
  // triangles come in quad pairs (a,b,c)(a,c,d): skip the shared diagonal a-c
  for (let i = 0; i < index.length; i += 6) {
    const a = index[i], b = index[i + 1], c = index[i + 2], d = index[i + 5];
    sets[a].add(b); sets[b].add(a); sets[b].add(c); sets[c].add(b);
    sets[c].add(d); sets[d].add(c); sets[d].add(a); sets[a].add(d);
  }
  const off = new Uint32Array(count + 1);
  for (let v = 0; v < count; v++) off[v + 1] = off[v] + sets[v].size;
  const nb = new Uint32Array(off[count]);
  for (let v = 0; v < count; v++) { let k = off[v]; for (const u of sets[v]) nb[k++] = u; }
  cachedAdj = { index, count, off, nb };
  return cachedAdj;
}

/** Laplacian relaxation weighted per vertex by mask (0..1). Taubin mode keeps volume. */
export function relax(pos, adj, mask, iterations = 4, strength = 0.6, taubin = false) {
  const { off, nb } = adj;
  const list = [];
  for (let v = 0; v < mask.length; v++) if (mask[v] > 0.001) list.push(v);
  const out = new Float32Array(pos);
  if (!list.length) return out;
  const tmp = new Float32Array(list.length * 3);
  for (let it = 0; it < iterations; it++) {
    const f = taubin && (it & 1) ? -strength * 1.04 : strength;
    for (let i = 0; i < list.length; i++) {
      const v = list[i], o = v * 3, s = off[v], e = off[v + 1];
      let x = 0, y = 0, z = 0;
      for (let k = s; k < e; k++) { const u = nb[k] * 3; x += out[u]; y += out[u + 1]; z += out[u + 2]; }
      const c = e - s, m = mask[v] * f;
      tmp[i * 3] = out[o] + (x / c - out[o]) * m;
      tmp[i * 3 + 1] = out[o + 1] + (y / c - out[o + 1]) * m;
      tmp[i * 3 + 2] = out[o + 2] + (z / c - out[o + 2]) * m;
    }
    for (let i = 0; i < list.length; i++) { const o = list[i] * 3; out[o] = tmp[i * 3]; out[o + 1] = tmp[i * 3 + 1]; out[o + 2] = tmp[i * 3 + 2]; }
  }
  return out;
}

/** Concavity per vertex in [0,1] (1 = deep crease), scale-independent and blurred. */
export function cavity(pos, normal, adj, lo = 0.015, hi = 0.14) {
  const { off, nb } = adj;
  const n = pos.length / 3;
  let raw = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const o = v * 3; let x = 0, y = 0, z = 0, el = 0; const s = off[v], e = off[v + 1];
    for (let k = s; k < e; k++) {
      const u = nb[k] * 3; x += pos[u]; y += pos[u + 1]; z += pos[u + 2];
      const dx = pos[u] - pos[o], dy = pos[u + 1] - pos[o + 1], dz = pos[u + 2] - pos[o + 2];
      el += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    const c = e - s;
    const d = (x / c - pos[o]) * normal[o] + (y / c - pos[o + 1]) * normal[o + 1] + (z / c - pos[o + 2]) * normal[o + 2];
    raw[v] = d / (el / c || 1);   // dimensionless curvature
  }
  // blur twice so creases read as soft occlusion, not speckle
  for (let it = 0; it < 3; it++) {
    const nxt = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      let sum = raw[v] * 2; const a = off[v], b = off[v + 1];
      for (let k = a; k < b; k++) sum += raw[nb[k]];
      nxt[v] = sum / (b - a + 2);
    }
    raw = nxt;
  }
  for (let v = 0; v < n; v++) {
    let t = (raw[v] - lo) / (hi - lo); t = t < 0 ? 0 : t > 1 ? 1 : t;
    raw[v] = t * t * (3 - 2 * t);
  }
  return raw;
}

/** Push cloth slightly outward so hems have a tiny ledge. */
export function inflate(pos, normal, mask, amount = 0.0022) {
  for (let v = 0; v < mask.length; v++) {
    const m = mask[v] * amount; if (!m) continue;
    const o = v * 3;
    pos[o] += normal[o] * m; pos[o + 1] += normal[o + 1] * m; pos[o + 2] += normal[o + 2] * m;
  }
}

export { computeNormals };
