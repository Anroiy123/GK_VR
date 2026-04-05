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
    this.hasPlaybackStarted = false;
    this.isAudioEnabled = false;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = SILENT_VOLUME;
    this.masterGain.connect(this.audioInput);

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
    this.soundtrackSource.connect(this.masterGain);
  }

  ensureAudioContext() {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  setVolume(volume) {
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    this.listener.setMasterVolume(volume);
  }

  handlePlaybackError(error) {
    console.error("Không phát được soundtrack:", error);
    this.hasPlaybackStarted = false;
    this.isAudioEnabled = false;
    this.setVolume(SILENT_VOLUME);
  }

  startPlayback() {
    const playPromise = this.soundtrack.play();

    if (typeof playPromise?.catch === "function") {
      playPromise.catch((error) => this.handlePlaybackError(error));
    }
  }

  toggleMute() {
    this.ensureAudioContext();

    if (!this.hasPlaybackStarted) {
      this.hasPlaybackStarted = true;
      this.isAudioEnabled = true;
      this.setVolume(DEFAULT_MASTER_VOLUME);
      this.startPlayback();
      return true;
    }

    const nextEnabled = !this.isAudioEnabled;
    this.isAudioEnabled = nextEnabled;
    this.setVolume(nextEnabled ? DEFAULT_MASTER_VOLUME : SILENT_VOLUME);

    if (nextEnabled && this.soundtrack.paused) {
      this.startPlayback();
    }

    return this.isAudioEnabled;
  }
}
