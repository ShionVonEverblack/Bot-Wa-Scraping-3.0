'use strict';

/**
 * @fileoverview Web Dashboard v2.0 — Real-time telemetry, zero-flicker SSE updates,
 * token-based authentication, and operational control overview.
 * @module services/monitor/dashboard
 */

const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../../config');
const { createLogger } = require('./logger');
const { formatDuration } = require('../../utils/time');
const stats = require('./stats');
const jobQueue = require('../../jobs/jobQueue');
const pauseHandler = require('../../commands/handlers/pause.handler');

const log = createLogger('monitor:dashboard');

/** @type {import('http').Server|null} */
let server = null;

/** @type {string|null} QR code data string */
let currentQR = null;

/** @type {string|null} Cached QR code Data URL (base64 PNG) */
let currentQrDataUrl = null;

/** @type {string} Status koneksi bot saat ini */
let connectionStatus = 'initializing';

/** @type {number} Timestamp saat bot pertama kali di-boot */
const bootTime = Date.now();

/** @type {string|null} Informasi user WhatsApp yang login */
let connectedUser = null;

/** @type {Set<import('http').ServerResponse>} Active SSE subscriber connections */
const sseClients = new Set();

/** In-memory login attempt tracker for simple brute-force mitigation */
const loginAttempts = new Map();

// ─── Status Configuration & State ──────────────────────────────────────────

const STATUS_CONFIG = {
  initializing: { emoji: '⏳', color: '#f0ad4e', label: 'Inisialisasi...' },
  waiting_scan: { emoji: '📱', color: '#5bc0de', label: 'Menunggu Scan QR' },
  authenticated: { emoji: '🔐', color: '#0275d8', label: 'Terautentikasi' },
  ready: { emoji: '✅', color: '#00b894', label: 'Online & Siap' },
  disconnected: { emoji: '❌', color: '#e17055', label: 'Terputus' },
};

/**
 * Broadcast current telemetry snapshot to all connected SSE clients.
 */
function broadcastSSE() {
  if (sseClients.size === 0) return;
  const payload = `data: ${JSON.stringify(getTelemetrySnapshot())}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Update QR code data and set status to 'waiting_scan'.
 * @param {string} qrData - QR code data dari whatsapp-web.js
 */
async function setQR(qrData) {
  currentQR = qrData;
  connectionStatus = 'waiting_scan';
  try {
    currentQrDataUrl = await QRCode.toDataURL(qrData, {
      width: 320,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (err) {
    log.error('Failed to generate QR data URL', { error: err.message });
  }
  log.info('Dashboard: QR code updated');
  broadcastSSE();
}

/**
 * Set status koneksi ke 'authenticated'.
 */
function setAuthenticated() {
  currentQR = null;
  currentQrDataUrl = null;
  connectionStatus = 'authenticated';
  log.info('Dashboard: Authenticated');
  broadcastSSE();
}

/**
 * Set status koneksi ke 'ready' (bot siap menerima pesan).
 * @param {string} [user] - Nama/nomor user yang terkoneksi
 */
function setReady(user) {
  currentQR = null;
  currentQrDataUrl = null;
  connectionStatus = 'ready';
  connectedUser = user || null;
  log.info('Dashboard: Bot ready');
  broadcastSSE();
}

/**
 * Set status koneksi ke 'disconnected'.
 * @param {string} [reason] - Alasan disconnect
 */
function setDisconnected(reason) {
  connectionStatus = 'disconnected';
  connectedUser = null;
  log.info(`Dashboard: Disconnected — ${reason || 'unknown'}`);
  broadcastSSE();
}

// ─── Metrics Aggregation ───────────────────────────────────────────────────

/**
 * Compile a comprehensive real-time telemetry snapshot.
 * @returns {Object}
 */
function getTelemetrySnapshot() {
  const uptime = formatDuration(Date.now() - bootTime);
  const mem = process.memoryUsage();
  const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const memTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

  const st = STATUS_CONFIG[connectionStatus] || STATUS_CONFIG.initializing;
  const sysStats = stats.snapshot();
  const queueStats = typeof jobQueue.getStats === 'function' ? jobQueue.getStats() : { running: 0, queued: 0 };
  const pauseSummary = typeof pauseHandler.getPausedSummary === 'function'
    ? pauseHandler.getPausedSummary()
    : { pausedCount: 0, commandOnlyCount: 0 };

  return {
    bot: config.botName,
    version: '3.0.0',
    status: connectionStatus,
    statusLabel: st.label,
    statusEmoji: st.emoji,
    statusColor: st.color,
    connectedUser,
    uptime,
    uptimeMs: Date.now() - bootTime,
    memory: {
      heapUsedMB: memMB,
      heapTotalMB: memTotalMB,
      rssMB,
    },
    node: process.version,
    env: config.nodeEnv,
    hasQR: !!currentQR,
    qrDataUrl: currentQrDataUrl,
    messages: sysStats.messages,
    commands: sysStats.commands,
    ai: {
      configuredProvider: config.ai.provider,
      fallbackOrder: config.ai.fallbackOrder,
      lastProvider: sysStats.ai.lastProvider,
      totalCalls: sysStats.ai.totalCalls,
      byProvider: sysStats.ai.byProvider,
    },
    jobs: queueStats,
    antiNimbrung: pauseSummary,
  };
}

// ─── Security & Authentication ─────────────────────────────────────────────

/**
 * Calculate expected HMAC session cookie value for given token.
 * @param {string} token
 * @returns {string}
 */
function getSessionHash(token) {
  return crypto.createHash('sha256').update(`${token}_rima_session_salt_2026`).digest('hex');
}

/**
 * Timing-safe string comparison.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Parse cookies from header string without external libraries.
 * @param {string|undefined} cookieHeader
 * @returns {Object<string, string>}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(part => {
    const [name, ...val] = part.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(val.join('='));
  });
  return cookies;
}

// ─── HTML Renderers ────────────────────────────────────────────────────────

/**
 * Render the modern Zero-Flicker HTML dashboard with embedded SSE listener.
 * @param {boolean} hasToken
 * @returns {string}
 */
function renderDashboardPage(hasToken) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.botName} — Live Dashboard v2.0</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a1a;
      --bg-card: #12122a;
      --bg-card-hover: #1a1a3e;
      --accent: #6c5ce7;
      --accent-glow: rgba(108, 92, 231, 0.3);
      --success: #00b894;
      --warning: #fdcb6e;
      --danger: #e17055;
      --info: #74b9ff;
      --text-primary: #f0f0f8;
      --text-secondary: #a0a0c0;
      --border: rgba(255, 255, 255, 0.08);
      --radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
      background-image:
        radial-gradient(ellipse at 20% 50%, rgba(108, 92, 231, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(0, 184, 148, 0.06) 0%, transparent 50%);
    }

    .header {
      text-align: center;
      margin-bottom: 1.5rem;
      position: relative;
      width: 100%;
      max-width: 800px;
    }
    .header h1 {
      font-size: 2.2rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--info));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.3rem;
    }
    .header .subtitle {
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
    .logout-btn {
      position: absolute;
      right: 0;
      top: 0.5rem;
      background: rgba(225, 112, 85, 0.15);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 0.4rem 0.9rem;
      border-radius: 8px;
      font-size: 0.8rem;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
    }
    .logout-btn:hover { background: var(--danger); color: #fff; }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 1.6rem;
      border-radius: 50px;
      font-weight: 700;
      font-size: 0.95rem;
      margin-bottom: 1.8rem;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--warning);
      animation: pulse 2s infinite;
    }

    .main-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      width: 100%;
      max-width: 800px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      margin-bottom: 1.5rem;
    }

    .qr-container { display: flex; flex-direction: column; align-items: center; }
    .qr-image {
      width: 260px;
      height: 260px;
      border-radius: 12px;
      border: 3px solid var(--accent);
      box-shadow: 0 0 30px var(--accent-glow);
      margin-bottom: 1rem;
      image-rendering: pixelated;
      background: #fff;
    }
    .qr-hint {
      color: var(--text-secondary);
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .status-ready { padding: 1.5rem 0; }
    .ready-icon { font-size: 3.5rem; display: block; margin-bottom: 0.8rem; }
    .connected-user {
      margin-top: 0.6rem;
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--success);
    }

    .status-waiting { padding: 1.5rem 0; }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    /* Grid Section */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 1rem;
      width: 100%;
      max-width: 800px;
      margin-bottom: 1.5rem;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.2rem;
      transition: all 0.2s;
    }
    .card:hover {
      background: var(--bg-card-hover);
      border-color: rgba(108, 92, 231, 0.3);
      transform: translateY(-2px);
    }
    .card-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-secondary);
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .card-value {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .card-subtext {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 0.4rem;
    }

    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: var(--success);
      font-weight: 600;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      animation: pulse 1.5s infinite;
    }

    .footer {
      margin-top: 1rem;
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.75rem;
    }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 600px) {
      .header h1 { font-size: 1.7rem; }
      .logout-btn { position: static; margin-top: 0.5rem; display: inline-block; }
      .qr-image { width: 220px; height: 220px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 ${config.botName}</h1>
    <p class="subtitle">Bot Scraping WhatsApp 3.0 — Telemetri Real-Time & Live Dashboard</p>
    ${hasToken ? '<a href="/logout" class="logout-btn">Keluar</a>' : ''}
  </div>

  <div class="status-badge" id="statusBadge">
    <span class="status-dot" id="statusDot"></span>
    <span id="statusText">Memuat status...</span>
  </div>

  <div class="main-card" id="connectionSection">
    <div class="status-waiting">
      <div class="spinner"></div>
      <p>Menghubungkan ke layanan WhatsApp...</p>
    </div>
  </div>

  <div class="dashboard-grid">
    <div class="card">
      <div class="card-title">⏱️ Uptime & Lingkungan</div>
      <div class="card-value" id="valUptime">0s</div>
      <div class="card-subtext" id="valEnv">Node.js ${process.version} · ${config.nodeEnv}</div>
    </div>

    <div class="card">
      <div class="card-title">💾 Pemakaian Memori (RAM)</div>
      <div class="card-value" id="valMem">0 MB</div>
      <div class="card-subtext" id="valMemSub">Total Heap: 0 MB</div>
    </div>

    <div class="card">
      <div class="card-title">📩 Aktivitas Pesan</div>
      <div class="card-value" id="valMsgTotal">0</div>
      <div class="card-subtext" id="valMsgBreakdown">DM: 0 · Grup: 0</div>
    </div>

    <div class="card">
      <div class="card-title">⚙️ Job Queue & Antrean</div>
      <div class="card-value" id="valJobs">0 Aktif</div>
      <div class="card-subtext" id="valJobsSub">Antrean menunggu: 0</div>
    </div>

    <div class="card">
      <div class="card-title">🤖 AI Provider Status</div>
      <div class="card-value" id="valAiProvider">${config.ai.provider}</div>
      <div class="card-subtext" id="valAiLast">Terakhir dipakai: -</div>
    </div>

    <div class="card">
      <div class="card-title">🤫 Kontrol Anti-Nimbrung</div>
      <div class="card-value" id="valAntiNimbrung">0 Paused</div>
      <div class="card-subtext" id="valAntiNimbrungSub">Command-only: 0 chat</div>
    </div>
  </div>

  <div class="footer">
    <div class="live-indicator">
      <span class="live-dot"></span>
      <span>SSE Real-Time Stream Aktif (Zero-Flicker)</span>
    </div>
    <p style="margin-top: 0.4rem;">${config.botName} v3.0 &copy; ${new Date().getFullYear()} · Google Antigravity Agent</p>
  </div>

  <script>
    let currentRenderedQr = null;
    let currentRenderedStatus = null;

    function updateDashboard(data) {
      if (!data) return;

      // Status Badge
      const statusBadge = document.getElementById('statusBadge');
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      if (statusText) statusText.textContent = (data.statusEmoji || '') + ' ' + (data.statusLabel || data.status);
      if (statusBadge && data.statusColor) {
        statusBadge.style.borderColor = data.statusColor + '44';
        statusBadge.style.color = data.statusColor;
      }
      if (statusDot && data.statusColor) {
        statusDot.style.background = data.statusColor;
      }

      // Connection Section (only re-render if status or QR Data changed)
      const connSec = document.getElementById('connectionSection');
      if (connSec && (currentRenderedStatus !== data.status || currentRenderedQr !== data.qrDataUrl)) {
        currentRenderedStatus = data.status;
        currentRenderedQr = data.qrDataUrl;

        if (data.status === 'ready') {
          connSec.innerHTML = '<div class="status-ready">' +
            '<span class="ready-icon">🟢</span>' +
            '<p>Bot sedang aktif dan menerima pesan</p>' +
            (data.connectedUser ? '<p class="connected-user">📞 ' + data.connectedUser + '</p>' : '') +
            '</div>';
        } else if (data.qrDataUrl) {
          connSec.innerHTML = '<div class="qr-container">' +
            '<img src="' + data.qrDataUrl + '" alt="Scan QR WhatsApp" class="qr-image" />' +
            '<p class="qr-hint">Buka WhatsApp di HP &rarr; <strong>Linked Devices</strong> &rarr; Scan QR di atas</p>' +
            '</div>';
        } else if (data.status === 'disconnected') {
          connSec.innerHTML = '<div class="status-waiting">' +
            '<span style="font-size: 3rem; display: block; margin-bottom: 0.5rem;">❌</span>' +
            '<p style="color: var(--danger);">Koneksi WhatsApp Terputus. Watchdog sedang memulihkan sesi...</p>' +
            '</div>';
        } else {
          connSec.innerHTML = '<div class="status-waiting">' +
            '<div class="spinner"></div>' +
            '<p>Menunggu koneksi WhatsApp...</p>' +
            '</div>';
        }
      }

      // Metrics updates (Zero-flicker textContent)
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal('valUptime', data.uptime || '0s');
      setVal('valMem', (data.memory?.heapUsedMB || '0') + ' MB');
      setVal('valMemSub', 'Total: ' + (data.memory?.heapTotalMB || '0') + ' MB | RSS: ' + (data.memory?.rssMB || '0') + ' MB');
      setVal('valMsgTotal', (data.messages?.total || 0) + ' Pesan');
      setVal('valMsgBreakdown', 'DM: ' + (data.messages?.dm || 0) + ' · Grup: ' + (data.messages?.group || 0));
      setVal('valJobs', (data.jobs?.running || 0) + ' Aktif');
      setVal('valJobsSub', 'Antrean menunggu: ' + (data.jobs?.queued || 0));
      setVal('valAiProvider', (data.ai?.configuredProvider || 'openai').toUpperCase());
      setVal('valAiLast', 'Terakhir: ' + (data.ai?.lastProvider || '-') + ' (' + (data.ai?.totalCalls || 0) + ' calls)');
      setVal('valAntiNimbrung', (data.antiNimbrung?.pausedCount || 0) + ' Paused');
      setVal('valAntiNimbrungSub', 'Command-only: ' + (data.antiNimbrung?.commandOnlyCount || 0) + ' chat');
    }

    // Connect Server-Sent Events (SSE)
    const evtSource = new EventSource('/api/events');
    evtSource.onmessage = function(e) {
      try {
        const payload = JSON.parse(e.data);
        updateDashboard(payload);
      } catch (err) {
        console.error('SSE JSON error', err);
      }
    };
    evtSource.onerror = function() {
      // Browser automatically retries connection
    };
  </script>
</body>
</html>`;
}

/**
 * Render the secure login page.
 * @param {string|null} [errorMessage]
 * @returns {string}
 */
function renderLoginPage(errorMessage = null) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — ${config.botName} Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: #0a0a1a;
      color: #f0f0f8;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .login-card {
      background: #12122a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    h2 { margin-bottom: 0.5rem; font-weight: 800; color: #6c5ce7; }
    p { color: #a0a0c0; font-size: 0.9rem; margin-bottom: 1.5rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.8rem 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: #0a0a1a;
      color: #fff;
      font-size: 1rem;
      box-sizing: border-box;
      margin-bottom: 1rem;
    }
    button {
      width: 100%;
      padding: 0.8rem;
      border-radius: 8px;
      border: none;
      background: #6c5ce7;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #5a49df; }
    .error {
      background: rgba(225, 112, 85, 0.2);
      border: 1px solid #e17055;
      color: #ff7675;
      padding: 0.6rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <h2>🔐 Akses Dashboard</h2>
    <p>Masukkan DASHBOARD_TOKEN untuk membuka status bot & QR Code WhatsApp.</p>
    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
    <form method="POST" action="/login">
      <input type="password" name="token" placeholder="DASHBOARD_TOKEN" required autofocus />
      <button type="submit">Masuk ke Dashboard</button>
    </form>
  </div>
</body>
</html>`;
}

// ─── Express App Initialization ────────────────────────────────────────────

/**
 * Start the dashboard Express server.
 * @param {number} [port] - Port number (default from config/env)
 * @param {string} [host] - Host to bind (default from config/env: 127.0.0.1)
 * @param {string} [token] - Secret auth token override (default from config/env)
 * @returns {import('http').Server|null}
 */
function startDashboard(port, host, token) {
  const dashPort = port || config.dashboard.port || 3000;
  const dashHost = host || config.dashboard.host || '127.0.0.1';
  const dashToken = token !== undefined ? token : (config.dashboard.token || '');

  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(dashHost);

  // Security Refusal: Do NOT expose unprotected dashboard to public/LAN interfaces
  if (!isLoopback && !dashToken) {
    log.error(
      `SECURITY REFUSAL: DASHBOARD_HOST is configured to "${dashHost}" without DASHBOARD_TOKEN. Refusing to start dashboard server to prevent remote WhatsApp session compromise.`
    );
    return null;
  }

  if (isLoopback && !dashToken) {
    log.warn(
      'DASHBOARD NOTICE: Running on loopback (127.0.0.1) without authentication. Set DASHBOARD_TOKEN in .env to protect access.'
    );
  }

  const app = express();
  app.use(express.urlencoded({ extended: false }));

  // Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Authentication Middleware
  const requireAuth = (req, res, next) => {
    if (!dashToken) return next();

    // Check Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (safeEqual(token, dashToken)) return next();
    }

    // Check URL query token e.g. ?token=...
    if (req.query && req.query.token) {
      if (safeEqual(String(req.query.token), dashToken)) return next();
    }

    // Check session cookie
    const cookies = parseCookies(req.headers.cookie);
    const expectedHash = getSessionHash(dashToken);
    if (cookies.rima_dash && safeEqual(cookies.rima_dash, expectedHash)) {
      return next();
    }

    // Unauthorized branch
    if (req.path.startsWith('/api/') || req.path === '/api/events') {
      return res.status(401).json({ error: 'Unauthorized: valid DASHBOARD_TOKEN required' });
    }

    res.redirect('/login');
  };

  // Login page routes
  app.get('/login', (req, res) => {
    if (!dashToken) return res.redirect('/');
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.rima_dash && safeEqual(cookies.rima_dash, getSessionHash(dashToken))) {
      return res.redirect('/');
    }
    res.send(renderLoginPage());
  });

  app.post('/login', (req, res) => {
    if (!dashToken) return res.redirect('/');

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || { count: 0, resetAt: now + 60000 };

    if (now > attempts.resetAt) {
      attempts.count = 0;
      attempts.resetAt = now + 60000;
    }

    if (attempts.count >= 5) {
      return res.status(429).send(renderLoginPage('Terlalu banyak percobaan gagal. Silakan tunggu 1 menit.'));
    }

    const providedToken = (req.body && req.body.token) || '';
    if (safeEqual(providedToken, dashToken)) {
      loginAttempts.delete(ip);
      const hash = getSessionHash(dashToken);
      res.setHeader('Set-Cookie', `rima_dash=${hash}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
      return res.redirect('/');
    }

    attempts.count++;
    loginAttempts.set(ip, attempts);
    res.status(401).send(renderLoginPage('Token tidak valid. Silakan periksa DASHBOARD_TOKEN Anda.'));
  });

  app.get('/logout', (_req, res) => {
    res.setHeader('Set-Cookie', 'rima_dash=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.redirect('/login');
  });

  // Protected Main Dashboard Page
  app.get('/', requireAuth, (_req, res) => {
    res.send(renderDashboardPage(!!dashToken));
  });

  // Real-time Server-Sent Events (SSE) Stream
  app.get('/api/events', requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial snapshot immediately
    res.write(`data: ${JSON.stringify(getTelemetrySnapshot())}\n\n`);

    sseClients.add(res);

    // Heartbeat ping every 20s
    const pingTimer = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);
    if (pingTimer.unref) pingTimer.unref();

    // Regular metrics push every 2s
    const pushTimer = setInterval(() => {
      res.write(`data: ${JSON.stringify(getTelemetrySnapshot())}\n\n`);
    }, 2000);
    if (pushTimer.unref) pushTimer.unref();

    req.on('close', () => {
      clearInterval(pingTimer);
      clearInterval(pushTimer);
      sseClients.delete(res);
    });
  });

  // JSON API — status endpoint
  app.get('/api/status', requireAuth, (_req, res) => {
    res.json(getTelemetrySnapshot());
  });

  // JSON API — QR code data URL
  app.get('/api/qr', requireAuth, async (_req, res) => {
    if (!currentQR) {
      return res.json({ available: false, status: connectionStatus });
    }
    res.json({ available: true, dataUrl: currentQrDataUrl });
  });

  // PNG API — direct QR code image
  app.get('/api/qr.png', requireAuth, async (_req, res) => {
    if (!currentQR) {
      return res.status(204).send();
    }
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const buffer = await QRCode.toBuffer(currentQR, { width: 400, margin: 2, type: 'png' });
      res.type('png').send(buffer);
    } catch (err) {
      res.status(500).send('QR generation failed');
    }
  });

  server = app.listen(dashPort, dashHost, () => {
    log.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log.info(`  📊 Dashboard v2.0: http://${dashHost}:${dashPort}`);
    log.info(`  📡 Live SSE:       http://${dashHost}:${dashPort}/api/events`);
    log.info(`  🔒 Auth:           ${dashToken ? 'Enabled (Token Protected)' : 'Disabled (Localhost Loopback Only)'}`);
    log.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  });

  return server;
}

/**
 * Stop the dashboard server.
 * @returns {Promise<void>}
 */
function stopDashboard() {
  return new Promise((resolve) => {
    for (const client of sseClients) {
      try { client.end(); } catch {}
    }
    sseClients.clear();

    if (server) {
      server.close(() => {
        log.info('Dashboard server stopped');
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  startDashboard,
  stopDashboard,
  setQR,
  setAuthenticated,
  setReady,
  setDisconnected,
  getTelemetrySnapshot,
};
