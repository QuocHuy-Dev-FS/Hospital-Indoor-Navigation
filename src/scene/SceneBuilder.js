import * as THREE from 'three';
import { createHospitalMaterials, buildHospitalFloor } from './HospitalInterior.js';

export const ROOM_COLORS={clinic:0xe4ede7,lab:0xd9e7e5,xray:0xdce4e8,cashier:0xebe6da,
pharmacy:0xe0eadc,wc:0xdcebea,elevator:0xcbdedb,stairs:0xe4e9e5,entrance:0xeee9dd,
info:0xe1eeea,office:0xeee7d8,storage:0xe4e3d9,other:0xf4f5ee};

export class SceneBuilder {
  constructor(coordSystem){
    this.coord=coordSystem;this._floorGroups=new Map();this._roomMeshes=new Map();
    this._originalMaterials=new Map();this._ghostMaterials=new Map();
    this._highlighted=null;this._hovered=null;this._selectionMat=null;this._hoverMat=null;this._labelData=null;this._labelsContainer=null;
    this._materials=createHospitalMaterials();this._mode='single';this._useEdges=true;
  }
  setUseEdges(on){this._useEdges=on;}
  buildAll(floors,rooms,scene,nodes=[]){
    for(const floor of floors){
      const built=buildHospitalFloor(floor,rooms.filter(r=>r.floorId===floor.id),this.coord,nodes,this._materials);
      built.group.traverse(obj=>{if(obj.material)this._originalMaterials.set(obj.uuid,obj.material);});
      this._floorGroups.set(floor.id,built.group);
      for(const [id,mesh] of built.roomMeshes)this._roomMeshes.set(id,mesh);
      scene.add(built.group);
    }
  }
  setViewMode(mode,activeFloorId){
    this._mode=mode;
    for(const [id,group] of this._floorGroups){group.visible=mode!=='single'||id===activeFloorId;group.position.y=(group.userData.level-1)*this.coord.FLOOR_HEIGHT_M;}
  }
  setActiveFloor(floorId){
    const selected=this._highlighted;this._clearHover();this.clearHighlight();
    for(const [id,group] of this._floorGroups){
      const active=id===floorId;
      group.traverse(obj=>{
        if(!obj.material)return;
        const base=this._originalMaterials.get(obj.uuid);if(!base)return;
        if(active){obj.material=base;return;}
        if(!this._ghostMaterials.has(base.uuid)){
          const ghost=base.clone();ghost.transparent=true;ghost.opacity=base.opacity*.12;ghost.depthWrite=false;
          this._ghostMaterials.set(base.uuid,ghost);
        }
        obj.material=this._ghostMaterials.get(base.uuid);
      });
    }
    // Reapply a user's selection after restoring the floor's own materials.
    if(selected&&this._roomMeshes.get(selected)?.userData.floorId===floorId)this.highlightRoom(selected);
  }
  highlightRoom(id){
    this.clearHighlight();const mesh=this._roomMeshes.get(id);if(!mesh)return;
    if(this._hovered===id)this._clearHover();
    const material=this._originalMaterials.get(mesh.uuid).clone();
    material.color.setHex(0xa9d6b8);material.emissive.setHex(0x174b35);material.emissiveIntensity=.18;
    this._selectionMat=material;mesh.material=material;mesh.position.y=.115;this._highlighted=id;
  }
  clearHighlight(){
    const mesh=this._roomMeshes.get(this._highlighted);
    if(mesh){this._selectionMat?.dispose();this._selectionMat=null;mesh.material=this._originalMaterials.get(mesh.uuid);mesh.position.y=.1;}
    this._highlighted=null;
  }
  hoverRoom(id){
    if(id===this._hovered)return;this._clearHover();
    if(id&&id!==this._highlighted){const mesh=this._roomMeshes.get(id);if(mesh){const mat=this._originalMaterials.get(mesh.uuid).clone();mat.color.lerp(new THREE.Color(0xb5ded1),.5);this._hoverMat=mat;mesh.material=mat;this._hovered=id;}}
  }
  _clearHover(){const mesh=this._roomMeshes.get(this._hovered);if(mesh&&this._hovered!==this._highlighted){this._hoverMat?.dispose();this._hoverMat=null;mesh.material=this._originalMaterials.get(mesh.uuid);}this._hovered=null;}
  buildLabels(rooms,floorId,camera,renderer,container){
    this.clearLabels();this._labelsContainer=container;
    const important=new Set(['wc','stairs','elevator','entrance','info']);
    this._labelData=rooms.filter(r=>!r.unlabeled&&r.floorId===floorId).map(room=>{
      const mesh=this._roomMeshes.get(room.id);if(!mesh)return null;
      const el=document.createElement('div');el.className='room-label';el.dataset.roomId=room.id;el.textContent=room.name;
      container.appendChild(el);return{el,mesh,room,important:important.has(room.type)};
    }).filter(Boolean);
  }
  updateLabels(camera,renderer){
    if(!this._labelData)return;
    const rect=renderer.domElement.getBoundingClientRect(),occupied=[];
    const sorted=[...this._labelData].sort((a,b)=>labelPriority(b.room,b.room.id===this._highlighted)-labelPriority(a.room,a.room.id===this._highlighted));
    for(const {el,mesh,room,important} of sorted){
      const selected=room.id===this._highlighted,pos=mesh.getWorldPosition(new THREE.Vector3());pos.y+=1.0;
      const distance=camera.position.distanceTo(pos),projected=pos.project(camera);
      const x=(projected.x*.5+.5)*rect.width,y=(-projected.y*.5+.5)*rect.height;
      const max=selected?1000:important?125:55;
      const width=el.offsetWidth||140,height=28,box={x:x-width/2-5,y:y-height/2-4,w:width+10,h:height+8};
      const overlap=occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      const mobile=rect.width<550;
      const hidden=projected.z>1||projected.z< -1||distance>max||x<40||x>rect.width-40||y<(mobile?110:100)||y>rect.height-65||(!selected&&overlap);
      el.style.visibility=hidden?'hidden':'visible';el.style.display='';
      if(!hidden){el.style.left=x+'px';el.style.top=y+'px';occupied.push(box);}
      el.classList.toggle('label-selected',selected);el.classList.toggle('label-important',important);
    }
  }
  clearLabels(){if(this._labelsContainer)this._labelsContainer.replaceChildren();this._labelData=null;}
  disposeFloor(id,scene){
    const group=this._floorGroups.get(id);if(!group)return;
    const geometries=new Set(),materials=new Set();group.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);const m=this._originalMaterials.get(obj.uuid);if(m)materials.add(m);this._originalMaterials.delete(obj.uuid);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>{if(!Object.values(this._materials).includes(m)){if(m.map&&!Object.values(this._materials).some(owned=>owned.map===m.map))m.map.dispose();m.dispose();}});
    scene.remove(group);this._floorGroups.delete(id);
    for(const [rid,mesh] of this._roomMeshes)if(mesh.userData.floorId===id)this._roomMeshes.delete(rid);
  }
  disposeAll(scene){for(const id of [...this._floorGroups.keys()])this.disposeFloor(id,scene);this._ghostMaterials.forEach(m=>m.dispose());Object.values(this._materials).forEach(m=>{m.map?.dispose();m.dispose();});this.clearLabels();}
  getFloorGroup(id){return this._floorGroups.get(id);}
  getRoomMesh(id){return this._roomMeshes.get(id);}
  getAllFloorIds(){return [...this._floorGroups.keys()];}
}

// ─── Icon theo loại phòng ─────────────────────────────────────────────────────
export const ROOM_ICONS = {
  clinic:   '🏥',
  lab:      '🔬',
  xray:     '🩻',
  cashier:  '💳',
  pharmacy: '💊',
  wc:       '🚻',
  elevator: '🛗',
  stairs:   '🪜',
  entrance: '🚪',
  info:     'ℹ️',
  office:   '🗂️',
  storage:  '📦',
  other:    '',
};

// ─── Hàm tách tuyến theo tầng (dùng cho C1 + tests) ─────────────────────────
export function splitRouteByFloor(pathNodes) {
  if (!pathNodes || pathNodes.length < 2) return [];
  const segments = [];
  let cur = { floorId: pathNodes[0].floorId, nodes: [pathNodes[0]] };
  for (let i = 1; i < pathNodes.length; i++) {
    const n = pathNodes[i];
    if (n.floorId === cur.floorId) {
      cur.nodes.push(n);
    } else {
      // Lặp lại điểm cuối segment trước để segment liền kề
      cur.nodes.push(n);
      segments.push(cur);
      cur = { floorId: n.floorId, nodes: [n] };
    }
  }
  if (cur.nodes.length >= 1) segments.push(cur);
  return segments;
}

// ─── Hàm tính label priority score (dùng cho tests) ──────────────────────────
// Điểm cao hơn → ưu tiên hiện label
export function labelPriority(room, isSelected, camera, mesh) {
  if (isSelected) return 100;
  const IMPORTANT_TYPES = new Set(['elevator', 'stairs', 'entrance', 'info', 'wc']);
  if (IMPORTANT_TYPES.has(room.type)) return 50;
  return 10;
}
