import * as THREE from "three";
import {
  disposeTexture,
  getEarthTextureDimensions,
  loadAdaptiveEquirectangularTexture,
} from "./AdaptiveTexture.js";
import { EarthShader } from "./EarthShader.js";

const EARTH_RADIUS = 2;
const SEGMENTS = 96;
const AXIS_TILT = THREE.MathUtils.degToRad(23.5);
const TEXTURE_PATHS = {
  dayMap: ["NewTextures/daymap.jpg", "textures/earth_daymap.jpg"],
  nightMap: ["NewTextures/night.jpg", "textures/earth_nightmap.jpg"],
};

export class Earth {
  constructor() {
    this.mesh = null;
    this.surfaceDetailEnabled = true;
    this.flatMapLightingEnabled = false;
    this.surfaceTextureCache = new Map();
    this.surfaceTextures = new Set();
    this.isDisposed = false;
  }

  getSurfaceTextureCacheKey(textureQuality) {
    const {
      maxTextureSize,
      devicePixelRatio,
      qualityPreset = "auto",
    } = textureQuality;
    const { width, height } = getEarthTextureDimensions(
      maxTextureSize,
      devicePixelRatio,
      qualityPreset,
    );

    return `${qualityPreset}:${width}x${height}`;
  }

  async loadSurfaceTextures(textureLoader, textureQuality) {
    const cacheKey = this.getSurfaceTextureCacheKey(textureQuality);
    const cachedSurfaceTextures = this.surfaceTextureCache.get(cacheKey);
    if (cachedSurfaceTextures) {
      return cachedSurfaceTextures;
    }

    const {
      maxAnisotropy,
      maxTextureSize,
      devicePixelRatio,
      qualityPreset = "auto",
    } = textureQuality;

    const surfaceTexturePromise = Promise.all([
      loadAdaptiveEquirectangularTexture(textureLoader, TEXTURE_PATHS.dayMap, {
        maxAnisotropy,
        maxTextureSize,
        devicePixelRatio,
        qualityPreset,
        colorSpace: THREE.SRGBColorSpace,
      }),
      loadAdaptiveEquirectangularTexture(
        textureLoader,
        TEXTURE_PATHS.nightMap,
        {
          maxAnisotropy,
          maxTextureSize,
          devicePixelRatio,
          qualityPreset,
          colorSpace: THREE.SRGBColorSpace,
        },
      ),
    ])
      .then(([dayMap, nightMap]) => {
        if (this.isDisposed) {
          disposeTexture(dayMap);
          disposeTexture(nightMap);
        } else {
          this.surfaceTextures.add(dayMap);
          this.surfaceTextures.add(nightMap);
        }

        return { dayMap, nightMap };
      })
      .catch((error) => {
        this.surfaceTextureCache.delete(cacheKey);
        throw error;
      });

    this.surfaceTextureCache.set(cacheKey, surfaceTexturePromise);
    return surfaceTexturePromise;
  }

  async load(textureLoader, textureQuality) {
    const { dayMap, nightMap } = await this.loadSurfaceTextures(
      textureLoader,
      textureQuality,
    );

    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, SEGMENTS, SEGMENTS);
    const material = new THREE.ShaderMaterial({
      vertexShader: EarthShader.vertexShader,
      fragmentShader: EarthShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(EarthShader.uniforms),
    });

    material.uniforms.dayMap.value = dayMap;
    material.uniforms.nightMap.value = nightMap;
    material.uniforms.dayMapTexelSize.value.set(
      1 / dayMap.image.width,
      1 / dayMap.image.height,
    );
    material.uniforms.nightMapTexelSize.value.set(
      1 / nightMap.image.width,
      1 / nightMap.image.height,
    );
    material.uniforms.cameraDistance.value = 6;
    material.uniforms.surfaceDetailEnabled.value = 1;
    material.uniforms.sunBrightness.value = 1.0;
    material.uniforms.flatMapLighting.value = 0;
    material.uniforms.moonRadius.value = 0.5;
    material.uniforms.eclipseEnabled.value = 0;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.order = "YXZ";
    this.mesh.rotation.x = -AXIS_TILT;

    return this.mesh;
  }

  async reloadSurfaceTextures(textureLoader, textureQuality) {
    if (!this.mesh?.material?.uniforms) {
      return false;
    }

    const { dayMap, nightMap } = await this.loadSurfaceTextures(
      textureLoader,
      textureQuality,
    );
    const uniforms = this.mesh.material.uniforms;

    uniforms.dayMap.value = dayMap;
    uniforms.nightMap.value = nightMap;
    uniforms.dayMapTexelSize.value.set(
      1 / dayMap.image.width,
      1 / dayMap.image.height,
    );
    uniforms.nightMapTexelSize.value.set(
      1 / nightMap.image.width,
      1 / nightMap.image.height,
    );

    return true;
  }

  updateRotation(rotationAngle) {
    if (!this.mesh) return;
    this.mesh.rotation.y = rotationAngle;
  }

  setSunDirection(direction) {
    if (!this.mesh) return;
    this.mesh.material.uniforms.sunDirection.value.copy(direction).normalize();
  }

  setMoonPosition(position) {
    if (!this.mesh || !this.mesh.material.uniforms.moonPosition) return;
    this.mesh.material.uniforms.moonPosition.value.copy(position);
  }

  setMoonRadius(radius) {
    if (!this.mesh || !this.mesh.material.uniforms.moonRadius) return;
    this.mesh.material.uniforms.moonRadius.value = Math.max(0, radius);
  }

  setCameraDistance(distance) {
    if (!this.mesh || !this.mesh.material.uniforms.cameraDistance) return;
    this.mesh.material.uniforms.cameraDistance.value = distance;
  }

  setSunBrightness(intensity) {
    if (!this.mesh || !this.mesh.material.uniforms.sunBrightness) return;
    this.mesh.material.uniforms.sunBrightness.value = intensity;
  }

  setSurfaceDetailEnabled(isEnabled) {
    this.surfaceDetailEnabled = isEnabled;

    if (!this.mesh || !this.mesh.material.uniforms.surfaceDetailEnabled) return;
    this.mesh.material.uniforms.surfaceDetailEnabled.value = isEnabled ? 1 : 0;
  }

  setFlatMapLightingEnabled(isEnabled) {
    this.flatMapLightingEnabled = isEnabled;

    if (!this.mesh || !this.mesh.material.uniforms.flatMapLighting) return;
    this.mesh.material.uniforms.flatMapLighting.value = isEnabled ? 1 : 0;
  }

  setEclipseEnabled(isEnabled) {
    if (!this.mesh || !this.mesh.material.uniforms.eclipseEnabled) return;
    this.mesh.material.uniforms.eclipseEnabled.value = isEnabled ? 1 : 0;
  }

  toggleSurfaceDetail() {
    this.setSurfaceDetailEnabled(!this.surfaceDetailEnabled);
    return this.surfaceDetailEnabled;
  }

  dispose() {
    if (!this.mesh) return;
    this.isDisposed = true;
    this.surfaceTextureCache.clear();
    this.surfaceTextures.forEach((texture) => {
      disposeTexture(texture);
    });
    this.surfaceTextures.clear();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
