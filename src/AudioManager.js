import * as THREE from "three";

const DEFAULT_MASTER_VOLUME = 1;
const SILENT_VOLUME = 0;
const SOUNDTRACK_URL = new URL(
  "../sound/Interstellar Main Theme - Extra Extended - Soundtrack by  Hans Zimmer.mp3",
  import.meta.url,
).href;

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.audioContext = THREE.AudioContext.getContext();
    this.audioInput = this.getListenerInput();
    this.soundtrack = this.createSoundtrackElement();
    this.soundtrackSource = null;
    this.isAudioUnlocked = false;
    this.hasPlaybackStarted = false;
    this.isAudioEnabled = false;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = SILENT_VOLUME;
    this.masterGain.connect(this.audioInput);

    this.soundtrackGain = this.audioContext.createGain();
    this.soundtrackGain.gain.value = 1;
    this.soundtrackGain.connect(this.masterGain);

    this.effectsGain = this.audioContext.createGain();
    this.effectsGain.gain.value = 0.9;
    this.effectsGain.connect(this.masterGain);

    this.ensureSoundtrackSource();
    this.listener.setMasterVolume(SILENT_VOLUME);
  }

  getListenerInput() {
    if (typeof this.listener.getInput === "function") {
      return this.listener.getInput();
    }

    return this.audioContext.destination;
  }

  createSoundtrackElement() {
    const audio = document.createElement("audio");
    audio.src = SOUNDTRACK_URL;
    audio.loop = true;
    audio.preload = "auto";
    audio.playsInline = true;
    audio.crossOrigin = "anonymous";
    return audio;
  }

  ensureSoundtrackSource() {
    if (this.soundtrackSource) {
      return;
    }

    this.soundtrackSource = this.audioContext.createMediaElementSource(
      this.soundtrack,
    );
    this.soundtrackSource.connect(this.soundtrackGain);
  }

  ensureAudioContext() {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  setMasterVolume(volume) {
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    this.listener.setMasterVolume(volume);
  }

  setSoundtrackEnabled(isEnabled) {
    this.isAudioEnabled = isEnabled;
    this.soundtrackGain.gain.setValueAtTime(
      isEnabled ? DEFAULT_MASTER_VOLUME : SILENT_VOLUME,
      this.audioContext.currentTime,
    );
  }

  unlockAudio() {
    this.ensureAudioContext();

    if (this.isAudioUnlocked) {
      return true;
    }

    this.isAudioUnlocked = true;
    this.setMasterVolume(DEFAULT_MASTER_VOLUME);
    return true;
  }

  handlePlaybackError(error) {
    console.error("Không phát được soundtrack:", error);
    this.hasPlaybackStarted = false;
    this.isAudioEnabled = false;
    this.soundtrackGain.gain.setValueAtTime(
      SILENT_VOLUME,
      this.audioContext.currentTime,
    );
  }

  startPlayback() {
    const playPromise = this.soundtrack.play();

    if (typeof playPromise?.catch === "function") {
      playPromise.catch((error) => this.handlePlaybackError(error));
    }
  }

  scheduleTone({
    frequency,
    startTime,
    duration,
    type = "sine",
    volume = 0.05,
    attack = 0.01,
    release = 0.12,
    detune = 0,
    cutoff = 2200,
  }) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const endTime = startTime + duration;
    const sustainStart = Math.max(startTime + attack, endTime - release);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(detune, startTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, startTime);
    filter.Q.setValueAtTime(0.7, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
    gainNode.gain.setValueAtTime(volume, sustainStart);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.effectsGain);

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }

  playUiPress(variant = "default") {
    if (!this.isAudioUnlocked) {
      return;
    }

    this.ensureAudioContext();
    const now = this.audioContext.currentTime;

    if (variant === "success") {
      this.scheduleTone({
        frequency: 523.25,
        startTime: now,
        duration: 0.12,
        type: "triangle",
        volume: 0.035,
        cutoff: 2600,
      });
      this.scheduleTone({
        frequency: 783.99,
        startTime: now + 0.07,
        duration: 0.18,
        type: "sine",
        volume: 0.028,
        cutoff: 3200,
      });
      return;
    }

    if (variant === "back") {
      this.scheduleTone({
        frequency: 392.0,
        startTime: now,
        duration: 0.12,
        type: "triangle",
        volume: 0.032,
        cutoff: 2200,
      });
      this.scheduleTone({
        frequency: 293.66,
        startTime: now + 0.05,
        duration: 0.16,
        type: "sine",
        volume: 0.026,
        cutoff: 2000,
      });
      return;
    }

    this.scheduleTone({
      frequency: 466.16,
      startTime: now,
      duration: 0.1,
      type: "triangle",
      volume: 0.028,
      cutoff: 2400,
    });
    this.scheduleTone({
      frequency: 698.46,
      startTime: now + 0.04,
      duration: 0.14,
      type: "sine",
      volume: 0.022,
      cutoff: 3000,
    });
  }

  playMarkerSelect() {
    if (!this.isAudioUnlocked) {
      return;
    }

    this.ensureAudioContext();
    const now = this.audioContext.currentTime;
    this.scheduleTone({
      frequency: 659.25,
      startTime: now,
      duration: 0.18,
      type: "triangle",
      volume: 0.03,
      cutoff: 2600,
    });
    this.scheduleTone({
      frequency: 987.77,
      startTime: now + 0.08,
      duration: 0.28,
      type: "sine",
      volume: 0.022,
      cutoff: 3400,
    });
  }

  playPanelToggle(isVisible) {
    this.playUiPress(isVisible ? "success" : "back");
  }

  playVrTransition(isEntering) {
    this.playUiPress(isEntering ? "success" : "back");
  }

  enableAudio() {
    this.unlockAudio();

    if (this.hasPlaybackStarted && this.isAudioEnabled) {
      return true;
    }

    this.hasPlaybackStarted = true;
    this.setSoundtrackEnabled(true);

    if (this.soundtrack.paused) {
      this.startPlayback();
    }

    return true;
  }

  toggleMute() {
    this.unlockAudio();

    if (!this.hasPlaybackStarted) {
      return this.enableAudio();
    }

    const nextEnabled = !this.isAudioEnabled;
    this.setSoundtrackEnabled(nextEnabled);

    if (nextEnabled && this.soundtrack.paused) {
      this.startPlayback();
    }

    return this.isAudioEnabled;
  }
}
