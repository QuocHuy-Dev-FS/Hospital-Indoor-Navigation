import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scopeFloors, floorName, isRoomTap } from '../src/ui/floorScope.js';
import { buildGraph, astar } from '../src/nav/astar.js';
import { generateInstructions } from '../src/nav/instructions.js';

test('three-floor scope keeps IDs, valid edges, connectors, routes and source intact', async () => {
  const source = {};
  for (const name of ['floors','rooms','nodes','edges','connectors','beacons']) {
    source[name] = JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)));
  }
  source.coordSys = JSON.parse(await readFile(new URL('../data/coordinate_system.json', import.meta.url)));
  const before = JSON.stringify(source);
  const data = scopeFloors(source);
  assert.deepEqual(data.floors.map(f => f.name), ['Tầng trệt', 'Tầng 1', 'Tầng 2']);
  assert.deepEqual(data.floors.map(f => f.id), ['F1', 'F2', 'F3']);
  assert.equal(JSON.stringify(source), before);
  const nodeIds = new Set(data.nodes.map(n => n.id));
  assert.ok(data.edges.every(e => nodeIds.has(e.from) && nodeIds.has(e.to)));
  assert.ok(data.rooms.every(r => ['F1','F2','F3'].includes(r.floorId)));
  assert.ok(data.beacons.every(b => ['F1','F2','F3'].includes(b.floorId)));
  assert.ok(data.connectors.every(c => c.links.every(l => nodeIds.has(l.nodeId))));
  const graph = buildGraph(data.nodes, data.edges);
  const from = data.rooms.find(r => r.floorId === 'F1' && r.doorNodeId);
  const to = data.rooms.find(r => r.floorId === 'F3' && r.doorNodeId);
  for (const wheelchairOnly of [false, true]) {
    const route = astar(graph, from.doorNodeId, to.doorNodeId, { wheelchairOnly });
    assert.ok(route, `route between ground and second floor (wheelchair=${wheelchairOnly})`);
    assert.ok(route.path.every(id => nodeIds.has(id)));
  }
});

test('drag, pinch and pointer cancellation do not become a room tap', () => {
  const end = {pointerId:1,button:0,clientX:102,clientY:101};
  assert.equal(isRoomTap({id:1,x:100,y:100,moved:false},end),true);
  assert.equal(isRoomTap({id:1,x:0,y:0,moved:false},end),false);
  assert.equal(isRoomTap({id:1,x:100,y:100,moved:true},end),false);
  assert.equal(isRoomTap({id:2,x:100,y:100,moved:false},end),false);
  assert.equal(isRoomTap(null,end),false);
});

test('spoken floor directions match the displayed ground/first/second names', () => {
  const nodes = [{id:'a',floorId:'F1',x:0,y:0,z:0},{id:'b',floorId:'F3',x:0,y:7.2,z:0}];
  const up = generateInstructions(nodes,[{from:'a',to:'b',type:'elevator'}]);
  assert.match(up[0].text,/lên tầng 2/i);
  const down = generateInstructions([...nodes].reverse(),[{from:'b',to:'a',type:'stairs'}]);
  assert.match(down[0].text,/xuống tầng trệt/i);
  assert.equal(floorName('F2'),'Tầng 1');
});
