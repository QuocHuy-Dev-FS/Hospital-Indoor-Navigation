import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Interior objects are illustrative. Source room bounds, node IDs and routes stay unchanged.
const C = {wall:0xe9e3d3,trim:0x6aa292,white:0xfafbf7,teal:0x388b80,
  blue:0x6b9eac,metal:0xa6b4b5,ink:0x314c53,wood:0xb99673,
  pale:0xdde9e3,leaf:0x4b8453,pot:0xe4ddd0,glass:0xb8d9d6};

function texture(kind) {
  if(typeof document==='undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');
  if(kind==='tile') {
    c.fillStyle='#f1f0e7';c.fillRect(0,0,256,256);
    c.fillStyle='#d6dbd2';c.fillRect(0,0,256,2);c.fillRect(0,0,2,256);
    c.fillStyle='#faf9f0';c.fillRect(3,3,251,1);c.fillRect(3,3,1,251);
    for(let i=0;i<140;i++){const x=(i*71)%256,y=(i*113)%256;c.fillStyle=i%2?'#eae9e0':'#f7f6ed';c.fillRect(x,y,2,1);}
  } else if(kind==='wood') {
    c.fillStyle='#c4a17b';c.fillRect(0,0,256,256);
    for(let i=0;i<85;i++){c.strokeStyle=i%3?'#b3906a':'#d9bc98';c.lineWidth=.5;c.beginPath();c.moveTo(0,i*3);c.bezierCurveTo(70,i*3+3,150,i*3-3,256,i*3+1);c.stroke();}
  } else {
    const g=c.createRadialGradient(128,128,16,128,128,126);g.addColorStop(0,'rgba(38,58,49,.3)');g.addColorStop(.5,'rgba(38,58,49,.15)');g.addColorStop(1,'rgba(38,58,49,0)');c.fillStyle=g;c.fillRect(0,0,256,256);
  }
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
}

export function createHospitalMaterials() {
  const mats={};
  for(const [name,color] of Object.entries(C)) mats[name]=new THREE.MeshStandardMaterial({color,roughness:name==='metal'?.28:.72,metalness:name==='metal'?.7:0});
  mats.wood.map=texture('wood');
  mats.tile=new THREE.MeshStandardMaterial({color:0xffffff,map:texture('tile'),roughness:.42,metalness:.02});
  mats.glass=new THREE.MeshStandardMaterial({color:C.glass,transparent:true,opacity:.52,roughness:.22,metalness:.15,depthWrite:false});
  mats.shadow=new THREE.MeshBasicMaterial({color:0xffffff,map:texture('shadow'),transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide});
  mats.lawn=new THREE.MeshStandardMaterial({color:0x86a47d,roughness:1});
  mats.base=new THREE.MeshStandardMaterial({color:0xdbdfd5,roughness:.9});
  return mats;
}

// Instancing keeps hundreds of furnishings to one draw per geometry/material/floor.
class Batches {
  constructor(group,mats,prefix='interior'){this.group=group;this.mats=mats;this.prefix=prefix;this.items=new Map();}
  add(kind,mat,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0) {
    if(sx<=0||sy<=0||sz<=0) return;
    const key=kind+':'+mat;if(!this.items.has(key))this.items.set(key,[]);
    const obj=new THREE.Object3D();obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.rotation.set(rx,ry,rz);obj.updateMatrix();
    this.items.get(key).push(obj.matrix.clone());
  }
  box(mat,x,y,z,sx,sy,sz,ry=0){this.add('box',mat,x,y,z,sx,sy,sz,ry);}
  round(mat,x,y,z,sx,sy,sz,ry=0){this.add('round',mat,x,y,z,sx,sy,sz,ry);}
  cylinder(mat,x,y,z,sx,sy,sz){this.add('cylinder',mat,x,y,z,sx,sy,sz);}
  rail(a,b,thickness=.035) {
    const v=new THREE.Vector3().subVectors(b,a),m=new THREE.Matrix4();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());
    m.compose(a.clone().add(b).multiplyScalar(.5),q,new THREE.Vector3(thickness,v.length(),thickness));
    const key='cylinder:metal';if(!this.items.has(key))this.items.set(key,[]);this.items.get(key).push(m);
  }
  shadow(x,z,w,d){this.add('plane','shadow',x,.17,z,w,d,1,0,-Math.PI/2);}
  finish() {
    const geometry={box:new THREE.BoxGeometry(1,1,1),round:new RoundedBoxGeometry(1,1,1,1,.07),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),leaf:new THREE.IcosahedronGeometry(.5,1),plane:new THREE.PlaneGeometry(1,1)};
    for(const [key,matrices] of this.items){
      const [kind,mat]=key.split(':');const mesh=new THREE.InstancedMesh(geometry[kind],this.mats[mat],matrices.length);
      matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
      mesh.castShadow=mat!=='shadow'&&mat!=='glass';mesh.receiveShadow=mat!=='shadow';
      mesh.name=this.prefix+'-'+key;mesh.userData={type:'interior',illustrative:true,materialKey:mat};
      if(mat==='shadow'){mesh.renderOrder=1;mesh.frustumCulled=false;}
      mesh.computeBoundingSphere();this.group.add(mesh);
    }
  }
}

export function nearestDoor(room,nodes=[]) {
  const b=room.bounds,n=nodes.find(n=>n.id===room.doorNodeId);
  const cx=(b.x1+b.x2)/2,cz=(b.z1+b.z2)/2;
  const candidates=[
    {axis:'x',fixed:b.z1,center:THREE.MathUtils.clamp(n?.x??cx,b.x1+.6,b.x2-.6),distance:Math.abs((n?.z??cz)-b.z1),side:'north'},
    {axis:'x',fixed:b.z2,center:THREE.MathUtils.clamp(n?.x??cx,b.x1+.6,b.x2-.6),distance:Math.abs((n?.z??cz)-b.z2),side:'south'},
    {axis:'z',fixed:b.x1,center:THREE.MathUtils.clamp(n?.z??cz,b.z1+.6,b.z2-.6),distance:Math.abs((n?.x??cx)-b.x1),side:'west'},
    {axis:'z',fixed:b.x2,center:THREE.MathUtils.clamp(n?.z??cz,b.z1+.6,b.z2-.6),distance:Math.abs((n?.x??cx)-b.x2),side:'east'},
  ];
  return candidates.sort((a,b)=>a.distance-b.distance)[0];
}

function plant(batch,x,z,scale=1) {
  batch.cylinder('pot',x,.22*scale,z,.42*scale,.44*scale,.42*scale);
  batch.cylinder('wood',x,.65*scale,z,.055*scale,.65*scale,.055*scale);
  for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;batch.add('leaf','leaf',x+Math.cos(angle)*.16*scale,(.85+(i%2)*.18)*scale,z+Math.sin(angle)*.16*scale,.5*scale,.65*scale,.5*scale);}
  batch.shadow(x,z,.95*scale,.95*scale);
}

function chair(batch,x,z,rotation=0) {
  const s=Math.sin(rotation),c=Math.cos(rotation);
  const point=(lx,lz)=>[x+lx*c+lz*s,z-lx*s+lz*c];
  batch.round('blue',x,.55,z,.52,.13,.52,rotation);
  const back=point(0,-.22);batch.round('blue',back[0],.9,back[1],.52,.64,.09,rotation);
  for(const dx of [-.2,.2])for(const dz of [-.18,.18]){const p=point(dx,dz);batch.cylinder('metal',p[0],.31,p[1],.035,.5,.035);}
  batch.shadow(x,z,.8,.85);
}

function desk(batch,x,z,w=1.5) {
  batch.round('wood',x,.89,z,w,.09,.67);
  batch.box('white',x-w*.32,.48,z,.32,.76,.56);batch.box('white',x+w*.32,.48,z,.12,.76,.56);
  batch.box('ink',x,.99,z-.15,.45,.025,.22);batch.box('ink',x,1.2,z-.23,.52,.35,.045);
  batch.box('pale',x-w*.3,.96,z+.05,.22,.025,.28);batch.shadow(x,z,w+.35,1.1);
}

function bed(batch,x,z) {
  batch.round('metal',x,.48,z,.92,.16,2.08);
  batch.round('white',x,.68,z,.9,.27,2.0);
  batch.round('white',x,.86,z-.7,.67,.15,.42);
  batch.round('teal',x,.84,z+.32,.92,.08,1.0);
  for(const dx of [-.4,.4])for(const dz of [-.8,.8])batch.cylinder('metal',x+dx,.3,z+dz,.045,.55,.045);
  batch.box('white',x,.98,z-1,.97,.65,.075);batch.box('teal',x,.91,z+1,.97,.48,.075);
  for(const dx of [-.52,.52])batch.rail(new THREE.Vector3(x+dx,.95,z-.35),new THREE.Vector3(x+dx,.95,z+.7),.035);
  batch.box('wood',x+.88,.52,z-.65,.48,.8,.46);batch.shadow(x,z,1.75,2.65);
}

function furnish(batch,room,index) {
  const b=room.bounds,w=b.x2-b.x1,d=b.z2-b.z1,cx=(b.x1+b.x2)/2,cz=(b.z1+b.z2)/2;
  if(w<1.4||d<1.4)return;
  if(room.type==='stairs') {
    const sw=Math.min(w-1.0,2.0),run=Math.min(d-1.1,4.0),steps=12;
    for(let i=0;i<steps;i++)batch.box('pale',cx,.16+i*.22,cz-run/2+i*run/steps,sw,.23,run/steps+.025);
    for(const side of [-1,1]){
      const x=cx+side*(sw/2+.08);
      batch.rail(new THREE.Vector3(x,1.0,cz-run/2),new THREE.Vector3(x,3.45,cz+run/2));
      for(let i=0;i<steps;i+=3)batch.cylinder('metal',x,.58+i*.22,cz-run/2+i*run/steps,.035,.95,.035);
    }
    return;
  }
  if(room.type==='elevator') {
    for(const dx of [-.9,.9]){
      batch.box('ink',cx+dx,1.35,b.z1+.22,1.68,2.5,.15);
      batch.box('metal',cx+dx-.39,1.35,b.z1+.33,.74,2.35,.05);batch.box('metal',cx+dx+.39,1.35,b.z1+.33,.74,2.35,.05);
      batch.box('ink',cx+dx,2.7,b.z1+.3,.8,.2,.08);
    }
    plant(batch,b.x1+.6,b.z2-.6);return;
  }
  if(room.type==='wc') {
    const count=Math.max(1,Math.min(3,Math.floor(w/1.2)));
    for(let i=0;i<count;i++){
      const x=b.x1+.65+i*1.1;
      batch.round('white',x,.46,b.z1+.7,.47,.45,.66);batch.box('white',x,.78,b.z1+.38,.48,.54,.18);
      if(i)batch.box('pale',x-.55,.85,b.z1+.65,.05,1.4,1.3);
    }
    batch.round('white',cx,.87,b.z2-.45,Math.min(w-.6,1.8),.16,.48);
    batch.box('glass',cx,1.52,b.z2-.15,Math.min(w-.6,1.7),.78,.04);return;
  }
  if(room.type==='storage') {
    for(let i=0;i<2;i++){
      const x=b.x1+.5+i*.9;batch.box('white',x,1.05,b.z1+.5,.72,1.8,.5);
      for(let y=.5;y<1.9;y+=.45)batch.box('wood',x,y,b.z1+.78,.67,.05,.04);
    }
    return;
  }
  if(room.type==='office' || room.type==='cashier' || room.type==='info') {
    const count=Math.min(3,Math.max(1,Math.floor(w/2.4)));
    for(let i=0;i<count;i++){
      const x=b.x1+1.05+i*2.1;
      desk(batch,x,b.z1+1.3,1.45);chair(batch,x,b.z1+2.15,Math.PI);
    }
    if(d>3.5){chair(batch,b.x1+.85,b.z2-.7);chair(batch,b.x1+1.55,b.z2-.7);}
    if(w>4)plant(batch,b.x2-.55,b.z1+.65);
    batch.box('white',b.x2-.45,1.0,b.z1+1.2,.55,1.8,1.8);return;
  }
  if(room.type==='pharmacy') {
    for(let i=0;i<3;i++){
      batch.box('white',b.x1+.8+i*.85,1.0,b.z1+.4,.72,1.7,.45);
      batch.box('glass',b.x1+.8+i*.85,1.2,b.z1+.65,.65,1.1,.03);
    }
    desk(batch,cx,cz,Math.min(w-1,2.4));return;
  }
  // Unknown rooms retain their names/types: furniture is a visual example only.
  if(w>2.1&&d>3.3) {
    if(index%4===0) {
      for(let i=0;i<Math.min(4,Math.floor(w/.8)-1);i++)chair(batch,b.x1+.7+i*.72,b.z1+.7);
      if(d>4)desk(batch,cx,b.z2-1.0,Math.min(1.5,w-1));
      plant(batch,b.x2-.6,b.z2-.65);
    } else {
      bed(batch,b.x1+Math.min(1.05,w*.35),cz);
      if(w>4.6)bed(batch,b.x2-1.1,cz);
      else if(w>2.8){desk(batch,b.x2-.85,b.z1+.65,1.15);chair(batch,b.x2-.8,b.z1+1.5,Math.PI);}
      batch.box('white',b.x2-.4,1.0,b.z2-.5,.5,1.7,.75);
    }
  } else {chair(batch,cx,cz);}
}

function wall(batch,edge,door,thickness,seen) {
  const key=[edge.axis,edge.fixed,edge.start,edge.end].map(x=>typeof x==='number'?x.toFixed(2):x).join(':');
  if(seen.has(key))return;seen.add(key);
  const height=edge.fixed===0?2.65:1.12;
  const segment=(a,b)=>{
    const l=b-a;if(l<.04)return;
    const x=edge.axis==='x'?(a+b)/2:edge.fixed,z=edge.axis==='x'?edge.fixed:(a+b)/2;
    const sx=edge.axis==='x'?l:thickness,sz=edge.axis==='x'?thickness:l;
    batch.box('wall',x,height/2+.12,z,sx,height,sz);
    batch.box('white',x,height+.14,z,sx+.025,.05,sz+.025);
    batch.box('trim',x,.34,z,sx+.012,.1,sz+.012);
    batch.box('pale',x,.15,z,sx+.025,.12,sz+.025);
    if(height>2&&l>1.8) {
      const wx=edge.axis==='x'?Math.min(l-1,2.2):.035,wz=edge.axis==='x'?.035:Math.min(l-1,2.2);
      batch.box('glass',x,1.75,z+.12,wx,.85,wz);
      batch.box('metal',x,1.3,z+.13,wx+.08,.045,wz+.08);
    }
  };
  if(door&&door.axis===edge.axis&&Math.abs(door.fixed-edge.fixed)<.01) {
    const half=.53,a=Math.max(edge.start,door.center-half),b=Math.min(edge.end,door.center+half);
    segment(edge.start,a);segment(b,edge.end);
    const x=edge.axis==='x'?door.center:edge.fixed,z=edge.axis==='x'?edge.fixed:door.center;
    const ry=edge.axis==='x'?0:Math.PI/2;
    for(const dx of [-.57,.57]) {
      batch.box('wood',x+Math.cos(ry)*dx,1.13,z-Math.sin(ry)*dx,.07,2.12,.12,ry);
    }
    batch.box('wood',x,2.2,z,1.2,.09,.12,ry);
    // A partly open leaf makes the doorway and circulation legible.
    const angle=ry-.6;
    batch.box('pale',x-.2*Math.cos(ry),1.08,z+.19,1.0,1.98,.055,angle);
    batch.box('glass',x-.2*Math.cos(ry),1.53,z+.23,.53,.53,.06,angle);
    batch.cylinder('metal',x+.15*Math.cos(ry),1.02,z+.4,.035,.12,.035);
  } else segment(edge.start,edge.end);
}

function sign(room,door,group) {
  if(room.unlabeled || typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const c=canvas.getContext('2d');c.fillStyle='#1c716b';c.fillRect(0,0,512,96);
  c.fillStyle='#fff';c.font='600 30px "Segoe UI",sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.fillText(room.name,256,48,480);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.34),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
  mesh.position.set(door.axis==='x'?door.center:door.fixed,2.43,door.axis==='x'?door.fixed:door.center);
  mesh.rotation.y=door.axis==='x'?0:Math.PI/2;mesh.name=room.id+'-sign';mesh.userData={type:'sign',illustrative:true};group.add(mesh);
}

export function buildHospitalFloor(floor,rooms,coord,nodes,materials) {
  const group=new THREE.Group();group.name=floor.id;
  group.userData={floorId:floor.id,level:floor.level};group.position.y=floor.elevation_m;
  const batch=new Batches(group,materials),shell=new Batches(group,materials,'architecture'),roomMeshes=new Map(),seen=new Set();
  const width=coord.building_width_m??34.92,depth=coord.building_depth_m??41.92;
  shell.box('base',width/2,-.28,depth/2,width+2,.6,depth+2);
  shell.box('white',width/2,.05,depth/2,width+1.4,.08,depth+1.4);
  // Broad circulation floor: shared world-space tile UVs, including corridors.
  const slab=new THREE.Mesh(new THREE.PlaneGeometry(width+.8,depth+.8),materials.tile);
  slab.rotation.x=-Math.PI/2;slab.position.set(width/2,.105,depth/2);slab.receiveShadow=true;
  const uv=slab.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(width+.8)/1.2,uv.getY(i)*(depth+.8)/1.2);
  slab.userData={type:'interior'};group.add(slab);
  rooms.forEach((room,index)=>{
    const b=room.bounds,w=b.x2-b.x1,d=b.z2-b.z1;if(w<=0||d<=0)return;
    const geometry=new THREE.BoxGeometry(w,.1,d),pos=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+(b.x1+b.x2)/2)/1.2,(pos.getZ(i)+(b.z1+b.z2)/2)/1.2);
    const mat=materials.tile.clone();mat.color.setHex(room.type==='office'?0xeee7d8:room.type==='wc'?0xdcebea:room.type==='stairs'?0xe4e9e5:0xf4f5ee);
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set((b.x1+b.x2)/2,.1,(b.z1+b.z2)/2);
    mesh.name=room.id;mesh.userData={type:'room',roomId:room.id,floorId:floor.id,roomName:room.name,roomType:room.type};mesh.receiveShadow=true;
    roomMeshes.set(room.id,mesh);group.add(mesh);
    const door=nearestDoor(room,nodes);
    for(const edge of [{axis:'x',fixed:b.z1,start:b.x1,end:b.x2},{axis:'x',fixed:b.z2,start:b.x1,end:b.x2},{axis:'z',fixed:b.x1,start:b.z1,end:b.z2},{axis:'z',fixed:b.x2,start:b.z1,end:b.z2}])wall(shell,edge,door,coord.WALL_THICKNESS_M??.18,seen);
    furnish(batch,room,index);sign(room,door,group);
  });
  // Plants mark the outside of the floor, without adding graph nodes or destinations.
  for(let z=3;z<depth;z+=6)plant(batch,width+1.0,z,.95);
  batch.box('lawn',width+1.05,-.05,depth/2,1.2,.12,depth-1);
  for(let x=1.5;x<width-1;x+=5)plant(batch,x,-1.0,.7);
  shell.finish();batch.finish();
  return {group,roomMeshes};
}
