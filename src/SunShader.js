import * as THREE from 'three';

export const SunShader = {
  uniforms: {
    sunMap: { value: null },
    texelSize: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
    detailBoost: { value: 0.3 },
    contrast: { value: 1.12 },
    emissiveStrength: { value: 1.08 },
  },

  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D sunMap;
    uniform vec2 texelSize;
    uniform float detailBoost;
    uniform float contrast;
    uniform float emissiveStrength;

    varying vec2 vUv;

    float sampleLuma(vec2 uv) {
      return dot(texture2D(sunMap, uv).rgb, vec3(0.299, 0.587, 0.114));
    }

    vec2 wrapUv(vec2 uv) {
      return vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
    }

    vec3 applyContrast(vec3 color, float amount) {
      return clamp((color - 0.5) * amount + 0.5, 0.0, 1.0);
    }

    vec3 enhanceTexture(vec2 uv, vec3 baseColor) {
      float center = dot(baseColor, vec3(0.299, 0.587, 0.114));
      float neighborhood = (
        sampleLuma(wrapUv(uv + vec2(texelSize.x, 0.0))) +
        sampleLuma(wrapUv(uv - vec2(texelSize.x, 0.0))) +
        sampleLuma(wrapUv(uv + vec2(0.0, texelSize.y))) +
        sampleLuma(wrapUv(uv - vec2(0.0, texelSize.y)))
      ) * 0.25;

      float highFrequency = clamp(center - neighborhood, -0.4, 0.4);
      return clamp(baseColor + vec3(highFrequency * detailBoost), 0.0, 1.0);
    }

    void main() {
      vec2 uv = wrapUv(vUv);
      vec3 baseColor = texture2D(sunMap, uv).rgb;
      vec3 detailedColor = enhanceTexture(uv, baseColor);
      vec3 contrastedColor = applyContrast(detailedColor, contrast);
      vec3 warmColor = contrastedColor * vec3(1.06, 0.97, 0.8);
      vec3 color = warmColor * emissiveStrength;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
};
