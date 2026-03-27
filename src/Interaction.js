import * as THREE from "three";

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
    this.vrControllers = [];
    this.vrControllerGrips = [];
    this.selectedMarker = null;
    this.screenAnchor = new THREE.Vector3();
    this.vrReferenceSpace = null;
    this.vrPanel = null;
    this.vrPanelButtons = [];
    this.vrPanelAnchor = new THREE.Vector3();
    this.vrCameraPosition = new THREE.Vector3();
    this.vrCameraDirection = new THREE.Vector3();
    this.vrCameraRight = new THREE.Vector3();
    this.vrZoomSpeed = 0.08;
    this.vrTurnSpeed = 0.03;
    this.vrInputDebugEl = null;
    this.lastVRClickTarget = "none";
    this.lastVRInputSummary = "idle";
    this.lastVRUpdateError = "none";
    this.lastVRClickTime = 0;
    this.lastVRClickSource = "none";
    this.lastVRRayHit = "none";
    this.vrInputState = {
      aPressed: false,
      bPressed: false,
    };
    this.vrButtonMap = {
      profileKey: "none",
      aIndex: 4,
      bIndex: 5,
    };

    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.onPointerDown.bind(this),
    );
    this.setupVRControllers();
    this.setupVRControlPanel();
    this.setupVRInputDebugOverlay();
  }

  setupVRInputDebugOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "vr-input-debug";
    overlay.setAttribute("aria-live", "polite");
    overlay.style.position = "fixed";
    overlay.style.left = "12px";
    overlay.style.bottom = "12px";
    overlay.style.zIndex = "9999";
    overlay.style.padding = "8px 10px";
    overlay.style.borderRadius = "8px";
    overlay.style.background = "rgba(4, 10, 22, 0.8)";
    overlay.style.border = "1px solid rgba(130, 180, 255, 0.45)";
    overlay.style.color = "#d7ebff";
    overlay.style.font = "12px/1.4 Consolas, 'Courier New', monospace";
    overlay.style.pointerEvents = "none";
    overlay.style.whiteSpace = "pre-wrap";
    overlay.style.maxWidth = "360px";
    overlay.style.display = "none";
    overlay.textContent = "VR input debug";
    document.body.appendChild(overlay);
    this.vrInputDebugEl = overlay;
  }

  updateVRInputDebugOverlay(lines) {
    if (!this.vrInputDebugEl) {
      return;
    }

    if (!this.isVR) {
      this.vrInputDebugEl.style.display = "none";
      return;
    }

    this.vrInputDebugEl.style.display = "block";
    this.vrInputDebugEl.textContent = lines.join("\n");
  }

  clampAxisValue(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(1, Math.max(-1, value));
  }

  setupVRControllers() {
    for (let index = 0; index < 2; index += 1) {
      const controller = this.renderer.xr.getController(index);
      controller.userData.xrHandedness = "none";
      controller.userData.xrConnected = false;

      controller.addEventListener("connected", (event) => {
        controller.userData.xrHandedness = event.data?.handedness ?? "none";
        controller.userData.xrConnected = true;
        controller.userData.xrInputSource = event.data ?? null;
      });

      controller.addEventListener("disconnected", () => {
        controller.userData.xrHandedness = "none";
        controller.userData.xrConnected = false;
        controller.userData.xrInputSource = null;
      });

      controller.addEventListener("selectstart", this.onVRSelect.bind(this));
      this.scene.add(controller);
      this.vrControllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(index);
      this.scene.add(grip);
      this.vrControllerGrips.push(grip);

      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      const laserMaterial = new THREE.LineBasicMaterial({
        color: 0xff0000, // Đèn laser màu đỏ
        transparent: true,
        opacity: 0.7,
      });
      const line = new THREE.Line(geometry, laserMaterial);
      line.name = "line";
      line.scale.z = 5;
      controller.add(line);
    }
  }

  getRightVRController() {
    const session = this.renderer.xr.getSession();
    if (session) {
      const rightSource = Array.from(session.inputSources).find(
        (source) => source?.handedness === "right",
      );

      if (rightSource) {
        const byInputSource = this.vrControllers.find(
          (controller) => controller.userData.xrInputSource === rightSource,
        );

        if (byInputSource) {
          return byInputSource;
        }
      }
    }

    const rightController = this.vrControllers.find(
      (controller) =>
        controller.userData.xrConnected &&
        controller.userData.xrHandedness === "right",
    );

    if (rightController) {
      return rightController;
    }

    if (this.vrControllers[1]) {
      return this.vrControllers[1];
    }

    const connectedController = this.vrControllers.find(
      (controller) => controller.userData.xrConnected,
    );
    return connectedController ?? this.vrControllers[0] ?? null;
  }

  getButtonPressed(gamepad, indices) {
    for (const index of indices) {
      const button = gamepad.buttons?.[index];
      if (button?.pressed || (button?.value ?? 0) > 0.5) {
        return true;
      }
    }

    return false;
  }

  getFirstPressedButtonIndex(gamepad, indices) {
    for (const index of indices) {
      const button = gamepad.buttons?.[index];
      if (button?.pressed || (button?.value ?? 0) > 0.5) {
        return index;
      }
    }

    return -1;
  }

  getDefaultABButtonMapping(profile, handedness, buttonCount) {
    const normalizedProfile = profile.toLowerCase();
    const isQuestProfile =
      normalizedProfile.includes("oculus-touch") ||
      normalizedProfile.includes("meta-quest-touch") ||
      normalizedProfile.includes("touch-plus");
    const isRightHand = handedness === "right";

    // Ưu tiên map nút face button theo runtime phổ biến của Quest 3.
    if (isQuestProfile && isRightHand) {
      if (buttonCount >= 6) {
        return {
          aIndex: 4,
          bIndex: 5,
          aFallback: [3],
          bFallback: [4, 1],
        };
      }

      if (buttonCount >= 5) {
        return {
          aIndex: 3,
          bIndex: 4,
          aFallback: [4],
          bFallback: [5, 1],
        };
      }
    }

    // Tránh dùng trigger (index 0) làm A fallback vì dễ nhầm thao tác bấm cò.
    return {
      aIndex: 3,
      bIndex: 4,
      aFallback: [4],
      bFallback: [5, 1],
    };
  }

  resolveABButtons(gamepad, profile, handedness) {
    const buttonCount = gamepad.buttons?.length ?? 0;
    const mapping = this.getDefaultABButtonMapping(
      profile,
      handedness,
      buttonCount,
    );
    const profileKey = `${profile.toLowerCase()}|${handedness}|${buttonCount}`;

    if (this.vrButtonMap.profileKey !== profileKey) {
      this.vrButtonMap.profileKey = profileKey;
      this.vrButtonMap.aIndex = mapping.aIndex;
      this.vrButtonMap.bIndex = mapping.bIndex;
    }

    const currentA = this.vrButtonMap.aIndex;
    const currentB = this.vrButtonMap.bIndex;

    let aPressed = this.getButtonPressed(gamepad, [currentA]);
    let bPressed = this.getButtonPressed(gamepad, [currentB]);

    if (!aPressed) {
      const fallbackA = this.getFirstPressedButtonIndex(
        gamepad,
        mapping.aFallback.filter((index) => index !== this.vrButtonMap.bIndex),
      );

      if (fallbackA >= 0) {
        this.vrButtonMap.aIndex = fallbackA;
        aPressed = true;
      }
    }

    if (!bPressed) {
      const fallbackB = this.getFirstPressedButtonIndex(
        gamepad,
        mapping.bFallback.filter((index) => index !== this.vrButtonMap.aIndex),
      );

      if (fallbackB >= 0) {
        this.vrButtonMap.bIndex = fallbackB;
        bPressed = true;
      }
    }

    if (this.vrButtonMap.aIndex === this.vrButtonMap.bIndex) {
      bPressed = false;
    }

    return {
      aPressed,
      bPressed,
      mappingLabel: `A=${this.vrButtonMap.aIndex} B=${this.vrButtonMap.bIndex}`,
    };
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
      }),
    );
    panel.add(bg);

    const buttonConfig = [
      { label: "ISS", action: "iss", x: -0.28, y: 0.19 },
      { label: "Mute", action: "mute", x: 0, y: 0.19 },
      { label: "Markers", action: "markers", x: 0.28, y: 0.19 },
      { label: "Bump", action: "bump", x: -0.28, y: 0.02 },
      { label: "Clouds", action: "clouds", x: 0, y: 0.02 },
      { label: "Atmo", action: "atmosphere", x: 0.28, y: 0.02 },
      { label: "Speed -", action: "speedDown", x: -0.18, y: -0.16 },
      { label: "Speed +", action: "speedUp", x: 0.18, y: -0.16 },
      { label: "Sun -", action: "sunDown", x: -0.18, y: -0.31 },
      { label: "Sun +", action: "sunUp", x: 0.18, y: -0.31 },
    ];

    buttonConfig.forEach((config) => {
      const buttonGroup = this.createVRButton(config.label, config.action);
      buttonGroup.position.set(config.x, config.y, 0.01);
      panel.add(buttonGroup);
      // Chỉ đưa hitbox to vào danh sách kiểm tra va chạm
      this.vrPanelButtons.push(buttonGroup.userData.hitMesh);
    });

    this.vrPanel = panel;
    this.scene.add(panel);
  }

  createVRButton(label, action) {
    const parent = new THREE.Group();

    const geometry = new THREE.PlaneGeometry(0.24, 0.11);
    const texture = this.createButtonTexture(label);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);

    // Tạo hitbox tàng hình lớn hơn bình thường để dễ quét laser
    const hitGeometry = new THREE.PlaneGeometry(0.3, 0.16);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    hitMesh.userData.isVRPanelButton = true;
    hitMesh.userData.action = action;
    parent.add(hitMesh);

    parent.userData.hitMesh = hitMesh;

    return parent;
  }

  createButtonTexture(label) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(36, 72, 118, 0.95)";
    ctx.strokeStyle = "rgba(150, 215, 255, 0.95)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 78px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  setVRMode(isActive) {
    this.isVR = isActive;
    this.vrReferenceSpace = isActive
      ? this.renderer.xr.getReferenceSpace()
      : null;
    if (this.vrPanel) {
      this.vrPanel.visible = isActive;
    }

    if (!isActive) {
      this.vrInputState.aPressed = false;
      this.vrInputState.bPressed = false;
      this.lastVRClickTarget = "none";
      this.lastVRInputSummary = "idle";
      this.lastVRUpdateError = "none";
      this.lastVRRayHit = "none";
      this.lastVRClickTime = 0;
      this.lastVRClickSource = "none";
      this.vrButtonMap.profileKey = "none";
      this.vrButtonMap.aIndex = 4;
      this.vrButtonMap.bIndex = 5;
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

  onVRSelect(event) {
    if (!this.isVR) {
      return;
    }

    const activeController = this.getRightVRController();
    if (
      activeController &&
      event?.target &&
      event.target !== activeController
    ) {
      return;
    }

    if (!activeController) {
      return;
    }

    this.handleUnifiedVRClick("selectstart");
  }

  handleUnifiedVRClick(source = "unknown") {
    const now = performance.now();
    const isDuplicateAAfterSelect =
      source === "button-a" &&
      this.lastVRClickSource === "selectstart" &&
      now - this.lastVRClickTime < 120;

    if (isDuplicateAAfterSelect) {
      return false;
    }

    if (!this.refreshVRPanelRayFromRightController()) {
      this.lastVRClickTarget = "no-controller";
      this.lastVRClickTime = now;
      this.lastVRClickSource = source;
      return false;
    }

    if (this.handleVRPanelSelection()) {
      this.lastVRClickTarget = "panel";
      this.lastVRClickTime = now;
      this.lastVRClickSource = source;
      return true;
    }

    this.handleMarkerSelection();
    this.lastVRClickTarget = this.selectedMarker ? "marker" : "none";
    this.lastVRClickTime = now;
    this.lastVRClickSource = source;
    return this.selectedMarker !== null;
  }

  handleVRPanelSelection() {
    if (!this.vrPanel || !this.vrPanel.visible) {
      return false;
    }

    const hits = this.raycaster.intersectObjects(this.vrPanelButtons, false);
    if (!hits.length) {
      this.lastVRRayHit = "panel:none";
      return false;
    }

    const action = hits[0].object.userData.action;
    this.lastVRRayHit = `panel:${action}`;
    this.executeVRAction(action);
    return true;
  }

  executeVRAction(action) {
    if (action === "iss") this.ui.onISSToggle?.();
    if (action === "mute") this.ui.onMuteToggle?.();
    if (action === "markers") this.ui.onMarkersToggle?.();
    if (action === "bump") this.ui.onBumpToggle?.();
    if (action === "clouds") this.ui.onCloudsToggle?.();
    if (action === "atmosphere") this.ui.onAtmosphereToggle?.();
    if (action === "speedDown") this.ui.adjustSpeed(-0.2);
    if (action === "speedUp") this.ui.adjustSpeed(0.2);
    if (action === "sunDown") this.ui.adjustSunlight(-0.1);
    if (action === "sunUp") this.ui.adjustSunlight(0.1);
  }

  getRightControllerInput() {
    const session = this.renderer.xr.getSession();
    if (!session) {
      return {
        turnX: 0,
        zoomY: 0,
        aPressed: false,
        bPressed: false,
        sourceHandedness: "none",
        profile: "none",
        buttonCount: 0,
        pressedButtons: [],
        mappingLabel: "A=- B=-",
      };
    }

    let turnX = 0;
    let zoomY = 0;
    let aPressed = false;
    let bPressed = false;
    let sourceHandedness = "none";
    let profile = "unknown";
    let buttonCount = 0;
    let pressedButtons = [];
    let mappingLabel = "A=- B=-";
    const sources = Array.from(session.inputSources || []);
    const rightController = this.getRightVRController();
    const sourceFromController = rightController?.userData?.xrInputSource;

    const rightSource = sources.find(
      (source) => source?.handedness === "right" && source?.gamepad,
    );
    const fallbackSource = sources.find(
      (source) =>
        source?.targetRayMode === "tracked-pointer" && source?.gamepad,
    );
    const activeSource = sourceFromController?.gamepad
      ? sourceFromController
      : (rightSource ?? fallbackSource ?? null);

    if (!activeSource?.gamepad) {
      return {
        turnX,
        zoomY,
        aPressed,
        bPressed,
        sourceHandedness,
        profile,
        buttonCount,
        pressedButtons,
        mappingLabel,
      };
    }

    const gamepad = activeSource.gamepad;
    const axis0 = this.clampAxisValue(gamepad.axes?.[0] ?? 0);
    const axis1 = this.clampAxisValue(gamepad.axes?.[1] ?? 0);
    const axis2 = this.clampAxisValue(gamepad.axes?.[2] ?? 0);
    const axis3 = this.clampAxisValue(gamepad.axes?.[3] ?? 0);

    // Quest/WebXR có thể đổi cặp trục hoạt động giữa [0,1] và [2,3] tùy runtime.
    // Chọn cặp đang có biên độ lớn hơn để tránh trộn trục gây quay -> zoom sai.
    const pair01Magnitude = Math.hypot(axis0, axis1);
    const pair23Magnitude = Math.hypot(axis2, axis3);
    const usePrimaryPair = pair01Magnitude >= pair23Magnitude;
    const axisX = usePrimaryPair ? axis0 : axis2;
    const axisY = usePrimaryPair ? axis1 : axis3;
    turnX = this.clampAxisValue(axisX);
    zoomY = this.clampAxisValue(axisY);
    sourceHandedness =
      activeSource.handedness ||
      rightController?.userData?.xrHandedness ||
      "none";
    profile = activeSource.profiles?.[0] || "unknown";
    buttonCount = gamepad.buttons?.length ?? 0;
    pressedButtons = (gamepad.buttons || [])
      .map((button, index) => (button?.pressed ? index : -1))
      .filter((index) => index >= 0);

    const resolvedAB = this.resolveABButtons(
      gamepad,
      profile,
      sourceHandedness,
    );
    aPressed = resolvedAB.aPressed;
    bPressed = resolvedAB.bPressed;
    mappingLabel = resolvedAB.mappingLabel;

    return {
      turnX,
      zoomY,
      aPressed,
      bPressed,
      sourceHandedness,
      profile,
      buttonCount,
      pressedButtons,
      mappingLabel,
    };
  }

  refreshVRPanelRayFromRightController() {
    const activeController = this.getRightVRController();
    if (!activeController) {
      return false;
    }

    activeController.updateMatrixWorld(true);

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(activeController.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(
      activeController.matrixWorld,
    );
    this.raycaster.ray.direction
      .set(0, 0, -1)
      .applyMatrix4(tempMatrix)
      .normalize();
    return true;
  }

  updateVRNavigation() {
    try {
      if (!this.vrReferenceSpace) {
        this.vrReferenceSpace = this.renderer.xr.getReferenceSpace();
        if (!this.vrReferenceSpace) {
          return;
        }
      }

      const { turnX, zoomY } = this.getRightControllerInput();
      const turnDeadZone = 0.18;
      const zoomDeadZone = 0.28;
      let turnValue = Math.abs(turnX) > turnDeadZone ? turnX : 0;
      let zoomValue = Math.abs(zoomY) > zoomDeadZone ? zoomY : 0;

      // Nếu người dùng gạt chéo, chỉ giữ trục chiếm ưu thế.
      // Trường hợp biên độ tương đương, ưu tiên quay để tránh zoom ngoài ý muốn.
      const turnAbs = Math.abs(turnValue);
      const zoomAbs = Math.abs(zoomValue);
      const dominanceThreshold = 0.12;

      if (turnAbs > 0 && zoomAbs > 0) {
        if (turnAbs > zoomAbs + dominanceThreshold) {
          zoomValue = 0;
        } else if (zoomAbs > turnAbs + dominanceThreshold) {
          turnValue = 0;
        } else {
          zoomValue = 0;
        }
      }

      if (turnValue === 0 && zoomValue === 0) {
        return;
      }

      const yawStep = this.clampAxisValue(-turnValue) * this.vrTurnSpeed;
      const moveStep = this.clampAxisValue(-zoomValue) * this.vrZoomSpeed;

      // Zoom theo điểm ngay trước mặt headset thay vì trục Z cố định của reference space.
      const xrCamera = this.renderer.xr.getCamera(this.camera);
      xrCamera.getWorldDirection(this.vrCameraDirection);
      this.vrCameraDirection.normalize();

      const zoomOffsetX = -this.vrCameraDirection.x * moveStep;
      const zoomOffsetY = -this.vrCameraDirection.y * moveStep;
      const zoomOffsetZ = -this.vrCameraDirection.z * moveStep;
      const halfYaw = yawStep * 0.5;
      const transform = new XRRigidTransform(
        { x: zoomOffsetX, y: zoomOffsetY, z: zoomOffsetZ },
        { x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) },
      );

      this.vrReferenceSpace =
        this.vrReferenceSpace.getOffsetReferenceSpace(transform);
      this.renderer.xr.setReferenceSpace(this.vrReferenceSpace);
      this.lastVRUpdateError = "none";
    } catch (error) {
      this.lastVRUpdateError =
        error instanceof Error ? error.message : String(error);
      this.vrReferenceSpace = this.renderer.xr.getReferenceSpace() ?? null;
    }
  }

  updateVRPanelButtons() {
    const {
      turnX,
      aPressed,
      bPressed,
      zoomY,
      sourceHandedness,
      profile,
      buttonCount,
      pressedButtons,
      mappingLabel,
    } = this.getRightControllerInput();
    const justPressedA = aPressed && !this.vrInputState.aPressed;
    const justPressedB = bPressed && !this.vrInputState.bPressed;

    if (justPressedA) {
      this.handleUnifiedVRClick("button-a");
    }

    // B Button (Index 5 / 1) dùng để bật/tắt bảng điều khiển
    if (justPressedB && this.vrPanel) {
      this.vrPanel.visible = !this.vrPanel.visible;
      this.lastVRClickTarget = this.vrPanel.visible
        ? "panel-shown"
        : "panel-hidden";
    }

    this.vrInputState.aPressed = aPressed;
    this.vrInputState.bPressed = bPressed;

    this.lastVRInputSummary = `hand=${sourceHandedness} profile=${profile} map=${mappingLabel} axes=[x=${turnX.toFixed(2)},y=${zoomY.toFixed(2)}] buttons=${buttonCount} pressed=[${pressedButtons.join(",")}] A=${aPressed ? 1 : 0} B=${bPressed ? 1 : 0}`;
  }

  updateVRPanelPose() {
    if (!this.vrPanel || !this.vrPanel.visible) {
      return;
    }

    const xrCamera = this.renderer.xr.getCamera(this.camera);
    xrCamera.getWorldPosition(this.vrCameraPosition);
    xrCamera.getWorldDirection(this.vrCameraDirection);
    this.vrCameraDirection.normalize();

    this.vrCameraRight
      .crossVectors(this.vrCameraDirection, new THREE.Vector3(0, 1, 0))
      .normalize();

    // Đưa bảng điều khiển về giữa để dễ bấm như yêu cầu.
    this.vrPanelAnchor
      .copy(this.vrCameraPosition)
      .addScaledVector(this.vrCameraDirection, 1.05)
      .addScaledVector(this.vrCameraRight, 0)
      .addScaledVector(new THREE.Vector3(0, 1, 0), -0.16);

    this.vrPanel.position.copy(this.vrPanelAnchor);
    this.vrPanel.quaternion.copy(xrCamera.quaternion);

    this.vrPanel.scale.set(0.88, 0.88, 0.88);
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

    if (!intersects.length) {
      this.lastVRRayHit = "marker:none";
      return null;
    }

    for (const intersect of intersects) {
      let object = intersect.object;

      while (object.parent && !object.userData.isMarker) {
        object = object.parent;
      }

      if (!object.userData.isMarker || !object.visible) {
        continue;
      }

      // Trong VR, raycast lấy theo tia tay cầm nên không ép marker phải front-facing.
      if (this.isVR || object.userData.isFrontFacing) {
        this.lastVRRayHit = `marker:${object.userData.name ?? "unknown"}`;
        return object;
      }
    }

    this.lastVRRayHit = "marker:filtered";

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

    this.screenAnchor
      .copy(this.selectedMarker.userData.desktopAnchor)
      .project(this.camera);
    const x = (this.screenAnchor.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.screenAnchor.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.setLocationPopupPosition(x, y);
  }

  update() {
    if (this.isVR) {
      try {
        this.updateVRNavigation();
        this.updateVRPanelButtons();
        this.updateVRPanelPose();
      } catch (error) {
        this.lastVRUpdateError =
          error instanceof Error ? error.message : String(error);
      }

      this.updateVRInputDebugOverlay([
        "VR Input Debug",
        this.lastVRInputSummary,
        `ray=${this.lastVRRayHit}`,
        `lastHit=${this.lastVRClickTarget}`,
        `err=${this.lastVRUpdateError}`,
      ]);

      const activeController = this.getRightVRController();
      if (activeController) {
        const line = activeController.getObjectByName("line");
        if (line && line.material) {
          if (this.vrInputState.aPressed) {
            line.material.color.setHex(0x0000ff); // BLUE
          } else if (
            this.lastVRRayHit.startsWith("marker:") &&
            !this.lastVRRayHit.includes("none") &&
            !this.lastVRRayHit.includes("filtered")
          ) {
            line.material.color.setHex(0x00ff00); // GREEN
          } else if (
            this.lastVRRayHit.startsWith("panel:") &&
            !this.lastVRRayHit.includes("none")
          ) {
            line.material.color.setHex(0xffff00); // YELLOW
          } else {
            line.material.color.setHex(0xff0000); // RED
          }
        }
      }
    } else {
      this.updateVRInputDebugOverlay([]);
    }

    if (!this.selectedMarker) {
      return;
    }

    if (
      !this.markersObj.isVisible ||
      (!this.isVR && !this.selectedMarker.userData.isFrontFacing)
    ) {
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
