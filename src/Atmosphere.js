import * as THREE from 'three';
import { DEFAULT_SUN_PRESET } from "./SunPresets.js";

const ATMO_RADIUS = 2.055;
const SEGMENTS = 64;

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform vec3 sunPosition;
  uniform vec3 viewPosition;
  uniform float hazeStrength;
  uniform float dayEdge;
  uniform float sunHaloIntensity;
  uniform float sunHaloTightness;
  uniform float alphaMax;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(viewPosition - vWorldPosition);
    vec3 sunDir = normalize(sunPosition - vWorldPosition);

    float viewDot = max(dot(vNormal, viewDir), 0.0);
    float sunDot = dot(vNormal, sunDir);

    float dayMask = smoothstep(-0.2, dayEdge, sunDot);
    float limbMask = pow(1.0 - viewDot, 1.8);
    float hazeMask = smoothstep(0.0, 1.0, limbMask);
    float sunHalo = pow(max(sunDot, 0.0), sunHaloTightness);

    vec3 baseBlue = vec3(0.56, 0.72, 0.98);
    vec3 brightBlue = vec3(0.84, 0.92, 1.0);
    vec3 shadowBlue = vec3(0.24, 0.34, 0.55);
    vec3 sunTint = vec3(1.0, 0.9, 0.75);

    vec3 dayColor = mix(shadowBlue, baseBlue, dayMask);
    vec3 color = mix(dayColor, brightBlue, hazeMask * hazeStrength);
    color += sunTint * sunHalo * sunHaloIntensity;

    float shellAlpha = mix(0.02, 0.12, dayMask);
    float limbAlpha = hazeMask * mix(0.02, 0.12, dayMask);
    float haloAlpha = sunHalo * sunHaloIntensity * 0.08;
    float alpha = clamp(shellAlpha + limbAlpha + haloAlpha, 0.0, alphaMax);

    gl_FragColor = vec4(color, alpha);
  }
`;

export class Atmosphere {
  constructor() {
    this.mesh = null;
    this.isVisible = true;
    this.preset = DEFAULT_SUN_PRESET;
  }

  create(camera) {
    const geometry = new THREE.SphereGeometry(ATMO_RADIUS, SEGMENTS, SEGMENTS);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        sunPosition: { value: new THREE.Vector3(5, 3, 5) },
        viewPosition: { value: camera.position.clone() },
        hazeStrength: { value: this.preset.atmosphere.hazeStrength },
        dayEdge: { value: this.preset.atmosphere.dayEdge },
        sunHaloIntensity: { value: this.preset.atmosphere.sunHaloIntensity },
        sunHaloTightness: { value: this.preset.atmosphere.sunHaloTightness },
        alphaMax: { value: this.preset.atmosphere.alphaMax },
      },
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = this.isVisible;
    this.applyPreset(this.preset);
    return this.mesh;
  }

  applyPreset(preset) {
    this.preset = preset ?? DEFAULT_SUN_PRESET;

    if (!this.mesh) return;

    const { atmosphere } = this.preset;
    this.mesh.material.uniforms.hazeStrength.value = atmosphere.hazeStrength;
    this.mesh.material.uniforms.dayEdge.value = atmosphere.dayEdge;
    this.mesh.material.uniforms.sunHaloIntensity.value = atmosphere.sunHaloIntensity;
    this.mesh.material.uniforms.sunHaloTightness.value = atmosphere.sunHaloTightness;
    this.mesh.material.uniforms.alphaMax.value = atmosphere.alphaMax;
  }

  update(camera, sunPosition) {
    if (!this.mesh) return;
    this.mesh.material.uniforms.viewPosition.value.copy(camera.position);
    if (sunPosition) {
      this.mesh.material.uniforms.sunPosition.value.copy(sunPosition);
    }
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;

    if (!this.mesh) return;
    this.mesh.visible = isVisible;
  }

  toggleVisibility() {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  dispose() {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
