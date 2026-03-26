import { VRButton } from 'three/addons/webxr/VRButton.js';

export class WebXRSetup {
  constructor(renderer) {
    this.renderer = renderer;
    this.isPresenting = false;
    this.onSessionStart = null;
    this.onSessionEnd = null;
  }

  init() {
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');

    const vrButton = VRButton.createButton(this.renderer);
    document.body.appendChild(vrButton);

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isPresenting = true;
      document.body.classList.add('vr-active');
      this.onSessionStart?.();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.isPresenting = false;
      document.body.classList.remove('vr-active');
      this.onSessionEnd?.();
    });
  }
}
