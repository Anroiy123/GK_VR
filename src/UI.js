import {
  DEFAULT_SUN_PRESET_ID,
  SUN_PRESET_OPTIONS,
  getSunPreset,
} from "./SunPresets.js";
import { CelestialCalculator } from "./CelestialCalculator.js";
import {
  EARTH_TEXTURE_QUALITY_OPTIONS,
  normalizeEarthTextureQualityPreset,
} from "./AdaptiveTexture.js";

const DEFAULT_MONTH_LABELS = [
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
const SEASON_TIMELINE_MAX = 364.999;

function formatCoordinateLabel(value, positiveDirection, negativeDirection) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const direction = value >= 0 ? positiveDirection : negativeDirection;
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}

export class UI {
  constructor() {
    this.speedSlider = document.getElementById("speed-slider");
    this.speedValueEl = document.getElementById("speed-value");
    this.sunlightSlider = document.getElementById("sunlight-slider");
    this.sunlightValueEl = document.getElementById("sunlight-value");
    this.audioVolumeSlider = document.getElementById("audio-volume-slider");
    this.audioVolumeValueEl = document.getElementById("audio-volume-value");
    this.sunPresetButtons = Array.from(
      document.querySelectorAll("[data-sun-preset]"),
    );
    this.earthViewButtons = Array.from(
      document.querySelectorAll("[data-earth-view]"),
    );
    this.textureQualityButtons = Array.from(
      document.querySelectorAll("[data-earth-quality]"),
    );
    this.fpsCounter = document.getElementById("fps-counter");
    this.simTime = document.getElementById("sim-time");
    this.vrStatus = document.getElementById("vr-status");
    this.controlsPanel = document.getElementById("controls-panel");
    this.controlsToggleBtn = document.getElementById("controls-toggle");
    this.loadingScreen = document.getElementById("loading-screen");
    this.loadingSpinner = this.loadingScreen?.querySelector(".loader") ?? null;
    this.loadingMessage = this.loadingScreen?.querySelector("p") ?? null;
    this.issToggleBtn = document.getElementById("iss-toggle");
    this.muteBtn = document.getElementById("mute-btn");
    this.markersToggleBtn = document.getElementById("markers-toggle");
    this.countriesToggleBtn = document.getElementById("countries-toggle");
    this.cloudsToggleBtn = document.getElementById("clouds-toggle");
    this.atmosphereToggleBtn = document.getElementById("atmosphere-toggle");
    this.actionGrid = document.querySelector(".action-grid");
    this.climateControls = document.getElementById("climate-controls");
    this.explorerMonthTitle = document.getElementById("explorer-month-title");
    this.climateMonthSlider = document.getElementById("climate-month-slider");
    this.climateMonthLabel = document.getElementById("climate-month-label");
    this.climateLegend = document.getElementById("climate-legend");
    this.climateLegendTitle = document.getElementById("climate-legend-title");
    this.climateLegendBar = document.getElementById("climate-legend-bar");
    this.climateLegendMin = document.getElementById("climate-legend-min");
    this.climateLegendMax = document.getElementById("climate-legend-max");
    this.climatePanel = document.getElementById("climate-panel");
    this.climatePanelKicker = document.getElementById("climate-panel-kicker");
    this.climatePanelTitle = document.getElementById("climate-panel-title");
    this.climatePanelStatus = document.getElementById("climate-panel-status");
    this.climatePanelSample = document.getElementById("climate-panel-sample");
    this.climateProbeLat = document.getElementById("climate-probe-lat");
    this.climateProbeLon = document.getElementById("climate-probe-lon");
    this.climateProbeMonth = document.getElementById("climate-probe-month");
    this.climateProbeValue = document.getElementById("climate-probe-value");
    this.climateProbeInterpretation = document.getElementById(
      "climate-probe-interpretation",
    );
    this.climateInsight = document.getElementById("climate-panel-insight");
    this.climateInsightTitle = document.getElementById(
      "climate-panel-insight-title",
    );
    this.climateInsightSummary = document.getElementById(
      "climate-panel-insight-summary",
    );
    this.coordinatePanel = document.getElementById("coordinate-panel");
    this.coordinatePanelKicker = document.getElementById(
      "coordinate-panel-kicker",
    );
    this.coordinatePanelTitle = document.getElementById(
      "coordinate-panel-title",
    );
    this.coordinatePanelStatus = document.getElementById(
      "coordinate-panel-status",
    );
    this.coordinatePanelSample = document.getElementById(
      "coordinate-panel-sample",
    );
    this.coordinateProbeLat = document.getElementById("coordinate-probe-lat");
    this.coordinateProbeLon = document.getElementById("coordinate-probe-lon");
    this.coordinateProbeSummary = document.getElementById(
      "coordinate-probe-summary",
    );
    this.seasonPanel = document.getElementById("season-panel");
    this.seasonPanelKicker = document.getElementById("season-panel-kicker");
    this.seasonPanelTitle = document.getElementById("season-panel-title");
    this.seasonPanelStatus = document.getElementById("season-panel-status");
    this.seasonPanelDate = document.getElementById("season-panel-date");
    this.seasonPanelSubsolar = document.getElementById("season-panel-subsolar");
    this.seasonPanelTilt = document.getElementById("season-panel-tilt");
    this.seasonPanelHemisphere = document.getElementById(
      "season-panel-hemisphere",
    );
    this.seasonPanelSummary = document.getElementById("season-panel-summary");
    this.seasonOrbitInset = document.getElementById("season-orbit-inset");
    this.seasonOrbitEarth = document.getElementById("season-orbit-earth");
    this.seasonOrbitCaption = document.getElementById("season-orbit-caption");
    this.seasonOrbitEvents = Array.from(
      document.querySelectorAll("[data-season-orbit-event]"),
    );
    this.locationPopup = document.getElementById("location-popup");
    this.locationPopupTitle = document.getElementById("location-popup-title");
    this.locationPopupDesc = document.getElementById("location-popup-desc");
    this.locationPopupGallery = document.getElementById(
      "location-popup-gallery",
    );

    this.onISSToggle = null;
    this.onMuteToggle = null;
    this.onMarkersToggle = null;
    this.onCountriesToggle = null;
    this.onCloudsToggle = null;
    this.onAtmosphereToggle = null;
    this.onEarthViewModeChange = null;
    this.onClimateMonthChange = null;
    this.onSeasonTimelineChange = null;
    this.onExplorerSliderScrubChange = null;
    this.onSunPresetChange = null;
    this.onTextureQualityChange = null;
    this.onControlsToggle = null;
    this.onSpeedChange = null;
    this.onSunlightChange = null;
    this.onAudioVolumeChange = null;

    this.speedMultiplier = 1;
    this.sunlightMultiplier = 1.0;
    this.audioVolume = 1;
    this.sunPreset = DEFAULT_SUN_PRESET_ID;
    this.earthViewMode = "globe";
    this.textureQuality = "auto";
    this.controlsCollapsed = false;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.activePopupName = null;
    this.monthLabels = [...DEFAULT_MONTH_LABELS];
    this.explorerSliderMode = "climate";

    this.speedSlider?.addEventListener("input", () => {
      this.speedMultiplier = parseFloat(this.speedSlider.value);
      if (this.speedValueEl) {
        this.speedValueEl.textContent = `${this.speedMultiplier.toFixed(1)}x`;
      }
      this.onSpeedChange?.(this.speedMultiplier);
    });

    this.sunlightSlider?.addEventListener("input", () => {
      this.sunlightMultiplier = parseFloat(this.sunlightSlider.value);
      if (this.sunlightValueEl) {
        this.sunlightValueEl.textContent = `${this.sunlightMultiplier.toFixed(1)}x`;
      }
      this.onSunlightChange?.(this.sunlightMultiplier);
    });

    this.audioVolumeSlider?.addEventListener("input", () => {
      const nextVolume = parseFloat(this.audioVolumeSlider.value);
      this.setAudioVolume(nextVolume);
      this.onAudioVolumeChange?.(this.audioVolume);
    });

    const handleSeasonScrubChange = (isScrubbing) => {
      if (this.explorerSliderMode !== "season") {
        return;
      }

      this.onExplorerSliderScrubChange?.(isScrubbing);
    };

    this.climateMonthSlider?.addEventListener("input", () => {
      const rawValue = parseFloat(this.climateMonthSlider.value);

      if (this.explorerSliderMode === "season") {
        const nextTimelineDay = Number.isFinite(rawValue) ? rawValue : 0;
        this.setSeasonTimeline(nextTimelineDay);
        this.onSeasonTimelineChange?.(nextTimelineDay);
        return;
      }

      const nextMonthIndex = parseInt(this.climateMonthSlider.value, 10) || 0;
      this.setClimateMonth(nextMonthIndex);
      this.onClimateMonthChange?.(nextMonthIndex);
    });
    this.climateMonthSlider?.addEventListener("pointerdown", () => {
      handleSeasonScrubChange(true);
    });
    this.climateMonthSlider?.addEventListener("pointerup", () => {
      handleSeasonScrubChange(false);
    });
    this.climateMonthSlider?.addEventListener("pointercancel", () => {
      handleSeasonScrubChange(false);
    });
    this.climateMonthSlider?.addEventListener("change", () => {
      handleSeasonScrubChange(false);
    });
    window.addEventListener("pointerup", () => {
      handleSeasonScrubChange(false);
    });
    window.addEventListener("pointercancel", () => {
      handleSeasonScrubChange(false);
    });

    this.sunPresetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextPreset = button.dataset.sunPreset;
        if (!nextPreset || nextPreset === this.sunPreset) {
          return;
        }

        this.setSunPreset(nextPreset);
        this.onSunPresetChange?.(this.sunPreset);
      });
    });

    this.earthViewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.earthView;
        if (!nextMode || nextMode === this.earthViewMode) {
          return;
        }

        this.setEarthViewMode(nextMode);
        this.onEarthViewModeChange?.(nextMode);
      });
    });

    this.textureQualityButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextPreset = normalizeEarthTextureQualityPreset(
          button.dataset.earthQuality,
        );

        if (nextPreset === this.textureQuality) {
          return;
        }

        this.setTextureQuality(nextPreset);
        this.onTextureQualityChange?.(nextPreset);
      });
    });

    this.issToggleBtn?.addEventListener("click", () => {
      this.onISSToggle?.();
    });

    this.muteBtn?.addEventListener("click", () => {
      this.onMuteToggle?.();
    });

    this.markersToggleBtn?.addEventListener("click", () => {
      this.onMarkersToggle?.();
    });

    this.countriesToggleBtn?.addEventListener("click", () => {
      this.onCountriesToggle?.();
    });

    this.cloudsToggleBtn?.addEventListener("click", () => {
      this.onCloudsToggle?.();
    });

    this.atmosphereToggleBtn?.addEventListener("click", () => {
      this.onAtmosphereToggle?.();
    });

    this.controlsToggleBtn?.addEventListener("click", () => {
      const nextCollapsed = !this.controlsCollapsed;
      this.setControlsCollapsed(nextCollapsed);
      this.onControlsToggle?.(nextCollapsed);
    });

    this.setMarkersToggleText(false);
    this.setCountriesToggleText(false);
    this.setClimateMonth(0);
    this.setExplorerControlsVisible(false);
    this.setExplorerMonthTitle("Tháng dữ liệu");
    this.setClimateLegendVisible(true);
    this.setEarthViewMode(this.earthViewMode);
    this.setTextureQuality(this.textureQuality);
    this.setControlLocks({});
    this.setActionButtonVisibility({});
    this.setSunPreset(this.sunPreset);
    this.setAudioVolume(this.audioVolume);
    this.hideSeasonPanel();
  }

  hideLoading() {
    this.loadingScreen?.classList.remove("error");
    this.loadingSpinner?.classList.remove("error");
    this.loadingScreen?.classList.add("hidden");
    setTimeout(() => {
      if (this.loadingScreen) {
        this.loadingScreen.style.display = "none";
      }
    }, 800);
  }

  showLoadingError(message = "Không thể khởi tạo mô phỏng.") {
    if (this.loadingScreen) {
      this.loadingScreen.style.display = "flex";
      this.loadingScreen.classList.remove("hidden");
      this.loadingScreen.classList.add("error");
    }

    if (this.loadingSpinner) {
      this.loadingSpinner.classList.add("error");
    }

    if (this.loadingMessage) {
      this.loadingMessage.textContent = message;
    }
  }

  updateFPS(timestamp) {
    this.frameCount += 1;
    if (timestamp - this.lastFpsUpdate >= 1000) {
      if (this.fpsCounter) {
        this.fpsCounter.textContent = `FPS: ${this.frameCount}`;
      }
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }
  }

  setVRStatus(connected) {
    if (this.vrStatus) {
      this.vrStatus.textContent = connected
        ? "VR: Đang hoạt động 🟢"
        : "VR: Chưa kết nối";
    }
  }

  updateSimTime(date) {
    if (this.simTime) {
      const parts = date.toISOString().split("T");
      const time = parts[1].substring(0, 8);
      this.simTime.textContent = `Thời gian: ${parts[0]} ${time} UTC`;
    }
  }

  setMonthLabels(labels) {
    if (Array.isArray(labels) && labels.length === 12) {
      this.monthLabels = [...labels];
    }

    if (this.explorerSliderMode !== "climate") {
      return;
    }

    const sliderValue =
      parseInt(this.climateMonthSlider?.value ?? "0", 10) || 0;
    this.setClimateMonth(sliderValue);
  }

  setISSToggleText(isTracking) {
    if (this.issToggleBtn) {
      this.issToggleBtn.textContent = isTracking
        ? "🌍 Quay lại Orbit"
        : "🛰️ ISS View";
    }
  }

  setMuteBtnText(isAudible) {
    if (this.muteBtn) {
      this.muteBtn.textContent = isAudible ? "🔊 Âm thanh" : "🔇 Âm thanh";
    }
  }

  setAudioVolume(volume) {
    const safeVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 1;
    this.audioVolume = safeVolume;

    if (this.audioVolumeSlider) {
      this.audioVolumeSlider.value = safeVolume.toFixed(2);
    }

    if (this.audioVolumeValueEl) {
      this.audioVolumeValueEl.textContent = `${Math.round(safeVolume * 100)}%`;
    }
  }

  setMarkersToggleText(isVisible) {
    if (this.markersToggleBtn) {
      this.markersToggleBtn.textContent = isVisible
        ? "📍 Ẩn địa danh"
        : "📍 Hiện địa danh";
    }
  }

  setCloudsToggleText(isVisible) {
    if (this.cloudsToggleBtn) {
      this.cloudsToggleBtn.textContent = isVisible
        ? "☁️ Tắt mây"
        : "☁️ Bật mây";
    }
  }

  setCountriesToggleText(isVisible) {
    if (this.countriesToggleBtn) {
      this.countriesToggleBtn.textContent = isVisible
        ? "🗺️ Ẩn tên quốc gia"
        : "🗺️ Hiện tên quốc gia";
    }
  }

  setAtmosphereToggleText(isVisible) {
    if (this.atmosphereToggleBtn) {
      this.atmosphereToggleBtn.textContent = isVisible
        ? "🌫️ Tắt khí quyển"
        : "🌫️ Bật khí quyển";
    }
  }

  setSunPreset(presetId) {
    const preset = getSunPreset(presetId);
    this.sunPreset = preset.id;

    this.sunPresetButtons.forEach((button) => {
      const isActive = button.dataset.sunPreset === preset.id;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("active", isActive);
      const option = SUN_PRESET_OPTIONS.find(
        (item) => item.id === button.dataset.sunPreset,
      );
      if (option) {
        button.textContent = option.label;
      }
    });
  }

  setEarthViewMode(mode) {
    this.earthViewMode = mode;

    this.earthViewButtons.forEach((button) => {
      const isActive = button.dataset.earthView === mode;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("active", isActive);
    });
  }

  setTextureQuality(presetId) {
    const normalizedPreset = normalizeEarthTextureQualityPreset(presetId);
    this.textureQuality = normalizedPreset;

    this.textureQualityButtons.forEach((button) => {
      const isActive = button.dataset.earthQuality === normalizedPreset;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("active", isActive);
      const option = EARTH_TEXTURE_QUALITY_OPTIONS.find(
        (item) => item.id === button.dataset.earthQuality,
      );
      if (option) {
        button.textContent = option.label;
      }
    });
  }

  setTextureQualityButtonsBusy(isBusy) {
    this.textureQualityButtons.forEach((button) => {
      button.disabled = isBusy;
      button.setAttribute("aria-disabled", String(isBusy));
    });
  }

  setExplorerControlsVisible(isVisible) {
    if (!this.climateControls) {
      return;
    }

    this.climateControls.hidden = !isVisible;
  }

  setClimateControlsVisible(isVisible) {
    this.setExplorerControlsVisible(isVisible);
  }

  setExplorerMonthTitle(title) {
    if (this.explorerMonthTitle) {
      this.explorerMonthTitle.textContent = title;
    }
  }

  setExplorerSliderConfig({
    mode = "climate",
    min = "0",
    max = "11",
    step = "1",
    value = "0",
    label = "",
  } = {}) {
    this.explorerSliderMode = mode;

    if (this.climateMonthSlider) {
      this.climateMonthSlider.min = min;
      this.climateMonthSlider.max = max;
      this.climateMonthSlider.step = step;
      this.climateMonthSlider.value = value;
    }

    if (this.climateMonthLabel && label) {
      this.climateMonthLabel.textContent = label;
    }
  }

  setClimateMonth(monthIndex) {
    const safeMonthIndex = Math.min(11, Math.max(0, monthIndex));
    this.setExplorerSliderConfig({
      mode: "climate",
      min: "0",
      max: "11",
      step: "1",
      value: String(safeMonthIndex),
      label: this.monthLabels[safeMonthIndex] ?? `Tháng ${safeMonthIndex + 1}`,
    });
  }

  setSeasonTimeline(timelineDay, dateLabel = null) {
    const safeTimelineDay = Math.min(
      SEASON_TIMELINE_MAX,
      Math.max(
        0,
        Number.isFinite(timelineDay) ? timelineDay : 0,
      ),
    );
    const resolvedDateLabel =
      dateLabel ??
      CelestialCalculator.formatDateLabel(
        CelestialCalculator.getDateFromTimelineDay(safeTimelineDay),
      );

    this.setExplorerSliderConfig({
      mode: "season",
      min: "0",
      max: String(SEASON_TIMELINE_MAX),
      step: "any",
      value: safeTimelineDay.toFixed(3),
      label: resolvedDateLabel,
    });
  }

  setClimateLegend(variableMeta) {
    if (!variableMeta) {
      return;
    }

    if (this.climateLegendTitle) {
      this.climateLegendTitle.textContent = variableMeta.title;
    }

    if (this.climateLegendBar) {
      const gradient = variableMeta.paletteStops
        .map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`)
        .join(", ");
      this.climateLegendBar.style.background = `linear-gradient(90deg, ${gradient})`;
    }

    if (this.climateLegendMin) {
      this.climateLegendMin.textContent = `${variableMeta.domain[0]}${variableMeta.unit}`;
    }

    if (this.climateLegendMax) {
      this.climateLegendMax.textContent = `${variableMeta.domain[1]}${variableMeta.unit}`;
    }
  }

  setClimateLegendVisible(isVisible) {
    if (this.climateLegend) {
      this.climateLegend.hidden = !isVisible;
    }
  }

  setSeasonEventActive(eventKey) {
    this.seasonOrbitEvents.forEach((node) => {
      const isActive = node.dataset.seasonOrbitEvent === eventKey;
      node.classList.toggle("is-active", isActive);
    });
  }

  setActionButtonVisibility({
    issVisible = true,
    muteVisible = true,
    markersVisible = true,
    countriesVisible = true,
    cloudsVisible = true,
    atmosphereVisible = true,
  } = {}) {
    const visibilityMap = [
      { button: this.issToggleBtn, visible: issVisible },
      { button: this.muteBtn, visible: muteVisible },
      { button: this.markersToggleBtn, visible: markersVisible },
      { button: this.countriesToggleBtn, visible: countriesVisible },
      { button: this.cloudsToggleBtn, visible: cloudsVisible },
      { button: this.atmosphereToggleBtn, visible: atmosphereVisible },
    ];

    let visibleCount = 0;
    visibilityMap.forEach(({ button, visible }) => {
      if (!button) {
        return;
      }

      button.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });

    if (this.actionGrid) {
      this.actionGrid.classList.toggle("action-grid--single", visibleCount <= 1);
    }
  }

  setControlLocks({
    cloudsLocked = false,
    atmosphereLocked = false,
    markersLocked = false,
    countriesLocked = false,
  } = {}) {
    const lockMap = [
      { button: this.cloudsToggleBtn, locked: cloudsLocked },
      { button: this.atmosphereToggleBtn, locked: atmosphereLocked },
      { button: this.markersToggleBtn, locked: markersLocked },
      { button: this.countriesToggleBtn, locked: countriesLocked },
    ];

    lockMap.forEach(({ button, locked }) => {
      if (!button) {
        return;
      }

      button.disabled = locked;
      button.classList.toggle("is-locked", locked);
      button.setAttribute("aria-disabled", String(locked));
    });
  }

  showClimateStatus(title, message, kicker = "Climate Explorer") {
    if (
      !this.climatePanel ||
      !this.climatePanelTitle ||
      !this.climatePanelStatus ||
      !this.climatePanelKicker
    ) {
      return;
    }

    this.climatePanel.hidden = false;
    this.climatePanelKicker.textContent = kicker;
    this.climatePanelTitle.textContent = title;
    this.climatePanelStatus.textContent = message;
    this.climatePanelSample.hidden = true;
    this.climateInsight.hidden = true;
  }

  showClimateProbe(sample) {
    if (
      !sample ||
      !this.climatePanel ||
      !this.climatePanelTitle ||
      !this.climatePanelStatus ||
      !this.climatePanelSample ||
      !this.climateProbeLat ||
      !this.climateProbeLon ||
      !this.climateProbeMonth ||
      !this.climateProbeValue ||
      !this.climateProbeInterpretation ||
      !this.climatePanelKicker
    ) {
      return;
    }

    this.climatePanel.hidden = false;
    this.climatePanelKicker.textContent = sample.label;
    this.climatePanelTitle.textContent = sample.title;
    this.climatePanelStatus.textContent = "Dữ liệu khí hậu tại điểm đã chọn.";
    this.climateProbeLat.textContent = sample.latLabel;
    this.climateProbeLon.textContent = sample.lonLabel;
    this.climateProbeMonth.textContent = sample.monthLabel;
    this.climateProbeValue.textContent = sample.valueText;
    this.climateProbeInterpretation.textContent = sample.interpretation;
    this.climatePanelSample.hidden = false;
    this.climateInsight.hidden = true;
  }

  showClimateInsight(insight, sample) {
    if (
      !insight ||
      !this.climateInsight ||
      !this.climateInsightTitle ||
      !this.climateInsightSummary
    ) {
      return;
    }

    if (sample) {
      this.showClimateProbe(sample);
    }

    this.climateInsightTitle.textContent = insight.title;
    this.climateInsightSummary.textContent = insight.summary;
    this.climateInsight.hidden = false;
  }

  hideClimateProbe() {
    if (!this.climatePanel) {
      return;
    }

    this.climatePanel.hidden = true;
    this.climatePanelSample.hidden = true;
    this.climateInsight.hidden = true;
  }

  showCoordinateStatus(title, message, kicker = "Mode tọa độ") {
    if (
      !this.coordinatePanel ||
      !this.coordinatePanelTitle ||
      !this.coordinatePanelStatus ||
      !this.coordinatePanelKicker ||
      !this.coordinatePanelSample
    ) {
      return;
    }

    this.coordinatePanel.hidden = false;
    this.coordinatePanelKicker.textContent = kicker;
    this.coordinatePanelTitle.textContent = title;
    this.coordinatePanelStatus.textContent = message;
    this.coordinatePanelSample.hidden = true;
  }

  showCoordinateProbe(selection) {
    if (
      !selection ||
      !this.coordinatePanel ||
      !this.coordinatePanelTitle ||
      !this.coordinatePanelStatus ||
      !this.coordinatePanelSample ||
      !this.coordinatePanelKicker ||
      !this.coordinateProbeLat ||
      !this.coordinateProbeLon ||
      !this.coordinateProbeSummary
    ) {
      return;
    }

    this.coordinatePanel.hidden = false;
    this.coordinatePanelKicker.textContent = "Mode tọa độ";
    this.coordinatePanelTitle.textContent = "Điểm đã chọn";
    this.coordinatePanelStatus.textContent =
      "Tọa độ của vị trí bạn vừa chọn trên bề mặt Trái Đất.";
    this.coordinateProbeLat.textContent = formatCoordinateLabel(
      selection.lat,
      "Bắc",
      "Nam",
    );
    this.coordinateProbeLon.textContent = formatCoordinateLabel(
      selection.lon,
      "Đông",
      "Tây",
    );
    this.coordinateProbeSummary.textContent =
      "Bấm vào điểm khác trên quả địa cầu để cập nhật tọa độ mới.";
    this.coordinatePanelSample.hidden = false;
  }

  hideCoordinatePanel() {
    if (!this.coordinatePanel || !this.coordinatePanelSample) {
      return;
    }

    this.coordinatePanel.hidden = true;
    this.coordinatePanelSample.hidden = true;
  }

  showSeasonPanel(seasonState) {
    if (
      !seasonState ||
      !this.seasonPanel ||
      !this.seasonPanelKicker ||
      !this.seasonPanelTitle ||
      !this.seasonPanelStatus ||
      !this.seasonPanelDate ||
      !this.seasonPanelSubsolar ||
      !this.seasonPanelTilt ||
      !this.seasonPanelHemisphere ||
      !this.seasonPanelSummary
    ) {
      return;
    }

    this.seasonPanel.hidden = false;
    this.seasonPanelKicker.textContent = "Khám phá mùa";
    this.seasonPanelTitle.textContent =
      seasonState.stateLabel ?? seasonState.eventLabel;
    this.seasonPanelStatus.textContent = `${seasonState.dateLabel} | Theo dõi quỹ đạo Sun-Earth-Moon và vùng ánh sáng Mặt Trời bị Mặt Trăng che khuất trên Trái Đất.`;
    this.seasonPanelDate.textContent = seasonState.dateLabel;
    this.seasonPanelSubsolar.textContent = seasonState.subsolarLatitudeLabel;
    this.seasonPanelTilt.textContent = `${seasonState.axialTiltDeg.toFixed(2)}°`;
    this.seasonPanelHemisphere.textContent = seasonState.dominantHemisphere;
    this.seasonPanelSummary.textContent = seasonState.summary;
  }

  showSeasonStatus(title, message) {
    if (
      !this.seasonPanel ||
      !this.seasonPanelTitle ||
      !this.seasonPanelStatus ||
      !this.seasonPanelDate ||
      !this.seasonPanelSubsolar ||
      !this.seasonPanelTilt ||
      !this.seasonPanelHemisphere ||
      !this.seasonPanelSummary ||
      !this.seasonPanelKicker
    ) {
      return;
    }

    this.seasonPanel.hidden = false;
    this.seasonPanelKicker.textContent = "Khám phá mùa";
    this.seasonPanelTitle.textContent = title;
    this.seasonPanelStatus.textContent = message;
    this.seasonPanelDate.textContent = "--";
    this.seasonPanelSubsolar.textContent = "--";
    this.seasonPanelTilt.textContent = "23.44°";
    this.seasonPanelHemisphere.textContent = "--";
    this.seasonPanelSummary.textContent =
      "Mode này cần mô hình Sun-Earth-Moon riêng để minh hoạ quỹ đạo theo timeline liên tục.";

    if (this.seasonOrbitInset) {
      this.seasonOrbitInset.hidden = true;
    }
  }

  hideSeasonPanel() {
    if (this.seasonPanel) {
      this.seasonPanel.hidden = true;
    }

    if (this.seasonOrbitInset) {
      this.seasonOrbitInset.hidden = true;
    }
  }

  updateSeasonOrbit(seasonState) {
    if (
      !seasonState ||
      !this.seasonOrbitInset ||
      !this.seasonOrbitEarth ||
      !this.seasonOrbitCaption
    ) {
      return;
    }

    const center = 140;
    const radius = 96;
    const angleRad = (seasonState.orbitAngleDeg * Math.PI) / 180;
    const earthX = center + Math.cos(angleRad) * radius;
    const earthY = center + Math.sin(angleRad) * radius;

    this.seasonOrbitInset.hidden = false;
    this.seasonOrbitEarth.setAttribute(
      "transform",
      `translate(${earthX.toFixed(2)} ${earthY.toFixed(2)})`,
    );
    this.seasonOrbitCaption.textContent = `${seasonState.stateLabel ?? seasonState.eventLabel} | ${seasonState.dateLabel}`;
    this.setSeasonEventActive(
      seasonState.isExactSeasonEvent ? seasonState.nearestEventKey : null,
    );
  }

  adjustSpeed(delta) {
    if (!this.speedSlider || !this.speedValueEl) {
      return;
    }

    const min = parseFloat(this.speedSlider.min);
    const max = parseFloat(this.speedSlider.max);
    const next = Math.min(max, Math.max(min, this.speedMultiplier + delta));
    this.speedMultiplier = next;
    this.speedSlider.value = next.toFixed(1);
    this.speedValueEl.textContent = `${next.toFixed(1)}x`;
    this.onSpeedChange?.(this.speedMultiplier);
  }

  adjustSunlight(delta) {
    if (!this.sunlightSlider || !this.sunlightValueEl) {
      return;
    }

    const min = parseFloat(this.sunlightSlider.min);
    const max = parseFloat(this.sunlightSlider.max);
    const next = Math.min(max, Math.max(min, this.sunlightMultiplier + delta));
    this.sunlightMultiplier = next;
    this.sunlightSlider.value = next.toFixed(1);
    this.sunlightValueEl.textContent = `${next.toFixed(1)}x`;
    this.onSunlightChange?.(this.sunlightMultiplier);
  }

  setControlsCollapsed(isCollapsed) {
    this.controlsCollapsed = isCollapsed;
    this.controlsPanel?.classList.toggle("collapsed", isCollapsed);

    if (this.controlsToggleBtn) {
      this.controlsToggleBtn.textContent = isCollapsed
        ? "▶ Mở bảng điều khiển"
        : "◀ Ẩn bảng điều khiển";
      this.controlsToggleBtn.setAttribute(
        "aria-expanded",
        String(!isCollapsed),
      );
    }
  }

  showLocationPopup(location) {
    if (
      !this.locationPopup ||
      !this.locationPopupTitle ||
      !this.locationPopupDesc ||
      !this.locationPopupGallery
    ) {
      return;
    }

    if (this.activePopupName !== location.name) {
      this.locationPopupTitle.textContent = location.name;
      this.locationPopupDesc.textContent = location.desc;
      this.locationPopupGallery.innerHTML = "";

      location.imageUrls.forEach((imageUrl, index) => {
        const card = document.createElement("div");
        card.className = "location-popup-card";

        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = `${location.name} ${index + 1}`;
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.className = "location-popup-image";
        image.addEventListener("error", () => {
          if (image.dataset.fallbackApplied === "true") {
            return;
          }

          image.dataset.fallbackApplied = "true";
          image.src = this.createPopupFallbackImage(location.name, index + 1);
        });

        card.appendChild(image);
        this.locationPopupGallery.appendChild(card);
      });

      this.activePopupName = location.name;
    }

    this.locationPopup.hidden = false;
    this.locationPopup.classList.add("visible");
  }

  hideLocationPopup() {
    if (!this.locationPopup) {
      return;
    }

    this.locationPopup.classList.remove("visible");
    this.locationPopup.hidden = true;
    this.activePopupName = null;
  }

  setLocationPopupPosition(x, y) {
    if (!this.locationPopup || this.locationPopup.hidden) {
      return;
    }

    const margin = 16;
    const width = this.locationPopup.offsetWidth || 320;
    const height = this.locationPopup.offsetHeight || 280;
    const preferredX = x + 24;
    const preferredY = y - height * 0.45;
    const clampedX = Math.min(
      Math.max(margin, preferredX),
      window.innerWidth - width - margin,
    );
    const clampedY = Math.min(
      Math.max(margin, preferredY),
      window.innerHeight - height - margin,
    );

    this.locationPopup.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  }

  createPopupFallbackImage(locationName, imageIndex) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#12233b"/>
          <stop offset="100%" stop-color="#27486b"/>
        </linearGradient>
      </defs>
      <rect width="640" height="480" fill="url(#g)"/>
      <circle cx="520" cy="110" r="70" fill="rgba(255,255,255,0.08)"/>
      <path d="M40 360 L170 220 L260 320 L360 180 L530 360 Z" fill="rgba(255,255,255,0.12)"/>
      <text x="40" y="92" fill="#ffffff" font-size="42" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${locationName}</text>
      <text x="40" y="146" fill="rgba(255,255,255,0.72)" font-size="28" font-family="Segoe UI, Arial, sans-serif">Ảnh ${imageIndex}</text>
      <text x="40" y="420" fill="rgba(255,255,255,0.7)" font-size="24" font-family="Segoe UI, Arial, sans-serif">Ảnh online đang cập nhật</text>
    </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
}
