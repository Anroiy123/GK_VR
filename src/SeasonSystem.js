import * as THREE from "three";
import { Earth } from "./Earth.js";
import { CelestialCalculator } from "./CelestialCalculator.js";

const DEMO_YEAR = 2026;
const EARTH_RADIUS = 2;
const SEASON_SUN_RADIUS = 2.4;
const EARTH_SCALE = 0.5; // Shrink Earth and its frame down so it's smaller than Sun
const ORBIT_RADIUS = 8.2;
const AXIS_TILT_DEG = 23.44;
const AXIS_TILT_RAD = THREE.MathUtils.degToRad(AXIS_TILT_DEG);
const MARKER_RADIUS_OFFSET = 0.1;
const RING_SEGMENTS = 240;
const POLAR_CIRCLE_LAT = 90 - AXIS_TILT_DEG;
const CAMERA_POSITION = new THREE.Vector3(11.6, 5.2, 8.6);
const CAMERA_TARGET = new THREE.Vector3(2.2, 0, 0);
const SEASON_EVENT_DATES = {
  "march-equinox": new Date(Date.UTC(DEMO_YEAR, 2, 20, 12, 0, 0)),
  "june-solstice": new Date(Date.UTC(DEMO_YEAR, 5, 21, 12, 0, 0)),
  "september-equinox": new Date(Date.UTC(DEMO_YEAR, 8, 22, 12, 0, 0)),
  "december-solstice": new Date(Date.UTC(DEMO_YEAR, 11, 21, 12, 0, 0)),
};
const SEASON_SUN_TEXTURE_PATH = "NewTextures/8k_sun.jpg";
const SEASON_SUN_GLOW_COLOR = new THREE.Color(0xffd68a);

async function loadSeasonSunTexture(textureLoader, maxAnisotropy = 1) {
  const texture = await textureLoader.loadAsync(SEASON_SUN_TEXTURE_PATH);
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

function createGlowTexture(stops) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Không tạo được glow texture cho mặt trời mùa vụ.");
  }

  const center = canvas.width / 2;
  const gradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );

  stops.forEach(([offset, color]) => {
    gradient.addColorStop(offset, color);
  });

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;
  return texture;
}

function createGlowSprite(texture, scale, opacity) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: SEASON_SUN_GLOW_COLOR,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.renderOrder = 6;
  return sprite;
}

function getRepresentativeDate(monthIndex) {
  return new Date(Date.UTC(DEMO_YEAR, monthIndex, 15, 12, 0, 0));
}

function getSeasonDate(monthIndex, eventKey) {
  if (eventKey && SEASON_EVENT_DATES[eventKey]) {
    return new Date(SEASON_EVENT_DATES[eventKey].getTime());
  }

  return getRepresentativeDate(monthIndex);
}

function createOrbitRing(radius) {
  const points = [];

  for (let index = 0; index < RING_SEGMENTS; index += 1) {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ),
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x8fb8df,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      toneMapped: false,
    }),
  );
}

function createLatitudeRing(radius, latitudeDeg, color, opacity) {
  const points = [];

  for (let index = 0; index < RING_SEGMENTS; index += 1) {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    const latitude = THREE.MathUtils.degToRad(latitudeDeg);
    const cosLat = Math.cos(latitude);
    const sinLat = Math.sin(latitude);
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius * cosLat,
        radius * sinLat,
        Math.sin(angle) * radius * cosLat,
      ),
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
}

function createAxisHelper(length) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -length, 0),
    new THREE.Vector3(0, length, 0),
  ]);

  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xffa36f,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    }),
  );
}

function createSubsolarMarker() {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 18, 18),
    new THREE.MeshBasicMaterial({
      color: 0xfff2a0,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.008, 12, 42),
    new THREE.MeshBasicMaterial({
      color: 0xffcc6b,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  halo.rotation.x = Math.PI / 2;

  group.add(core, halo);
  group.userData.halo = halo;
  return group;
}

export class SeasonSystem {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = "season-system";
    this.root.visible = false;

    this.earth = new Earth();
    this.sunGroup = new THREE.Group();
    this.sunMesh = null;
    this.sunTexture = null;
    this.sunInnerGlow = null;
    this.sunOuterGlow = null;
    this.sunInnerGlowTexture = null;
    this.sunOuterGlowTexture = null;
    this.isReady = false;
    this.isVisible = false;
    this.activeMonthIndex = 0;
    this.activeEventKey = null;
    this.seasonState = CelestialCalculator.getSeasonState(
      getRepresentativeDate(this.activeMonthIndex),
    );
    this.sunlightMultiplier = 1.4;

    this.orbitRing = createOrbitRing(ORBIT_RADIUS);
    this.earthOrbitPivot = new THREE.Group();
    this.earthAnchor = new THREE.Group();
    this.earthGroup = new THREE.Group();
    this.earthFrame = new THREE.Group();
    this.annotationGroup = new THREE.Group();
    this.subsolarMarker = createSubsolarMarker();
    this.cameraWorldPosition = new THREE.Vector3();
    this.earthWorldPosition = new THREE.Vector3();
    this.sunWorldPosition = new THREE.Vector3();
    this.sunWorldDirection = new THREE.Vector3();
    this.earthFrameQuaternion = new THREE.Quaternion();
    this.localSunDirection = new THREE.Vector3();

    this.axisHelper = createAxisHelper(EARTH_RADIUS + 1.25);
    this.equatorLine = createLatitudeRing(EARTH_RADIUS + 0.02, 0, 0xbfe0ff, 0.72);
    this.tropicCancerLine = createLatitudeRing(
      EARTH_RADIUS + 0.028,
      AXIS_TILT_DEG,
      0xf3c86f,
      0.58,
    );
    this.tropicCapricornLine = createLatitudeRing(
      EARTH_RADIUS + 0.028,
      -AXIS_TILT_DEG,
      0xf3c86f,
      0.58,
    );
    this.arcticCircleLine = createLatitudeRing(
      EARTH_RADIUS + 0.035,
      POLAR_CIRCLE_LAT,
      0x7fdcff,
      0.5,
    );
    this.antarcticCircleLine = createLatitudeRing(
      EARTH_RADIUS + 0.035,
      -POLAR_CIRCLE_LAT,
      0x7fdcff,
      0.5,
    );

    this.annotationGroup.add(
      this.axisHelper,
      this.equatorLine,
      this.tropicCancerLine,
      this.tropicCapricornLine,
      this.arcticCircleLine,
      this.antarcticCircleLine,
      this.subsolarMarker,
    );

    this.root.add(this.orbitRing, this.earthOrbitPivot);
    this.root.add(this.sunGroup);
    this.earthOrbitPivot.add(this.earthAnchor);
    this.earthAnchor.position.x = ORBIT_RADIUS;
    this.earthAnchor.add(this.earthGroup);
    this.earthGroup.add(this.earthFrame);
    this.earthGroup.scale.setScalar(EARTH_SCALE);
    this.earthFrame.rotation.x = -AXIS_TILT_RAD;
    this.earthFrame.add(this.annotationGroup);
  }

  async init(textureLoader, textureQuality) {
    const maxAnisotropy = textureQuality?.maxAnisotropy ?? 1;
    const [earthMesh, sunTexture] = await Promise.all([
      this.earth.load(textureLoader, textureQuality),
      loadSeasonSunTexture(textureLoader, maxAnisotropy),
    ]);

    const sunGeometry = new THREE.SphereGeometry(SEASON_SUN_RADIUS, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture,
      toneMapped: false,
    });

    this.sunTexture = sunTexture;
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.rotation.y = Math.PI;
    this.sunInnerGlowTexture = createGlowTexture([
      [0, "rgba(255, 247, 214, 0.85)"],
      [0.2, "rgba(255, 222, 150, 0.42)"],
      [0.5, "rgba(255, 184, 92, 0.14)"],
      [1, "rgba(255, 150, 70, 0)"],
    ]);
    this.sunOuterGlowTexture = createGlowTexture([
      [0, "rgba(255, 230, 170, 0.18)"],
      [0.35, "rgba(255, 196, 110, 0.1)"],
      [0.7, "rgba(255, 150, 72, 0.04)"],
      [1, "rgba(255, 120, 54, 0)"],
    ]);
    this.sunInnerGlow = createGlowSprite(
      this.sunInnerGlowTexture,
      SEASON_SUN_RADIUS * 4.6,
      0.36,
    );
    this.sunOuterGlow = createGlowSprite(
      this.sunOuterGlowTexture,
      SEASON_SUN_RADIUS * 7.4,
      0.16,
    );
    this.sunInnerGlow.position.set(0, 0, 0.02);
    this.sunOuterGlow.position.set(0, 0, 0.01);
    this.sunGroup.add(this.sunMesh);
    this.sunGroup.add(this.sunOuterGlow, this.sunInnerGlow);

    earthMesh.rotation.x = 0;
    earthMesh.rotation.y = 0;
    this.earthFrame.add(earthMesh);

    this.isReady = true;
    this.refreshState();
    return this;
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    this.root.visible = isVisible && this.isReady;
  }

  setMonth(monthIndex) {
    this.activeMonthIndex = Math.min(11, Math.max(0, monthIndex));
    if (!this.activeEventKey) {
      this.refreshState();
    }
    return this.getSeasonState();
  }

  setEvent(eventKey = null) {
    this.activeEventKey = eventKey;
    this.refreshState();
    this.activeMonthIndex = this.seasonState.monthIndex;
    return this.getSeasonState();
  }

  applyCameraPreset(camera, controls) {
    controls?.setView(CAMERA_POSITION, CAMERA_TARGET);
    camera?.updateProjectionMatrix?.();
  }

  applySunPreset(preset) {
    const visualRadius = preset?.visualRadius ?? 1;
    this.sunGroup.scale.setScalar(visualRadius);
  }

  setSunlightMultiplier(multiplier) {
    this.sunlightMultiplier = multiplier;
  }

  refreshState() {
    const date = getSeasonDate(this.activeMonthIndex, this.activeEventKey);
    this.seasonState = CelestialCalculator.getSeasonState(date);
    this.earthOrbitPivot.rotation.y = THREE.MathUtils.degToRad(
      this.seasonState.orbitAngleDeg,
    );
    this.earthGroup.rotation.y = -this.earthOrbitPivot.rotation.y;
    this.updateSubsolarMarker();
  }

  updateSubsolarMarker() {
    if (!this.isReady) {
      return;
    }

    this.earthAnchor.getWorldPosition(this.earthWorldPosition);
    this.sunGroup.getWorldPosition(this.sunWorldPosition);
    this.sunWorldDirection
      .subVectors(this.sunWorldPosition, this.earthWorldPosition)
      .normalize();

    this.earthFrame.getWorldQuaternion(this.earthFrameQuaternion);
    this.localSunDirection
      .copy(this.sunWorldDirection)
      .applyQuaternion(this.earthFrameQuaternion.clone().invert())
      .normalize();

    this.subsolarMarker.position.copy(
      this.localSunDirection.clone().multiplyScalar(
        EARTH_RADIUS + MARKER_RADIUS_OFFSET,
      ),
    );
    this.subsolarMarker.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      this.localSunDirection,
    );
  }

  getSeasonState() {
    const latitudeValue = this.seasonState.subsolarLatitudeDeg;
    const latitudeSuffix =
      latitudeValue > 0 ? " Bắc" : latitudeValue < 0 ? " Nam" : "";

    return {
      ...this.seasonState,
      monthLabel: `Tháng ${this.seasonState.monthIndex + 1}`,
      subsolarLatitudeLabel: `${Math.abs(latitudeValue).toFixed(1)}°${latitudeSuffix}`,
      selectedEventKey: this.activeEventKey,
    };
  }

  update(delta, camera) {
    if (!this.isVisible || !this.isReady) {
      return;
    }

    camera?.getWorldPosition?.(this.cameraWorldPosition);
    if (this.sunMesh) {
      this.sunMesh.rotation.y += delta * 0.08;
      this.sunMesh.rotation.x += delta * 0.016;
    }
    if (this.sunInnerGlow && camera?.quaternion) {
      this.sunInnerGlow.quaternion.copy(camera.quaternion);
      this.sunInnerGlow.material.opacity =
        0.3 + Math.sin(performance.now() * 0.0025) * 0.03;
    }
    if (this.sunOuterGlow && camera?.quaternion) {
      this.sunOuterGlow.quaternion.copy(camera.quaternion);
      this.sunOuterGlow.material.opacity =
        0.14 + Math.sin(performance.now() * 0.0018 + 1.2) * 0.02;
    }

    this.updateSubsolarMarker();

    this.earthAnchor.getWorldPosition(this.earthWorldPosition);
    this.sunWorldDirection
      .subVectors(this.sunWorldPosition, this.earthWorldPosition)
      .normalize();

    this.earth.setSunDirection(this.sunWorldDirection);
    this.earth.setMoonPosition(new THREE.Vector3(0, 0, 0));
    this.earth.setCameraDistance(
      this.cameraWorldPosition.distanceTo(this.earthWorldPosition),
    );
    this.earth.setSunBrightness(1.12 * this.sunlightMultiplier);

    const pulse = 1 + Math.sin(performance.now() * 0.0035) * 0.07;
    this.subsolarMarker.scale.setScalar(pulse);
    this.subsolarMarker.userData.halo.scale.setScalar(
      0.95 + Math.sin(performance.now() * 0.0035) * 0.06,
    );
  }

  dispose() {
    this.earth.dispose();
    this.sunMesh?.geometry?.dispose?.();
    this.sunMesh?.material?.dispose?.();
    this.sunTexture?.dispose?.();
    this.sunInnerGlow?.material?.dispose?.();
    this.sunOuterGlow?.material?.dispose?.();
    this.sunInnerGlowTexture?.dispose?.();
    this.sunOuterGlowTexture?.dispose?.();
    this.orbitRing.geometry.dispose();
    this.orbitRing.material.dispose();
    this.axisHelper.geometry.dispose();
    this.axisHelper.material.dispose();
    this.equatorLine.geometry.dispose();
    this.equatorLine.material.dispose();
    this.tropicCancerLine.geometry.dispose();
    this.tropicCancerLine.material.dispose();
    this.tropicCapricornLine.geometry.dispose();
    this.tropicCapricornLine.material.dispose();
    this.arcticCircleLine.geometry.dispose();
    this.arcticCircleLine.material.dispose();
    this.antarcticCircleLine.geometry.dispose();
    this.antarcticCircleLine.material.dispose();
    this.subsolarMarker.traverse((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  }
}

