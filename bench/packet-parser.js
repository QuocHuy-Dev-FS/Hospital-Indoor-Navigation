/**
 * packet-parser.js — Phân tích gói quảng bá BLE
 * Dữ liệu tổng hợp (synthetic) dùng cho bench test và giả lập.
 * Module thuần JS — không phụ thuộc, không CDN; chạy được cả trên trình duyệt và Node.js.
 */

// Company ID Apple (iBeacon): 0x004C (little-endian → bytes [0x4C, 0x00])
const COMPANY_APPLE = 0x004C;
// Service UUID Eddystone: 0xFEAA
const SVC_EDDYSTONE = 0xFEAA;

/**
 * Chuyển mảng byte (0–255) thành chuỗi hex viết thường có dấu cách mỗi byte.
 * @param {Uint8Array|number[]} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Chuyển 16 byte thành chuỗi UUID chuẩn (8-4-4-4-12).
 * @param {Uint8Array|number[]} bytes — 16 byte
 * @returns {string}
 */
export function bytesToUUID(bytes) {
  const h = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/**
 * Phân tích manufacturerData của một sự kiện BLE advertisementreceived.
 *
 * Web Bluetooth API trả về manufacturerData là Map<companyId, DataView>.
 * Hàm này nhận đầu vào theo hai dạng:
 *   - Web Bluetooth: Map<number, DataView>  (trình duyệt)
 *   - Test/bench:    { companyId, dataView } hoặc { companyId, bytes }
 *
 * @typedef {Object} IBeaconResult
 * @property {'iBeacon'} type
 * @property {string} uuid      — UUID 16 byte dạng 8-4-4-4-12
 * @property {number} major
 * @property {number} minor
 * @property {number} txPower   — TX power tham chiếu (dBm, có dấu)
 * @property {string} rawHex    — hex thô toàn bộ payload
 *
 * @typedef {Object} EddystoneResult
 * @property {'eddystone'} type
 * @property {string} rawHex
 *
 * @typedef {Object} UnknownResult
 * @property {'unknown'} type
 * @property {number} companyId
 * @property {string} rawHex
 *
 * @typedef {Object} NoDataResult
 * @property {'no-manufacturer-data'} type
 *
 * @param {Map<number, DataView>|null|undefined} manufacturerData — từ Web Bluetooth
 * @param {Uint8Array|null}  [serviceData]  — bytes service data (tùy chọn, dùng để phát hiện Eddystone)
 * @returns {IBeaconResult|EddystoneResult|UnknownResult|NoDataResult}
 */
export function parseManufacturerData(manufacturerData, serviceData = null) {
  // Eddystone: kiểm tra serviceData trước (không dùng manufacturerData)
  if (serviceData && serviceData.length >= 1) {
    return {
      type: 'eddystone',
      rawHex: bytesToHex(serviceData),
    };
  }

  if (!manufacturerData || manufacturerData.size === 0) {
    return { type: 'no-manufacturer-data' };
  }

  // Duyệt qua các company trong map
  for (const [companyId, dv] of manufacturerData) {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const rawHex = bytesToHex(bytes);

    if (companyId === COMPANY_APPLE) {
      // iBeacon: byte[0]=0x02, byte[1]=0x15, rồi 16 byte UUID, 2 byte Major, 2 byte Minor, 1 byte TX Power
      // (Web Bluetooth đã cắt bỏ 2 byte companyId nên offset bắt đầu từ 0)
      if (bytes.length >= 23 && bytes[0] === 0x02 && bytes[1] === 0x15) {
        const uuid    = bytesToUUID(bytes.slice(2, 18));
        const major   = (bytes[18] << 8) | bytes[19];
        const minor   = (bytes[20] << 8) | bytes[21];
        const txPower = bytes[22] > 127 ? bytes[22] - 256 : bytes[22]; // dBm có dấu
        return { type: 'iBeacon', uuid, major, minor, txPower, rawHex };
      }
      // Apple nhưng không đúng cấu trúc iBeacon
      return { type: 'unknown', companyId, rawHex };
    }

    // Không phải Apple — trả về unknown + hex thô
    return { type: 'unknown', companyId, rawHex };
  }

  return { type: 'no-manufacturer-data' };
}

/**
 * Tạo manufaturerData giả (dạng Map<number, DataView>) từ thông số iBeacon.
 * Dùng cho bench test và giả lập.
 *
 * @param {string} uuid     — chuỗi UUID 8-4-4-4-12
 * @param {number} major
 * @param {number} minor
 * @param {number} txPower  — dBm có dấu, ví dụ -59
 * @returns {Map<number, DataView>}
 */
export function buildIBeaconManufacturerData(uuid, major, minor, txPower) {
  // Bỏ dấu gạch ngang UUID → 32 ký tự hex
  const uuidHex = uuid.replace(/-/g, '');
  if (uuidHex.length !== 32) throw new Error('UUID không hợp lệ: phải 32 ký tự hex sau khi bỏ dấu gạch');

  const buf = new Uint8Array(23);
  buf[0] = 0x02;
  buf[1] = 0x15;
  for (let i = 0; i < 16; i++) {
    buf[2 + i] = parseInt(uuidHex.slice(i * 2, i * 2 + 2), 16);
  }
  buf[18] = (major >> 8) & 0xFF;
  buf[19] = major & 0xFF;
  buf[20] = (minor >> 8) & 0xFF;
  buf[21] = minor & 0xFF;
  buf[22] = txPower < 0 ? txPower + 256 : txPower;

  const dv = new DataView(buf.buffer);
  const map = new Map();
  map.set(COMPANY_APPLE, dv);
  return map;
}

/**
 * Tính beaconKey chuẩn từ kết quả iBeacon (dùng làm khóa tra trong bảng ánh xạ).
 * Dạng: "<UUID-thường>-<major>-<minor>"
 *
 * @param {IBeaconResult} parsed
 * @returns {string}
 */
export function iBeaconKey(parsed) {
  if (parsed.type !== 'iBeacon') throw new Error('Không phải iBeacon');
  return `${parsed.uuid.toLowerCase()}-${parsed.major}-${parsed.minor}`;
}
