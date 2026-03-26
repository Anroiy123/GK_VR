export class UI {
  constructor() {
    this.speedSlider = document.getElementById('speed-slider');
    this.speedValueEl = document.getElementById('speed-value');
    this.sunlightSlider = document.getElementById('sunlight-slider');
    this.sunlightValueEl = document.getElementById('sunlight-value');
    this.fpsCounter = document.getElementById('fps-counter');
    this.simTime = document.getElementById('sim-time');
    this.vrStatus = document.getElementById('vr-status');
    this.controlsPanel = document.getElementById('controls-panel');
    this.controlsToggleBtn = document.getElementById('controls-toggle');
    this.loadingScreen = document.getElementById('loading-screen');
    this.issToggleBtn = document.getElementById('iss-toggle');
    this.muteBtn = document.getElementById('mute-btn');
    this.markersToggleBtn = document.getElementById('markers-toggle');
    this.bumpToggleBtn = document.getElementById('bump-toggle');
    this.cloudsToggleBtn = document.getElementById('clouds-toggle');
    this.atmosphereToggleBtn = document.getElementById('atmosphere-toggle');
    this.locationPopup = document.getElementById('location-popup');
    this.locationPopupTitle = document.getElementById('location-popup-title');
    this.locationPopupDesc = document.getElementById('location-popup-desc');
    this.locationPopupGallery = document.getElementById('location-popup-gallery');
    this.onISSToggle = null;
    this.onMuteToggle = null;
    this.onMarkersToggle = null;
    this.onBumpToggle = null;
    this.onCloudsToggle = null;
    this.onAtmosphereToggle = null;

    this.speedMultiplier = 1;
    this.sunlightMultiplier = 1.4;
    this.controlsCollapsed = false;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.activePopupName = null;

    this.speedSlider?.addEventListener('input', () => {
      this.speedMultiplier = parseFloat(this.speedSlider.value);
      if (this.speedValueEl) {
        this.speedValueEl.textContent = `${this.speedMultiplier.toFixed(1)}x`;
      }
    });

    this.sunlightSlider?.addEventListener('input', () => {
      this.sunlightMultiplier = parseFloat(this.sunlightSlider.value);
      if (this.sunlightValueEl) {
        this.sunlightValueEl.textContent = `${this.sunlightMultiplier.toFixed(1)}x`;
      }
    });

    this.issToggleBtn?.addEventListener('click', () => {
      this.onISSToggle?.();
    });

    this.muteBtn?.addEventListener('click', () => {
      this.onMuteToggle?.();
    });

    this.markersToggleBtn?.addEventListener('click', () => {
      this.onMarkersToggle?.();
    });

    this.bumpToggleBtn?.addEventListener('click', () => {
      this.onBumpToggle?.();
    });

    this.cloudsToggleBtn?.addEventListener('click', () => {
      this.onCloudsToggle?.();
    });

    this.atmosphereToggleBtn?.addEventListener('click', () => {
      this.onAtmosphereToggle?.();
    });

    this.controlsToggleBtn?.addEventListener('click', () => {
      this.setControlsCollapsed(!this.controlsCollapsed);
    });
  }

  hideLoading() {
    this.loadingScreen?.classList.add('hidden');
    setTimeout(() => {
      if (this.loadingScreen) {
        this.loadingScreen.style.display = 'none';
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
      this.vrStatus.textContent = connected ? 'VR: Đang hoạt động 🟢' : 'VR: Chưa kết nối';
    }
  }

  updateSimTime(date) {
    if (this.simTime) {
      const parts = date.toISOString().split('T');
      const time = parts[1].substring(0, 8);
      this.simTime.textContent = `Thời gian: ${parts[0]} ${time} UTC`;
    }
  }

  setISSToggleText(isTracking) {
    if (this.issToggleBtn) {
      this.issToggleBtn.textContent = isTracking ? '🌍 Quay lại Orbit' : '🛰️ ISS View';
    }
  }

  setMuteBtnText(isAudible) {
    if (this.muteBtn) {
      this.muteBtn.textContent = isAudible ? '🔊 Âm thanh' : '🔇 Âm thanh';
    }
  }

  setMarkersToggleText(isVisible) {
    if (this.markersToggleBtn) {
      this.markersToggleBtn.textContent = isVisible ? '📍 Ẩn địa danh' : '📍 Hiện địa danh';
    }
  }

  setBumpToggleText(isEnabled) {
    if (this.bumpToggleBtn) {
      this.bumpToggleBtn.textContent = isEnabled ? '🗺️ Tắt bump' : '🗺️ Bật bump';
    }
  }

  setCloudsToggleText(isVisible) {
    if (this.cloudsToggleBtn) {
      this.cloudsToggleBtn.textContent = isVisible ? '☁️ Tắt mây' : '☁️ Bật mây';
    }
  }

  setAtmosphereToggleText(isVisible) {
    if (this.atmosphereToggleBtn) {
      this.atmosphereToggleBtn.textContent = isVisible ? '🌫️ Tắt khí quyển' : '🌫️ Bật khí quyển';
    }
  }

  setControlsCollapsed(isCollapsed) {
    this.controlsCollapsed = isCollapsed;
    this.controlsPanel?.classList.toggle('collapsed', isCollapsed);

    if (this.controlsToggleBtn) {
      this.controlsToggleBtn.textContent = isCollapsed ? '▶ Mở bảng điều khiển' : '◀ Ẩn bảng điều khiển';
      this.controlsToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
    }
  }

  showLocationPopup(location) {
    if (!this.locationPopup || !this.locationPopupTitle || !this.locationPopupDesc || !this.locationPopupGallery) {
      return;
    }

    if (this.activePopupName !== location.name) {
      this.locationPopupTitle.textContent = location.name;
      this.locationPopupDesc.textContent = location.desc;
      this.locationPopupGallery.innerHTML = '';

      location.imageUrls.forEach((imageUrl, index) => {
        const card = document.createElement('div');
        card.className = 'location-popup-card';

        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `${location.name} ${index + 1}`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.className = 'location-popup-image';
        image.addEventListener('error', () => {
          card.remove();
        });

        card.appendChild(image);
        this.locationPopupGallery.appendChild(card);
      });

      this.activePopupName = location.name;
    }

    this.locationPopup.hidden = false;
    this.locationPopup.classList.add('visible');
  }

  hideLocationPopup() {
    if (!this.locationPopup) {
      return;
    }

    this.locationPopup.classList.remove('visible');
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
    const clampedX = Math.min(Math.max(margin, preferredX), window.innerWidth - width - margin);
    const clampedY = Math.min(Math.max(margin, preferredY), window.innerHeight - height - margin);

    this.locationPopup.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  }
}
