import * as THREE from 'three';
import { loadAdaptiveEquirectangularTexture } from './AdaptiveTexture.js';

const BACKGROUND_RADIUS = 128;
const STAR_COUNT = 3200;
const STAR_RADIUS = 124;

function randomPointOnSphere(radius, thickness = 0) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = radius + (Math.random() - 0.5) * thickness;

  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function createAccentStars() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const color = new THREE.Color();
  const palette = ['#ffffff', '#dbe7ff', '#ffe5c9'];

  for (let index = 0; index < STAR_COUNT; index++) {
    const position = randomPointOnSphere(STAR_RADIUS, 18);
    const offset = index * 3;

    positions[offset] = position.x;
    positions[offset + 1] = position.y;
    positions[offset + 2] = position.z;

    color.set(palette[Math.floor(Math.random() * palette.length)]);
    color.multiplyScalar(0.8 + Math.random() * 0.35);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export class Starfield {
  constructor() {
    this.group = new THREE.Group();
  }

  async create(textureLoader, textureQuality) {
    const backgroundTexture = await loadAdaptiveEquirectangularTexture(
      textureLoader,
      ['NewTextures/universal.png'],
      {
        maxAnisotropy: textureQuality.maxAnisotropy,
        maxTextureSize: textureQuality.maxTextureSize,
        devicePixelRatio: textureQuality.devicePixelRatio,
        colorSpace: THREE.SRGBColorSpace,
      }
    );

    const backgroundMaterial = new THREE.MeshBasicMaterial({
      map: backgroundTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    const backgroundSphere = new THREE.Mesh(
      new THREE.SphereGeometry(BACKGROUND_RADIUS, 64, 48),
      backgroundMaterial
    );

    backgroundSphere.rotation.y = THREE.MathUtils.degToRad(110);
    backgroundSphere.rotation.z = THREE.MathUtils.degToRad(-8);

    const accentStars = createAccentStars();

    this.group.add(backgroundSphere);
    this.group.add(accentStars);

    return this.group;
  }

  dispose() {
    this.group.children.forEach((child) => {
      child.geometry?.dispose();
      child.material?.map?.dispose();
      child.material?.dispose();
    });
  }
}
