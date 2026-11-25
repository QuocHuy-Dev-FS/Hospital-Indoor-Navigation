/**
 * PositionMarker.js
 * Marker vị trí hiện tại: vòng pulse + hướng, trạng thái low-confidence.
 * Pulse chu kỳ ≥ 1.5 giây (Cần xác nhận).
 */
import * as THREE from 'three';

const COLOR_NORMAL     = 0x4CAF50; // xanh lá
const COLOR_PULSE_RING = 0xA5D6A7;
const COLOR_LOW_CONF   = 0xFF9800; // cam (độ tin cậy thấp)
const PULSE_PERIOD_MS  = 2000;     // chu kỳ pulse, Cần xác nhận (≥ 1500ms)

export class PositionMarker {
  constructor() {
    this._group      = null;
    this._ring       = null;
    this._dot        = null;
    this._dirCone    = null;
    this._lowConf    = false;
    this._startMs    = 0;
  }

  // Tạo hoặc cập nhật marker
  setPosition(x, y, z, scene, opts = {}) {
    const { lowConfidence = false, heading = null } = opts;
    this._lowConf = lowConfidence;

    if (!this._group) {
      this._buildGroup(scene);
    }
    this._group.position.set(x, y + 0.15, z);
    this._updateStyle();
    if (heading !== null) this._setHeading(heading);
  }

  _buildGroup(scene) {
    const g = new THREE.Group();
    g.name = '__position_marker__';

    // Vòng pulse (torus dẹt)
    const ringGeo = new THREE.TorusGeometry(0.6, 0.06, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLOR_PULSE_RING, transparent: true, opacity: 0.7, depthWrite: false,
    });
    this._ring = new THREE.Mesh(ringGeo, ringMat);
    this._ring.rotation.x = Math.PI / 2;
    this._ring.name = '__pos_ring__';
    g.add(this._ring);

    // Dot trung tâm
    const dotGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16);
    const dotMat = new THREE.MeshStandardMaterial({ color: COLOR_NORMAL, roughness: 0.3, emissive: new THREE.Color(0x004411), emissiveIntensity: 0.5 });
    this._dot = new THREE.Mesh(dotGeo, dotMat);
    this._dot.name = '__pos_dot__';
    g.add(this._dot);

    // Cone hướng (nhỏ, phía trước)
    const coneGeo = new THREE.ConeGeometry(0.12, 0.35, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: COLOR_NORMAL, roughness: 0.3 });
    this._dirCone = new THREE.Mesh(coneGeo, coneMat);
    this._dirCone.position.set(0.5, 0.04, 0);
    this._dirCone.rotation.z = -Math.PI / 2;
    this._dirCone.name = '__pos_cone__';
    this._dirCone.visible = false;
    g.add(this._dirCone);

    scene.add(g);
    this._group = g;
    this._startMs = performance.now();
  }

  _updateStyle() {
    if (!this._dot) return;
    const c = this._lowConf ? COLOR_LOW_CONF : COLOR_NORMAL;
    this._dot.material.color.setHex(c);
    this._dot.material.emissive.setHex(this._lowConf ? 0x332200 : 0x004411);
    this._ring.material.color.setHex(this._lowConf ? 0xFFCC80 : COLOR_PULSE_RING);
    // low confidence: wireframe vẽ đứt (không native trong Three.js basic; dùng color nhạt)
    this._dot.material.opacity = this._lowConf ? 0.7 : 1.0;
    this._dot.material.transparent = this._lowConf;
  }

  _setHeading(angleDeg) {
    if (!this._dirCone || !this._group) return;
    this._dirCone.visible = true;
    // angleDeg = 0 → hướng Bắc (Z-), xoay quanh trục Y
    this._group.rotation.y = (-angleDeg * Math.PI) / 180;
  }

  // Gọi mỗi frame
  update(nowMs) {
    if (!this._ring) return;
    const elapsed = (nowMs - this._startMs) % PULSE_PERIOD_MS;
    const t = elapsed / PULSE_PERIOD_MS;
    // t: 0→0.5 mở rộng + mờ dần, 0.5→1 ẩn
    const phase = Math.sin(t * Math.PI); // 0→1→0
    const scale = 1 + phase * 0.6;  // 1.0 → 1.6 → 1.0
    const opacity = (1 - phase * 0.5) * (this._lowConf ? 0.4 : 0.7);
    this._ring.scale.set(scale, 1, scale);
    this._ring.material.opacity = opacity;
  }

  remove(scene) {
    if (!scene || !this._group) return;
    this._group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    scene.remove(this._group);
    this._group = null;
    this._ring = this._dot = this._dirCone = null;
  }

  get isVisible() { return !!this._group; }

  // Lấy vị trí hiện tại (nếu cần)
  getPosition() {
    return this._group ? this._group.position.clone() : null;
  }
}
