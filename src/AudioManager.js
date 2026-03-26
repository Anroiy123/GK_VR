import * as THREE from 'three';

export class AudioManager {
  constructor(camera, targetMesh) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.ambientSound = new THREE.Audio(this.listener);
    this.earthHum = new THREE.PositionalAudio(this.listener);
    targetMesh.add(this.earthHum);

    this.isAudioEnabled = false;
    this.audioContext = THREE.AudioContext.getContext();

    this.setupSynthesizedAudio();
  }

  setupSynthesizedAudio() {
    // 1. Synthesize Ambient Space Pad (stereo noise + low pass filter)
    const ambientBuffer = this.createAmbientBuffer();
    this.ambientSound.setBuffer(ambientBuffer);
    this.ambientSound.setLoop(true);
    this.ambientSound.setVolume(0.2);

    // 2. Synthesize Earth Hum (Positional)
    const humBuffer = this.createHumBuffer();
    this.earthHum.setBuffer(humBuffer);
    this.earthHum.setRefDistance(3);
    this.earthHum.setMaxDistance(15);
    this.earthHum.setLoop(true);
    this.earthHum.setVolume(1.0);
  }

  createAmbientBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 4; // 4 seconds
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        // Soft white noise
        let noise = (Math.random() * 2 - 1) * 0.05;
        // Add some slow floating sine waves
        let wave1 = Math.sin(i * 100 * Math.PI * 2 / sampleRate) * 0.05;
        let wave2 = Math.sin(i * 150 * Math.PI * 2 / sampleRate) * 0.05;
        data[i] = noise + wave1 + wave2;
      }
    }
    return buffer;
  }

  createHumBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
      // Sub-bass rumble ~ 50Hz
      let sub = Math.sin(i * 50 * Math.PI * 2 / sampleRate);
      data[i] = sub * 0.8;
    }
    return buffer;
  }

  toggleMute() {
    if (!this.isAudioEnabled) {
      // Browsers require a gesture to start AudioContext
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.ambientSound.play();
      this.earthHum.play();
      this.isAudioEnabled = true;
    } else {
      const masterVolume = this.listener.getMasterVolume();
      this.listener.setMasterVolume(masterVolume === 0 ? 1 : 0);
    }
    return this.listener.getMasterVolume() > 0 && this.isAudioEnabled;
  }
}
