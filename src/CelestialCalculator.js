import * as THREE from 'three';

const J2000 = 2451545.0;
const EARTH_AXIAL_TILT = THREE.MathUtils.degToRad(23.439291);
const EARTH_TEXTURE_LONGITUDE_OFFSET = 0;

export class CelestialCalculator {
  /**
   * Tính toán Julian Date từ object Date của JS
   * @param {Date} date 
   * @returns {number} Julian Date
   */
  static getJulianDate(date) {
    return (date.getTime() / 86400000.0) + 2440587.5;
  }

  static getSunDirection(jd) {
    const T = (jd - J2000) / 36525.0;

    let meanAnomaly = 357.52911 + 35999.05029 * T;
    meanAnomaly = THREE.MathUtils.degToRad(meanAnomaly % 360);

    let meanLongitude = 280.46646 + 36000.76983 * T;
    meanLongitude = THREE.MathUtils.degToRad(meanLongitude % 360);

    const eclipticLongitude = meanLongitude + THREE.MathUtils.degToRad(
      1.9146 * Math.sin(meanAnomaly) + 0.01999 * Math.sin(2 * meanAnomaly)
    );

    const x = Math.cos(eclipticLongitude);
    const y = Math.sin(EARTH_AXIAL_TILT) * Math.sin(eclipticLongitude);
    const z = -Math.cos(EARTH_AXIAL_TILT) * Math.sin(eclipticLongitude);

    return new THREE.Vector3(x, y, z).normalize();
  }

  /**
   * Tính vị trí Mặt Trời trên bầu trời
   * @param {number} jd Julian Date
   * @param {number} distance Khoảng cách từ gốc tọa độ
   * @returns {THREE.Vector3} Vị trí 3D của Mặt Trời
   */
  static getSunPosition(jd, distance = 50) {
    return this.getSunDirection(jd).multiplyScalar(distance);
  }

  static getEarthRotationAngle(jd) {
    const T = (jd - J2000) / 36525.0;
    const gmstDegrees =
      280.46061837 +
      360.98564736629 * (jd - J2000) +
      0.000387933 * T * T -
      (T * T * T) / 38710000.0;

    return THREE.MathUtils.degToRad(THREE.MathUtils.euclideanModulo(gmstDegrees, 360))
      + EARTH_TEXTURE_LONGITUDE_OFFSET;
  }

  /**
   * Tính vị trí Mặt Trăng trên bầu trời (thuật toán rút gọn)
   * @param {number} jd Julian Date
   * @param {number} distance Khoảng cách từ gốc tọa độ
   * @returns {THREE.Vector3} Vị trí 3D của Mặt Trăng
   */
  static getMoonPosition(jd, distance = 10) {
    const d = jd - 2451545.0; // Days from J2000.0
    
    // Các phần tử quỹ đạo rút gọn
    const L = THREE.MathUtils.degToRad((218.316 + 13.176396 * d) % 360); // Mean longitude
    const M = THREE.MathUtils.degToRad((134.963 + 13.064993 * d) % 360); // Mean anomaly
    const F = THREE.MathUtils.degToRad((93.272 + 13.229350 * d) % 360); // Mean distance from ascending node

    // Kinh độ và vĩ độ hoàng đạo của Mặt Trăng
    const lambda = L + THREE.MathUtils.degToRad(6.289 * Math.sin(M)); // Ecliptic longitude
    const beta = THREE.MathUtils.degToRad(5.128 * Math.sin(F)); // Ecliptic latitude

    // Chuyển đổi spherical sang Cartesian
    const x = distance * Math.cos(beta) * Math.cos(lambda);
    const z = distance * Math.cos(beta) * Math.sin(lambda);
    const y = distance * Math.sin(beta); // Không thêm obliquity của Trái đất vào quỹ đạo mặt trăng

    const pos = new THREE.Vector3(x, y, -z).normalize().multiplyScalar(distance);
    return pos;
  }
}
