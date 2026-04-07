import * as THREE from "three";
import { latLonToVector3 } from "./GeoMath.js";

const COUNTRY_DATA_SOURCE = "countries/countries.geojson";
const LABEL_RADIUS_OFFSET = 0.11;
const LABEL_VISIBILITY_THRESHOLD = 0.18;

function createLabelTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 46px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 16;
  ctx.strokeStyle = "rgba(3, 8, 18, 0.9)";
  ctx.fillStyle = "#f7fbff";
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
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  const width = Math.min(1.25, 0.24 + text.length * 0.034);
  sprite.scale.set(width, 0.15, 1);
  sprite.renderOrder = 4;
  return sprite;
}

export class CountryOverlay {
  constructor(earthRadius) {
    this.earthRadius = earthRadius;
    this.labelRadius = earthRadius + LABEL_RADIUS_OFFSET;
    this.group = new THREE.Group();
    this.group.name = "country-overlay";
    this.labelGroup = new THREE.Group();
    this.labelGroup.name = "country-overlay-labels";
    this.group.add(this.labelGroup);

    this.isVisible = false;
    this.isReady = false;
    this.labelEntries = [];
    this.worldEarthCenter = new THREE.Vector3();
    this.worldCameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.worldLabelPosition = new THREE.Vector3();
    this.surfaceNormal = new THREE.Vector3();
    this.visibleFrontLabels = [];
    this.loadError = null;

    this.setVisible(false);
  }

  async init() {
    const response = await fetch(COUNTRY_DATA_SOURCE);
    if (!response.ok) {
      throw new Error(`Country overlay data not found (${response.status}).`);
    }

    const geojson = await response.json();
    if (!Array.isArray(geojson?.features) || geojson.features.length === 0) {
      throw new Error("Country overlay data is empty or invalid.");
    }

    this.setCountries(geojson);
    this.isReady = true;
    return this;
  }

  setCountries(geojson) {
    this.disposeCountries();

    geojson.features.forEach((feature) => {
      this.addCountryFeature(feature);
    });

    this.labelEntries.sort((left, right) => left.priority - right.priority);
    this.labelGroup.visible = this.labelEntries.length > 0;
  }

  addCountryFeature(feature) {
    const properties = feature?.properties ?? {};
    const labelText = properties.nameVi ?? properties.NAME_VI ?? properties.name ?? properties.NAME;
    const labelLat = properties.labelLat ?? properties.LABEL_Y;
    const labelLon = properties.labelLon ?? properties.LABEL_X;

    if (!labelText || !Number.isFinite(labelLat) || !Number.isFinite(labelLon)) {
      return;
    }

    const sprite = createLabelSprite(labelText);
    sprite.position.copy(latLonToVector3(labelLat, labelLon, this.labelRadius));
    this.labelEntries.push({
      sprite,
      priority: Number.isFinite(properties.priority)
        ? properties.priority
        : Number.isFinite(properties.LABELRANK)
          ? properties.LABELRANK
          : 99,
    });
    this.labelGroup.add(sprite);
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    this.group.visible = isVisible;
  }

  update(camera) {
    if (!this.isVisible || !camera?.getWorldPosition || !this.group.parent) {
      return;
    }

    this.group.parent.getWorldPosition(this.worldEarthCenter);
    camera.getWorldPosition(this.worldCameraPosition);
    this.cameraDirection
      .copy(this.worldCameraPosition)
      .sub(this.worldEarthCenter)
      .normalize();

    this.visibleFrontLabels.length = 0;

    this.labelEntries.forEach((entry) => {
      entry.sprite.getWorldPosition(this.worldLabelPosition);
      this.surfaceNormal
        .copy(this.worldLabelPosition)
        .sub(this.worldEarthCenter)
        .normalize();

      const isFrontFacing =
        this.surfaceNormal.dot(this.cameraDirection) > LABEL_VISIBILITY_THRESHOLD;
      entry.sprite.visible = false;

      if (isFrontFacing) {
        this.visibleFrontLabels.push(entry);
      }
    });

    const cameraDistance = this.worldCameraPosition.distanceTo(
      this.worldEarthCenter,
    );
    // Zoom gần thì cần hiện nhiều tên hơn để tránh cảm giác "mất nhãn".
    const maxVisibleLabels =
      cameraDistance <= 4.5 ? 24 : cameraDistance <= 6.5 ? 18 : 12;

    this.visibleFrontLabels
      .sort((left, right) => left.priority - right.priority)
      .slice(0, maxVisibleLabels)
      .forEach((entry) => {
        entry.sprite.visible = true;
      });
  }

  disposeCountries() {
    this.labelEntries.forEach((entry) => {
      entry.sprite.material?.map?.dispose?.();
      entry.sprite.material?.dispose?.();
    });
    this.labelEntries = [];
    this.labelGroup.clear();
  }

  dispose() {
    this.disposeCountries();
  }
}
