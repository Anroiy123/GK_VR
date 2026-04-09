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

function drawResizedImage(image, width, height, flipY = false) {
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

  if (flipY) {
    context.translate(0, height);
    context.scale(1, -1);
  }

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

function copyTextureTransform(targetTexture, sourceTexture) {
  targetTexture.name = sourceTexture.name;
  targetTexture.mapping = sourceTexture.mapping;
  targetTexture.wrapS = sourceTexture.wrapS;
  targetTexture.wrapT = sourceTexture.wrapT;
  targetTexture.flipY = sourceTexture.flipY;
  targetTexture.rotation = sourceTexture.rotation;
  targetTexture.offset.copy(sourceTexture.offset);
  targetTexture.repeat.copy(sourceTexture.repeat);
  targetTexture.center.copy(sourceTexture.center);

  return targetTexture;
}

function createTextureFromImage(baseTexture, image) {
  return copyTextureTransform(new THREE.Texture(image), baseTexture);
}

async function createResizedTexture(baseTexture, width, height) {
  if (typeof createImageBitmap === "function") {
    try {
      const imageBitmap = await createImageBitmap(baseTexture.image, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
        imageOrientation: baseTexture.flipY ? "flipY" : "none",
      });
      const resizedTexture = createTextureFromImage(baseTexture, imageBitmap);
      resizedTexture.userData.imageBitmap = imageBitmap;
      return resizedTexture;
    } catch (_error) {
      // Fall back to canvas resizing when ImageBitmap resize is unavailable.
    }
  }

  const resizedCanvas = drawResizedImage(
    baseTexture.image,
    width,
    height,
    baseTexture.flipY,
  );
  return copyTextureTransform(
    new THREE.CanvasTexture(resizedCanvas),
    baseTexture,
  );
}

export function getEarthTextureDimensions(
  maxTextureSize,
  devicePixelRatio = 1,
  qualityPreset = "auto",
  sourceWidth = Number.POSITIVE_INFINITY,
  sourceHeight = null,
) {
  const preferredWidth = resolvePreferredWidthByPreset(
    qualityPreset,
    devicePixelRatio,
  );
  const safeSourceWidth =
    Number.isFinite(sourceWidth) && sourceWidth > 0
      ? sourceWidth
      : Number.POSITIVE_INFINITY;

  if (
    Number.isFinite(safeSourceWidth) &&
    safeSourceWidth < preferredWidth &&
    safeSourceWidth <= maxTextureSize
  ) {
    return {
      width: safeSourceWidth,
      height:
        Number.isFinite(sourceHeight) && sourceHeight > 0
          ? sourceHeight
          : safeSourceWidth / 2,
    };
  }

  const width = resolvePreferredWidth(maxTextureSize, preferredWidth);

  return {
    width,
    height: width / 2,
  };
}

export function disposeTexture(texture) {
  if (!texture) {
    return;
  }

  texture.dispose();
  texture.userData?.imageBitmap?.close?.();
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
    baseTexture.image?.width,
    baseTexture.image?.height,
  );
  const needsResize =
    baseTexture.image?.width !== width || baseTexture.image?.height !== height;

  const texture = needsResize
    ? await createResizedTexture(baseTexture, width, height)
    : baseTexture;

  if (needsResize) {
    disposeTexture(baseTexture);
  }

  return configureTexture(texture, maxAnisotropy, colorSpace);
}
