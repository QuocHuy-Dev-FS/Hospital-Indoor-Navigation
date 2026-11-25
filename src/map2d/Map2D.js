/**
 * Map2D.js — Bản đồ 2D SVG dự phòng (WebGL không khả dụng hoặc ?force2d=1).
 * Tọa độ: đơn vị mét, khớp với rooms.json + coordinate_system.json.
 */
import { RoomSearch } from '../search/search.js';

export const MAP2D_SCALE = 10; // px/m — export để test

const ROOM_FILL = {
  clinic:   '#BBDEFB', lab:      '#E1BEE7', xray:     '#B0BEC5',
  cashier:  '#C8E6C9', pharmacy: '#B2DFDB', wc:       '#B3E5FC',
  elevator: '#FFCCBC', stairs:   '#CFD8DC', entrance: '#FFF9C4',
  info:     '#E0F7FA', office:   '#C5CAE9', storage:  '#D7CCC8',
  other:    '#EEEEEE',
};
const DEFAULT_FILL    = '#E8EEF5';
const COLOR_ROUTE     = '#0288D1';
const COLOR_HIGHLIGHT = '#FFD54F';
const COLOR_BG        = '#EEF4FA';
const NS = 'http://www.w3.org/2000/svg';

/** Chuyển tọa độ mét → pixel SVG. Hàm thuần túy, export để test. */
export function metersToSVG(x, z, scale = MAP2D_SCALE) {
  return { x: x * scale, y: z * scale };
}

export class Map2D {
  constructor(containerEl) {
    this._el          = containerEl;
    this._floors      = [];
    this._rooms       = [];
    this._nodes       = [];
    this._coord       = null;
    this._searcher    = null;
    this._activeFloor = null;
    this._highlightId = null;
    this._routeNodes  = null;
    this._svg         = null;
    this._onSelect    = null;
  }

  onRoomSelect(fn) { this._onSelect = fn; }

  init(floors, rooms, nodes, coordSys) {
    this._floors   = floors;
    this._rooms    = rooms;
    this._nodes    = nodes;
    this._coord    = coordSys;
    this._searcher = new RoomSearch(rooms);
    this._buildShell();
    const first = floors[0]?.id ?? 'F1';
    this.setActiveFloor(first);
  }

  // ─── Dựng khung HTML ────────────────────────────────────────────────────────
  _buildShell() {
    this._el.innerHTML = '';

    // Tab chọn tầng
    const tabs = document.createElement('div');
    tabs.className = 'map2d-tabs';
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Chọn tầng');
    for (const fl of this._floors) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map2d-tab-btn';
      btn.textContent = fl.name;
      btn.dataset.floorId = fl.id;
      btn.setAttribute('aria-label', fl.name);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => this.setActiveFloor(fl.id));
      tabs.appendChild(btn);
    }
    this._el.appendChild(tabs);

    // SVG container
    const wrap = document.createElement('div');
    wrap.className = 'map2d-svg-wrap';
    this._svg = document.createElementNS(NS, 'svg');
    this._svg.setAttribute('xmlns', NS);
    this._svg.setAttribute('class', 'map2d-svg');
    this._svg.setAttribute('aria-label', 'Sơ đồ tầng');
    this._svg.setAttribute('role', 'img');
    wrap.appendChild(this._svg);
    this._el.appendChild(wrap);
  }

  // ─── Chọn tầng ──────────────────────────────────────────────────────────────
  setActiveFloor(floorId) {
    this._activeFloor = floorId;
    this._el.querySelectorAll('.map2d-tab-btn').forEach(btn => {
      const active = btn.dataset.floorId === floorId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    this._render();
  }

  // ─── Highlight phòng ────────────────────────────────────────────────────────
  highlightRoom(roomId) {
    this._highlightId = roomId;
    this._render();
    // Cuộn đến phòng được chọn
    try {
      const el = this._svg?.querySelector(`[data-rid="${CSS.escape(roomId)}"]`);
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch { /* CSS.escape có thể lỗi trên ID kỳ lạ */ }
  }

  // ─── Route ──────────────────────────────────────────────────────────────────
  setRoute(nodeObjects) { this._routeNodes = nodeObjects; this._render(); }
  clearRoute()           { this._routeNodes = null;        this._render(); }

  // ─── Render SVG ─────────────────────────────────────────────────────────────
  _render() {
    if (!this._svg || !this._activeFloor || !this._coord) return;

    const W = this._coord.building_width_m  * MAP2D_SCALE;
    const H = this._coord.building_depth_m  * MAP2D_SCALE;

    this._svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this._svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    this._svg.innerHTML = '';

    // Nền
    this._el2('rect', { x: 0, y: 0, width: W, height: H, fill: COLOR_BG });

    const floorRooms = this._rooms.filter(r => r.floorId === this._activeFloor);

    for (const room of floorRooms) {
      const { x1, z1, x2, z2 } = room.bounds;
      const rw = (x2 - x1) * MAP2D_SCALE;
      const rh = (z2 - z1) * MAP2D_SCALE;
      if (rw <= 0 || rh <= 0) continue;

      const rx = x1 * MAP2D_SCALE;
      const ry = z1 * MAP2D_SCALE;
      const isHL = room.id === this._highlightId;
      const fill = isHL ? COLOR_HIGHLIGHT : (ROOM_FILL[room.type] ?? DEFAULT_FILL);

      const rect = this._el2('rect', {
        x: rx, y: ry, width: rw, height: rh,
        fill, stroke: '#7BA7C9', 'stroke-width': 1, rx: 2, ry: 2,
        'data-rid': room.id,
        role: 'button', tabindex: 0,
        'aria-label': room.name,
        style: 'cursor:pointer',
      });
      rect.addEventListener('click', () => {
        this.highlightRoom(room.id);
        this._onSelect?.(room);
      });
      rect.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { this.highlightRoom(room.id); this._onSelect?.(room); }
      });

      // Nhãn (chỉ khi phòng đủ rộng và có tên)
      if (!room.unlabeled && rw > 45 && rh > 20) {
        const fs = Math.max(7, Math.min(13, rw / 8));
        const label = room.name.length > 20 ? room.name.slice(0, 19) + '…' : room.name;
        this._el2('text', {
          x: rx + rw / 2, y: ry + rh / 2,
          'dominant-baseline': 'middle', 'text-anchor': 'middle',
          fill: '#1A2744', 'font-size': fs, 'font-family': 'system-ui,sans-serif',
          'pointer-events': 'none', 'font-weight': isHL ? 700 : 500,
        }, label);
      }
    }

    // Tuyến đường
    if (this._routeNodes?.length >= 2) {
      const floorNodes = this._routeNodes.filter(n => {
        const fid = String(n.id ?? '').split('_')[0];
        return fid === this._activeFloor;
      });
      if (floorNodes.length >= 2) {
        const pts = floorNodes.map(n => `${n.x * MAP2D_SCALE},${n.z * MAP2D_SCALE}`).join(' ');
        this._el2('polyline', {
          points: pts, fill: 'none', stroke: COLOR_ROUTE,
          'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          'pointer-events': 'none',
        });
        // Điểm đầu (xanh lá) + điểm cuối (đỏ)
        const fn = floorNodes[0];
        const ln = floorNodes[floorNodes.length - 1];
        this._el2('circle', { cx: fn.x * MAP2D_SCALE, cy: fn.z * MAP2D_SCALE, r: 7, fill: '#00C853', stroke: '#fff', 'stroke-width': 2, 'pointer-events': 'none' });
        this._el2('circle', { cx: ln.x * MAP2D_SCALE, cy: ln.z * MAP2D_SCALE, r: 7, fill: '#E53935', stroke: '#fff', 'stroke-width': 2, 'pointer-events': 'none' });
      }
    }
  }

  /** Tạo element SVG với attributes, gắn vào this._svg */
  _el2(tag, attrs = {}, text = null) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, String(v));
    }
    if (text !== null) el.textContent = text;
    this._svg.appendChild(el);
    return el;
  }
}
