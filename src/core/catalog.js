/**
 * Bodymoji option catalog + config schema.
 *
 * A config is a small JSON object of option ids (safe to store / send to an API).
 * `resolveParams(config)` turns it into the numeric shape parameters the
 * sculptor uses. Each body type sets a full baseline; every detail category
 * then either keeps that baseline ("Match body") or overrides part of it.
 */

/* ── Colours ────────────────────────────────────────────────────────── */

export const SKIN_TONES = [
  { id: 'porcelain', label: 'Porcelain', hex: '#f8dccb' },
  { id: 'ivory', label: 'Ivory', hex: '#f1cdb3' },
  { id: 'sand', label: 'Sand', hex: '#e8b994' },
  { id: 'honey', label: 'Honey', hex: '#d9a175' },
  { id: 'golden', label: 'Golden', hex: '#c88a5a' },
  { id: 'caramel', label: 'Caramel', hex: '#b07448' },
  { id: 'bronze', label: 'Bronze', hex: '#8f5a35' },
  { id: 'mocha', label: 'Mocha', hex: '#6f4329' },
  { id: 'espresso', label: 'Espresso', hex: '#4f2f1f' },
  { id: 'ebony', label: 'Ebony', hex: '#3a2318' },
];

export const CLOTH_COLORS = [
  { id: 'black', label: 'Black', hex: '#1d1f26' },
  { id: 'charcoal', label: 'Charcoal', hex: '#3d424f' },
  { id: 'white', label: 'White', hex: '#eef0f4' },
  { id: 'navy', label: 'Navy', hex: '#1f2e5c' },
  { id: 'royal', label: 'Royal', hex: '#2f5fd0' },
  { id: 'teal', label: 'Teal', hex: '#0f8a86' },
  { id: 'olive', label: 'Olive', hex: '#5b6b32' },
  { id: 'red', label: 'Red', hex: '#d0343c' },
  { id: 'coral', label: 'Coral', hex: '#f0715e' },
  { id: 'pink', label: 'Pink', hex: '#ec6fa6' },
  { id: 'lilac', label: 'Lilac', hex: '#9b7fe0' },
  { id: 'sun', label: 'Sun', hex: '#f2b830' },
];

/* ── Shape model ────────────────────────────────────────────────────
 * The body is a MakeHuman mesh driven by:
 *   macro: gender (1 = male), muscle 0..1, weight 0..1, cup 0..1 (female)
 *   t:     local morph targets, each -1..1 (see tools/build_human.py)
 */

const BASE = {
  male: { macro: { muscle: 0.5, weight: 0.5, cup: 0.5 }, t: {}, height: 1 },
  female: { macro: { muscle: 0.5, weight: 0.5, cup: 0.5 }, t: {}, height: 0.94 },
};

/* ── Body types (full baselines) ────────────────────────────────────── */

export const BODY_TYPES = {
  male: [
    { id: 'skinny', label: 'Skinny', hint: 'Lean, narrow frame', macro: { muscle: 0.3, weight: 0.05 }, t: { shoulders: -0.3, 'upperarm-fat': -0.4, 'upperleg-fat': -0.4 } },
    { id: 'slim', label: 'Slim', hint: 'Light & trim', macro: { muscle: 0.45, weight: 0.28 } },
    { id: 'average', label: 'Average', hint: 'Everyday build', macro: { muscle: 0.5, weight: 0.5 } },
    { id: 'athletic', label: 'Athletic', hint: 'Sporty & defined', abs: 0.35, macro: { muscle: 0.8, weight: 0.35 }, t: { 'torso-vshape': 0.35, 'stomach-tone': 0.6 } },
    { id: 'muscular', label: 'Muscular', hint: 'Big & strong', abs: 0.55, macro: { muscle: 0.95, weight: 0.45 }, t: { 'torso-vshape': 0.6, 'torso-pectoral': 0.5, 'torso-dorsi': 0.5, 'shoulder-muscle': 0.5, 'upperarm-muscle': 0.5, 'stomach-tone': 0.8 } },
    { id: 'bodybuilder', label: 'Bodybuilder', hint: 'Stage-ready mass', abs: 0.85, macro: { muscle: 1, weight: 0.55 }, t: { 'torso-vshape': 1, 'torso-pectoral': 1, 'torso-dorsi': 1, 'shoulder-muscle': 1, 'upperarm-muscle': 1, 'lowerarm-muscle': 0.8, 'upperleg-muscle': 0.9, 'lowerleg-muscle': 0.8, 'stomach-tone': 1, waist: -0.3, neck: 0.6 } },
    { id: 'dadbod', label: 'Dad bod', hint: 'Strong-ish, soft middle', macro: { muscle: 0.6, weight: 0.68 }, t: { 'stomach-pregnant': 0.3, 'stomach-tone': -0.4 } },
    { id: 'chubby', label: 'Chubby', hint: 'Soft all over', macro: { muscle: 0.4, weight: 0.78 }, t: { 'stomach-pregnant': 0.25, 'stomach-tone': -0.6 } },
    { id: 'overweight', label: 'Overweight', hint: 'Fuller frame', macro: { muscle: 0.42, weight: 0.9 }, t: { 'stomach-pregnant': 0.4, 'stomach-tone': -0.8, waist: 0.3 } },
    { id: 'obese', label: 'Obese', hint: 'Heavy, fat over fat', macro: { muscle: 0.4, weight: 1 }, t: { 'stomach-pregnant': 0.7, 'stomach-tone': -1, waist: 0.6, 'upperarm-fat': 0.6, 'upperleg-fat': 0.5, neck: 0.5 } },
  ],
  female: [
    { id: 'petite', label: 'Petite', hint: 'Small & delicate', macro: { muscle: 0.4, weight: 0.3, cup: 0.35 }, height: 0.9 },
    { id: 'slim', label: 'Slim', hint: 'Long & lean', macro: { muscle: 0.45, weight: 0.25, cup: 0.4 } },
    { id: 'average', label: 'Average', hint: 'Everyday build', macro: { muscle: 0.5, weight: 0.5, cup: 0.5 } },
    { id: 'athletic', label: 'Athletic', hint: 'Sporty & strong', abs: 0.3, macro: { muscle: 0.8, weight: 0.38, cup: 0.45 }, t: { 'stomach-tone': 0.7, buttocks: 0.4, 'upperleg-muscle': 0.4 } },
    { id: 'toned', label: 'Fit & toned', hint: 'Lean with definition', abs: 0.25, macro: { muscle: 0.68, weight: 0.32, cup: 0.45 }, t: { 'stomach-tone': 0.6, buttocks: 0.3 } },
    { id: 'curvy', label: 'Curvy', hint: 'Soft curves', macro: { muscle: 0.45, weight: 0.65, cup: 0.75 }, t: { hips: 0.5, buttocks: 0.6, waist: -0.2 } },
    { id: 'hourglass', label: 'Hourglass', hint: 'Balanced bust & hips, tiny waist', macro: { muscle: 0.5, weight: 0.52, cup: 0.8 }, t: { waist: -0.8, hips: 0.6, buttocks: 0.5, 'stomach-tone': 0.3 } },
    { id: 'pear', label: 'Pear', hint: 'Narrow top, full hips & thighs', macro: { muscle: 0.45, weight: 0.55, cup: 0.35 }, t: { hips: 0.9, 'hip-horiz': 0.4, thigh: 0.6, 'upperleg-fat': 0.6, buttocks: 0.6, shoulders: -0.4 } },
    { id: 'apple', label: 'Apple', hint: 'Fuller middle, slimmer legs', macro: { muscle: 0.45, weight: 0.7, cup: 0.7 }, t: { 'stomach-pregnant': 0.45, waist: 0.6, thigh: -0.3, 'stomach-tone': -0.5 } },
    { id: 'plus', label: 'Plus size', hint: 'Full-figured', macro: { muscle: 0.4, weight: 1, cup: 0.95 }, t: { 'stomach-pregnant': 0.4, 'stomach-tone': -0.8, hips: 0.4, 'upperleg-fat': 0.5 } },
  ],
};

/* ── Detail categories ──────────────────────────────────────────────── */
/* Option fields: macro (overrides), t (target values, override), mul (height). */

const AUTO = { id: 'auto', label: 'Match body', hint: 'Use the body type' };

export const CATEGORIES = [
  {
    key: 'belly', label: 'Belly & abs', icon: '◎',
    options: [
      AUTO,
      { id: 'flat', label: 'Flat', hint: 'Flat, no lines', t: { 'stomach-pregnant': -0.4, 'stomach-tone': 0.2 } },
      { id: 'little', label: 'Little abs', hint: 'Faint upper abs', t: { 'stomach-pregnant': -0.3, 'stomach-tone': 0.55 }, absRows: 2, abs: 0.4 },
      { id: 'four', label: '4-pack', t: { 'stomach-pregnant': -0.4, 'stomach-tone': 0.75 }, absRows: 2, abs: 0.5 },
      { id: 'six', label: '6-pack', t: { 'stomach-pregnant': -0.5, 'stomach-tone': 0.9 }, absRows: 3, abs: 0.8 },
      { id: 'eight', label: '8-pack', t: { 'stomach-pregnant': -0.6, 'stomach-tone': 1 }, absRows: 4, abs: 1 },
      { id: 'fatabs', label: 'Fat over abs', hint: 'Abs under a soft layer', t: { 'stomach-pregnant': 0.1, 'stomach-tone': 0.5 }, absRows: 3, abs: 0.5 },
      { id: 'soft', label: 'Soft belly', t: { 'stomach-pregnant': 0.15, 'stomach-tone': -0.5 } },
      { id: 'pot', label: 'Pot belly', t: { 'stomach-pregnant': 0.45, 'stomach-tone': -0.5 } },
      { id: 'beer', label: 'Beer belly', hint: 'Round & firm', t: { 'stomach-pregnant': 0.85, 'stomach-tone': 0 } },
      { id: 'overhang', label: 'Overhang', hint: 'Fat over fat', t: { 'stomach-pregnant': 0.75, 'stomach-tone': -1, waist: 0.5 } },
    ],
  },
  {
    key: 'chest', label: 'Chest', icon: '♡', male: true,
    options: [
      AUTO,
      { id: 'flat', label: 'Flat', t: { 'torso-pectoral': -0.6 } },
      { id: 'defined', label: 'Defined', t: { 'torso-pectoral': 0.4 } },
      { id: 'broad', label: 'Broad pecs', t: { 'torso-pectoral': 0.75, 'torso-horiz': 0.25 } },
      { id: 'bulky', label: 'Bulky', t: { 'torso-pectoral': 1, 'torso-depth': 0.35, bust: 0.3 } },
      { id: 'soft', label: 'Soft chest', t: { 'torso-pectoral': -0.3, bust: 0.6, underbust: 0.2 } },
    ],
  },
  {
    key: 'bust', label: 'Bust', icon: '♡', female: true,
    options: [
      AUTO,
      { id: 'small', label: 'Small', macro: { cup: 0.1 } },
      { id: 'medium', label: 'Medium', macro: { cup: 0.45 } },
      { id: 'full', label: 'Full', macro: { cup: 0.75 } },
      { id: 'large', label: 'Large', macro: { cup: 1 } },
    ],
  },
  {
    key: 'shoulders', label: 'Shoulders', icon: '⌒',
    options: [
      AUTO,
      { id: 'narrow', label: 'Narrow', t: { shoulders: -0.7, 'shoulder-muscle': -0.3 } },
      { id: 'average', label: 'Average', t: { shoulders: 0 } },
      { id: 'broad', label: 'Broad', t: { shoulders: 0.6, 'shoulder-muscle': 0.3 } },
      { id: 'boulder', label: 'Boulder', hint: 'Capped delts', t: { shoulders: 0.7, 'shoulder-muscle': 1, 'torso-vshape': 0.6 } },
    ],
  },
  {
    key: 'arms', label: 'Arms', icon: '💪',
    options: [
      AUTO,
      { id: 'thin', label: 'Thin', t: { 'upperarm-fat': -0.7, 'upperarm-muscle': -0.6, 'lowerarm-fat': -0.5, 'lowerarm-muscle': -0.5 } },
      { id: 'toned', label: 'Toned', t: { 'upperarm-fat': -0.4, 'upperarm-muscle': 0.3 } },
      { id: 'athletic', label: 'Athletic', t: { 'upperarm-fat': -0.4, 'upperarm-muscle': 0.6, 'lowerarm-muscle': 0.4 } },
      { id: 'muscular', label: 'Muscular', t: { 'upperarm-fat': -0.3, 'upperarm-muscle': 0.9, 'lowerarm-muscle': 0.7, 'shoulder-muscle': 0.5 } },
      { id: 'huge', label: 'Huge', t: { 'upperarm-muscle': 1, 'lowerarm-muscle': 1, 'shoulder-muscle': 0.8, upperarm: 0.6 } },
      { id: 'soft', label: 'Soft', hint: 'Flabby upper arms', t: { 'upperarm-fat': 1, 'lowerarm-fat': 0.5, 'upperarm-muscle': -0.4 } },
    ],
  },
  {
    key: 'waist', label: 'Waist', icon: '⧗',
    options: [
      AUTO,
      { id: 'tiny', label: 'Tiny', t: { waist: -1 } },
      { id: 'slim', label: 'Slim', t: { waist: -0.5 } },
      { id: 'average', label: 'Average', t: { waist: 0 } },
      { id: 'thick', label: 'Thick', t: { waist: 0.5 } },
      { id: 'wide', label: 'Wide', t: { waist: 1 } },
    ],
  },
  {
    key: 'hips', label: 'Hips', icon: '◠',
    options: [
      AUTO,
      { id: 'narrow', label: 'Narrow', t: { hips: -0.7, 'hip-horiz': -0.4 } },
      { id: 'average', label: 'Average', t: { hips: 0, 'hip-horiz': 0 } },
      { id: 'wide', label: 'Wide', t: { hips: 0.6, 'hip-horiz': 0.3 } },
      { id: 'xwide', label: 'Very wide', t: { hips: 1, 'hip-horiz': 0.7 } },
    ],
  },
  {
    key: 'glutes', label: 'Glutes', icon: '◖',
    options: [
      AUTO,
      { id: 'flat', label: 'Flat', t: { buttocks: -1 } },
      { id: 'average', label: 'Average', t: { buttocks: 0 } },
      { id: 'round', label: 'Round', t: { buttocks: 0.5 } },
      { id: 'athletic', label: 'Athletic', hint: 'Lifted & firm', t: { buttocks: 0.7, 'hip-depth': 0.2 } },
      { id: 'full', label: 'Full', t: { buttocks: 1, 'hip-depth': 0.3 } },
    ],
  },
  {
    key: 'thighs', label: 'Thighs', icon: '∥',
    options: [
      AUTO,
      { id: 'skinny', label: 'Skinny', t: { thigh: -0.8, 'upperleg-fat': -0.6, 'upperleg-muscle': -0.4 } },
      { id: 'slender', label: 'Slender', t: { thigh: -0.4, 'upperleg-fat': -0.3 } },
      { id: 'toned', label: 'Toned', t: { 'upperleg-fat': -0.3, 'upperleg-muscle': 0.4 } },
      { id: 'athletic', label: 'Athletic', hint: 'Runner / sprinter', t: { 'upperleg-fat': -0.4, 'upperleg-muscle': 0.7 } },
      { id: 'muscular', label: 'Muscular', hint: 'Squat legs', t: { 'upperleg-muscle': 1, thigh: 0.4 } },
      { id: 'thick', label: 'Thick', t: { 'upperleg-fat': 0.7, thigh: 0.5 } },
      { id: 'heavy', label: 'Heavy', t: { 'upperleg-fat': 1, thigh: 1 } },
    ],
  },
  {
    key: 'calves', label: 'Calves', icon: '⌇',
    options: [
      AUTO,
      { id: 'slim', label: 'Slim', t: { calf: -0.5, 'lowerleg-fat': -0.5, 'lowerleg-muscle': -0.3 } },
      { id: 'average', label: 'Average', t: { calf: 0, 'lowerleg-muscle': 0 } },
      { id: 'defined', label: 'Defined', t: { 'lowerleg-muscle': 0.6, 'lowerleg-fat': -0.3 } },
      { id: 'muscular', label: 'Muscular', t: { 'lowerleg-muscle': 1, calf: 0.4 } },
      { id: 'thick', label: 'Thick', t: { 'lowerleg-fat': 0.8, calf: 0.5 } },
    ],
  },
  {
    key: 'legShape', label: 'Leg shape', icon: '⋀',
    options: [
      { id: 'straight', label: 'Straight', t: { valgus: 0 } },
      { id: 'bow', label: 'Bow-legged', hint: 'O-shaped', t: { valgus: -1 } },
      { id: 'knock', label: 'Knock-kneed', hint: 'X-shaped', t: { valgus: 1 } },
    ],
  },
  {
    key: 'legLength', label: 'Leg length', icon: '↕',
    options: [
      { id: 'short', label: 'Short legs', t: { 'upperleg-h': -0.6, 'lowerleg-h': -0.6 } },
      { id: 'balanced', label: 'Balanced', t: {} },
      { id: 'long', label: 'Long legs', t: { 'upperleg-h': 0.6, 'lowerleg-h': 0.6 } },
    ],
  },
  {
    key: 'height', label: 'Height', icon: '⇕',
    options: [
      { id: 'short', label: 'Short', mul: 0.9 },
      { id: 'below', label: 'Below avg', mul: 0.95 },
      { id: 'average', label: 'Average', mul: 1 },
      { id: 'tall', label: 'Tall', mul: 1.05 },
      { id: 'xtall', label: 'Very tall', mul: 1.1 },
    ],
  },
  {
    key: 'posture', label: 'Posture', icon: '⟂',
    options: [
      { id: 'relaxed', label: 'Relaxed', posture: { slouch: 0, proud: 0 } },
      { id: 'upright', label: 'Upright', posture: { slouch: 0, proud: 0.5 } },
      { id: 'proud', label: 'Chest out', posture: { slouch: 0, proud: 1 } },
      { id: 'slouch', label: 'Slouched', posture: { slouch: 1, proud: 0 } },
    ],
  },
  {
    key: 'pose', label: 'Pose', icon: '✋',
    options: [
      { id: 'relaxed', label: 'Standing' },
      { id: 'apose', label: 'A-pose' },
      { id: 'hips', label: 'Hands on hips' },
      { id: 'flex', label: 'Flex' },
    ],
  },
];

export const SOCKS = [
  { id: 'none', label: 'Barefoot' },
  { id: 'ankle', label: 'Ankle socks' },
  { id: 'crew', label: 'Crew socks' },
];

export const OUTFITS = [
  { id: 'shorts', label: 'Gym shorts', hint: 'Shirtless', top: 'none', bottom: 'shorts', male: true },
  { id: 'tank', label: 'Tank & shorts', top: 'tank', bottom: 'shorts' },
  { id: 'tee', label: 'Tee & shorts', top: 'tee', bottom: 'longshorts' },
  { id: 'compression', label: 'Compression', top: 'long', bottom: 'bike' },
  { id: 'braShorts', label: 'Sports bra & shorts', top: 'bra', bottom: 'bike', female: true },
  { id: 'braLeggings', label: 'Sports bra & leggings', top: 'bra', bottom: 'leggings', female: true },
  { id: 'tankLeggings', label: 'Tank & leggings', top: 'tank', bottom: 'leggings' },
  { id: 'teeJoggers', label: 'Tee & joggers', top: 'tee', bottom: 'joggers' },
];

export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

/* ── Config ─────────────────────────────────────────────────────────── */

export function defaultConfig(gender = 'male') {
  const c = {
    v: 2,
    gender,
    bodyType: 'average',
    outfit: gender === 'male' ? 'shorts' : 'braLeggings',
    socks: 'none',
    skin: '#d9a175',
    top: gender === 'male' ? '#1d1f26' : '#9b7fe0',
    bottom: '#1d1f26',
    shoes: '#eef0f4',
  };
  for (const cat of CATEGORIES) c[cat.key] = cat.options[0].id;
  c.legShape = 'straight'; c.legLength = 'balanced'; c.height = 'average';
  c.posture = 'relaxed'; c.pose = 'relaxed';
  return c;
}

export function categoriesFor(gender) {
  return CATEGORIES.filter((c) => (gender === 'male' ? !c.female : !c.male));
}

export function outfitsFor(gender) {
  return OUTFITS.filter((o) => (gender === 'male' ? !o.female : !o.male));
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Fill defaults and drop unknown values so stored configs never break rendering. */
export function normalizeConfig(input = {}) {
  const gender = input.gender === 'female' ? 'female' : 'male';
  const c = defaultConfig(gender);
  if (BODY_TYPES[gender].some((b) => b.id === input.bodyType)) c.bodyType = input.bodyType;
  for (const cat of categoriesFor(gender)) {
    if (cat.options.some((o) => o.id === input[cat.key])) c[cat.key] = input[cat.key];
  }
  if (outfitsFor(gender).some((o) => o.id === input.outfit)) c.outfit = input.outfit;
  if (SOCKS.some((o) => o.id === input.socks)) c.socks = input.socks;
  for (const k of ['skin', 'top', 'bottom', 'shoes']) {
    if (typeof input[k] === 'string' && HEX.test(input[k])) c[k] = input[k].toLowerCase();
  }
  return c;
}

/** Config → body model parameters ({ macro, t, pose, posture, height, … }). */
export function resolveParams(config) {
  const c = normalizeConfig(config);
  const base = BASE[c.gender];
  const bt = BODY_TYPES[c.gender].find((b) => b.id === c.bodyType);
  const macro = { ...base.macro, ...(bt.macro || {}), gender: c.gender === 'male' ? 1 : 0 };
  const t = { ...base.t, ...(bt.t || {}) };
  let height = base.height * (bt.height || 1);
  let posture = { slouch: 0, proud: 0 };
  let abs = bt.abs || 0, absRows = 3;
  for (const cat of categoriesFor(c.gender)) {
    const opt = cat.options.find((o) => o.id === c[cat.key]);
    if (!opt || opt.id === 'auto') continue;
    if (opt.macro) Object.assign(macro, opt.macro);
    if (opt.t) Object.assign(t, opt.t);
    if (opt.mul) height *= opt.mul;
    if (opt.posture) posture = { ...opt.posture };
    if (opt.abs != null) { abs = opt.abs; absRows = opt.absRows || 3; }
  }
  // heavier bodies hold their arms further out
  posture.width = Math.max(0, macro.weight - 0.5) * 1.4 + Math.max(0, (t['stomach-pregnant'] || 0)) * 0.6;
  const outfit = OUTFITS.find((o) => o.id === c.outfit) || OUTFITS[0];
  return {
    gender: c.gender, macro, t, height, posture, pose: c.pose, abs, absRows,
    cover: { top: outfit.top !== 'none', belly: ['tank', 'tee', 'long'].includes(outfit.top) },
    belly: Math.max(0, t['stomach-pregnant'] || 0) + Math.max(0, macro.weight - 0.6),
    cup: c.gender === 'female' ? macro.cup : 0,
  };
}

/** Key that changes only when the *shape* changes. */
export function shapeKey(config) {
  const { height, ...shape } = resolveParams(config);
  return JSON.stringify(shape);
}

/** Total number of body-shape choices (for the "60+ options" badge). */
export function countOptions() {
  let n = BODY_TYPES.male.length + BODY_TYPES.female.length;
  for (const cat of CATEGORIES) n += cat.options.filter((o) => o.id !== 'auto').length;
  n += SOCKS.length;
  return n;
}

export function randomConfig(gender) {
  const g = gender || (Math.random() < 0.5 ? 'male' : 'female');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const c = defaultConfig(g);
  c.bodyType = pick(BODY_TYPES[g]).id;
  for (const cat of categoriesFor(g)) {
    c[cat.key] = Math.random() < 0.55 ? cat.options[0].id : pick(cat.options).id;
  }
  c.outfit = pick(outfitsFor(g)).id;
  c.socks = pick(SOCKS).id;
  c.skin = pick(SKIN_TONES).hex;
  c.top = pick(CLOTH_COLORS).hex;
  c.bottom = pick(CLOTH_COLORS).hex;
  return c;
}
