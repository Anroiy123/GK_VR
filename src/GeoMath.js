import * as THREE from "three";

export function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

export function latLonToUv(lat, lon) {
  const u = (lon + 180) / 360;
  const v = (90 - lat) / 180;

  return new THREE.Vector2(u, v);
}

export function vector3ToLatLon(vector) {
  const radius = vector.length();

  if (radius === 0) {
    return { lat: 0, lon: 0 };
  }

  const normalized = vector.clone().divideScalar(radius);
  const phi = Math.acos(THREE.MathUtils.clamp(normalized.y, -1, 1));
  const theta = Math.atan2(normalized.z, -normalized.x);

  const lat = 90 - THREE.MathUtils.radToDeg(phi);
  const wrappedLon = THREE.MathUtils.euclideanModulo(
    THREE.MathUtils.radToDeg(theta) - 180,
    360,
  );
  const lon = wrappedLon > 180 ? wrappedLon - 360 : wrappedLon;

  return { lat, lon };
}

export function formatLatitude(lat) {
  const suffix = lat >= 0 ? "N" : "S";
  return `${Math.abs(lat).toFixed(1)}°${suffix}`;
}

export function formatLongitude(lon) {
  const suffix = lon >= 0 ? "E" : "W";
  return `${Math.abs(lon).toFixed(1)}°${suffix}`;
}
