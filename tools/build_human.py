"""
Build src/data/humanData.js from the MakeHuman 1.1 assets (CC0).

  git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh
  cd mh && git sparse-checkout set makehuman/data/targets makehuman/data/rigs makehuman/data/3dobjs
  python3 tools/build_human.py /path/to/mh/makehuman/data

Output: base mesh (head removed, neck capped), selected morph targets
(sparse, int16-quantised), simplified skin weights, joints and region labels,
all packed into one base64 string so Metro can bundle it like any JS module.
"""
import sys, os, json, base64, struct, math
import numpy as np

DATA = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'humanData.js')
T = os.path.join(DATA, 'targets')

# ── base mesh ────────────────────────────────────────────────────────────
V = []; faces = []; g = None
for line in open(os.path.join(DATA, '3dobjs', 'base.obj')):
    if line.startswith('v '):
        V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('g '):
        g = line.split()[1]
    elif line.startswith('f ') and g == 'body':
        faces.append([int(t.split('/')[0]) - 1 for t in line.split()[1:]])
V = np.array(V, dtype=np.float64)
NV_ALL = len(V)
print('verts', NV_ALL, 'body faces', len(faces))

skel = json.load(open(os.path.join(DATA, 'rigs', 'default.mhskel')))
bones = skel['bones']; joints = skel['joints']
def jpos(name): return V[joints[name]].mean(axis=0)

# ── cut the head off at the neck ─────────────────────────────────────────
y_n1 = jpos('neck01____head')[1]; y_n2 = jpos('neck02____head')[1]
y_cut = y_n1 + 0.55 * (y_n2 - y_n1)
print('neck01 y', y_n1, 'neck02 y', y_n2, 'cut', y_cut)
faces = [f for f in faces if all(V[i][1] < y_cut for i in f)]

used = sorted({i for f in faces for i in f})
remap = {o: n for n, o in enumerate(used)}
faces = [[remap[i] for i in f] for f in faces]
NB = len(used)

# boundary loops → fan caps (virtual centre vertex = mean of loop)
from collections import defaultdict
edge_count = defaultdict(int); edge_dir = {}
for f in faces:
    for a, b in zip(f, f[1:] + f[:1]):
        k = (min(a, b), max(a, b)); edge_count[k] += 1; edge_dir[k] = (a, b)
bnd = [edge_dir[k] for k, c in edge_count.items() if c == 1]
nxt = {}
for a, b in bnd: nxt[b] = a          # walk opposite to face winding
loops = []; seen = set()
for s in list(nxt):
    if s in seen: continue
    loop = [s]; seen.add(s); c = nxt[s]
    while c != s and c not in seen:
        loop.append(c); seen.add(c); c = nxt[c]
    loops.append(loop)
print('boundary loops', [len(l) for l in loops])

# "points": base vertices referenced by index (body vertices) + virtual points
# defined as averages of original vertex sets (cap centres, joints).
virtual = []  # list of original-index lists
cap_tris = []
for loop in loops:
    cid = NB + len(virtual)
    virtual.append([used[i] for i in loop])
    for a, b in zip(loop, loop[1:] + loop[:1]):
        cap_tris.append([a, b, cid])   # winding chosen to face outward (checked visually)
NCAP = len(virtual)

# keep these bones (others are merged into the nearest kept ancestor)
def keep(b):
    if b in ('root', 'pelvis.L', 'pelvis.R') or b.startswith('spine') or b == 'neck01': return True
    for p in ('clavicle', 'shoulder01', 'upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal',
              'upperleg', 'lowerleg', 'foot', 'toe'):
        if b.startswith(p): return True
    return False
order = []  # parents before children
def visit(b):
    if b in order: return
    p = bones[b]['parent']
    if p: visit(p)
    order.append(b)
for b in bones: visit(b)
kept = [b for b in order if keep(b)]
def kept_anc(b):
    while not keep(b): b = bones[b]['parent']
    return b
bone_index = {b: i for i, b in enumerate(kept)}
joint_names = []
for b in kept:
    for j in (bones[b]['head'], bones[b]['tail']):
        if j not in joint_names: joint_names.append(j)
joint_point = {}
for j in joint_names:
    joint_point[j] = NB + len(virtual)
    virtual.append(list(joints[j]))
NP = NB + len(virtual)
print('body verts', NB, 'points', NP, 'bones', len(kept))

def points_from(arr):
    """Map a per-original-vertex (NV_ALL,3) array to the point layout."""
    out = np.zeros((NP, 3))
    out[:NB] = arr[used]
    for k, src in enumerate(virtual):
        out[NB + k] = arr[src].mean(axis=0)
    return out
base = points_from(V)

# ── skin weights (4 influences) ──────────────────────────────────────────
W = json.load(open(os.path.join(DATA, 'rigs', 'default_weights.mhw')))['weights']
acc = defaultdict(lambda: defaultdict(float))
for b, lst in W.items():
    kb = bone_index[kept_anc(b)]
    for vi, w in lst:
        if vi in remap: acc[remap[vi]][kb] += w
skin_idx = np.zeros((NB, 4), np.uint8); skin_w = np.zeros((NB, 4), np.uint8)
dominant = np.zeros(NB, np.int32)
for v in range(NB):
    items = sorted(acc[v].items(), key=lambda x: -x[1])[:4]
    if not items: items = [(bone_index['root'], 1.0)]
    s = sum(w for _, w in items)
    q = [int(round(255 * w / s)) for _, w in items]
    q[0] += 255 - sum(q)
    for k, (bi, _) in enumerate(items):
        skin_idx[v, k] = bi; skin_w[v, k] = q[k]
    dominant[v] = items[0][0]

# ── regions + limb parameter ─────────────────────────────────────────────
TORSO, NECK, ARM, HAND, LEG, FOOT = 0, 1, 2, 3, 4, 5
def region_of(b):
    if b.startswith(('shoulder01', 'upperarm', 'lowerarm')): return ARM
    if b.startswith(('wrist', 'finger', 'metacarpal')): return HAND
    if b.startswith(('upperleg', 'lowerleg')): return LEG
    if b.startswith(('foot', 'toe')): return FOOT
    if b.startswith('neck'): return NECK
    return TORSO
region = np.array([region_of(kept[d]) for d in dominant], np.uint8)
region[NB:] if False else None

def seg_t(p, a, b):
    ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    d = np.linalg.norm(p - (a + np.outer(t, ab)), axis=1)
    return t, d
limbT = np.zeros(NB)
P = base[:NB]
for side in ('L', 'R'):
    sx = 1 if side == 'L' else -1
    S = jpos(f'upperarm01.{side}____head'); E = jpos(f'lowerarm01.{side}____head'); Wr = jpos(f'wrist.{side}____head')
    H = jpos(f'upperleg01.{side}____head'); K = jpos(f'lowerleg01.{side}____head'); A = jpos(f'foot.{side}____head')
    on = (np.sign(P[:, 0]) == sx)
    arm = on & ((region == ARM) | (region == HAND))
    t1, d1 = seg_t(P, S, E); t2, d2 = seg_t(P, E, Wr)
    limbT[arm] = np.where(d1 < d2, t1 * 0.5, 0.5 + t2 * 0.5)[arm]
    leg = on & ((region == LEG) | (region == FOOT) | (region == TORSO))
    t1, d1 = seg_t(P, H, K); t2, d2 = seg_t(P, K, A)
    lt = np.where(P[:, 1] > K[1], t1 * 0.5, 0.5 + t2 * 0.5)
    limbT[leg & (region != TORSO)] = lt[leg & (region != TORSO)]
limbT_q = np.clip(np.round(limbT * 255), 0, 255).astype(np.uint8)

# ── detail masks (smoothed away under fabric / for a clean avatar look) ──
def mask_from_target(rel, grow=1.6):
    d = np.zeros((NV_ALL, 3))
    for line in open(os.path.join(T, rel)):
        if not line.strip() or line[0] == '#': continue
        q = line.split(); d[int(q[0])] = [float(q[1]), float(q[2]), float(q[3])]
    m = np.linalg.norm(d[used], axis=1)
    m = np.clip(m / (m.max() + 1e-9) * grow, 0, 1)
    return m
nipple = mask_from_target('breast/breast-point-incr.target', 2.5)
navel = mask_from_target('stomach/stomach-navel-in.target', 2.0)
hipC = (jpos('upperleg01.L____head') + jpos('upperleg01.R____head')) / 2
dx = np.abs(P[:, 0]) / 0.75; dy = (P[:, 1] - (hipC[1] - 0.45)) / 0.75; front = np.clip((P[:, 2] - hipC[2]) / 0.4, 0, 1)
crotch = np.clip(1.4 - np.sqrt(dx * dx + dy * dy), 0, 1) * front
masks = np.stack([nipple, navel, crotch], axis=1)
masks_q = np.clip(np.round(masks * 255), 0, 255).astype(np.uint8)
print('mask counts', (masks_q > 20).sum(axis=0))

# ── targets ──────────────────────────────────────────────────────────────
def load_target(rel):
    path = os.path.join(T, rel)
    d = np.zeros((NV_ALL, 3))
    for line in open(path):
        if not line.strip() or line[0] == '#': continue
        p = line.split(); d[int(p[0])] = [float(p[1]), float(p[2]), float(p[3])]
    return d

target_specs = []   # (key, [rel files to sum])
for gname in ('male', 'female'):
    for m in ('min', 'average', 'max'):
        for w in ('min', 'average', 'max'):
            target_specs.append((f'u-{gname}-{m}-{w}', [f'macrodetails/universal-{gname}-young-{m}muscle-{w}weight.target']))
    for eth in ('african', 'asian', 'caucasian'):
        target_specs.append((f'e-{gname}-{eth}', [f'macrodetails/{eth}-{gname}-young.target']))
for m in ('min', 'average', 'max'):
    for w in ('min', 'average', 'max'):
        for cup in ('min', 'max'):
            target_specs.append((f'b-{m}-{w}-{cup}', [f'breast/female-young-{m}muscle-{w}weight-{cup}cup-averagefirmness.target']))
PAIRS = {
    'stomach-pregnant': ('stomach/stomach-pregnant-decr', 'stomach/stomach-pregnant-incr'),
    'stomach-tone': ('stomach/stomach-tone-decr', 'stomach/stomach-tone-incr'),
    'torso-dorsi': ('torso/torso-muscle-dorsi-decr', 'torso/torso-muscle-dorsi-incr'),
    'torso-pectoral': ('torso/torso-muscle-pectoral-decr', 'torso/torso-muscle-pectoral-incr'),
    'torso-vshape': ('torso/torso-vshape-decr', 'torso/torso-vshape-incr'),
    'torso-horiz': ('torso/torso-scale-horiz-decr', 'torso/torso-scale-horiz-incr'),
    'torso-depth': ('torso/torso-scale-depth-decr', 'torso/torso-scale-depth-incr'),
    'hip-horiz': ('hip/hip-scale-horiz-decr', 'hip/hip-scale-horiz-incr'),
    'hip-depth': ('hip/hip-scale-depth-decr', 'hip/hip-scale-depth-incr'),
    'hip-waist': ('hip/hip-waist-down', 'hip/hip-waist-up'),
    'buttocks': ('buttocks/buttocks-volume-decr', 'buttocks/buttocks-volume-incr'),
    'waist': ('measure/measure-waist-circ-decr', 'measure/measure-waist-circ-incr'),
    'hips': ('measure/measure-hips-circ-decr', 'measure/measure-hips-circ-incr'),
    'bust': ('measure/measure-bust-circ-decr', 'measure/measure-bust-circ-incr'),
    'underbust': ('measure/measure-underbust-circ-decr', 'measure/measure-underbust-circ-incr'),
    'thigh': ('measure/measure-thigh-circ-decr', 'measure/measure-thigh-circ-incr'),
    'calf': ('measure/measure-calf-circ-decr', 'measure/measure-calf-circ-incr'),
    'upperarm': ('measure/measure-upperarm-circ-decr', 'measure/measure-upperarm-circ-incr'),
    'shoulders': ('measure/measure-shoulder-dist-decr', 'measure/measure-shoulder-dist-incr'),
    'neck': ('measure/measure-neck-circ-decr', 'measure/measure-neck-circ-incr'),
    'upperleg-h': ('measure/measure-upperleg-height-decr', 'measure/measure-upperleg-height-incr'),
    'lowerleg-h': ('measure/measure-lowerleg-height-decr', 'measure/measure-lowerleg-height-incr'),
}
LR = {
    'upperarm-fat': 'upperarm-fat', 'upperarm-muscle': 'upperarm-muscle', 'shoulder-muscle': 'upperarm-shoulder-muscle',
    'lowerarm-fat': 'lowerarm-fat', 'lowerarm-muscle': 'lowerarm-muscle',
    'upperleg-fat': 'upperleg-fat', 'upperleg-muscle': 'upperleg-muscle',
    'lowerleg-fat': 'lowerleg-fat', 'lowerleg-muscle': 'lowerleg-muscle',
}
for k, (dec, inc) in PAIRS.items():
    target_specs.append((k + '-decr', [dec + '.target']))
    target_specs.append((k + '-incr', [inc + '.target']))
for k, f in LR.items():
    for sfx in ('decr', 'incr'):
        target_specs.append((f'{k}-{sfx}', [f'armslegs/l-{f}-{sfx}.target', f'armslegs/r-{f}-{sfx}.target']))
target_specs.append(('valgus-decr', ['armslegs/l-leg-valgus-decr.target', 'armslegs/r-leg-valgus-decr.target']))
target_specs.append(('valgus-incr', ['armslegs/l-leg-valgus-incr.target', 'armslegs/r-leg-valgus-incr.target']))

chunks = []; offset = 0; meta_targets = []
def add_chunk(b):
    global offset
    pad = (-offset) % 4
    if pad: chunks.append(b'\0' * pad); offset += pad
    o = offset; chunks.append(b); offset += len(b); return o

for key, files in target_specs:
    d = np.zeros((NV_ALL, 3))
    for f in files: d += load_target(f)
    pd = points_from(d)
    mag = np.abs(pd).max(axis=1)
    idx = np.nonzero(mag > 2e-4)[0].astype(np.uint16)
    if len(idx) == 0:
        print('empty target', key); continue
    vals = pd[idx]
    scale = float(np.abs(vals).max()) / 32767.0
    q = np.round(vals / scale).astype(np.int16)
    oi = add_chunk(idx.tobytes()); od = add_chunk(q.tobytes())
    meta_targets.append({'key': key, 'n': int(len(idx)), 'idx': oi, 'd': od, 's': scale})

layout = {}
layout['base'] = add_chunk(base.astype(np.float32).tobytes())
quads = np.array([f for f in faces if len(f) == 4], np.uint16)
tris = np.array([f for f in faces if len(f) == 3] + cap_tris, np.uint16).reshape(-1, 3)
layout['quads'] = add_chunk(quads.tobytes()); layout['nQuads'] = int(len(quads))
layout['tris'] = add_chunk(tris.tobytes()); layout['nTris'] = int(len(tris))
layout['skinIdx'] = add_chunk(skin_idx.tobytes()); layout['skinW'] = add_chunk(skin_w.tobytes())
layout['region'] = add_chunk(region.tobytes()); layout['detail'] = add_chunk(masks_q.tobytes()); layout['limbT'] = add_chunk(limbT_q.tobytes())

blob = b''.join(chunks)
meta = {
    'nBody': NB, 'nPoints': NP, 'nCaps': NCAP, 'layout': layout, 'targets': meta_targets,
    'bones': [{'name': b, 'parent': bone_index[kept_anc(bones[b]['parent'])] if bones[b]['parent'] else -1,
               'head': joint_point[bones[b]['head']], 'tail': joint_point[bones[b]['tail']]} for b in kept],
    'scale': 0.1,  # MakeHuman units are decimetres
}
print('blob bytes', len(blob), 'targets', len(meta_targets))
with open(OUT, 'w') as f:
    f.write('// Generated by tools/build_human.py from MakeHuman 1.1 assets (CC0). Do not edit.\n')
    f.write('export const HUMAN_META = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
    f.write('export const HUMAN_B64 = "' + base64.b64encode(blob).decode() + '";\n')
print('wrote', OUT, os.path.getsize(OUT))
