import * as THREE from "three";
import { CelestialCalculator } from "./CelestialCalculator.js";
import { formatLatitude, latLonToVector3 } from "./GeoMath.js";

const GRID_RADIUS_OFFSET = 0.022;
const LABEL_RADIUS_OFFSET = 0.16;
const MARKER_RADIUS_OFFSET = 0.09;
const LABEL_VISIBILITY_THRESHOLD = 0.14;
const CIRCLE_SEGMENTS = 180;
const DEMO_YEAR = 2026;
const EARTH_AXIS_TILT_DEG = 23.44;
const POLAR_CIRCLE_LAT = 90 - EARTH_AXIS_TILT_DEG;
const SEASON_EVENT_DATES = {
  "march-equinox": new Date(Date.UTC(DEMO_YEAR, 2, 20, 12, 0, 0)),
  "june-solstice": new Date(Date.UTC(DEMO_YEAR, 5, 21, 12, 0, 0)),
  "september-equinox": new Date(Date.UTC(DEMO_YEAR, 8, 22, 12, 0, 0)),
  "december-solstice": new Date(Date.UTC(DEMO_YEAR, 11, 21, 12, 0, 0)),
};
const LABEL_SPECS = [
  { text: "Xích đạo", lat: 0, lon: 96 },
  { text: "Chí tuyến Bắc", lat: EARTH_AXIS_TILT_DEG, lon: 96 },
  { text: "Chí tuyến Nam", lat: -EARTH_AXIS_TILT_DEG, lon: 96 },
  { text: "Vòng cực Bắc", lat: POLAR_CIRCLE_LAT, lon: 96 },
  { text: "Vòng cực Nam", lat: -POLAR_CIRCLE_LAT, lon: 96 },
  { text: "Điểm Mặt Trời đứng bóng", lat: 0, lon: 18 },
];

function createLabelTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 46px Segoe UI";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 16;
  context.strokeStyle = "rgba(1, 6, 18, 0.9)";
  context.fillStyle = "#f7fbff";
  context.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLabelSprite(text) {
  const texture = createLabelTexture(text);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const width = 0.52 + text.length * 0.026;
  sprite.scale.set(width, 0.16, 1);
  sprite.renderOrder = 4;
  return sprite;
}

function createLineMaterial(color, opacity) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
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

export class SeasonExplorer {
  constructor(earthRadius) {
    this.earthRadius = earthRadius;
    this.lineRadius = earthRadius + GRID_RADIUS_OFFSET;
    this.labelRadius = earthRadius + LABEL_RADIUS_OFFSET;
    this.group = new THREE.Group();
    this.group.name = "season-explorer";
    this.group.visible = false;
    this.seasonGroup = new THREE.Group();
    this.seasonGroup.name = "season-annotations";
    this.labelGroup = new THREE.Group();
    this.labelGroup.name = "season-labels";
    this.group.add(this.seasonGroup, this.labelGroup);

    this.labelEntries = [];
    this.activeMonthIndex = 0;
    this.activeEventKey = null;
    this.seasonState = CelestialCalculator.getSeasonState(
      getRepresentativeDate(this.activeMonthIndex),
    );
    this.worldEarthCenter = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.worldLabelPosition = new THREE.Vector3();
    this.surfaceNormal = new THREE.Vector3();

    this.axisLine = this.createAxisLine();
    this.equatorLine = this.createLatitudeLine(0, 0xb7d6ff, 0.72);
    this.tropicCancerLine = this.createLatitudeLine(
      EARTH_AXIS_TILT_DEG,
      0xf4c76f,
      0.58,
    );
    this.tropicCapricornLine = this.createLatitudeLine(
      -EARTH_AXIS_TILT_DEG,
      0xf4c76f,
      0.58,
    );
    this.arcticCircleLine = this.createLatitudeLine(
      POLAR_CIRCLE_LAT,
      0x7fe0ff,
      0.48,
    );
    this.antarcticCircleLine = this.createLatitudeLine(
      -POLAR_CIRCLE_LAT,
      0x7fe0ff,
      0.48,
    );
    this.subsolarMarker = this.createSubsolarMarker();

    this.seasonGroup.add(
      this.axisLine,
      this.equatorLine,
      this.tropicCancerLine,
      this.tropicCapricornLine,
      this.arcticCircleLine,
      this.antarcticCircleLine,
      this.subsolarMarker,
    );

    this.createLabels();
    this.refreshState();
  }

  createLatitudeLine(lat, color, opacity) {
    const points = [];

    for (let index = 0; index < CIRCLE_SEGMENTS; index += 1) {
      const lon = -180 + (360 * index) / CIRCLE_SEGMENTS;
      points.push(latLonToVector3(lat, lon, this.lineRadius));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(geometry, createLineMaterial(color, opacity));
    line.renderOrder = 2;
    return line;
  }

  createAxisLine() {
    const halfLength = this.earthRadius + 0.55;
    const start = new THREE.Vector3(0, -halfLength, 0);
    const end = new THREE.Vector3(0, halfLength, 0);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const axis = new THREE.Line(
      geometry,
      createLineMaterial(0xff8d61, 0.88),
    );
    axis.renderOrder = 3;
    return axis;
  }

  createSubsolarMarker() {
    const group = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xfff4a8,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.006, 12, 42),
      new THREE.MeshBasicMaterial({
        color: 0xffcf70,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;

    group.add(core, ring);
    group.renderOrder = 4;
    group.userData.core = core;
    group.userData.ring = ring;
    return group;
  }

  createLabels() {
    LABEL_SPECS.forEach((spec) => {
      const sprite = createLabelSprite(spec.text);
      sprite.position.copy(
        latLonToVector3(spec.lat, spec.lon, this.labelRadius),
      );
      this.labelEntries.push({
        sprite,
        spec,
      });
      this.labelGroup.add(sprite);
    });
  }

  refreshState() {
    const date = getSeasonDate(this.activeMonthIndex, this.activeEventKey);
    this.seasonState = CelestialCalculator.getSeasonState(date);
    this.updateSubsolarMarker();
  }

  updateSubsolarMarker() {
    const lat = this.seasonState?.subsolarLatitudeDeg ?? 0;
    this.subsolarMarker.position.copy(
      latLonToVector3(lat, 0, this.earthRadius + MARKER_RADIUS_OFFSET),
    );

    const surfaceNormal = latLonToVector3(lat, 0, 1).normalize();
    this.subsolarMarker.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      surfaceNormal,
    );

    const subsolarEntry = this.labelEntries.find(
      (entry) => entry.spec.text === "Điểm Mặt Trời đứng bóng",
    );

    if (subsolarEntry) {
      subsolarEntry.sprite.position.copy(
        latLonToVector3(lat, 16, this.labelRadius + 0.03),
      );
    }
  }

  setMonth(monthIndex) {
    this.activeMonthIndex = Math.min(11, Math.max(0, monthIndex));
    if (!this.activeEventKey) {
      this.refreshState();
    }
    return this.seasonState;
  }

  setEvent(eventKey = null) {
    this.activeEventKey = eventKey;
    this.refreshState();
    this.activeMonthIndex = this.seasonState.monthIndex;
    return this.seasonState;
  }

  setVisible(isVisible) {
    this.group.visible = isVisible;
  }

  getSeasonState() {
    return {
      ...this.seasonState,
      monthLabel: `Tháng ${this.seasonState.monthIndex + 1}`,
      subsolarLatitudeLabel: formatLatitude(this.seasonState.subsolarLatitudeDeg),
      selectedEventKey: this.activeEventKey,
    };
  }

  update(camera) {
    if (!this.group.visible || !camera?.getWorldPosition || !this.group.parent) {
      return;
    }

    const time = performance.now() * 0.003;
    const markerPulse = 1 + Math.sin(time * 1.8) * 0.08;
    this.subsolarMarker.scale.setScalar(markerPulse);
    this.subsolarMarker.userData.ring.scale.setScalar(
      0.96 + Math.sin(time * 1.8) * 0.06,
    );

    this.group.parent.getWorldPosition(this.worldEarthCenter);
    camera.getWorldPosition(this.cameraDirection);
    this.cameraDirection.sub(this.worldEarthCenter).normalize();

    this.labelEntries.forEach((entry) => {
      entry.sprite.getWorldPosition(this.worldLabelPosition);
      this.surfaceNormal
        .copy(this.worldLabelPosition)
        .sub(this.worldEarthCenter)
        .normalize();

      entry.sprite.visible =
        this.surfaceNormal.dot(this.cameraDirection) > LABEL_VISIBILITY_THRESHOLD;
    });
  }

  dispose() {
    this.group.traverse((child) => {
      child.geometry?.dispose?.();

      if (!child.material) {
        return;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        material.map?.dispose?.();
        material.dispose?.();
      });
    });
  }
}
