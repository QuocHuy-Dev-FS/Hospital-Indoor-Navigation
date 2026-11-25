/**
 * BLE Adapter — nối RealSource + RoomResolver từ bench/ vào app chính.
 * Kích hoạt bằng: import động khi URL có ?beacon=real
 *
 * API:
 *   start(beaconMap, onRoom) → void
 *   stop()                  → void
 *
 * onRoom({ roomId, roomName, status }) được gọi khi kết quả thay đổi.
 * status: 'near-room' | 'lost' | 'uncertain'
 */

let _realSrc       = null;
let _resolver      = null;
let _resolveTimer  = null;
let _lastStatus    = null;
let _onRoom        = null;

export async function start(beaconMap, onRoom) {
  if (_realSrc) stop();

  _onRoom = onRoom;

  const { RealSource }   = await import('../../bench/beacon-source.js');
  const { RoomResolver } = await import('../../bench/room-resolver.js');

  _resolver = new RoomResolver(beaconMap);

  _realSrc = new RealSource();
  await _realSrc.start(_onAdvertisement);
}

export function stop() {
  _realSrc?.stop();
  _realSrc = null;
  clearTimeout(_resolveTimer);
  _resolveTimer = null;
  _resolver     = null;
  _lastStatus   = null;
  _onRoom       = null;
}

function _onAdvertisement(ev) {
  if (!_resolver) return;
  _resolver.addSample(ev.beaconKey, ev.rssi, ev.timestamp);
  clearTimeout(_resolveTimer);
  _resolveTimer = setTimeout(_runResolve, 500);
}

function _runResolve() {
  if (!_resolver || !_onRoom) return;
  const result = _resolver.resolve();
  const key = result.status + ':' + (result.roomId ?? '');
  if (key === _lastStatus) return;
  _lastStatus = key;
  _onRoom({ roomId: result.roomId, roomName: result.roomName, status: result.status });
}
