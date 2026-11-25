/**
 * beacon_placement_server.mjs — Middleware dev-only ghi vị trí beacon vào
 * data/beacons.local.json (gitignored). Logic quyết định nằm ở
 * src/positioning/beacon_placement.js (hàm thuần); file này chỉ làm I/O.
 *
 * Route công khai chỉ-đọc GET /api/beacons/public trả danh sách đã lọc (không uuid/major/minor).
 * Ràng buộc: các route ghi/đọc đầy đủ chỉ loopback, đường dẫn file cố định, ghi nguyên tử, sao lưu một lần/phiên,
 * không tự tạo file, không log nội dung bản ghi (có UUID).
 */
import fs from 'node:fs';
import path from 'node:path';
import { processPlacementRequest, floorFrame, MAX_BODY_BYTES, shouldBlockDataRequest } from '../src/positioning/beacon_placement.js';

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return undefined; }
}

/** Ghi nguyên tử: file tạm cùng thư mục rồi rename. */
export function atomicWrite(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    // Windows: rename đè có thể bị EPERM/EBUSY khi file đang được tiến trình khác giữ (watcher, antivirus).
    // Dự phòng: ghi thẳng nội dung rồi xóa file tạm; không để sót file tạm.
    if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { try { fs.unlinkSync(tmp); } catch { /* bỏ qua */ } throw e; }
    try { fs.writeFileSync(file, text, { encoding: 'utf8' }); } finally { try { fs.unlinkSync(tmp); } catch { /* bỏ qua */ } }
  }
}

/**
 * @param {{root:string, now?:()=>Date}} opts
 * @returns {{handle:Function, middleware:Function, state:{backedUp:boolean}}}
 */
export function createPlacementService({ root, now = () => new Date() }) {
  const file = path.join(root, 'data', 'beacons.local.json'); // đường dẫn cố định
  const state = { backedUp: false };

  function ctx() {
    const floors = readJsonSafe(path.join(root, 'data', 'floors.json')) ?? [];
    const coord = readJsonSafe(path.join(root, 'data', 'coordinate_system.json')) ?? {};
    const rooms = (readJsonSafe(path.join(root, 'data', 'rooms.json')) ?? [])
      .filter(r => r && typeof r.id === 'string')
      .map(r => ({ id: r.id, floorId: r.floorId, centroid: r.centroid }));
    return { floors, rooms, frame: floorFrame(coord) };
  }

  function handle(req) {
    const exists = fs.existsSync(file);
    const records = exists ? readJsonSafe(file) : null;
    const result = processPlacementRequest(req, Array.isArray(records) ? records : null, ctx());
    if (result.nextRecords) {
      if (!state.backedUp) {
        const bak = `${file}.bak-${now().toISOString().slice(0, 10)}`;
        try { fs.copyFileSync(file, bak, fs.constants.COPYFILE_EXCL); } catch (e) { if (e.code !== 'EEXIST') throw e; }
        state.backedUp = true;
      }
      atomicWrite(file, JSON.stringify(result.nextRecords, null, 2) + '\n');
    }
    return { status: result.status, body: result.body };
  }

  function middleware(req, res) {
    const send = r => {
      res.statusCode = r.status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(r.body));
    };
    const base = {
      method: req.method,
      pathname: (req.url ?? '').split('?')[0],
      remoteAddress: req.socket?.remoteAddress,
      host: req.headers.host,
      origin: req.headers.origin,
      contentType: req.headers['content-type'],
    };
    // Từ chối sớm trước khi đọc body nếu không phải loopback.
    if (req.method !== 'POST') { try { send(handle({ ...base })); } catch { send({ status: 500, body: { ok: false, error: 'server-error' } }); } return; }
    let size = 0; const chunks = []; let aborted = false;
    req.on('data', d => {
      if (aborted) return;
      size += d.length;
      if (size > MAX_BODY_BYTES) { aborted = true; send({ status: 413, body: { ok: false, error: 'body-too-large' } }); req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => {
      if (aborted) return;
      try { send(handle({ ...base, bodyText: Buffer.concat(chunks).toString('utf8') })); }
      catch { send({ status: 500, body: { ok: false, error: 'server-error' } }); }
    });
    req.on('error', () => {});
  }

  return { handle, middleware, state, file };
}

/** Gắn vào Vite dev server (không gắn cho build/preview). */
export function addPlacementRoutes(middlewares, root) {
  const svc = createPlacementService({ root });
  // Chặn đọc file cấu hình beacon thật (có UUID) với client không phải loopback.
  // Đăng ký đầu tiên nên chạy trước mọi middleware phục vụ file của Vite.
  middlewares.use((req, res, next) => {
    if (shouldBlockDataRequest({ url: req.originalUrl ?? req.url, remoteAddress: req.socket?.remoteAddress })) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
      return;
    }
    next();
  });
  middlewares.use('/api/beacons', (req, res) => {
    // connect cắt tiền tố mount → khôi phục pathname đầy đủ
    req.url = '/api/beacons' + (req.url === '/' ? '' : req.url);
    svc.middleware(req, res);
  });
  return svc;
}
