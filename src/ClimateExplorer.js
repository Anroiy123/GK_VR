import * as THREE from "three";
import {
  formatLatitude,
  formatLongitude,
  latLonToUv,
  latLonToVector3,
  vector3ToLatLon,
} from "./GeoMath.js";

const OVERLAY_RADIUS_OFFSET = 0.018;
const BORDER_RADIUS_OFFSET = 0.024;
const HOTSPOT_RADIUS_OFFSET = 0.065;
const PROBE_RADIUS_OFFSET = 0.085;
const OVERLAY_OPACITY = 0.54;
const COUNTRY_BORDER_SOURCES = [
  "climate/countries.geojson",
  "https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json",
];
const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const DEFAULT_CLIMATE_METADATA = {
  months: MONTH_LABELS,
  variables: {
    temperature: {
      id: "temperature",
      label: "Nhiệt độ",
      title: "Nhiệt độ trung bình tháng",
      unit: "°C",
      domain: [-35, 45],
      paletteStops: [
        { position: 0, color: "#231c72" },
        { position: 0.25, color: "#2d6cdf" },
        { position: 0.5, color: "#72c2ff" },
        { position: 0.74, color: "#ffd46b" },
        { position: 1, color: "#cb4b2f" },
      ],
    },
    rainfall: {
      id: "rainfall",
      label: "Lượng mưa",
      title: "Lượng mưa trung bình tháng",
      unit: "mm",
      domain: [0, 400],
      paletteStops: [
        { position: 0, color: "#7b5d3f" },
        { position: 0.22, color: "#c9a86a" },
        { position: 0.48, color: "#98d98e" },
        { position: 0.74, color: "#4fb5d7" },
        { position: 1, color: "#1f5fb7" },
      ],
    },
  },
};

const DEFAULT_INSIGHTS = [
  {
    id: "sahara-heat",
    variable: "temperature",
    lat: 23.5,
    lon: 13,
    title: "Sahara hấp thụ bức xạ mạnh",
    summary:
      "Bầu trời quang, nền sa mạc khô và ít mây khiến vùng Sahara nóng lên rất mạnh vào cuối xuân và mùa hè.",
    months: [4, 5, 6, 7, 8, 9],
    priority: 1,
  },
  {
    id: "siberia-cold",
    variable: "temperature",
    lat: 62,
    lon: 105,
    title: "Siberia lạnh sâu vào mùa đông",
    summary:
      "Biên độ nhiệt lớn trên lục địa khiến miền bắc Á-Âu giảm nhiệt mạnh vào mùa đông Bắc bán cầu.",
    months: [11, 12, 1, 2, 3],
    priority: 1,
  },
  {
    id: "india-monsoon",
    variable: "rainfall",
    lat: 20,
    lon: 78,
    title: "Gió mùa Nam Á tăng mưa mùa hè",
    summary:
      "Không khí ẩm từ Ấn Độ Dương tràn vào đất liền làm lượng mưa tăng vọt trong giai đoạn gió mùa.",
    months: [6, 7, 8, 9],
    priority: 1,
  },
  {
    id: "amazon-basin",
    variable: "rainfall",
    lat: -4,
    lon: -62,
    title: "Amazon duy trì nền ẩm cao",
    summary:
      "Rừng mưa nhiệt đới Amazon nằm gần dải hội tụ nhiệt đới nên giữ lượng ẩm cao trong phần lớn năm.",
    months: [1, 2, 3, 4, 5, 10, 11, 12],
    priority: 2,
  },
  {
    id: "australia-dry",
    variable: "rainfall",
    lat: -25,
    lon: 133,
    title: "Nội địa Australia rất khô",
    summary:
      "Nằm gần đai áp cao cận nhiệt và xa nguồn ẩm lớn, nội địa Australia thường có lượng mưa thấp quanh năm.",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    priority: 2,
  },
];

function createPlaceholderTexture() {
  const data = new Uint8Array([0, 0, 0, 0]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function normalizeHexColor(hexColor) {
  return new THREE.Color(hexColor);
}

function createSelectionMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
}

function padMonth(monthIndex) {
  return String(monthIndex + 1).padStart(2, "0");
}

function formatValue(variable, value) {
  if (!Number.isFinite(value)) {
    return "Không có dữ liệu";
  }

  if (variable === "temperature") {
    return `${value.toFixed(1)}°C`;
  }

  return `${Math.round(value)} mm/tháng`;
}

function interpretValue(variable, value) {
  if (!Number.isFinite(value)) {
    return "Dữ liệu tháng này đang được tải hoặc không khả dụng.";
  }

  if (variable === "temperature") {
    if (value < -10) return "Rất lạnh, đặc trưng cho vùng cực hoặc lục địa mùa đông.";
    if (value < 10) return "Khá lạnh, phù hợp với vùng ôn đới lạnh hoặc cao nguyên.";
    if (value < 22) return "Ôn hòa, gần ngưỡng dễ chịu cho nhiều vùng dân cư.";
    if (value < 32) return "Nóng, thường thấy ở vùng nhiệt đới hoặc cận nhiệt.";
    return "Rất nóng, dễ xuất hiện ở sa mạc và các vùng khô nóng.";
  }

  if (value < 40) return "Rất khô, mưa ít và thường thiếu ẩm bề mặt.";
  if (value < 100) return "Khá khô, lượng mưa thấp hơn mức điển hình của vùng ẩm.";
  if (value < 180) return "Mưa theo mùa ở mức trung bình.";
  if (value < 280) return "Ẩm, có nguồn ẩm tương đối dồi dào.";
  return "Mưa nhiều, đặc trưng của gió mùa mạnh hoặc rừng mưa nhiệt đới.";
}

export class ClimateExplorer {
  constructor(earthRadius) {
    this.earthRadius = earthRadius;
    this.group = new THREE.Group();
    this.group.name = "climate-explorer";
    this.group.visible = false;
    this.overlayMesh = null;
    this.borderGroup = new THREE.Group();
    this.borderGroup.name = "climate-country-borders";
    this.borderMaterial = new THREE.LineBasicMaterial({
      color: 0x102030,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    });
    this.hotspotGroup = new THREE.Group();
    this.hotspotGroup.name = "climate-hotspots";
    this.probeGroup = new THREE.Group();
    this.probeGroup.name = "climate-probe";
    this.probeGroup.visible = false;
    this.group.add(this.borderGroup, this.hotspotGroup, this.probeGroup);

    this.textureLoader = null;
    this.metadata = DEFAULT_CLIMATE_METADATA;
    this.insights = DEFAULT_INSIGHTS;
    this.textureEntries = new Map();
    this.placeholderTexture = createPlaceholderTexture();
    this.activeVariable = "temperature";
    this.activeMonthIndex = 0;
    this.currentTextureState = "idle";
    this.currentTextureError = null;
    this.currentTextureKey = null;
    this.activeSelection = null;
    this.hotspotEntries = [];
    this.hotspotPickTargets = [];
    this.isVisible = false;
    this.isReady = false;
    this.onTextureStateChange = null;
    this.onSelectionChange = null;

    this.createOverlayMesh();
    this.createProbeMarker();
    this.setInsights(this.insights);
    this.applyPalette(this.getCurrentVariableMeta());
    this.updateHotspotVisibility();
  }

  createOverlayMesh() {
    const geometry = new THREE.SphereGeometry(
      this.earthRadius + OVERLAY_RADIUS_OFFSET,
      96,
      96,
    );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        climateMap: { value: this.placeholderTexture },
        overlayOpacity: { value: OVERLAY_OPACITY },
        palettePositions: { value: [0, 0.25, 0.5, 0.75, 1] },
        paletteColors: {
          value: [
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
            new THREE.Vector3(),
          ],
        },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D climateMap;
        uniform float overlayOpacity;
        uniform float palettePositions[5];
        uniform vec3 paletteColors[5];

        varying vec2 vUv;

        vec3 samplePalette(float t) {
          if (t <= palettePositions[0]) return paletteColors[0];

          for (int i = 1; i < 5; i++) {
            float leftPos = palettePositions[i - 1];
            float rightPos = palettePositions[i];
            vec3 leftColor = paletteColors[i - 1];
            vec3 rightColor = paletteColors[i];

            if (t <= rightPos) {
              float localT = clamp((t - leftPos) / max(rightPos - leftPos, 0.0001), 0.0, 1.0);
              return mix(leftColor, rightColor, localT);
            }
          }

          return paletteColors[4];
        }

        void main() {
          float rawValue = texture2D(climateMap, vUv).r;
          vec3 paletteColor = samplePalette(rawValue);
          gl_FragColor = vec4(paletteColor, overlayOpacity);
        }
      `,
    });

    material.toneMapped = false;

    this.overlayMesh = new THREE.Mesh(geometry, material);
    this.overlayMesh.renderOrder = 2;
    this.group.add(this.overlayMesh);
  }

  createProbeMarker() {
    const normal = new THREE.Vector3(0, 1, 0);
    const group = this.probeGroup;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.16, 12),
      createSelectionMaterial(0xcde9ff),
    );
    stem.position.y = 0.08;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 18, 18),
      createSelectionMaterial(0xfdf6c2),
    );
    core.position.y = 0.165;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.005, 12, 36),
      createSelectionMaterial(0x7fd0ff),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.165;

    group.add(stem, core, ring);
    group.userData.baseScale = 1;
    group.userData.surfaceNormal = normal;
  }

  setInsights(insights) {
    this.hotspotGroup.clear();
    this.hotspotEntries = [];
    this.hotspotPickTargets = [];
    this.insights = Array.isArray(insights) ? insights : [];

    this.insights.forEach((insight) => {
      const entry = this.createHotspotEntry(insight);
      this.hotspotEntries.push(entry);
      this.hotspotGroup.add(entry.group);
      this.hotspotPickTargets.push(entry.hitMesh);
    });
  }

  createHotspotEntry(insight) {
    const group = new THREE.Group();
    const normal = latLonToVector3(insight.lat, insight.lon, 1).normalize();
    const color =
      insight.variable === "temperature" ? 0xffb36c : 0x67d6ff;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8),
      createSelectionMaterial(color),
    );
    stem.position.y = 0.06;

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 14, 14),
      createSelectionMaterial(color),
    );
    pulse.position.y = 0.13;

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.004, 8, 24),
      createSelectionMaterial(0xffffff),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.13;

    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.y = 0.13;
    hitMesh.userData.hotspotId = insight.id;

    group.add(stem, pulse, halo, hitMesh);
    group.position.copy(
      latLonToVector3(
        insight.lat,
        insight.lon,
        this.earthRadius + HOTSPOT_RADIUS_OFFSET,
      ),
    );
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    group.visible = false;

    return {
      insight,
      group,
      hitMesh,
      pulse,
      halo,
    };
  }

  async init(textureLoader) {
    this.textureLoader = textureLoader;

    const [metadataResult, insightsResult, borderResult] = await Promise.allSettled([
      fetch("climate/metadata.json").then((response) => {
        if (!response.ok) {
          throw new Error(`Climate metadata not found (${response.status}).`);
        }
        return response.json();
      }),
      fetch("climate/insights.json").then((response) => {
        if (!response.ok) {
          throw new Error(`Climate insights not found (${response.status}).`);
        }
        return response.json();
      }),
      this.loadCountryBorders(),
    ]);

    if (
      metadataResult.status === "fulfilled" &&
      metadataResult.value?.variables &&
      metadataResult.value?.months
    ) {
      this.metadata = metadataResult.value;
    }

    if (insightsResult.status === "fulfilled") {
      const insights = Array.isArray(insightsResult.value)
        ? insightsResult.value
        : insightsResult.value?.insights;
      if (Array.isArray(insights)) {
        this.setInsights(insights);
      }
    }

    if (borderResult.status === "fulfilled") {
      this.setCountryBorders(borderResult.value);
    } else {
      console.warn("Climate country borders unavailable:", borderResult.reason);
    }

    this.isReady = true;
    this.applyPalette(this.getCurrentVariableMeta());
    this.updateHotspotVisibility();
    this.ensureCurrentTexture();
    this.preloadAllTextures();
    this.notifyTextureStateChange();
    return this;
  }

  preloadAllTextures() {
    ["temperature", "rainfall"].forEach((variable) => {
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        this.ensureTexture(variable, monthIndex);
      }
    });
  }

  getTextureKey(variable, monthIndex) {
    return `${variable}-${monthIndex}`;
  }

  getTexturePath(variable, monthIndex) {
    return `climate/${variable}/${padMonth(monthIndex)}.png`;
  }

  ensureTexture(variable, monthIndex) {
    if (!this.textureLoader) {
      return null;
    }

    const key = this.getTextureKey(variable, monthIndex);
    const existingEntry = this.textureEntries.get(key);
    if (existingEntry) {
      return existingEntry;
    }

    const entry = {
      key,
      variable,
      monthIndex,
      status: "loading",
      texture: this.placeholderTexture,
      imageData: null,
      width: 0,
      height: 0,
      error: null,
    };

    entry.promise = this.textureLoader
      .loadAsync(this.getTexturePath(variable, monthIndex))
      .then((texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        if ("NoColorSpace" in THREE) {
          texture.colorSpace = THREE.NoColorSpace;
        }
        texture.needsUpdate = true;

        const canvas = document.createElement("canvas");
        canvas.width = texture.image.width;
        canvas.height = texture.image.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          throw new Error("Không tạo được canvas context cho dữ liệu khí hậu.");
        }
        context.drawImage(texture.image, 0, 0);

        entry.texture = texture;
        entry.width = canvas.width;
        entry.height = canvas.height;
        entry.imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
        entry.status = "ready";

        if (this.currentTextureKey === key) {
          this.applyTextureEntry(entry);
          this.updateSelectionSample();
          this.notifyTextureStateChange();
        }

        return entry;
      })
      .catch((error) => {
        entry.status = "error";
        entry.error = error instanceof Error ? error : new Error(String(error));

        if (this.currentTextureKey === key) {
          this.applyTextureEntry(entry);
          this.updateSelectionSample();
          this.notifyTextureStateChange();
        }

        return entry;
      });

    this.textureEntries.set(key, entry);
    return entry;
  }

  ensureCurrentTexture() {
    const key = this.getTextureKey(this.activeVariable, this.activeMonthIndex);
    this.currentTextureKey = key;

    const entry = this.ensureTexture(this.activeVariable, this.activeMonthIndex);
    if (!entry) {
      this.currentTextureState = "loading";
      this.currentTextureError = null;
      this.applyTextureEntry(null);
      return;
    }

    this.applyTextureEntry(entry);
    this.notifyTextureStateChange();
  }

  applyTextureEntry(entry) {
    if (!entry) {
      this.overlayMesh.material.uniforms.climateMap.value = this.placeholderTexture;
      this.currentTextureState = "loading";
      this.currentTextureError = null;
      return;
    }

    this.currentTextureState = entry.status;
    this.currentTextureError = entry.error?.message ?? null;
    this.overlayMesh.material.uniforms.climateMap.value =
      entry.status === "ready" ? entry.texture : this.placeholderTexture;
  }

  notifyTextureStateChange() {
    this.onTextureStateChange?.({
      variable: this.activeVariable,
      monthIndex: this.activeMonthIndex,
      state: this.currentTextureState,
      error: this.currentTextureError,
    });
  }

  notifySelectionChange() {
    this.onSelectionChange?.(this.getActiveSelection());
  }

  getCurrentVariableMeta() {
    return this.metadata.variables?.[this.activeVariable] ??
      DEFAULT_CLIMATE_METADATA.variables.temperature;
  }

  getMonthLabel(monthIndex = this.activeMonthIndex) {
    return this.metadata.months?.[monthIndex] ?? MONTH_LABELS[monthIndex];
  }

  setVariable(variable) {
    if (!this.metadata.variables?.[variable]) {
      return;
    }

    this.activeVariable = variable;
    this.sanitizeSelectionInsight();
    this.applyPalette(this.getCurrentVariableMeta());
    this.updateHotspotVisibility();
    this.ensureCurrentTexture();
    this.updateSelectionSample();
    this.notifyTextureStateChange();
  }

  setMonth(monthIndex) {
    this.activeMonthIndex = Math.min(11, Math.max(0, monthIndex));
    this.sanitizeSelectionInsight();
    this.updateHotspotVisibility();
    this.ensureCurrentTexture();
    this.updateSelectionSample();
    this.notifyTextureStateChange();
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    this.group.visible = isVisible;

    if (!isVisible) {
      this.probeGroup.visible = false;
      this.clearProbe(false);
    }

    this.updateHotspotVisibility();
  }

  applyPalette(variableMeta) {
    const positions = [];
    const colors = [];

    variableMeta.paletteStops.forEach((stop) => {
      positions.push(stop.position);
      const color = normalizeHexColor(stop.color);
      colors.push(new THREE.Vector3(color.r, color.g, color.b));
    });

    this.overlayMesh.material.uniforms.palettePositions.value = positions;
    this.overlayMesh.material.uniforms.paletteColors.value = colors;
  }

  async loadCountryBorders() {
    let lastError = null;

    for (const source of COUNTRY_BORDER_SOURCES) {
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Country borders not found (${response.status}) at ${source}.`);
        }

        const geojson = await response.json();
        if (!geojson || !Array.isArray(geojson.features)) {
          throw new Error(`Invalid GeoJSON at ${source}.`);
        }

        if (geojson.features.length === 0) {
          throw new Error(`Empty GeoJSON at ${source}.`);
        }

        return geojson;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Không tải được dữ liệu biên giới quốc gia.");
  }

  setCountryBorders(geojson) {
    this.disposeCountryBorders();

    if (!Array.isArray(geojson?.features)) {
      return;
    }

    const radius = this.earthRadius + BORDER_RADIUS_OFFSET;
    const lineGeometries = [];

    geojson.features.forEach((feature) => {
      const paths = this.extractBorderPaths(feature?.geometry);
      paths.forEach((path) => {
        const sanitizedSegments = this.splitPathOnDateline(path);
        sanitizedSegments.forEach((segment) => {
          if (segment.length < 2) {
            return;
          }

          const points = segment.map(([lon, lat]) =>
            latLonToVector3(lat, lon, radius),
          );

          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          lineGeometries.push(geometry);

          const line = new THREE.Line(geometry, this.borderMaterial);
          line.renderOrder = 3;
          this.borderGroup.add(line);
        });
      });
    });

    this.borderGroup.visible = lineGeometries.length > 0;
  }

  extractBorderPaths(geometry) {
    if (!geometry?.type || !geometry.coordinates) {
      return [];
    }

    switch (geometry.type) {
      case "Polygon":
        return geometry.coordinates;
      case "MultiPolygon":
        return geometry.coordinates.flat();
      case "LineString":
        return [geometry.coordinates];
      case "MultiLineString":
        return geometry.coordinates;
      default:
        return [];
    }
  }

  splitPathOnDateline(path) {
    if (!Array.isArray(path) || path.length < 2) {
      return [];
    }

    const segments = [];
    let currentSegment = [];

    path.forEach((point, index) => {
      const [lon, lat] = point;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return;
      }

      if (index > 0) {
        const [prevLon] = path[index - 1];
        if (Number.isFinite(prevLon) && Math.abs(lon - prevLon) > 180) {
          if (currentSegment.length > 1) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }
      }

      currentSegment.push([lon, lat]);
    });

    if (currentSegment.length > 1) {
      segments.push(currentSegment);
    }

    return segments;
  }

  disposeCountryBorders() {
    this.borderGroup.children.forEach((child) => {
      child.geometry?.dispose?.();
    });
    this.borderGroup.clear();
  }

  updateHotspotVisibility() {
    const activeMonth = this.activeMonthIndex + 1;

    this.hotspotEntries.forEach((entry) => {
      entry.group.visible = this.isVisible && this.isInsightActive(entry.insight);
    });
  }

  isInsightActive(insight) {
    const activeMonth = this.activeMonthIndex + 1;
    const matchesVariable = insight.variable === this.activeVariable;
    const matchesMonth = !Array.isArray(insight.months)
      ? true
      : insight.months.includes(activeMonth);
    return matchesVariable && matchesMonth;
  }

  sanitizeSelectionInsight() {
    if (!this.activeSelection?.insight) {
      return;
    }

    if (!this.isInsightActive(this.activeSelection.insight)) {
      this.activeSelection.insight = null;
    }
  }

  getCurrentTextureEntry() {
    if (!this.currentTextureKey) {
      return null;
    }

    return this.textureEntries.get(this.currentTextureKey) ?? null;
  }

  sampleAtLatLon(lat, lon) {
    const meta = this.getCurrentVariableMeta();
    const baseSample = {
      variable: this.activeVariable,
      monthIndex: this.activeMonthIndex,
      monthLabel: this.getMonthLabel(),
      lat,
      lon,
      latLabel: formatLatitude(lat),
      lonLabel: formatLongitude(lon),
      unit: meta.unit,
      label: meta.label,
      title: meta.title,
    };

    const entry = this.getCurrentTextureEntry();

    if (!entry || entry.status === "loading") {
      return {
        ...baseSample,
        status: "loading",
        value: null,
        valueText: "Đang tải dữ liệu...",
        interpretation: "Texture khí hậu đang được tải cho tháng hiện tại.",
      };
    }

    if (entry.status === "error" || !entry.imageData) {
      return {
        ...baseSample,
        status: "error",
        value: null,
        valueText: "Không có dữ liệu",
        interpretation:
          entry.error?.message ??
          "Không đọc được texture khí hậu của tháng hiện tại.",
      };
    }

    const uv = latLonToUv(lat, lon);
    const safeU = THREE.MathUtils.euclideanModulo(uv.x, 1);
    const safeV = THREE.MathUtils.clamp(uv.y, 0, 1);
    const x = Math.min(entry.width - 1, Math.max(0, Math.round(safeU * (entry.width - 1))));
    const y = Math.min(entry.height - 1, Math.max(0, Math.round(safeV * (entry.height - 1))));
    const index = (y * entry.width + x) * 4;
    const normalizedValue = entry.imageData[index] / 255;
    const value =
      meta.domain[0] + normalizedValue * (meta.domain[1] - meta.domain[0]);

    return {
      ...baseSample,
      status: "ready",
      value,
      valueText: formatValue(this.activeVariable, value),
      interpretation: interpretValue(this.activeVariable, value),
    };
  }

  setProbe(lat, lon, insight = null) {
    const normal = latLonToVector3(lat, lon, 1).normalize();
    this.probeGroup.visible = true;
    this.probeGroup.position.copy(
      latLonToVector3(lat, lon, this.earthRadius + PROBE_RADIUS_OFFSET),
    );
    this.probeGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal,
    );

    this.activeSelection = {
      lat,
      lon,
      insight,
      sample: this.sampleAtLatLon(lat, lon),
    };
    this.notifySelectionChange();
    return this.activeSelection;
  }

  clearProbe(notify = true) {
    this.activeSelection = null;
    this.probeGroup.visible = false;
    if (notify) {
      this.notifySelectionChange();
    }
  }

  updateSelectionSample() {
    if (!this.activeSelection) {
      return;
    }

    this.activeSelection.sample = this.sampleAtLatLon(
      this.activeSelection.lat,
      this.activeSelection.lon,
    );
    this.notifySelectionChange();
  }

  getActiveSelection() {
    return this.activeSelection;
  }

  getTextureStatus() {
    return {
      state: this.currentTextureState,
      error: this.currentTextureError,
    };
  }

  selectHotspot(id) {
    const entry = this.hotspotEntries.find((item) => item.insight.id === id);
    if (!entry) {
      return null;
    }

    return this.setProbe(entry.insight.lat, entry.insight.lon, entry.insight);
  }

  handlePointer(raycaster, earthMesh) {
    if (!this.isVisible) {
      return false;
    }

    const hotspotHits = raycaster.intersectObjects(this.hotspotPickTargets, false);
    if (hotspotHits.length) {
      const hotspotId = hotspotHits[0].object.userData.hotspotId;
      this.selectHotspot(hotspotId);
      return true;
    }

    if (!earthMesh) {
      this.clearProbe();
      return false;
    }

    const earthHit = raycaster.intersectObject(earthMesh, false)[0];
    if (!earthHit) {
      this.clearProbe();
      return false;
    }

    const localPoint = earthMesh.worldToLocal(earthHit.point.clone());
    const { lat, lon } = vector3ToLatLon(localPoint);
    this.setProbe(lat, lon);
    return true;
  }

  update(_camera = null) {
    if (!this.isVisible) {
      return;
    }

    const time = performance.now() * 0.003;

    this.hotspotEntries.forEach((entry, index) => {
      if (!entry.group.visible) {
        return;
      }

      const pulse = 1 + Math.sin(time + index * 0.7) * 0.14;
      entry.pulse.scale.setScalar(pulse);
      entry.halo.scale.setScalar(0.95 + Math.sin(time + index * 0.7) * 0.08);
    });

    if (this.probeGroup.visible) {
      const pulse = 1 + Math.sin(time * 1.4) * 0.08;
      this.probeGroup.scale.setScalar(pulse);
    }
  }

  dispose() {
    this.disposeCountryBorders();
    this.textureEntries.forEach((entry) => {
      if (entry.texture && entry.texture !== this.placeholderTexture) {
        entry.texture.dispose();
      }
    });
    this.placeholderTexture.dispose();
    this.borderMaterial.dispose();
    this.overlayMesh.geometry.dispose();
    this.overlayMesh.material.dispose();
  }
}
