import * as THREE from 'three';
import { markerLocalPosition } from '../positioning/beacon_placement.js';

const COLORS = { installed: 0x1f9d6b, planned: 0x7a8794, preview: 0xf0a020, default: 0x3b7ddd };

function statusColor(status) { return COLORS[status] ?? COLORS.default; }

function labelSprite(text) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,32,40,.85)'; g.fillRect(0, 0, 192, 48);
  g.fillStyle = '#fff'; g.font = '600 26px "Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 96, 25, 184);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.9, .475, 1); sp.position.y = .45; sp.renderOrder = 10;
  return sp;
}

/** Marker beacon là con của group tầng, tại (x, height_m, z) cục bộ. */
export class BeaconLayer {
  constructor(builder) { this.builder = builder; this._layers = new Map(); this._preview = null; }

  _layer(floorId) {
    let l = this._layers.get(floorId);
    const parent = this.builder.getFloorGroup(floorId);
    if (!parent) return null;
    if (!l || l.parent !== parent) {
      if (l) { this._clearLayer(l); l.parent?.remove(l); }
      l = new THREE.Group(); l.name = 'beacon-layer'; l.userData = { type: 'beacon-layer' };
      parent.add(l); this._layers.set(floorId, l);
    }
    return l;
  }

  _makeMarker(p, color, withLabel) {
    const m = new THREE.Group(); m.userData = { type: 'beacon', id: p.id };
    const pos = markerLocalPosition(p); m.position.set(pos.x, pos.y, pos.z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    ball.renderOrder = 9;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, pos.y, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6 }));
    stem.position.y = -pos.y / 2;
    m.add(ball, stem);
    if (withLabel) m.add(labelSprite(p.roomId ? `${p.id} → ${p.roomId}` : p.id));
    return m;
  }

  _clearLayer(l) {
    for (const ch of [...l.children]) {
      l.remove(ch);
      ch.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    }
  }

  /** placements: [{id, floorId, x, z, height_m, status}] — chỉ vẽ bản ghi đã có x,z. */
  setPlacements(placements, excludeId = null, { labels = true } = {}) {
    for (const l of this._layers.values()) this._clearLayer(l);
    for (const p of placements) {
      if (p.x == null || p.z == null || p.id === excludeId) continue;
      const l = this._layer(p.floorId); if (!l) continue;
      l.add(this._makeMarker(p, statusColor(p.status), labels));
    }
  }

  setPreview(p) {
    this.clearPreview();
    if (!p) return;
    const l = this._layer(p.floorId); if (!l) return;
    this._preview = this._makeMarker(p, COLORS.preview, true); l.add(this._preview);
  }

  clearPreview() {
    if (!this._preview) return;
    this._preview.parent?.remove(this._preview);
    this._preview.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    this._preview = null;
  }

  dispose() { this.clearPreview(); for (const l of this._layers.values()) { this._clearLayer(l); l.parent?.remove(l); } this._layers.clear(); }
}
