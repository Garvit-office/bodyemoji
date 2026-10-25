/**
 * Realistic human body: MakeHuman base mesh + morph targets + skeleton pose
 * + one level of Catmull-Clark subdivision. Everything is plain typed-array
 * math (no three.js), so it runs the same on Hermes and on the web.
 *
 *   buildBody(params) → { position, normal, index, region, limbT, rest, landmarks }
 */
import { getHumanData } from './humanData.js';

/* ── small vector / matrix helpers (column-major 4x4, like three.js) ── */
const v3 = (a, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function mIdentity() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
function mMul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function mApply(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
/** Inverse of a rigid (rotation + translation) matrix. */
function mInvRigid(m) {
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  const t = mApply(r, [m[12], m[13], m[14]]);
  r[12] = -t[0]; r[13] = -t[1]; r[14] = -t[2];
  return r;
}
/** Rotation by `ang` around unit `axis`, pivoting at point `c`. */
function mRotateAbout(axis, ang, c) {
  const [x, y, z] = axis, s = Math.sin(ang), co = Math.cos(ang), t = 1 - co;
  const r = [t * x * x + co, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + co, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + co, 0, 0, 0, 0, 1];
  const rc = mApply(r, c);
  r[12] = c[0] - rc[0]; r[13] = c[1] - rc[1]; r[14] = c[2] - rc[2];
  return r;
}
/** Shortest rotation taking direction a to direction b, pivoting at c. */
function mAim(a, b, c, amount = 1) {
  a = norm(a); b = norm(b);
  const ax = cross(a, b);
  const s = len(ax);
  if (s < 1e-6) return mIdentity();
  const ang = Math.atan2(s, dot(a, b)) * amount;
  return mRotateAbout(mul(ax, 1 / s), ang, c);
}

/* ── morphing ─────────────────────────────────────────────────────── */

function macroWeights(v) {
  const min = Math.max(0, 1 - 2 * v), max = Math.max(0, 2 * v - 1);
  return { min, average: 1 - min - max, max };
}

/** params.macro = { gender (1 male), muscle, weight, cup }, params.t = { targetName: -1..1 } */
export function targetWeights(params) {
  const { gender, muscle, weight, cup = 0.5 } = params.macro;
  const w = {};
  const G = { male: gender, female: 1 - gender };
  const M = macroWeights(muscle), W = macroWeights(weight);
  for (const g of ['male', 'female']) {
    if (!G[g]) continue;
    for (const m of ['min', 'average', 'max']) for (const ww of ['min', 'average', 'max']) {
      const x = G[g] * M[m] * W[ww];
      if (x) w[`u-${g}-${m}-${ww}`] = x;
    }
    for (const e of ['african', 'asian', 'caucasian']) w[`e-${g}-${e}`] = G[g] / 3;
  }
  if (G.female) {
    const cMin = Math.max(0, 1 - 2 * cup), cMax = Math.max(0, 2 * cup - 1);
    for (const m of ['min', 'average', 'max']) for (const ww of ['min', 'average', 'max']) {
      const x = G.female * M[m] * W[ww];
      if (cMin) w[`b-${m}-${ww}-min`] = x * cMin;
      if (cMax) w[`b-${m}-${ww}-max`] = x * cMax;
    }
  }
  for (const k in params.t || {}) {
    const v = params.t[k];
    if (!v) continue;
    const key = v > 0 ? `${k}-incr` : `${k}-decr`;
    w[key] = (w[key] || 0) + Math.abs(v);
  }
  return w;
}

function morph(H, weights) {
  const P = new Float32Array(H.base);
  for (const key in weights) {
    const t = H.targets[key];
    const wt = weights[key];
    if (!t || !wt) continue;
    const k = wt * t.s;
    const { idx, d, n } = t;
    for (let i = 0; i < n; i++) {
      const o = idx[i] * 3, j = i * 3;
      P[o] += d[j] * k; P[o + 1] += d[j + 1] * k; P[o + 2] += d[j + 2] * k;
    }
  }
  return P;
}

/* ── skeleton + pose ──────────────────────────────────────────────── */

function boneByName(H) {
  if (!H._bone) { H._bone = {}; H.bones.forEach((b, i) => { H._bone[b.name] = i; }); }
  return H._bone;
}

/**
 * Build world-space bone matrices for a pose.
 * Arms are posed by aiming the elbow and wrist at targets (simple 2-bone IK).
 */
function poseMatrices(H, P, pose, posture) {
  const B = H.bones, idx = boneByName(H);
  const head = (n) => v3(P, B[idx[n]].head);
  const tail = (n) => v3(P, B[idx[n]].tail);
  const local = B.map(() => mIdentity());   // world-space rotation applied in rest frame

  // posture: bend the upper spine
  const slouch = posture?.slouch || 0, proud = posture?.proud || 0;
  const bend = (slouch * 0.16 - proud * 0.07);
  if (bend) {
    for (const n of ['spine03', 'spine02', 'spine01']) {
      if (idx[n] == null) continue;
      local[idx[n]] = mRotateAbout([1, 0, 0], bend * 0.6, head(n));
    }
    for (const s of ['L', 'R']) {
      const n = `clavicle.${s}`;
      if (idx[n] != null) local[idx[n]] = mRotateAbout([1, 0, 0], slouch * 0.18 - proud * 0.1, head(n));
    }
  }

  // world matrices (parents first: bones are stored in hierarchy order)
  const world = new Array(B.length);
  const compute = () => {
    for (let i = 0; i < B.length; i++) {
      const p = B[i].parent;
      world[i] = p >= 0 ? mMul(world[p], local[i]) : local[i];
    }
  };
  compute();

  const hipL = head('upperleg01.L'), hipR = head('upperleg01.R');
  const hipY = (hipL[1] + hipR[1]) / 2;
  for (const s of ['L', 'R']) {
    const side = Math.sign(head(`upperarm01.${s}`)[0]) || (s === 'L' ? 1 : -1);
    const ua = idx[`upperarm01.${s}`], la = idx[`lowerarm01.${s}`], wr = idx[`wrist.${s}`];
    const S = mApply(world[ua], head(`upperarm01.${s}`));
    const E0 = head(`lowerarm01.${s}`), W0 = head(`wrist.${s}`);
    const lu = len(sub(E0, head(`upperarm01.${s}`))), lf = len(sub(W0, E0));
    const hipOut = Math.abs(hipL[0] - hipR[0]) / 2;
    let Edir, Wdir;
    switch (pose) {
      case 'apose':
        Edir = null; break; // rest pose of the base mesh
      case 'hips': {
        // hand on the side of the hip, elbow out and slightly back
        const Wt = [side * (hipOut + 0.55 + (posture?.width || 0)), hipY + 1.15, 0.1];
        const Et = [S[0] + side * (lu * 0.62), S[1] - lu * 0.72, S[2] - lu * 0.32];
        Edir = norm(sub(Et, S));
        const Ep = addv(S, mul(Edir, lu));
        Wdir = norm(sub(Wt, Ep));
        break;
      }
      case 'flex': {
        // double-biceps: upper arm horizontal, forearm up, slightly forward
        Edir = norm([side * 0.97, 0.08, -0.12]);
        Wdir = norm([side * -0.12, 0.98, 0.2]);
        break;
      }
      case 'relaxed':
      default: {
        // arms hanging, slight elbow bend; wider bodies push the arms out
        const out = 0.13 + (posture?.width || 0) * 0.12;
        Edir = norm([side * out, -1, -0.05]);
        Wdir = norm([side * (out * 0.6), -1, 0.13]);
      }
    }
    if (Edir) {
      const Ecur = mApply(world[ua], E0);
      const pw = B[ua].parent >= 0 ? world[B[ua].parent] : mIdentity();
      local[ua] = mMul(mMul(mMul(mInvRigid(pw), mAim(sub(Ecur, S), Edir, S)), pw), local[ua]);
      compute();
      const E = mApply(world[la], E0);
      const Wcur = mApply(world[la], W0);
      const pl = world[B[la].parent];
      local[la] = mMul(mMul(mMul(mInvRigid(pl), mAim(sub(Wcur, E), Wdir, E)), pl), local[la]);
      compute();
      void lf; void wr;
    }
  }

  // skinning matrices: world * inverse(rest) — rest is identity here because
  // every local rotation already pivots around rest-space joint positions.
  return world;
}

function skin(H, P, mats) {
  const nb = H.nBody, nm = H.nMesh;
  const out = new Float32Array(nm * 3);
  const si = H.skinIdx, sw = H.skinW;
  for (let v = 0; v < nb; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw[v * 4 + k];
      if (!w) continue;
      const m = mats[si[v * 4 + k]];
      const f = w / 255;
      ox += (m[0] * x + m[4] * y + m[8] * z + m[12]) * f;
      oy += (m[1] * x + m[5] * y + m[9] * z + m[13]) * f;
      oz += (m[2] * x + m[6] * y + m[10] * z + m[14]) * f;
    }
    out[v * 3] = ox; out[v * 3 + 1] = oy; out[v * 3 + 2] = oz;
  }
  // neck cap centres ride on the neck bone
  const neck = mats[boneByName(H).neck01];
  for (let v = nb; v < nm; v++) {
    const p = mApply(neck, v3(P, v));
    out[v * 3] = p[0]; out[v * 3 + 1] = p[1]; out[v * 3 + 2] = p[2];
  }
  return out;
}

/* ── detail smoothing on the base mesh ─────────────────────────────── */
let baseAdj = null;
function baseAdjacency(H) {
  if (baseAdj) return baseAdj;
  const t = topology(H);
  const sets = Array.from({ length: H.nMesh }, () => new Set());
  for (const f of t.faces) for (let k = 0; k < f.length; k++) { const a = f[k], b = f[(k + 1) % f.length]; sets[a].add(b); sets[b].add(a); }
  baseAdj = sets.map((s) => Uint32Array.from(s));
  return baseAdj;
}
/**
 * Nipples and the crotch are always relaxed (clean avatar look, nothing
 * shows through fabric); the navel only when a top covers the belly.
 */
function smoothDetails(H, pos, cover) {
  const adj = baseAdjacency(H);
  const D = H.detail, nb = H.nBody;
  const nip = new Float32Array(nb);
  let w = new Float32Array(nb);
  for (let v = 0; v < nb; v++) {
    nip[v] = D[v * 3] / 255;
    w[v] = Math.max(Math.min(1, nip[v] * 1.5), D[v * 3 + 1] / 255 * (cover.belly ? 1 : 0), D[v * 3 + 2] / 255);
  }
  // grow the mask a few rings with falloff
  for (let r = 0; r < 3; r++) {
    const g = new Float32Array(nb);
    for (let v = 0; v < nb; v++) {
      let m = w[v]; const a = adj[v];
      for (let k = 0; k < a.length; k++) if (a[k] < nb && w[a[k]] * 0.7 > m) m = w[a[k]] * 0.7;
      g[v] = m;
    }
    w = g;
  }
  // 1) fabric compresses the tip of the bust: soft-clamp how far forward it can reach
  if (cover.top) {
    for (const side of [1, -1]) {
      let apex = -Infinity;
      for (let v = 0; v < nb; v++) if (nip[v] > 0.4 && Math.sign(pos[v * 3]) === side && pos[v * 3 + 2] > apex) apex = pos[v * 3 + 2];
      if (apex === -Infinity) continue;
      const cap = apex - 0.27, k = 0.1; // decimetres
      for (let v = 0; v < nb; v++) {
        if (!w[v] || Math.sign(pos[v * 3]) !== side) continue;
        const ex = pos[v * 3 + 2] - cap;
        const soft = k * Math.log(1 + Math.exp(ex / k));     // softplus
        pos[v * 3 + 2] -= Math.min(1, w[v] * 1.4) * Math.max(0, soft - Math.max(0, -ex) * 0) * 0.85 * (ex > -3 * k ? 1 : 0);
      }
    }
  }
  // 2) relax the masked region
  const list = [];
  for (let v = 0; v < nb; v++) if (w[v] > 0.01) list.push(v);
  const nx = new Float32Array(list.length * 3);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < list.length; i++) {
      const v = list[i], o = v * 3, a = adj[v];
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < a.length; k++) { const u = a[k] * 3; x += pos[u]; y += pos[u + 1]; z += pos[u + 2]; }
      const m = w[v] * 0.55;
      nx[i * 3] = pos[o] + (x / a.length - pos[o]) * m;
      nx[i * 3 + 1] = pos[o + 1] + (y / a.length - pos[o + 1]) * m;
      nx[i * 3 + 2] = pos[o + 2] + (z / a.length - pos[o + 2]) * m;
    }
    for (let i = 0; i < list.length; i++) {
      const o = list[i] * 3; pos[o] = nx[i * 3]; pos[o + 1] = nx[i * 3 + 1]; pos[o + 2] = nx[i * 3 + 2];
    }
  }
}

/** Flatten the neck cut and lift the cap centre into a smooth mannequin dome. */
let neckLoop = null;
function domeNeck(H, pos) {
  if (!neckLoop) {
    const set = new Set(), caps = new Set();
    for (let i = 0; i < H.tris.length; i += 3) {
      const tri = [H.tris[i], H.tris[i + 1], H.tris[i + 2]];
      if (tri.some((v) => v >= H.nBody)) for (const v of tri) (v >= H.nBody ? caps : set).add(v);
    }
    neckLoop = { loop: [...set], caps: [...caps] };
  }
  const { loop, caps } = neckLoop;
  let cx = 0, cy = 0, cz = 0;
  for (const v of loop) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
  cx /= loop.length; cy /= loop.length; cz /= loop.length;
  let r = 0;
  for (const v of loop) r += Math.hypot(pos[v * 3] - cx, pos[v * 3 + 2] - cz);
  r /= loop.length;
  for (const v of loop) pos[v * 3 + 1] = cy;
  for (const v of caps) { pos[v * 3] = cx; pos[v * 3 + 1] = cy + r * 0.28; pos[v * 3 + 2] = cz; }
}

/* ── Catmull-Clark (one level) ────────────────────────────────────── */

let topo = null;
function topology(H) {
  if (topo) return topo;
  const faces = [];
  for (let i = 0; i < H.quads.length; i += 4) faces.push([H.quads[i], H.quads[i + 1], H.quads[i + 2], H.quads[i + 3]]);
  for (let i = 0; i < H.tris.length; i += 3) faces.push([H.tris[i], H.tris[i + 1], H.tris[i + 2]]);
  const nv = H.nMesh, nf = faces.length;
  const edgeMap = new Map();
  const eV = [], eF = [];
  const faceEdges = [];
  for (let f = 0; f < nf; f++) {
    const fv = faces[f]; const fe = [];
    for (let k = 0; k < fv.length; k++) {
      const a = fv[k], b = fv[(k + 1) % fv.length];
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let e = edgeMap.get(key);
      if (e === undefined) { e = eV.length / 2; edgeMap.set(key, e); eV.push(a, b); eF.push(f, -1); }
      else eF[e * 2 + 1] = f;
      fe.push(e);
    }
    faceEdges.push(fe);
  }
  const ne = eV.length / 2;
  // per-vertex incident faces / edges (CSR)
  const vf = Array.from({ length: nv }, () => []), ve = Array.from({ length: nv }, () => []);
  faces.forEach((fv, f) => fv.forEach((v) => vf[v].push(f)));
  for (let e = 0; e < ne; e++) { ve[eV[e * 2]].push(e); ve[eV[e * 2 + 1]].push(e); }
  // output quads: vertex points [0,nv), edge points [nv, nv+ne), face points [nv+ne, …)
  const quads = [];
  faces.forEach((fv, f) => {
    const n = fv.length, fe = faceEdges[f];
    for (let k = 0; k < n; k++) {
      quads.push(fv[k], nv + fe[k], nv + ne + f, nv + fe[(k + n - 1) % n]);
    }
  });
  const index = new Uint32Array(quads.length / 4 * 6);
  for (let q = 0, o = 0; q < quads.length; q += 4) {
    index[o++] = quads[q]; index[o++] = quads[q + 1]; index[o++] = quads[q + 2];
    index[o++] = quads[q]; index[o++] = quads[q + 2]; index[o++] = quads[q + 3];
  }
  topo = { faces, nv, nf, ne, eV: Uint32Array.from(eV), eF: Int32Array.from(eF), vf, ve, quads: Uint32Array.from(quads), index, total: nv + ne + nf };
  return topo;
}

function subdivide(t, P) {
  const { faces, nv, nf, ne, eV, eF, vf, ve } = t;
  const out = new Float32Array(t.total * 3);
  const FP = nv + ne;
  for (let f = 0; f < nf; f++) {
    const fv = faces[f]; let x = 0, y = 0, z = 0;
    for (let k = 0; k < fv.length; k++) { x += P[fv[k] * 3]; y += P[fv[k] * 3 + 1]; z += P[fv[k] * 3 + 2]; }
    const o = (FP + f) * 3, n = fv.length;
    out[o] = x / n; out[o + 1] = y / n; out[o + 2] = z / n;
  }
  for (let e = 0; e < ne; e++) {
    const a = eV[e * 2] * 3, b = eV[e * 2 + 1] * 3, fa = (FP + eF[e * 2]) * 3, fb = eF[e * 2 + 1];
    const o = (nv + e) * 3;
    if (fb < 0) { // boundary (should not happen — mesh is closed)
      out[o] = (P[a] + P[b]) / 2; out[o + 1] = (P[a + 1] + P[b + 1]) / 2; out[o + 2] = (P[a + 2] + P[b + 2]) / 2;
    } else {
      const f2 = (FP + fb) * 3;
      out[o] = (P[a] + P[b] + out[fa] + out[f2]) / 4;
      out[o + 1] = (P[a + 1] + P[b + 1] + out[fa + 1] + out[f2 + 1]) / 4;
      out[o + 2] = (P[a + 2] + P[b + 2] + out[fa + 2] + out[f2 + 2]) / 4;
    }
  }
  for (let v = 0; v < nv; v++) {
    const fs = vf[v], es = ve[v], n = es.length;
    let qx = 0, qy = 0, qz = 0, rx = 0, ry = 0, rz = 0;
    for (let k = 0; k < fs.length; k++) { const o = (FP + fs[k]) * 3; qx += out[o]; qy += out[o + 1]; qz += out[o + 2]; }
    qx /= fs.length; qy /= fs.length; qz /= fs.length;
    for (let k = 0; k < n; k++) {
      const e = es[k], a = eV[e * 2] * 3, b = eV[e * 2 + 1] * 3;
      rx += (P[a] + P[b]) / 2; ry += (P[a + 1] + P[b + 1]) / 2; rz += (P[a + 2] + P[b + 2]) / 2;
    }
    rx /= n; ry /= n; rz /= n;
    const o = v * 3;
    out[o] = (qx + 2 * rx + (n - 3) * P[o]) / n;
    out[o + 1] = (qy + 2 * ry + (n - 3) * P[o + 1]) / n;
    out[o + 2] = (qz + 2 * rz + (n - 3) * P[o + 2]) / n;
  }
  return out;
}

/** Per-vertex attributes carried through subdivision (computed once). */
let subAttr = null;
function subdividedAttributes(H, t) {
  if (subAttr) return subAttr;
  const region = new Uint8Array(t.total), limbT = new Float32Array(t.total), bust = new Float32Array(t.total);
  const nb = H.nBody;
  const r = (v) => (v < nb ? H.region[v] : 1);
  const l = (v) => (v < nb ? H.limbT[v] / 255 : 0);
  const b = (v) => (v < nb ? H.detail[v * 3] / 255 : 0);
  for (let v = 0; v < t.nv; v++) { region[v] = r(v); limbT[v] = l(v); bust[v] = b(v); }
  for (let e = 0; e < t.ne; e++) {
    const a = t.eV[e * 2], c = t.eV[e * 2 + 1];
    region[t.nv + e] = r(a); limbT[t.nv + e] = (l(a) + l(c)) / 2; bust[t.nv + e] = (b(a) + b(c)) / 2;
  }
  for (let f = 0; f < t.nf; f++) {
    const fv = t.faces[f]; let s = 0, sb = 0;
    for (const v of fv) { s += l(v); sb += b(v); }
    region[t.nv + t.ne + f] = r(fv[0]); limbT[t.nv + t.ne + f] = s / fv.length; bust[t.nv + t.ne + f] = sb / fv.length;
  }
  subAttr = { region, limbT, bust };
  return subAttr;
}

export function computeNormals(pos, index) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
    n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
    n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.sqrt(n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

/**
 * @param {{macro, t, pose, posture, subdivide?}} params
 */
export function buildBody(params) {
  const H = getHumanData();
  const P = morph(H, targetWeights(params));
  const mats = poseMatrices(H, P, params.pose || 'relaxed', params.posture);
  const posed = skin(H, P, mats);
  smoothDetails(H, posed, params.cover || {});
  domeNeck(H, posed);
  const restMesh = P.subarray(0, H.nMesh * 3);

  // landmarks (rest pose, model units) for clothing
  const idx = boneByName(H);
  const jy = (n, w = 'head') => P[H.bones[idx[n]][w] * 3 + 1];
  const landmarks = {
    hipY: (jy('upperleg01.L') + jy('upperleg01.R')) / 2,
    waistY: jy('spine04'),
    navelY: jy('spine05', 'tail'),
    chestY: jy('spine02'),
    shoulderY: jy('shoulder01.L'),
    neckY: jy('neck01'),
    kneeY: jy('lowerleg01.L'),
    shoulderX: Math.abs(P[H.bones[idx['shoulder01.L']].head * 3]),
    hipX: Math.abs(P[H.bones[idx['upperleg01.L']].head * 3]),
    neckZ: P[H.bones[idx.neck01].head * 3 + 2],
    neckR: 0,
  };
  { // neck radius = mean horizontal distance of neck vertices from the neck axis
    let sum = 0, cnt = 0; const nx = P[H.bones[idx.neck01].head * 3];
    for (let v = 0; v < H.nBody; v++) {
      if (H.region[v] !== 1) continue;
      const dx = P[v * 3] - nx, dz = P[v * 3 + 2] - landmarks.neckZ;
      sum += Math.sqrt(dx * dx + dz * dz); cnt++;
    }
    landmarks.neckR = cnt ? sum / cnt : 0.6;
    // navel centre (rest), from the navel detail mask
    let w = 0, ny = 0, nz = 0;
    for (let v = 0; v < H.nBody; v++) { const m = H.detail[v * 3 + 1]; if (m > 150) { w += m; ny += P[v * 3 + 1] * m; nz += P[v * 3 + 2] * m; } }
    landmarks.navelY = w ? ny / w : landmarks.navelY;
    landmarks.navelZ = w ? nz / w : 1.2;
  }

  const t = topology(H);
  let position, rest, index, region, limbT, bust;
  if (params.subdivide !== false) {
    position = subdivide(t, posed);
    rest = subdivide(t, restMesh);
    index = t.index;
    ({ region, limbT, bust } = subdividedAttributes(H, t));
  } else {
    position = posed;
    rest = new Float32Array(restMesh);
    const tri = [];
    for (let i = 0; i < H.quads.length; i += 4) tri.push(H.quads[i], H.quads[i + 1], H.quads[i + 2], H.quads[i], H.quads[i + 2], H.quads[i + 3]);
    for (let i = 0; i < H.tris.length; i++) tri.push(H.tris[i]);
    index = Uint32Array.from(tri);
    region = new Uint8Array(H.nMesh); limbT = new Float32Array(H.nMesh); bust = new Float32Array(H.nMesh);
    for (let v = 0; v < H.nBody; v++) { region[v] = H.region[v]; limbT[v] = H.limbT[v] / 255; }
    for (let v = H.nBody; v < H.nMesh; v++) region[v] = 1;
  }

  // to metres, feet on the ground
  const s = H.scale;
  let minY = Infinity;
  for (let i = 1; i < position.length; i += 3) if (position[i] < minY) minY = position[i];
  let restMin = Infinity;
  for (let i = 1; i < rest.length; i += 3) if (rest[i] < restMin) restMin = rest[i];
  for (let i = 0; i < position.length; i++) position[i] *= s;
  for (let i = 1; i < position.length; i += 3) position[i] -= minY * s;
  for (let i = 0; i < rest.length; i++) rest[i] *= s;
  for (let i = 1; i < rest.length; i += 3) rest[i] -= restMin * s;
  for (const k in landmarks) landmarks[k] = (k.endsWith('X') || k.endsWith('Z') || k === 'neckR') ? landmarks[k] * s : (landmarks[k] - restMin) * s;

  const normal = computeNormals(position, index);
  return { position, normal, index, region, limbT, bust, rest, landmarks, count: position.length / 3 };
}
