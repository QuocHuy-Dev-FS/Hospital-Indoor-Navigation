/**
 * load_beacon_map.js — Tải bản đồ beacon, ưu tiên file local (gitignored).
 *
 * Thứ tự thử:
 *  1) /data/beacon-map.local.json  — UUID thật, không nằm trong Git
 *  2) /data/beacon-map.json        — placeholder, an toàn với Git
 *
 * Nhận fetchFn tùy chọn để dễ kiểm thử trong Node.js (mock fetch).
 *
 * @param {function} [fetchFn] — hàm fetch tương thích (mặc định globalThis.fetch)
 * @returns {Promise<{ map: Array, source: 'local'|'placeholder' }>}
 */
export async function loadBeaconMap(fetchFn = globalThis.fetch) {
  try {
    const localRes = await fetchFn('/data/beacon-map.local.json');
    if (localRes.ok) {
      const map = await localRes.json();
      return { map, source: 'local' };
    }
  } catch {
    // File local không tồn tại hoặc lỗi mạng — fallback về placeholder
  }
  const res = await fetchFn('/data/beacon-map.json');
  if (!res.ok) throw new Error(`beacon-map.json: HTTP ${res.status}`);
  return { map: await res.json(), source: 'placeholder' };
}
