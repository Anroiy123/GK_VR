import {
  DEFAULT_SUN_PRESET_ID,
  SUN_PRESET_OPTIONS,
  getSunPreset,
} from "./SunPresets.js";

export class UI {
  constructor() {
    this.speedSlider = document.getElementById("speed-slider");
    this.speedValueEl = document.getElementById("speed-value");
    this.sunlightSlider = document.getElementById("sunlight-slider");
    this.sunlightValueEl = document.getElementById("sunlight-value");
    this.sunPresetButtons = Array.from(
      document.querySelectorAll("[data-sun-preset]"),
    );
    this.fpsCounter = document.getElementById("fps-counter");
    this.simTime = document.getElementById("sim-time");
    this.vrStatus = document.getElementById("vr-status");
    this.controlsPanel = document.getElementById("controls-panel");
    this.controlsToggleBtn = document.getElementById("controls-toggle");
    this.loadingScreen = document.getElementById("loading-screen");
    this.issToggleBtn = document.getElementById("iss-toggle");
    this.muteBtn = document.getElementById("mute-btn");
    this.markersToggleBtn = document.getElementById("markers-toggle");
    this.cloudsToggleBtn = document.getElementById("clouds-toggle");
    this.atmosphereToggleBtn = document.getElementById("atmosphere-toggle");
    this.mapModeToggleBtn = document.getElementById("map-mode-toggle");
    this.locationPopup = document.getElementById("location-popup");
    this.locationPopupTitle = document.getElementById("location-popup-title");
    this.locationPopupDesc = document.getElementById("location-popup-desc");
    this.locationPopupGallery = document.getElementById(
      "location-popup-gallery",
    );
    this.onISSToggle = null;
    this.onMuteToggle = null;
    this.onMarkersToggle = null;
    this.onCloudsToggle = null;
    this.onAtmosphereToggle = null;
    this.onMapModeToggle = null;
    this.onSunPresetChange = null;
    this.onControlsToggle = null;
    this.onSpeedChange = null;
    this.onSunlightChange = null;

    this.speedMultiplier = 1;
    this.sunlightMultiplier = 1.4;
    this.sunPreset = DEFAULT_SUN_PRESET_ID;
    this.controlsCollapsed = false;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.activePopupName = null;

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

    this.issToggleBtn?.addEventListener("click", () => {
      this.onISSToggle?.();
    });

    this.muteBtn?.addEventListener("click", () => {
      this.onMuteToggle?.();
    });

    this.markersToggleBtn?.addEventListener("click", () => {
      this.onMarkersToggle?.();
    });

    this.cloudsToggleBtn?.addEventListener("click", () => {
      this.onCloudsToggle?.();
    });

    this.atmosphereToggleBtn?.addEventListener("click", () => {
      this.onAtmosphereToggle?.();
    });

    this.mapModeToggleBtn?.addEventListener("click", () => {
      this.onMapModeToggle?.();
    });

    this.controlsToggleBtn?.addEventListener("click", () => {
      const nextCollapsed = !this.controlsCollapsed;
      this.setControlsCollapsed(nextCollapsed);
      this.onControlsToggle?.(nextCollapsed);
    });

    this.setMarkersToggleText(false);
    this.setMapModeToggleText(false);
    this.setLayerLockState(false);
    this.setSunPreset(this.sunPreset);
  }

  hideLoading() {
    this.loadingScreen?.classList.add("hidden");
    setTimeout(() => {
      if (this.loadingScreen) {
        this.loadingScreen.style.display = "none";
      }
    }, 800);
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

  setAtmosphereToggleText(isVisible) {
    if (this.atmosphereToggleBtn) {
      this.atmosphereToggleBtn.textContent = isVisible
        ? "🌫️ Tắt khí quyển"
        : "🌫️ Bật khí quyển";
    }
  }

  setMapModeToggleText(isEnabled) {
    if (this.mapModeToggleBtn) {
      this.mapModeToggleBtn.textContent = isEnabled
        ? "🗺️ Tắt chế độ bản đồ"
        : "🗺️ Bật chế độ bản đồ";
    }
  }

  setLayerLockState(isLocked) {
    [this.cloudsToggleBtn, this.atmosphereToggleBtn].forEach((button) => {
      if (!button) {
        return;
      }

      button.disabled = isLocked;
      button.classList.toggle("is-locked", isLocked);
      button.setAttribute("aria-disabled", String(isLocked));
    });
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
