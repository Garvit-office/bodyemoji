/**
 * three.js studio scene for a Bodymoji. Platform-agnostic: works with an
 * expo-gl context on iOS/Android and a normal canvas on web.
 * Avoids canvas textures / PMREM so nothing depends on DOM APIs.
 */
import * as THREE from 'three';

export function configureRenderer(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
}

function blobTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, 1 - r);
      const o = (y * size + x) * 4;
      data[o] = 18; data[o + 1] = 20; data[o + 2] = 32;
      data[o + 3] = Math.round(255 * Math.pow(a, 1.6) * 0.55);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export class BodyScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

    // soft photo-studio rig: big warm key, cool fill, two rims, sky/ground bounce
    const hemi = new THREE.HemisphereLight(0xe8eeff, 0x5c4a3e, 0.95);
    const key = new THREE.DirectionalLight(0xfff0e4, 2.4);
    key.position.set(-1.8, 3.0, 2.8);
    const fill = new THREE.DirectionalLight(0xd6e2ff, 0.7);
    fill.position.set(2.6, 1.2, 2.0);
    const rim = new THREE.DirectionalLight(0xdbe6ff, 1.7);
    rim.position.set(-2.2, 2.2, -2.6);
    const rim2 = new THREE.DirectionalLight(0xffe4d2, 1.3);
    rim2.position.set(2.4, 1.8, -2.4);
    const under = new THREE.DirectionalLight(0xffd9c4, 0.25);
    under.position.set(0, -1, 1.5);
    this.scene.add(hemi, key, fill, rim, rim2, under);

    this.root = new THREE.Group();        // spins
    this.body = new THREE.Group();        // breathes / scales with height
    this.root.add(this.body);
    this.scene.add(this.root);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.8),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    this.scene.add(shadow);
    this.shadow = shadow;

    // skin-like: soft spec, faint oily clearcoat, reddish sheen fakes subsurface glow at grazing angles
    this.material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.58,
      metalness: 0,
      specularIntensity: 0.45,
      clearcoat: 0.08,
      clearcoatRoughness: 0.45,
      sheen: 0.45,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffb19a),
    });
    // athletic fabric: matte with a soft cloth sheen
    this.fabric = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      specularIntensity: 0.25,
      sheen: 0.8,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x8f96a8),
    });
    this.mesh = null;
    this.height = 1;
    this.yaw = 0;
    this._t = 0;
  }

  /** Swap in a new body ({ position, normal, index, color, cloth? }). */
  setMesh(data, color = data.color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    let index = data.index, split = index.length;
    if (data.cloth) {
      // order triangles: skin first, fabric second → two material groups
      const skin = [], fab = [];
      const c = data.cloth;
      for (let i = 0; i < index.length; i += 3) {
        const a = index[i], b = index[i + 1], d = index[i + 2];
        ((c[a] + c[b] + c[d]) / 3 > 0.5 ? fab : skin).push(a, b, d);
      }
      split = skin.length;
      index = new Uint32Array(skin.length + fab.length);
      index.set(skin); index.set(fab, skin.length);
    }
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.addGroup(0, split, 0);
    geo.addGroup(split, index.length - split, 1);
    geo.computeBoundingSphere();
    let maxY = 0;
    for (let i = 1; i < data.position.length; i += 3) if (data.position[i] > maxY) maxY = data.position[i];
    this.topY = maxY;
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
    } else {
      this.mesh = new THREE.Mesh(geo, [this.material, this.fabric]);
      this.body.add(this.mesh);
    }
    this.data = data;
  }

  setColors(color) {
    if (!this.mesh) return;
    const attr = this.mesh.geometry.getAttribute('color');
    if (attr && attr.array.length === color.length) {
      attr.array.set(color);
      attr.needsUpdate = true;
    } else {
      this.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    }
  }

  setHeight(h) { this.height = h; }

  /** Frame the full body for a viewport aspect ratio (re-fits smoothly as the body changes). */
  frame(aspect) {
    this.aspect = aspect;
    if (this._fit == null) this._fit = this._targetFit();
    this._applyFrame();
  }

  _targetFit() {
    const top = (this.topY || 1.5) * this.height;
    return Math.max(1.55, top + 0.12);
  }

  _applyFrame() {
    const h = this._fit;
    const fit = h / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    let dist = fit;
    if (this.aspect < 0.5) dist *= 0.5 / this.aspect;
    const ty = h / 2 - 0.04;
    this.camera.aspect = this.aspect;
    this.camera.position.set(0, ty + 0.1, dist);
    this.camera.lookAt(0, ty, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this._t += dt;
    if (this.aspect) {
      const target = this._targetFit();
      this._fit = this._fit == null || dt === 0 ? target : this._fit + (target - this._fit) * (1 - Math.exp(-6 * dt));
      this._applyFrame();
    }
    // idle breathing: tiny chest-up scale, scaled with height
    const breath = 1 + Math.sin(this._t * 1.6) * 0.004;
    const h = this.height;
    this.body.scale.set(h * (1 + (breath - 1) * 0.5), h * breath, h * (1 + (breath - 1) * 1.2));
    this.root.rotation.y = this.yaw;
    this.shadow.scale.setScalar(h);
  }
}
