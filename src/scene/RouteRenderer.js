/**
 * RouteRenderer.js
 * Vẽ tuyến đường 3D: draw-on animation, hiệu ứng chạy dọc tuyến (UV offset),
 * xử lý đa tầng (tầng hiện tại rõ, tầng khác mờ), pin đích thả nhẹ.
 */
import * as THREE from 'three';
import { splitRouteByFloor } from './SceneBuilder.js';

const ROUTE_COLOR      = 0x00BCD4; // cyan
const ROUTE_GLOW_COLOR = 0x0097A7;
const ARROW_COLOR      = 0x00E5FF;
const DEST_COLOR       = 0xFF4081; // pin đích
const DEST_GLOW        = 0x880044;

// Shader vật liệu tuyến đường (animated UV)
function makeRouteMaterial(useShader) {
  if (!useShader) {
    return new THREE.MeshStandardMaterial({
      color: ROUTE_COLOR, roughness: 0.3, emissive: new THREE.Color(0x003344), emissiveIntensity: 0.5,
      transparent: true, opacity: 0.9,
    });
  }
  // ShaderMaterial đơn giản: dịch UV theo thời gian → cảm giác "chạy"
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor:    { value: new THREE.Color(ROUTE_COLOR) },
      uGlow:     { value: new THREE.Color(ROUTE_GLOW_COLOR) },
      uTime:     { value: 0 },
      uOpacity:  { value: 0.9 },
      uSpeed:    { value: 0.8 }, // Cần xác nhận tốc độ
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uGlow;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uSpeed;
      varying vec2 vUv;
      void main() {
        float t = fract(vUv.x - uTime * uSpeed);
        float pulse = smoothstep(0.0, 0.15, t) * smoothstep(0.5, 0.3, t);
        vec3 col = mix(uColor, uGlow, pulse * 0.8);
        gl_FragColor = vec4(col, uOpacity * (0.7 + pulse * 0.3));
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });
}

export class RouteRenderer {
  constructor() {
    this._routeObjects = [];
    this._destMarker   = null;
    this._useShader    = false;
    this._drawProgress = 0; // 0..1 for draw-on animation
    this._isDrawing    = false;
    this._drawDuration = 800; // ms (Cần xác nhận)
    this._drawStart    = 0;
    this._pendingPath  = null;
    this._pendingScene = null;
    this._activeFloor  = null;
    this._time         = 0;
  }

  setUseShader(on) { this._useShader = on; }
  setActiveFloor(floorId) {
    this._activeFloor = floorId;
    this._updateFloorVisibility();
  }

  // Gọi để vẽ route mới, có animation draw-on
  drawRoute(pathNodes, scene, nowMs = 0) {
    this.clearRoute(scene);
    if (!pathNodes || pathNodes.length < 2) return;
    this._pendingPath  = pathNodes;
    this._pendingScene = scene;
    this._drawProgress = 0;
    this._isDrawing    = true;
    this._drawStart    = nowMs;
    // Vẽ full route ngay (draw-on sẽ điều chỉnh opacity thông qua progress)
    this._buildRouteObjects(pathNodes, scene);
  }

  _buildRouteObjects(pathNodes, scene) {
    const segments = splitRouteByFloor(pathNodes);
    this._segments = segments;

    for (const seg of segments) {
      if (seg.nodes.length < 2) continue;
      const pts = seg.nodes.map(n => new THREE.Vector3(n.x, (n.y ?? 0) + 0.35, n.z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
      const tubeSeg = Math.max(pts.length * 6, 20);
      const tubeGeo = new THREE.TubeGeometry(curve, tubeSeg, 0.11, 7, false);
      const tubeMat = makeRouteMaterial(this._useShader);
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.name = `__route_tube__${seg.floorId}`;
      tube.userData = { type: 'route', floorId: seg.floorId };
      tube.renderOrder = 1;
      scene.add(tube);
      this._routeObjects.push(tube);

      // Mũi tên tại điểm giữa đoạn
      for (let i = 0; i < pts.length - 1; i++) {
        const dir = pts[i + 1].clone().sub(pts[i]);
        if (dir.length() < 0.3) continue;
        dir.normalize();
        const mid = pts[i].clone().lerp(pts[i + 1], 0.5);
        const arrow = new THREE.ArrowHelper(dir, mid, 0.7, ARROW_COLOR, 0.28, 0.18);
        arrow.name = `__route_arrow__${seg.floorId}`;
        arrow.userData = { type: 'route', floorId: seg.floorId };
        scene.add(arrow);
        this._routeObjects.push(arrow);
      }
    }

    this._updateFloorVisibility();
  }

  _updateFloorVisibility() {
    for (const obj of this._routeObjects) {
      const fid = obj.userData?.floorId;
      const isActive = !this._activeFloor || fid === this._activeFloor;
      if (obj.material) {
        obj.material.opacity = isActive ? 0.9 : 0.2;
        obj.material.transparent = true;
      }
      if (obj.line?.material) obj.line.material.opacity = isActive ? 1 : 0.2;
      if (obj.cone?.material) obj.cone.material.opacity = isActive ? 1 : 0.2;
    }
  }

  // Đặt/xóa pin đích (drop-in animation được điều khiển từ main)
  setDestMarker(x, y, z, scene) {
    this.removeDestMarker(scene);
    // Thân pin: cylinder nhỏ + cone trên
    const group = new THREE.Group();
    group.name = '__dest_marker__';

    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: DEST_COLOR, emissive: new THREE.Color(DEST_GLOW), emissiveIntensity: 0.4 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.9;
    group.add(stem);

    const ballGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const ball = new THREE.Mesh(ballGeo, stemMat.clone());
    ball.position.y = 1.45;
    group.add(ball);

    group.position.set(x, y, z);
    group.userData = { type: 'dest_marker', dropProgress: 0 };
    scene.add(group);
    this._destMarker = group;
  }

  removeDestMarker(scene) {
    if (!scene || !this._destMarker) return;
    this._destMarker.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    scene.remove(this._destMarker);
    this._destMarker = null;
  }

  clearRoute(scene) {
    if (!scene) return;
    for (const obj of this._routeObjects) {
      if (obj.traverse) obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      else if (obj.geometry) obj.geometry.dispose();
      scene.remove(obj);
    }
    this._routeObjects = [];
    this._isDrawing = false;
    this._drawProgress = 0;
  }

  // Gọi mỗi frame; trả về true nếu còn animation
  update(nowMs) {
    let dirty = false;

    // Draw-on animation: dần hiện tube bằng cách thay đổi opacity từ 0→1
    if (this._isDrawing) {
      const elapsed = nowMs - this._drawStart;
      this._drawProgress = Math.min(elapsed / this._drawDuration, 1);
      for (const obj of this._routeObjects) {
        if (obj.material?.uniforms?.uOpacity !== undefined) {
          obj.material.uniforms.uOpacity.value = this._drawProgress * 0.9;
        } else if (obj.material) {
          const fid = obj.userData?.floorId;
          const isActive = !this._activeFloor || fid === this._activeFloor;
          obj.material.opacity = this._drawProgress * (isActive ? 0.9 : 0.2);
        }
      }
      if (this._drawProgress >= 1) this._isDrawing = false;
      dirty = true;
    }

    // Shader time update (hiệu ứng chạy)
    if (this._useShader && this._routeObjects.length > 0) {
      this._time = nowMs / 1000;
      for (const obj of this._routeObjects) {
        if (obj.material?.uniforms?.uTime !== undefined) {
          obj.material.uniforms.uTime.value = this._time;
        }
      }
      dirty = true;
    }

    // Dest marker drop-in (bounce)
    if (this._destMarker) {
      const dp = this._destMarker.userData.dropProgress ?? 0;
      if (dp < 1) {
        this._destMarker.userData.dropProgress = Math.min(dp + 0.08, 1); // Cần xác nhận tốc độ
        const t = this._destMarker.userData.dropProgress;
        // easeOutBounce
        let y;
        const n1 = 7.5625, d1 = 2.75;
        let tB = t;
        if (tB < 1/d1) y = n1*tB*tB;
        else if (tB < 2/d1) y = n1*(tB-=1.5/d1)*tB+0.75;
        else if (tB < 2.5/d1) y = n1*(tB-=2.25/d1)*tB+0.9375;
        else y = n1*(tB-=2.625/d1)*tB+0.984375;
        this._destMarker.scale.y = 0.1 + y * 0.9;
        dirty = true;
      }
    }

    return dirty;
  }

  get hasRoute() { return this._routeObjects.length > 0; }
}
