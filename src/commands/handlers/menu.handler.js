'use strict';

/**
 * @fileoverview Menu handler (!menu) - Displays interactive UI list.
 * @module commands/handlers/menu.handler
 */

const { List } = require('whatsapp-web.js');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:menu');

/**
 * Handle !menu command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  try {
    const sections = [{
      title: 'Kategori Fitur Utama',
      rows: [
        { title: 'Cari Jurnal & PDF', id: 'menu_jurnal', description: 'Kirim kalimat seperti "Cari jurnal AI"' },
        { title: 'Cari Aset Gambar', id: 'menu_gambar', description: 'Kirim kalimat seperti "Cari gambar tata surya"' },
        { title: 'Cari Dataset (CSV)', id: 'menu_dataset', description: 'Kirim kalimat seperti "Cari dataset covid 19"' },
        { title: 'Fitur Admin (Dev)', id: 'menu_admin', description: 'Gunakan perintah !admin' }
      ]
    }];

    const list = new List(
      '🌟 *Selamat datang di Rima Bot v3.0 Ultimate!*\n\nSaya adalah asisten AI super untuk keperluan pencarian data, pengumpulan referensi, dan chat dokumen (RAG).\n\n👇 Klik tombol di bawah untuk melihat fitur-fitur yang tersedia.\n_(Jika tombol tidak muncul, Anda bisa langsung mengetikkan perintah Anda di obrolan)._',
      'Pilih Fitur 🔘',
      sections,
      '🤖 RIMA DASHBOARD',
      '© Rima AI Scraping Bot'
    );

    await msg.reply(list);
    log.debug('Interactive List Menu sent successfully.');
  } catch (err) {
    log.error('Failed to send interactive menu list, sending fallback', { error: err.message });
    // Fallback text if List is blocked by WA Multi-Device
    const fallbackText = 
      '🌟 *Rima Bot v3.0 Ultimate*\n\n' +
      'Perangkat Anda tampaknya tidak mendukung Tombol Interaktif. Berikut adalah panduan cepat:\n\n' +
      '1️⃣ *Cari Jurnal*: `cari jurnal tentang [topik]`\n' +
      '2️⃣ *Cari Gambar*: `cari gambar [kata kunci]`\n' +
      '3️⃣ *Cari Dataset*: `cari dataset [topik]`\n' +
      '4️⃣ *Chat PDF / RAG*: `!download-paper [DOI/URL]`, lalu tanya AI\n' +
      '5️⃣ *Admin Area*: `!admin stats` atau `!admin flush`';
      
    await msg.reply(fallbackText);
  }
}

module.exports = { handle };
