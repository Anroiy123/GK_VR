import * as THREE from "three";
import { SunShader } from "./SunShader.js";

const MIN_SUNLIGHT_MULTIPLIER = 0.5;
const MAX_SUNLIGHT_MULTIPLIER = 3;
const DEFAULT_SUNLIGHT_MULTIPLIER = 1.4;

const SUN_VISUALS = {
  surface: {
    coreBoost: 1.2,
    rimPower: 1.75,
    noiseScale: 6.8,
  },
  glow: {
    innerScale: 6.8,
    coronaScale: 9.6,
    raysScale: 12.6,
    haloScale: 17.8,
    outerScale: 22.0,
    innerOpacityBase: 0.88,
    coronaOpacityBase: 0.58,
    raysOpacityBase: 0.5,
    haloOpacityBase: 0.34,
    outerOpacityBase: 0.17,
    innerOpacityBoost: 0.22,
    coronaOpacityBoost: 0.22,
    raysOpacityBoost: 0.24,
    haloOpacityBoost: 0.36,
    outerOpacityBoost: 0.24,
    raysScaleBoost: 0.055,
    haloScaleBoost: 0.04,
    outerScaleBoost: 0.06,
  },
};

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

function getSurfaceIntensity(multiplier) {
  const normalizedBrightness =
    (clampSunlightMultiplier(multiplier) - MIN_SUNLIGHT_MULTIPLIER) /
    (MAX_SUNLIGHT_MULTIPLIER - MIN_SUNLIGHT_MULTIPLIER);

  return 1.18 + normalizedBrightness * 1.62;
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

  return texture;
}

function createCoronaTexture() {
  return createRadialGlowTexture([
    [0, "rgba(255, 248, 238, 0.26)"],
    [0.14, "rgba(255, 242, 222, 0.2)"],
    [0.28, "rgba(255, 234, 198, 0.22)"],
    [0.44, "rgba(255, 220, 170, 0.24)"],
    [0.62, "rgba(255, 188, 118, 0.1)"],
    [1, "rgba(255, 150, 78, 0)"],
  ]);
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
  return createRadialGlowTexture([
    [0, "rgba(255, 248, 220, 0)"],
    [0.14, "rgba(255, 240, 198, 0.03)"],
    [0.28, "rgba(255, 226, 154, 0.18)"],
    [0.44, "rgba(255, 206, 122, 0.42)"],
    [0.62, "rgba(255, 178, 78, 0.12)"],
    [1, "rgba(255, 136, 38, 0)"],
  ]);
}

function createOuterGlowTexture() {
  return createRadialGlowTexture([
    [0, "rgba(255, 240, 206, 0)"],
    [0.2, "rgba(255, 224, 154, 0.02)"],
    [0.34, "rgba(255, 194, 108, 0.08)"],
    [0.5, "rgba(255, 166, 66, 0.12)"],
    [0.68, "rgba(255, 128, 32, 0.04)"],
    [1, "rgba(255, 110, 24, 0)"],
  ]);
}

function createRayBurstTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create canvas context for sun rays.");
  }

  const center = canvas.width / 2;

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 32; i += 1) {
    const angle = (i / 32) * Math.PI * 2;
    const rayLength = center * (0.48 + (i % 4) * 0.1);
    const innerRadius = center * 0.12;
    const spread = 0.032 + (i % 3) * 0.006;

    context.save();
    context.translate(center, center);
    context.rotate(angle);

    const gradient = context.createLinearGradient(innerRadius, 0, rayLength, 0);
    gradient.addColorStop(0, "rgba(255, 250, 232, 0.7)");
    gradient.addColorStop(0.36, "rgba(255, 214, 102, 0.42)");
    gradient.addColorStop(1, "rgba(255, 168, 64, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(innerRadius, -center * spread);
    context.lineTo(rayLength, 0);
    context.lineTo(innerRadius, center * spread);
    context.closePath();
    context.fill();

    context.restore();
  }

  const coreGradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center * 0.4,
  );
  coreGradient.addColorStop(0, "rgba(255, 252, 242, 0.95)");
  coreGradient.addColorStop(0.3, "rgba(255, 238, 182, 0.55)");
  coreGradient.addColorStop(1, "rgba(255, 180, 72, 0)");
  context.fillStyle = coreGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

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
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.renderOrder = 10;

  return sprite;
}

export class Sun {
  constructor(radius = 1.5) {
    this.group = new THREE.Group();
    this.radius = radius;
    this.mesh = null;
    this.innerGlow = null;
    this.corona = null;
    this.rays = null;
    this.halo = null;
    this.outerGlow = null;
    this.elapsedTime = 0;
    this.sunlightMultiplier = DEFAULT_SUNLIGHT_MULTIPLIER;
    this.viewDirection = new THREE.Vector3();
  }

  async load(textureLoader, textureQuality = {}) {
    void textureLoader;
    void textureQuality;

    const innerGlowTexture = createInnerGlowTexture();
    const coronaTexture = createCoronaTexture();
    const raysTexture = createRayBurstTexture();
    const haloTexture = createHaloTexture();
    const outerGlowTexture = createOuterGlowTexture();
    const glowStrength = getGlowStrength(this.sunlightMultiplier);

    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader: SunShader.vertexShader,
      fragmentShader: SunShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(SunShader.uniforms),
      toneMapped: false,
      transparent: true,
    });
    material.uniforms.coreBoost.value = SUN_VISUALS.surface.coreBoost;
    material.uniforms.rimPower.value = SUN_VISUALS.surface.rimPower;
    material.uniforms.noiseScale.value = SUN_VISUALS.surface.noiseScale;
    material.uniforms.intensity.value = getSurfaceIntensity(
      this.sunlightMultiplier,
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 1;
    this.group.add(this.mesh);

    this.innerGlow = createGlowSprite(
      innerGlowTexture,
      0xfff6d4,
      getGlowOpacity(
        SUN_VISUALS.glow.innerOpacityBase,
        SUN_VISUALS.glow.innerOpacityBoost,
        glowStrength,
      ),
      this.radius * SUN_VISUALS.glow.innerScale,
    );
    this.group.add(this.innerGlow);

    this.corona = createGlowSprite(
      coronaTexture,
      0xfff2df,
      getGlowOpacity(
        SUN_VISUALS.glow.coronaOpacityBase,
        SUN_VISUALS.glow.coronaOpacityBoost,
        glowStrength,
      ),
      this.radius * SUN_VISUALS.glow.coronaScale,
    );
    this.group.add(this.corona);

    this.rays = createGlowSprite(
      raysTexture,
      0xffde80,
      getGlowOpacity(
        SUN_VISUALS.glow.raysOpacityBase,
        SUN_VISUALS.glow.raysOpacityBoost,
        glowStrength,
      ),
      getGlowScale(
        this.radius,
        SUN_VISUALS.glow.raysScale,
        SUN_VISUALS.glow.raysScaleBoost,
        glowStrength,
      ),
    );
    this.group.add(this.rays);

    this.halo = createGlowSprite(
      haloTexture,
      0xfff0a6,
      getGlowOpacity(
        SUN_VISUALS.glow.haloOpacityBase,
        SUN_VISUALS.glow.haloOpacityBoost,
        glowStrength,
      ),
      getGlowScale(
        this.radius,
        SUN_VISUALS.glow.haloScale,
        SUN_VISUALS.glow.haloScaleBoost,
        glowStrength,
      ),
    );
    this.group.add(this.halo);

    this.outerGlow = createGlowSprite(
      outerGlowTexture,
      0xffcd72,
      getGlowOpacity(
        SUN_VISUALS.glow.outerOpacityBase,
        SUN_VISUALS.glow.outerOpacityBoost,
        glowStrength,
      ),
      getGlowScale(
        this.radius,
        SUN_VISUALS.glow.outerScale,
        SUN_VISUALS.glow.outerScaleBoost,
        glowStrength,
      ),
    );
    this.group.add(this.outerGlow);

    return this.group;
  }

  updatePosition(position) {
    this.group.position.copy(position);
  }

  updateView(cameraPosition) {
    if (!cameraPosition) return;

    this.viewDirection.subVectors(cameraPosition, this.group.position);

    if (this.viewDirection.lengthSq() === 0) {
      return;
    }

    this.viewDirection.normalize();

    if (this.innerGlow) {
      this.innerGlow.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * 0.18);
    }

    if (this.corona) {
      this.corona.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * 0.12);
    }

    if (this.halo) {
      this.halo.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * 0.04);
    }

    if (this.rays) {
      this.rays.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * 0.06);
    }

    if (this.outerGlow) {
      this.outerGlow.position
        .copy(this.viewDirection)
        .multiplyScalar(this.radius * 0.02);
    }
  }

  setBrightness(multiplier) {
    this.sunlightMultiplier = clampSunlightMultiplier(multiplier);
  }

  update(delta) {
    if (!this.mesh) return;

    this.elapsedTime += delta;
    this.mesh.rotation.y += delta * 0.04;
    this.mesh.rotation.x += delta * 0.012;
    this.mesh.material.uniforms.time.value = this.elapsedTime;
    this.mesh.material.uniforms.intensity.value = getSurfaceIntensity(
      this.sunlightMultiplier,
    );

    const glowStrength = getGlowStrength(this.sunlightMultiplier);
    const glowPulse = 1 + Math.sin(this.elapsedTime * 0.9) * 0.015;
    const outerPulse = 1 + Math.sin(this.elapsedTime * 0.42 + 1.4) * 0.025;

    if (this.innerGlow) {
      this.innerGlow.scale.setScalar(
        this.radius * SUN_VISUALS.glow.innerScale * glowPulse,
      );
      this.innerGlow.material.opacity = clampOpacity(
        getGlowOpacity(
          SUN_VISUALS.glow.innerOpacityBase,
          SUN_VISUALS.glow.innerOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 1.4) * 0.05,
        0,
        1,
      );
    }

    if (this.corona) {
      this.corona.material.rotation += delta * 0.03;
      this.corona.scale.setScalar(
        this.radius * SUN_VISUALS.glow.coronaScale * glowPulse,
      );
      this.corona.material.opacity = clampOpacity(
        getGlowOpacity(
          SUN_VISUALS.glow.coronaOpacityBase,
          SUN_VISUALS.glow.coronaOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 0.85 + 0.8) * 0.04,
        0,
        1,
      );
    }

    if (this.rays) {
      this.rays.material.rotation -= delta * 0.032;
      this.rays.scale.setScalar(
        getGlowScale(
          this.radius,
          SUN_VISUALS.glow.raysScale,
          SUN_VISUALS.glow.raysScaleBoost,
          glowStrength,
        ) *
          (1 + Math.sin(this.elapsedTime * 0.5 + 0.2) * 0.035),
      );
      this.rays.material.opacity = clampOpacity(
        getGlowOpacity(
          SUN_VISUALS.glow.raysOpacityBase,
          SUN_VISUALS.glow.raysOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 1.05) * 0.04,
        0,
        1,
      );
    }

    if (this.halo) {
      this.halo.material.rotation -= delta * 0.012;
      this.halo.scale.setScalar(
        getGlowScale(
          this.radius,
          SUN_VISUALS.glow.haloScale,
          SUN_VISUALS.glow.haloScaleBoost,
          glowStrength,
        ) * outerPulse,
      );
      this.halo.material.opacity = clampOpacity(
        getGlowOpacity(
          SUN_VISUALS.glow.haloOpacityBase,
          SUN_VISUALS.glow.haloOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 0.7) * 0.035,
        0,
        1,
      );
    }

    if (this.outerGlow) {
      this.outerGlow.scale.setScalar(
        getGlowScale(
          this.radius,
          SUN_VISUALS.glow.outerScale,
          SUN_VISUALS.glow.outerScaleBoost,
          glowStrength,
        ) * outerPulse,
      );
      this.outerGlow.material.opacity = clampOpacity(
        getGlowOpacity(
          SUN_VISUALS.glow.outerOpacityBase,
          SUN_VISUALS.glow.outerOpacityBoost,
          glowStrength,
        ) +
          Math.sin(this.elapsedTime * 0.55) * 0.05,
        0,
        1,
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
