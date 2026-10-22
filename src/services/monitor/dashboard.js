'use strict';

/**
 * @fileoverview QR Code Web Dashboard — mini Express server untuk menampilkan
 * QR code WhatsApp, status koneksi, dan metrik bot secara real-time di browser.
 * @module services/monitor/dashboard
 */

const express = require('express');
const QRCode = require('qrcode');
const config = require('../../config');
const { createLogger } = require('./logger');
const { formatDuration } = require('../../utils/time');

const log = createLogger('monitor:dashboard');

/** @type {import('http').Server|null} */
let server = null;

/** @type {string|null} QR code data string */
let currentQR = null;

/** @type {string} Status koneksi bot saat ini */
let connectionStatus = 'initializing';

/** @type {number} Timestamp saat bot pertama kali di-boot */
const bootTime = Date.now();

/** @type {string|null} Informasi user WhatsApp yang login */
let connectedUser = null;

// ─── State Management ───────────────────────────────────────────────────────

/**
 * Update QR code data dan set status ke 'waiting_scan'.
 * @param {string} qrData - QR code data dari whatsapp-web.js
 */
function setQR(qrData) {
  currentQR = qrData;
  connectionStatus = 'waiting_scan';
  log.info('Dashboard: QR code updated');
}

/**
 * Set status koneksi ke 'authenticated'.
 */
function setAuthenticated() {
  currentQR = null;
  connectionStatus = 'authenticated';
  log.info('Dashboard: Authenticated');
}

/**
 * Set status koneksi ke 'ready' (bot siap menerima pesan).
 * @param {string} [user] - Nama/nomor user yang terkoneksi
 */
function setReady(user) {
  currentQR = null;
  connectionStatus = 'ready';
  connectedUser = user || null;
  log.info('Dashboard: Bot ready');
}

/**
 * Set status koneksi ke 'disconnected'.
 * @param {string} [reason] - Alasan disconnect
 */
function setDisconnected(reason) {
  connectionStatus = 'disconnected';
  connectedUser = null;
  log.info(`Dashboard: Disconnected — ${reason || 'unknown'}`);
}

// ─── HTML Template ──────────────────────────────────────────────────────────

/**
 * Generate halaman HTML dashboard.
 * @param {string|null} qrDataUrl - QR code sebagai data URL (base64 PNG), atau null
 * @returns {string} HTML string
 */
function renderPage(qrDataUrl) {
  const uptime = formatDuration(Date.now() - bootTime);
  const mem = process.memoryUsage();
  const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const memTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);

  const statusConfig = {
    initializing: { emoji: '⏳', color: '#f0ad4e', label: 'Inisialisasi...' },
    waiting_scan: { emoji: '📱', color: '#5bc0de', label: 'Menunggu Scan QR' },
    authenticated: { emoji: '🔐', color: '#0275d8', label: 'Terautentikasi' },
    ready: { emoji: '✅', color: '#5cb85c', label: 'Online & Siap' },
    disconnected: { emoji: '❌', color: '#d9534f', label: 'Terputus' },
  };

  const st = statusConfig[connectionStatus] || statusConfig.initializing;

  const qrSection = qrDataUrl
    ? `<div class="qr-container">
        <img src="${qrDataUrl}" alt="QR Code WhatsApp" class="qr-image" />
        <p class="qr-hint">Buka WhatsApp → <strong>Linked Devices</strong> → Scan QR di atas</p>
      </div>`
    : connectionStatus === 'ready'
      ? `<div class="status-ready">
          <span class="ready-icon">🟢</span>
          <p>Bot sedang aktif dan menerima pesan</p>
          ${connectedUser ? `<p class="connected-user">📞 ${connectedUser}</p>` : ''}
        </div>`
      : `<div class="status-waiting">
          <div class="spinner"></div>
          <p>Menunggu koneksi WhatsApp...</p>
        </div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="5">
  <title>${config.botName} — Dashboard</title>
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
      --border: rgba(255, 255, 255, 0.06);
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

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .header h1 {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--info));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.3rem;
    }
    .header .subtitle {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    /* Status Badge */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.4rem;
      border-radius: 50px;
      font-weight: 600;
      font-size: 0.95rem;
      margin-bottom: 2rem;
      border: 1px solid ${st.color}33;
      background: ${st.color}15;
      color: ${st.color};
      box-shadow: 0 0 20px ${st.color}20;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${st.color};
      animation: ${connectionStatus === 'waiting_scan' || connectionStatus === 'ready' ? 'pulse 2s infinite' : 'none'};
    }

    /* Main Card */
    .main-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2.5rem;
      width: 100%;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      margin-bottom: 2rem;
    }

    /* QR Image */
    .qr-container { position: relative; }
    .qr-image {
      width: 280px;
      height: 280px;
      border-radius: 12px;
      border: 3px solid var(--accent);
      box-shadow: 0 0 30px var(--accent-glow);
      margin-bottom: 1rem;
      image-rendering: pixelated;
    }
    .qr-hint {
      color: var(--text-secondary);
      font-size: 0.85rem;
      line-height: 1.5;
    }

    /* Ready State */
    .status-ready {
      padding: 2rem 0;
    }
    .ready-icon {
      font-size: 4rem;
      display: block;
      margin-bottom: 1rem;
    }
    .status-ready p {
      color: var(--text-secondary);
      font-size: 1rem;
    }
    .connected-user {
      margin-top: 0.8rem;
      font-weight: 600;
      color: var(--success) !important;
    }

    /* Spinner */
    .status-waiting {
      padding: 2rem 0;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    /* Metrics Grid */
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      width: 100%;
      max-width: 480px;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.2rem;
      text-align: center;
      transition: all 0.2s;
    }
    .metric-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--accent)33;
      transform: translateY(-2px);
    }
    .metric-icon { font-size: 1.5rem; margin-bottom: 0.4rem; }
    .metric-value {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.2rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Footer */
    .footer {
      margin-top: 2rem;
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.75rem;
    }
    .footer .auto-refresh {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.5rem;
      opacity: 0.6;
    }

    /* Animations */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 500px) {
      body { padding: 1rem 0.5rem; }
      .main-card { padding: 1.5rem; }
      .qr-image { width: 220px; height: 220px; }
      .metrics { grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 ${config.botName}</h1>
    <p class="subtitle">Bot Scraping WhatsApp 3.0 — Dashboard</p>
  </div>

  <div class="status-badge">
    <span class="status-dot"></span>
    ${st.emoji} ${st.label}
  </div>

  <div class="main-card">
    ${qrSection}
  </div>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-icon">⏱️</div>
      <div class="metric-value">${uptime}</div>
      <div class="metric-label">Uptime</div>
    </div>
    <div class="metric-card">
      <div class="metric-icon">💾</div>
      <div class="metric-value">${memMB} MB</div>
      <div class="metric-label">Memori (Heap)</div>
    </div>
    <div class="metric-card">
      <div class="metric-icon">🖥️</div>
      <div class="metric-value">${process.version}</div>
      <div class="metric-label">Node.js</div>
    </div>
    <div class="metric-card">
      <div class="metric-icon">🌍</div>
      <div class="metric-value">${config.nodeEnv}</div>
      <div class="metric-label">Environment</div>
    </div>
  </div>

  <div class="footer">
    <p>${config.botName} v3.0 &copy; ${new Date().getFullYear()}</p>
    <p class="auto-refresh">🔄 Auto-refresh setiap 5 detik</p>
  </div>
</body>
</html>`;
}

// ─── Express Server ─────────────────────────────────────────────────────────

/**
 * Start the dashboard Express server.
 * @param {number} [port] - Port number (default: DASHBOARD_PORT atau 3000)
 * @returns {import('http').Server}
 */
function startDashboard(port) {
  const dashPort = port || parseInt(process.env.DASHBOARD_PORT, 10) || 3000;

  const app = express();

  // Main dashboard page
  app.get('/', async (_req, res) => {
    try {
      let qrDataUrl = null;
      if (currentQR) {
        qrDataUrl = await QRCode.toDataURL(currentQR, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      }
      res.send(renderPage(qrDataUrl));
    } catch (err) {
      log.error('Dashboard render error', { error: err.message });
      res.status(500).send('Internal Server Error');
    }
  });

  // JSON API — status endpoint untuk monitoring / integrasi
  app.get('/api/status', (_req, res) => {
    res.json({
      bot: config.botName,
      version: '3.0.0',
      status: connectionStatus,
      connectedUser,
      uptime: formatDuration(Date.now() - bootTime),
      uptimeMs: Date.now() - bootTime,
      memory: {
        heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB',
        heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1) + ' MB',
      },
      node: process.version,
      env: config.nodeEnv,
      hasQR: !!currentQR,
    });
  });

  // JSON API — QR code sebagai data URL (untuk integrasi custom frontend)
  app.get('/api/qr', async (_req, res) => {
    if (!currentQR) {
      return res.json({ available: false, status: connectionStatus });
    }
    try {
      const dataUrl = await QRCode.toDataURL(currentQR, { width: 400, margin: 2 });
      res.json({ available: true, dataUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // QR code sebagai gambar PNG langsung (untuk embed / Docker health check)
  app.get('/api/qr.png', async (_req, res) => {
    if (!currentQR) {
      res.status(204).send();
      return;
    }
    try {
      const buffer = await QRCode.toBuffer(currentQR, { width: 400, margin: 2, type: 'png' });
      res.type('png').send(buffer);
    } catch (err) {
      res.status(500).send('QR generation failed');
    }
  });

  server = app.listen(dashPort, () => {
    log.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log.info(`  📊 Dashboard: http://localhost:${dashPort}`);
    log.info(`  📡 API:       http://localhost:${dashPort}/api/status`);
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
};
