import * as THREE from 'three';

const J2000 = 2451545.0;
const EARTH_AXIAL_TILT = THREE.MathUtils.degToRad(23.439291);
const EARTH_TEXTURE_LONGITUDE_OFFSET = 0;
const DEMO_YEAR = 2026;
const SEASON_EVENT_OPTIONS = [
  {
    key: "march-equinox",
    label: "Xuân phân",
    dateLabel: "20/03/2026",
    date: new Date(Date.UTC(DEMO_YEAR, 2, 20, 12, 0, 0)),
  },
  {
    key: "june-solstice",
    label: "Hạ chí",
    dateLabel: "21/06/2026",
    date: new Date(Date.UTC(DEMO_YEAR, 5, 21, 12, 0, 0)),
  },
  {
    key: "september-equinox",
    label: "Thu phân",
    dateLabel: "22/09/2026",
    date: new Date(Date.UTC(DEMO_YEAR, 8, 22, 12, 0, 0)),
  },
  {
    key: "december-solstice",
    label: "Đông chí",
    dateLabel: "21/12/2026",
    date: new Date(Date.UTC(DEMO_YEAR, 11, 21, 12, 0, 0)),
  },
];
const MARCH_EQUINOX_DATE = SEASON_EVENT_OPTIONS[0].date;
const MILLISECONDS_PER_DAY = 86400000;
const MILLISECONDS_PER_YEAR = 365 * MILLISECONDS_PER_DAY;

function getNormalizedMeanAnomaly(T) {
  return THREE.MathUtils.degToRad(
    THREE.MathUtils.euclideanModulo(357.52911 + 35999.05029 * T, 360),
  );
}

function getNormalizedMeanLongitude(T) {
  return THREE.MathUtils.degToRad(
    THREE.MathUtils.euclideanModulo(280.46646 + 36000.76983 * T, 360),
  );
}

function getSolarEclipticLongitude(jd) {
  const T = (jd - J2000) / 36525.0;
  const meanAnomaly = getNormalizedMeanAnomaly(T);
  const meanLongitude = getNormalizedMeanLongitude(T);

  return meanLongitude + THREE.MathUtils.degToRad(
    1.9146 * Math.sin(meanAnomaly) + 0.01999 * Math.sin(2 * meanAnomaly),
  );
}

function getNearestSeasonEvent(date) {
  return SEASON_EVENT_OPTIONS.reduce((nearest, eventOption) => {
    const distance = Math.abs(date.getTime() - eventOption.date.getTime());

    if (!nearest || distance < nearest.distance) {
      return {
        ...eventOption,
        distance,
      };
    }

    return nearest;
  }, null);
}

function getOrbitAngleDeg(date) {
  const deltaMilliseconds =
    date.getTime() - MARCH_EQUINOX_DATE.getTime();
  const normalizedFraction = THREE.MathUtils.euclideanModulo(
    deltaMilliseconds / MILLISECONDS_PER_YEAR,
    1,
  );

  return -90 + normalizedFraction * 360;
}

function getSeasonStateLabel(nearestEvent, declinationDeg) {
  const absDeclination = Math.abs(declinationDeg);

  if (absDeclination < 4) {
    return nearestEvent.label;
  }

  if (declinationDeg > 0) {
    return absDeclination > 20 ? "Hạ chí" : "Bắc bán cầu nghiêng về Mặt Trời";
  }

  return absDeclination > 20 ? "Đông chí" : "Nam bán cầu nghiêng về Mặt Trời";
}

function getSeasonSummary(declinationDeg) {
  const absDeclination = Math.abs(declinationDeg);

  if (absDeclination < 4) {
    return "Hai bán cầu nhận bức xạ gần cân bằng, ngày và đêm xấp xỉ nhau trên toàn cầu.";
  }

  if (declinationDeg > 0) {
    if (absDeclination > 20) {
      return "Bắc bán cầu nhận nắng mạnh nhất trong năm, còn Nam bán cầu bước vào giai đoạn nhận ít bức xạ hơn.";
    }

    return "Bắc bán cầu nghiêng về phía Mặt Trời, nhận nắng trực tiếp hơn và có xu hướng vào mùa hè.";
  }

  if (absDeclination > 20) {
    return "Nam bán cầu nhận nắng mạnh nhất trong năm, còn Bắc bán cầu bước vào giai đoạn nhận ít bức xạ hơn.";
  }

  return "Nam bán cầu nghiêng về phía Mặt Trời, nhận nắng trực tiếp hơn và có xu hướng vào mùa hè.";
}

function getDominantHemisphere(declinationDeg) {
  if (Math.abs(declinationDeg) < 1.2) {
    return "Gần cân bằng hai bán cầu";
  }

  return declinationDeg > 0 ? "Bắc bán cầu" : "Nam bán cầu";
}

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
    const eclipticLongitude = getSolarEclipticLongitude(jd);

    const x = Math.cos(eclipticLongitude);
    const y = Math.sin(EARTH_AXIAL_TILT) * Math.sin(eclipticLongitude);
    const z = -Math.cos(EARTH_AXIAL_TILT) * Math.sin(eclipticLongitude);

    return new THREE.Vector3(x, y, z).normalize();
  }

  static getSunDeclination(jd) {
    const eclipticLongitude = getSolarEclipticLongitude(jd);
    return Math.asin(
      Math.sin(EARTH_AXIAL_TILT) * Math.sin(eclipticLongitude),
    );
  }

  static getSubsolarLatitude(jd) {
    return THREE.MathUtils.radToDeg(this.getSunDeclination(jd));
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

  static getSeasonState(date) {
    const safeDate = date instanceof Date
      ? new Date(date.getTime())
      : new Date(Date.UTC(DEMO_YEAR, 0, 15, 12, 0, 0));
    const jd = this.getJulianDate(safeDate);
    const solarDeclinationDeg = THREE.MathUtils.radToDeg(
      this.getSunDeclination(jd),
    );
    const subsolarLatitudeDeg = this.getSubsolarLatitude(jd);
    const nearestEvent = getNearestSeasonEvent(safeDate) ?? SEASON_EVENT_OPTIONS[0];

    return {
      monthIndex: safeDate.getUTCMonth(),
      date: safeDate,
      solarDeclinationDeg,
      subsolarLatitudeDeg,
      eventKey: nearestEvent.key,
      eventLabel: nearestEvent.label,
      stateLabel: getSeasonStateLabel(nearestEvent, solarDeclinationDeg),
      eventDateLabel: nearestEvent.dateLabel,
      dominantHemisphere: getDominantHemisphere(solarDeclinationDeg),
      summary: getSeasonSummary(solarDeclinationDeg),
      orbitAngleDeg: getOrbitAngleDeg(safeDate),
      axialTiltDeg: THREE.MathUtils.radToDeg(EARTH_AXIAL_TILT),
    };
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
