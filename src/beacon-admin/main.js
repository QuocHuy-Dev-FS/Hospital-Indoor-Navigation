/**
 * main.js — Trang quản trị Beacon (kỹ thuật viên)
 * Hiển thị danh sách beacon đang thấy, marker trạng thái,
 * gán vị trí beacon chưa đăng ký, ghi CalibrationRecord.
 */

import { SlidingWindow }                  from './smoothing.js';
import { LaptopBridgeSource, MockReplaySource } from './sources.js';

// ─── Hằng số ────────────────────────────────────────────────────────────────

const LOST_TIMEOUT_MS  = 10_000;  // sau bao lâu không thấy → "lost"
const WINDOW_SIZE      = 5;       // số mẫu RSSI cho sliding window
const TICK_MS          = 2_000;   // tần suất cập nhật trạng thái timeout
const CALIB_COUNT      = 30;      // số mẫu thu cho calibration
const BRIDGE_PORT      = 8765;

// ─── State ──────────────────────────────────────────────────────────────────

const state = {
  sourceType:    'mock',        // 'mock' | 'bridge'
  bridgeStatus:  'disconnected',

  registeredBeacons: [],        // mảng từ beacons.json (+ local)
  // key → { id, window: SlidingWindow, lastSeen: ms|null, rssi: number|null }
  regState:      new Map(),
  // beaconKey → { rssi: number, lastSeen: ms }
  unknownBeacons: new Map(),

  calibration: {
    active:   false,
    beaconId: null,
    distanceM: null,
    condition: '',
    samples:  [],
    target:   CALIB_COUNT,
  },
};

let currentSource = null;

// ─── Load beacons ────────────────────────────────────────────────────────────

async function loadBeacons() {
  let base = [];
  try {
    const r = await fetch('/data/beacons.json');
    if (r.ok) base = await r.json();
  } catch { /* ignored */ }

  let local = [];
  try {
    const r = await fetch('/data/beacons.local.json');
    if (r.ok) local = await r.json();
  } catch { /* no local file */ }

  // Merge: local ghi đè beacon cùng id
  const map = new Map(base.map(b => [b.id, b]));
  for (const b of local) {
    if (b.id) map.set(b.id, { ...map.get(b.id), ...b });
  }
  state.registeredBeacons = [...map.values()];

  // Khởi tạo state map
  for (const b of state.registeredBeacons) {
    const key = beaconToKey(b);
    if (key) {
      state.regState.set(key, {
        id: b.id, x: b.x, z: b.z, floorId: b.floorId,
        window: new SlidingWindow(WINDOW_SIZE),
        lastSeen: null, rssi: null,
      });
    }
  }

  renderRegisteredList();
  renderCalibrationSelect();
}

/** Tạo key từ beacon object (uuid-major-minor). UUID "SIMULATED" → null (không match). */
function beaconToKey(b) {
  if (!b.uuid || b.uuid === 'SIMULATED') return null;
  return `${b.uuid.toLowerCase()}-${b.major}-${b.minor}`;
}

// ─── Observation handler ─────────────────────────────────────────────────────

function onObservation(obs) {
  const { key, rssi, txPower } = obs;
  const entry = state.regState.get(key);

  if (entry) {
    entry.window.push(rssi);
    entry.lastSeen = Date.now();
    entry.rssi = entry.window.mean();
    updateRegisteredRow(key, entry);
  } else {
    const u = state.unknownBeacons.get(key) ?? { rssi, lastSeen: null };
    u.rssi = rssi;
    u.lastSeen = Date.now();
    state.unknownBeacons.set(key, u);
    renderUnknownList();
  }

  // Thu mẫu calibration nếu đang đo beacon này
  const cal = state.calibration;
  if (cal.active && cal.beaconId) {
    const bEntry = [...state.regState.entries()].find(([, v]) => v.id === cal.beaconId);
    if (bEntry && bEntry[0] === key) {
      cal.samples.push(rssi);
      updateCalibrationProgress();
      if (cal.samples.length >= cal.target) finishCalibration();
    }
  }
}

function onStatusChange(status) {
  state.bridgeStatus = status;
  renderConnectionBar();
}

// ─── Tick (timeout check) ────────────────────────────────────────────────────

function tick() {
  const now = Date.now();
  for (const [key, entry] of state.regState) {
    if (entry.lastSeen !== null && now - entry.lastSeen > LOST_TIMEOUT_MS) {
      updateRegisteredRow(key, entry);
    }
  }
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function getStatus(entry) {
  if (!entry.lastSeen) return 'never';
  const age = Date.now() - entry.lastSeen;
  if (age > LOST_TIMEOUT_MS) return 'lost';
  if (entry.rssi !== null && entry.rssi < -80) return 'weak';
  return 'active';
}

const STATUS_LABEL = {
  never:  'Chưa thấy',
  active: 'Đang phát',
  weak:   'Tín hiệu yếu',
  lost:   'Mất tín hiệu',
};

// ─── Render: connection bar ──────────────────────────────────────────────────

function renderConnectionBar() {
  const bar = document.getElementById('conn-bar');
  const dot = document.getElementById('conn-dot');
  const txt = document.getElementById('conn-txt');
  if (!bar) return;

  const s = state.sourceType === 'mock' ? 'connected' : state.bridgeStatus;
  const labels = {
    connected:    'Đã kết nối',
    connecting:   'Đang kết nối…',
    disconnected: 'Mất kết nối cầu nối',
  };
  dot.className = `dot dot-${s}`;
  txt.textContent = state.sourceType === 'mock'
    ? 'Mock Replay (không cần bridge)'
    : `Bridge: ${labels[s] ?? s}`;
}

// ─── Render: registered beacon list ─────────────────────────────────────────

function renderRegisteredList() {
  const tbody = document.getElementById('reg-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const [key, entry] of state.regState) {
    tbody.appendChild(makeRegisteredRow(key, entry));
  }
  const cnt = document.getElementById('reg-count');
  if (cnt) cnt.textContent = state.regState.size;
}

function makeRegisteredRow(key, entry) {
  const tr = document.createElement('tr');
  tr.id = `row-${CSS.escape(key)}`;
  tr.innerHTML = `
    <td><span class="beacon-id">${entry.id}</span></td>
    <td class="rssi-cell">—</td>
    <td class="txp-cell">—</td>
    <td class="seen-cell">—</td>
    <td><span class="dot dot-never" title="${STATUS_LABEL.never}"></span> <span class="status-txt">${STATUS_LABEL.never}</span></td>
  `;
  return tr;
}

function updateRegisteredRow(key, entry) {
  const tr = document.getElementById(`row-${CSS.escape(key)}`);
  if (!tr) return;
  const s = getStatus(entry);
  const rssiStr = entry.rssi !== null ? `${Math.round(entry.rssi)} dBm` : '—';
  const seenStr = entry.lastSeen
    ? new Date(entry.lastSeen).toLocaleTimeString('vi-VN')
    : '—';
  tr.querySelector('.rssi-cell').textContent = rssiStr;
  tr.querySelector('.seen-cell').textContent = seenStr;
  const dot = tr.querySelector('.dot');
  dot.className = `dot dot-${s}`;
  dot.title = STATUS_LABEL[s];
  tr.querySelector('.status-txt').textContent = STATUS_LABEL[s];
}

// ─── Render: unknown beacon list ─────────────────────────────────────────────

function renderUnknownList() {
  const tbody = document.getElementById('unk-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const [key, u] of state.unknownBeacons) {
    const tr = document.createElement('tr');
    const seenStr = u.lastSeen
      ? new Date(u.lastSeen).toLocaleTimeString('vi-VN') : '—';
    tr.innerHTML = `
      <td class="key-cell" title="${key}">${key.slice(0, 24)}…</td>
      <td>${u.rssi} dBm</td>
      <td>${seenStr}</td>
      <td><button class="btn-assign" data-key="${key}">Gán vị trí</button></td>
    `;
    tbody.appendChild(tr);
  }
  const cnt = document.getElementById('unk-count');
  if (cnt) cnt.textContent = state.unknownBeacons.size;

  document.querySelectorAll('.btn-assign').forEach(btn => {
    btn.addEventListener('click', () => openAssignModal(btn.dataset.key));
  });
}

// ─── Modal: gán vị trí ───────────────────────────────────────────────────────

let _assignKey = null;

function openAssignModal(key) {
  _assignKey = key;
  const dlg = document.getElementById('assign-modal');
  document.getElementById('assign-key-display').textContent = key;
  dlg.showModal();
  drawMiniMap();
}

function drawMiniMap() {
  const canvas = document.getElementById('mini-map');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const beacons = state.registeredBeacons.filter(b => b.x != null && b.z != null);
  if (!beacons.length) { ctx.fillStyle = '#ccc'; ctx.fillText('Chưa có tọa độ beacon', 10, 20); return; }

  const xs = beacons.map(b => b.x), zs = beacons.map(b => b.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = 24;

  const scaleX = (maxX - minX) > 0 ? (W - 2*pad) / (maxX - minX) : 1;
  const scaleZ = (maxZ - minZ) > 0 ? (H - 2*pad) / (maxZ - minZ) : 1;

  canvas._toWorld = (cx, cy) => ({
    x: (cx - pad) / scaleX + minX,
    z: (cy - pad) / scaleZ + minZ,
  });

  for (const b of beacons) {
    const cx = (b.x - minX) * scaleX + pad;
    const cy = (b.z - minZ) * scaleZ + pad;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 2*Math.PI);
    ctx.fillStyle = '#1565C0'; ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = '10px sans-serif';
    ctx.fillText(b.id, cx + 8, cy + 4);
  }
}

// ─── Calibration ─────────────────────────────────────────────────────────────

function renderCalibrationSelect() {
  const sel = document.getElementById('calib-beacon-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Chọn beacon —</option>';
  for (const b of state.registeredBeacons) {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = b.id;
    sel.appendChild(opt);
  }
}

function startCalibration() {
  const sel  = document.getElementById('calib-beacon-sel');
  const dist = document.getElementById('calib-distance');
  const cond = document.getElementById('calib-condition');
  if (!sel.value) { alert('Chọn beacon trước.'); return; }
  if (!dist.value || isNaN(parseFloat(dist.value))) { alert('Nhập khoảng cách hợp lệ.'); return; }

  state.calibration = {
    active:    true,
    beaconId:  sel.value,
    distanceM: parseFloat(dist.value),
    condition: cond.value.trim(),
    samples:   [],
    target:    CALIB_COUNT,
  };
  document.getElementById('calib-start').disabled = true;
  document.getElementById('calib-progress').style.display = 'block';
  document.getElementById('calib-result').style.display = 'none';
  updateCalibrationProgress();
}

function updateCalibrationProgress() {
  const cal = state.calibration;
  const bar = document.getElementById('calib-bar');
  const lbl = document.getElementById('calib-lbl');
  const pct = Math.min(100, Math.round(cal.samples.length / cal.target * 100));
  if (bar) bar.value = cal.samples.length;
  if (lbl) lbl.textContent = `${cal.samples.length} / ${cal.target} mẫu`;
  if (bar) bar.max = cal.target;
  const live = document.getElementById('calib-live-rssi');
  if (live && cal.samples.length > 0)
    live.textContent = `RSSI hiện tại: ${cal.samples[cal.samples.length-1]} dBm`;
}

function finishCalibration() {
  const cal = state.calibration;
  cal.active = false;
  document.getElementById('calib-start').disabled = false;
  document.getElementById('calib-progress').style.display = 'none';
  document.getElementById('calib-result').style.display = 'block';

  const n    = cal.samples.length;
  const mean = cal.samples.reduce((a,b) => a+b, 0) / n;
  const std  = Math.sqrt(cal.samples.reduce((a,b) => a + (b-mean)**2, 0) / n);
  const min  = Math.min(...cal.samples);
  const max  = Math.max(...cal.samples);

  document.getElementById('calib-mean').textContent = mean.toFixed(1);
  document.getElementById('calib-std').textContent  = std.toFixed(1);

  const record = {
    schemaVersion: 1,
    beaconId:      cal.beaconId,
    distanceM:     cal.distanceM,
    condition:     cal.condition,
    recordedAt:    new Date().toISOString(),
    samples:       cal.samples,
    count:         n,
    mean:          parseFloat(mean.toFixed(2)),
    std:           parseFloat(std.toFixed(2)),
    min, max,
  };
  document.getElementById('btn-export-calib').onclick = () => downloadJSON(
    record,
    `calib_${cal.beaconId}_${cal.distanceM}m_${Date.now()}.json`
  );
}

// ─── Util ────────────────────────────────────────────────────────────────────

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Source management ───────────────────────────────────────────────────────

function switchSource(type) {
  currentSource?.stop();
  state.sourceType = type;
  state.unknownBeacons.clear();
  state.regState.forEach(e => { e.window.reset(); e.lastSeen = null; e.rssi = null; });

  if (type === 'mock') {
    const keys = [...state.regState.keys()];
    currentSource = new MockReplaySource(keys.length ? keys : ['mock-key-1-1'], 'near-A', 1000);
  } else {
    currentSource = new LaptopBridgeSource(BRIDGE_PORT);
  }
  renderConnectionBar();
  renderRegisteredList();
  renderUnknownList();
  currentSource.start(onObservation, onStatusChange);
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  await loadBeacons();

  // Source buttons
  document.querySelectorAll('[data-source]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-source]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchSource(btn.dataset.source);
    });
  });

  // Calibration
  document.getElementById('calib-start')?.addEventListener('click', startCalibration);

  // Assign modal
  document.getElementById('assign-modal')?.addEventListener('click', e => {
    if (e.target.id === 'assign-modal') e.target.close();
  });
  document.getElementById('btn-assign-close')?.addEventListener('click', () => {
    document.getElementById('assign-modal').close();
  });
  document.getElementById('btn-assign-export')?.addEventListener('click', () => {
    const xInput = parseFloat(document.getElementById('assign-x').value);
    const zInput = parseFloat(document.getElementById('assign-z').value);
    const floor  = document.getElementById('assign-floor').value;
    if (isNaN(xInput) || isNaN(zInput)) { alert('Nhập x, z hợp lệ.'); return; }
    const draft = {
      _note:    'Bản ghi nháp — kiểm tra và lưu vào data/beacons.local.json',
      key:       _assignKey,
      floorId:   floor,
      x:         xInput, z: zInput,
      uuid:      _assignKey?.split('-').slice(0,-2).join('-') ?? '',
      major:     parseInt(_assignKey?.split('-').at(-2) ?? '0'),
      minor:     parseInt(_assignKey?.split('-').at(-1)  ?? '0'),
    };
    downloadJSON(draft, `assign_draft_${Date.now()}.json`);
  });

  // Mini-map click → update x/z inputs
  document.getElementById('mini-map')?.addEventListener('click', e => {
    const canvas = e.currentTarget;
    if (!canvas._toWorld) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { x, z } = canvas._toWorld(cx, cy);
    document.getElementById('assign-x').value = x.toFixed(2);
    document.getElementById('assign-z').value = z.toFixed(2);
  });

  // Scenario selector
  document.getElementById('mock-scenario')?.addEventListener('change', e => {
    if (currentSource?.type === 'mock') currentSource.setScenario(e.target.value);
  });

  // Tick
  setInterval(tick, TICK_MS);

  // Khởi động với Mock mặc định
  document.querySelector('[data-source="mock"]')?.classList.add('active');
  switchSource('mock');
}

document.addEventListener('DOMContentLoaded', init);
