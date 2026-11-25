/**
 * search.js — Tìm kiếm phòng với chuẩn hóa tiếng Việt không dấu
 */

export function normalizeViet(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ').trim();
}

export class RoomSearch {
  constructor(rooms) {
    this._rooms = rooms;
    this._index = rooms.map(r => ({
      room: r,
      tokens: _tokenize(r.nameAscii ?? normalizeViet(r.name)),
      name_norm: r.nameAscii ?? normalizeViet(r.name),
      aliases_norm: (r.aliases ?? []).map(normalizeViet),
      type: r.type,
    }));
  }

  search(query, limit = 10) {
    if (!query || !query.trim()) return [];
    const q = normalizeViet(query);
    const qTokens = q.split(/\s+/).filter(Boolean);

    const scored = [];
    for (const entry of this._index) {
      let score = 0;

      // Exact match
      if (entry.name_norm === q) { score = 100; }
      // Starts with
      else if (entry.name_norm.startsWith(q)) { score = 80; }
      // Contains full query
      else if (entry.name_norm.includes(q)) { score = 60; }
      else {
        // All tokens match
        const allMatch = qTokens.every(t => entry.name_norm.includes(t));
        if (allMatch) score = 40;
        else {
          // Some tokens
          const matchCount = qTokens.filter(t => entry.name_norm.includes(t)).length;
          score = (matchCount / qTokens.length) * 20;
        }
      }
      // Alias boost
      for (const alias of entry.aliases_norm) {
        if (alias.includes(q) || q.includes(alias)) score = Math.max(score, 50);
      }
      // Room ID match (e.g. "R005")
      if (entry.room.id.toLowerCase().includes(q)) score = Math.max(score, 45);

      if (score > 0) scored.push({ room: entry.room, score });
    }

    return scored
      .sort((a, b) => b.score - a.score || a.room.name.localeCompare(b.room.name, 'vi'))
      .slice(0, limit)
      .map(s => s.room);
  }

  searchByType(type, limit = 20) {
    return this._rooms.filter(r => r.type === type).slice(0, limit);
  }

  getById(id) {
    return this._rooms.find(r => r.id === id);
  }

  // Quick filter helpers
  getElevators()  { return this.searchByType('elevator'); }
  getStairs()     { return this.searchByType('stairs'); }
  getWC()         { return this.searchByType('wc'); }
}

function _tokenize(str) {
  return str.split(/\s+/).filter(Boolean);
}
