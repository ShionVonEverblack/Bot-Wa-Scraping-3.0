'use strict';

/**
 * @fileoverview Admin command handler — privileged commands for system management.
 * @module commands/handlers/admin
 */

const config = require('../../config');
const { createLogger } = require('../../services/monitor/logger');
const jobStore = require('../../jobs/jobStore');
const jobManager = require('../../jobs/jobManager');
const cache = require('../../services/cache');

const log = createLogger('cmd:admin');

/**
 * Handle !admin command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  const contact = await msg.getContact();
  const userId = contact.id._serialized;
  
  // 1. Authorization Check
  if (!config.group.adminPhones || !config.group.adminPhones.some(phone => userId.includes(phone))) {
    log.warn(`Unauthorized admin attempt by ${userId}`);
    await msg.reply('⛔ Akses ditolak. Command ini khusus untuk Administrator (terdaftar di .env).');
    return;
  }

  const action = (args[0] || '').toLowerCase();

  switch (action) {
    case 'stats': {
      try {
        const mem = process.memoryUsage();
        const memMb = Math.round(mem.rss / 1024 / 1024);
        
        // Format uptime
        const uptimeTotal = process.uptime();
        const hrs = Math.floor(uptimeTotal / 3600);
        const mins = Math.floor((uptimeTotal % 3600) / 60);
        const secs = Math.floor(uptimeTotal % 60);
        const uptimeStr = `${hrs}h ${mins}m ${secs}s`;

        const cacheStats = cache.stats();
        const jobStats = await jobStore.getStats();
        
        const lines = [
          '🛡️ *Admin Dashboard*',
          `⏱️ *Uptime:* ${uptimeStr}`,
          `🧠 *Memory (RSS):* ${memMb} MB`,
          `🗃️ *Cache:* ${cacheStats.size} / ${cacheStats.maxSize} items`,
          `📋 *Total Jobs:* ${jobStats.total}`
        ];
        
        if (jobStats.byStatus && Object.keys(jobStats.byStatus).length > 0) {
          lines.push('\n*Job Status:*');
          for (const [status, count] of Object.entries(jobStats.byStatus)) {
            lines.push(`- ${status}: ${count}`);
          }
        }
        
        await msg.reply(lines.join('\n'));
      } catch (err) {
        log.error('Admin stats error', { error: err.message });
        await msg.reply('❌ Gagal memuat statistik.');
      }
      break;
    }
    
    case 'flush': {
      try {
        cache.clear();
        await msg.reply('🧹 Cache berhasil dibersihkan.');
      } catch (err) {
        await msg.reply('❌ Gagal membersihkan cache.');
      }
      break;
    }
    
    case 'cancel-all': {
      try {
        await msg.reply('🛑 Membatalkan job aktif...');
        const activeJobs = await jobStore.listJobs({ limit: 100 });
        let cancelled = 0;
        
        for (const job of activeJobs) {
          if (['PENDING', 'RUNNING'].includes(job.status)) {
            await jobManager.cancelJob(job.jobId);
            cancelled++;
          }
        }
        await msg.reply(`✅ Selesai! Membatalkan ${cancelled} job berjalan.`);
      } catch (err) {
        log.error('Admin cancel-all error', { error: err.message });
        await msg.reply('❌ Terjadi kesalahan saat membatalkan job.');
      }
      break;
    }

    default:
      await msg.reply(
        '🔧 *Admin Commands:*\n' +
        '• `!admin stats` - Lihat statistik sistem & RAM\n' +
        '• `!admin flush` - Bersihkan _memory cache_\n' +
        '• `!admin cancel-all` - Hentikan semua tugas berjalan'
      );
      break;
  }
}

module.exports = { handle };
