import os from 'os';
import { spawn } from 'child_process';
import process from 'process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Resolve vite binary relative to project so it works without PATH
const viteBin = path.join(projectRoot, 'node_modules', '.bin', 'vite');

// Port: env PORT → vite.config default 5173
const PORT = parseInt(process.env.PORT || '5173', 10);

// Skip virtual/tunnel adapters (Windows names)
const VIRTUAL_RE = /vEthernet|WSL|VirtualBox|VMware|Docker|Loopback|Virtual|Pseudo/i;

function getLanIPs() {
  const ifaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (VIRTUAL_RE.test(name)) continue;
    for (const addr of (addrs || [])) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const ip = addr.address;
      const isPrivate =
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
      if (isPrivate) result.push(ip);
    }
  }
  return result;
}

const ips = getLanIPs();

console.log('');
console.log('  Local:   http://localhost:' + PORT);
if (ips.length > 0) {
  for (const ip of ips) {
    console.log('  Network: http://' + ip + ':' + PORT + '   ← mở link này trên điện thoại cùng Wi-Fi');
  }
} else {
  console.warn('  [CẢNH BÁO] Không tìm thấy địa chỉ IP LAN. Kiểm tra kết nối Wi-Fi.');
  console.warn('             Server vẫn khởi động, nhưng điện thoại có thể không truy cập được.');
}
console.log('');

// Spawn vite --host 0.0.0.0 (shell:true để .cmd hoạt động trên Windows; quote path vì có thể có space)
const child = spawn('"' + viteBin + '" --host 0.0.0.0', {
  stdio: 'inherit',
  shell: true,
  cwd: projectRoot,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
