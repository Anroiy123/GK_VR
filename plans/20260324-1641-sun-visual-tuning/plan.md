# Sun Visual Tuning Plan

Status: proposed
Date: 2026-03-24 16:41 ICT

## Goal

Make the sun look more convincing.
Fix two issues:
- surface texture feels wrong/flat
- glow halo still too dark

## Context

- Sun rendering lives in [src/Sun.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Sun.js)
- Scene tone mapping and light intensity live in [src/SceneManager.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SceneManager.js)
- Existing shader pattern exists in [src/EarthShader.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/EarthShader.js)
- Existing adaptive texture pipeline exists in [src/AdaptiveTexture.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/AdaptiveTexture.js)
- `docs/development-rules.md` was referenced by the skill but does not exist in this repo

## Recommendation

Use a local sun-only upgrade. Do not change global renderer exposure. Do not add scene-wide bloom.

Recommended implementation:
1. Replace the current sun surface `MeshBasicMaterial` with a small dedicated shader.
2. Keep the current sprite-based glow stack.
3. Rebalance inner glow, corona, halo, outer glow with brighter center and higher opacity.
4. Pass texture quality settings into sun loading so the sun texture follows the same quality policy as Earth/starfield.

## Why this approach

- Fixes texture appearance and glow brightness separately.
- Keeps changes local to the sun.
- Avoids regressions on Earth, atmosphere, moon, and starfield.
- Uses patterns already present in repo: custom shader object + adaptive texture loader.

## Options Considered

### Option A: Only tune current sprite opacities/colors

Pros:
- Smallest diff
- Fastest to ship

Cons:
- Surface still depends on a flat JPG on `MeshBasicMaterial`
- Hard to make the texture feel more alive/correct

### Option B: Small `SunShader` + tune existing glow sprites

Pros:
- Best balance
- Surface can get contrast boost, warm core, subtle animated motion
- Glow can be brighter without touching global exposure

Cons:
- Slightly more code than a pure constants tweak

### Option C: Add postprocessing bloom or raise renderer exposure

Pros:
- Strong brightness increase

Cons:
- Affects whole scene
- More performance cost
- Harder to control in VR

Recommended: Option B

## Phases

1. [phase-01-sun-visual-tuning.md](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/plans/20260324-1641-sun-visual-tuning/phase-01-sun-visual-tuning.md)

## Dependencies

- `Sun.load()` signature change
- `SceneManager.init()` callsite update
- New shader module for sun surface

## Acceptance Criteria

- Sun surface looks more structured and less flat
- Glow reads brighter at a glance
- Earth/background brightness stays effectively unchanged
- No new runtime dependency
- No scene-wide postprocessing added

## Unresolved Questions

- Is the desired target “physically brighter” or “stylized cinematic brighter”?
- Is subtle animated turbulence acceptable on the sun surface, or should it stay nearly static?
