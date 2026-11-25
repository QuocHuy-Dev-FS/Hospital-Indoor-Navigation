/**
 * main.js — Hospital Indoor Navigation Prototype
 * Giai đoạn A+B+C: Quality tiers, tween, diện mạo mới, route effects, UI.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { scopeFloors, floorName, isRoomTap } from './ui/floorScope.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader }   from 'three/examples/jsm/loaders/GLTFLoader.js';

import { SceneBuilder } from './scene/SceneBuilder.js';
import { RouteRenderer } from './scene/RouteRenderer.js';
import { PositionMarker } from './scene/PositionMarker.js';
import { QualityManager } from './quality/QualityManager.js';
import { TweenManager, Tween, Easing } from './utils/tween.js';
import { buildGraph, astar } from './nav/astar.js';
import { generateInstructions, speakInstructions } from './nav/instructions.js';
import { RoomSearch, normalizeViet } from './search/search.js';
import { BeaconSimulator } from './positioning/beacon_sim.js';
import { showToast } from './ui/toast.js';
import { createMapFlow, STATES } from './ui/mapFlow.js';
import { createPositionProvider } from './positioning/position_provider.js';
import { loadGeofenceConfig, checkCampus, geofenceMessage } from './positioning/geofence.js';
import { summarizeRoute, pathUsesStairs, remainingDistance, landmarkHint } from './nav/route_summary.js';
import { BeaconLayer } from './scene/BeaconLayer.js';
import { initVisitUI } from './ui/visitUI.js';
import { roomsWithBeacons, filterRoomsWithBeacon } from './positioning/beacon_placement.js';

// ─── URL Params ───────────────────────────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const isKiosk  = params.has('kiosk');
const isDev    = params.has('dev');
const isDebug  = params.has('debug');
const isMock   = params.has('mock'); // ?mock=1 — phát chuỗi phòng giả theo tuyến
if (isKiosk) document.body.classList.add('kiosk-mode');
const isForce2D = params.has('force2d');

// ─── WebGL fallback ───────────────────────────────────────────────────────────
// reason: 'no-webgl' | 'renderer-failed' | 'force2d'
// error: Error object (hiển thị lỗi thật + nút sao chép)
function showWebGLFallback(reason, error = null) {
  document.getElementById('loading-overlay').style.display = 'none';
  // Ẩn splash để tránh hiển thị đồng thời với fallback
  const splash = document.getElementById('splash');
  if (splash) splash.hidden = true;

  const fb = document.getElementById('webgl-fallback');
  if (!fb) return;

  const errArea = document.getElementById('fb-error-area');

  if (reason === 'force2d') {
    // Chế độ 2D chủ động — ẩn thông báo lỗi
    const t = document.getElementById('fb-title');
    if (t) t.textContent = 'Bản đồ 2D';
    if (errArea) errArea.hidden = true;
  } else {
    // WebGL thật sự lỗi — hiện thông báo lỗi
    if (errArea) errArea.hidden = false;
    if (reason === 'renderer-failed') {
      const t = document.getElementById('fb-title');
      if (t) t.textContent = 'Không khởi tạo được đồ họa 3D';
      const d = document.getElementById('fb-desc');
      if (d) d.textContent = 'Trình duyệt hỗ trợ WebGL nhưng THREE.WebGLRenderer khởi tạo thất bại. Thử bật tăng tốc phần cứng hoặc cập nhật driver.';
    }
    // Hiện lỗi thật
    if (error) {
      const msgEl = document.getElementById('fb-error-msg');
      if (msgEl) {
        msgEl.textContent = error.message || String(error);
        msgEl.hidden = false;
      }
      const copyBtn = document.getElementById('fb-copy-error');
      if (copyBtn) {
        copyBtn.hidden = false;
        const fullErr = `${error.message || error}\n${error.stack ?? ''}`.trim();
        copyBtn.onclick = () => {
          navigator.clipboard?.writeText(fullErr).catch(() => {});
          copyBtn.textContent = '✓ Đã sao chép';
          setTimeout(() => { copyBtn.textContent = '📋 Sao chép lỗi'; }, 2000);
        };
      }
    }
  }

  fb.hidden = false;
}

if (isForce2D) {
  // Người dùng chủ động yêu cầu 2D — giữ loading overlay đến khi map sẵn sàng
  setLoading('Đang tải bản đồ 2D…');
  _load2DMode(true); // async hoisted — chạy sau throw
  throw new Error('force2d');
}
// hasWebGL() dùng làm cảnh báo chẩn đoán, không chặn — để Three.js tự thử.
// Nếu renderer thật sự lỗi, catch block bên dưới xử lý đúng.
if (!QualityManager.hasWebGL()) {
  console.warn('[WebGL] hasWebGL()=false — vẫn thử tạo Three.js renderer; nếu thành công thì OK.');
}

// ─── State ────────────────────────────────────────────────────────────────────
let data      = {};
let graph     = null;
let searcher  = null;
let beaconSim = null;
let builder   = null;
let activeFloor = 'F1';
let _bridgeSource = null;   // BridgeSource instance (điện thoại nhận từ laptop)
let _navMode = false;       // true khi đang ở chế độ "Bắt đầu"
let _mockTimer = null;      // interval cho mock mode
let viewMode  = 'single';
let currentRoute   = null;
let currentStepIdx = 0;
let simPosition    = null;
let _sceneReady = false;
let glbModel = null;
let cameraTween = null;
let pointerStart = null;
const activePointers = new Set();
let _isSampleData  = false; // true khi dùng sampleModel.js thay vì data thật

// Nguồn vị trí hợp nhất (chỉ trong bộ nhớ). `simPosition` được đồng bộ từ đây.
const positionProvider = createPositionProvider();

// Luồng di động "Khám phá bản đồ 3D" (bản thử nghiệm) — xem khối "Mobile flow" bên dưới.
let mapFlow = null;           // tạo khi mobile-flow được bật lần đầu
let _mfFollow = true;         // S3: camera bám theo vị trí

// ─── Quality Manager ──────────────────────────────────────────────────────────
const quality = new QualityManager();

// ─── Tween Manager ────────────────────────────────────────────────────────────
const tweens = new TweenManager();

// ─── Three.js setup ───────────────────────────────────────────────────────────
const canvas = document.getElementById('three-canvas');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.tier !== 'low' });
} catch (e) {
  console.error('[WebGL] THREE.WebGLRenderer init failed:', e);
  showWebGLFallback('renderer-failed', e);
  _load2DMode(false); // async hoisted
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping      = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
quality.applyToRenderer(renderer);

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0xEDF4F1);
const environmentGenerator=new THREE.PMREMGenerator(renderer);
const environmentRoom=new RoomEnvironment();
const environmentTarget=environmentGenerator.fromScene(environmentRoom,.04,0.1,100);
scene.environment=environmentTarget.texture;
scene.environmentIntensity=.3;
environmentRoom.dispose();environmentGenerator.dispose();

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
camera.position.set(17, 40, 60);
camera.lookAt(17, 0, 21);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.07;
controls.minDistance    = 3;
controls.maxDistance    = 300;
controls.maxPolarAngle  = Math.PI / 2 - 0.08;
controls.minPolarAngle = 0.18;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.7;
controls.panSpeed = 0.7;
controls.target.set(17, 0, 21);
controls.update();

// Controls dirty → request render
controls.addEventListener('change', () => quality.requestRender());
controls.addEventListener('start', () => {
  cameraTween?.cancel(); cameraTween = null; quality.setAnimating(true);
  if (mapFlow && _mfActive() && mapFlow.state === STATES.NAV && _mfFollow) { _mfFollow = false; _mfRenderNav(); }
});
controls.addEventListener('end',    () => quality.setAnimating(false));

// ─── Lighting theo tier ───────────────────────────────────────────────────────
const cfg = quality.getTierConfig();

const hemiLight=new THREE.HemisphereLight(0xe6f4ff,0x9eaf94,.8);
scene.add(hemiLight);
const dirLight=new THREE.DirectionalLight(0xfff4df,2.2);
dirLight.position.set(-15,45,30);dirLight.target.position.set(17,0,20);
scene.add(dirLight.target);scene.add(dirLight);
const fillLight=new THREE.DirectionalLight(0xd8eeff,.4);fillLight.position.set(45,25,-15);scene.add(fillLight);
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.enabled=true;
dirLight.castShadow=true;
dirLight.shadow.mapSize.set(quality.tier==='low'?1024:2048,quality.tier==='low'?1024:2048);
Object.assign(dirLight.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:100});
dirLight.shadow.bias=-.00012;dirLight.shadow.normalBias=.055;dirLight.shadow.radius=3;
// Static model: reuse the shadow map until changing floor or view.
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;

// Sương mù nhẹ (medium+)
// Keep the small three-floor model crisp; no distance fog.

// ─── Post-processing (medium+) ────────────────────────────────────────────────
let composer = null, outlinePass = null;
async function initPostProcessing() {
  if (!cfg.usePostProcessing) return;
  try {
    const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass }     = await import('three/examples/jsm/postprocessing/RenderPass.js');
    const { FXAAPass }       = await import('three/examples/jsm/postprocessing/FXAAPass.js');
    const { OutputPass }     = await import('three/examples/jsm/postprocessing/OutputPass.js');

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    if (cfg.useOutline) {
      const { OutlinePass } = await import('three/examples/jsm/postprocessing/OutlinePass.js');
      const size = renderer.getSize(new THREE.Vector2());
      outlinePass = new OutlinePass(size, scene, camera);
      outlinePass.edgeStrength = 3;
      outlinePass.edgeThickness = 1.0;
      outlinePass.visibleEdgeColor.set(0xFFD54F);
      outlinePass.hiddenEdgeColor.set(0x222222);
      composer.addPass(outlinePass);
    }

    const fxaa = new FXAAPass();
    const sz = renderer.getSize(new THREE.Vector2());
    fxaa.material.uniforms['resolution'].value.set(1 / sz.x, 1 / sz.y);
    composer.addPass(fxaa);
    composer.addPass(new OutputPass());
  } catch (e) {
    console.warn('PostProcessing init failed, falling back:', e.message);
    composer = null;
  }
}

// ─── Scene modules ────────────────────────────────────────────────────────────
const routeRenderer = new RouteRenderer();
const posMarker     = new PositionMarker();

// ─── Labels overlay ───────────────────────────────────────────────────────────
const labelsDiv = document.createElement('div');
labelsDiv.id = 'labels-overlay';
labelsDiv.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
document.getElementById('canvas-wrap').appendChild(labelsDiv);

const labelStyle = document.createElement('style');
labelStyle.textContent = `
  .room-label {
    position:absolute; transform:translate(-50%,-50%); white-space:nowrap;
    background:rgba(255,255,255,0.88); color:#1a3a5e;
    padding:2px 7px; border-radius:20px; font-size:11px;
    pointer-events:none; border:1px solid rgba(100,150,210,0.3);
    box-shadow:0 1px 4px rgba(0,0,0,0.12); font-weight:500;
    transition: opacity 0.2s ease;
  }
  .room-label.label-selected {
    background:#2196F3; color:#fff; font-weight:700;
    border-color:#1565C0; font-size:12px;
  }
  .room-label.label-important { font-weight:600; }
  .lbl-icon { margin-right:3px; font-size:10px; }
`;
document.head.appendChild(labelStyle);

// ─── Debug overlay (chỉ khi ?debug=1) ────────────────────────────────────────
let debugOverlay = null;
if (isDebug) {
  debugOverlay = document.createElement('div');
  debugOverlay.id = 'debug-overlay';
  debugOverlay.style.cssText = `
    position:fixed; bottom:8px; left:8px; z-index:900;
    background:rgba(0,0,0,0.75); color:#0f0; font-family:monospace;
    font-size:11px; padding:6px 10px; border-radius:6px; pointer-events:none;
    line-height:1.6;
  `;
  document.body.appendChild(debugOverlay);
}

let _fps = 0, _fpsAccum = 0, _fpsCnt = 0, _fpsLastTime = 0;
function updateDebugOverlay(nowMs) {
  if (!debugOverlay) return;
  _fpsCnt++;
  _fpsAccum += nowMs - (_fpsLastTime || nowMs);
  _fpsLastTime = nowMs;
  if (_fpsAccum >= 500) {
    _fps = Math.round(_fpsCnt / (_fpsAccum / 1000));
    _fpsCnt = 0; _fpsAccum = 0;
  }
  const info = renderer.info.render;
  const dpr  = renderer.getPixelRatio();
  const loadTimeStr = _loadTime ? `${_loadTime}ms` : '…';
  debugOverlay.innerHTML =
    `FPS: ${_fps} | DCs: ${info.calls} | ▲: ${info.triangles} | Tier: ${quality.tier} | DPR: ${dpr.toFixed(1)} | Load: ${loadTimeStr}`;
  renderer.info.reset();
}
let _loadStart = performance.now();
let _loadTime  = 0;

// ─── Raycaster ────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();
let hoveredRoomId = null;

function getRoomMeshes() {
  return scene.children.filter(g => g.visible && (viewMode === 'all' || g.userData.floorId === activeFloor))
    .flatMap(g => g.children.filter(m => m.userData.type === 'room'));
}

function updatePointer(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

canvas.addEventListener('pointerdown', e => {
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) { if (pointerStart) pointerStart.moved = true; return; }
  pointerStart = { id:e.pointerId, x:e.clientX, y:e.clientY, moved:false };
});
canvas.addEventListener('pointermove', e => {
  if (pointerStart && Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6) pointerStart.moved=true;
  if (activePointers.size) return;
  updatePointer(e);
  const roomId=raycaster.intersectObjects(getRoomMeshes(), false)[0]?.object.userData.roomId ?? null;
  if(roomId !== hoveredRoomId) { builder?.hoverRoom(roomId); hoveredRoomId=roomId; quality.requestRender(); }
});
canvas.addEventListener('pointerup', e => {
  activePointers.delete(e.pointerId);
  const tap=isRoomTap(pointerStart,e);
  pointerStart=null;
  if(!tap) return;
  updatePointer(e);
  const hit=raycaster.intersectObjects(getRoomMeshes(),false)[0];
  if(!hit) { closeRoomSheet(); return; }
  const room=searcher?.getById(hit.object.userData.roomId);
  if(!room) return;
  if(mapFlow && _mfActive()) { _mfHandleTap(room); quality.requestRender(); return; }
  if(e.shiftKey) {
    // simPosition, marker và trạng thái do subscriber của positionProvider cập nhật
    positionProvider.setManual({roomId:room.id,floorId:room.floorId,source:'manual'});
    document.getElementById('btn-go-to-me').hidden=false;
  } else selectRoom(room);
  quality.requestRender();
});
const cancelPointer = e => { activePointers.delete(e.pointerId); pointerStart=null; };
canvas.addEventListener('pointercancel',cancelPointer);
canvas.addEventListener('lostpointercapture', e => { if(activePointers.has(e.pointerId)) cancelPointer(e); });
canvas.addEventListener('pointerleave', () => { builder?.hoverRoom(null); hoveredRoomId=null; quality.requestRender(); });


// ─── Resize ───────────────────────────────────────────────────────────────────
function onResize() {
  const wrap = document.getElementById('canvas-wrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  // Guard: nếu canvas-wrap ẩn (main-layout hidden) w/h = 0 → tránh NaN aspect.
  // showMain() sẽ gọi lại onResize() khi layout hiện ra.
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
  quality.requestRender();
}
window.addEventListener('resize', () => {
  onResize();
  // Mobile-flow: chỉ fit lại ở S0 (bàn phím ảo làm resize khi đang tìm kiếm/dẫn đường)
  const keepView = mapFlow && _mfActive() && mapFlow.state !== STATES.EXPLORE;
  if(_sceneReady && !keepView) resetMapView(false);
});
new ResizeObserver(onResize).observe(document.getElementById('canvas-wrap'));

// Camera moves only on an explicit focus/reset action. User gestures interrupt them.
function moveCamera(position, target, animateMove = true) {
  cameraTween?.cancel();
  cameraTween = null;
  const instant = !animateMove || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.update();
  if(instant) { camera.position.copy(position); controls.target.copy(target); controls.update(); quality.requestRender(); return; }
  cameraTween = tweens.add(new Tween({
    from:{cx:camera.position.x,cy:camera.position.y,cz:camera.position.z,tx:controls.target.x,ty:controls.target.y,tz:controls.target.z},
    to:{cx:position.x,cy:position.y,cz:position.z,tx:target.x,ty:target.y,tz:target.z},
    duration:280, easing:Easing.easeOut,
    onUpdate:v=> {camera.position.set(v.cx,v.cy,v.cz);controls.target.set(v.tx,v.ty,v.tz);quality.requestRender();},
    onComplete:()=> {cameraTween=null;quality.requestRender();},
  }));
}

function resetMapView(animateMove = true) {
  const box = new THREE.Box3();
  if(glbModel) box.setFromObject(glbModel);
  else for(const fid of builder?.getAllFloorIds() ?? []) {
    if(viewMode==='single' && fid!==activeFloor) continue;
    const group=builder.getFloorGroup(fid);
    group.updateWorldMatrix(true,true);
    for(const mesh of group.children) if(mesh.userData.type==='room') box.expandByObject(mesh);
  }
  if(box.isEmpty()) return;
  const center=box.getCenter(new THREE.Vector3());
  const radius=box.getBoundingSphere(new THREE.Sphere()).radius;
  const vFov=THREE.MathUtils.degToRad(camera.fov);
  const hFov=2*Math.atan(Math.tan(vFov/2)*camera.aspect);
  const distance=radius/Math.sin(Math.min(vFov,hFov)/2)*1.04;
  const direction=new THREE.Vector3(0.65,1.35,1.15).normalize();
  controls.minDistance=8;
  controls.maxDistance=Math.max(distance*2,100);
  moveCamera(center.clone().addScaledVector(direction,distance),center,animateMove);
}

function flyToPosition(targetPos) {
  const offset=camera.position.clone().sub(controls.target);
  offset.clampLength(18,38);
  moveCamera(targetPos.clone().add(offset),targetPos);
}

function flyToRoom(roomId) {
  const mesh=builder?.getRoomMesh(roomId);
  if(mesh) flyToPosition(mesh.getWorldPosition(new THREE.Vector3()));
}

// Camera bay đến vị trí với góc nhìn nghiêng ~50° (zoom gần hơn flyToPosition)
function flyToPositionTilted(targetPos, distOverride = null) {
  const dist = distOverride ?? 18;
  // Hướng nghiêng: camera ở phía trên-sau, target là vị trí marker
  const camPos = targetPos.clone().add(new THREE.Vector3(0, dist * Math.tan(THREE.MathUtils.degToRad(50)), dist * 0.6));
  moveCamera(camPos, targetPos);
}


// ─── Render loop ──────────────────────────────────────────────────────────────
function animate(nowMs = 0) {
  requestAnimationFrame(animate);

  const hasTween   = tweens.update(nowMs);
  const hasRoute   = routeRenderer.update(nowMs);
  const hasPulse   = posMarker.isVisible;

  // FPS measurement trong giai đoạn đầu
  quality.recordFrame(nowMs);
  if (hasPulse) quality.requestRender();
  if (hasTween || hasRoute) quality.setAnimating(true);
  else if (!hasTween && !hasRoute) quality.setAnimating(false);

  controls.update();

  if (!quality.shouldRender()) return;

  _mfPreRender();
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

  builder?.updateLabels(camera, renderer);
  _mfOverlayUpdate();
  posMarker.update(nowMs);
  updateDebugOverlay(nowMs);
}

// ─── Load data ────────────────────────────────────────────────────────────────
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${url} ${res.status}`);
  return res.json();
}

// Dựng Three.js scene từ `data` (đã được gán trước khi gọi).
// Tách ra để dùng lại cho cả data thật và sample model.
async function _buildScene() {
  setLoading('Đang dựng mô hình 3D…');
  await new Promise(r => setTimeout(r, 10));

  builder = new SceneBuilder(data.coordSys);
  builder.setUseEdges(cfg.useEdges);
  builder.buildAll(data.floors, data.rooms, scene, data.nodes);

  routeRenderer.setUseShader(cfg.useRouteShader);

  graph     = buildGraph(data.nodes, data.edges);
  searcher  = new RoomSearch(data.rooms);
  beaconSim = new BeaconSimulator(data.beacons);

  _loadTime = Math.round(performance.now() - _loadStart);

  // Khởi tạo post-processing sau khi scene sẵn sàng
  await initPostProcessing();

  hideLoading();
  // Hiện badge dữ liệu mẫu nếu cần
  if (_isSampleData) document.getElementById('sample-data-badge')?.removeAttribute('hidden');
  initUI();
  _initVisit();
  onResize();
  setActiveFloor(data.floors[0]?.id ?? 'F1');
  _sceneReady = true;

  // Chế độ "Gán beacon" — chỉ dev server, desktop; build không có route ghi nên tự ẩn.
  if (import.meta.env.DEV && !isKiosk && !_isSampleData) {
    import('./ui/beaconPlacementUI.js').then(m => m.initBeaconPlacement({
      builder, canvas, camera, raycaster, updatePointer,
      getActiveFloor: () => activeFloor, getViewMode: () => viewMode,
      getRoomMeshes, getRoomName: id => searcher?.getById(id)?.name,
      floors: data.floors, coordSys: data.coordSys,
      requestRender: () => quality.requestRender(), toast: showToast,
    })).catch(err => console.warn('[beacon-placement]', err?.message));
  }

  // Áp dụng vị trí ?at=/?from= sau khi scene sẵn sàng
  const _urlRoomParam = params.get('from') ?? params.get('at');
  if (simPosition && _urlRoomParam) {
    positionProvider.setManual({ roomId: simPosition.roomId, source: 'url' });
    updatePositionStatus('manual', simPosition.roomName);
    showToast(`Vị trí xuất phát: ${simPosition.roomName}`, 'success');
    setActiveFloor(activeFloor);
    const node = getRoomDoorNode(simPosition.roomId);
    if (node) {
      posMarker.setPosition(node.x, node.y ?? 0, node.z, scene);
      document.getElementById('btn-go-to-me').hidden = false;
      flyToPositionTilted(new THREE.Vector3(node.x, node.y ?? 0, node.z));
    }
  } else if (_urlRoomParam) {
    showToast(`Không tìm thấy phòng "${_urlRoomParam}". Hãy chọn vị trí thủ công.`, 'info');
  }

  // Hiện badge MOCK
  if (isMock) document.getElementById('nav-mock-badge')?.removeAttribute('hidden');

  // Kích hoạt BLE adapter khi ?beacon=real
  if (params.get('beacon') === 'real') {
    _startBLEAdapter();
  }

  quality.startFpsMeasure();
  quality.onTierChange((newTier, oldTier, fps) => {
    console.info(`[Quality] Tier: ${oldTier}→${newTier}, FPS avg: ${fps.toFixed(1)}`);
    showToast(`Chế độ đồ họa tự động chuyển: ${newTier}`, 'info');
    quality.applyToRenderer(renderer);
    renderer.shadowMap.needsUpdate=true;
  });

  animate();

  document.getElementById('btn-interior')?.addEventListener('click',()=>{
    const visible=document.getElementById('btn-interior').getAttribute('aria-pressed')!=='true';
    document.getElementById('btn-interior').setAttribute('aria-pressed',String(visible));
    for(const id of builder.getAllFloorIds())builder.getFloorGroup(id).traverse(obj=>{if(obj.userData.type==='interior' && obj.name.startsWith('interior-') && !obj.name.includes(':base') && !obj.name.includes(':lawn'))obj.visible=visible;});
    renderer.shadowMap.needsUpdate=true;quality.requestRender();
  });

  // Fallback search cho webgl-fallback (nếu cần)
  _setupFallbackSearch(data.rooms);
}

// ─── GLB loader helper (dùng cho ?model=glb) ─────────────────────────────────
function _loadGLBIntoScene(url) {
  setLoading(`Đang tải GLB: ${url}`);
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        scene.add(gltf.scene);
        glbModel = gltf.scene;
        _sceneReady = true;
        document.body.classList.add('glb-view');
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x + maxDim, center.y + maxDim * 0.8, center.z + maxDim);
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
        hideLoading();
        animate();
        showMain();
        document.getElementById('btn-reset-view').addEventListener('click', () => resetMapView());
        console.info('[GLB] Loaded:', url, '| meshes:', gltf.scene.children.length);
        resolve(gltf);
      },
      (xhr) => setLoading(`GLB ${Math.round(xhr.loaded / (xhr.total || 1) * 100)}%…`),
      (err) => { showLoading(`Lỗi tải GLB: ${err.message}`); reject(err); }
    );
  });
}

async function loadAll() {
  setLoading('Đang tải dữ liệu…');

  // Nhánh ?model=glb — load trực tiếp GLB vào scene, bỏ qua SceneBuilder
  if (params.get('model') === 'glb') {
    const glbUrl = params.get('glb') ?? '/assets/models/F1_dollhouse_provisional.glb';
    try { await _loadGLBIntoScene(glbUrl); } catch (_) {}
    return;
  }

  // Bước 1: tải dữ liệu thật; nếu thất bại, dùng dữ liệu mẫu hardcoded
  try {
    const [coordSys, floors, rooms, nodes, edges, connectors, beacons, manifest] = await Promise.all([
      loadJSON('/data/coordinate_system.json'),
      loadJSON('/data/floors.json'),
      loadJSON('/data/rooms.json'),
      loadJSON('/data/nodes.json'),
      loadJSON('/data/edges.json'),
      loadJSON('/data/connectors.json'),
      loadJSON('/data/beacons.json'),
      loadJSON('/data/manifest.json'),
    ]);
    data = { coordSys, floors, rooms, nodes, edges, connectors, beacons, manifest };
  } catch (fetchErr) {
    console.warn('[Data] Không tải được data thật:', fetchErr.message, '— dùng mô hình mẫu.');
    try {
      const { SAMPLE_DATA } = await import('./scene/sampleModel.js');
      data = SAMPLE_DATA;
      _isSampleData = true;
    } catch (sampleImportErr) {
      showLoading(`Lỗi tải dữ liệu: ${fetchErr.message}`);
      console.error('[Data]', fetchErr);
      return;
    }
  }

  data = scopeFloors(data);

  // Xử lý ?at=<roomId> hoặc ?from=<roomId> — đặt vị trí xuất phát qua URL/QR
  const atRoomId = params.get('from') ?? params.get('at');
  if (atRoomId) {
    const atRoom = (data.rooms ?? []).find(r => r.id === atRoomId);
    if (atRoom) {
      simPosition = { roomId: atRoom.id, roomName: atRoom.name };
      const floorId = atRoom.id.split('_')[0];
      if (floorId) activeFloor = floorId;
    } else {
      console.warn('[?from/?at] Không tìm thấy roomId:', atRoomId);
    }
  }

  // Bước 2: dựng Three.js scene (với data thật hoặc mẫu)
  try {
    await _buildScene();
  } catch (buildErr) {
    showLoading(`Lỗi dựng mô hình: ${buildErr.message}`);
    console.error('[Build]', buildErr);
  }
}

function _setupFallbackSearch(rooms) {
  const fbSearch = document.getElementById('fb-search');
  const fbResults = document.getElementById('fb-results');
  if (!fbSearch || !fbResults) return;
  fbSearch.addEventListener('input', () => {
    const q = fbSearch.value.trim();
    fbResults.innerHTML = '';
    if (!q) return;
    const results = searcher.search(q, 10);
    for (const room of results) {
      const li = document.createElement('li');
      li.textContent = `${room.name} (${room.floorId})`;
      fbResults.appendChild(li);
    }
  });
}

// Tải dữ liệu và khởi tạo bản đồ 2D (+ tìm kiếm, tìm đường).
// Hàm khai báo (hoisted) — được gọi trước throw ở đầu module.
// isForce=true: chế độ ?force2d=1; false: WebGL/renderer thất bại.
async function _load2DMode(isForce = false) {
  try {
    const toJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); };
    const [rawCoord, rawFloors, rawRooms, rawNodes, rawEdges] = await Promise.all([
      toJSON('/data/coordinate_system.json'),
      toJSON('/data/floors.json'),
      toJSON('/data/rooms.json'),
      toJSON('/data/nodes.json'),
      toJSON('/data/edges.json'),
    ]);

    const scoped=scopeFloors({coordSys:rawCoord,floors:rawFloors,rooms:rawRooms,nodes:rawNodes,edges:rawEdges});
    const {coordSys,floors,rooms,nodes,edges}=scoped;

    // Trong chế độ force2d: ẩn loading overlay, hiện fallback với title "Bản đồ 2D"
    if (isForce) showWebGLFallback('force2d');

    // ── Text search (legacy #fb-search) ────────────────────────────────────
    const roomSearcher = new RoomSearch(rooms);
    const fbInput = document.getElementById('fb-search');
    const fbList  = document.getElementById('fb-results');
    if (fbInput && fbList) {
      fbInput.addEventListener('input', () => {
        const q = fbInput.value.trim();
        fbList.innerHTML = '';
        if (!q) { fbList.hidden = true; return; }
        roomSearcher.search(q, 10).forEach(room => {
          const li = document.createElement('li');
          li.textContent = `${room.name} · ${room.floorId}`;
          li.style.cursor = 'pointer';
          li.addEventListener('mousedown', () => {
            if (map2d) { map2d.highlightRoom(room.id); if (room.floorId !== map2d._activeFloor) map2d.setActiveFloor(room.floorId); }
            fbInput.value = room.name;
            fbList.hidden = true;
          });
          fbList.appendChild(li);
        });
        fbList.hidden = fbList.children.length === 0;
      });
      fbList.hidden = true;
      fbInput.focus();
    }

    // ── Bản đồ 2D SVG ──────────────────────────────────────────────────────
    const mapArea = document.getElementById('map2d-area');
    if (!mapArea) return;

    const { Map2D } = await import('./map2d/Map2D.js');
    const map2d = new Map2D(mapArea);
    map2d.init(floors, rooms, nodes, coordSys);
    map2d.onRoomSelect(room => { if (fbInput) fbInput.value = room.name; });
    mapArea.hidden = false;

    // ── Tìm đường 2D ────────────────────────────────────────────────────────
    const navDiv = document.getElementById('fb-2d-nav');
    if (navDiv) {
      navDiv.hidden = false;
      const fromInput  = document.getElementById('fb-nav-from');
      const toInput    = document.getElementById('fb-nav-to');
      const findBtn    = document.getElementById('fb-find-route');
      const routeInfo  = document.getElementById('fb-route-info');
      const clearBtn   = document.getElementById('fb-clear-route');
      const graph2d    = buildGraph(nodes, edges);
      const roomById   = Object.fromEntries(rooms.map(r => [r.id, r]));

      // Autocomplete cho from/to
      [[fromInput, 'fb-from-list'], [toInput, 'fb-to-list']].forEach(([inp, listId]) => {
        if (!inp) return;
        let lst = document.getElementById(listId);
        if (!lst) { lst = document.createElement('ul'); lst.id = listId; lst.className = 'fb-results'; lst.hidden = true; inp.parentElement.appendChild(lst); }
        inp.addEventListener('input', () => {
          const q = inp.value.trim();
          lst.innerHTML = '';
          if (!q) { lst.hidden = true; return; }
          roomSearcher.search(q, 6).forEach(room => {
            const li = document.createElement('li');
            li.textContent = `${room.name} · ${room.floorId}`;
            li.addEventListener('mousedown', () => { inp.value = room.name; inp.dataset.roomId = room.id; lst.hidden = true; });
            lst.appendChild(li);
          });
          lst.hidden = lst.children.length === 0;
        });
        inp.addEventListener('blur', () => setTimeout(() => { lst.hidden = true; }, 200));
      });

      findBtn?.addEventListener('click', () => {
        const fromId = fromInput?.dataset.roomId;
        const toId   = toInput?.dataset.roomId;
        if (!fromId || !toId) { if (routeInfo) { routeInfo.textContent = 'Vui lòng chọn điểm xuất phát và điểm đến.'; routeInfo.hidden = false; } return; }
        const fromRoom = roomById[fromId], toRoom = roomById[toId];
        if (!fromRoom?.doorNodeId || !toRoom?.doorNodeId) { if (routeInfo) { routeInfo.textContent = 'Không tìm thấy nút cửa cho phòng.'; routeInfo.hidden = false; } return; }
        const result = astar(graph2d, fromRoom.doorNodeId, toRoom.doorNodeId);
        if (!result) { if (routeInfo) { routeInfo.textContent = 'Không tìm thấy đường đi.'; routeInfo.hidden = false; } return; }
        const pathNodes = result.path.map(id => nodes.find(n => n.id === id)).filter(Boolean);
        map2d.setRoute(pathNodes);
        if (routeInfo) { routeInfo.textContent = `Khoảng cách: ~${result.cost.toFixed(0)} m`; routeInfo.hidden = false; }
        if (toRoom.floorId !== map2d._activeFloor) map2d.setActiveFloor(toRoom.floorId);
        map2d.highlightRoom(toId);
      });

      clearBtn?.addEventListener('click', () => {
        map2d.clearRoute();
        if (fromInput) { fromInput.value = ''; delete fromInput.dataset.roomId; }
        if (toInput)   { toInput.value   = ''; delete toInput.dataset.roomId;   }
        if (routeInfo) routeInfo.hidden = true;
      });
    }
  } catch (e) {
    console.warn('[2D Mode] Lỗi tải dữ liệu:', e.message);
    // Nếu lỗi khi tải, hiện thông báo trong fallback
    const fbInput = document.getElementById('fb-search');
    if (fbInput) fbInput.placeholder = 'Không tải được dữ liệu qua HTTP server';
  }
}

// ─── UI Init ─────────────────────────────────────────────────────────────────
function initUI() {
  // Floor strip (dọc) + floor buttons (panel)
  const fbWrap = document.getElementById('floor-buttons');
  const floorStrip = document.getElementById('floor-strip');

  for (const fl of data.floors) {
    // Panel button
    if (fbWrap) {
      const btn = document.createElement('button');
      btn.className = 'floor-btn' + (fl.id === activeFloor ? ' active' : '');
      btn.textContent = fl.name;
      btn.setAttribute('aria-label', fl.name);
      btn.setAttribute('aria-pressed', String(fl.id === activeFloor));
      btn.dataset.floorId = fl.id;
      btn.addEventListener('click', () => setActiveFloor(fl.id));
      fbWrap.appendChild(btn);
    }
    // Floor strip
    if (floorStrip) {
      const btn2 = document.createElement('button');
      btn2.className = 'strip-btn' + (fl.id === activeFloor ? ' active' : '');
      btn2.textContent = fl.level;
      btn2.setAttribute('aria-label', `Tầng ${fl.level}`);
      btn2.dataset.floorId = fl.id;
      btn2.addEventListener('click', () => setActiveFloor(fl.id));
      floorStrip.appendChild(btn2);
    }
  }

  // Explicit mode changes fit once; no overlapping floor animations.
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if(viewMode===btn.dataset.mode) return;
      cameraTween?.cancel();
      viewMode=btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active',b===btn); b.setAttribute('aria-pressed',String(b===btn));
      });
      builder.setViewMode(viewMode,activeFloor);
      builder.setActiveFloor(activeFloor);
      updateMapCaption();
      resetMapView(); quality.requestRender();
    });
  });


  document.getElementById('nav-route')?.addEventListener('click',()=>{
    if(document.body.classList.contains('panel-collapsed'))document.getElementById('btn-menu').click();
    document.getElementById('nav-from').focus();
    document.getElementById('nav-from').scrollIntoView({block:'nearest'});
  });
  document.getElementById('nav-map')?.addEventListener('click',()=>{closeRoomSheet();resetMapView();});
  const help=document.getElementById('map-help-dialog');
  document.getElementById('nav-help')?.addEventListener('click',()=>help.showModal());

  document.getElementById('btn-close-help')?.addEventListener('click',()=>help.close());
  // Search
  const searchInput = document.getElementById('search-input');
  const suggestions = document.getElementById('search-suggestions');
  setupCombobox(searchInput,suggestions);
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) { suggestions.hidden = true; return; }
    const results = searcher.search(q, 8);
    renderSuggestions(suggestions, results, (room) => {
      selectRoom(room);
      searchInput.value = room.name;
      suggestions.hidden = true;
    });
    suggestions.hidden = results.length === 0;
    searchInput.setAttribute('aria-expanded',String(!suggestions.hidden));
    document.getElementById('search-feedback').textContent=results.length?`${results.length} kết quả`:'Không tìm thấy phòng trong ba tầng.';
  });
  searchInput?.addEventListener('blur', () => setTimeout(() => { suggestions.hidden = true; }, 200));

  setupNavInput('nav-from', 'nav-from-suggestions');
  setupNavInput('nav-to', 'nav-to-suggestions');

  document.getElementById('btn-find-route')?.addEventListener('click', findRoute);
  document.getElementById('btn-use-position')?.addEventListener('click', useSimPosition);
  document.getElementById('btn-clear-route')?.addEventListener('click', clearRoute);
  document.getElementById('btn-next-step')?.addEventListener('click', nextStep);
  document.getElementById('btn-prev-step')?.addEventListener('click', prevStep);
  document.getElementById('btn-start-nav')?.addEventListener('click', startNavMode);
  document.getElementById('btn-reached-waypoint')?.addEventListener('click', () => { nextStep(); _updateNavBanner(); });
  document.getElementById('btn-nav-go-to-me')?.addEventListener('click', () => {
    if (!simPosition) return;
    const node = getRoomDoorNode(simPosition.roomId);
    if (node) flyToPositionTilted(new THREE.Vector3(node.x, node.y ?? 0, node.z));
  });
  document.getElementById('btn-exit-nav')?.addEventListener('click', exitNavMode);
  document.getElementById('btn-recalculate')?.addEventListener('click', () => {
    if (!simPosition || !currentRoute) return;
    // Tính lại từ vị trí hiện tại đến đích
    const destId = document.getElementById('nav-to')?.dataset.roomId;
    if (destId) {
      document.getElementById('nav-from').value = simPosition.roomName ?? '';
      document.getElementById('nav-from').dataset.roomId = simPosition.roomId;
      findRoute();
      document.getElementById('nav-off-route-banner').hidden = true;
      _updateNavBanner();
    }
  });
  document.getElementById('btn-nav-new-route')?.addEventListener('click', () => {
    exitNavMode();
    clearRoute();
    document.getElementById('nav-arrived-banner').hidden = true;
  });

  // Bridge source connect
  document.getElementById('btn-bridge-connect')?.addEventListener('click',
    () => _connectBridgeSource(document.getElementById('bridge-code-input')?.value));

  // Mock mode auto-start khi có route
  if (isMock) _setupMockMode();

  document.getElementById('btn-read-aloud')?.addEventListener('click', () => {
    if (!currentRoute) return;
    if (!window.speechSynthesis) { showToast('Trình duyệt không hỗ trợ đọc to.', 'error'); return; }
    speakInstructions(currentRoute.steps);
  });

  // Font size cycle
  document.getElementById('btn-font-size')?.addEventListener('click', () => {
    const cur = localStorage.getItem('fontSize') ?? 'normal';
    const next = cur === 'normal' ? 'large' : cur === 'large' ? 'xlarge' : 'normal';
    document.body.classList.remove('large-text', 'xlarge-text');
    if (next === 'large')  document.body.classList.add('large-text');
    if (next === 'xlarge') { document.body.classList.add('large-text'); document.body.classList.add('xlarge-text'); }
    localStorage.setItem('fontSize', next);
    document.querySelectorAll('.splash-font-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.size === next);
    });
  });

  // Contrast toggle
  document.getElementById('btn-contrast')?.addEventListener('click', () => {
    document.body.classList.toggle('high-contrast');
    localStorage.setItem('highContrast', document.body.classList.contains('high-contrast') ? '1' : '0');
  });

  // Saving mode toggle
  document.getElementById('btn-saving-mode')?.addEventListener('click', () => {
    const on = !quality.savingMode;
    quality.setSavingMode(on);
    const btn = document.getElementById('btn-saving-mode');
    btn.textContent = on ? 'Chế độ tiêu chuẩn' : 'Tiết kiệm pin';
    btn.setAttribute('aria-pressed', String(on));
    quality.applyToRenderer(renderer);
    showToast(on ? 'Đã bật chế độ tiết kiệm' : 'Đã tắt chế độ tiết kiệm', 'info');
  });
  // Sync saving mode button state
  const smBtn = document.getElementById('btn-saving-mode');
  if (smBtn) {
    smBtn.textContent = quality.savingMode ? 'Chế độ tiêu chuẩn' : 'Tiết kiệm pin';
    smBtn.setAttribute('aria-pressed', String(quality.savingMode));
  }

  // Search shortcuts
  document.querySelectorAll('.shortcut-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.query ?? '';
      const si = document.getElementById('search-input');
      if (si) { si.value = q; si.dispatchEvent(new Event('input')); si.focus(); }
    });
  });

  // Manual position
  setupNavInput('manual-pos-input', 'manual-pos-suggestions', (room) => {
    // simPosition, marker và trạng thái do subscriber của positionProvider cập nhật
    positionProvider.setManual({ roomId: room.id, floorId: room.floorId, source: 'manual' });
    document.getElementById('position-manual-wrap').hidden = true;
    document.getElementById('btn-go-to-me').hidden = false;
    showToast(`Vị trí đã đặt: ${room.name}`, 'success');
    quality.requestRender();
  });
  document.getElementById('btn-set-manual-pos')?.addEventListener('click', () => {
    const wrap = document.getElementById('position-manual-wrap');
    if (wrap) {
      wrap.hidden = !wrap.hidden;
      if (!wrap.hidden) document.getElementById('manual-pos-input')?.focus();
    }
  });

  // "Về vị trí"
  document.getElementById('btn-go-to-me')?.addEventListener('click', () => {
    if (!simPosition) { showToast('Chưa có vị trí. Hãy chọn vị trí thủ công.', 'info'); return; }
    const node = getRoomDoorNode(simPosition.roomId);
    if (node) {
      flyToPosition(new THREE.Vector3(node.x, node.y ?? 0, node.z));
      const flId = simPosition.roomId.split('_')[0];
      if (flId !== activeFloor) setActiveFloor(flId);
    }
  });

  // "Tìm đường mới"
  document.getElementById('btn-new-route')?.addEventListener('click', () => {
    clearRoute();
    document.getElementById('arrived-section').hidden = true;
  });

  // AR placeholder
  document.getElementById('btn-ar')?.addEventListener('click', () => {
    showToast('AR — Sắp có ở Phase 7. Hiện chưa khả dụng.', 'info');
  });

  document.getElementById('btn-reset-view')?.addEventListener('click', () => resetMapView());
  document.getElementById('btn-focus-room')?.addEventListener('click', () => {
    const rid=document.getElementById('room-sheet').dataset.roomId;
    if(rid) flyToRoom(rid);
  });
  document.getElementById('btn-menu')?.addEventListener('click', () => {
    const collapsed=document.body.classList.toggle('panel-collapsed');
    const btn=document.getElementById('btn-menu');
    btn.setAttribute('aria-expanded',String(!collapsed));
    btn.setAttribute('aria-label',collapsed?'Hiện bảng dẫn đường':'Ẩn bảng dẫn đường');
    onResize();resetMapView(false);
  });


  // Room sheet
  document.getElementById('btn-close-sheet')?.addEventListener('click', closeRoomSheet);
  document.getElementById('btn-nav-to-room')?.addEventListener('click', () => {
    const rid = document.getElementById('room-sheet')?.dataset.roomId;
    if (rid) {
      document.getElementById('nav-to').value = searcher.getById(rid)?.name ?? rid;
      document.getElementById('nav-to').dataset.roomId = rid;
      closeRoomSheet();
    }
  });
  document.getElementById('btn-nav-from-room')?.addEventListener('click', () => {
    const rid = document.getElementById('room-sheet')?.dataset.roomId;
    if (rid) {
      document.getElementById('nav-from').value = searcher.getById(rid)?.name ?? rid;
      document.getElementById('nav-from').dataset.roomId = rid;
      closeRoomSheet();
    }
  });

  // Dev tools
  if (isDev) {
    document.getElementById('dev-tools').hidden = false;
    document.getElementById('btn-export-glb')?.addEventListener('click', exportGLB);
    const lostBtn = document.createElement('button');
    lostBtn.className = 'btn-secondary small';
    lostBtn.textContent = '📡 Mất tín hiệu';
    lostBtn.addEventListener('click', () => {
      if (beaconSim.isSignalLost()) {
        beaconSim.restoreSignal();
        document.getElementById('signal-lost-banner').hidden = true;
        lostBtn.textContent = '📡 Mất tín hiệu';
        updatePositionStatus('sim');
        if (posMarker.isVisible) posMarker.setPosition(
          posMarker.getPosition().x, posMarker.getPosition().y, posMarker.getPosition().z, scene, { lowConfidence: false }
        );
      } else {
        beaconSim.simulateLostSignal();
        document.getElementById('signal-lost-banner').hidden = false;
        lostBtn.textContent = '📡 Khôi phục tín hiệu';
        updatePositionStatus('lost');
        if (posMarker.isVisible) posMarker.setPosition(
          posMarker.getPosition().x, posMarker.getPosition().y, posMarker.getPosition().z, scene, { lowConfidence: true }
        );
      }
    });
    document.getElementById('dev-tools').appendChild(lostBtn);
  }

  document.addEventListener('keydown', onKeyDown);

  // Hiện link trang quét BLE chỉ khi trình duyệt hỗ trợ Web Bluetooth
  if ('bluetooth' in navigator) {
    const scanLink = document.getElementById('btn-scan-ble');
    if (scanLink) scanLink.style.display = '';
  }
}

// ─── Show main ────────────────────────────────────────────────────────────────
function showMain() {
  document.getElementById('splash').hidden=true;
  document.getElementById('app-header').hidden=false;
  document.getElementById('main-layout').hidden=false;
  applyMobileFlowClass();
  onResize();
  resetMapView(false);
}


// ─── setActiveFloor ───────────────────────────────────────────────────────────
function updateMapCaption() {
  renderer.shadowMap.needsUpdate=true;
  document.getElementById('map-floor-name').textContent=viewMode==='all'?'Cả 3 tầng':floorName(activeFloor);
  const count=viewMode==='all'?data.rooms.length:data.rooms.filter(r=>r.floorId===activeFloor).length;
  document.getElementById('map-room-count').textContent=count+' phòng';
}

function setActiveFloor(floorId) {
  if(!builder || !data.floors.some(f=>f.id===floorId)) return;
  const previous=activeFloor;
  const fromFloor=data.floors.find(f=>f.id===previous);
  const toFloor=data.floors.find(f=>f.id===floorId);
  cameraTween?.cancel();cameraTween=null;
  activeFloor=floorId;
  if(_sceneReady && previous!==floorId && viewMode==='single') {
    const dy=(toFloor.elevation_m??0)-(fromFloor?.elevation_m??0);
    camera.position.y+=dy;controls.target.y+=dy;controls.update();
  }
  document.querySelectorAll('.floor-btn').forEach(btn=>{
    const active=btn.dataset.floorId===floorId;
    btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
  });
  builder.setViewMode(viewMode,floorId);
  builder.setActiveFloor(floorId);
  builder.buildLabels(data.rooms,floorId,camera,renderer,labelsDiv);
  routeRenderer.setActiveFloor(floorId);
  updateMapCaption();
  if(previous!==floorId) { closeRoomSheet();builder.hoverRoom(null);hoveredRoomId=null; }
  _mfSyncFloorUI();
  quality.requestRender();
}


// ─── View mode ────────────────────────────────────────────────────────────────
function applyViewMode() {
  builder.setViewMode(viewMode, activeFloor);
  if (viewMode === 'single') builder.setActiveFloor(activeFloor);
}

// ─── Suggestions ──────────────────────────────────────────────────────────────
function setupCombobox(input,list) {
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  let index=-1;
  input.addEventListener('input',()=>{index=-1;delete input.dataset.roomId;input.removeAttribute('aria-activedescendant');});
  input.addEventListener('keydown',e=>{
    const options=[...list.querySelectorAll('[role=option]')];
    if(e.key==='Escape') {list.hidden=true;input.setAttribute('aria-expanded','false');return;}
    if(list.hidden || !options.length) return;
    if(e.key==='ArrowDown' || e.key==='ArrowUp') {
      e.preventDefault();index=(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
      options.forEach((o,i)=>o.setAttribute('aria-selected',String(i===index)));
      input.setAttribute('aria-activedescendant',options[index].id);
      options[index].scrollIntoView({block:'nearest'});
    } else if(e.key==='Enter') {e.preventDefault();options[Math.max(index,0)].click();}
  });
  input.addEventListener('blur',()=>{list.hidden=true;input.setAttribute('aria-expanded','false');});
}

function renderSuggestions(ul,rooms,onSelect) {
  ul.replaceChildren();
  for(const room of rooms) {
    const li=document.createElement('li');
    li.id=ul.id+'-'+room.id;li.setAttribute('role','option');li.setAttribute('aria-selected','false');
    const label=document.createElement('span');label.textContent=room.name;
    const floor=document.createElement('span');floor.className='suggestion-floor';floor.textContent=floorName(room.floorId);
    li.append(label,floor);
    li.addEventListener('pointerdown',e=>e.preventDefault());
    li.addEventListener('click',()=>{onSelect(room);ul.hidden=true;const input=document.querySelector('[aria-controls="'+ul.id+'"]');input?.setAttribute('aria-expanded','false');});
    ul.appendChild(li);
  }
}

function setupNavInput(inputId,listId,onSelect=null) {
  const input=document.getElementById(inputId),list=document.getElementById(listId);
  if(!input || !list) return;
  setupCombobox(input,list);
  input.addEventListener('input',()=>{
    const q=input.value.trim();
    if(!q) {list.hidden=true;input.setAttribute('aria-expanded','false');return;}
    const results=searcher.search(q,6);
    renderSuggestions(list,results,room=>{
      input.value=room.name;input.dataset.roomId=room.id;
      if(onSelect) onSelect(room);
    });
    list.hidden=!results.length;input.setAttribute('aria-expanded',String(!list.hidden));
  });
}


// ─── Room select ──────────────────────────────────────────────────────────────
function onRoomClick(roomId) {
  const room = searcher?.getById(roomId);
  if (!room) return;
  selectRoom(room);
}

function selectRoom(room) {
  if (room.floorId !== activeFloor) setActiveFloor(room.floorId);
  builder.highlightRoom(room.id);

  // OutlinePass
  if (outlinePass) {
    const mesh = builder.getRoomMesh(room.id);
    outlinePass.selectedObjects = mesh ? [mesh] : [];
  }
  showRoomSheet(room);
  quality.requestRender();
}

function showRoomSheet(room) {
  const sheet = document.getElementById('room-sheet');
  if (!sheet) return;
  sheet.dataset.roomId = room.id;
  document.getElementById('room-sheet-name').textContent = room.name;
  document.getElementById('room-sheet-meta').textContent =
    `${floorName(room.floorId)} · ${_typeLabel(room.type)}${room.unlabeled ? ' · Chưa đặt tên' : ''}`;
  sheet.hidden = false;
}

function closeRoomSheet() {
  document.getElementById('room-sheet')?.setAttribute('hidden', '');
}

function _typeLabel(type) {
  const map = { office:'Văn phòng', wc:'WC', stairs:'Cầu thang', elevator:'Thang máy', storage:'Kho', clinic:'Phòng khám', lab:'Xét nghiệm', xray:'X-Quang', cashier:'Thu ngân', pharmacy:'Nhà thuốc', entrance:'Sảnh/Cổng', info:'Thông tin', other:'Khác' };
  return map[type] ?? type;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function getRoomDoorNode(roomId) {
  const room = searcher?.getById(roomId);
  if (!room?.doorNodeId) return null;
  return data.nodes?.find(n => n.id === room.doorNodeId) ?? null;
}

// Lõi tính tuyến (không đụng DOM/scene). error: 'same' | 'no-door' | 'no-route'
function computeRoute(fromRoomId, toRoomId, wheelchair = false) {
  if (!fromRoomId || !toRoomId || fromRoomId === toRoomId) return { error: 'same' };
  const fromNode = getRoomDoorNode(fromRoomId);
  const toNode   = getRoomDoorNode(toRoomId);
  if (!fromNode || !toNode || !graph) return { error: 'no-door' };
  const result = astar(graph, fromNode.id, toNode.id, { wheelchairOnly: wheelchair });
  if (!result) return { error: 'no-route' };
  // Phòng thủ: tuyến xe lăn không được đi qua cạnh cầu thang
  if (wheelchair && pathUsesStairs(result.path, data.edges)) return { error: 'no-route' };
  const nodes = result.path.map(id => data.nodes.find(n => n.id === id)).filter(Boolean);
  const steps = generateInstructions(nodes, data.edges);
  return { path: result.path, nodes, steps, cost: result.cost, toNode };
}

// Áp tuyến đã tính lên trạng thái toàn cục và scene
function applyRoute(route) {
  currentRoute = { path: route.path, nodes: route.nodes, steps: route.steps, cost: route.cost };
  currentStepIdx = 0;
  routeRenderer.drawRoute(route.nodes, scene, performance.now());
  if (route.toNode) routeRenderer.setDestMarker(route.toNode.x, route.toNode.y ?? 0, route.toNode.z, scene);
}

function findRoute() {
  const fromInput = document.getElementById('nav-from');
  const toInput   = document.getElementById('nav-to');
  const wheelchair = document.getElementById('wheelchair-mode')?.checked ?? false;
  const fromRoomId = fromInput?.dataset.roomId;
  const toRoomId   = toInput?.dataset.roomId;

  if (!fromRoomId || !toRoomId) { showToast('Vui lòng chọn điểm xuất phát và điểm đến từ gợi ý.', 'error'); return; }
  if (fromRoomId === toRoomId)   { showToast('Điểm xuất phát và điểm đến giống nhau.', 'error'); return; }

  const found = computeRoute(fromRoomId, toRoomId, wheelchair);
  if (found.error === 'no-door') { showToast('Không tìm thấy nút cửa cho phòng.', 'error'); return; }
  if (found.error) {
    showToast(wheelchair ? 'Không có đường xe lăn giữa hai điểm.' : 'Không tìm thấy đường đi.', 'error');
    return;
  }
  const result = { cost: found.cost };
  const steps = found.steps;

  applyRoute(found);

  renderRouteSteps(steps);
  document.getElementById('route-section').hidden = false;
  document.getElementById('arrived-section').hidden = true;
  updateStepCounter();

  const distEl = document.getElementById('route-distance');
  if (distEl) distEl.textContent = `Khoảng cách: ${result.cost.toFixed(0)} m · ${steps.length - 1} bước`;

  closeRoomSheet();
  showToast(`Tìm thấy đường! ${steps.length - 1} bước, khoảng ${result.cost.toFixed(0)} m.`, 'success');

  // Hiện nút "Bắt đầu dẫn đường"
  document.getElementById('btn-start-nav').hidden = false;

  // Mock mode: tự bắt đầu
  if (isMock) { setTimeout(startNavMode, 400); _startMockPlayback(); }

  quality.requestRender();
}

function renderRouteSteps(steps) {
  const container = document.getElementById('route-steps');
  container.innerHTML = '';
  steps.forEach((step, i) => {
    const isFloorChange = step.floorChange || step.icon === '🛗' || step.icon === '🚶';
    const div = document.createElement('button');
    div.type = 'button';
    div.className = 'route-step' + (i === 0 ? ' active-step' : '') + (isFloorChange ? ' floor-change' : '');
    let extra = '';
    if (isFloorChange) extra = `<span class="step-floor-warn" aria-label="Đổi tầng">Đổi tầng</span>`;
    div.innerHTML = `<span class="step-icon">${step.icon}</span>${step.text}${extra}`;
    div.dataset.stepIdx = i;
    div.addEventListener('click', () => { currentStepIdx = i; highlightStep(); });
    container.appendChild(div);
  });
}

function showArrivedState() {
  document.getElementById('route-section').hidden = true;
  document.getElementById('arrived-section').hidden = false;
  showToast('Bạn đã đến nơi!', 'success');
}

function highlightStep() {
  document.querySelectorAll('.route-step').forEach((el, i) =>
    el.classList.toggle('active-step', i === currentStepIdx));
  updateStepCounter();
  const step = currentRoute?.steps[currentStepIdx];
  if (step?.nodeId) {
    const node = data.nodes.find(n => n.id === step.nodeId);
    if (node) {
      if(node.floorId!==activeFloor) setActiveFloor(node.floorId);
      flyToPosition(new THREE.Vector3(node.x, node.y ?? 0, node.z));
    }
  }
}

function nextStep() { if (currentRoute && currentStepIdx < currentRoute.steps.length - 1) { currentStepIdx++; highlightStep(); } }
function prevStep() { if (currentRoute && currentStepIdx > 0) { currentStepIdx--; highlightStep(); } }

function updateStepCounter() {
  const el = document.getElementById('step-counter');
  if (el && currentRoute) el.textContent = `${currentStepIdx + 1} / ${currentRoute.steps.length}`;
}

function clearRoute() {
  routeRenderer.clearRoute(scene);
  routeRenderer.removeDestMarker(scene);
  currentRoute = null;
  document.getElementById('route-section').hidden = true;
  document.getElementById('arrived-section').hidden = true;
  document.getElementById('route-steps').innerHTML = '';
  const distEl = document.getElementById('route-distance');
  if (distEl) distEl.textContent = '';
  if (outlinePass) outlinePass.selectedObjects = [];
  document.getElementById('btn-start-nav').hidden = true;
  exitNavMode();
  quality.requestRender();
}

// ─── Sim position ─────────────────────────────────────────────────────────────
function useSimPosition() {
  if (!simPosition) { showToast('Chọn phòng bằng cách click lên bản đồ để đặt vị trí mô phỏng.', 'info'); return; }
  document.getElementById('nav-from').value = simPosition.roomName ?? 'Vị trí mô phỏng';
  document.getElementById('nav-from').dataset.roomId = simPosition.roomId;
}

// ─── Dev: export GLB ──────────────────────────────────────────────────────────
function exportGLB() {
  const group = builder?.getFloorGroup(activeFloor);
  if (!group) { showToast('Không tìm thấy tầng.', 'error'); return; }
  const exporter = new GLTFExporter();
  exporter.parse(group,
    (gltf) => {
      const blob = new Blob([gltf], { type: 'application/octet-stream' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${activeFloor}.glb`;
      a.click(); URL.revokeObjectURL(url);
      showToast(`Đã xuất ${activeFloor}.glb`);
    },
    (err) => showToast('Xuất GLB lỗi: ' + err, 'error'),
    { binary: true }
  );
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') nextStep();
  if (e.key === 'ArrowLeft')  prevStep();
  if (e.key === 'Escape')     closeRoomSheet();
  if (e.key >= '1' && e.key <= '3') {
    const fl = data.floors?.find(f => f.level === parseInt(e.key));
    if (fl) setActiveFloor(fl.id);
  }
}

// ─── Loading helpers ──────────────────────────────────────────────────────────
function setLoading(msg, isError = false) {
  document.getElementById('loading-overlay').style.display = 'flex';
  document.getElementById('loading-msg').textContent = msg;
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = isError ? 'none' : '';
}
function showLoading(msg) { setLoading(msg, true); }
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
  const sub = document.getElementById('loading-sub');
  if (sub) sub.hidden = false;
}

// ─── Position status ──────────────────────────────────────────────────────────
function updatePositionStatus(type, label = '') {
  const dot = document.getElementById('pos-dot');
  const lbl = document.getElementById('pos-label');
  if (!dot || !lbl) return;
  dot.className = 'pos-dot ' + type;
  const _map = {
    sim: 'Mô phỏng',
    manual: label || 'Thủ công',
    lost: 'Mất tín hiệu',
    ble: label || 'BLE',
    bridge: label || 'Vị trí từ máy quét (demo)',
  };
  lbl.textContent = (_map[type] ?? label) || type;
}

// ─── Áp dụng preference sớm (trước khi load xong) ────────────────────────────
(function applyEarlyPrefs() {
  const saved = localStorage.getItem('fontSize') ?? 'normal';
  if (saved === 'large')  document.body.classList.add('large-text');
  if (saved === 'xlarge') { document.body.classList.add('large-text'); document.body.classList.add('xlarge-text'); }
  if (localStorage.getItem('highContrast') === '1') document.body.classList.add('high-contrast');
  document.querySelectorAll('.splash-font-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.size === saved);
    b.setAttribute('aria-pressed', String(b.dataset.size === saved));
  });
  if (localStorage.getItem('wheelchair') === '1') {
    const r = document.querySelector('input[name="mobility"][value="wheelchair"]');
    if (r) r.checked = true;
  }
})();

// ─── Splash font buttons ──────────────────────────────────────────────────────
document.querySelectorAll('.splash-font-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.splash-font-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
    const size = btn.dataset.size;
    document.body.classList.remove('large-text', 'xlarge-text');
    if (size === 'large')  document.body.classList.add('large-text');
    if (size === 'xlarge') { document.body.classList.add('large-text'); document.body.classList.add('xlarge-text'); }
    localStorage.setItem('fontSize', size);
  });
});

// ─── Splash start button (gắn sớm, trước loadAll) ────────────────────────────
document.getElementById('splash-start')?.addEventListener('click', () => {
  if (!_sceneReady) { showToast('Đang tải dữ liệu, vui lòng đợi…', 'info'); return; }
  const mobility = document.querySelector('input[name="mobility"]:checked')?.value ?? 'normal';
  localStorage.setItem('wheelchair', mobility === 'wheelchair' ? '1' : '0');
  const chk = document.getElementById('wheelchair-mode');
  if (chk) chk.checked = mobility === 'wheelchair';
  showMain();
});

// ─── BLE Adapter ─────────────────────────────────────────────────────────────
async function _startBLEAdapter() {
  try {
    const { loadBeaconMap } = await import('./positioning/load_beacon_map.js');
    const { map: beaconMap, source } = await loadBeaconMap();

    const { start } = await import('./positioning/ble_adapter.js');
    await start(beaconMap, ({ roomId, roomName, status }) => {
      if (status === 'near-room') {
        // Cần xác nhận: ble_adapter chưa trả confidence nên gán 1
        positionProvider.report({ source: 'ble', roomId, confidence: 1 });
        quality.requestRender();
      } else if (status === 'lost') {
        positionProvider.markLost('ble');
        updatePositionStatus('lost');
        document.getElementById('signal-lost-banner').hidden = false;
        showToast('Mất tín hiệu beacon — hãy chọn vị trí thủ công hoặc quét QR mốc gần nhất', 'info');
      }
    });
    const label = source === 'local' ? 'BLE đang quét… (bản đồ local)' : 'BLE đang quét… (placeholder)';
    showToast(label, 'info');
  } catch (e) {
    console.warn('[BLE] Không khởi động được BLE adapter:', e.message);
    showToast(`BLE: ${e.message ?? 'Lỗi khởi động'}`, 'info');
  }
}

// ─── Navigation mode ──────────────────────────────────────────────────────────

// Khoảng cách lệch tuyến cho phép (Cần xác nhận sau đo thực địa)
const OFF_ROUTE_THRESHOLD_M = 8; // Cần xác nhận

function startNavMode() {
  if (!currentRoute || currentRoute.steps.length === 0) return;
  _navMode = true;
  currentStepIdx = 0;
  document.getElementById('nav-mode-overlay').hidden = false;
  document.getElementById('nav-arrived-banner').hidden = true;
  document.getElementById('nav-off-route-banner').hidden = true;
  _updateNavBanner();
  // Camera bay đến node bước đầu tiên
  const step = currentRoute.steps[0];
  if (step?.nodeId) {
    const node = data.nodes?.find(n => n.id === step.nodeId);
    if (node) {
      if (node.floorId !== activeFloor) setActiveFloor(node.floorId);
      flyToPositionTilted(new THREE.Vector3(node.x, node.y ?? 0, node.z));
    }
  }
}

function exitNavMode() {
  _navMode = false;
  document.getElementById('nav-mode-overlay').hidden = true;
  if (_mockTimer) { clearInterval(_mockTimer); _mockTimer = null; }
}

function _updateNavBanner() {
  if (!currentRoute || !_navMode) return;
  if (_mfActive()) return; // mobile-flow tự hiển thị chỉ dẫn (#mf-nav-top), không bay camera theo banner cũ
  const steps = currentRoute.steps;
  const overlay = document.getElementById('nav-mode-overlay');

  if (currentStepIdx >= steps.length - 1) {
    // Đã đến nơi
    document.getElementById('nav-banner').hidden = true;
    document.getElementById('nav-mode-actions').hidden = true;
    document.getElementById('nav-arrived-banner').hidden = false;
    showToast('Bạn đã đến nơi!', 'success');
    return;
  }

  const step = steps[currentStepIdx];
  document.getElementById('nav-banner').hidden = false;
  document.getElementById('nav-mode-actions').hidden = false;
  document.getElementById('nav-step-icon').textContent = step.icon ?? '→';
  document.getElementById('nav-step-text').textContent = step.text ?? '';

  // Hiện khoảng cách ước tính đến mốc tiếp theo
  let distText = '';
  if (step.distanceM != null) distText = `~${Math.round(step.distanceM)} m`;
  else if (currentStepIdx + 1 < steps.length) {
    // Tính từ node hiện tại đến node tiếp
    const cur = data.nodes?.find(n => n.id === step.nodeId);
    const nxt = data.nodes?.find(n => n.id === steps[currentStepIdx + 1]?.nodeId);
    if (cur && nxt) {
      const d = Math.hypot(nxt.x - cur.x, (nxt.z ?? 0) - (cur.z ?? 0));
      distText = `~${Math.round(d)} m`;
    }
  }
  document.getElementById('nav-step-dist').textContent = distText ? `${distText} (ước tính)` : '';

  // Camera bay theo hướng tuyến
  if (step.nodeId) {
    const node = data.nodes?.find(n => n.id === step.nodeId);
    if (node) {
      if (node.floorId !== activeFloor) setActiveFloor(node.floorId);
      flyToPositionTilted(new THREE.Vector3(node.x, node.y ?? 0, node.z));
    }
  }
}

// Kiểm tra lệch tuyến: khoảng cách từ simPosition đến node gần nhất trên route
function _checkOffRoute() {
  if (!_navMode || !simPosition || !currentRoute) return;
  const posNode = data.nodes?.find(n => {
    const room = searcher?.getById(simPosition.roomId);
    return n.id === room?.doorNodeId;
  });
  if (!posNode) return;

  // Tìm khoảng cách đến node gần nhất trên route (từ bước hiện tại)
  let minDist = Infinity;
  for (let i = currentStepIdx; i < currentRoute.steps.length; i++) {
    const node = data.nodes?.find(n => n.id === currentRoute.steps[i]?.nodeId);
    if (!node) continue;
    const d = Math.hypot(node.x - posNode.x, (node.z ?? 0) - (posNode.z ?? 0));
    if (d < minDist) minDist = d;
  }

  const offRoute = minDist > OFF_ROUTE_THRESHOLD_M;
  document.getElementById('nav-off-route-banner').hidden = !offRoute;
}

// ─── Bridge source (nhận vị trí từ laptop via relay) ─────────────────────────

// code: mã ghép cặp 4–6 số (từ ô cũ #bridge-code-input hoặc ô mới #mf-bridge-code)
async function _connectBridgeSource(codeArg) {
  const statusEl  = document.getElementById('bridge-status');
  const mfStatus  = document.getElementById('mf-bridge-status');
  const code = (typeof codeArg === 'string' ? codeArg : '').trim();
  if (!code || code.length < 4) {
    showToast('Vui lòng nhập mã 4–6 số từ trang quét.', 'error'); return;
  }
  const setStatus = (cls, text) => {
    if (statusEl) { statusEl.hidden = false; statusEl.className = 'bridge-status ' + cls; statusEl.textContent = text; }
    if (mfStatus) { mfStatus.hidden = false; mfStatus.textContent = text; }
  };

  if (_bridgeSource) _bridgeSource.stop();

  try {
    const { BridgeSource } = await import('./positioning/bridge_source.js');
    _bridgeSource = new BridgeSource();
    setStatus('connecting', 'Đang kết nối…');

    _bridgeSource.start(code,
      ({ roomId, floorId, confidence }) => {
        // Nhận vị trí từ laptop; simPosition, marker, trạng thái do subscriber của positionProvider cập nhật
        const room = searcher?.getById(roomId);
        if (!room) return;
        positionProvider.report({ source: 'bridge', roomId, floorId, confidence });
        if (!_mfActive()) {
          const node = getRoomDoorNode(roomId);
          if (node) {
            const flId = roomId.split('_')[0];
            if (flId !== activeFloor) setActiveFloor(flId);
            flyToPositionTilted(new THREE.Vector3(node.x, node.y ?? 0, node.z));
          }
        }
        setStatus('active', `Vị trí từ máy quét (demo): ${room.name}`);
        if (_navMode) _checkOffRoute();
        quality.requestRender();
      },
      (status) => {
        if (status === 'lost') {
          positionProvider.markLost('bridge');
          updatePositionStatus('lost');
          document.getElementById('signal-lost-banner').hidden = false;
          showToast('Mất tín hiệu – chọn mốc thủ công', 'info');
          setStatus('lost', 'Mất tín hiệu – chọn mốc thủ công');
        } else if (status === 'connecting') {
          setStatus('connecting', 'Đang kết nối với máy quét…');
        }
      }
    );
  } catch (e) {
    showToast(`Lỗi kết nối cầu nối: ${e.message}`, 'error');
  }
}

// ─── Mock mode ─────────────────────────────────────────────────────────────────
// ?mock=1 — phát chuỗi phòng giả theo tuyến có thật (sau khi tìm đường)

function _setupMockMode() {
  // Hiện badge
  document.getElementById('nav-mock-badge')?.removeAttribute('hidden');
  showToast('Chế độ MOCK đang bật', 'info');
}

function _startMockPlayback() {
  if (!currentRoute || !currentRoute.nodes.length) return;
  if (_mockTimer) clearInterval(_mockTimer);
  let mockIdx = 0;
  _mockTimer = setInterval(() => {
    if (!currentRoute || mockIdx >= currentRoute.nodes.length) {
      clearInterval(_mockTimer); _mockTimer = null; return;
    }
    const node = currentRoute.nodes[mockIdx++];
    if (!node) return;
    // Tìm phòng gần nhất với node này
    const room = data.rooms?.find(r => r.doorNodeId === node.id);
    if (room) {
      const flId = node.floorId ?? room.floorId ?? room.id.split('_')[0];
      positionProvider.report({ source: 'mock', roomId: room.id, floorId: flId, confidence: 1 });
      if (flId && flId !== activeFloor && !_mfActive()) setActiveFloor(flId);
      if (_navMode) _checkOffRoute();
      quality.requestRender();
    }
  }, 3000);
}

// ─── Provider → simPosition / marker / trạng thái (subscriber duy nhất) ─────
// Không ghi log, không lưu tọa độ hay roomId; chỉ cập nhật giao diện trong bộ nhớ.
function _onProviderChange(cur) {
  if (!cur) { simPosition = null; _mfOnPosition(null); return; }
  const room = searcher?.getById(cur.roomId);
  const name = room?.name ?? cur.roomId;
  simPosition = { roomId: cur.roomId, roomName: name };
  if (builder) {
    const node = getRoomDoorNode(cur.roomId);
    if (node) {
      if (cur.isUserChosen) beaconSim?.setSimulatedPosition(node.x, node.y, node.z);
      posMarker.setPosition(node.x, node.y ?? 0, node.z, scene, { lowConfidence: cur.lowConfidence });
    }
    document.getElementById('btn-go-to-me')?.removeAttribute('hidden');
  }
  if (cur.lowConfidence) updatePositionStatus('lost');
  else if (cur.isUserChosen) updatePositionStatus('manual', name);
  else if (cur.source === 'ble' || cur.source === 'native') updatePositionStatus('ble', name);
  else if (cur.source === 'mock') updatePositionStatus('bridge', `MOCK: ${name}`);
  else updatePositionStatus('bridge', `Vị trí từ máy quét (demo): ${name}`);
  const banner = document.getElementById('signal-lost-banner');
  if (banner) banner.hidden = !cur.lowConfidence;
  quality.requestRender();
  _mfOnPosition(cur);
}

// ─── Mobile flow: "Khám phá bản đồ 3D" kiểu Google Maps (BẢN THỬ NGHIỆM) ────
// S0 khám phá → S1 tìm kiếm → S2 thiết lập tuyến → S3 dẫn đường.
// Chỉ bật khi màn hình <=700px và không kiosk / force2d / ?model=glb.
// Vị trí người dùng chỉ nằm trong bộ nhớ; không đưa vào URL hay history state.
const MF_MQ = window.matchMedia('(max-width: 700px)');
let _mfInited = false;
let _mfPrev = STATES.EXPLORE;
let _mfSuppress = false;      // gộp nhiều back() khi popstate
let _mfPickerOpen = false;
let _mfPickerMode = null;     // 'start' | 'where' | 'reset'
let _mfMapPick = null;        // chờ chạm phòng trên bản đồ: 'start' | 'where' | 'reset'
let _mfRouteKey = null;       // khóa tuyến đã tính (start|dest|xe lăn) để tránh tính lại
let _mfSummary = '';
let _mfPathIdx = 0;           // chỉ số node đã đi tới trên currentRoute.path
let _mfGeo = { status: 'unconfigured' };
let _mfLiveTimer = null;
let _mfBeaconRooms = null;    // Map roomId -> [beaconId] từ /api/beacons/public; null = không có nguồn (build/lỗi)
let _mfBeaconPlaced = [];     // beacon đã gắn phòng và có x,z (để vẽ marker)
let _mfBeaconOnly = false;    // lọc kết quả tìm kiếm: chỉ phòng có beacon
let _mfBeaconTouched = false; // người dùng đã tự bật/tắt chip
let _mfBeaconLayer = null;

const _mf = (id) => document.getElementById(id);
const _mfShow = (id, on) => { const el = _mf(id); if (el) el.hidden = !on; };
function _mfActive() { return document.body.classList.contains('mobile-flow'); }
function _mfEligible() { return MF_MQ.matches && !isKiosk && !isForce2D && params.get('model') !== 'glb'; }

function applyMobileFlowClass() {
  const on = _mfEligible() && !!searcher && !!builder;
  document.body.classList.toggle('mobile-flow', on);
  if (!on) { if (_mfInited) { _mfHide3D(false); quality.requestRender(); } return; }
  _mfInit();
  renderMobileFlow();
  _mfSyncFloorUI();
  onResize();
}
MF_MQ.addEventListener?.('change', () => {
  const layout = document.getElementById('main-layout');
  if (!layout || layout.hidden) return;
  applyMobileFlowClass();
  if (_sceneReady && (!mapFlow || mapFlow.state === STATES.EXPLORE)) resetMapView(false);
});

function _mfInit() {
  if (_mfInited) return;
  _mfInited = true;
  mapFlow = createMapFlow({ onChange: _mfOnFlowChange });
  mapFlow.setWheelchair(!!_mf('wheelchair-mode')?.checked);

  // Geofence: lỗi tải => 'unconfigured', không chặn khởi động
  loadGeofenceConfig(() => loadJSON('/data/geofence.json')).then((c) => { _mfGeo = c; }).catch(() => {});

  // Menu tầng
  const menu = _mf('mf-floor-menu');
  for (const fl of data.floors) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mf-floor-opt'; b.dataset.floorId = fl.id;
    b.textContent = floorName(fl.id); b.setAttribute('aria-pressed', String(fl.id === activeFloor));
    b.addEventListener('click', () => { setActiveFloor(fl.id); _mfCloseFloorMenu(); });
    menu.appendChild(b);
  }
  _mf('mf-floor-chip').addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    _mf('mf-floor-chip').setAttribute('aria-expanded', String(!menu.hidden));
  });
  canvas.addEventListener('pointerdown', _mfCloseFloorMenu);
  _mf('mf-locate').addEventListener('click', _mfLocate);
  _mf('mf-reorient').addEventListener('click', _mfReorient);

  // Chip lọc nhanh dưới thanh tìm kiếm (S0): "Có beacon" + theo tầng
  const fc = _mf('mf-filter-chips');
  const bt = document.createElement('button');
  bt.type = 'button'; bt.className = 'mf-fchip'; bt.setAttribute('data-beacon-toggle', '');
  bt.textContent = 'Có beacon'; bt.setAttribute('aria-pressed', 'false'); bt.hidden = true;
  fc.appendChild(bt);
  for (const fl of data.floors) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mf-fchip'; b.dataset.floorId = fl.id;
    b.textContent = floorName(fl.id); b.setAttribute('aria-pressed', String(fl.id === activeFloor));
    fc.appendChild(b);
  }
  fc.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-beacon-toggle')) _mfToggleBeacon();
    else if (b.dataset.floorId) setActiveFloor(b.dataset.floorId);
  });
  _mf('mf-chips').addEventListener('click', (e) => {
    if (e.target.closest('[data-beacon-toggle]')) _mfToggleBeacon();
  });
  _mfLoadBeacons();

  // Bottom sheet kéo được (S2): chạm hoặc kéo tay nắm để thu gọn/mở rộng
  const handle = _mf('mf-sheet-handle');
  let dragY = null, dragged = false;
  handle.addEventListener('pointerdown', (e) => { dragY = e.clientY; dragged = false; try { handle.setPointerCapture(e.pointerId); } catch (_) { /* bỏ qua */ } });
  handle.addEventListener('pointerup', (e) => {
    if (dragY === null) return;
    const dy = e.clientY - dragY; dragY = null;
    if (Math.abs(dy) > 24) { dragged = true; _mfSetSheetCollapsed(dy > 0); }
  });
  handle.addEventListener('pointercancel', () => { dragY = null; });
  handle.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    _mfSetSheetCollapsed(_mf('mf-sheet').dataset.collapsed !== 'true');
  });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(_mfUpdateSheetH);
    ro.observe(_mf('mf-sheet')); ro.observe(_mf('mf-nav-bottom'));
  }

  // S1
  _mf('mf-search-pill').addEventListener('click', () => mapFlow.openSearch());
  const sIn = _mf('mf-search-input');
  sIn.addEventListener('input', () => _mfRunSearch(sIn.value));
  sIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); _mf('mf-results').querySelector('button')?.click(); }
  });
  _mf('mf-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-query]');
    if (!b) return;
    sIn.value = b.dataset.query; _mfRunSearch(sIn.value); sIn.focus();
  });
  _mf('mf-back').addEventListener('click', _mfGoBack);

  // S2
  _mf('mf-close').addEventListener('click', _mfGoBack);
  _mf('mf-start').addEventListener('click', () => _mfOpenPicker('start'));
  _mf('mf-swap').addEventListener('click', () => mapFlow.swap());
  _mf('mf-wheelchair').addEventListener('change', (e) => {
    const v = !!e.target.checked;
    const legacy = _mf('wheelchair-mode');
    if (legacy) legacy.checked = v;
    mapFlow.setWheelchair(v);
  });
  _mf('mf-pick-map').addEventListener('click', () => _mfBeginMapPick('start'));
  _mf('mf-pick-list').addEventListener('click', () => _mfOpenPicker('start'));
  _mf('mf-go').addEventListener('click', () => mapFlow.startNavigation());

  // Bộ chọn điểm xuất phát / "Bạn đang ở đâu?"
  const pIn = _mf('mf-start-input');
  pIn.addEventListener('input', () => _mfRenderPicker(pIn.value, null));
  document.querySelector('#mf-start-picker .mf-chips')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-group]');
    if (!b) return;
    pIn.value = ''; _mfRenderPicker('', b.dataset.group);
  });
  _mf('mf-picker-back').addEventListener('click', _mfGoBack);
  _mf('mf-pick-on-map').addEventListener('click', () => {
    const mode = _mfPickerMode;
    _mfClosePicker();
    _mfBeginMapPick(mode);
  });
  _mf('mf-bridge-connect').addEventListener('click', () => _connectBridgeSource(_mf('mf-bridge-code')?.value));

  // S3
  _mf('mf-end').addEventListener('click', _mfGoBack);
  _mf('mf-arrived').addEventListener('click', _mfGoHome);
  _mf('mf-recenter').addEventListener('click', () => { _mfFollow = true; _mfRenderNav(); _mfFlyToCurrent(); });
  _mf('mf-reset-pos').addEventListener('click', () => _mfOpenPicker('reset'));
  _mf('mf-next').addEventListener('click', _mfNextLandmark);

  // History + phím Esc
  window.addEventListener('popstate', _mfOnPopState);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !_mfActive()) return;
    if (!_mf('mf-floor-menu').hidden) { _mfCloseFloorMenu(); return; }
    if (_mfPickerOpen || mapFlow.state !== STATES.EXPLORE) _mfGoBack();
  });
}

function _mfCloseFloorMenu() {
  const menu = _mf('mf-floor-menu');
  if (menu) menu.hidden = true;
  _mf('mf-floor-chip')?.setAttribute('aria-expanded', 'false');
}

// ── Hiển thị theo state ──
function renderMobileFlow() {
  if (!mapFlow || !_mfActive()) return;
  const st = mapFlow.state;
  document.body.dataset.mfState = st;
  _mfShow('mf-search-pill', st === STATES.EXPLORE);
  _mfShow('mf-filter-chips', st === STATES.EXPLORE);
  _mfShow('mf-fabs', st !== STATES.SEARCH);
  if (st !== STATES.EXPLORE) _mfCloseFloorMenu();
  _mfShow('mf-search-overlay', st === STATES.SEARCH);
  _mfShow('mf-route-sheet', st === STATES.ROUTE);
  _mfShow('mf-nav-top', st === STATES.NAV);
  _mfShow('mf-nav-bottom', st === STATES.NAV);
  if (st === STATES.ROUTE) _mfRenderRoute();
  if (st === STATES.NAV) _mfRenderNav();
  _mfUpdateSheetH();
  quality.requestRender();
}

function _mfSyncFloorUI() {
  if (!mapFlow) return;
  const lbl = _mf('mf-floor-label');
  if (lbl) lbl.textContent = floorName(activeFloor);
  _mf('mf-floor-chip')?.setAttribute('aria-label', `Chọn tầng, đang xem ${floorName(activeFloor)}`);
  document.querySelectorAll('#mf-filter-chips [data-floor-id]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.floorId === activeFloor));
  });
  document.querySelectorAll('#mf-floor-menu .mf-floor-opt, #mf-route-floors .mf-floor-opt').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.floorId === activeFloor));
  });
}

function _mfAnnounce(msg) {
  const el = _mf('mf-live');
  if (!el) return;
  el.textContent = '';
  clearTimeout(_mfLiveTimer);
  _mfLiveTimer = setTimeout(() => { el.textContent = msg; }, 60);
}

function _mfTypeLabel(type) {
  return type === 'stairs' ? 'cầu thang' : type === 'elevator' ? 'thang máy' : 'lối đi giữa các tầng';
}

// ── History ──
function _mfOnFlowChange(state, ctx, { pushed }) {
  if (_mfSuppress) return;
  // State chỉ chứa tên trạng thái và độ sâu; KHÔNG chứa vị trí. URL giữ nguyên.
  if (pushed) history.pushState({ mf: state, d: mapFlow.depth }, '', location.href);
  const prev = _mfPrev;
  _mfPrev = state;
  if (prev !== state) { _mfLeave(prev, state); _mfEnter(state, prev); }
  if (state === STATES.ROUTE) _mfMaybeRecompute();
  renderMobileFlow();
}

function _mfOnPopState(e) {
  if (!mapFlow) return;
  if (_mfPickerOpen && !(e.state && e.state.picker)) { _mfClosePicker({ fromPop: true }); return; }
  const desired = e.state && typeof e.state.d === 'number' ? e.state.d : 0;
  if (mapFlow.depth > desired) {
    _mfSuppress = true;
    while (mapFlow.depth > desired) mapFlow.back();
    _mfSuppress = false;
    _mfOnFlowChange(mapFlow.state, mapFlow.context, { pushed: false });
  }
}

function _mfGoBack() {
  if (_mfPickerOpen) { _mfClosePicker(); return; }
  if (!mapFlow || mapFlow.depth === 0) return;
  const hs = history.state;
  if (hs && hs.mf && hs.d === mapFlow.depth && !hs.picker) history.back();
  else mapFlow.back();
}

function _mfGoHome() {
  if (!mapFlow || mapFlow.depth === 0) return;
  const hs = history.state;
  if (hs && hs.mf && hs.d === mapFlow.depth && !hs.picker) history.go(-mapFlow.depth);
  else mapFlow.reset();
}

// ── Vào/ra từng state ──
function _mfClearRouteOnly() {
  routeRenderer.clearRoute(scene);
  currentRoute = null;
  quality.requestRender();
}

function _mfLeave(prev, next) {
  if (prev === STATES.NAV && next !== STATES.ROUTE) exitNavMode();
  if (prev === STATES.ROUTE && next !== STATES.NAV) _mfRouteKey = null;
}

function _mfEnter(state, prev) {
  _mfMapPick = null;
  if (state === STATES.EXPLORE) {
    clearRoute();
    builder?.clearHighlight();
    _mfRouteKey = null; _mfSummary = ''; _mfFollow = true;
    if (_mfPickerOpen) { _mfPickerOpen = false; _mfShow('mf-start-picker', false); }
    quality.requestRender();
  } else if (state === STATES.SEARCH) {
    _mfClearRouteOnly();
    routeRenderer.removeDestMarker(scene);
    builder?.clearHighlight();
    _mfLoadBeacons();
    const inp = _mf('mf-search-input');
    inp.value = mapFlow.context.query || '';
    _mfRunSearch(inp.value);
    setTimeout(() => inp.focus(), 30);
  } else if (state === STATES.ROUTE) {
    _mfEnterRoute(prev);
  } else if (state === STATES.NAV) {
    _mfEnterNav();
  }
}

// ── S1 ──
function _mfFillList(ul, rooms, onPick) {
  ul.replaceChildren();
  for (const r of rooms) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mf-result';
    const n = document.createElement('span'); n.className = 'mf-result-name'; n.textContent = r.name;
    const m = document.createElement('span'); m.className = 'mf-result-meta';
    m.textContent = `${floorName(r.floorId)} · ${r.id}${_mfBeaconRooms?.has(r.id) ? ' · Có beacon' : ''}`;
    b.append(n, m);
    b.addEventListener('click', () => onPick(r));
    li.appendChild(b);
    ul.appendChild(li);
  }
}

function _mfRunSearch(raw) {
  const q = (raw ?? '').trim();
  mapFlow.context.query = q;
  const filt = _mfBeaconOnly && !!_mfBeaconRooms;
  let rooms = [];
  if (q && searcher) rooms = searcher.search(q, filt ? 200 : 12);
  else if (!q && filt) rooms = data.rooms.filter((r) => _mfBeaconRooms.has(r.id));
  // Chỉ phòng có beacon đã gắn; beacon chưa gắn phòng không tạo kết quả nào
  if (filt) rooms = filterRoomsWithBeacon(rooms, _mfBeaconRooms);
  rooms = rooms.slice(0, 12);
  _mfFillList(_mf('mf-results'), rooms, (room) => {
    mapFlow.selectDestination({ roomId: room.id, label: room.name, floorId: room.floorId }, { via: 'search' });
  });
  const none = (!!q || filt) && rooms.length === 0;
  _mf('mf-no-result').textContent = filt
    ? 'Không có phòng có beacon khớp. Tắt “Có beacon” để tìm mọi phòng.'
    : 'Không tìm thấy phòng phù hợp. Thử tên khác hoặc mã phòng (ví dụ F1_R001).';
  _mfShow('mf-no-result', none);
  if (q || filt) _mfAnnounce(rooms.length ? `${rooms.length} kết quả` : 'Không tìm thấy phòng phù hợp');
}

// ── Phòng có beacon (nguồn: /api/beacons/public, đã lọc UUID) ──
async function _mfLoadBeacons() {
  try {
    const r = await fetch('/api/beacons/public', { cache: 'no-store' });
    if (!r.ok) throw new Error('unavailable');
    const j = await r.json();
    const list = Array.isArray(j.beacons) ? j.beacons : [];
    _mfBeaconRooms = roomsWithBeacons(list);
    _mfBeaconPlaced = list.filter((b) => b.roomId && b.x != null && b.z != null);
  } catch (_) { _mfBeaconRooms = null; _mfBeaconPlaced = []; }
  _mfApplyBeaconUI();
}

function _mfApplyBeaconUI() {
  const avail = !!_mfBeaconRooms && _mfBeaconRooms.size > 0;
  if (!avail) _mfBeaconOnly = false;
  else if (!_mfBeaconTouched) _mfBeaconOnly = true;
  document.querySelectorAll('[data-beacon-toggle]').forEach((b) => {
    b.hidden = !avail;
    b.setAttribute('aria-pressed', String(_mfBeaconOnly));
  });
  const t = document.querySelector('#mf-search-pill .mf-pill-text');
  if (t) t.textContent = avail ? 'Tìm phòng có beacon' : 'Bạn muốn đến đâu?';
  if (builder) {
    _mfBeaconLayer ??= new BeaconLayer(builder);
    _mfBeaconLayer.setPlacements(_mfBeaconPlaced, null, { labels: false });
    quality.requestRender();
  }
  if (mapFlow?.state === STATES.SEARCH) _mfRunSearch(_mf('mf-search-input').value);
}

function _mfToggleBeacon() {
  _mfBeaconTouched = true;
  _mfBeaconOnly = !_mfBeaconOnly;
  _mfApplyBeaconUI();
}

// ── Chạm phòng trên bản đồ ──
function _mfHandleTap(room) {
  _mfCloseFloorMenu();
  if (_mfMapPick) {
    const mode = _mfMapPick;
    _mfMapPick = null;
    _mfApplyPicked(room, mode);
    return;
  }
  if (mapFlow.state === STATES.EXPLORE) {
    mapFlow.selectDestination({ roomId: room.id, label: room.name, floorId: room.floorId }, { via: 'map' });
  }
}

function _mfBeginMapPick(mode) {
  _mfMapPick = mode;
  if (mode === 'start') mapFlow.beginPickStart();
  showToast('Chạm vào một phòng trên bản đồ để chọn điểm đứng.', 'info');
}

// mode: 'start' (S2) | 'where' (S0) | 'reset' (S3)
function _mfApplyPicked(room, mode) {
  const place = { roomId: room.id, label: room.name, floorId: room.floorId, source: 'manual' };
  if (mode === 'start') {
    // setStart trước để autoFill của subscriber không ghi đè lựa chọn của người dùng
    mapFlow.setStart(place);
    mapFlow.endPickStart();
    positionProvider.setManual({ roomId: room.id, floorId: room.floorId, source: 'manual' });
  } else if (mode === 'reset') {
    _mfResetStand(place);
  } else {
    positionProvider.setManual({ roomId: room.id, floorId: room.floorId, source: 'manual' });
    const node = getRoomDoorNode(room.id);
    if (node) _mfFlyTo(node);
  }
}

// ── Bộ chọn điểm xuất phát ──
function _mfOpenPicker(mode) {
  if (_mfPickerOpen) return;
  _mfPickerMode = mode;
  _mfMapPick = null;
  mapFlow.endPickStart();
  _mf('mf-picker-title').textContent =
    mode === 'where' ? 'Bạn đang ở đâu?' : mode === 'reset' ? 'Đặt lại điểm đứng' : 'Chọn điểm xuất phát';
  _mf('mf-start-input').value = '';
  _mfRenderPicker('', null);
  _mfShow('mf-start-picker', true);
  _mfPickerOpen = true;
  history.pushState({ mf: mapFlow.state, d: mapFlow.depth, picker: true }, '', location.href);
}

function _mfClosePicker({ fromPop = false } = {}) {
  if (!_mfPickerOpen) return;
  _mfPickerOpen = false;
  _mfShow('mf-start-picker', false);
  if (!fromPop && history.state && history.state.picker) history.back();
}

function _mfRenderPicker(raw, group) {
  const q = (raw ?? '').trim();
  let rooms = [];
  if (searcher) {
    if (group === 'elevator') rooms = searcher.getElevators();
    else if (group === 'stairs') rooms = searcher.getStairs();
    else if (group === 'wc') rooms = searcher.getWC();
    else if (q) rooms = searcher.search(q, 12);
  }
  _mfFillList(_mf('mf-start-results'), rooms, (room) => {
    const mode = _mfPickerMode;
    _mfClosePicker();
    _mfApplyPicked(room, mode);
  });
  _mfShow('mf-start-empty', !!(q || group) && rooms.length === 0);
}

// ── S0: Vị trí của tôi ──
async function _mfLocate() {
  if (mapFlow.state === STATES.NAV) { _mfFollow = true; _mfRenderNav(); _mfFlyToCurrent(); return; }
  const cur = positionProvider.current();
  const node = cur ? getRoomDoorNode(cur.roomId) : null;
  if (node) { _mfFlyTo(node); return; }
  // Chưa có vị trí: chỉ hỏi geofence (không dùng GPS để đặt chấm trong nhà)
  let status = 'unconfigured';
  try {
    status = (await checkCampus({
      config: _mfGeo, geolocation: navigator.geolocation, isSecureContext: window.isSecureContext,
    })).status;
  } catch (_) { status = 'unavailable'; }
  const msg = geofenceMessage(status);
  if (msg) showToast(msg, 'info');
  _mfOpenPicker('where');
}

function _mfFlyTo(node) {
  if (!node) return;
  if (node.floorId && node.floorId !== activeFloor) setActiveFloor(node.floorId);
  const target = new THREE.Vector3(node.x, node.y ?? 0, node.z);
  const dir = _mfRouteHeading(node);
  if (!dir) { flyToPositionTilted(target); return; }
  // Camera 3D nghiêng ~50°, đặt phía sau điểm nhìn theo hướng đi của tuyến
  const dist = 16;
  const camPos = target.clone().addScaledVector(dir, -dist * 0.8);
  camPos.y += dist * Math.tan(THREE.MathUtils.degToRad(50));
  moveCamera(camPos, target);
}

// Hướng đi (đơn vị, mặt phẳng xz) của tuyến tại node; null nếu không ở S3 hoặc không xác định được
function _mfRouteHeading(node) {
  if (!mapFlow || mapFlow.state !== STATES.NAV || !currentRoute) return null;
  const ns = currentRoute.nodes;
  let i = ns.findIndex((n) => n.id === node.id);
  if (i < 0) i = Math.min(_mfPathIdx, ns.length - 1);
  for (let j = i + 1; j < ns.length; j++) {
    if (ns[j].floorId !== node.floorId) break;
    const dx = ns[j].x - node.x, dz = ns[j].z - node.z;
    if (Math.hypot(dx, dz) > 0.5) return new THREE.Vector3(dx, 0, dz).normalize();
  }
  for (let j = i - 1; j >= 0; j--) {
    if (ns[j].floorId !== node.floorId) break;
    const dx = node.x - ns[j].x, dz = node.z - ns[j].z;
    if (Math.hypot(dx, dz) > 0.5) return new THREE.Vector3(dx, 0, dz).normalize();
  }
  return null;
}

function _mfReorient() {
  const st = mapFlow.state;
  if (st === STATES.NAV) { _mfFollow = true; _mfRenderNav(); _mfFlyToCurrent(); }
  else if (st === STATES.ROUTE && currentRoute) fitRouteOverview(currentRoute.nodes);
  else resetMapView(true);
}

function fitRouteOverview(nodes) {
  const all = nodes ?? [];
  const onFloor = all.filter((n) => n.floorId === activeFloor);
  const use = onFloor.length ? onFloor : all;
  if (!use.length) return;
  const box = new THREE.Box3();
  for (const n of use) box.expandByPoint(new THREE.Vector3(n.x, n.y ?? 0, n.z));
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 6);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.3;
  const direction = new THREE.Vector3(0.65, 1.35, 1.15).normalize();
  moveCamera(center.clone().addScaledVector(direction, distance), center);
}

// ── S2 ──
function _mfEnterRoute(prev) {
  const ctx = mapFlow.context;
  if (prev === STATES.NAV) {
    exitNavMode();
    _mfFollow = true;
    if (currentRoute) {
      const f = currentRoute.nodes[0]?.floorId;
      if (f && f !== activeFloor) setActiveFloor(f);
      fitRouteOverview(currentRoute.nodes);
    }
    return;
  }
  const d = ctx.destination;
  const room = d && searcher?.getById(d.roomId);
  if (!room) return;
  closeRoomSheet();
  if (room.floorId !== activeFloor) setActiveFloor(room.floorId);
  builder.highlightRoom(room.id);
  if (outlinePass) {
    const mesh = builder.getRoomMesh(room.id);
    outlinePass.selectedObjects = mesh ? [mesh] : [];
  }
  const toNode = getRoomDoorNode(room.id);
  if (toNode) routeRenderer.setDestMarker(toNode.x, toNode.y ?? 0, toNode.z, scene);
  flyToRoom(room.id);
  if (!ctx.start && positionProvider.isReliable()) {
    const cur = positionProvider.current();
    const r = cur && searcher.getById(cur.roomId);
    if (r) mapFlow.autoFillStart({ roomId: r.id, label: r.name, floorId: r.floorId, source: cur.source });
  }
}

function _mfMaybeRecompute() {
  if (mapFlow.state !== STATES.ROUTE) return;
  const ctx = mapFlow.context;
  if (!ctx.start || !ctx.destination) {
    if (currentRoute) _mfClearRouteOnly();
    _mfRouteKey = null;
    _mfSummary = ctx.start ? '' : 'Chọn điểm xuất phát để xem đường đi.';
    _mfRenderRouteFloors(null);
    mapFlow.setRouteOk(false);
    return;
  }
  const key = `${ctx.start.roomId}|${ctx.destination.roomId}|${ctx.wheelchair ? 1 : 0}`;
  if (key === _mfRouteKey) return;
  _mfRouteKey = key;
  const res = computeRoute(ctx.start.roomId, ctx.destination.roomId, ctx.wheelchair);
  if (res.error) {
    _mfClearRouteOnly();
    _mfSummary = res.error === 'same' ? 'Điểm xuất phát và điểm đến giống nhau.'
      : res.error === 'no-door' ? 'Không tìm thấy nút cửa cho phòng.'
        : ctx.wheelchair ? 'Không có đường xe lăn giữa hai điểm.' : 'Không tìm thấy đường đi.';
    _mfRenderRouteFloors(null);
    if (res.error === 'no-route' && ctx.wheelchair) showToast('Không có đường xe lăn giữa hai điểm.', 'error');
    mapFlow.setRouteOk(false);
    return;
  }
  applyRoute(res);
  const sum = summarizeRoute(res.nodes, data.edges);
  const types = [...new Set(sum.transitions.map((t) => _mfTypeLabel(t.type)))];
  const floors = sum.floorChanges === 0 ? 'Không đổi tầng' : `Đổi tầng: ${sum.floorChanges} lần (${types.join(', ')})`;
  _mfSummary = `Khoảng cách: ~${Math.round(sum.distanceM)} m (ước tính) · ${floors}`;
  _mfRenderRouteFloors(res.nodes);
  const f = res.nodes[0]?.floorId;
  if (f && f !== activeFloor) setActiveFloor(f);
  fitRouteOverview(res.nodes);
  _mfAnnounce(_mfSummary);
  mapFlow.setRouteOk(true);
}

function _mfRenderRouteFloors(nodes) {
  const box = _mf('mf-route-floors');
  if (!box) return;
  box.replaceChildren();
  const ids = [...new Set((nodes ?? []).map((n) => n.floorId).filter(Boolean))];
  box.hidden = ids.length < 2;
  for (const fid of ids) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mf-floor-opt'; b.dataset.floorId = fid;
    b.textContent = floorName(fid); b.setAttribute('aria-pressed', String(fid === activeFloor));
    b.addEventListener('click', () => {
      setActiveFloor(fid);
      if (currentRoute) fitRouteOverview(currentRoute.nodes);
    });
    box.appendChild(b);
  }
}

function _mfRenderRoute() {
  const ctx = mapFlow.context;
  const cur = positionProvider.current();
  let suffix = '';
  if (ctx.start && cur && cur.roomId === ctx.start.roomId) suffix = cur.isUserChosen ? ' (do bạn chọn)' : ' (vị trí hiện tại)';
  _mf('mf-start-label').textContent = ctx.start ? `${ctx.start.label}${suffix}` : 'Chọn điểm xuất phát';
  _mf('mf-dest').textContent = ctx.destination ? `${ctx.destination.label} · ${floorName(ctx.destination.floorId)}` : '';
  _mfShow('mf-pick-start', !ctx.start);
  const title = document.querySelector('#mf-pick-start .mf-pick-title');
  if (title) title.textContent = ctx.pickingStart ? 'Chạm vào một phòng trên bản đồ' : 'Chọn điểm xuất phát';
  _mf('mf-wheelchair').checked = ctx.wheelchair;
  _mf('mf-swap').disabled = !(ctx.start && ctx.destination);
  _mf('mf-summary').textContent = _mfSummary;
  _mf('mf-sheet-dest').textContent = ctx.destination ? `${ctx.destination.label} · ${floorName(ctx.destination.floorId)}` : '';
  _mf('mf-go').disabled = !mapFlow.canStartNav();
}

// ── Bottom sheet ──
function _mfSetSheetCollapsed(c) {
  _mf('mf-sheet').dataset.collapsed = String(c);
  const h = _mf('mf-sheet-handle');
  h.setAttribute('aria-expanded', String(!c));
  h.setAttribute('aria-label', c ? 'Mở rộng chi tiết tuyến' : 'Thu gọn chi tiết tuyến');
  _mfUpdateSheetH();
}

// Chiều cao khung dưới (S2 sheet / S3 thanh dưới) để nút nổi nằm phía trên, không bị che
function _mfUpdateSheetH() {
  if (!mapFlow) return;
  const st = mapFlow.state;
  const el = st === STATES.ROUTE ? _mf('mf-sheet') : st === STATES.NAV ? _mf('mf-nav-bottom') : null;
  const h = el && !el.hidden ? el.offsetHeight : 0;
  document.body.style.setProperty('--mf-sheet-h', h + 'px');
}

// ── Lớp phủ kiểu Google Maps (chỉ mobile-flow): tuyến, chấm "Bạn ở đây", ghim đích ──
// Tuyến/marker 3D mặc định bị ẩn trước mỗi lần vẽ khi mobile-flow bật; lớp phủ thay thế.
// Ghi chú: truy cập routeRenderer._routeObjects (thuộc tính nội bộ) để ẩn; RouteRenderer.js ngoài phạm vi sửa.
const _mfVec = new THREE.Vector3();
function _mfHide3D(on) {
  for (const c of scene.children) {
    if (c.name === '__position_marker__' || c.name === '__dest_marker__') c.visible = !on;
  }
  for (const o of routeRenderer._routeObjects ?? []) o.visible = !on;
}
function _mfPreRender() { if (_mfInited && _mfActive()) _mfHide3D(true); }

function _mfOverlayUpdate() {
  if (!_mfInited || !_mfActive() || !mapFlow) return;
  const rect = canvas.getBoundingClientRect();
  const st = mapFlow.state;
  const proj = (n, dy = 0.15) => {
    _mfVec.set(n.x, (n.y ?? 0) + dy, n.z).project(camera);
    if (_mfVec.z < -1 || _mfVec.z > 1) return null;
    return [(_mfVec.x * 0.5 + 0.5) * rect.width + rect.left, (-_mfVec.y * 0.5 + 0.5) * rect.height + rect.top];
  };
  const fmt = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;

  // Tuyến: phần đã đi (mờ) và phần còn lại, chỉ trên tầng đang xem
  let dRem = '', dDone = '', lastRem = -1, lastDone = -1;
  const showRoute = (st === STATES.ROUTE || st === STATES.NAV) && !!currentRoute;
  if (showRoute) {
    const ns = currentRoute.nodes;
    const prog = st === STATES.NAV ? _mfPathIdx : 0;
    for (let i = 0; i < ns.length - 1; i++) {
      if (ns[i].floorId !== activeFloor || ns[i + 1].floorId !== activeFloor) continue;
      const a = proj(ns[i]), b = proj(ns[i + 1]);
      if (!a || !b) continue;
      if (i < prog) { dDone += (lastDone === i ? '' : `M${fmt(a)} `) + `L${fmt(b)} `; lastDone = i + 1; }
      else { dRem += (lastRem === i ? '' : `M${fmt(a)} `) + `L${fmt(b)} `; lastRem = i + 1; }
    }
  }
  for (const id of ['mf-route-line', 'mf-route-casing']) _mf(id).setAttribute('d', dRem);
  for (const id of ['mf-route-done', 'mf-route-done-casing']) _mf(id).setAttribute('d', dDone);

  // Chấm vị trí: ở S3 với vị trí do người dùng chọn (demo) chấm đi theo tiến độ tuyến
  const cur = positionProvider.current();
  let hereNode = null;
  if (st === STATES.NAV && currentRoute && (!cur || cur.isUserChosen)) {
    hereNode = currentRoute.nodes[Math.min(_mfPathIdx, currentRoute.nodes.length - 1)];
  } else if (cur) hereNode = getRoomDoorNode(cur.roomId);
  const here = _mf('mf-here');
  const hp = hereNode && st !== STATES.SEARCH && (hereNode.floorId ?? activeFloor) === activeFloor ? proj(hereNode, 0.1) : null;
  if (hp) {
    here.style.transform = `translate(${hp[0].toFixed(1)}px, ${hp[1].toFixed(1)}px)`;
    here.classList.toggle('is-low', !!cur?.lowConfidence);
    const real = !!cur && !cur.isUserChosen && cur.source !== 'mock';
    const lbl = real ? 'Bạn ở đây' : 'Bạn ở đây · Vị trí demo';
    const le = here.querySelector('.mf-here-label');
    if (le.textContent !== lbl) le.textContent = lbl;
  }
  here.hidden = !hp;

  // Ghim đích
  const pin = _mf('mf-pin');
  const dest = mapFlow.context.destination;
  const dn = dest && (st === STATES.ROUTE || st === STATES.NAV) ? getRoomDoorNode(dest.roomId) : null;
  const pp = dn && (dn.floorId ?? activeFloor) === activeFloor ? proj(dn, 0.1) : null;
  if (pp) pin.style.transform = `translate(${pp[0].toFixed(1)}px, ${pp[1].toFixed(1)}px)`;
  pin.hidden = !pp;
}

// ── S3 ──
function _mfIndexForRoom(roomId) {
  const room = searcher?.getById(roomId);
  return currentRoute && room?.doorNodeId ? currentRoute.path.indexOf(room.doorNodeId) : -1;
}

function _mfTransitionText(step) {
  if (!currentRoute || !step) return '';
  const t = summarizeRoute(currentRoute.nodes, data.edges).transitions.find((x) => x.nodeId === step.nodeId);
  if (!t) return '';
  return `Đi ${_mfTypeLabel(t.type)} ${t.up ? 'lên' : 'xuống'} ${floorName(t.toFloor)}`;
}

function _mfAnnounceStep() {
  const step = currentRoute?.steps[currentStepIdx];
  if (step) _mfAnnounce(_mfTransitionText(step) || step.text);
}

function _mfSetPathIdx(pi) {
  if (!currentRoute || pi < _mfPathIdx) return;
  _mfPathIdx = pi;
  const { steps, path } = currentRoute;
  let idx = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (path.indexOf(steps[i].nodeId) > pi) { idx = i; break; }
  }
  if (idx !== currentStepIdx) { currentStepIdx = idx; _mfAnnounceStep(); }
}

function _mfEnterNav() {
  if (!currentRoute || currentRoute.steps.length === 0) {
    showToast('Chưa có tuyến để dẫn đường.', 'error');
    _mfGoBack();
    return;
  }
  startNavMode();
  _mfPathIdx = 0; currentStepIdx = 0; _mfFollow = true;
  const cur = positionProvider.current();
  if (cur) { const i = _mfIndexForRoom(cur.roomId); if (i > 0) _mfSetPathIdx(i); }
  _mfFlyToCurrent();
  if (isMock) _startMockPlayback();
  _mfAnnounceStep();
}

// Camera về vị trí hiện tại; nếu chưa có vị trí thì về mốc đang đi tới trên tuyến
function _mfFlyToCurrent() {
  const cur = positionProvider.current();
  let node = cur && !(mapFlow.state === STATES.NAV && cur.isUserChosen) ? getRoomDoorNode(cur.roomId) : null;
  if (!node && currentRoute) node = currentRoute.nodes[Math.min(_mfPathIdx, currentRoute.nodes.length - 1)];
  _mfFlyTo(node);
}

function _mfNextLandmark() {
  if (!currentRoute) return;
  const step = currentRoute.steps[currentStepIdx];
  const e = step ? currentRoute.path.indexOf(step.nodeId) : -1;
  if (e < 0) return;
  _mfSetPathIdx(e);
  _mfFollow = true;
  _mfFlyTo(currentRoute.nodes[e]);
  _mfRenderNav();
}

function _mfRenderNav() {
  if (!mapFlow || !_mfActive() || mapFlow.state !== STATES.NAV || !currentRoute) return;
  const steps = currentRoute.steps;
  const arrived = currentStepIdx >= steps.length - 1;
  const step = steps[Math.min(currentStepIdx, steps.length - 1)];
  const cur = positionProvider.current();
  const low = !cur || cur.lowConfidence;
  const dest = mapFlow.context.destination;
  _mf('mf-nav-icon').textContent = arrived ? '🏁' : (!step.icon || step.icon === '👣' ? '↑' : step.icon);
  _mf('mf-nav-dest').textContent = dest ? `Đến: ${dest.label} · ${floorName(dest.floorId)}` : '';
  _mf('mf-nav-text').textContent = arrived ? 'Bạn đã đến nơi' : step.text;
  let sub = '';
  if (arrived) sub = dest ? dest.label : '';
  else if (low) sub = landmarkHint(step, { rooms: data.rooms, nodes: data.nodes });
  else {
    const e = currentRoute.path.indexOf(step.nodeId);
    const dNext = e > _mfPathIdx ? remainingDistance(currentRoute.nodes.slice(0, e + 1), _mfPathIdx) : 0;
    const tr = _mfTransitionText(step);
    sub = [dNext >= 1 ? `Còn khoảng ${Math.round(dNext)} m tới mốc (ước tính)` : '', tr].filter(Boolean).join(' · ');
  }
  _mf('mf-nav-sub').textContent = sub;
  _mfShow('mf-lowconf', !arrived && low);
  _mfShow('mf-arrived', arrived);
  _mfShow('mf-reset-pos', !arrived && low);
  _mfShow('mf-recenter', !arrived && !_mfFollow);
  _mfShow('mf-next', !arrived);
  _mf('mf-remaining').textContent = arrived
    ? 'Đã đến nơi'
    : `Còn khoảng ${Math.round(remainingDistance(currentRoute.nodes, _mfPathIdx))} m (ước tính)`;
}

// Đặt lại điểm đứng ở S3: tính lại từ điểm mới tới cùng đích
function _mfResetStand(place) {
  const ctx = mapFlow.context;
  if (!ctx.destination) return;
  const res = computeRoute(place.roomId, ctx.destination.roomId, ctx.wheelchair);
  if (res.error) {
    showToast(res.error === 'same' ? 'Bạn đang ở điểm đến.'
      : ctx.wheelchair ? 'Không có đường xe lăn giữa hai điểm.' : 'Không tìm thấy đường đi.', 'error');
    return;
  }
  applyRoute(res);
  _mfPathIdx = 0; currentStepIdx = 0; _mfFollow = true;
  mapFlow.setStart(place);
  mapFlow.setRouteOk(true);
  _mfRouteKey = `${place.roomId}|${ctx.destination.roomId}|${ctx.wheelchair ? 1 : 0}`;
  positionProvider.setManual({ roomId: place.roomId, floorId: place.floorId, source: 'manual' });
  _mfFlyTo(res.nodes[0]);
  _mfAnnounceStep();
  _mfRenderNav();
}

// Nhận cập nhật vị trí (từ _onProviderChange)
function _mfOnPosition(cur) {
  if (!mapFlow || !_mfActive()) return;
  const st = mapFlow.state;
  if (st === STATES.NAV && currentRoute) {
    if (cur) {
      const i = _mfIndexForRoom(cur.roomId);
      if (i >= 0) _mfSetPathIdx(i);
      if (_mfFollow) _mfFlyTo(getRoomDoorNode(cur.roomId));
    }
    _mfRenderNav();
  } else if (st === STATES.ROUTE && cur && !mapFlow.context.start && positionProvider.isReliable()) {
    const r = searcher?.getById(cur.roomId);
    if (r) mapFlow.autoFillStart({ roomId: r.id, label: r.name, floorId: r.floorId, source: cur.source });
  }
  if (_mfPickerOpen && _mfPickerMode === 'where' && cur && !cur.lowConfidence && !cur.isUserChosen) {
    _mfClosePicker();
    _mfFlyTo(getRoomDoorNode(cur.roomId));
  }
}

// ─── Giấy khám / lịch trình (bản thử nghiệm): chỉ đăng ký, logic nằm ở src/visit + src/ui/visitUI.js ───
function _visitNavigate({ fromRoomId, toRoomId, wheelchair }) {
  const from = searcher?.getById(fromRoomId);
  const to = searcher?.getById(toRoomId);
  if (!from || !to) return;
  const wc = document.getElementById('wheelchair-mode');
  if (wc) wc.checked = !!wheelchair;
  if (mapFlow && _mfActive()) {
    if (mapFlow.state !== STATES.EXPLORE) mapFlow.reset();
    mapFlow.setWheelchair(!!wheelchair);
    mapFlow.selectDestination({ roomId: to.id, label: to.name, floorId: to.floorId }, { via: 'map' });
    mapFlow.setStart({ roomId: from.id, label: from.name, floorId: from.floorId, source: 'manual' });
  } else {
    const fi = document.getElementById('nav-from');
    const ti = document.getElementById('nav-to');
    fi.value = from.name; fi.dataset.roomId = from.id;
    ti.value = to.name; ti.dataset.roomId = to.id;
    findRoute();
  }
}

function _initVisit() {
  const root = document.getElementById('visit-root');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  initVisitUI({
    root,
    loadPlans: () => loadJSON('/data/visit_plans.sample.json'),
    getContext: () => ({ rooms: data.rooms, nodes: data.nodes, edges: data.edges, graph }),
    getRoom: (id) => searcher?.getById(id),
    floorLabel: floorName,
    getStartRoomId: () => (positionProvider.isReliable() ? positionProvider.current()?.roomId ?? null : null),
    searchRooms: (q) => searcher.search(q, 6),
    getWheelchair: () => !!document.getElementById('wheelchair-mode')?.checked,
    onNavigate: _visitNavigate,
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
positionProvider.subscribe(_onProviderChange);
setInterval(() => positionProvider.refresh(), 2000); // đánh giá lại độ cũ của vị trí beacon
loadAll();
