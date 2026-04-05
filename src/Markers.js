import * as THREE from "three";

function buildPhotoUrls(keywords, lockBase) {
  const keywordPath = encodeURIComponent(keywords.join(",")).replaceAll(
    "%2C",
    ",",
  );
  return [0, 1, 2].map(
    (index) =>
      `https://loremflickr.com/640/360/${keywordPath}?lock=${lockBase + index}`,
  );
}

const LOCATIONS = [
  {
    name: "Đỉnh Everest",
    lat: 27.9881,
    lon: 86.925,
    desc: "Đỉnh núi cao nhất Trái Đất",
    color: 0xe8f2ff,
    landmarkType: "mountain",
    imageUrls: buildPhotoUrls(["everest", "mountain", "snow"], 10),
  },
  {
    name: "Tokyo",
    lat: 35.6762,
    lon: 139.6503,
    desc: "Siêu đô thị đông dân nhất thế giới",
    color: 0xff6b6b,
    landmarkType: "torii",
    imageUrls: buildPhotoUrls(["tokyo", "street", "japan"], 20),
  },
  {
    name: "New York",
    lat: 40.7128,
    lon: -74.006,
    desc: "Trung tâm tài chính toàn cầu",
    color: 0x66a3ff,
    landmarkType: "skyline",
    imageUrls: buildPhotoUrls(["newyork", "skyline", "city"], 30),
  },
  {
    name: "Paris",
    lat: 48.8566,
    lon: 2.3522,
    desc: "Kinh đô ánh sáng",
    color: 0xffd166,
    landmarkType: "eiffel",
    imageUrls: buildPhotoUrls(["paris", "eiffel", "france"], 40),
  },
  {
    name: "Kim Tự Tháp",
    lat: 29.9792,
    lon: 31.1342,
    desc: "Kỳ quan thế giới cổ đại",
    color: 0xd4a373,
    landmarkType: "pyramid",
    imageUrls: buildPhotoUrls(["pyramid", "desert", "egypt"], 50),
  },
  {
    name: "Amazon",
    lat: -3.4653,
    lon: -62.2159,
    desc: "Lá phổi xanh của Trái Đất",
    color: 0x4caf50,
    landmarkType: "tree",
    imageUrls: buildPhotoUrls(["forest", "jungle", "river"], 60),
  },
  {
    name: "Hà Nội",
    lat: 21.0278,
    lon: 105.8342,
    desc: "Thủ đô nghìn năm văn hiến của Việt Nam",
    color: 0xff8fab,
    landmarkType: "khue-van-cac",
    imageUrls: buildPhotoUrls(["hanoi", "vietnam", "temple"], 70),
  },
];

function shadeColor(hex, offset) {
  const color = new THREE.Color(hex);
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(
    hsl.h,
    Math.max(0, Math.min(1, hsl.s + offset * 0.15)),
    Math.max(0, Math.min(1, hsl.l + offset)),
  );
  return color;
}

function createStandardMaterial(
  color,
  lightnessOffset = 0,
  emissiveBoost = 0.08,
) {
  const shaded = shadeColor(color, lightnessOffset);
  return new THREE.MeshStandardMaterial({
    color: shaded,
    roughness: 0.62,
    metalness: 0.16,
    emissive: shaded.clone().multiplyScalar(emissiveBoost),
    emissiveIntensity: 0.35,
  });
}

function createMesh(geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function createPanelTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createSpriteFromTexture(texture, width, height, depthTest = false) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  return sprite;
}

export class Markers {
  constructor(earthRadius) {
    this.earthRadius = earthRadius;
    this.group = new THREE.Group();
    this.vrOverlayGroup = new THREE.Group();
    this.markersList = [];
    this.isVisible = false;
    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin("anonymous");
    this.loadingCardTexture = this.createImageCardTexture("Đang tải ảnh");
    this.failedCardTexture = this.createImageCardTexture("Không tải được ảnh");
    this.showVRPanels = false;
    this.worldMarkerPosition = new THREE.Vector3();
    this.worldEarthCenter = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.createMarkers();
    this.setVisible(false);
  }

  createMarkers() {
    LOCATIONS.forEach((location, index) => {
      const markerGroup = new THREE.Group();
      const landmark = this.createLandmark(location);
      markerGroup.add(landmark.group);

      const basePosition = this.latLonToVector3(
        location.lat,
        location.lon,
        this.earthRadius,
      );
      markerGroup.position.copy(basePosition);
      markerGroup.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        basePosition.clone().normalize(),
      );

      const label = this.createTextSprite(location.name, 30);
      label.position.set(0, landmark.height + 0.12, 0);
      markerGroup.add(label);

      const vrPanel = this.createVRPanel(location);
      this.vrOverlayGroup.add(vrPanel);

      markerGroup.userData = {
        ...location,
        isMarker: true,
        labelSprite: label,
        landmarkGroup: landmark.group,
        materials: landmark.materials,
        landmarkHeight: landmark.height,
        basePosition,
        phaseOffset: index * 0.8,
        desktopAnchor: new THREE.Vector3(),
        surfaceNormal: new THREE.Vector3(),
        vrPanel,
        isFrontFacing: true,
        isSelected: false,
      };

      this.markersList.push(markerGroup);
      this.group.add(markerGroup);
    });
  }

  createLandmark(location) {
    const type = location.landmarkType;

    if (type === "mountain") return this.createMountain(location.color);
    if (type === "torii") return this.createTorii(location.color);
    if (type === "skyline") return this.createSkyline(location.color);
    if (type === "eiffel") return this.createEiffelTower(location.color);
    if (type === "pyramid") return this.createPyramid(location.color);
    if (type === "tree") return this.createTree(location.color);

    return this.createKhueVanCac(location.color);
  }

  createMountain(color) {
    const group = new THREE.Group();
    const rockMaterial = createStandardMaterial(color, -0.04, 0.05);
    const ridgeMaterial = createStandardMaterial(color, 0.14, 0.07);
    const snowMaterial = createStandardMaterial(0xffffff, 0.05, 0.03);

    const base = createMesh(
      new THREE.ConeGeometry(0.075, 0.18, 6),
      rockMaterial,
      0,
      0.09,
      0,
    );
    base.rotation.y = Math.PI / 6;
    const ridge = createMesh(
      new THREE.ConeGeometry(0.05, 0.14, 5),
      ridgeMaterial,
      0.04,
      0.09,
      -0.02,
    );
    ridge.rotation.z = -0.18;
    const snow = createMesh(
      new THREE.ConeGeometry(0.028, 0.05, 5),
      snowMaterial,
      0.012,
      0.165,
      0.002,
    );

    group.add(base, ridge, snow);
    return {
      group,
      materials: [rockMaterial, ridgeMaterial, snowMaterial],
      height: 0.22,
    };
  }

  createTorii(color) {
    const group = new THREE.Group();
    const pillarMaterial = createStandardMaterial(color, 0, 0.08);
    const beamMaterial = createStandardMaterial(color, 0.1, 0.1);
    const accentMaterial = createStandardMaterial(0x1d1d1d, 0, 0.03);

    const leftPillar = createMesh(
      new THREE.BoxGeometry(0.022, 0.16, 0.022),
      pillarMaterial,
      -0.055,
      0.08,
      0,
    );
    const rightPillar = createMesh(
      new THREE.BoxGeometry(0.022, 0.16, 0.022),
      pillarMaterial,
      0.055,
      0.08,
      0,
    );
    const topBeam = createMesh(
      new THREE.BoxGeometry(0.16, 0.024, 0.032),
      beamMaterial,
      0,
      0.165,
      0,
    );
    const midBeam = createMesh(
      new THREE.BoxGeometry(0.12, 0.018, 0.026),
      beamMaterial,
      0,
      0.13,
      0,
    );
    const tie = createMesh(
      new THREE.BoxGeometry(0.032, 0.05, 0.018),
      accentMaterial,
      0,
      0.11,
      0,
    );

    group.add(leftPillar, rightPillar, topBeam, midBeam, tie);
    return {
      group,
      materials: [pillarMaterial, beamMaterial, accentMaterial],
      height: 0.23,
    };
  }

  createSkyline(color) {
    const group = new THREE.Group();
    const towerMaterial = createStandardMaterial(color, -0.02, 0.08);
    const glassMaterial = createStandardMaterial(color, 0.14, 0.11);
    const torchMaterial = createStandardMaterial(0xffd166, 0.08, 0.18);

    const left = createMesh(
      new THREE.BoxGeometry(0.045, 0.13, 0.04),
      towerMaterial,
      -0.05,
      0.065,
      0,
    );
    const center = createMesh(
      new THREE.BoxGeometry(0.05, 0.19, 0.04),
      glassMaterial,
      0.005,
      0.095,
      0,
    );
    const right = createMesh(
      new THREE.BoxGeometry(0.038, 0.11, 0.036),
      towerMaterial,
      0.055,
      0.055,
      0,
    );
    const torchStem = createMesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8),
      torchMaterial,
      -0.01,
      0.17,
      0.028,
    );
    const torchFlame = createMesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      torchMaterial,
      -0.01,
      0.222,
      0.028,
    );
    torchFlame.scale.set(0.7, 1.15, 0.7);

    group.add(left, center, right, torchStem, torchFlame);
    return {
      group,
      materials: [towerMaterial, glassMaterial, torchMaterial],
      height: 0.26,
    };
  }

  createEiffelTower(color) {
    const group = new THREE.Group();
    const frameMaterial = createStandardMaterial(color, -0.02, 0.08);
    const accentMaterial = createStandardMaterial(color, 0.12, 0.1);

    const legGeometry = new THREE.BoxGeometry(0.014, 0.16, 0.014);
    const leg1 = createMesh(legGeometry, frameMaterial, -0.038, 0.08, -0.02);
    leg1.rotation.z = 0.22;
    const leg2 = createMesh(legGeometry, frameMaterial, 0.038, 0.08, -0.02);
    leg2.rotation.z = -0.22;
    const leg3 = createMesh(legGeometry, frameMaterial, -0.024, 0.08, 0.024);
    leg3.rotation.z = 0.16;
    const leg4 = createMesh(legGeometry, frameMaterial, 0.024, 0.08, 0.024);
    leg4.rotation.z = -0.16;
    const lowerBeam = createMesh(
      new THREE.BoxGeometry(0.11, 0.018, 0.022),
      accentMaterial,
      0,
      0.09,
      0,
    );
    const midTower = createMesh(
      new THREE.BoxGeometry(0.038, 0.1, 0.028),
      frameMaterial,
      0,
      0.17,
      0,
    );
    const topTower = createMesh(
      new THREE.BoxGeometry(0.018, 0.07, 0.018),
      accentMaterial,
      0,
      0.245,
      0,
    );
    const spire = createMesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8),
      accentMaterial,
      0,
      0.305,
      0,
    );

    group.add(leg1, leg2, leg3, leg4, lowerBeam, midTower, topTower, spire);
    return { group, materials: [frameMaterial, accentMaterial], height: 0.33 };
  }

  createPyramid(color) {
    const group = new THREE.Group();
    const stoneMaterial = createStandardMaterial(color, 0.02, 0.05);
    const shadowMaterial = createStandardMaterial(color, -0.08, 0.04);

    const main = createMesh(
      new THREE.ConeGeometry(0.085, 0.16, 4),
      stoneMaterial,
      0,
      0.08,
      0,
    );
    main.rotation.y = Math.PI / 4;
    const side = createMesh(
      new THREE.ConeGeometry(0.048, 0.095, 4),
      shadowMaterial,
      0.055,
      0.05,
      0.03,
    );
    side.rotation.y = Math.PI / 5;

    group.add(main, side);
    return { group, materials: [stoneMaterial, shadowMaterial], height: 0.2 };
  }

  createTree(color) {
    const group = new THREE.Group();
    const trunkMaterial = createStandardMaterial(0x7a4e2d, 0.02, 0.05);
    const canopyMaterial = createStandardMaterial(color, 0.08, 0.1);
    const canopyShadowMaterial = createStandardMaterial(color, -0.04, 0.08);

    const trunk = createMesh(
      new THREE.CylinderGeometry(0.014, 0.02, 0.12, 10),
      trunkMaterial,
      0,
      0.06,
      0,
    );
    const canopy = createMesh(
      new THREE.SphereGeometry(0.07, 18, 18),
      canopyMaterial,
      0,
      0.14,
      0,
    );
    canopy.scale.set(1.1, 0.9, 1.1);
    const canopyTop = createMesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      canopyShadowMaterial,
      0.02,
      0.19,
      -0.01,
    );

    group.add(trunk, canopy, canopyTop);
    return {
      group,
      materials: [trunkMaterial, canopyMaterial, canopyShadowMaterial],
      height: 0.25,
    };
  }

  createKhueVanCac(color) {
    const group = new THREE.Group();
    const baseMaterial = createStandardMaterial(0xe7d7c5, 0.04, 0.03);
    const frameMaterial = createStandardMaterial(color, 0.02, 0.08);
    const roofMaterial = createStandardMaterial(color, -0.05, 0.1);

    const base = createMesh(
      new THREE.BoxGeometry(0.12, 0.04, 0.08),
      baseMaterial,
      0,
      0.02,
      0,
    );
    const pillarGeometry = new THREE.BoxGeometry(0.016, 0.09, 0.016);
    const leftFront = createMesh(
      pillarGeometry,
      frameMaterial,
      -0.036,
      0.085,
      0.022,
    );
    const rightFront = createMesh(
      pillarGeometry,
      frameMaterial,
      0.036,
      0.085,
      0.022,
    );
    const leftBack = createMesh(
      pillarGeometry,
      frameMaterial,
      -0.036,
      0.085,
      -0.022,
    );
    const rightBack = createMesh(
      pillarGeometry,
      frameMaterial,
      0.036,
      0.085,
      -0.022,
    );
    const beam = createMesh(
      new THREE.BoxGeometry(0.1, 0.02, 0.065),
      frameMaterial,
      0,
      0.135,
      0,
    );
    const roof = createMesh(
      new THREE.ConeGeometry(0.082, 0.07, 4),
      roofMaterial,
      0,
      0.18,
      0,
    );
    roof.rotation.y = Math.PI / 4;

    group.add(base, leftFront, rightFront, leftBack, rightBack, beam, roof);
    return {
      group,
      materials: [baseMaterial, frameMaterial, roofMaterial],
      height: 0.26,
    };
  }

  latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
  }

  createTextSprite(text, fontSize) {
    const texture = createPanelTexture(512, 128, (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `700 ${fontSize}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 14;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(text, width / 2, height / 2 + 4);
      ctx.fillText(text, width / 2, height / 2 + 4);
    });
    const sprite = createSpriteFromTexture(texture, 0.74, 0.19, true);
    sprite.renderOrder = 2;
    return sprite;
  }

  createInfoTexture(title, desc) {
    return createPanelTexture(1024, 320, (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#9fd0ff";
      ctx.font = "700 78px Segoe UI";
      ctx.textBaseline = "top";
      ctx.fillText(title, 48, 32);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "500 46px Segoe UI";
      this.drawMultilineText(ctx, desc, 48, 150, width - 96, 56, 2);
    });
  }

  createPanelBackgroundTexture() {
    return createPanelTexture(1024, 768, (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(3, 9, 22, 0.82)";
      ctx.strokeStyle = "rgba(129, 190, 255, 0.5)";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.roundRect(18, 18, width - 36, height - 36, 48);
      ctx.fill();
      ctx.stroke();
    });
  }

  createImageCardTexture(text) {
    return createPanelTexture(512, 320, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#12233b");
      gradient.addColorStop(1, "#223f5f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 12;
      ctx.strokeRect(16, 16, width - 32, height - 32);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.font = "600 36px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, width / 2, height / 2);
    });
  }

  createVRPanel(location) {
    const panel = new THREE.Group();
    panel.visible = false;

    const background = createSpriteFromTexture(
      this.createPanelBackgroundTexture(),
      1.16,
      0.82,
    );
    background.center.set(0.5, 0.5);
    panel.add(background);

    const info = createSpriteFromTexture(
      this.createInfoTexture(location.name, location.desc),
      0.98,
      0.3,
    );
    info.position.set(0, 0.21, 0.02);
    panel.add(info);

    const imageOffsets = [-0.32, 0, 0.32];
    const imageSlots = imageOffsets.map((offsetX) => {
      const sprite = createSpriteFromTexture(
        this.loadingCardTexture,
        0.28,
        0.18,
      );
      sprite.position.set(offsetX, -0.15, 0.02);
      panel.add(sprite);
      return sprite;
    });

    panel.userData.imageSlots = imageSlots;
    panel.userData.imagesRequested = false;
    return panel;
  }

  drawMultilineText(ctx, text, startX, startY, maxWidth, lineHeight, maxLines) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    lines.slice(0, maxLines).forEach((line, index) => {
      ctx.fillText(line, startX, startY + index * lineHeight);
    });
  }

  ensureVRPanelImages(marker) {
    const { vrPanel, imageUrls } = marker.userData;
    if (vrPanel.userData.imagesRequested) {
      return;
    }

    vrPanel.userData.imagesRequested = true;
    vrPanel.userData.imageSlots.forEach((slot, index) => {
      const material = slot.material;
      const imageUrl = imageUrls[index];

      this.textureLoader.load(
        imageUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        () => {
          material.map = this.failedCardTexture;
          material.needsUpdate = true;
        },
      );
    });
  }

  setMarkerSelected(marker, isSelected) {
    marker.userData.isSelected = isSelected;
    const targetScale = isSelected ? 1.12 : 1;
    marker.userData.landmarkGroup.scale.setScalar(targetScale);
    marker.userData.materials.forEach((material) => {
      material.emissiveIntensity = isSelected ? 0.85 : 0.35;
    });

    if (!isSelected) {
      marker.userData.vrPanel.visible = false;
    } else if (this.showVRPanels) {
      this.ensureVRPanelImages(marker);
    }
  }

  hideAllPopups() {
    this.markersList.forEach((marker) => {
      this.setMarkerSelected(marker, false);
    });
  }

  hideAllVRPanels() {
    this.markersList.forEach((marker) => {
      marker.userData.vrPanel.visible = false;
    });
  }

  setVRPanelMode(isEnabled) {
    this.showVRPanels = isEnabled;

    if (!isEnabled) {
      this.hideAllVRPanels();
    }
  }

  update(timestamp, camera) {
    if (!this.group.parent) {
      return;
    }

    this.group.parent.getWorldPosition(this.worldEarthCenter);
    camera.getWorldPosition(this.cameraDirection);
    this.cameraDirection.sub(this.worldEarthCenter).normalize();

    this.markersList.forEach((marker) => {
      const sinWave =
        Math.sin(timestamp * 0.0025 + marker.userData.phaseOffset) * 0.006;
      const normal = marker.userData.basePosition.clone().normalize();
      marker.position.copy(
        marker.userData.basePosition
          .clone()
          .add(normal.multiplyScalar(sinWave)),
      );

      marker.getWorldPosition(this.worldMarkerPosition);
      marker.userData.surfaceNormal
        .copy(this.worldMarkerPosition)
        .sub(this.worldEarthCenter)
        .normalize();
      marker.userData.isFrontFacing =
        this.isVisible &&
        marker.userData.surfaceNormal.dot(this.cameraDirection) > 0;
      marker.userData.labelSprite.visible = marker.userData.isFrontFacing;

      marker.userData.desktopAnchor
        .copy(this.worldMarkerPosition)
        .addScaledVector(
          marker.userData.surfaceNormal,
          marker.userData.landmarkHeight + 0.3,
        );

      const vrPanel = marker.userData.vrPanel;
      if (this.showVRPanels && marker.userData.isSelected && this.isVisible) {
        vrPanel.position
          .copy(marker.userData.desktopAnchor)
          .addScaledVector(marker.userData.surfaceNormal, 0.12);
        vrPanel.visible = true;
      } else {
        vrPanel.visible = false;
      }
    });
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    this.group.visible = isVisible;
    this.vrOverlayGroup.visible = isVisible;

    if (!isVisible) {
      this.hideAllPopups();
      this.hideAllVRPanels();
    }
  }

  toggleVisibility() {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }
}
