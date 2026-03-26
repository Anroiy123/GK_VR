# Research Report: Earth Texture Sharpness In Three.js

Conducted: 2026-03-19 22:48:06 ICT

## Executive Summary

The current repo is already doing two important things correctly for texture quality: it sets anisotropy to the renderer maximum and uses `LinearMipmapLinearFilter` on power-of-two Earth textures in [Earth.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Earth.js). The main reason the Earth still looks blurry when zoomed in is simpler: the source textures are only `2048x1024`, which is not enough for close inspection on a modern HD/retina display, especially when the globe fills a large part of the screen.

There is no single switch that makes a globe "always sharp" at every zoom level. For far views, mipmaps and anisotropy are the correct tools. For near views, sharpness is limited by source texel density, image compression quality, renderer internal resolution, and eventually the need for LOD or tiled textures. In this repo, the best path is: first upgrade Earth textures to 4K or 8K, then keep current filtering, then clean up texture handling for non-power-of-two assets, and only consider tiled/LOD approaches if you want extreme close-up inspection.

## Research Methodology

- Sources consulted: 4
- Date range of materials: current Three.js documentation/manual pages accessed on 2026-03-19
- Key search terms used: `three.js textures mipmaps anisotropy`, `three.js responsive setPixelRatio`, `Earth globe sharp when zoomed`
- Local code reviewed:
  - [Earth.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Earth.js)
  - [SceneManager.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SceneManager.js)
  - [Controls.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Controls.js)

## Key Findings

### 1. Current Repo State

- `earth_daymap.jpg` is `2048x1024`, `earth_bumpmap.jpg` is `2048x1024`, `earth_nightmap.jpg` is `2047x1024`.
- Earth textures are configured with:
  - `texture.anisotropy = maxAnisotropy`
  - `texture.magFilter = THREE.LinearFilter`
  - `texture.minFilter = THREE.LinearMipmapLinearFilter` only for power-of-two textures
- Renderer already raises internal resolution with `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3))` in [SceneManager.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SceneManager.js).
- Orbit zoom is limited to `minDistance = 3` in [Controls.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Controls.js), so even this moderate zoom can already expose limited source detail on a 2K Earth map.

### 2. Why The Earth Looks Blurry

#### Near zoom

When the globe covers many screen pixels, the renderer must magnify the original texture. Three.js manual explains that magnification uses `magFilter`, and with `LinearFilter` the GPU blends nearby texels for a smoother result. That prevents blocky pixels, but it cannot invent detail that is not present in the source texture.

This is the dominant issue in the repo. A `2048x1024` equirectangular Earth map spreads 2048 horizontal texels across the whole planet. Once a region fills a large screen area, the app simply runs out of source detail.

#### Far zoom / oblique views

Three.js manual recommends mipmaps for minification and notes `LinearMipmapLinearFilter` gives the smoothest high-quality result for textures drawn smaller than their original size. It also documents anisotropy as the fix for blur when the textured surface is viewed at a steep angle.

This repo already uses both for power-of-two textures, so distance blur is partly addressed. The remaining visible softness is likely from source asset quality and not from missing basic filtering.

#### Renderer sharpness

Three.js responsive manual notes higher drawing-buffer resolution makes edges and rendered detail look more crisp on HD-DPI displays. This repo already improves that by setting pixel ratio, so canvas resolution is not the main bottleneck here unless VR mode or performance limits force a lower internal resolution.

### 3. Best Practices

#### A. Increase source texture resolution first

This is the highest-value fix.

- Move Earth albedo/day map from `2048x1024` to at least `4096x2048`
- Prefer `8192x4096` if target devices can afford it
- Match bump/normal and night maps to a sensible level, not necessarily identical to albedo
- Use better-quality source assets, not just larger files with heavy JPG compression

Why: the Three.js manual explicitly states texture quality is bounded by image dimensions and that textures should be as small as possible while still looking as good as needed. Your current maps are below what close zoom usually needs.

#### B. Keep mipmaps and anisotropy

Do not remove the current filtering setup. It is the correct baseline for far/small views.

- `LinearMipmapLinearFilter` is the highest-quality default for minification
- max anisotropy is correct for globe surfaces seen at grazing angles

#### C. Fix the non-power-of-two path

`earth_nightmap.jpg` is `2047x1024`, so current code disables mipmaps for it. That is a quality inconsistency. The safest practical fix is to replace it with a `2048x1024` version. If you keep NPOT assets, re-check whether your actual target path still needs this conservative restriction.

#### D. Raise sharpness by asset format quality, not by filter hacks

- `NearestFilter` will look sharper only in a pixelated, aliased way
- Over-sharpening in shader usually produces halos or noisy lighting
- The correct fix is higher texel density plus correct filtering

#### E. Use compressed GPU textures if you move to 4K or 8K

Larger textures improve close-up detail but increase download time and GPU memory. Three.js supports KTX2/Basis workflows to ship higher-quality assets more efficiently. This becomes important if you upgrade multiple Earth maps and still want good load times on VR/mobile devices.

#### F. Geometry is not the main issue here

`SphereGeometry(..., 64, 64)` is not what makes the map blurry. Higher segment counts can improve silhouette smoothness and lighting interpolation, but they will not restore missing texture detail. Treat geometry increase as secondary.

#### G. For extreme close zoom, move to LOD or tiled textures

If you want "Google Earth style" close inspection, a single 8K texture will still hit a ceiling. The long-term scalable solution is:

- base globe texture for global view
- swap to higher-resolution regional textures by zoom threshold
- or use tiled quadtree/patch-based Earth rendering

This is much more complex than the current app and only justified if close surface inspection is a real feature requirement.

## Comparative Analysis

### Option 1: Keep current code, only replace textures with 4K or 8K

Pros:
- Smallest implementation cost
- Biggest visual improvement for close zoom
- No architecture changes

Cons:
- Higher memory and bandwidth
- Still finite detail limit

### Option 2: Add KTX2 compressed textures with larger source maps

Pros:
- Better balance between sharpness and performance
- Scales better to VR/mobile

Cons:
- Requires asset pipeline changes
- Slightly more setup complexity

### Option 3: Add zoom-based LOD or regional/tiled textures

Pros:
- Best path to keep the globe sharp at many zoom levels
- Scales to very close inspection

Cons:
- Highest complexity by far
- Requires new data structures, streaming logic, and UV/patch strategy

## Implementation Recommendations

### Recommended order for this repo

1. Replace `earth_daymap.jpg` with a true 4K or 8K Earth texture.
2. Replace `earth_bumpmap.jpg` and `earth_nightmap.jpg` with matching quality assets.
3. Make the night map power-of-two, ideally `2048x1024` or `4096x2048`.
4. Keep current anisotropy and mipmap settings.
5. Measure performance in desktop and VR.
6. If performance drops too much, move large textures to KTX2.
7. Only build LOD/tiled rendering if you need very close surface inspection.

### Repo-specific notes

- [Earth.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Earth.js#L8) already contains the right place to centralize texture-quality policy.
- [SceneManager.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/SceneManager.js#L134) already raises pixel ratio, so renderer resolution is not your first fix.
- [Controls.js](C:/Users/hunga/OneDrive/Desktop/project/GK_VR/src/Controls.js#L9) limits orbital zoom, but the texture still needs more detail even within that limit.

## Common Pitfalls

- Expecting anisotropy to fix close-up blur. It mainly helps angled minified textures, not missing source detail.
- Increasing sphere segments to solve texture softness. That addresses mesh smoothness, not texture resolution.
- Using oversized PNG/JPG without checking GPU memory cost.
- Chasing shader sharpening before fixing asset resolution.

## Resources & References

### Official Documentation

- Three.js manual, Textures: https://threejs.org/manual/en/textures.html
- Three.js manual, Responsive Design / HD-DPI: https://threejs.org/manual/en/responsive.html
- Three.js Texture docs: https://threejs.org/docs/api/en/textures/Texture.html
- Three.js WebGLRenderer docs: https://threejs.org/docs/api/en/renderers/WebGLRenderer.html

### Key excerpts summarized

- Three.js manual explains mipmaps are the standard solution for textures drawn smaller than the original image, and `LinearMipmapLinearFilter` gives the smoothest high-quality result.
- The manual also explains `magFilter` only controls how an image is enlarged; it cannot add missing detail.
- The responsive guide explains higher internal drawing-buffer resolution can make the result appear crisper on HD-DPI screens.

## Unresolved Questions

- What is the real target device class: desktop only, mobile, or standalone VR headset?
- How close should the camera be allowed to approach the Earth in final UX?
- Is the goal "visually sharper" or "inspection-grade detail"?
