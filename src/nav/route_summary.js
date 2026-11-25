/**
 * route_summary.js — Tóm tắt tuyến và chỉ dẫn theo mốc (thuần, không DOM).
 * Khoảng cách là Euclid giữa các node: luôn hiển thị kèm "(ước tính)".
 */
import { floorName } from '../ui/floorScope.js';

function dist(a, b) {
  return Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0), (b.z ?? 0) - (a.z ?? 0));
}

function edgesBetween(edges, a, b) {
  return (edges ?? []).filter((e) => (e.from === a && e.to === b) || (e.bidirectional && e.from === b && e.to === a));
}

function levelOf(node) {
  const n = parseInt(String(node?.floorId ?? '').slice(1), 10);
  return Number.isFinite(n) ? n : 0;
}

export function summarizeRoute(pathNodes, edges) {
  const nodes = pathNodes ?? [];
  let distanceM = 0;
  let floorChanges = 0;
  const transitions = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    distanceM += dist(a, b);
    if (a.floorId !== b.floorId) {
      floorChanges++;
      const es = edgesBetween(edges, a.id, b.id);
      const type = es.some((e) => e.type === 'elevator') ? 'elevator'
        : es.some((e) => e.type === 'stairs') ? 'stairs' : 'other';
      const up = (Number.isFinite(a.y) && Number.isFinite(b.y) && a.y !== b.y) ? b.y > a.y : levelOf(b) > levelOf(a);
      transitions.push({ type, fromFloor: a.floorId, toFloor: b.floorId, nodeId: b.id, up });
    }
  }
  return { distanceM, floorChanges, transitions };
}

/** true nếu có cặp node liên tiếp mà mọi cạnh nối chúng đều là 'stairs'. */
export function pathUsesStairs(pathIds, edges) {
  const ids = pathIds ?? [];
  for (let i = 0; i < ids.length - 1; i++) {
    const es = edgesBetween(edges, ids[i], ids[i + 1]);
    if (es.length > 0 && es.every((e) => e.type === 'stairs')) return true;
  }
  return false;
}

export function remainingDistance(pathNodes, fromIndex = 0) {
  const nodes = pathNodes ?? [];
  let total = 0;
  for (let i = Math.max(0, fromIndex); i < nodes.length - 1; i++) total += dist(nodes[i], nodes[i + 1]);
  return total;
}

export function landmarkHint(step, { rooms = [], nodes = [] } = {}) {
  const nodeId = step?.nodeId;
  if (nodeId) {
    const room = rooms.find((r) => r.doorNodeId === nodeId);
    if (room) {
      const fl = room.floorId ?? nodes.find((n) => n.id === nodeId)?.floorId;
      return `Đi tới gần ${room.name}${fl ? ` (${floorName(fl)})` : ''}`;
    }
  }
  return 'Đi tới mốc tiếp theo';
}
