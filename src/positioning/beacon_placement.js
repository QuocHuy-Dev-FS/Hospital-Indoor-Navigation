/**
 * beacon_placement.js — Logic thuần cho chế độ "Gán beacon" trên bản đồ 3D.
 *
 * Không I/O, không phụ thuộc Three.js: dùng được trong Node (test) và trình duyệt.
 * Quy ước: đơn vị mét; (x, z) là tọa độ CỤC BỘ trong group của tầng (gốc góc bắc-tây
 * của mặt bằng, x về đông, z về nam — "Cần xác nhận" theo data/coordinate_system.json);
 * height_m là độ cao gắn beacon so với sàn tầng.
 *
 * Bảo mật: client không bao giờ gửi/nhận uuid/major/minor. Server chỉ sửa
 * 4 trường floorId, x, z, height_m của bản ghi đã có theo id.
 */

export const DEFAULT_HEIGHT_M = 2.5;
export const MAX_BODY_BYTES = 2048;
export const MAX_ID_LENGTH = 40;
const EDITABLE_FIELDS = ['floorId', 'x', 'z', 'height_m'];
const BODY_KEYS_SET = new Set(['id', 'floorId', 'x', 'z', 'height_m']);
const BODY_KEYS_REMOVE = new Set(['id', 'remove']);
const ID_RE = /^F\d+_B\d+$/;
const ROOM_ID_RE = /^F\d+_R\d+$/;
const BODY_KEYS_ROOM = new Set(['id', 'roomId']);
const BODY_KEYS_ROOM_REMOVE = new Set(['id', 'removeRoom']);
const LOOPBACK_ADDR = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const LOOPBACK_HOST = ['localhost', '127.0.0.1', '[::1]', '::1'];

export function isLoopbackAddress(addr) { return LOOPBACK_ADDR.includes(addr); }

/** Tách hostname từ giá trị header Host ("localhost:5173", "[::1]:5173"). */
export function hostnameOfHostHeader(host) {
  if (typeof host !== 'string' || !host) return null;
  if (host.startsWith('[')) { const i = host.indexOf(']'); return i < 0 ? null : host.slice(0, i + 1); }
  return host.split(':')[0];
}

export function isLoopbackHost(host) {
  const h = hostnameOfHostHeader(host);
  return h !== null && LOOPBACK_HOST.includes(h.toLowerCase());
}

export function isLoopbackOrigin(origin) {
  if (typeof origin !== 'string') return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return LOOPBACK_HOST.includes(u.hostname.toLowerCase());
  } catch { return false; }
}

/** Khung mặt bằng (m) từ coordinate_system.json. */
export function floorFrame(coord = {}) {
  return {
    width: Number.isFinite(coord.building_width_m) ? coord.building_width_m : 34.92,
    depth: Number.isFinite(coord.building_depth_m) ? coord.building_depth_m : 41.92,
  };
}

const round2 = v => Math.round(v * 100) / 100;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/**
 * Kiểm tra điểm gán.
 * ctx = { floors: [{id, height_m}], frame: {width, depth} }
 * @returns {{ok:true, value:{floorId,x,z,height_m}} | {ok:false, error:string}}
 */
export function validatePoint(p, ctx) {
  if (!p || typeof p !== 'object') return { ok: false, error: 'invalid-point' };
  const floor = (ctx.floors ?? []).find(f => f.id === p.floorId);
  if (typeof p.floorId !== 'string' || !floor) return { ok: false, error: 'unknown-floor' };
  if (!isNum(p.x) || !isNum(p.z)) return { ok: false, error: 'invalid-coordinate' };
  const { width, depth } = ctx.frame;
  if (p.x < 0 || p.x > width || p.z < 0 || p.z > depth) return { ok: false, error: 'out-of-frame' };
  const h = p.height_m === undefined ? DEFAULT_HEIGHT_M : p.height_m;
  const maxH = isNum(floor.height_m) ? floor.height_m : 3.6;
  if (!isNum(h) || h <= 0 || h > maxH) return { ok: false, error: 'invalid-height' };
  return { ok: true, value: { floorId: p.floorId, x: round2(p.x), z: round2(p.z), height_m: round2(h) } };
}

/** Kiểm tra body POST đã parse. Từ chối khóa lạ (kể cả uuid/major/minor). */
export function validateRequestBody(body, ctx) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid-body' };
  if (typeof body.id !== 'string' || body.id.length > MAX_ID_LENGTH || !ID_RE.test(body.id)) {
    return { ok: false, error: 'invalid-id' };
  }
  if (body.remove !== undefined) {
    if (body.remove !== true) return { ok: false, error: 'invalid-body' };
    if (Object.keys(body).some(k => !BODY_KEYS_REMOVE.has(k))) return { ok: false, error: 'unexpected-field' };
    return { ok: true, value: { id: body.id, remove: true } };
  }
  if (Object.keys(body).some(k => !BODY_KEYS_SET.has(k))) return { ok: false, error: 'unexpected-field' };
  const pt = validatePoint(body, ctx);
  if (!pt.ok) return pt;
  return { ok: true, value: { id: body.id, remove: false, point: pt.value } };
}

/** Bản ghi công khai: whitelist, KHÔNG uuid/major/minor. x/z null nếu chưa gán. */
export function toPublicRecord(r) {
  const placed = isNum(r.x) && isNum(r.z);
  return {
    id: r.id,
    floorId: typeof r.floorId === 'string' ? r.floorId : null,
    x: placed ? r.x : null,
    z: placed ? r.z : null,
    height_m: isNum(r.height_m) ? r.height_m : DEFAULT_HEIGHT_M,
    status: typeof r.status === 'string' ? r.status : null,
    roomId: typeof r.roomId === 'string' && ROOM_ID_RE.test(r.roomId) ? r.roomId : null,
  };
}

export function toPublicList(records) {
  return (Array.isArray(records) ? records : [])
    .filter(r => r && typeof r === 'object' && typeof r.id === 'string')
    .map(toPublicRecord);
}

/**
 * Kiểm tra body gắn/gỡ phòng: { id, roomId } hoặc { id, removeRoom: true }.
 * ctx.rooms = [{id, floorId, centroid:{x,z}}]. Phòng phải tồn tại.
 */
export function validateRoomBody(body, ctx) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid-body' };
  if (typeof body.id !== 'string' || body.id.length > MAX_ID_LENGTH || !ID_RE.test(body.id)) {
    return { ok: false, error: 'invalid-id' };
  }
  if (body.removeRoom !== undefined) {
    if (body.removeRoom !== true) return { ok: false, error: 'invalid-body' };
    if (Object.keys(body).some(k => !BODY_KEYS_ROOM_REMOVE.has(k))) return { ok: false, error: 'unexpected-field' };
    return { ok: true, value: { id: body.id, removeRoom: true } };
  }
  if (Object.keys(body).some(k => !BODY_KEYS_ROOM.has(k))) return { ok: false, error: 'unexpected-field' };
  if (typeof body.roomId !== 'string' || body.roomId.length > MAX_ID_LENGTH || !ROOM_ID_RE.test(body.roomId)) {
    return { ok: false, error: 'invalid-room-id' };
  }
  const room = (ctx.rooms ?? []).find(r => r && r.id === body.roomId);
  if (!room) return { ok: false, error: 'unknown-room' };
  return { ok: true, value: { id: body.id, removeRoom: false, room } };
}

/**
 * Gắn/gỡ phòng cho beacon. Chỉ đổi roomId (và floorId/x/z khi cần):
 *  - beacon chưa có x,z: lấy tầng + tâm phòng;
 *  - beacon đã có x,z cùng tầng với phòng: giữ nguyên x,z;
 *  - beacon đã có x,z khác tầng với phòng: chuyển sang tầng của phòng + tâm phòng
 *    (tọa độ cũ thuộc tầng khác nên vô nghĩa). Quy tắc ưu tiên: Cần xác nhận.
 * Một phòng có thể có nhiều beacon. Trả null nếu id lạ.
 */
export function applyRoomLink(records, req) {
  const idx = records.findIndex(r => r && r.id === req.id);
  if (idx < 0) return null;
  const next = records.map(r => (r && typeof r === 'object' ? { ...r } : r));
  const t = next[idx];
  if (req.removeRoom) { t.roomId = null; return next; }
  const room = req.room;
  t.roomId = room.id;
  const placed = isNum(t.x) && isNum(t.z);
  const c = room.centroid;
  const hasC = c && isNum(c.x) && isNum(c.z);
  if (!placed || t.floorId !== room.floorId) {
    t.floorId = room.floorId;
    if (hasC) { t.x = round2(c.x); t.z = round2(c.z); }
  }
  if (!isNum(t.height_m)) t.height_m = DEFAULT_HEIGHT_M;
  return next;
}

/** Map roomId -> [beaconId] từ danh sách công khai (chỉ beacon đã gắn phòng). */
export function roomsWithBeacons(publicList) {
  const m = new Map();
  for (const b of Array.isArray(publicList) ? publicList : []) {
    if (!b || typeof b.id !== 'string' || typeof b.roomId !== 'string' || !b.roomId) continue;
    if (!m.has(b.roomId)) m.set(b.roomId, []);
    m.get(b.roomId).push(b.id);
  }
  return m;
}

/** Lọc danh sách phòng chỉ còn phòng có beacon. Beacon chưa gắn phòng không tạo kết quả. */
export function filterRoomsWithBeacon(rooms, beaconMap) {
  return (rooms ?? []).filter(r => r && beaconMap.has(r.id));
}

/**
 * Đường dẫn dữ liệu cấu hình beacon thật (có UUID) mà client không phải loopback
 * KHÔNG được đọc: beacons.local.json, beacon-map.local.json và mọi bản .bak/.tmp của chúng,
 * ở bất kỳ thư mục nào (kể cả qua /@fs/). So khớp sau khi giải mã %xx và đổi \ thành /.
 */
const PROTECTED_RE = /(^|\/)(beacons|beacon-map)\.local\.json/i;
export function isProtectedDataPath(rawUrl) {
  let p = String(rawUrl ?? '').split('?')[0].split('#')[0];
  for (let i = 0; i < 3; i++) { // giải mã lặp để chặn %252e
    let d;
    try { d = decodeURIComponent(p); } catch { return true; } // mã hóa hỏng -> chặn
    if (d === p) break;
    p = d;
  }
  p = p.replace(/\\/g, '/').replace(/\u0000/g, '');
  return PROTECTED_RE.test(p);
}

/** true nếu yêu cầu phải bị chặn (đường dẫn nhạy cảm + không phải loopback). */
export function shouldBlockDataRequest({ url, remoteAddress }) {
  return isProtectedDataPath(url) && !isLoopbackAddress(remoteAddress);
}

/**
 * Áp dụng yêu cầu đã validate lên danh sách bản ghi. Trả mảng mới; chỉ đổi
 * floorId/x/z/height_m của đúng bản ghi (gỡ: x=z=null). Trả null nếu id lạ.
 */
export function applyPlacement(records, req) {
  const idx = records.findIndex(r => r && r.id === req.id);
  if (idx < 0) return null;
  const next = records.map(r => (r && typeof r === 'object' ? { ...r } : r));
  const target = next[idx];
  if (req.remove) { target.x = null; target.z = null; }
  else for (const k of EDITABLE_FIELDS) target[k] = req.point[k];
  return next;
}

/** Vị trí cục bộ của marker trong group tầng: (x, height_m, z). */
export function markerLocalPosition(p) {
  return { x: p.x, y: p.height_m ?? DEFAULT_HEIGHT_M, z: p.z };
}

/**
 * Xử lý yêu cầu (thuần). req = { method, pathname, remoteAddress, host, origin,
 * contentType, bodyText }. records = nội dung file đã parse, hoặc null nếu file chưa có.
 * @returns {{status:number, body:object, nextRecords?:Array}}
 */
export function processPlacementRequest(req, records, ctx) {
  const err = (status, error) => ({ status, body: { ok: false, error } });
  // Route công khai chỉ-đọc, đã lọc (không uuid/major/minor): mọi client trong LAN được gọi.
  if (req.pathname === '/api/beacons/public') {
    if (req.method !== 'GET') return err(405, 'method-not-allowed');
    if (!Array.isArray(records)) return err(404, 'beacons-file-missing');
    return { status: 200, body: { ok: true, beacons: toPublicList(records) } };
  }
  if (!isLoopbackAddress(req.remoteAddress)) return err(403, 'forbidden');
  if (!isLoopbackHost(req.host)) return err(403, 'forbidden-host');
  if (req.origin !== undefined && req.origin !== null && !isLoopbackOrigin(req.origin)) return err(403, 'forbidden-origin');

  if (req.pathname === '/api/beacons/placements') {
    if (req.method !== 'GET') return err(405, 'method-not-allowed');
    if (!Array.isArray(records)) return err(404, 'beacons-file-missing');
    return { status: 200, body: { ok: true, placements: toPublicList(records) } };
  }
  if (req.pathname === '/api/beacons/placement') {
    if (req.method !== 'POST') return err(405, 'method-not-allowed');
    if (!req.origin) return err(403, 'origin-required');
    if (!String(req.contentType ?? '').toLowerCase().startsWith('application/json')) return err(415, 'json-required');
    if (!Array.isArray(records)) return err(404, 'beacons-file-missing');
    if (typeof req.bodyText !== 'string' || Buffer_byteLength(req.bodyText) > MAX_BODY_BYTES) return err(413, 'body-too-large');
    let body;
    try { body = JSON.parse(req.bodyText); } catch { return err(400, 'invalid-json'); }
    const v = validateRequestBody(body, ctx);
    if (!v.ok) return err(400, v.error);
    const next = applyPlacement(records, v.value);
    if (!next) return err(404, 'unknown-beacon');
    const saved = toPublicRecord(next.find(r => r && r.id === v.value.id));
    return { status: 200, body: { ok: true, placement: saved }, nextRecords: next };
  }
  if (req.pathname === '/api/beacons/room') {
    if (req.method !== 'POST') return err(405, 'method-not-allowed');
    if (!req.origin) return err(403, 'origin-required');
    if (!String(req.contentType ?? '').toLowerCase().startsWith('application/json')) return err(415, 'json-required');
    if (!Array.isArray(records)) return err(404, 'beacons-file-missing');
    if (typeof req.bodyText !== 'string' || Buffer_byteLength(req.bodyText) > MAX_BODY_BYTES) return err(413, 'body-too-large');
    let body;
    try { body = JSON.parse(req.bodyText); } catch { return err(400, 'invalid-json'); }
    const v = validateRoomBody(body, ctx);
    if (!v.ok) return err(400, v.error);
    const next = applyRoomLink(records, v.value);
    if (!next) return err(404, 'unknown-beacon');
    const saved = toPublicRecord(next.find(r => r && r.id === v.value.id));
    return { status: 200, body: { ok: true, placement: saved }, nextRecords: next };
  }
  return err(404, 'not-found');
}

function Buffer_byteLength(s) {
  return new TextEncoder().encode(s).length; // TextEncoder có sẵn từ Node 11 / mọi trình duyệt hiện đại
}
