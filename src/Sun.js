import * as THREE from "three";
import { SunShader } from "./SunShader.js";
import { DEFAULT_SUN_PRESET } from "./SunPresets.js";

const CINEMATIC_SUN_TEXTURE_PATH = "NewTextures/8k_sun.jpg";
const MIN_SUNLIGHT_MULTIPLIER = 0.5;
const MAX_SUNLIGHT_MULTIPLIER = 3;
const DEFAULT_SUNLIGHT_MULTIPLIER = 1.0;

async function loadCinematicSunTexture(textureLoader, maxAnisotropy = 1) {
  const texture = await textureLoader.loadAsync(CINEMATIC_SUN_TEXTURE_PATH);
  const { width = 0, height = 0 } = texture.image ?? {};
  const isPowerOfTwoTexture =
    THREE.MathUtils.isPowerOfTwo(width) &&
    THREE.MathUtils.isPowerOfTwo(height);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = isPowerOfTwoTexture
    ? THREE.LinearMipmapLinearFilter
    : THREE.LinearFilter;
  texture.generateMipmaps = isPowerOfTwoTexture;
  texture.needsUpdate = true;

  return texture;
}

function clampOpacity(value, min, max) {
  return THREE.MathUtils.clamp(value, min, max);
}

function clampSunlightMultiplier(multiplier) {
  const safeMultiplier = Number.isFinite(multiplier)
    ? multiplier
    : DEFAULT_SUNLIGHT_MULTIPLIER;

  return THREE.MathUtils.clamp(
    safeMultiplier,
    MIN_SUNLIGHT_MULTIPLIER,
    MAX_SUNLIGHT_MULTIPLIER,
  );
}

function getGlowStrength(multiplier) {
  const normalizedBrightness =
    (clampSunlightMultiplier(multiplier) - MIN_SUNLIGHT_MULTIPLIER) /
    (MAX_SUNLIGHT_MULTIPLIER - MIN_SUNLIGHT_MULTIPLIER);

  return 0.65 + normalizedBrightness * 0.75;
}

function getGlowOpacity(baseOpacity, opacityBoost, glowStrength) {
  return clampOpacity(baseOpacity + opacityBoost * glowStrength, 0, 1);
}

function getGlowScale(radius, baseScale, scaleBoost, glowStrength) {
  return radius * baseScale * (1 + scaleBoost * glowStrength);
}

function getSurfaceIntensity(multiplier, surfaceConfig) {
  const normalizedBrightness =
    (clampSunlightMultiplier(multiplier) - MIN_SUNLIGHT_MULTIPLIER) /
    (MAX_SUNLIGHT_MULTIPLIER - MIN_SUNLIGHT_MULTIPLIER);

  return surfaceConfig.intensityBase + normalizedBrightness * surfaceConfig.intensityBoost;
}

function setSpriteScaleAndOpacity(sprite, scale, opacity) {
  if (!sprite) return;
  sprite.scale.setScalar(scale);
  sprite.material.opacity = opacity;
}

function createRadialGlowTexture(colorStops) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create canvas context for sun glow.");
  }

  const center = canvas.width / 2;
  const glow = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );

  colorStops.forEach(([offset, color]) => {
    glow.addColorStop(offset, color);
  });

  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;

  return texture;
}

function createOrganicGlowTexture({
  size = 1024,
  baseStops,
  blobCount,
  innerRadiusRatio,
  outerRadiusRatio,
  blobSizeRange,
  alphaRange,
  colors,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create canvas context for organic sun glow.");
  }

  const center = size / 2;

  function pseudoRandom(index) {
    const value = Math.sin((index + 1) * 127.1 + size * 0.013) * 43758.5453;
    return value - Math.floor(value);
  }

  const baseGradient = context.createRadialGradient(
    center,
    center,
    center * innerRadiusRatio,
    center,
    center,
    center * outerRadiusRatio,
  );

  baseStops.forEach(([offset, color]) => {
    baseGradient.addColorStop(offset, color);
  });

  context.clearRect(0, 0, size, size);
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";

  for (let i = 0; i < blobCount; i += 1) {
    const angle = pseudoRandom(i) * Math.PI * 2;
    const radius =
      center *
      (innerRadiusRatio +
        (outerRadiusRatio - innerRadiusRatio) * pseudoRandom(i + 17));
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const blobRadius =
      center *
      (blobSizeRange[0] +
        (blobSizeRange[1] - blobSizeRange[0]) * pseudoRandom(i + 29));
    const alpha =
      alphaRange[0] +
      (alphaRange[1] - alphaRange[0]) * pseudoRandom(i + 41);
    const color = colors[i % colors.length];
    const gradient = context.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      blobRadius,
    );

    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
    gradient.addColorStop(0.35, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.45})`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, blobRadius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;

  return texture;
}

function createCoronaTexture() {
  return createOrganicGlowTexture({
    baseStops: [
      [0, "rgba(255, 248, 238, 0.14)"],
      [0.14, "rgba(255, 236, 206, 0.16)"],
      [0.3, "rgba(255, 220, 168, 0.14)"],
      [0.58, "rgba(255, 186, 112, 0.06)"],
      [1, "rgba(255, 150, 78, 0)"],
    ],
    blobCount: 42,
    innerRadiusRatio: 0.08,
    outerRadiusRatio: 0.58,
    blobSizeRange: [0.03, 0.08],
    alphaRange: [0.012, 0.04],
    colors: [
      [255, 236, 196],
      [255, 214, 148],
      [255, 188, 116],
    ],
  });
}

function createInnerGlowTexture() {
  return createRadialGlowTexture([
    [0, "rgba(255, 250, 240, 0.98)"],
    [0.16, "rgba(255, 244, 222, 0.82)"],
    [0.34, "rgba(255, 228, 178, 0.46)"],
    [0.56, "rgba(255, 192, 104, 0.16)"],
    [0.76, "rgba(255, 150, 52, 0.03)"],
    [1, "rgba(255, 140, 48, 0)"],
  ]);
}

function createHaloTexture() {
  return createOrganicGlowTexture({
    baseStops: [
      [0, "rgba(255, 244, 210, 0)"],
      [0.18, "rgba(255, 232, 176, 0.015)"],
      [0.42, "rgba(255, 210, 134, 0.08)"],
      [0.7, "rgba(255, 170, 86, 0.05)"],
      [1, "rgba(255, 128, 42, 0)"],
    ],
    blobCount: 78,
    innerRadiusRatio: 0.22,
    outerRadiusRatio: 0.8,
    blobSizeRange: [0.035, 0.12],
    alphaRange: [0.008, 0.028],
    colors: [
      [255, 222, 162],
      [255, 194, 118],
      [255, 164, 82],
    ],
  });
}

function createOuterGlowTexture() {
  return createOrganicGlowTexture({
    baseStops: [
      [0, "rgba(255, 232, 184, 0)"],
      [0.28, "rgba(255, 210, 138, 0.012)"],
      [0.52, "rgba(255, 178, 94, 0.04)"],
      [0.82, "rgba(255, 140, 58, 0.026)"],
      [1, "rgba(255, 114, 32, 0)"],
    ],
    blobCount: 96,
    innerRadiusRatio: 0.34,
    outerRadiusRatio: 0.98,
    blobSizeRange: [0.045, 0.16],
    alphaRange: [0.005, 0.018],
    colors: [
      [255, 208, 130],
      [255, 176, 98],
      [255, 144, 70],
    ],
  });
}

function createRayBurstTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create canvas context for sun rays.");
  }

  const center = canvas.width / 2;
  const raySeed = 0.61803398875;

  function pseudoRandom(index) {
    const value = Math.sin((index + 1) * 127.1 + raySeed * 431.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function drawSoftRay({
    angle,
    innerRadius,
    outerRadius,
    spread,
    blur,
    coreAlpha,
    midAlpha,
  }) {
    context.save();
    context.translate(center, center);
    context.rotate(angle);
    context.filter = `blur(${blur}px)`;
    context.globalCompositeOperation = "lighter";

    const gradient = context.createLinearGradient(innerRadius, 0, outerRadius, 0);
    gradient.addColorStop(0, `rgba(255, 248, 228, ${coreAlpha})`);
    gradient.addColorStop(0.18, `rgba(255, 224, 160, ${midAlpha})`);
    gradient.addColorStop(0.55, `rgba(255, 182, 94, ${midAlpha * 0.42})`);
    gradient.addColorStop(1, "rgba(255, 142, 60, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(innerRadius, -spread * 0.5);
    context.quadraticCurveTo(
      outerRadius * 0.58,
      -spread,
      outerRadius,
      0,
    );
    context.quadraticCurveTo(
      outerRadius * 0.58,
      spread,
      innerRadius,
      spread * 0.5,
    );
    context.closePath();
    context.fill();
    context.restore();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "lighter";

  const hazeGradient = context.createRadialGradient(
    center,
    center,
    center * 0.12,
    center,
    center,
    center * 0.82,
  );
  hazeGradient.addColorStop(0, "rgba(255, 236, 176, 0.0)");
  hazeGradient.addColorStop(0.22, "rgba(255, 214, 126, 0.06)");
  hazeGradient.addColorStop(0.44, "rgba(255, 182, 82, 0.09)");
  hazeGradient.addColorStop(0.72, "rgba(255, 146, 56, 0.035)");
  hazeGradient.addColorStop(1, "rgba(255, 118, 40, 0)");
  context.fillStyle = hazeGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const jitter = (pseudoRandom(i) - 0.5) * 0.06;
    const length = center * (0.56 + pseudoRandom(i + 13) * 0.12);
    const spread = center * (0.016 + pseudoRandom(i + 29) * 0.008);

    drawSoftRay({
      angle: angle + jitter,
      innerRadius: center * 0.12,
      outerRadius: length,
      spread,
      blur: 18 + pseudoRandom(i + 7) * 14,
      coreAlpha: 0.16 + pseudoRandom(i + 17) * 0.08,
      midAlpha: 0.08 + pseudoRandom(i + 23) * 0.05,
    });
  }

  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2 + Math.PI / 24;
    const jitter = (pseudoRandom(i + 41) - 0.5) * 0.05;
    const length = center * (0.38 + pseudoRandom(i + 53) * 0.08);
    const spread = center * (0.008 + pseudoRandom(i + 61) * 0.004);

    drawSoftRay({
      angle: angle + jitter,
      innerRadius: center * 0.1,
      outerRadius: length,
      spread,
      blur: 8 + pseudoRandom(i + 71) * 8,
      coreAlpha: 0.24 + pseudoRandom(i + 83) * 0.08,
      midAlpha: 0.12 + pseudoRandom(i + 97) * 0.06,
    });
  }

  const innerCoronaGradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center * 0.48,
  );
  innerCoronaGradient.addColorStop(0, "rgba(255, 250, 238, 0.95)");
  innerCoronaGradient.addColorStop(0.18, "rgba(255, 238, 198, 0.4)");
  innerCoronaGradient.addColorStop(0.34, "rgba(255, 210, 132, 0.16)");
  innerCoronaGradient.addColorStop(1, "rgba(255, 176, 84, 0)");
  context.fillStyle = innerCoronaGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const coreGradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center * 0.4,
  );
  coreGradient.addColorStop(0, "rgba(255, 252, 242, 0.95)");
  coreGradient.addColorStop(0.22, "rgba(255, 244, 210, 0.68)");
  coreGradient.addColorStop(0.34, "rgba(255, 232, 176, 0.34)");
  coreGradient.addColorStop(1, "rgba(255, 180, 72, 0)");
  context.fillStyle = coreGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;

  return texture;
}

function createGlowSprite(texture, color, opacity, scale) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    toneMapped: false,
    premultipliedAlpha: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.renderOrder = 10;

  return sprite;
}

const glowShellVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const glowShellFragmentShader = `
  uniform vec3 viewPosition;
  uniform vec3 coreColor;
  uniform vec3 rimColor;
  uniform float opacity;
  uniform float coreStrength;
  uniform float rimStrength;
  uniform float radialPower;
  uniform float rimPower;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(viewPosition - vWorldPosition);
    float viewDot = max(dot(normal, viewDir), 0.0);
    float core = pow(viewDot, radialPower);
    float rim = pow(1.0 - viewDot, rimPower);
    float alpha = clamp((core * coreStrength + rim * rimStrength) * opacity, 0.0, 1.0);
    vec3 color = mix(coreColor, rimColor, clamp(rim, 0.0, 1.0));

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

function createGlowShell(
  radius,
  {
    scale,
    opacity,
    coreStrength,
    rimStrength,
    radialPower,
    rimPower,
    coreColor,
    rimColor,
    renderOrder,
  },
) {
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.ShaderMaterial({
    vertexShader: glowShellVertexShader,
    fragmentShader: glowShellFragmentShader,
    uniforms: {
      viewPosition: { value: new THREE.Vector3() },
      coreColor: { value: new THREE.Color(coreColor) },
      rimColor: { value: new THREE.Color(rimColor) },
      opacity: { value: opacity },
      coreStrength: { value: coreStrength },
      rimStrength: { value: rimStrength },
      radialPower: { value: radialPower },
      rimPower: { value: rimPower },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(scale);
  mesh.renderOrder = renderOrder;

  return mesh;
}

function setShellScale(mesh, scale) {
  if (!mesh) return;
  mesh.scale.setScalar(scale);
}

function setShellViewPosition(mesh, position) {
  if (!mesh || !position) return;
  mesh.material.uniforms.viewPosition.value.copy(position);
}

function setShellOpacity(mesh, opacity) {
  if (!mesh) return;
  mesh.material.uniforms.opacity.value = opacity;
}

function setShellStrength(mesh, coreStrength, rimStrength) {
  if (!mesh) return;
  mesh.material.uniforms.coreStrength.value = coreStrength;
  mesh.material.uniforms.rimStrength.value = rimStrength;
}

function getShellScale(radius, baseScale, factor, maxScale) {
  return radius * Math.min(baseScale * factor, maxScale);
}

export class Sun {
  constructor(radius = 1) {
    this.group = new THREE.Group();
    this.radius = radius;
    this.mesh = null;
    this.innerGlow = null;
    this.corona = null;
    this.coronaShell = null;
    this.rays = null;
    this.halo = null;
    this.hazeShell = null;
    this.outerGlow = null;
    this.surfaceTexture = null;
    this.elapsedTime = 0;
    this.sunlightMultiplier = DEFAULT_SUNLIGHT_MULTIPLIER;
    this.viewDirection = new THREE.Vector3();
    this.lastViewPosition = new THREE.Vector3();
    this.hasViewPosition = false;
    this.isVRMode = false;
    this.preset = DEFAULT_SUN_PRESET;
  }

  async load(textureLoader, textureQuality = {}) {
    const maxAnisotropy = textureQuality.maxAnisotropy ?? 1;

    const innerGlowTexture = createInnerGlowTexture();
    const coronaTexture = createCoronaTexture();
    const raysTexture = createRayBurstTexture();
    const haloTexture = createHaloTexture();
    const outerGlowTexture = createOuterGlowTexture();
    this.surfaceTexture = await loadCinematicSunTexture(textureLoader, maxAnisotropy);
    const glowStrength = getGlowStrength(this.sunlightMultiplier);
    const { sun: sunConfig } = this.preset;

    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader: SunShader.vertexShader,
      fragmentShader: SunShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(SunShader.uniforms),
      toneMapped: false,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
    });
    material.uniforms.coreBoost.value = sunConfig.surface.coreBoost;
    material.uniforms.rimPower.value = sunConfig.surface.rimPower;
    material.uniforms.noiseScale.value = sunConfig.surface.noiseScale;
    material.uniforms.sunMap.value = this.surfaceTexture;
    material.uniforms.textureBlend.value = sunConfig.surface.textureBlend ?? 0;
    material.uniforms.intensity.value = getSurfaceIntensity(
      this.sunlightMultiplier,
      sunConfig.surface,
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 1;
    this.group.add(this.mesh);

    this.innerGlow = createGlowSprite(
      innerGlowTexture,
      0xfff6d4,
      getGlowOpacity(
        sunConfig.glow.innerOpacityBase,
        sunConfig.glow.innerOpacityBoost,
        glowStrength,
      ),
      this.radius * sunConfig.glow.innerScale,
    );
    this.group.add(this.innerGlow);

    this.corona = createGlowSprite(
      coronaTexture,
      0xfff2df,
      getGlowOpacity(
        sunConfig.glow.coronaOpacityBase,
        sunConfig.glow.coronaOpacityBoost,
        glowStrength,
      ),
      this.radius * sunConfig.glow.coronaScale,
    );
    this.group.add(this.corona);

    this.coronaShell = createGlowShell(this.radius, {
      scale: this.radius * sunConfig.glow.coronaScale * 0.7,
      opacity: 0.18,
      coreStrength: 0.28,
      rimStrength: 0.5,
      radialPower: 3.4,
      rimPower: 2.2,
      coreColor: 0xffefcc,
      rimColor: 0xffb86a,
      renderOrder: 6,
    });
    this.group.add(this.coronaShell);

    this.rays = createGlowSprite(
      raysTexture,
      0xffde80,
      getGlowOpacity(
        sunConfig.glow.raysOpacityBase,
        sunConfig.glow.raysOpacityBoost,
        glowStrength,
      ),
      getGlowScale(
        this.radius,
        sunConfig.glow.raysScale,
        sunConfig.glow.raysScaleBoost,
        glowStrength,
      ),
    );
    this.group.add(this.rays);

    this.halo = createGlowSprite(
      haloTexture,
      0xfff0a6,
      getGlowOpacity(
        sunConfig.glow.haloOpacityBase,
        sunConfig.glow.haloOpacityBoost,
        glowStrength,
      ),
      getGlowScale(
        this.radius,
        sunConfig.glow.haloScale,
        sunConfig.glow.haloScaleBoost,
        glowStrength,
      ),
    );
    this.group.add(this.halo);

    this.hazeShell = createGlowShell(this.radius, {
      scale: this.radius * sunConfig.glow.outerScale * 0.55,
      opacity: 0.08,
      coreStrength: 0.08,
      rimStrength: 0.92,
      radialPower: 4.8,
      rimPower: 2.5,
      coreColor: 0xffde9a,
      rimColor: 0xff8f42,
      renderOrder: 5,
    });
    this.group.add(this.hazeShell);

    this.outerGlow = createGlowSprite(
      outerGlowTexture,
      0xffcd72,
      getGlowOpacity(
        sunConfig.glow.outerOpacityBase,
        sunConfig.glow.outerOpacityBoost,
        glowStrength,
      ),
      getGlowScale(
        this.radius,
        sunConfig.glow.outerScale,
        sunConfig.glow.outerScaleBoost,
        glowStrength,
      ),
    );
    this.group.add(this.outerGlow);
    this.applyPreset(this.preset);

    return this.group;
  }

  applyPreset(preset) {
    this.preset = preset ?? DEFAULT_SUN_PRESET;

    if (!this.mesh) return;

    const { sun: sunConfig, visualRadius } = this.preset;

    this.group.scale.setScalar(visualRadius);
    this.mesh.material.uniforms.coreBoost.value = sunConfig.surface.coreBoost;
    this.mesh.material.uniforms.rimPower.value = sunConfig.surface.rimPower;
    this.mesh.material.uniforms.noiseScale.value = sunConfig.surface.noiseScale;
    this.mesh.material.uniforms.textureBlend.value = sunConfig.surface.textureBlend ?? 0;
    this.mesh.material.uniforms.intensity.value = getSurfaceIntensity(
      this.sunlightMultiplier,
      sunConfig.surface,
    );

    const glowStrength = getGlowStrength(this.sunlightMultiplier);
    setSpriteScaleAndOpacity(
      this.innerGlow,
      this.radius * sunConfig.glow.innerScale,
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.innerOpacityBase,
          sunConfig.glow.innerOpacityBoost,
          glowStrength,
        ),
        0,
        sunConfig.opacityCaps.inner,
      ),
    );
    setSpriteScaleAndOpacity(
      this.corona,
      this.radius * sunConfig.glow.coronaScale,
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.coronaOpacityBase,
          sunConfig.glow.coronaOpacityBoost,
          glowStrength,
        ),
        0,
        sunConfig.opacityCaps.corona,
      ),
    );
    setShellScale(
      this.coronaShell,
      getShellScale(this.radius, sunConfig.glow.coronaScale, 0.66, 7.8),
    );
    setShellOpacity(
      this.coronaShell,
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.coronaOpacityBase,
          sunConfig.glow.coronaOpacityBoost,
          glowStrength,
        ) * (this.isVRMode ? 0.58 : 0.34),
        0,
        0.52,
      ),
    );
    setShellStrength(
      this.coronaShell,
      this.isVRMode ? 0.38 : 0.26,
      this.isVRMode ? 0.52 : 0.42,
    );
    setSpriteScaleAndOpacity(
      this.rays,
      getGlowScale(
        this.radius,
        sunConfig.glow.raysScale,
        sunConfig.glow.raysScaleBoost,
        glowStrength,
      ),
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.raysOpacityBase,
          sunConfig.glow.raysOpacityBoost,
          glowStrength,
        ),
        0,
        sunConfig.opacityCaps.rays,
      ),
    );
    setSpriteScaleAndOpacity(
      this.halo,
      getGlowScale(
        this.radius,
        sunConfig.glow.haloScale,
        sunConfig.glow.haloScaleBoost,
        glowStrength,
      ),
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.haloOpacityBase,
          sunConfig.glow.haloOpacityBoost,
          glowStrength,
        ),
        0,
        sunConfig.opacityCaps.halo,
      ),
    );
    setSpriteScaleAndOpacity(
      this.outerGlow,
      getGlowScale(
        this.radius,
        sunConfig.glow.outerScale,
        sunConfig.glow.outerScaleBoost,
        glowStrength,
      ),
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.outerOpacityBase,
          sunConfig.glow.outerOpacityBoost,
          glowStrength,
        ),
        0,
        sunConfig.opacityCaps.outer,
      ),
    );
    setShellScale(
      this.hazeShell,
      getShellScale(this.radius, sunConfig.glow.outerScale, 0.58, 15.5),
    );
    setShellOpacity(
      this.hazeShell,
      clampOpacity(
        getGlowOpacity(
          sunConfig.glow.outerOpacityBase,
          sunConfig.glow.outerOpacityBoost,
          glowStrength,
        ) * (this.isVRMode ? 1.25 : 0.72),
        0,
        0.18,
      ),
    );
    setShellStrength(
      this.hazeShell,
      this.isVRMode ? 0.12 : 0.08,
      this.isVRMode ? 1.08 : 0.9,
    );

    this.syncRenderMode();

    if (this.hasViewPosition) {
      this.updateView(this.lastViewPosition);
    }
  }

  updatePosition(position) {
    this.group.position.copy(position);
  }

  updateView(cameraPosition) {
    if (!cameraPosition) return;

    this.lastViewPosition.copy(cameraPosition);
    this.hasViewPosition = true;

    this.viewDirection.subVectors(cameraPosition, this.group.position);

    if (this.viewDirection.lengthSq() === 0) {
      return;
    }

    this.viewDirection.normalize();
    const { offsets } = this.preset.sun;
    setShellViewPosition(this.coronaShell, cameraPosition);
    setShellViewPosition(this.hazeShell, cameraPosition);

    if (this.innerGlow) {
      this.innerGlow.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * offsets.inner);
    }

    if (this.corona) {
      this.corona.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * offsets.corona);
    }

    if (this.halo) {
      this.halo.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * offsets.halo);
    }

    if (this.rays) {
      this.rays.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * offsets.rays);
    }

    if (this.outerGlow) {
      this.outerGlow.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * offsets.outer);
    }
  }

  setVRMode(isVRMode) {
    this.isVRMode = Boolean(isVRMode);
    this.syncRenderMode();
    this.applyPreset(this.preset);
  }

  syncRenderMode() {
    if (this.corona) {
      this.corona.visible = !this.isVRMode;
    }

    if (this.halo) {
      this.halo.visible = !this.isVRMode;
    }

    if (this.outerGlow) {
      this.outerGlow.visible = !this.isVRMode;
    }

    if (this.rays) {
      this.rays.visible = !this.isVRMode;
    }

    if (this.coronaShell) {
      this.coronaShell.visible = true;
    }

    if (this.hazeShell) {
      this.hazeShell.visible = true;
    }
  }

  setBrightness(multiplier) {
    this.sunlightMultiplier = clampSunlightMultiplier(multiplier);
  }

  update(delta) {
    if (!this.mesh) return;

    const { sun: sunConfig } = this.preset;
    this.elapsedTime += delta;
    this.mesh.rotation.y += delta * 0.04;
    this.mesh.rotation.x += delta * 0.012;
    this.mesh.material.uniforms.time.value = this.elapsedTime;
    this.mesh.material.uniforms.intensity.value = getSurfaceIntensity(
      this.sunlightMultiplier,
      sunConfig.surface,
    );

    const glowStrength = getGlowStrength(this.sunlightMultiplier);
    const glowPulse = 1 + Math.sin(this.elapsedTime * 0.9) * 0.015;
    const outerPulse = 1 + Math.sin(this.elapsedTime * 0.42 + 1.4) * 0.025;

    if (this.innerGlow) {
      this.innerGlow.scale.setScalar(
        this.radius * sunConfig.glow.innerScale * glowPulse,
      );
      this.innerGlow.material.opacity = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.innerOpacityBase,
          sunConfig.glow.innerOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 1.4) * 0.05,
        0,
        sunConfig.opacityCaps.inner,
      );
    }

    if (this.corona) {
      this.corona.material.rotation += delta * 0.03;
      this.corona.scale.setScalar(
        this.radius * sunConfig.glow.coronaScale * glowPulse,
      );
      this.corona.material.opacity = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.coronaOpacityBase,
          sunConfig.glow.coronaOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 0.85 + 0.8) * 0.04,
        0,
        sunConfig.opacityCaps.corona,
      );
    }

    if (this.coronaShell) {
      this.coronaShell.rotation.y += delta * 0.016;
      this.coronaShell.rotation.x -= delta * 0.009;
      this.coronaShell.scale.setScalar(
        getShellScale(this.radius, sunConfig.glow.coronaScale, 0.66, 7.8) *
          (1 + Math.sin(this.elapsedTime * 0.56 + 0.5) * 0.016),
      );
      this.coronaShell.material.uniforms.opacity.value = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.coronaOpacityBase,
          sunConfig.glow.coronaOpacityBoost,
          glowStrength,
        ) * (this.isVRMode ? 0.6 : 0.34) +
          Math.sin(this.elapsedTime * 0.72 + 0.3) * 0.01,
        0,
        0.52,
      );
    }

    if (this.rays) {
      this.rays.material.rotation -= delta * 0.032;
      this.rays.scale.setScalar(
        getGlowScale(
          this.radius,
          sunConfig.glow.raysScale,
          sunConfig.glow.raysScaleBoost,
          glowStrength,
        ) *
          (1 + Math.sin(this.elapsedTime * 0.5 + 0.2) * 0.035),
      );
      this.rays.material.opacity = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.raysOpacityBase,
          sunConfig.glow.raysOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 1.05) * 0.04,
        0,
        sunConfig.opacityCaps.rays,
      );
    }

    if (this.halo) {
      this.halo.material.rotation -= delta * 0.012;
      this.halo.scale.setScalar(
        getGlowScale(
          this.radius,
          sunConfig.glow.haloScale,
          sunConfig.glow.haloScaleBoost,
          glowStrength,
        ) * outerPulse,
      );
      this.halo.material.opacity = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.haloOpacityBase,
          sunConfig.glow.haloOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 0.7) * 0.035,
        0,
        sunConfig.opacityCaps.halo,
      );
    }

    if (this.hazeShell) {
      this.hazeShell.rotation.y -= delta * 0.01;
      this.hazeShell.rotation.z += delta * 0.006;
      this.hazeShell.scale.setScalar(
        getShellScale(this.radius, sunConfig.glow.outerScale, 0.58, 15.5) *
          (1 + Math.sin(this.elapsedTime * 0.34 + 1.1) * 0.018),
      );
      this.hazeShell.material.uniforms.opacity.value = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.outerOpacityBase,
          sunConfig.glow.outerOpacityBoost,
          glowStrength,
        ) * (this.isVRMode ? 1.22 : 0.72) +
          Math.sin(this.elapsedTime * 0.48 + 1.4) * 0.006,
        0,
        0.18,
      );
    }

    if (this.outerGlow) {
      this.outerGlow.scale.setScalar(
        getGlowScale(
          this.radius,
          sunConfig.glow.outerScale,
          sunConfig.glow.outerScaleBoost,
          glowStrength,
        ) * outerPulse,
      );
      this.outerGlow.material.opacity = clampOpacity(
        getGlowOpacity(
          sunConfig.glow.outerOpacityBase,
          sunConfig.glow.outerOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 0.55) * 0.05,
        0,
        sunConfig.opacityCaps.outer,
      );
    }
  }

  dispose() {
    const disposedMaps = new Set();

    this.group.children.forEach((child) => {
      child.geometry?.dispose();
      const material = child.material;
      const map = material?.map ?? material?.uniforms?.sunMap?.value;

      if (map && !disposedMaps.has(map)) {
        map.dispose();
        disposedMaps.add(map);
      }

      child.material?.dispose();
    });
  }
}
