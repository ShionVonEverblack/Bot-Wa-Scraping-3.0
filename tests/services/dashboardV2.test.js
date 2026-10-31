'use strict';

const http = require('http');
const dashboard = require('../../src/services/monitor/dashboard');
const config = require('../../src/config');
const stats = require('../../src/services/monitor/stats');

describe('services/monitor/dashboard v2.0 — Zero-Flicker SSE, Auth, & Host Bind Guard', () => {
  let activeServer = null;
  const TEST_PORT = 3198;

  afterEach(async () => {
    if (activeServer) {
      await dashboard.stopDashboard();
      activeServer = null;
    }
    stats.reset();
  });

  // Helper HTTP request function using node's built-in http
  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const opt = {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method: options.method || 'GET',
        headers: options.headers || {},
      };

      const req = http.request(opt, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      });

      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  test('refuses to start when host is non-loopback (e.g. 0.0.0.0) and token is empty', () => {
    // Config has empty token by default in test env
    const srv = dashboard.startDashboard(TEST_PORT + 1, '0.0.0.0');
    expect(srv).toBeNull();
  });

  test('starts on loopback without token, delivers zero-flicker HTML and live SSE stream', async () => {
    activeServer = dashboard.startDashboard(TEST_PORT, '127.0.0.1');
    expect(activeServer).not.toBeNull();

    // 1. Check HTML page
    const pageRes = await request('/');
    expect(pageRes.statusCode).toBe(200);
    expect(pageRes.body).toContain('Live Dashboard v2.0');
    expect(pageRes.body).not.toContain('<meta http-equiv="refresh"');
    expect(pageRes.body).toContain('EventSource(\'/api/events\')');

    // 2. Check JSON status API
    const statusRes = await request('/api/status');
    expect(statusRes.statusCode).toBe(200);
    const data = JSON.parse(statusRes.body);
    expect(data.bot).toBe(config.botName);
    expect(data.version).toBe('3.0.0');
    expect(data.messages).toBeDefined();
    expect(data.jobs).toBeDefined();

    // 3. Check SSE headers & first snapshot
    const sseRes = await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port: TEST_PORT, path: '/api/events', method: 'GET' },
        (res) => {
          let chunkReceived = '';
          res.on('data', chunk => {
            chunkReceived += chunk.toString();
            if (chunkReceived.includes('data:')) {
              req.destroy(); // abort connection after verifying first frame
              resolve({
                statusCode: res.statusCode,
                contentType: res.headers['content-type'],
                data: chunkReceived,
              });
            }
          });
        }
      );
      req.on('error', (err) => {
        // Destroy error is expected when aborting
        if (err.code === 'ECONNRESET') return;
        reject(err);
      });
      req.end();
    });

    expect(sseRes.statusCode).toBe(200);
    expect(sseRes.contentType).toContain('text/event-stream');
    expect(sseRes.data).toContain('"bot":');
  });

  test('enforces token authentication when DASHBOARD_TOKEN is configured', async () => {
    activeServer = dashboard.startDashboard(TEST_PORT, '127.0.0.1', 'secret-token-12345');

    // 1. Unauthenticated request to / redirects to /login
    const unauthPage = await request('/');
    expect(unauthPage.statusCode).toBe(302);
    expect(unauthPage.headers.location).toBe('/login');

    // 2. Unauthenticated request to /api/status returns 401
    const unauthApi = await request('/api/status');
    expect(unauthApi.statusCode).toBe(401);

    // 3. Bearer token in header passes
    const authHeaderRes = await request('/api/status', {
      headers: { Authorization: 'Bearer secret-token-12345' },
    });
    expect(authHeaderRes.statusCode).toBe(200);

    // 4. POST /login with invalid token fails
    const postInvalid = await request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=wrong-pass',
    });
    expect(postInvalid.statusCode).toBe(401);
    expect(postInvalid.body).toContain('Token tidak valid');

    // 5. POST /login with valid token sets cookie and redirects
    const postValid = await request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=secret-token-12345',
    });
    expect(postValid.statusCode).toBe(302);
    expect(postValid.headers['set-cookie']).toBeDefined();
    const cookieHeader = postValid.headers['set-cookie'][0];
    expect(cookieHeader).toContain('rima_dash=');
    expect(cookieHeader).toContain('HttpOnly');

    // 6. Access / with session cookie succeeds
    const cookieVal = cookieHeader.split(';')[0];
    const pageWithCookie = await request('/', {
      headers: { Cookie: cookieVal },
    });
    expect(pageWithCookie.statusCode).toBe(200);
    expect(pageWithCookie.body).toContain('Live Dashboard v2.0');
  });

  test('setReady, setDisconnected, and setQR update snapshot state cleanly', async () => {
    dashboard.setReady('628123456789');
    let snap = dashboard.getTelemetrySnapshot();
    expect(snap.status).toBe('ready');
    expect(snap.connectedUser).toBe('628123456789');

    dashboard.setDisconnected('Network reset');
    snap = dashboard.getTelemetrySnapshot();
    expect(snap.status).toBe('disconnected');
    expect(snap.connectedUser).toBeNull();

    await dashboard.setQR('1@mockqrdata');
    snap = dashboard.getTelemetrySnapshot();
    expect(snap.status).toBe('waiting_scan');
    expect(snap.hasQR).toBe(true);
    expect(snap.qrDataUrl).toContain('data:image/png;base64');
  });
});
