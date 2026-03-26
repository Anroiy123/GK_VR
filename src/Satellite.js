import * as THREE from 'three';

const ORBIT_RADIUS = 2.4; // Earth radius (2.0) + height (0.4)
const INCLINATION = THREE.MathUtils.degToRad(51.6); // ISS orbit inclination
const ORBIT_SPEED = 0.5;

export class Satellite {
  constructor() {
    this.group = new THREE.Group();
    this.angle = 0;
    
    // Create ISS placeholder model
    this.createModel();

    // Tilt the entire orbit group by the inclination
    this.orbitGroup = new THREE.Group();
    this.orbitGroup.rotation.x = INCLINATION;
    this.orbitGroup.add(this.group);
  }

  createModel() {
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xaaaaaa, 
      metalness: 0.8, 
      roughness: 0.2 
    });
    
    // Core module
    const coreGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.1);
    coreGeom.rotateZ(Math.PI / 2);
    const core = new THREE.Mesh(coreGeom, material);
    this.group.add(core);

    // Solar panels
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x2244aa, 
      metalness: 0.9, 
      roughness: 0.1,
      side: THREE.DoubleSide
    });
    const panelGeom = new THREE.PlaneGeometry(0.12, 0.04);
    
    const panel1 = new THREE.Mesh(panelGeom, panelMaterial);
    panel1.position.z = 0.05;
    this.group.add(panel1);

    const panel2 = new THREE.Mesh(panelGeom, panelMaterial);
    panel2.position.z = -0.05;
    this.group.add(panel2);
  }

  update(delta, speedMultiplier) {
    this.angle += ORBIT_SPEED * speedMultiplier * delta;
    
    // Calculate new position on the circular orbit
    const x = Math.cos(this.angle) * ORBIT_RADIUS;
    const z = Math.sin(this.angle) * ORBIT_RADIUS;
    
    this.group.position.set(x, 0, z);

    // Make the satellite face its movement direction
    const nextAngle = this.angle + 0.01;
    const nextX = Math.cos(nextAngle) * ORBIT_RADIUS;
    const nextZ = Math.sin(nextAngle) * ORBIT_RADIUS;
    this.group.lookAt(new THREE.Vector3(nextX, 0, nextZ));
  }

  // Gets the exact world position of the satellite
  getWorldPosition(targetVector) {
    this.group.getWorldPosition(targetVector);
    return targetVector;
  }
}
