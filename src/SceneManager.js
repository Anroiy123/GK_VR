import * as THREE from "three";
import { Timer } from "three";
import { Earth } from "./Earth.js";
import { Clouds } from "./Clouds.js";
import { Starfield } from "./Starfield.js";
import { Controls } from "./Controls.js";
import { WebXRSetup } from "./WebXRSetup.js";
import { UI } from "./UI.js";
import { Markers } from "./Markers.js";
import { Interaction } from "./Interaction.js";
import { Satellite } from "./Satellite.js";
import { AudioManager } from "./AudioManager.js";
import { CelestialCalculator } from "./CelestialCalculator.js";
import { Sun } from "./Sun.js";
import { Moon } from "./Moon.js";
import { Atmosphere } from "./Atmosphere.js";
import { MapOverlay } from "./MapOverlay.js";
import { ClimateExplorer } from "./ClimateExplorer.js";
import { DEFAULT_SUN_PRESET, getSunPreset } from "./SunPresets.js";

const EARTH_RADIUS = 2;
const DEFAULT_EARTH_VIEW_MODE = "globe";
const EARTH_VIEW_MODES = new Set([
  "globe",
  "coordinates",
  "temperature",
  "rainfall",
]);

export class SceneManager {
  constructor(canvas) {
    this.timer = new Timer();
    this.ui = new UI();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 1, 6);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.updateRendererPixelRatio();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = DEFAULT_SUN_PRESET.toneMappingExposure;

    this.baseSunLightIntensity = DEFAULT_SUN_PRESET.directionalLightBase;
    this.currentSunPreset = DEFAULT_SUN_PRESET;
    this.ambientLight = null;
    this.activeCameraWorldPosition = new THREE.Vector3();
    this.handleFirstUserAudioGesture = null;
    this.audioManager = null;

    this.earthViewMode = DEFAULT_EARTH_VIEW_MODE;
    this.desktopEarthViewModeBeforeVR = DEFAULT_EARTH_VIEW_MODE;
    this.climateMonthIndex = 0;
    this.globeLayerState = {
      cloudsVisible: true,
      atmosphereVisible: true,
      markersVisible: false,
    };

    this.earth = new Earth();
    this.clouds = new Clouds();
    this.atmosphere = new Atmosphere();
    this.mapOverlay = new MapOverlay(EARTH_RADIUS);
    this.climateExplorer = new ClimateExplorer(EARTH_RADIUS);
    this.starfield = new Starfield();
    this.sun = new Sun(1);
    this.moon = new Moon(0.5);
    this.simDate = new Date();
    this.markers = new Markers(EARTH_RADIUS);
    this.satellite = new Satellite();

    this.interaction = new Interaction(
      this.camera,
      this.scene,
      this.renderer,
      this.markers,
      this.ui,
      null,
    );
    this.interaction.setClimatePointerHandler(
      this.handleClimatePointer.bind(this),
    );
    this.controls = new Controls(this.camera, this.renderer.domElement);
    this.webxr = new WebXRSetup(this.renderer);

    this.climateExplorer.onTextureStateChange = () => {
      this.syncUiState();
    };
    this.climateExplorer.onSelectionChange = () => {
      this.syncUiState();
    };

    this.ui.onISSToggle = () => {
      const isTracking = !this.controls.isTracking;
      this.controls.setTracking(isTracking ? this.satellite.group : null);
      this.ui.setISSToggleText(isTracking);
      this.audioManager?.playUiPress(isTracking ? "success" : "back");
    };

    this.ui.onMuteToggle = () => {
      if (!this.audioManager) {
        return;
      }

      const isAudible = this.audioManager.toggleMute();
      this.ui.setMuteBtnText(isAudible);
      this.audioManager.playUiPress(isAudible ? "success" : "back");
    };

    this.ui.onMarkersToggle = () => {
      if (this.isClimateMode()) {
        return;
      }

      const isVisible = this.markers.toggleVisibility();
      this.globeLayerState.markersVisible = isVisible;
      this.interaction.clearSelection();
      this.syncUiState();
      this.audioManager?.playUiPress(isVisible ? "success" : "back");
    };

    this.ui.onCloudsToggle = () => {
      if (this.earthViewMode !== DEFAULT_EARTH_VIEW_MODE) {
        return;
      }

      const isVisible = this.clouds.toggleVisibility();
      this.globeLayerState.cloudsVisible = isVisible;
      this.syncUiState();
      this.audioManager?.playUiPress(isVisible ? "success" : "back");
    };

    this.ui.onAtmosphereToggle = () => {
      if (this.earthViewMode !== DEFAULT_EARTH_VIEW_MODE) {
        return;
      }

      const isVisible = this.atmosphere.toggleVisibility();
      this.globeLayerState.atmosphereVisible = isVisible;
      this.syncUiState();
      this.audioManager?.playUiPress(isVisible ? "success" : "back");
    };

    this.ui.onEarthViewModeChange = (mode) => {
      this.setEarthViewMode(mode);
      this.audioManager?.playUiPress(
        mode === DEFAULT_EARTH_VIEW_MODE ? "back" : "default",
      );
    };

    this.ui.onClimateMonthChange = (monthIndex) => {
      this.climateMonthIndex = Math.min(11, Math.max(0, monthIndex));
      this.climateExplorer.setMonth(this.climateMonthIndex);
      this.syncUiState();
      this.audioManager?.playUiPress("default");
    };

    this.ui.onSunPresetChange = (presetId) => {
      this.applySunPreset(getSunPreset(presetId));
      this.audioManager?.playUiPress("default");
    };

    this.ui.onControlsToggle = (isCollapsed) => {
      this.audioManager?.playPanelToggle(!isCollapsed);
    };

    this.ui.onSpeedChange = () => {
      this.audioManager?.playUiPress("default");
    };

    this.ui.onSunlightChange = () => {
      this.audioManager?.playUiPress("default");
    };

    this.webxr.onSessionStart = () => {
      this.desktopEarthViewModeBeforeVR = this.earthViewMode;
      this.setEarthViewMode(DEFAULT_EARTH_VIEW_MODE);
      this.controls.setEnabled(false);
      this.ui.setVRStatus(true);
      this.markers.setVRPanelMode(true);
      this.interaction.setVRMode(true);
      this.sun.setVRMode(true);
      this.interaction.clearSelection();
      this.audioManager?.playVrTransition(true);
    };

    this.webxr.onSessionEnd = () => {
      this.controls.setEnabled(true);
      this.ui.setVRStatus(false);
      this.markers.setVRPanelMode(false);
      this.interaction.setVRMode(false);
      this.sun.setVRMode(false);
      this.interaction.clearSelection();

      const restoreMode = this.normalizeEarthViewMode(
        this.desktopEarthViewModeBeforeVR,
      );
      this.desktopEarthViewModeBeforeVR = DEFAULT_EARTH_VIEW_MODE;
      this.setEarthViewMode(restoreMode);
      this.audioManager?.playVrTransition(false);
    };

    window.addEventListener("resize", this.onResize.bind(this));
  }

  async init() {
    const textureLoader = new THREE.TextureLoader();
    const textureQuality = {
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
      devicePixelRatio: window.devicePixelRatio,
    };

    this.setupLighting();

    const [earthMesh, cloudMesh, moonGroup, stars, sunGroup] =
      await Promise.all([
        this.earth.load(textureLoader, textureQuality),
        this.clouds.load(textureLoader, textureQuality.maxAnisotropy),
        this.moon.load(textureLoader),
        this.starfield.create(textureLoader, textureQuality),
        this.sun.load(textureLoader, textureQuality),
      ]);

    const atmosphereMesh = this.atmosphere.create(this.camera);
    this.applySunPreset(this.currentSunPreset);

    this.scene.add(earthMesh);
    earthMesh.add(cloudMesh);
    earthMesh.add(atmosphereMesh);
    earthMesh.add(this.mapOverlay.group);
    earthMesh.add(this.climateExplorer.group);
    this.scene.add(sunGroup);
    this.scene.add(moonGroup);
    this.scene.add(stars);

    this.audioManager = new AudioManager(this.camera);
    this.interaction.setAudioManager(this.audioManager);
    this.setupAutoAudioStart();

    earthMesh.add(this.markers.group);
    this.scene.add(this.markers.vrOverlayGroup);
    this.markers.setVRPanelMode(false);

    this.scene.add(this.satellite.orbitGroup);

    this.ui.setMonthLabels(this.climateExplorer.metadata.months);
    this.climateExplorer.setMonth(this.climateMonthIndex);
    this.climateInitPromise = this.climateExplorer
      .init(textureLoader)
      .then(() => {
        this.ui.setMonthLabels(this.climateExplorer.metadata.months);
        this.climateExplorer.setMonth(this.climateMonthIndex);
        this.syncUiState();
        return this.climateExplorer;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.climateExplorer.currentTextureState = "error";
        this.climateExplorer.currentTextureError = message;
        this.syncUiState();
        return null;
      });

    this.webxr.init();
    this.syncUiState();
    this.ui.setSunPreset(this.currentSunPreset.id);
    this.ui.hideLoading();
  }

  normalizeEarthViewMode(mode) {
    return EARTH_VIEW_MODES.has(mode) ? mode : DEFAULT_EARTH_VIEW_MODE;
  }

  isClimateMode(mode = this.earthViewMode) {
    return mode === "temperature" || mode === "rainfall";
  }

  setupAutoAudioStart() {
    if (!this.audioManager || this.handleFirstUserAudioGesture) {
      return;
    }

    const cleanup = () => {
      if (!this.handleFirstUserAudioGesture) {
        return;
      }

      window.removeEventListener("pointerdown", this.handleFirstUserAudioGesture);
      window.removeEventListener("touchstart", this.handleFirstUserAudioGesture);
      window.removeEventListener("keydown", this.handleFirstUserAudioGesture);
      this.handleFirstUserAudioGesture = null;
    };

    this.handleFirstUserAudioGesture = (event) => {
      const target = event?.target;
      if (target instanceof Element && target.closest("#mute-btn")) {
        return;
      }

      const isAudible = this.audioManager.enableAudio();
      this.ui.setMuteBtnText(isAudible);
      cleanup();
    };

    window.addEventListener("pointerdown", this.handleFirstUserAudioGesture);
    window.addEventListener("touchstart", this.handleFirstUserAudioGesture);
    window.addEventListener("keydown", this.handleFirstUserAudioGesture);
  }

  applySunPreset(preset) {
    this.currentSunPreset = preset ?? DEFAULT_SUN_PRESET;
    this.baseSunLightIntensity = this.currentSunPreset.directionalLightBase;
    this.renderer.toneMappingExposure = this.currentSunPreset.toneMappingExposure;
    this.sun.applyPreset(this.currentSunPreset);
    this.atmosphere.applyPreset(this.currentSunPreset);

    if (this.ambientLight) {
      this.ambientLight.intensity = this.currentSunPreset.ambientIntensity;
    }
  }

  applyGlobeLayerState() {
    this.clouds.setVisible(this.globeLayerState.cloudsVisible);
    this.atmosphere.setVisible(this.globeLayerState.atmosphereVisible);
    this.markers.setVisible(this.globeLayerState.markersVisible);
  }

  setEarthViewMode(mode) {
    const nextMode = this.normalizeEarthViewMode(mode);
    this.earthViewMode = nextMode;

    if (nextMode === DEFAULT_EARTH_VIEW_MODE) {
      this.mapOverlay.setVisible(false);
      this.climateExplorer.setVisible(false);
      this.applyGlobeLayerState();
    } else if (nextMode === "coordinates") {
      this.climateExplorer.setVisible(false);
      this.mapOverlay.setVisible(true);
      this.clouds.setVisible(false);
      this.atmosphere.setVisible(false);
      this.markers.setVisible(this.globeLayerState.markersVisible);
    } else {
      this.mapOverlay.setVisible(false);
      this.clouds.setVisible(false);
      this.atmosphere.setVisible(false);
      this.markers.setVisible(false);
      this.climateExplorer.setVariable(nextMode);
      this.climateExplorer.setMonth(this.climateMonthIndex);
      this.climateExplorer.setVisible(true);
    }

    this.syncUiState();
    return this.earthViewMode;
  }

  syncClimatePanel() {
    if (!this.isClimateMode() || this.webxr.isPresenting) {
      this.ui.hideClimateProbe();
      return;
    }

    const meta = this.climateExplorer.getCurrentVariableMeta();
    const selection = this.climateExplorer.getActiveSelection();
    if (selection?.sample) {
      if (selection.insight) {
        this.ui.showClimateInsight(selection.insight, selection.sample);
      } else {
        this.ui.showClimateProbe(selection.sample);
      }
      return;
    }

    const { state, error } = this.climateExplorer.getTextureStatus();
    if (state === "error") {
      this.ui.showClimateStatus(
        meta.title,
        error ?? "Không thể tải dữ liệu khí hậu cho tháng hiện tại.",
        meta.label,
      );
      return;
    }

    if (state === "loading" || state === "idle") {
      this.ui.showClimateStatus(
        meta.title,
        `Đang chuẩn bị lớp dữ liệu cho ${this.climateExplorer
          .getMonthLabel(this.climateMonthIndex)
          .toLowerCase()}.`,
        meta.label,
      );
      return;
    }

    this.ui.showClimateStatus(
      meta.title,
      "Bấm lên bề mặt Trái Đất để đọc số liệu tại điểm, hoặc chọn hotspot đang phát sáng.",
      meta.label,
    );
  }

  syncUiState() {
    this.ui.setMonthLabels(this.climateExplorer.metadata.months);
    this.ui.setClimateMonth(this.climateMonthIndex);
    this.ui.setEarthViewMode(this.earthViewMode);
    this.ui.setMarkersToggleText(this.markers.isVisible);
    this.ui.setCloudsToggleText(this.clouds.isVisible);
    this.ui.setAtmosphereToggleText(this.atmosphere.isVisible);
    this.ui.setClimateLegend(this.climateExplorer.getCurrentVariableMeta());
    this.ui.setClimateControlsVisible(
      this.isClimateMode() && !this.webxr.isPresenting,
    );
    this.ui.setControlLocks({
      cloudsLocked: this.earthViewMode !== DEFAULT_EARTH_VIEW_MODE,
      atmosphereLocked: this.earthViewMode !== DEFAULT_EARTH_VIEW_MODE,
      markersLocked: this.isClimateMode(),
    });

    if (this.isClimateMode()) {
      this.interaction.setDesktopMode("climate");
      this.syncClimatePanel();
      return;
    }

    this.ui.hideClimateProbe();
    this.interaction.setDesktopMode(this.markers.isVisible ? "markers" : "none");
  }

  handleClimatePointer(raycaster) {
    if (!this.isClimateMode() || !this.earth.mesh) {
      return false;
    }

    const handled = this.climateExplorer.handlePointer(raycaster, this.earth.mesh);
    if (handled) {
      this.audioManager?.playMarkerSelect();
    }
    this.syncClimatePanel();
    return handled;
  }

  setupLighting() {
    this.sunLight = new THREE.DirectionalLight(
      0xffffff,
      this.baseSunLightIntensity,
    );
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.position.set(0, 0, 0);

    this.moonLight = new THREE.DirectionalLight(0x88aaff, 0.1);
    this.scene.add(this.moonLight);

    this.ambientLight = new THREE.AmbientLight(
      0x404060,
      this.currentSunPreset.ambientIntensity,
    );
    this.scene.add(this.ambientLight);
  }

  updateRendererPixelRatio() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  }

  start() {
    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  render(timestamp) {
    this.timer.update(timestamp);
    const delta = this.timer.getDelta();
    const speed = this.ui.speedMultiplier;

    this.simDate.setTime(this.simDate.getTime() + delta * 1000 * 3600 * speed);
    if (this.ui.updateSimTime) {
      this.ui.updateSimTime(this.simDate);
    }

    const jd = CelestialCalculator.getJulianDate(this.simDate);
    const sunPos = CelestialCalculator.getSunPosition(
      jd,
      this.currentSunPreset.distance,
    );
    const sunDirection = CelestialCalculator.getSunDirection(jd);
    const earthRotationAngle = CelestialCalculator.getEarthRotationAngle(jd);
    const moonPos = CelestialCalculator.getMoonPosition(jd, 10);

    this.sunLight.position.copy(sunPos);
    this.sunLight.target.updateMatrixWorld();
    this.moonLight.position.copy(moonPos);

    if (!this.webxr.isPresenting) {
      this.controls.update();
    }

    const activeCamera = this.webxr.isPresenting
      ? this.renderer.xr.getCamera(this.camera)
      : this.camera;

    activeCamera?.updateMatrixWorld?.();
    if (activeCamera?.getWorldPosition) {
      activeCamera.getWorldPosition(this.activeCameraWorldPosition);
    } else {
      this.activeCameraWorldPosition.copy(this.camera.position);
    }

    const activeCameraDistance = this.activeCameraWorldPosition.length();

    this.sun.updatePosition(sunPos);
    this.sun.updateView(this.activeCameraWorldPosition);
    this.sun.setBrightness(this.ui.sunlightMultiplier);
    this.sun.update(delta);
    this.moon.updatePosition(moonPos);

    this.earth.updateRotation(earthRotationAngle);
    this.earth.setSunDirection(sunDirection);
    this.earth.setMoonPosition(moonPos);
    this.earth.setCameraDistance(activeCameraDistance);
    this.earth.setSunBrightness(
      this.ui.sunlightMultiplier * this.currentSunPreset.earthBrightnessFactor,
    );
    this.sunLight.intensity =
      this.baseSunLightIntensity * this.ui.sunlightMultiplier;
    this.clouds.update(delta, speed, activeCameraDistance);
    this.atmosphere.update(this.activeCameraWorldPosition, sunPos);
    this.mapOverlay.update(activeCamera);
    this.climateExplorer.update(activeCamera);
    this.markers.update(timestamp, activeCamera);
    this.interaction.update();
    this.satellite.update(delta, speed);

    this.ui.updateFPS(timestamp);
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.updateRendererPixelRatio();
    this.renderer.setSize(width, height);
  }
}
