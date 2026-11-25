// Keep source IDs and coordinates stable; scope all runtime features together.
export const FLOOR_NAMES = { F1: 'Tầng trệt', F2: 'Tầng 1', F3: 'Tầng 2' };

export function floorName(id) {
  return FLOOR_NAMES[id] ?? id;
}

export function scopeFloors(source) {
  const floors = (source.floors ?? [])
    .filter(f => Object.hasOwn(FLOOR_NAMES, f.id))
    .map(f => ({ ...f, name: floorName(f.id) }));
  const ids = new Set(floors.map(f => f.id));
  const nodes = (source.nodes ?? []).filter(n => ids.has(n.floorId));
  const nodeIds = new Set(nodes.map(n => n.id));
  return {
    ...source, floors, nodes,
    coordSys: { ...source.coordSys, TOTAL_FLOORS: floors.length },
    rooms: (source.rooms ?? []).filter(r => ids.has(r.floorId)),
    beacons: (source.beacons ?? []).filter(b => ids.has(b.floorId)),
    edges: (source.edges ?? []).filter(e => nodeIds.has(e.from) && nodeIds.has(e.to)),
    connectors: (source.connectors ?? []).map(c => ({ ...c,
      links: (c.links ?? []).filter(l => ids.has(l.floorId) && nodeIds.has(l.nodeId)),
    })).filter(c => c.links.length > 1),
  };
}

// A drag, pinch or cancelled pointer must never select a room.
export function isRoomTap(start, end) {
  return !!start && !start.moved && start.id === end.pointerId && end.button === 0
    && Math.hypot(end.clientX - start.x, end.clientY - start.y) <= 6;
}
