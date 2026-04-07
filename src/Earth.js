import * as THREE from 'three';
import { loadAdaptiveEquirectangularTexture } from './AdaptiveTexture.js';
import { EarthShader } from './EarthShader.js';

const EARTH_RADIUS = 2;
const SEGMENTS = 96;
const AXIS_TILT = THREE.MathUtils.degToRad(23.5);
const TEXTURE_PATHS = {
  dayMap: [
    'NewTextures/daymap.jpg',
    'textures/earth_daymap.jpg',
  ],
  nightMap: [
    'NewTextures/night.jpg',
    'textures/earth_nightmap.jpg',
  ],
};

export class Earth {
  constructor() {
    this.mesh = null;
    this.surfaceDetailEnabled = true;
    this.flatMapLightingEnabled = false;
  }

  async loadSurfaceTextures(textureLoader, textureQuality) {
    const {
      maxAnisotropy,
      maxTextureSize,
      devicePixelRatio,
      qualityPreset = 'auto',
    } = textureQuality;

    const [dayMap, nightMap] = await Promise.all([
      loadAdaptiveEquirectangularTexture(textureLoader, TEXTURE_PATHS.dayMap, {
        maxAnisotropy,
        maxTextureSize,
        devicePixelRatio,
        qualityPreset,
        colorSpace: THREE.SRGBColorSpace,
      }),
      loadAdaptiveEquirectangularTexture(textureLoader, TEXTURE_PATHS.nightMap, {
        maxAnisotropy,
        maxTextureSize,
        devicePixelRatio,
        qualityPreset,
        colorSpace: THREE.SRGBColorSpace,
      }),
    ]);

    return { dayMap, nightMap };
  }

  async load(textureLoader, textureQuality) {
    const { dayMap, nightMap } = await this.loadSurfaceTextures(
      textureLoader,
      textureQuality
    );

    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, SEGMENTS, SEGMENTS);
    const material = new THREE.ShaderMaterial({
      vertexShader: EarthShader.vertexShader,
      fragmentShader: EarthShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(EarthShader.uniforms)
    });

    material.uniforms.dayMap.value = dayMap;
    material.uniforms.nightMap.value = nightMap;
    material.uniforms.dayMapTexelSize.value.set(1 / dayMap.image.width, 1 / dayMap.image.height);
    material.uniforms.nightMapTexelSize.value.set(1 / nightMap.image.width, 1 / nightMap.image.height);
    material.uniforms.cameraDistance.value = 6;
    material.uniforms.surfaceDetailEnabled.value = 1;
    material.uniforms.sunBrightness.value = 1.4;
    material.uniforms.flatMapLighting.value = 0;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.x = -AXIS_TILT;

    return this.mesh;
  }

  async reloadSurfaceTextures(textureLoader, textureQuality) {
    if (!this.mesh?.material?.uniforms) {
      return false;
    }

    const { dayMap, nightMap } = await this.loadSurfaceTextures(
      textureLoader,
      textureQuality
    );
    const uniforms = this.mesh.material.uniforms;
    const previousDayMap = uniforms.dayMap?.value ?? null;
    const previousNightMap = uniforms.nightMap?.value ?? null;

    uniforms.dayMap.value = dayMap;
    uniforms.nightMap.value = nightMap;
    uniforms.dayMapTexelSize.value.set(1 / dayMap.image.width, 1 / dayMap.image.height);
    uniforms.nightMapTexelSize.value.set(1 / nightMap.image.width, 1 / nightMap.image.height);

    previousDayMap?.dispose?.();
    previousNightMap?.dispose?.();

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

  toggleSurfaceDetail() {
    this.setSurfaceDetailEnabled(!this.surfaceDetailEnabled);
    return this.surfaceDetailEnabled;
  }

  dispose() {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    this.mesh.material.uniforms.dayMap.value?.dispose();
    this.mesh.material.uniforms.nightMap.value?.dispose();
    this.mesh.material.dispose();
  }
}
