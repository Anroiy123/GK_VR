import * as THREE from 'three';

export class Moon {
  constructor(radius = 0.5) {
    this.mesh = null;
    this.radius = radius;
    this.group = new THREE.Group();
    // Quay mặt trăng một góc cố định để lock đồng bộ (tidally locked) -> mặt trăng luôn hướng 1 mặt về trái đất
    this.lockedRotation = 0; 
  }

  async load(textureLoader) {
    // Texture này sẽ được tạo trong public/textures/
    const texture = await textureLoader.loadAsync('textures/moon_map.png');
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    
    // Dùng Standard/Lambert material để phản ứng với sunlight (tạo ra moonphase tự nhiên)
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.0,
      color: 0xaaaaaa, // Làm mờ mặt trăng một chút vì texture thực tế hơi tối
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);
    return this.group;
  }

  /**
   * Cập nhật vị trí mặt trăng
   * @param {THREE.Vector3} position Vị trí mới
   */
  updatePosition(position) {
    this.group.position.copy(position);
    // Mặt trăng luôn hướng cùng một mặt về Trái Đất (0,0,0)
    // Tính tóan lookAt về phía Trái đất
    if (this.mesh) {
        // Cần rotate mesh sao cho phù hợp với texture equirectangular
        this.mesh.lookAt(0, 0, 0);
        // Có thể cần xoay bù nếu texture không orientation đúng
        this.mesh.rotateY(Math.PI / 2);
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.map?.dispose();
      this.mesh.material.dispose();
    }
  }
}
