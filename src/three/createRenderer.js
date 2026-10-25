/**
 * three.js WebGLRenderer on top of an expo-gl context.
 * On native there is no <canvas>, so we hand three a minimal stand-in and
 * filter pixelStorei params expo-gl does not implement (avoids log spam).
 */
import * as THREE from 'three';
import { Platform } from 'react-native';

export function createRenderer(gl) {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  let canvas = gl.canvas;
  if (Platform.OS !== 'web' || !canvas) {
    canvas = {
      width,
      height,
      style: {},
      clientWidth: width,
      clientHeight: height,
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
      getContext: () => gl,
    };
    const pixelStorei = gl.pixelStorei.bind(gl);
    gl.pixelStorei = (param, value) => {
      if (param === gl.UNPACK_FLIP_Y_WEBGL || param === gl.UNPACK_ALIGNMENT || param === gl.PACK_ALIGNMENT) {
        pixelStorei(param, value);
      }
    };
  }

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  return renderer;
}
