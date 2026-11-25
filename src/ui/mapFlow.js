/**
 * mapFlow.js — State machine thuần logic cho luồng di động "Khám phá bản đồ 3D".
 * S0 KHÁM PHÁ → S1 TÌM KIẾM → S2 THIẾT LẬP TUYẾN → S3 ĐANG DẪN ĐƯỜNG.
 * Không import DOM / three. Bản thử nghiệm giao diện.
 */

export const STATES = { EXPLORE: 'S0', SEARCH: 'S1', ROUTE: 'S2', NAV: 'S3' };

function blankContext(wheelchair = false) {
  return {
    query: '',
    destination: null, // { roomId, label, floorId }
    start: null,       // { roomId, label, floorId, source }
    wheelchair,
    routeOk: false,
    pickingStart: false,
    entry: null,       // 'search' | 'map' | null — cách vào S2
  };
}

function toPlace(p, withSource) {
  if (!p || !p.roomId) return null;
  const out = { roomId: p.roomId, label: p.label ?? p.name ?? p.roomId, floorId: p.floorId ?? null };
  if (withSource) out.source = p.source ?? 'manual';
  return out;
}

export function createMapFlow({ onChange } = {}) {
  let stack = [STATES.EXPLORE];
  let ctx = blankContext();

  const top = () => stack[stack.length - 1];
  const emit = (pushed) => { if (typeof onChange === 'function') onChange(top(), ctx, { pushed }); };

  function push(state) { stack.push(state); emit(true); }

  const api = {
    get state() { return top(); },
    get context() { return ctx; },
    get depth() { return stack.length - 1; },

    openSearch(query = '') {
      if (top() !== STATES.EXPLORE && top() !== STATES.ROUTE) return;
      ctx.query = String(query ?? '');
      ctx.pickingStart = false;
      push(STATES.SEARCH);
    },

    selectDestination(room, { via = 'search' } = {}) {
      const s = top();
      if (s !== STATES.SEARCH && s !== STATES.EXPLORE) return;
      const dest = toPlace(room && { roomId: room.roomId ?? room.id, label: room.label ?? room.name, floorId: room.floorId }, false);
      if (!dest) return;
      ctx.destination = dest;
      ctx.routeOk = false;
      ctx.pickingStart = false;
      if (s === STATES.EXPLORE) ctx.entry = 'map';
      else ctx.entry = via === 'map' ? 'map' : 'search';
      push(STATES.ROUTE);
    },

    setStart(place) {
      const next = toPlace(place, true);
      const same = (next?.roomId ?? null) === (ctx.start?.roomId ?? null);
      ctx.start = next;
      if (!same) ctx.routeOk = false;
      emit(false);
    },

    autoFillStart(place) {
      if (ctx.start) return;
      const next = toPlace(place, true);
      if (!next) return;
      ctx.start = next;
      ctx.routeOk = false;
      emit(false);
    },

    beginPickStart() {
      if (top() !== STATES.ROUTE) return;
      ctx.pickingStart = true;
      emit(false);
    },

    endPickStart() {
      if (!ctx.pickingStart) return;
      ctx.pickingStart = false;
      emit(false);
    },

    swap() {
      if (!ctx.start || !ctx.destination) return;
      const oldStart = ctx.start;
      const oldDest = ctx.destination;
      ctx.start = { roomId: oldDest.roomId, label: oldDest.label, floorId: oldDest.floorId, source: oldStart.source ?? 'manual' };
      ctx.destination = { roomId: oldStart.roomId, label: oldStart.label, floorId: oldStart.floorId };
      ctx.routeOk = false;
      emit(false);
    },

    setWheelchair(value) {
      const v = !!value;
      if (v === ctx.wheelchair) return;
      ctx.wheelchair = v;
      ctx.routeOk = false;
      emit(false);
    },

    setRouteOk(value) {
      const v = !!value;
      if (v === ctx.routeOk) return;
      ctx.routeOk = v;
      emit(false);
    },

    canStartNav() {
      return !!(ctx.start && ctx.destination && ctx.routeOk && ctx.start.roomId !== ctx.destination.roomId);
    },

    startNavigation() {
      if (top() !== STATES.ROUTE || !api.canStartNav()) return;
      ctx.pickingStart = false;
      push(STATES.NAV);
    },

    back() {
      if (stack.length <= 1) return top();
      const leaving = stack.pop();
      if (top() === STATES.EXPLORE) {
        ctx = blankContext(ctx.wheelchair);
      } else if (leaving === STATES.SEARCH) {
        ctx.pickingStart = false;
      }
      emit(false);
      return top();
    },

    reset() {
      stack = [STATES.EXPLORE];
      ctx = blankContext(ctx.wheelchair);
      emit(false);
    },
  };
  return api;
}
