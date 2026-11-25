export function showToast(msg, type = 'info', durationMs = 3500) {
  const area = document.getElementById('toast-area');
  if (!area) return;
  const el = document.createElement('div');
  el.className = `toast ${['error','success','info'].includes(type) ? type : ''}`;
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }, durationMs);
}
