"""
Finalize routing graph: connect door nodes to nearest room centroids,
assign doorNodeId to rooms, build edges list.
"""
import math
from .config import PipelineConfig


def _dist(n1: dict, n2: dict) -> float:
    return math.hypot(n1["x"] - n2["x"], n1["z"] - n2["z"])


def connect_doors_to_rooms(rooms: list, nodes: list, edges: list, doors: list, cfg: PipelineConfig):
    """
    For each door that has a nodeId, find the nearest room centroid within 3m
    and create a short edge door_node → room centroid node.
    Also sets room["doorNodeId"].
    Modifies rooms, nodes, edges in place.
    """
    e_idx = [len(edges)]

    # Build centroid nodes for rooms that don't have one yet
    room_nodes = {}
    node_lookup = {n["id"]: n for n in nodes}

    for room in rooms:
        cx, cz = room["centroid"]["x"], room["centroid"]["z"]
        # Create a room_entry node at the centroid
        nid = f"F1_N_R{room['id'].split('_R')[1]}"
        n = {"id": nid, "floorId": cfg.floor_id, "x": cx, "z": cz, "kind": "room_entry"}
        nodes.append(n)
        room_nodes[room["id"]] = n

    # Connect door nodes to nearest room
    door_nodes = [n for n in nodes if n.get("kind") == "door"]
    for dn in door_nodes:
        best_room = None
        best_dist = 5.0  # max 5m
        for room in rooms:
            rn = room_nodes.get(room["id"])
            if rn is None:
                continue
            d = math.hypot(dn["x"] - rn["x"], dn["z"] - rn["z"])
            if d < best_dist:
                best_dist = d
                best_room = room
        if best_room:
            best_room["doorNodeId"] = dn["id"]
            rn = room_nodes[best_room["id"]]
            eid = f"F1_E{e_idx[0]:03d}"
            e_idx[0] += 1
            edges.append({
                "id": eid,
                "from": dn["id"],
                "to": rn["id"],
                "length_m": round(best_dist, 4),
                "weight": round(best_dist, 4),
                "bidirectional": True,
                "wheelchairOk": True,
                "type": "walk",
                "restricted": False,
                "widthMin_m": None,
            })


def assign_connector_nodes(connectors: list, nodes: list, edges: list, cfg: PipelineConfig):
    """
    Assign the nearest graph node to each connector's F1 link.
    Connector edges are NOT created here (no multi-floor data yet).
    """
    walk_nodes = [n for n in nodes if n.get("kind") in ("junction", "corridor", "landing", "stair_end", "elev_door")]
    for conn in connectors:
        links = conn.get("links", [])
        for link in links:
            if link.get("nodeId") is not None:
                continue
            # Placeholder: first walk node (will be corrected manually)
            if walk_nodes:
                link["nodeId"] = walk_nodes[0]["id"]
                link["note"] = "Cần xác nhận – gán tạm nút đầu tiên"


def build_review_items(rooms: list, doors: list, connectors: list, nodes: list, edges: list) -> list:
    """Collect all review items: unconfirmed doors, rooms without doors, etc."""
    items = []

    # Rooms without doorNodeId
    for room in rooms:
        if not room.get("doorNodeId"):
            items.append({
                "type": "room_no_door",
                "roomId": room["id"],
                "message": f"Phòng {room['id']} ({room['name']}) không có doorNodeId – Cần xác nhận"
            })

    # Unconfirmed doors
    for door in doors:
        if not door.get("confirmed"):
            items.append({
                "type": "door_unconfirmed",
                "doorId": door["id"],
                "message": f"Cửa {door['id']} chưa xác nhận – phát hiện tự động từ ký hiệu cánh mở"
            })

    # Connectors with single floor (warning only)
    for conn in connectors:
        if len(conn.get("links", [])) <= 1:
            items.append({
                "type": "connector_single_floor",
                "connectorId": conn["id"],
                "severity": "warning",
                "message": f"Connector {conn['id']} chỉ có 1 tầng – Cần xác nhận tầng đích và nối thêm"
            })
        if not conn.get("confirmed"):
            items.append({
                "type": "connector_unconfirmed",
                "connectorId": conn["id"],
                "message": f"Connector {conn['id']} chưa xác nhận loại/vị trí"
            })

    # Elevator wheelchair status
    for conn in connectors:
        if conn.get("type") == "elevator" and not conn.get("confirmed"):
            items.append({
                "type": "elevator_wheelchair_unconfirmed",
                "connectorId": conn["id"],
                "severity": "warning",
                "message": f"Thang máy {conn['id']} wheelchairOk=false cho đến khi được xác nhận"
            })

    return items
