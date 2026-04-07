import * as THREE from "three";

const EQUIRECTANGULAR_WIDTHS = [16384, 8192, 4096, 2048, 1024, 512];
const EARTH_TEXTURE_QUALITY_WIDTHS = {
  auto: null,
  maximum: 16384,
  high: 8192,
  balanced: 4096,
  low: 2048,
};

export const EARTH_TEXTURE_QUALITY_OPTIONS = Object.freeze([
  { id: "auto", label: "Auto" },
  { id: "maximum", label: "Max" },
  { id: "high", label: "High" },
  { id: "balanced", label: "Mid" },
  { id: "low", label: "Low" },
]);

const EARTH_TEXTURE_QUALITY_OPTION_IDS = new Set(
  EARTH_TEXTURE_QUALITY_OPTIONS.map((option) => option.id),
);

export function normalizeEarthTextureQualityPreset(preset) {
  return EARTH_TEXTURE_QUALITY_OPTION_IDS.has(preset) ? preset : "auto";
}

function resolveAutoPreferredWidth(devicePixelRatio) {
  return devicePixelRatio > 1.25 ? 8192 : 4096;
}

function resolvePreferredWidthByPreset(qualityPreset, devicePixelRatio) {
  const preset = normalizeEarthTextureQualityPreset(qualityPreset);
  const presetWidth = EARTH_TEXTURE_QUALITY_WIDTHS[preset];

  if (Number.isFinite(presetWidth)) {
    return presetWidth;
  }

  return resolveAutoPreferredWidth(devicePixelRatio);
}

function resolvePreferredWidth(maxTextureSize, preferredWidth) {
  const safeMaxTextureSize = Number.isFinite(maxTextureSize)
    ? maxTextureSize
    : 2048;
  const safePreferredWidth = Number.isFinite(preferredWidth)
    ? preferredWidth
    : 2048;
  const allowedWidth = Math.min(safeMaxTextureSize, safePreferredWidth);

  return EQUIRECTANGULAR_WIDTHS.find((width) => width <= allowedWidth) ?? 512;
}

function createTextureCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function drawResizedImage(image, width, height) {
  const canvas = createTextureCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error(
      "Unable to create 2D canvas context for texture processing.",
    );
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function configureTexture(texture, maxAnisotropy, colorSpace = null) {
  const { width = 0, height = 0 } = texture.image ?? {};
  const isPowerOfTwoTexture =
    THREE.MathUtils.isPowerOfTwo(width) && THREE.MathUtils.isPowerOfTwo(height);

  if (colorSpace) {
    texture.colorSpace = colorSpace;
  }

  texture.anisotropy = maxAnisotropy;
  texture.magFilter = THREE.LinearFilter;

  if (isPowerOfTwoTexture) {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
  } else {
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }

  texture.needsUpdate = true;

  return texture;
}

function createResizedTexture(baseTexture, width, height) {
  const resizedCanvas = drawResizedImage(baseTexture.image, width, height);
  const resizedTexture = new THREE.CanvasTexture(resizedCanvas);

  resizedTexture.name = baseTexture.name;
  resizedTexture.wrapS = baseTexture.wrapS;
  resizedTexture.wrapT = baseTexture.wrapT;
  resizedTexture.flipY = baseTexture.flipY;

  return resizedTexture;
}

export function getEarthTextureDimensions(
  maxTextureSize,
  devicePixelRatio = 1,
  qualityPreset = "auto",
) {
  const preferredWidth = resolvePreferredWidthByPreset(
    qualityPreset,
    devicePixelRatio,
  );
  const width = resolvePreferredWidth(maxTextureSize, preferredWidth);

  return {
    width,
    height: width / 2,
  };
}

export async function loadAdaptiveEquirectangularTexture(
  textureLoader,
  paths,
  {
    maxAnisotropy,
    maxTextureSize,
    devicePixelRatio = 1,
    qualityPreset = "auto",
    colorSpace = null,
  },
) {
  const candidatePaths = Array.isArray(paths) ? paths : [paths];
  let baseTexture = null;
  let lastError = null;

  for (const path of candidatePaths) {
    try {
      baseTexture = await textureLoader.loadAsync(path);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!baseTexture) {
    throw lastError ?? new Error("Unable to load any candidate texture.");
  }

  const { width, height } = getEarthTextureDimensions(
    maxTextureSize,
    devicePixelRatio,
    qualityPreset,
  );
  const needsResize =
    baseTexture.image?.width !== width || baseTexture.image?.height !== height;

  const texture = needsResize
    ? createResizedTexture(baseTexture, width, height)
    : baseTexture;

  if (needsResize) {
    baseTexture.dispose();
  }

  return configureTexture(texture, maxAnisotropy, colorSpace);
}
