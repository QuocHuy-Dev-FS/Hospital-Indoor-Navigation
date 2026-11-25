/**
 * astar.js — A* đa tầng trên đồ thị nodes/edges
 */

export class Graph {
  constructor() {
    this._adj = new Map(); // nodeId → [{nodeId, edgeId, weight, wheelchairOk, type}]
    this._nodes = new Map(); // nodeId → node
  }

  addNode(node) {
    this._nodes.set(node.id, node);
    if (!this._adj.has(node.id)) this._adj.set(node.id, []);
  }

  addEdge(edge) {
    const add = (from, to) => {
      if (!this._adj.has(from)) this._adj.set(from, []);
      this._adj.get(from).push({
        nodeId: to,
        edgeId: edge.id,
        weight: edge.weight,
        wheelchairOk: edge.wheelchairOk,
        type: edge.type,
      });
    };
    if (edge.from && this._nodes.has(edge.from) && this._nodes.has(edge.to)) {
      add(edge.from, edge.to);
      if (edge.bidirectional) add(edge.to, edge.from);
    }
  }

  getNode(id) { return this._nodes.get(id); }
  getNeighbors(id) { return this._adj.get(id) || []; }
  hasNode(id) { return this._nodes.has(id); }
  nodeCount() { return this._nodes.size; }
}

export function buildGraph(nodes, edges) {
  const g = new Graph();
  for (const n of nodes) g.addNode(n);
  for (const e of edges) g.addEdge(e);
  return g;
}

function heuristic(a, b) {
  // 3D Euclidean distance
  return Math.hypot(
    (a.x ?? 0) - (b.x ?? 0),
    (a.y ?? 0) - (b.y ?? 0),
    (a.z ?? 0) - (b.z ?? 0),
  );
}

/**
 * A* pathfinding
 * @param {Graph} graph
 * @param {string} startId
 * @param {string} goalId
 * @param {object} opts - { wheelchairOnly: bool }
 * @returns {{ path: string[], cost: number } | null}
 */
export function astar(graph, startId, goalId, opts = {}) {
  if (!graph.hasNode(startId) || !graph.hasNode(goalId)) return null;
  if (startId === goalId) return { path: [startId], cost: 0 };

  const { wheelchairOnly = false } = opts;

  const open = new MinHeap();
  const gScore = new Map();
  const parent = new Map();
  const closed = new Set();

  gScore.set(startId, 0);
  open.push({ id: startId, f: heuristic(graph.getNode(startId), graph.getNode(goalId)) });

  while (!open.isEmpty()) {
    const { id: current } = open.pop();
    if (current === goalId) return { path: reconstructPath(parent, goalId), cost: gScore.get(goalId) };
    if (closed.has(current)) continue;
    closed.add(current);

    for (const neighbor of graph.getNeighbors(current)) {
      if (closed.has(neighbor.nodeId)) continue;
      if (wheelchairOnly && !neighbor.wheelchairOk) continue;

      const tentative = (gScore.get(current) ?? Infinity) + neighbor.weight;
      if (tentative < (gScore.get(neighbor.nodeId) ?? Infinity)) {
        gScore.set(neighbor.nodeId, tentative);
        parent.set(neighbor.nodeId, current);
        const h = heuristic(graph.getNode(neighbor.nodeId), graph.getNode(goalId));
        open.push({ id: neighbor.nodeId, f: tentative + h });
      }
    }
  }
  return null; // no path
}

function reconstructPath(parent, goal) {
  const path = [];
  let cur = goal;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = parent.get(cur);
  }
  return path;
}

// ─── Min-heap (priority queue) ───────────────────────────────────────────────
class MinHeap {
  constructor() { this._data = []; }
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) { this._data[0] = last; this._sinkDown(0); }
    return top;
  }
  isEmpty() { return this._data.length === 0; }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._data[p].f <= this._data[i].f) break;
      [this._data[p], this._data[i]] = [this._data[i], this._data[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this._data.length;
    while (true) {
      let min = i;
      const l = 2*i+1, r = 2*i+2;
      if (l < n && this._data[l].f < this._data[min].f) min = l;
      if (r < n && this._data[r].f < this._data[min].f) min = r;
      if (min === i) break;
      [this._data[min], this._data[i]] = [this._data[i], this._data[min]];
      i = min;
    }
  }
}
