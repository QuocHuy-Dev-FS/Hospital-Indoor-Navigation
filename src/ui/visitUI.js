/**
 * visitUI.js — Giao diện "Giấy khám" (bản thử nghiệm, dữ liệu demo).
 * Không import main.js: mọi phụ thuộc truyền qua initVisitUI(deps).
 * Mã giấy khám chỉ giữ trong bộ nhớ; không lưu trữ, không đưa vào URL/nhật ký.
 */
import { lookupPlan, validatePlan, createVisitTracker, computeSegmentRoute } from '../visit/visit_plan.js';

const ERR_LOOKUP = {
  empty: 'Vui lòng nhập mã trên giấy khám.',
  format: 'Mã không đúng định dạng (ví dụ DEMO-0001). Vui lòng kiểm tra lại.',
  'not-found': 'Không tìm thấy mã này trong dữ liệu thử nghiệm.',
  load: 'Không tải được dữ liệu giấy khám thử nghiệm.',
};
const ERR_ROUTE = {
  same: 'Bạn đang ở phòng này.',
  'no-door': 'Không tìm thấy nút cửa cho phòng.',
  'no-route': 'Không tìm thấy đường đi cho chặng này.',
};

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  if (text != null) e.textContent = text;
  return e;
}

/**
 * deps = {
 *   root: HTMLElement,                      // #visit-root
 *   loadPlans: () => Promise<{plans:[]}>,   // tải file mẫu (cùng nguồn)
 *   getContext: () => ({rooms,nodes,edges,graph}) | null,
 *   getRoom: (id) => room | undefined,
 *   floorLabel: (floorId) => string,
 *   getStartRoomId: () => string | null,    // PositionProvider
 *   searchRooms: (q) => room[],             // chọn xuất phát thủ công
 *   getWheelchair: () => boolean,
 *   onNavigate: ({fromRoomId,toRoomId,wheelchair}) => void,
 * }
 */
export function initVisitUI(deps) {
  const root = deps.root;
  if (!root) return null;
  let plans = null;
  let tracker = null;
  let plan = null;
  let routeError = '';

  const openBtn = el('button', { type: 'button', id: 'visit-open', class: 'visit-open' }, 'Giấy khám');
  openBtn.appendChild(el('span', { class: 'visit-trial' }, 'Thử nghiệm'));

  const panel = el('section', { id: 'visit-panel', class: 'visit-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'visit-title' });
  panel.hidden = true;
  const bar = el('div', { id: 'visit-bar', class: 'visit-bar', role: 'region', 'aria-label': 'Chặng khám hiện tại' });
  bar.hidden = true;
  root.append(openBtn, panel, bar);

  const showPanel = (on) => { panel.hidden = !on; if (on) bar.hidden = true; else renderBar(); };

  function reset() { tracker = null; plan = null; routeError = ''; }

  function head() {
    const h = el('div', { class: 'visit-head' });
    h.appendChild(el('h2', { id: 'visit-title' }, 'Giấy khám bệnh'));
    const close = el('button', { type: 'button', class: 'visit-close', 'aria-label': 'Thu gọn giấy khám' }, '✕');
    close.addEventListener('click', () => showPanel(false));
    h.appendChild(close);
    return h;
  }

  function trialNote() {
    return el('p', { class: 'visit-note' }, 'Bản thử nghiệm: dữ liệu demo, mã DEMO-xxxx. Chưa kết nối hệ thống bệnh viện. Mã chỉ giữ trong bộ nhớ, không lưu lại.');
  }

  function renderCodeForm(message = '') {
    panel.replaceChildren(head(), trialNote());
    const form = el('form', { class: 'visit-form', autocomplete: 'off' });
    const label = el('label', { for: 'visit-code' }, 'Mã trên giấy khám');
    const input = el('input', { id: 'visit-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'DEMO-0001', 'aria-describedby': 'visit-error' });
    const go = el('button', { type: 'submit', class: 'visit-primary' }, 'Tra cứu');
    const err = el('p', { id: 'visit-error', class: 'visit-error', role: 'alert' }, message);
    form.append(label, input, go);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = input.value;
      input.value = '';
      await submitCode(raw);
    });
    panel.append(form, err);
    input.focus();
  }

  async function submitCode(raw) {
    if (!plans) {
      try { plans = (await deps.loadPlans())?.plans ?? []; } catch (_) { plans = null; renderCodeForm(ERR_LOOKUP.load); return; }
    }
    const res = lookupPlan(plans, raw);
    if (!res.ok) { renderCodeForm(ERR_LOOKUP[res.error]); return; }
    const ctx = deps.getContext?.();
    const v = validatePlan(res.plan, ctx?.rooms ?? []);
    if (!v.ok) { renderCodeForm('Lịch trình có phòng không hợp lệ trong dữ liệu thử nghiệm. Vui lòng liên hệ quầy hướng dẫn.'); return; }
    plan = res.plan;
    routeError = '';
    tracker = createVisitTracker(plan);
    const start = deps.getStartRoomId?.();
    if (start) tracker.setStart(start);
    renderPlan();
  }

  function roomLine(id) {
    const r = deps.getRoom?.(id);
    return r ? `${r.name} · ${deps.floorLabel(r.floorId)}` : id;
  }

  function renderStartPicker() {
    const box = el('div', { class: 'visit-start' });
    box.appendChild(el('p', {}, 'Chọn nơi bạn đang đứng để bắt đầu chặng 1.'));
    const input = el('input', { type: 'search', 'aria-label': 'Tìm phòng bạn đang đứng', placeholder: 'Tìm phòng bạn đang đứng…', autocomplete: 'off', spellcheck: 'false' });
    const list = el('ul', { class: 'visit-results', 'aria-label': 'Kết quả tìm phòng' });
    input.addEventListener('input', () => {
      list.replaceChildren();
      const q = input.value.trim();
      if (!q) return;
      for (const r of (deps.searchRooms?.(q) ?? []).slice(0, 6)) {
        const li = el('li');
        const b = el('button', { type: 'button' }, `${r.name} · ${deps.floorLabel(r.floorId)}`);
        b.addEventListener('click', () => { tracker.setStart(r.id); renderPlan(); });
        li.appendChild(b);
        list.appendChild(li);
      }
    });
    box.append(input, list);
    return box;
  }

  function renderPlan() {
    panel.replaceChildren(head(), trialNote());
    const seg = tracker.segment();
    if (tracker.state === 'idle') {
      panel.appendChild(renderStartPicker());
    } else if (seg) {
      panel.appendChild(el('p', { class: 'visit-seg', role: 'status' }, `Chặng ${seg.number}/${seg.total}: ${roomLine(seg.toRoomId)}`));
      if (seg.step.note) panel.appendChild(el('p', { class: 'visit-step-note' }, seg.step.note));
      if (routeError) panel.appendChild(el('p', { class: 'visit-error', role: 'alert' }, routeError));
      const actions = el('div', { class: 'visit-actions' });
      const nav = el('button', { type: 'button', class: 'visit-primary' }, 'Dẫn đường đến phòng này');
      nav.addEventListener('click', () => navigateCurrent());
      const next = el('button', { type: 'button', class: 'visit-secondary' }, 'Đã tới / Tiếp tục');
      next.addEventListener('click', () => { tracker.complete(); routeError = ''; afterChange(true); });
      const skip = el('button', { type: 'button', class: 'visit-secondary' }, 'Bỏ qua chặng');
      skip.addEventListener('click', () => { tracker.skip(); routeError = ''; afterChange(false); });
      actions.append(nav, next, skip);
      panel.appendChild(actions);
    } else {
      panel.appendChild(el('p', { class: 'visit-done', role: 'status' }, 'Bạn đã hoàn tất lịch trình khám (bản thử nghiệm).'));
    }
    panel.appendChild(renderStepList());
    const other = el('button', { type: 'button', class: 'visit-link' }, 'Nhập mã khác');
    other.addEventListener('click', () => { reset(); renderCodeForm(); });
    panel.appendChild(other);
  }

  function renderStepList() {
    const ol = el('ol', { class: 'visit-steps', 'aria-label': 'Danh sách chặng' });
    const labels = { pending: 'Chờ', done: 'Xong', skipped: 'Đã bỏ qua' };
    const curIdx = tracker.segment()?.index;
    tracker.steps.forEach((s, i) => {
      const li = el('li', { class: `visit-step visit-st-${s.status}` });
      li.appendChild(el('span', {}, `${roomLine(s.roomId)} — ${i === curIdx ? 'Hiện tại' : labels[s.status]}`));
      if (tracker.state !== 'idle' && i !== curIdx && s.status !== 'pending') {
        const b = el('button', { type: 'button', class: 'visit-link' }, 'Quay lại chặng này');
        b.addEventListener('click', () => { tracker.goTo(i); routeError = ''; afterChange(false); });
        li.appendChild(b);
      }
      ol.appendChild(li);
    });
    return ol;
  }

  // "Tiếp tục" tự dẫn đường chặng kế (người dùng đã bấm thủ công); các thao tác khác chỉ vẽ lại.
  function afterChange(autoNavigate) {
    renderPlan();
    if (autoNavigate && tracker.segment()) navigateCurrent();
    if (tracker.state === 'finished') showPanel(true);
  }

  function navigateCurrent() {
    const seg = tracker.segment();
    if (!seg) return;
    const wheelchair = !!deps.getWheelchair?.();
    const check = computeSegmentRoute(deps.getContext?.(), seg.fromRoomId, seg.toRoomId, wheelchair);
    if (!check.ok) {
      routeError = check.error === 'no-route' && wheelchair ? 'Không có đường xe lăn cho chặng này.' : ERR_ROUTE[check.error];
      renderPlan();
      return;
    }
    routeError = '';
    deps.onNavigate({ fromRoomId: seg.fromRoomId, toRoomId: seg.toRoomId, wheelchair });
    showPanel(false);
  }

  function renderBar() {
    const seg = tracker?.segment();
    if (!seg) { bar.hidden = true; return; }
    bar.replaceChildren();
    bar.appendChild(el('span', { class: 'visit-bar-text' }, `Chặng ${seg.number}/${seg.total}: ${roomLine(seg.toRoomId)}`));
    const next = el('button', { type: 'button', class: 'visit-secondary' }, 'Đã tới / Tiếp tục');
    next.addEventListener('click', () => { tracker.complete(); afterChange(true); renderBar(); });
    const open = el('button', { type: 'button', class: 'visit-secondary' }, 'Lịch trình');
    open.addEventListener('click', () => { renderPlan(); showPanel(true); });
    bar.append(next, open);
    bar.hidden = false;
  }

  openBtn.addEventListener('click', () => {
    if (!panel.hidden) { showPanel(false); return; }
    if (tracker) renderPlan(); else renderCodeForm();
    showPanel(true);
  });

  return { reset, open: () => openBtn.click() };
}
