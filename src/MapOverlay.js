import * as THREE from "three";
import { latLonToVector3 } from "./GeoMath.js";

const GRID_LAT_STEP = 10;
const GRID_LON_STEP = 10;
const LONGITUDE_LABEL_STEP = 20;
const LATITUDE_LABEL_STEP = 10;
const GRID_RADIUS_OFFSET = 0.012;
const LABEL_RADIUS_OFFSET = 0.12;
const LABEL_VISIBILITY_THRESHOLD = 0.2;
const GRID_CURVE_SEGMENTS = 180;
const MERIDIAN_CURVE_SEGMENTS = 96;

function createLabelTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 52px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(1, 6, 16, 0.88)";
  ctx.fillStyle = "#f6fbff";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

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
  const width = 0.14 + text.length * 0.045;
  sprite.scale.set(width, 0.13, 1);
  sprite.renderOrder = 3;
  return sprite;
}

function formatLatitudeLabel(lat) {
  if (lat === 0) {
    return "0°";
  }

  return `${Math.abs(lat)}°${lat > 0 ? "N" : "S"}`;
}

function formatLongitudeLabel(lon) {
  if (lon === 0) {
    return "0°";
  }

  return `${Math.abs(lon)}°${lon > 0 ? "E" : "W"}`;
}

export class MapOverlay {
  constructor(earthRadius) {
    this.earthRadius = earthRadius;
    this.gridRadius = earthRadius + GRID_RADIUS_OFFSET;
    this.labelRadius = earthRadius + LABEL_RADIUS_OFFSET;
    this.group = new THREE.Group();
    this.group.name = "map-overlay";
    this.graticuleGroup = new THREE.Group();
    this.labelGroup = new THREE.Group();
    this.group.add(this.graticuleGroup, this.labelGroup);

    this.isVisible = false;
    this.labelEntries = [];
    this.worldEarthCenter = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.worldLabelPosition = new THREE.Vector3();
    this.surfaceNormal = new THREE.Vector3();

    this.createGraticule();
    this.createLabels();
    this.setVisible(false);
  }

  createGridMaterial(isMajorLine = false) {
    return new THREE.LineBasicMaterial({
      color: isMajorLine ? 0x7f93ab : 0x90a7bf,
      transparent: true,
      opacity: isMajorLine ? 0.72 : 0.38,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
  }

  createGraticule() {
    for (let lat = -80; lat <= 80; lat += GRID_LAT_STEP) {
      this.graticuleGroup.add(this.createLatitudeLine(lat));
    }

    for (let lon = -180; lon < 180; lon += GRID_LON_STEP) {
      this.graticuleGroup.add(this.createLongitudeLine(lon));
    }
  }

  createLatitudeLine(lat) {
    const points = [];

    for (let index = 0; index < GRID_CURVE_SEGMENTS; index += 1) {
      const lon = -180 + (360 * index) / GRID_CURVE_SEGMENTS;
      points.push(latLonToVector3(lat, lon, this.gridRadius));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(
      geometry,
      this.createGridMaterial(lat === 0),
    );
    line.renderOrder = lat === 0 ? 2 : 1;
    return line;
  }

  createLongitudeLine(lon) {
    const points = [];

    for (let index = 0; index <= MERIDIAN_CURVE_SEGMENTS; index += 1) {
      const lat = -90 + (180 * index) / MERIDIAN_CURVE_SEGMENTS;
      points.push(latLonToVector3(lat, lon, this.gridRadius));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(
      geometry,
      this.createGridMaterial(lon === 0),
    );
    line.renderOrder = lon === 0 ? 2 : 1;
    return line;
  }

  createLabels() {
    for (let lon = -180; lon < 180; lon += LONGITUDE_LABEL_STEP) {
      this.addLabel(formatLongitudeLabel(lon), 0, lon);
    }

    for (let lat = -80; lat <= 80; lat += LATITUDE_LABEL_STEP) {
      if (lat === 0) {
        continue;
      }

      this.addLabel(formatLatitudeLabel(lat), lat, 0);
    }
  }

  addLabel(text, lat, lon) {
    const sprite = createLabelSprite(text);
    sprite.position.copy(latLonToVector3(lat, lon, this.labelRadius));
    this.labelEntries.push(sprite);
    this.labelGroup.add(sprite);
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    this.group.visible = isVisible;
  }

  toggleVisibility() {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  update(camera) {
    if (!this.isVisible || !camera?.getWorldPosition || !this.group.parent) {
      return;
    }

    this.group.parent.getWorldPosition(this.worldEarthCenter);
    camera.getWorldPosition(this.cameraDirection);
    this.cameraDirection.sub(this.worldEarthCenter).normalize();

    this.labelEntries.forEach((sprite) => {
      sprite.getWorldPosition(this.worldLabelPosition);
      this.surfaceNormal
        .copy(this.worldLabelPosition)
        .sub(this.worldEarthCenter)
        .normalize();

      sprite.visible =
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
