# Phase 01: Sun Visual Tuning

Status: proposed
Priority: high
Date: 2026-03-24 16:41 ICT

## Overview

This phase updates sun visuals only.
Target files stay small.
No tests added unless requested.

## Current Findings

- [src/Sun.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Sun.js) uses one texture: `public/NewTextures/8k_sun.jpg`
- Surface uses `THREE.MeshBasicMaterial`
- Glow uses 4 additive sprites: inner glow, corona, halo, outer glow
- Renderer uses `THREE.ACESFilmicToneMapping` with exposure `1.2` in [src/SceneManager.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SceneManager.js)
- Sun texture loading does not reuse adaptive texture logic
- Glow brightness is driven mainly by sprite texture alpha stops and sprite opacity

## Design

### Data Structures

Define a single config object in `Sun.js`:

```js
const SUN_VISUALS = {
  surface: {
    detailBoost: number,
    contrast: number,
    emissiveStrength: number,
    flowSpeed: number,
  },
  glow: {
    innerScale: number,
    coronaScale: number,
    haloScale: number,
    outerScale: number,
    innerOpacity: number,
    coronaOpacity: number,
    haloOpacity: number,
    outerOpacity: number,
  },
};
```

Purpose:
- one place to tune brightness/look
- avoids magic numbers spread across constructor/load/update

### Functions / Module Boundaries

Add new module:
- [src/SunShader.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SunShader.js)
  - exports `SunShader.uniforms`
  - exports `SunShader.vertexShader`
  - exports `SunShader.fragmentShader`

Update existing signatures:
- `Sun.load(textureLoader, textureQuality)`
- `loadSunTexture(textureLoader, textureQuality)`

### Surface Rendering Plan

Replace `MeshBasicMaterial` with `ShaderMaterial`.

Shader responsibilities:
- sample the existing sun texture
- boost local high-frequency detail from neighbor luminance
- warm the center slightly
- add small time-based UV drift/distortion so texture feels less static
- clamp output conservatively to avoid harsh clipping
- keep `toneMapped: false` so sun remains self-lit and stable

Minimal uniforms:

```js
{
  sunMap: { value: null },
  texelSize: { value: new THREE.Vector2() },
  time: { value: 0 },
  detailBoost: { value: ... },
  contrast: { value: ... },
  emissiveStrength: { value: ... },
}
```

Implementation note:
- Follow the structure already used by [src/EarthShader.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/EarthShader.js)
- Keep shader small; no noise library, no multi-pass rendering

### Texture Loading Plan

Use the same adaptive texture pipeline already used by Earth/starfield.

Change:
- reuse `loadAdaptiveEquirectangularTexture(...)`
- pass `maxAnisotropy`, `maxTextureSize`, `devicePixelRatio`

Reason:
- consistent quality policy
- avoids hardcoded anisotropy `8`
- keeps the sun texture aligned with renderer/device capabilities

### Glow Brightness Plan

Adjust generated radial textures first, sprite opacity second.

Specific changes:
1. Increase center alpha of `createInnerGlowTexture()`
2. Increase mid-radius alpha of `createHaloTexture()`
3. Increase low-alpha tail of `createOuterGlowTexture()` so the glow reads farther out
4. Slightly enlarge halo/corona scale
5. Keep additive blending
6. Clamp animated opacity to stable upper/lower bounds

Avoid:
- changing renderer exposure globally
- adding `UnrealBloomPass`
- adding more than one extra glow layer unless needed after visual check

## Related Code Files

Modify:
- [src/Sun.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Sun.js)
  - centralize constants
  - switch surface material path
  - update glow tuning
  - update time uniform during animation
- [src/SceneManager.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SceneManager.js)
  - pass `textureQuality` into `this.sun.load(...)`

Create:
- [src/SunShader.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SunShader.js)
  - dedicated compact shader for sun surface

Optional modify:
- [src/AdaptiveTexture.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/AdaptiveTexture.js)
  - only if a generic helper for sun texture dimensions is needed
  - skip if existing function is good enough

## Implementation Steps

1. Add `SunShader.js` with uniforms, vertex shader, fragment shader.
2. Move sun visual numbers in `Sun.js` into one config object.
3. Update `loadSunTexture(...)` to use adaptive texture loading and renderer capability inputs.
4. Replace `MeshBasicMaterial` with `ShaderMaterial`.
5. Wire texture, texel size, and time uniforms.
6. Rebalance inner/corona/halo/outer glow gradients and scales.
7. Update `Sun.update(delta)` to animate shader time and clamp sprite opacity.
8. Update `SceneManager.init()` so `this.sun.load(textureLoader, textureQuality)` passes the quality object.
9. Run app and inspect:
   - far camera
   - near camera
   - bright day side Earth visible in same frame
   - VR if supported

## Pseudocode

```js
// SceneManager.js
await this.sun.load(textureLoader, textureQuality);

// Sun.js
const material = new THREE.ShaderMaterial({
  uniforms: cloneSunUniforms(surfaceTexture),
  vertexShader: SunShader.vertexShader,
  fragmentShader: SunShader.fragmentShader,
  transparent: false,
  toneMapped: false,
});

update(delta) {
  this.elapsedTime += delta;
  this.mesh.material.uniforms.time.value = this.elapsedTime;
  updateGlowSprites();
}
```

## Success Criteria

- Surface texture no longer reads as a plain wrapped JPG
- Surface has visible structure even without adding scene bloom
- Glow halo is clearly brighter than current build
- Earth, atmosphere, moon, starfield keep same overall exposure behavior
- Performance impact is negligible for desktop and acceptable for VR

## Risk Assessment

### Risk: glow becomes washed out

Cause:
- alpha stops pushed too high

Mitigation:
- tune alpha in small increments
- preserve transparent falloff near sprite edges

### Risk: shader looks noisy or fake

Cause:
- overdone UV motion/detail boost

Mitigation:
- keep drift subtle
- avoid procedural noise dependency
- make all boost factors constant-driven

### Risk: texture resize logic mismatches sun use case

Cause:
- current adaptive utility is Earth-oriented by name

Mitigation:
- reuse as-is if behavior is correct
- only generalize names if the change stays small and improves readability

## Performance Notes

- One extra lightweight fragment shader on one sphere is cheap
- No full-screen postprocessing
- No new render passes

## Security Considerations

- No auth/data/security impact
- Only rendering code changes

## Todo

- [ ] Add compact `SunShader`
- [ ] Reuse adaptive texture loading for sun
- [ ] Brighten glow layers
- [ ] Keep changes local to sun rendering
- [ ] Verify scene exposure unchanged elsewhere

## Next Steps

After approval or when switching from planning to implementation:
1. implement shader module
2. patch `Sun.js`
3. patch `SceneManager.js`
4. run visual verification

## Unresolved Questions

- Should the sun keep its current photographic texture look, or move slightly more stylized/plasma-like?
- Is a very bright white core acceptable, or should brightness stay mostly orange/yellow?
