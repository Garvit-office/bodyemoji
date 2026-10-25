import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { GLView } from 'expo-gl';
import { createRenderer } from '../three/createRenderer';
import { BodyScene, configureRenderer } from '../three/scene';
import { makeBodymoji } from '../human/bodymoji';
import { normalizeConfig } from '../core/catalog';

/**
 * Live, rotatable realistic Bodymoji.
 * Each config change rebuilds the body (morph → pose → subdivide → paint),
 * deferred by a frame so the tapped chip updates first.
 */
export default function BodymojiView({ config, style, interactive = true, autoSpin = false, showBusy = true }) {
  const sceneRef = useRef(null);
  const bodyRef = useRef(null);
  const spin = useRef({ yaw: 0, vel: 0, dragging: false, lastX: 0, lastT: 0 });
  const stopRef = useRef(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => () => stopRef.current?.(), []);

  // ─ Drag to spin with inertia
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => interactive,
      onMoveShouldSetPanResponder: (_, g) => interactive && Math.abs(g.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const s = spin.current;
        s.dragging = true; s.vel = 0; s.lastX = e.nativeEvent.pageX; s.lastT = Date.now();
      },
      onPanResponderMove: (e) => {
        const s = spin.current;
        const x = e.nativeEvent.pageX;
        const dx = x - s.lastX;
        const now = Date.now();
        const dt = Math.max(1, now - s.lastT);
        s.yaw += dx * 0.012;
        s.vel = ((dx * 0.012) / dt) * 16;
        s.lastX = x; s.lastT = now;
      },
      onPanResponderRelease: () => { spin.current.dragging = false; },
      onPanResponderTerminate: () => { spin.current.dragging = false; },
    }),
  ).current;

  const apply = () => {
    const scene = sceneRef.current, body = bodyRef.current;
    if (!scene || !body) return;
    scene.setMesh(body);
    scene.setHeight(body.height);
  };

  // ─ Rebuild on config change
  const key = JSON.stringify(config);
  useEffect(() => {
    setBusy(true);
    const c = normalizeConfig(config);
    const id = setTimeout(() => {
      try {
        bodyRef.current = makeBodymoji(c);
        apply();
      } catch (err) {
        console.warn('[bodymoji] build failed', err);
      }
      setBusy(false);
    }, 16);
    return () => clearTimeout(id);
  }, [key]);

  const onContextCreate = (gl) => {
    const renderer = createRenderer(gl);
    configureRenderer(renderer);
    const scene = new BodyScene();
    sceneRef.current = scene;
    scene.frame(gl.drawingBufferWidth / gl.drawingBufferHeight);
    apply();

    let last = Date.now();
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = spin.current;
      if (!s.dragging) {
        s.yaw += s.vel;
        s.vel *= Math.pow(0.03, dt);
        if (autoSpin && Math.abs(s.vel) < 0.001) s.yaw += dt * 0.35;
        else if (Math.abs(s.vel) < 0.002) {
          const target = Math.round(s.yaw / (Math.PI * 2)) * Math.PI * 2;
          s.yaw += (target - s.yaw) * (1 - Math.exp(-1.6 * dt));
        }
      }
      scene.yaw = s.yaw;
      scene.update(dt);
      renderer.render(scene.scene, scene.camera);
      gl.endFrameEXP?.();
    };
    loop();
    stopRef.current = () => cancelAnimationFrame(raf);
  };

  return (
    <View style={[styles.wrap, style]} {...pan.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      {showBusy && busy && (
        <View style={styles.busy} pointerEvents="none">
          <ActivityIndicator size="small" color="#c9d2ff" />
          <Text style={styles.busyText}>Updating…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  busy: {
    position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(20,22,40,0.55)',
  },
  busyText: { color: '#e6e9ff', fontSize: 12, fontWeight: '600' },
});
