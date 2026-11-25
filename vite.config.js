import { defineConfig } from 'vite';
import { addPlacementRoutes } from './tools/beacon_placement_server.mjs';

// ─── In-memory relay store (dev only) ────────────────────────────────────────
// Laptop pushes {code, roomId, floorId, confidence, timestamp} here.
// Phone polls here with the same code.
const _relaySessions = new Map(); // code → {roomId, floorId, confidence, timestamp} | null

function _isLocalhost(remoteAddr) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddr);
}

function _addRelayRoutes(middlewares) {
  // POST /api/loc/new-code — laptop requests a fresh pairing code
  middlewares.use('/api/loc/new-code', (req, res, next) => {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    const code = String(100000 + Math.floor(Math.random() * 900000));
    _relaySessions.set(code, null);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({ code }));
  });

  // POST /api/loc/push — laptop pushes current room (only from localhost)
  middlewares.use('/api/loc/push', (req, res, next) => {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    if (!_isLocalhost(req.socket.remoteAddress)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
      return;
    }
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { code, roomId, floorId, confidence, timestamp } = JSON.parse(body);
        if (!code || !roomId) { res.statusCode = 400; res.end(); return; }
        if (!_relaySessions.has(code)) { res.statusCode = 404; res.end(JSON.stringify({ ok: false, error: 'code-not-found' })); return; }
        _relaySessions.set(code, { roomId, floorId: floorId ?? roomId.split('_')[0], confidence: confidence ?? 1, timestamp: timestamp ?? Date.now() });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch { res.statusCode = 400; res.end(); }
    });
  });

  // GET /api/loc/poll?code=XXXXXX — phone polls for current location
  middlewares.use('/api/loc/poll', (req, res, next) => {
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const code = url.searchParams.get('code') ?? '';
    const entry = _relaySessions.get(code);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (entry === undefined) {
      res.end(JSON.stringify({ found: false, error: 'code-not-found' }));
    } else if (entry === null) {
      res.end(JSON.stringify({ found: false, reason: 'no-data-yet' }));
    } else {
      res.end(JSON.stringify({ found: true, ...entry }));
    }
  });
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        main:          './index.html',
        scan:          './scan/index.html',
        'beacon-admin': './beacon-admin.html',
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    {
      name: 'loc-relay',
      configureServer(server) {
        _addRelayRoutes(server.middlewares);
      },
    },
    {
      // Chỉ dev server (không có trong build/preview): ghi vị trí beacon, chỉ loopback.
      name: 'beacon-placement',
      configureServer(server) {
        addPlacementRoutes(server.middlewares, server.config.root);
      },
    },
  ],
  optimizeDeps: {
    include: ['three'],
  },
});
