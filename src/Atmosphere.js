import * as THREE from 'three';

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

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(viewPosition - vWorldPosition);
    vec3 sunDir = normalize(sunPosition - vWorldPosition);

    float viewDot = max(dot(vNormal, viewDir), 0.0);
    float sunDot = dot(vNormal, sunDir);

    float dayMask = smoothstep(-0.2, 0.95, sunDot);
    float limbMask = pow(1.0 - viewDot, 1.8);
    float hazeMask = smoothstep(0.0, 1.0, limbMask);

    vec3 baseBlue = vec3(0.56, 0.72, 0.98);
    vec3 brightBlue = vec3(0.84, 0.92, 1.0);
    vec3 shadowBlue = vec3(0.24, 0.34, 0.55);

    vec3 dayColor = mix(shadowBlue, baseBlue, dayMask);
    vec3 color = mix(dayColor, brightBlue, hazeMask * 0.45);

    float shellAlpha = mix(0.02, 0.12, dayMask);
    float limbAlpha = hazeMask * mix(0.02, 0.12, dayMask);
    float alpha = clamp(shellAlpha + limbAlpha, 0.0, 0.22);

    gl_FragColor = vec4(color, alpha);
  }
`;

export class Atmosphere {
  constructor() {
    this.mesh = null;
    this.isVisible = true;
  }

  create(camera) {
    const geometry = new THREE.SphereGeometry(ATMO_RADIUS, SEGMENTS, SEGMENTS);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        sunPosition: { value: new THREE.Vector3(5, 3, 5) },
        viewPosition: { value: camera.position.clone() },
      },
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = this.isVisible;
    return this.mesh;
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
