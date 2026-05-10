'use strict';

/**
 * @fileoverview User-friendly error message mapper.
 * Converts technical error codes/messages into human-readable Indonesian messages.
 * @module utils/errorMessages
 */

/** Map of error codes/keywords → user-friendly messages. */
const ERROR_MAP = {
  // Network errors
  ECONNRESET:     '🌐 Koneksi ke server terputus. Coba lagi nanti.',
  ECONNREFUSED:   '🌐 Server tidak merespon. Coba lagi nanti.',
  ECONNABORTED:   '🌐 Koneksi dibatalkan. Coba lagi nanti.',
  ENOTFOUND:      '🌐 Server tidak ditemukan. Periksa koneksi internet.',
  ETIMEDOUT:      '⏱️ Request timeout. Server terlalu lama merespon.',
  TIMEOUT:        '⏱️ Proses terlalu lama. Coba dengan limit yang lebih kecil.',
  EPIPE:          '🌐 Koneksi terputus saat mengirim data.',

  // HTTP status errors
  '400':          '⚠️ Request tidak valid. Periksa parameter pencarian.',
  '401':          '🔑 Autentikasi gagal. API key mungkin expired.',
  '403':          '🚫 Akses ditolak oleh server.',
  '404':          '🔍 Data tidak ditemukan.',
  '429':          '🚦 Terlalu banyak request. Tunggu beberapa menit.',
  '500':          '💥 Server mengalami error internal. Coba lagi nanti.',
  '502':          '💥 Server sedang bermasalah. Coba lagi nanti.',
  '503':          '💥 Server sedang maintenance. Coba lagi nanti.',

  // Application errors
  JOB_CANCELLED:  '🛑 Job dibatalkan.',
  ACCESS_DENIED:  '🔒 Kamu tidak memiliki akses.',
  KEY_MISSING:    '🔑 API key belum dikonfigurasi untuk layanan ini.',
  MODULE_NOT_FOUND: '⚙️ Modul belum tersedia. Hubungi admin.',
  BROWSER_NOT_FOUND: '🌐 Browser tidak ditemukan. Pastikan Brave/Chrome terinstal.',
};

/**
 * Convert a technical error into a user-friendly message.
 * @param {Error|string} err - Error object or message string
 * @returns {string} User-friendly error message
 */
function friendlyError(err) {
  if (!err) return '❌ Terjadi error yang tidak diketahui.';

  const message = typeof err === 'string' ? err : (err.message || '');
  const code = typeof err === 'object' ? (err.code || err.statusCode || '') : '';

  // 1. Check error code directly
  if (code && ERROR_MAP[code]) {
    return ERROR_MAP[code];
  }

  // 2. Check HTTP status in message (e.g., "Request failed with status code 429")
  const statusMatch = message.match(/status\s*(?:code\s*)?(\d{3})/i);
  if (statusMatch && ERROR_MAP[statusMatch[1]]) {
    return ERROR_MAP[statusMatch[1]];
  }

  // 3. Check if message contains any known error keywords
  const upperMsg = message.toUpperCase();
  for (const [key, friendly] of Object.entries(ERROR_MAP)) {
    if (upperMsg.includes(key.toUpperCase())) {
      return friendly;
    }
  }

  // 4. Generic fallback — keep it short and non-technical
  if (message.length > 100) {
    return '❌ Terjadi error. Coba lagi nanti atau hubungi admin.';
  }

  return `❌ ${message}`;
}

module.exports = { friendlyError, ERROR_MAP };
