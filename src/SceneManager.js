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
import { DEFAULT_SUN_PRESET, getSunPreset } from "./SunPresets.js";

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

    this.earth = new Earth();
    this.clouds = new Clouds();
    this.atmosphere = new Atmosphere();
    this.starfield = new Starfield();
    this.sun = new Sun(1);
    this.moon = new Moon(0.5);
    this.simDate = new Date(); // Thời gian mô phỏng
    this.markers = new Markers(2); // radius = 2
    this.satellite = new Satellite();

    this.interaction = new Interaction(
      this.camera,
      this.scene,
      this.renderer,
      this.markers,
      this.ui,
    );
    this.controls = new Controls(this.camera, this.renderer.domElement);

    this.webxr = new WebXRSetup(this.renderer);

    // UI events
    this.ui.onISSToggle = () => {
      const isTracking = !this.controls.isTracking;
      this.controls.setTracking(isTracking ? this.satellite.group : null);
      this.ui.setISSToggleText(isTracking);
    };

    this.ui.onMuteToggle = () => {
      if (this.audioManager) {
        const isAudible = this.audioManager.toggleMute();
        this.ui.setMuteBtnText(isAudible);
      }
    };

    this.ui.onMarkersToggle = () => {
      const isVisible = this.markers.toggleVisibility();
      this.interaction.clearSelection();
      this.ui.setMarkersToggleText(isVisible);
    };

    this.ui.onCloudsToggle = () => {
      const isVisible = this.clouds.toggleVisibility();
      this.ui.setCloudsToggleText(isVisible);
    };

    this.ui.onAtmosphereToggle = () => {
      const isVisible = this.atmosphere.toggleVisibility();
      this.ui.setAtmosphereToggleText(isVisible);
    };

    this.ui.onSunPresetChange = (presetId) => {
      this.applySunPreset(getSunPreset(presetId));
    };

    this.webxr.onSessionStart = () => {
      this.controls.setEnabled(false);
      this.ui.setVRStatus(true);
      this.markers.setVRPanelMode(true);
      this.interaction.setVRMode(true);
      this.sun.setVRMode(true);
      this.interaction.clearSelection();
    };
    this.webxr.onSessionEnd = () => {
      this.controls.setEnabled(true);
      this.ui.setVRStatus(false);
      this.markers.setVRPanelMode(false);
      this.interaction.setVRMode(false);
      this.sun.setVRMode(false);
      this.interaction.clearSelection();
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
    this.scene.add(sunGroup);
    this.scene.add(moonGroup);
    this.scene.add(stars);

    // Audio setup
    this.audioManager = new AudioManager(this.camera);

    // Thêm markers vào earthMesh để quay cùng Trái Đất
    earthMesh.add(this.markers.group);
    this.scene.add(this.markers.vrOverlayGroup);
    this.markers.setVRPanelMode(false);

    // Thêm satellite vào scene
    this.scene.add(this.satellite.orbitGroup);

    this.webxr.init();
    this.ui.setMarkersToggleText(this.markers.isVisible);
    this.ui.setCloudsToggleText(this.clouds.isVisible);
    this.ui.setAtmosphereToggleText(this.atmosphere.isVisible);
    this.ui.setSunPreset(this.currentSunPreset.id);

    this.ui.hideLoading();
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

  setupLighting() {
    this.sunLight = new THREE.DirectionalLight(
      0xffffff,
      this.baseSunLightIntensity,
    );
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.position.set(0, 0, 0);

    // Ánh trăng mờ
    this.moonLight = new THREE.DirectionalLight(0x88aaff, 0.1);
    this.scene.add(this.moonLight);

    // Tăng AmbientLight để các vùng tối bớt đen đặc
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

    // Tăng thời gian mô phỏng (1 ms delta = 1 giờ mô phỏng khi speed = 1, tùy biến cho dễ thấy bằng mắt)
    // Tốc độ mặc định là 3600x realtime (1 giây thực = 1 giờ mô phỏng)
    this.simDate.setTime(this.simDate.getTime() + delta * 1000 * 3600 * speed);
    if (this.ui.updateSimTime) {
      this.ui.updateSimTime(this.simDate);
    }

    // Tính toán thiên văn
    const jd = CelestialCalculator.getJulianDate(this.simDate);
    const sunPos = CelestialCalculator.getSunPosition(
      jd,
      this.currentSunPreset.distance,
    );
    const sunDirection = CelestialCalculator.getSunDirection(jd);
    const earthRotationAngle = CelestialCalculator.getEarthRotationAngle(jd);
    const moonPos = CelestialCalculator.getMoonPosition(jd, 10);

    // Cập nhật lights
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

    // Cập nhật visuals
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
