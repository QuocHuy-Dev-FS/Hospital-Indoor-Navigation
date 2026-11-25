import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {SceneBuilder} from '../src/scene/SceneBuilder.js';
import {nearestDoor} from '../src/scene/HospitalInterior.js';
import {scopeFloors} from '../src/ui/floorScope.js';

test('detailed hospital preserves room IDs, bounds, elevations and finite instanced geometry',async()=>{
 const source={};for(const k of ['floors','rooms','nodes','edges'])source[k]=JSON.parse(await readFile(new URL('../data/'+k+'.json',import.meta.url)));
 source.coordSys=JSON.parse(await readFile(new URL('../data/coordinate_system.json',import.meta.url)));
 const before=JSON.stringify(source),data=scopeFloors(source),scene=new THREE.Scene(),builder=new SceneBuilder(data.coordSys);
 builder.buildAll(data.floors,data.rooms,scene,data.nodes);
 assert.deepEqual(builder.getAllFloorIds(),['F1','F2','F3']);
 let instances=0,draws=0;
 for(const room of data.rooms){
  const mesh=builder.getRoomMesh(room.id);assert.ok(mesh,room.id);assert.equal(mesh.name,room.id);assert.equal(mesh.userData.roomName,room.name);
  assert.equal(mesh.geometry.parameters.width,room.bounds.x2-room.bounds.x1);
  assert.equal(mesh.geometry.parameters.depth,room.bounds.z2-room.bounds.z1);
 }
 for(const floor of data.floors){
  const group=builder.getFloorGroup(floor.id);assert.equal(group.position.y,floor.elevation_m);
  group.traverse(obj=>{if(obj.isInstancedMesh){draws++;instances+=obj.count;assert.ok([...obj.instanceMatrix.array].every(Number.isFinite));}});
 }
 assert.ok(instances>1000);assert.ok(draws<100,'repeated furnishings are batched');
 builder.setViewMode('single','F1');builder.setActiveFloor('F1');
 assert.equal(builder.getFloorGroup('F2').visible,false);
 builder.highlightRoom(data.rooms[0].id);builder.setActiveFloor('F2');
 const room2=data.rooms.find(r=>r.floorId==='F2');assert.equal(builder.getRoomMesh(room2.id).material.transparent,false);
 assert.equal(JSON.stringify(source),before);
 console.log(`Hospital model: ${instances} instances in ${draws} instanced draws for 3 floors.`);
 builder.disposeAll(scene);assert.equal(builder.getAllFloorIds().length,0);
});

test('door aperture projects to the nearest real room edge',()=>{
 const room={bounds:{x1:0,x2:5,z1:0,z2:6},doorNodeId:'door'};
 const south=nearestDoor(room,[{id:'door',x:2,z:7.5}]);assert.equal(south.axis,'x');assert.equal(south.fixed,6);assert.equal(south.center,2);
 const east=nearestDoor(room,[{id:'door',x:7,z:3}]);assert.equal(east.axis,'z');assert.equal(east.fixed,5);assert.equal(east.center,3);
});
