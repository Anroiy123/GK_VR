import * as THREE from 'three';

const CLOUD_RADIUS = 2.03;
const SEGMENTS = 48;
const CLOUD_ROTATION_SPEED = 0.012;
const FAR_CLOUD_OPACITY = 0.48;
const NEAR_CLOUD_OPACITY = 0.2;
const NEAR_CAMERA_DISTANCE = 2.6;
const FAR_CAMERA_DISTANCE = 6;

function configureTexture(texture, maxAnisotropy) {
  const { width = 0, height = 0 } = texture.image ?? {};
  const isPowerOfTwoTexture =
    THREE.MathUtils.isPowerOfTwo(width) &&
    THREE.MathUtils.isPowerOfTwo(height);

  texture.anisotropy = maxAnisotropy;
  texture.magFilter = THREE.LinearFilter;

  if (isPowerOfTwoTexture) {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
  } else {
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }

  texture.needsUpdate = true;

  return texture;
}

export class Clouds {
  constructor() {
    this.mesh = null;
    this.isVisible = true;
  }

  async load(textureLoader, maxAnisotropy) {
    const cloudMap = await textureLoader.loadAsync('textures/earth_clouds.png');
    configureTexture(cloudMap, maxAnisotropy);

    const geometry = new THREE.SphereGeometry(CLOUD_RADIUS, SEGMENTS, SEGMENTS);
    const material = new THREE.MeshStandardMaterial({
      map: cloudMap,
      alphaMap: cloudMap,
      transparent: true,
      opacity: FAR_CLOUD_OPACITY,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    return this.mesh;
  }

  update(delta, speedMultiplier = 1, cameraDistance = FAR_CAMERA_DISTANCE) {
    if (!this.mesh || !this.isVisible) return;

    this.mesh.rotation.y += CLOUD_ROTATION_SPEED * speedMultiplier * delta;

    const distanceAlpha = THREE.MathUtils.clamp(
      (cameraDistance - NEAR_CAMERA_DISTANCE) / (FAR_CAMERA_DISTANCE - NEAR_CAMERA_DISTANCE),
      0,
      1
    );

    this.mesh.material.opacity = THREE.MathUtils.lerp(
      NEAR_CLOUD_OPACITY,
      FAR_CLOUD_OPACITY,
      distanceAlpha
    );
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;

    if (!this.mesh) return;

    this.mesh.visible = isVisible;
  }

  toggleVisibility() {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  dispose() {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
  }
}
