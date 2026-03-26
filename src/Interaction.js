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
    this.vrControllerGrip = null;
    this.selectedMarker = null;
    this.screenAnchor = new THREE.Vector3();
    this.vrReferenceSpace = null;
    this.vrPanel = null;
    this.vrPanelButtons = [];
    this.vrPanelAnchor = new THREE.Vector3();
    this.vrCameraPosition = new THREE.Vector3();
    this.vrCameraDirection = new THREE.Vector3();
    this.vrCameraRight = new THREE.Vector3();
    this.vrPanelInputCooldown = 0;
    this.vrMoveSpeed = 0.08;
    this.vrTurnSpeed = 0.03;

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.setupVRControllers();
    this.setupVRControlPanel();
  }

  setupVRControllers() {
    this.vrController = this.renderer.xr.getController(0);
    this.vrController.addEventListener('selectstart', this.onVRSelect.bind(this));
    this.scene.add(this.vrController);

    this.vrControllerGrip = this.renderer.xr.getControllerGrip(0);
    this.scene.add(this.vrControllerGrip);

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(geometry);
    line.name = 'line';
    line.scale.z = 5;
    this.vrController.add(line);
  }

  setupVRControlPanel() {
    const panel = new THREE.Group();
    panel.visible = false;

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.72),
      new THREE.MeshBasicMaterial({
        color: 0x08101f,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      })
    );
    panel.add(bg);

    const buttonConfig = [
      { label: 'ISS', action: 'iss', x: -0.28, y: 0.19 },
      { label: 'Mute', action: 'mute', x: 0, y: 0.19 },
      { label: 'Markers', action: 'markers', x: 0.28, y: 0.19 },
      { label: 'Bump', action: 'bump', x: -0.28, y: 0.02 },
      { label: 'Clouds', action: 'clouds', x: 0, y: 0.02 },
      { label: 'Atmo', action: 'atmosphere', x: 0.28, y: 0.02 },
      { label: 'Speed -', action: 'speedDown', x: -0.18, y: -0.16 },
      { label: 'Speed +', action: 'speedUp', x: 0.18, y: -0.16 },
      { label: 'Sun -', action: 'sunDown', x: -0.18, y: -0.31 },
      { label: 'Sun +', action: 'sunUp', x: 0.18, y: -0.31 },
    ];

    buttonConfig.forEach((config) => {
      const button = this.createVRButton(config.label, config.action);
      button.position.set(config.x, config.y, 0.01);
      panel.add(button);
      this.vrPanelButtons.push(button);
    });

    this.vrPanel = panel;
    this.scene.add(panel);
  }

  createVRButton(label, action) {
    const geometry = new THREE.PlaneGeometry(0.24, 0.11);
    const texture = this.createButtonTexture(label);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isVRPanelButton = true;
    mesh.userData.action = action;
    return mesh;
  }

  createButtonTexture(label) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(36, 72, 118, 0.95)';
    ctx.strokeStyle = 'rgba(150, 215, 255, 0.95)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 78px Segoe UI';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  setVRMode(isActive) {
    this.isVR = isActive;
    this.vrReferenceSpace = isActive ? this.renderer.xr.getReferenceSpace() : null;
    if (this.vrPanel) {
      this.vrPanel.visible = isActive;
    }
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

    if (this.handleVRPanelSelection()) {
      return;
    }

    this.handleMarkerSelection();
  }

  handleVRPanelSelection() {
    if (!this.vrPanel || !this.vrPanel.visible) {
      return false;
    }

    const hits = this.raycaster.intersectObjects(this.vrPanelButtons, false);
    if (!hits.length) {
      return false;
    }

    const action = hits[0].object.userData.action;
    this.executeVRAction(action);
    return true;
  }

  executeVRAction(action) {
    if (action === 'iss') this.ui.onISSToggle?.();
    if (action === 'mute') this.ui.onMuteToggle?.();
    if (action === 'markers') this.ui.onMarkersToggle?.();
    if (action === 'bump') this.ui.onBumpToggle?.();
    if (action === 'clouds') this.ui.onCloudsToggle?.();
    if (action === 'atmosphere') this.ui.onAtmosphereToggle?.();
    if (action === 'speedDown') this.ui.adjustSpeed(-0.2);
    if (action === 'speedUp') this.ui.adjustSpeed(0.2);
    if (action === 'sunDown') this.ui.adjustSunlight(-0.1);
    if (action === 'sunUp') this.ui.adjustSunlight(0.1);
  }

  getControllerAxes() {
    const session = this.renderer.xr.getSession();
    if (!session) {
      return { moveY: 0, turnX: 0 };
    }

    let moveY = 0;
    let turnX = 0;

    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad || !gamepad.axes || gamepad.axes.length < 2) {
        continue;
      }

      const axisY = gamepad.axes[3] ?? gamepad.axes[1] ?? 0;
      const axisX = gamepad.axes[2] ?? gamepad.axes[0] ?? 0;

      if (source.handedness === 'left') {
        moveY = axisY;
      } else if (source.handedness === 'right') {
        turnX = axisX;
      } else {
        moveY = axisY;
        turnX = axisX;
      }
    }

    return { moveY, turnX };
  }

  updateVRNavigation() {
    if (!this.vrReferenceSpace) {
      this.vrReferenceSpace = this.renderer.xr.getReferenceSpace();
      if (!this.vrReferenceSpace) {
        return;
      }
    }

    const { moveY, turnX } = this.getControllerAxes();
    const deadZone = 0.2;
    const moveValue = Math.abs(moveY) > deadZone ? moveY : 0;
    const turnValue = Math.abs(turnX) > deadZone ? turnX : 0;

    if (moveValue === 0 && turnValue === 0) {
      return;
    }

    const moveStep = -moveValue * this.vrMoveSpeed;
    const turnStep = -turnValue * this.vrTurnSpeed;

    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turnStep);
    const transform = new XRRigidTransform(
      { x: 0, y: 0, z: moveStep },
      { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
    );

    this.vrReferenceSpace = this.vrReferenceSpace.getOffsetReferenceSpace(transform);
    this.renderer.xr.setReferenceSpace(this.vrReferenceSpace);
  }

  updateVRPanelPose() {
    if (!this.vrPanel || !this.vrPanel.visible) {
      return;
    }

    const xrCamera = this.renderer.xr.getCamera(this.camera);
    xrCamera.getWorldPosition(this.vrCameraPosition);
    xrCamera.getWorldDirection(this.vrCameraDirection);
    this.vrCameraDirection.normalize();

    this.vrCameraRight.crossVectors(this.vrCameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

    this.vrPanelAnchor
      .copy(this.vrCameraPosition)
      .addScaledVector(this.vrCameraDirection, 1.1)
      .addScaledVector(this.vrCameraRight, 0.5);

    this.vrPanel.position.copy(this.vrPanelAnchor);
    this.vrPanel.quaternion.copy(xrCamera.quaternion);
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
    if (this.isVR) {
      this.updateVRNavigation();
      this.updateVRPanelPose();
    }

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
