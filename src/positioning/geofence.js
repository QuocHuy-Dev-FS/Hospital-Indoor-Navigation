/**
 * geofence.js — Kiểm tra trong/ngoài khuôn viên bằng GPS (một lần).
 * GPS CHỈ để biết trong/ngoài khuôn viên, KHÔNG dùng để đặt vị trí trong nhà.
 * Không log, không lưu, không trả tọa độ. Bản thử nghiệm.
 */

export const GPS_TIMEOUT_MS = 8000; // Cần xác nhận

export async function loadGeofenceConfig(fetchJSON) {
  try {
    const cfg = await fetchJSON();
    return cfg && typeof cfg === 'object' ? cfg : { status: 'unconfigured' };
  } catch (_) {
    return { status: 'unconfigured' };
  }
}

function toLatLng(p) {
  if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lng: Number(p[1]) };
  if (p && typeof p === 'object') return { lat: Number(p.lat ?? p.latitude), lng: Number(p.lng ?? p.lon ?? p.longitude) };
  return { lat: NaN, lng: NaN };
}
const valid = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

function isConfigured(config) {
  if (!config || config.status !== 'configured') return false;
  if (config.type === 'polygon') {
    return Array.isArray(config.polygon) && config.polygon.length >= 3 && config.polygon.every((v) => valid(toLatLng(v)));
  }
  if (config.type === 'circle') {
    return valid(toLatLng(config.center)) && Number.isFinite(config.radius_m) && config.radius_m > 0;
  }
  return false;
}

function inPolygon(pt, polygon) {
  // Ray-casting trên [lat, lng]
  let inside = false;
  const pts = polygon.map(toLatLng);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.lng > pt.lng) !== (b.lng > pt.lng)
      && pt.lat < ((b.lat - a.lat) * (pt.lng - a.lng)) / (b.lng - a.lng) + a.lat) inside = !inside;
  }
  return inside;
}

function haversineM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function evaluateGeofence(config, coords) {
  if (!isConfigured(config)) return 'unconfigured';
  const pt = toLatLng(coords);
  if (!valid(pt)) return 'outside';
  if (config.type === 'polygon') return inPolygon(pt, config.polygon) ? 'inside' : 'outside';
  return haversineM(pt, toLatLng(config.center)) <= config.radius_m ? 'inside' : 'outside';
}

export async function checkCampus({ config, geolocation, isSecureContext } = {}) {
  if (!isConfigured(config)) return { status: 'unconfigured' };
  if (isSecureContext === false) return { status: 'insecure' };
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') return { status: 'unsupported' };

  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const finish = (status) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ status });
    };
    timer = setTimeout(() => finish('timeout'), GPS_TIMEOUT_MS + 2000);
    try {
      geolocation.getCurrentPosition(
        (pos) => {
          const c = pos && pos.coords;
          if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) { finish('unavailable'); return; }
          finish(evaluateGeofence(config, { lat: c.latitude, lng: c.longitude }));
        },
        (err) => {
          const code = err && err.code;
          finish(code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable');
        },
        { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
      );
    } catch (_) {
      finish('unavailable');
    }
  });
}

export function geofenceMessage(status) {
  switch (status) {
    case 'outside': return 'Định vị chỉ hoạt động trong bệnh viện';
    case 'insecure': return 'Chưa bật quyền vị trí (cần HTTPS)';
    case 'denied':
    case 'unsupported':
    case 'unavailable':
    case 'timeout': return 'Chưa bật quyền vị trí';
    default: return null; // unconfigured | inside
  }
}
