import { VRButton } from "three/addons/webxr/VRButton.js";

export class WebXRSetup {
  constructor(renderer) {
    this.renderer = renderer;
    this.isPresenting = false;
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.spawnDistance = 6;
  }

  init() {
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local-floor");

    const vrButton = VRButton.createButton(this.renderer);
    document.body.appendChild(vrButton);

    this.renderer.xr.addEventListener("sessionstart", () => {
      this.applySpawnOffset();
      this.isPresenting = true;
      document.body.classList.add("vr-active");
      this.onSessionStart?.();
    });

    this.renderer.xr.addEventListener("sessionend", () => {
      this.isPresenting = false;
      document.body.classList.remove("vr-active");
      this.onSessionEnd?.();
    });
  }

  applySpawnOffset() {
    const baseReferenceSpace = this.renderer.xr.getReferenceSpace();

    if (!baseReferenceSpace) {
      return;
    }

    // Move viewer away from origin so Earth stays in front instead of at the headset position.
    const offset = new XRRigidTransform({ x: 0, y: 0, z: -this.spawnDistance });
    const shiftedReferenceSpace =
      baseReferenceSpace.getOffsetReferenceSpace(offset);
    this.renderer.xr.setReferenceSpace(shiftedReferenceSpace);
  }
}
