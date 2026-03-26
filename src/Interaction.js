import * as THREE from 'three';

export class Interaction {
  constructor(camera, scene, renderer, markersObj, ui) {
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.markersObj = markersObj;
    this.markersList = markersObj.markersList;
    this.ui = ui;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isVR = false;
    this.vrController = null;
    this.selectedMarker = null;
    this.screenAnchor = new THREE.Vector3();

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.setupVRControllers();
  }

  setupVRControllers() {
    this.vrController = this.renderer.xr.getController(0);
    this.vrController.addEventListener('selectstart', this.onVRSelect.bind(this));
    this.scene.add(this.vrController);

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(geometry);
    line.name = 'line';
    line.scale.z = 5;
    this.vrController.add(line);
  }

  setVRMode(isActive) {
    this.isVR = isActive;
    this.clearSelection();
  }

  onPointerDown(event) {
    if (this.isVR || event.button !== 0) {
      return;
    }

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.handleMarkerSelection();
  }

  onVRSelect() {
    if (!this.isVR) {
      return;
    }

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(this.vrController.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(this.vrController.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    this.handleMarkerSelection();
  }

  handleMarkerSelection() {
    const marker = this.findIntersectedMarker();

    if (!marker) {
      this.clearSelection();
      return;
    }

    if (this.selectedMarker === marker) {
      if (!this.isVR) {
        this.ui.showLocationPopup(marker.userData);
        this.updateDesktopPopupPosition();
      }
      return;
    }

    if (this.selectedMarker) {
      this.markersObj.setMarkerSelected(this.selectedMarker, false);
    }

    this.selectedMarker = marker;
    this.markersObj.setMarkerSelected(marker, true);

    if (this.isVR) {
      this.ui.hideLocationPopup();
    } else {
      this.ui.showLocationPopup(marker.userData);
      this.updateDesktopPopupPosition();
    }
  }

  findIntersectedMarker() {
    const intersects = this.raycaster.intersectObjects(this.markersList, true);

    for (const intersect of intersects) {
      let object = intersect.object;

      while (object.parent && !object.userData.isMarker) {
        object = object.parent;
      }

      if (object.userData.isMarker && object.userData.isFrontFacing && object.visible) {
        return object;
      }
    }

    return null;
  }

  clearSelection() {
    if (this.selectedMarker) {
      this.markersObj.setMarkerSelected(this.selectedMarker, false);
      this.selectedMarker = null;
    }

    this.ui.hideLocationPopup();
    this.markersObj.hideAllVRPanels();
  }

  updateDesktopPopupPosition() {
    if (!this.selectedMarker || this.isVR) {
      return;
    }

    this.screenAnchor.copy(this.selectedMarker.userData.desktopAnchor).project(this.camera);
    const x = (this.screenAnchor.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.screenAnchor.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.setLocationPopupPosition(x, y);
  }

  update() {
    if (!this.selectedMarker) {
      return;
    }

    if (!this.markersObj.isVisible || !this.selectedMarker.userData.isFrontFacing) {
      this.clearSelection();
      return;
    }

    if (this.isVR) {
      this.ui.hideLocationPopup();
      return;
    }

    this.ui.showLocationPopup(this.selectedMarker.userData);
    this.updateDesktopPopupPosition();
  }
}
