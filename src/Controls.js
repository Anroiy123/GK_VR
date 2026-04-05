import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Controls {
  constructor(camera, domElement) {
    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 15;
    this.orbit.enablePan = false;
    this.orbit.rotateSpeed = 0.5;
    this.orbit.zoomSpeed = 0.8;
    this.orbit.zoomSpeed = 0.8;
    this.orbit.target.set(0, 0, 0);

    this.camera = camera;
    this.isTracking = false;
    this.trackTarget = null;
  }

  setEnabled(enabled) {
    this.orbit.enabled = enabled;
  }

  setView(position, target) {
    if (position) {
      this.camera.position.copy(position);
    }

    if (target) {
      this.orbit.target.copy(target);
    }

    this.camera.lookAt(this.orbit.target);
    this.orbit.update();
  }

  saveViewState() {
    return {
      position: this.camera.position.clone(),
      target: this.orbit.target.clone(),
      enabled: this.orbit.enabled,
    };
  }

  restoreViewState(viewState) {
    if (!viewState) {
      return;
    }

    this.setView(viewState.position, viewState.target);
    this.setEnabled(viewState.enabled ?? true);
  }

  setTracking(target) {
    if (target) {
      this.isTracking = true;
      this.trackTarget = target;
      this.orbit.enabled = false;
    } else {
      this.isTracking = false;
      this.trackTarget = null;
      this.orbit.enabled = true;
    }
  }

  update() {
    if (this.isTracking && this.trackTarget) {
      const targetPos = new THREE.Vector3();
      this.trackTarget.getWorldPosition(targetPos);
      this.camera.position.copy(targetPos);
      this.camera.lookAt(0, 0, 0);
    } else {
      this.orbit.update();
    }
  }

  dispose() {
    this.orbit.dispose();
  }
}
