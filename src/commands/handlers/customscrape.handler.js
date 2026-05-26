'use strict';

/**
 * @fileoverview Custom Scrape handler (!customscrape).
 * @module commands/handlers/customscrape.handler
 */

const { evaluateSelector } = require('../../engine/deepScraper');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:customscrape');

/**
 * Handle !customscrape command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  const text = msg.body;
  
  // Extract URL
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    await msg.reply('❌ URL tidak ditemukan. Format: `!customscrape https://example.com --selector "h1"`');
    return;
  }
  const url = urlMatch[0];

  // Extract Selector
  const selectorMatch = text.match(/--selector\s+(.+)$/i);
  if (!selectorMatch) {
    await msg.reply('❌ Selector tidak ditemukan. Tambahkan parameter `--selector <css_selector>`.');
    return;
  }
  
  // Remove quotes around selector if any
  const selector = selectorMatch[1].replace(/^["']|["']$/g, '').trim();

  try {
    const chat = await msg.getChat();
    if (chat.sendStateTyping) await chat.sendStateTyping();
    
    await msg.reply(`🔍 Sedang menyusuri halaman dan mencari selector \`${selector}\`...`);
    
    // Execute Deep Scraper with custom selector
    const results = await evaluateSelector(url, selector);
    
    if (!results || results.length === 0) {
      await msg.reply('⚠️ Tidak ada elemen teks yang cocok dengan selector tersebut di halaman tujuan.');
      return;
    }

    // Format output and slice if too long
    const preview = results.map((r, i) => `${i + 1}. ${r}`).join('\n\n').slice(0, 1500);
    const cutMsg = results.join('\n\n').length > 1500 ? '\n\n... (teks terpotong karena terlalu panjang)' : '';

    await msg.reply(`✅ *Hasil Custom Scrape:*\n\n${preview}${cutMsg}`);
  } catch (err) {
    log.error('Custom scrape error', { error: err.message });
    await msg.reply(`❌ Gagal mengekstrak elemen: ${err.message}`);
  }
}

module.exports = { handle };
