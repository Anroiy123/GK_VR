import * as THREE from "three";

export const SunShader = {
  uniforms: {
    sunMap: { value: null },
    time: { value: 0 },
    intensity: { value: 1.0 },
    coreBoost: { value: 1.15 },
    rimPower: { value: 1.9 },
    noiseScale: { value: 6.5 },
    textureBlend: { value: 0 },
  },

  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D sunMap;
    uniform float time;
    uniform float intensity;
    uniform float coreBoost;
    uniform float rimPower;
    uniform float noiseScale;
    uniform float textureBlend;

    varying vec2 vUv;
    varying vec3 vNormal;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) +
        (c - a) * u.y * (1.0 - u.x) +
        (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;

      for (int i = 0; i < 4; i++) {
        value += noise(p) * amplitude;
        p *= 2.03;
        amplitude *= 0.5;
      }

      return value;
    }

    void main() {
      vec3 surfaceNormal = normalize(vNormal);

      if (surfaceNormal.z <= 0.0) {
        discard;
      }

      vec2 discUv = surfaceNormal.xy * 0.5 + 0.5;
      vec2 centeredUv = discUv - 0.5;
      float radius = length(centeredUv) * 2.0;
      float discMask = smoothstep(1.02, 0.94, radius);
      float core = pow(max(surfaceNormal.z, 0.0), 0.52) * coreBoost;

      if (discMask <= 0.001) {
        discard;
      }

      vec2 flowUv = vec2(discUv.x * 1.65, discUv.y * 0.95);
      float plasma = fbm(flowUv * noiseScale + vec2(time * 0.35, -time * 0.18));
      float swirl = fbm(flowUv * (noiseScale * 1.8) + vec2(-time * 0.9, time * 0.42));
      float turbulence = mix(plasma, swirl, 0.42);

      float surfacePulse = 0.85 + turbulence * 0.45;
      float edgeRim = pow(clamp(1.0 - surfaceNormal.z, 0.0, 1.0), rimPower) * 0.22;
      float brightness = (core * 1.12 + surfacePulse * 0.48 + edgeRim) * intensity;

      vec3 deepGold = vec3(1.0, 0.68, 0.22);
      vec3 hotGold = vec3(1.0, 0.9, 0.56);
      vec3 whiteHot = vec3(1.0, 0.99, 0.94);

      vec3 plasmaColor = mix(deepGold, hotGold, clamp(surfacePulse, 0.0, 1.0));
      vec2 textureUv = fract(discUv + vec2(
        (swirl - 0.5) * 0.02,
        (plasma - 0.5) * 0.014
      ));
      vec3 textureColor = texture2D(sunMap, textureUv).rgb;
      float textureLuma = dot(textureColor, vec3(0.2126, 0.7152, 0.0722));
      float textureHighlight = smoothstep(0.42, 0.95, textureLuma);
      vec3 textureAccent = mix(hotGold, whiteHot, textureHighlight);
      float safeTextureBlend = clamp(textureBlend, 0.0, 1.0) * textureHighlight;
      plasmaColor = mix(plasmaColor, textureAccent, safeTextureBlend * 0.72);
      brightness *= 1.0 + safeTextureBlend * 0.12;
      vec3 coreColor = mix(plasmaColor, whiteHot, clamp(core * 0.95, 0.0, 1.0));
      vec3 color = coreColor * brightness;
      vec3 premultipliedColor = clamp(color, 0.0, 2.5) * discMask;

      gl_FragColor = vec4(premultipliedColor, discMask);
    }
  `,
};
