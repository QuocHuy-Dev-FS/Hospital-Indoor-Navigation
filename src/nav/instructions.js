import { floorName } from '../ui/floorScope.js';
/**
 * instructions.js — Sinh chỉ dẫn tiếng Việt từ đường đi (mảng node)
 */

export function generateInstructions(pathNodes, edges) {
  if (!pathNodes || pathNodes.length < 2) return [];
  const steps = [];

  // Build edge lookup
  const edgeLookup = new Map();
  for (const e of edges) {
    const key1 = `${e.from}__${e.to}`;
    const key2 = `${e.to}__${e.from}`;
    edgeLookup.set(key1, e);
    if (e.bidirectional) edgeLookup.set(key2, e);
  }

  let segStart = 0;
  let segType = _edgeType(pathNodes[0], pathNodes[1], edgeLookup);
  let segDist = 0;

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const cur = pathNodes[i];
    const next = pathNodes[i + 1];
    const eType = _edgeType(cur, next, edgeLookup);
    const d = Math.hypot(
      (next.x ?? 0) - (cur.x ?? 0),
      (next.y ?? 0) - (cur.y ?? 0),
      (next.z ?? 0) - (cur.z ?? 0),
    );

    if (eType !== segType) {
      steps.push(_makeStep(segType, segDist, pathNodes[segStart], cur));
      segStart = i;
      segType = eType;
      segDist = d;
    } else {
      segDist += d;
    }
  }
  // last segment
  steps.push(_makeStep(segType, segDist, pathNodes[segStart], pathNodes[pathNodes.length - 1]));

  // Add arrival
  steps.push({ icon: '🏁', text: 'Bạn đã đến nơi.', nodeId: pathNodes[pathNodes.length - 1].id });

  return steps;
}

function _edgeType(a, b, edgeLookup) {
  const e = edgeLookup.get(`${a.id}__${b.id}`);
  return e ? e.type : 'walk';
}

function _makeStep(type, dist, fromNode, toNode) {
  const distTxt = dist > 0 ? ` (${dist.toFixed(0)} m)` : '';
  const floorFrom = fromNode?.floorId;
  const floorTo   = toNode?.floorId;

  if (type === 'elevator') {
    if (floorFrom && floorTo && floorFrom !== floorTo) {
      const fFrom = parseInt(floorFrom.slice(1));
      const fTo   = parseInt(floorTo.slice(1));
      const dir   = fTo > fFrom ? 'lên' : 'xuống';
      return { icon: '🛗', text: `Đi thang máy ${dir} ${floorName(floorTo).toLowerCase()}.`, nodeId: toNode?.id };
    }
    return { icon: '🛗', text: 'Đi thang máy.', nodeId: toNode?.id };
  }
  if (type === 'stairs') {
    if (floorFrom && floorTo && floorFrom !== floorTo) {
      const fFrom = parseInt(floorFrom.slice(1));
      const fTo   = parseInt(floorTo.slice(1));
      const dir   = fTo > fFrom ? 'lên' : 'xuống';
      return { icon: '🪜', text: `Đi cầu thang ${dir} ${floorName(floorTo).toLowerCase()}.`, nodeId: toNode?.id };
    }
    return { icon: '🪜', text: 'Đi cầu thang.', nodeId: toNode?.id };
  }
  // walk: try to determine direction
  return { icon: '👣', text: `Đi thẳng${distTxt}.`, nodeId: toNode?.id };
}

export function speakInstructions(steps, lang = 'vi-VN') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const text = steps.map(s => s.text).join(' ');
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

export function speakStep(step, lang = 'vi-VN') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(step.text);
  utt.lang = lang;
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}
