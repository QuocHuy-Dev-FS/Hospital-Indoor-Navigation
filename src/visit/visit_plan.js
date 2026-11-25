/**
 * visit_plan.js — Giấy khám bệnh / lịch trình khám (bản thử nghiệm, dữ liệu giả).
 * Hàm thuần: không DOM, không storage, không mạng, không log.
 * Mã giấy khám coi là dữ liệu liên quan sức khỏe: chỉ tồn tại trong bộ nhớ.
 * Định dạng mã tạm: tiền tố chữ + 4 chữ số (ví dụ DEMO-0001). Định dạng thật: Cần xác nhận.
 */
import { astar } from '../nav/astar.js';
import { pathUsesStairs } from '../nav/route_summary.js';

const CODE_DIGITS = 4;

/**
 * Chuẩn hóa mã: bỏ khoảng trắng/gạch/gạch dưới/chấm, viết hoa.
 * Ký tự dễ nhầm: phần số đọc O->0, I/L->1; phần tiền tố đọc 0->O, 1->I.
 * @returns {string|null} dạng "PREFIX-dddd" hoặc null nếu sai định dạng
 */
export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFKC').toUpperCase().replace(/[\s\-_.‐-―]+/g, '');
  if (s.length <= CODE_DIGITS) return null;
  const prefix = s.slice(0, s.length - CODE_DIGITS).replace(/0/g, 'O').replace(/1/g, 'I');
  const digits = s.slice(-CODE_DIGITS).replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[A-Z]+$/.test(prefix) || !/^\d+$/.test(digits)) return null;
  return `${prefix}-${digits}`;
}

/** Các chặng theo thứ tự `order` (ổn định khi trùng order). Không ném lỗi. */
export function sortedSteps(plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (Number(a.s?.order) - Number(b.s?.order)) || (a.i - b.i))
    .map(({ s }) => ({ order: s.order, roomId: s.roomId, note: s.note ?? '' }));
}

/**
 * Tra mã trong danh sách lịch trình. Không ném lỗi.
 * @returns {{ok:true, plan:object}|{ok:false, error:'empty'|'format'|'not-found'}}
 */
export function lookupPlan(plans, rawCode) {
  if (typeof rawCode !== 'string' || rawCode.trim() === '') return { ok: false, error: 'empty' };
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: 'format' };
  const list = Array.isArray(plans) ? plans : [];
  const plan = list.find((p) => normalizeCode(String(p?.code ?? '')) === code);
  return plan ? { ok: true, plan } : { ok: false, error: 'not-found' };
}

/**
 * Kiểm tra lịch trình. rooms: mảng phòng (có id) hoặc Set<string> id.
 * @returns {{ok:boolean, errors:Array<{type:string, index?:number, roomId?:string}>}}
 */
export function validatePlan(plan, rooms) {
  const errors = [];
  const ids = rooms instanceof Set ? rooms : new Set((rooms ?? []).map((r) => r.id));
  const raw = Array.isArray(plan?.steps) ? plan.steps : [];
  if (raw.length === 0) errors.push({ type: 'empty' });
  const seenOrder = new Set();
  raw.forEach((s, i) => {
    if (!Number.isFinite(Number(s?.order))) errors.push({ type: 'bad-order', index: i });
    else if (seenOrder.has(Number(s.order))) errors.push({ type: 'duplicate-order', index: i });
    else seenOrder.add(Number(s.order));
  });
  const steps = sortedSteps(plan);
  steps.forEach((s, i) => {
    if (!s.roomId || !ids.has(s.roomId)) errors.push({ type: 'unknown-room', index: i, roomId: s.roomId });
    if (i > 0 && s.roomId === steps[i - 1].roomId) errors.push({ type: 'duplicate-consecutive', index: i, roomId: s.roomId });
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Tính tuyến một chặng bằng A* hiện có. Xe lăn: không đi qua cầu thang.
 * ctx = { rooms, nodes, edges, graph }.
 * @returns {{ok:true, path:string[], cost:number}|{ok:false, error:'same'|'no-door'|'no-route'}}
 */
export function computeSegmentRoute(ctx, fromRoomId, toRoomId, wheelchair = false) {
  if (!fromRoomId || !toRoomId || fromRoomId === toRoomId) return { ok: false, error: 'same' };
  const rooms = ctx?.rooms ?? [];
  const from = rooms.find((r) => r.id === fromRoomId);
  const to = rooms.find((r) => r.id === toRoomId);
  if (!from?.doorNodeId || !to?.doorNodeId || !ctx?.graph) return { ok: false, error: 'no-door' };
  const result = astar(ctx.graph, from.doorNodeId, to.doorNodeId, { wheelchairOnly: !!wheelchair });
  if (!result) return { ok: false, error: 'no-route' };
  if (wheelchair && pathUsesStairs(result.path, ctx.edges)) return { ok: false, error: 'no-route' };
  return { ok: true, path: result.path, cost: result.cost };
}

/**
 * Máy trạng thái chặng. Trạng thái mỗi chặng: 'pending' | 'done' | 'skipped'.
 * state: 'idle' (chưa có điểm xuất phát) | 'active' | 'finished' (không còn chặng pending).
 */
export function createVisitTracker(plan, { onChange } = {}) {
  const steps = sortedSteps(plan).map((s) => ({ ...s, status: 'pending' }));
  let pos = null;     // roomId vị trí hiện tại (xuất phát hoặc cửa phòng vừa xong)
  let cur = 0;        // chỉ số chặng hiện tại
  let started = false;

  const emit = () => { if (typeof onChange === 'function') onChange(api); };
  const firstPending = (from = 0) => {
    for (let i = from; i < steps.length; i++) if (steps[i].status === 'pending') return i;
    for (let i = 0; i < from; i++) if (steps[i].status === 'pending') return i;
    return -1;
  };

  const api = {
    get total() { return steps.length; },
    get steps() { return steps.map((s) => ({ ...s })); },
    get state() {
      if (!started) return 'idle';
      return firstPending() === -1 ? 'finished' : 'active';
    },
    get position() { return pos; },

    /** Đặt/đổi điểm xuất phát (PositionProvider hoặc chọn thủ công). */
    setStart(roomId) {
      if (!roomId) return;
      pos = roomId;
      if (!started) { started = true; cur = Math.max(0, firstPending()); }
      emit();
    },

    /** Chặng hiện tại hoặc null khi idle/finished. */
    segment() {
      if (api.state !== 'active') return null;
      const step = steps[cur];
      return { index: cur, number: cur + 1, total: steps.length, step: { ...step }, fromRoomId: pos, toRoomId: step.roomId };
    },

    /** "Đã tới / Tiếp tục": đánh dấu xong, vị trí = phòng vừa tới, sang chặng pending kế. */
    complete() {
      if (api.state !== 'active') return api.segment();
      steps[cur].status = 'done';
      pos = steps[cur].roomId;
      const n = firstPending(cur + 1);
      if (n !== -1) cur = n;
      emit();
      return api.segment();
    },

    /** Bỏ qua chặng hiện tại (vị trí không đổi). */
    skip() {
      if (api.state !== 'active') return api.segment();
      steps[cur].status = 'skipped';
      const n = firstPending(cur + 1);
      if (n !== -1) cur = n;
      emit();
      return api.segment();
    },

    /** Quay lại một chặng đã bỏ qua hoặc đã xong: đặt lại pending và làm chặng hiện tại. */
    goTo(index) {
      if (!started || !Number.isInteger(index) || index < 0 || index >= steps.length) return api.segment();
      steps[index].status = 'pending';
      cur = index;
      emit();
      return api.segment();
    },

    /** Quay lại chặng liền trước (nếu có). */
    back() {
      if (!started || cur <= 0) return api.segment();
      return api.goTo(cur - 1);
    },
  };
  return api;
}
