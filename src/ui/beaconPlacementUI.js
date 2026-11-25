/**
 * beaconPlacementUI.js — Chế độ "Gán beacon" (chỉ dev, desktop). Nối dây tối thiểu từ main.js.
 * Giao tiếp với server qua /api/beacons/* — không bao giờ gửi/nhận uuid/major/minor.
 */
import * as THREE from 'three';
import { BeaconLayer } from '../scene/BeaconLayer.js';
import { DEFAULT_HEIGHT_M, validatePoint, floorFrame } from '../positioning/beacon_placement.js';

const $ = id => document.getElementById(id);

/**
 * @param {object} o { builder, canvas, camera, raycaster, updatePointer, getActiveFloor, getViewMode,
 *                     getRoomMeshes, getRoomName, floors, coordSys, requestRender, toast }
 */
export async function initBeaconPlacement(o) {
  const section = $('beacon-place-section');
  if (!section || document.body.classList.contains('kiosk-mode')) return null;
  let placements;
  try {
    const r = await fetch('/api/beacons/placements', { cache: 'no-store' });
    if (!r.ok) return null; // build/LAN/không có file → giữ ẩn
    placements = (await r.json()).placements;
  } catch { return null; }
  if (!Array.isArray(placements)) return null;

  section.hidden = false;
  const layer = new BeaconLayer(o.builder);
  const ctx = { floors: o.floors, frame: floorFrame(o.coordSys) };
  let active = false, selectedId = null, preview = null, down = null, roomMode = false;

  const setStatus = t => { $('bp-status').textContent = t; };
  const modeBlocked = () => document.body.classList.contains('mobile-flow') || document.body.classList.contains('kiosk-mode');

  function renderList() {
    const ul = $('bp-list'); ul.replaceChildren();
    for (const p of placements) {
      const li = document.createElement('li');
      li.textContent = `${p.id} — ${p.x == null ? 'chưa gán' : `đã gán ${p.floorId} (${p.x}, ${p.z})`}${p.roomId ? ` · phòng ${p.roomId}` : ''}`;
      li.setAttribute('role', 'option'); li.tabIndex = 0;
      if (p.id === selectedId) li.setAttribute('aria-selected', 'true');
      const pick = () => select(p.id);
      li.addEventListener('click', pick);
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      ul.appendChild(li);
    }
  }
  function redraw() { layer.setPlacements(placements, preview ? selectedId : null); o.requestRender(); }
  function select(id) {
    selectedId = id; preview = null; layer.clearPreview();
    const p = placements.find(x => x.id === id);
    $('bp-edit').hidden = !p;
    $('bp-x').value = p?.x ?? ''; $('bp-z').value = p?.z ?? ''; $('bp-h').value = p?.height_m ?? DEFAULT_HEIGHT_M;
    setStatus(`Đã chọn ${id}. Chạm bản đồ để đặt điểm${roomMode ? ' (chế độ gắn phòng: chạm một phòng)' : ''}.`);
    $('bp-room-label').textContent = p?.roomId ? `Phòng đã gắn: ${o.getRoomName?.(p.roomId) ?? p.roomId} (${p.roomId})` : 'Chưa gắn phòng.';
    renderList(); redraw();
  }
  function readInputs() {
    return { id: selectedId, floorId: preview?.floorId ?? o.getActiveFloor(), x: parseFloat($('bp-x').value), z: parseFloat($('bp-z').value), height_m: parseFloat($('bp-h').value) };
  }
  function updatePreviewFromInputs() {
    const v = validatePoint(readInputs(), ctx);
    if (!v.ok) { setStatus(`Điểm chưa hợp lệ: ${v.error}`); return; }
    preview = { id: selectedId, ...v.value }; layer.setPreview(preview); redraw(); setStatus('Xem trước — bấm Xác nhận để lưu.');
  }
  async function post(body, url = '/api/beacons/placement') {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ ok: false, error: 'bad-response' }));
    if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j.placement;
  }
  async function commit(body, okMsg, url) {
    try {
      const saved = await post(body, url);
      const i = placements.findIndex(p => p.id === saved.id); if (i >= 0) placements[i] = saved;
      preview = null; layer.clearPreview(); select(saved.id); setStatus(okMsg); o.toast?.(okMsg, 'success');
    } catch (e) { setStatus(`Lưu thất bại: ${e.message}`); o.toast?.(`Lưu thất bại: ${e.message}`, 'info'); }
  }

  $('bp-x').addEventListener('change', updatePreviewFromInputs);
  $('bp-z').addEventListener('change', updatePreviewFromInputs);
  $('bp-h').addEventListener('change', updatePreviewFromInputs);
  $('bp-confirm').addEventListener('click', () => {
    if (!selectedId) return;
    if (!preview) { setStatus('Chưa có điểm xem trước.'); return; }
    commit({ id: selectedId, floorId: preview.floorId, x: preview.x, z: preview.z, height_m: preview.height_m }, `Đã lưu vị trí ${selectedId}`);
  });
  $('bp-cancel').addEventListener('click', () => { if (selectedId) select(selectedId); });
  $('bp-remove').addEventListener('click', () => { if (selectedId) commit({ id: selectedId, remove: true }, `Đã gỡ vị trí ${selectedId}`); });
  $('bp-room-mode').addEventListener('click', () => {
    roomMode = !roomMode;
    $('bp-room-mode').setAttribute('aria-pressed', String(roomMode));
    $('bp-room-mode').textContent = roomMode ? 'Đang chờ: chạm một phòng' : 'Chạm phòng để gắn';
    setStatus(roomMode ? 'Chạm vào một phòng trên bản đồ để gắn beacon đã chọn vào phòng đó.' : 'Đã tắt chế độ gắn phòng.');
  });
  $('bp-room-clear').addEventListener('click', () => { if (selectedId) commit({ id: selectedId, removeRoom: true }, `Đã gỡ phòng của ${selectedId}`, '/api/beacons/room'); });
  $('bp-toggle').addEventListener('click', () => {
    active = !active;
    $('bp-toggle').setAttribute('aria-pressed', String(active));
    $('bp-toggle').textContent = active ? 'Tắt chế độ gán beacon' : 'Bật chế độ gán beacon';
    $('bp-body').hidden = !active;
    if (active) { renderList(); redraw(); } else { preview = null; layer.dispose(); o.requestRender(); }
  });

  // Chạm bản đồ: pha capture để chặn xử lý chọn phòng của main.js khi đang gán.
  const cv = o.canvas;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  cv.addEventListener('pointerup', e => {
    const d = down; down = null;
    if (!active || !selectedId || modeBlocked() || !d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return; // kéo xoay camera, không phải chạm
    e.stopImmediatePropagation();
    if (roomMode) {
      o.updatePointer(e);
      const hit = o.raycaster.intersectObjects(o.getRoomMeshes(), false)[0];
      const roomId = hit?.object.userData.roomId;
      if (!roomId) { setStatus('Không chạm trúng phòng nào. Thử lại.'); return; }
      commit({ id: selectedId, roomId }, `Đã gắn ${selectedId} vào phòng ${roomId}`, '/api/beacons/room');
      return;
    }
    if (o.getViewMode() !== 'single') { setStatus('Hãy chuyển sang chế độ một tầng để gán beacon.'); return; }
    const floorId = o.getActiveFloor(), group = o.builder.getFloorGroup(floorId);
    if (!group) { setStatus('Tầng này chưa được dựng trong cảnh.'); return; }
    o.updatePointer(e);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -group.position.y);
    const hit = o.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return;
    // group chỉ tịnh tiến theo y → x,z thế giới = x,z cục bộ
    const v = validatePoint({ id: selectedId, floorId, x: hit.x, z: hit.z, height_m: parseFloat($('bp-h').value) || DEFAULT_HEIGHT_M }, ctx);
    if (!v.ok) { setStatus(`Điểm ngoài vùng hợp lệ (${v.error}).`); return; }
    preview = { id: selectedId, ...v.value };
    $('bp-x').value = v.value.x; $('bp-z').value = v.value.z; $('bp-h').value = v.value.height_m;
    layer.setPreview(preview); redraw(); setStatus('Xem trước — chỉnh x/z nếu cần, rồi bấm Xác nhận.');
  }, true);

  return { layer };
}
