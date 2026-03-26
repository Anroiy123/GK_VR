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
  }

  async load(textureLoader, textureQuality) {
    const { maxAnisotropy, maxTextureSize, devicePixelRatio } = textureQuality;
    const [dayMap, nightMap] = await Promise.all([
      loadAdaptiveEquirectangularTexture(textureLoader, TEXTURE_PATHS.dayMap, {
        maxAnisotropy,
        maxTextureSize,
        devicePixelRatio,
        colorSpace: THREE.SRGBColorSpace,
      }),
      loadAdaptiveEquirectangularTexture(textureLoader, TEXTURE_PATHS.nightMap, {
        maxAnisotropy,
        maxTextureSize,
        devicePixelRatio,
        colorSpace: THREE.SRGBColorSpace,
      }),
    ]);

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

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.x = -AXIS_TILT;

    return this.mesh;
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
