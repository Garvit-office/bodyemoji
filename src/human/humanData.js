/**
 * Decodes the packed MakeHuman data (see tools/build_human.py) into typed arrays.
 * Done once, lazily (~20-60 ms on device).
 */
import { HUMAN_META, HUMAN_B64 } from '../data/humanData.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(str) {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  let len = str.length;
  while (str[len - 1] === '=') len--;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0, i = 0;
  for (; i + 4 <= len; i += 4) {
    const n = (lookup[str.charCodeAt(i)] << 18) | (lookup[str.charCodeAt(i + 1)] << 12)
      | (lookup[str.charCodeAt(i + 2)] << 6) | lookup[str.charCodeAt(i + 3)];
    out[o++] = (n >> 16) & 255; out[o++] = (n >> 8) & 255; out[o++] = n & 255;
  }
  const rem = len - i;
  if (rem === 2) {
    const n = (lookup[str.charCodeAt(i)] << 18) | (lookup[str.charCodeAt(i + 1)] << 12);
    out[o++] = (n >> 16) & 255;
  } else if (rem === 3) {
    const n = (lookup[str.charCodeAt(i)] << 18) | (lookup[str.charCodeAt(i + 1)] << 12) | (lookup[str.charCodeAt(i + 2)] << 6);
    out[o++] = (n >> 16) & 255; out[o++] = (n >> 8) & 255;
  }
  return out.buffer;
}

let cached = null;

export function getHumanData() {
  if (cached) return cached;
  const buf = decodeBase64(HUMAN_B64);
  const m = HUMAN_META;
  const L = m.layout;
  const nb = m.nBody, np = m.nPoints;
  const targets = {};
  for (const t of m.targets) {
    targets[t.key] = {
      n: t.n,
      idx: new Uint16Array(buf, t.idx, t.n),
      d: new Int16Array(buf, t.d, t.n * 3),
      s: t.s,
    };
  }
  cached = {
    nBody: nb,
    nPoints: np,
    nCaps: m.nCaps,
    nMesh: nb + m.nCaps,           // cap centres follow the body vertices
    scale: m.scale,
    base: new Float32Array(buf, L.base, np * 3),
    quads: new Uint16Array(buf, L.quads, L.nQuads * 4),
    tris: new Uint16Array(buf, L.tris, L.nTris * 3),
    skinIdx: new Uint8Array(buf, L.skinIdx, nb * 4),
    skinW: new Uint8Array(buf, L.skinW, nb * 4),
    region: new Uint8Array(buf, L.region, nb),
    detail: new Uint8Array(buf, L.detail, nb * 3), // nipple, navel, crotch masks
    limbT: new Uint8Array(buf, L.limbT, nb),
    bones: m.bones,
    targets,
  };
  return cached;
}

export const REGION = { TORSO: 0, NECK: 1, ARM: 2, HAND: 3, LEG: 4, FOOT: 5 };
