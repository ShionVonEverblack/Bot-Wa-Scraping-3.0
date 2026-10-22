'use strict';

/**
 * @fileoverview Memory & Context Compression command handler (Claude-Mem + Headroom).
 * Command: !memory <remember|search|list|compress|clear> [args...]
 * @module commands/handlers/memory
 */

const persistentMemory = require('../../services/memory/persistentMemory');
const { compressJsonItems, compressText } = require('../../services/compression/contextCompressor');
const jobStore = require('../../jobs/jobStore');
const { truncate } = require('../../utils/text');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:memory');

/**
 * Handle !memory command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const contact = await msg.getContact();
  const userId = contact.id._serialized;
  const sub = (args[0] || 'list').toLowerCase();
  const rest = args.slice(1).join(' ').trim();

  try {
    if (sub === 'remember' || sub === 'save' || sub === 'add') {
      if (!rest) {
        await msg.reply('❓ Gunakan: `!memory remember <catatan penting>`');
        return;
      }
      const obs = persistentMemory.recordObservation(userId, {
        type: 'fact',
        title: truncate(rest, 60),
        content: rest,
      });
      await msg.reply(`🧠 Disimpan ke Persistent Memory (\`${obs.id}\`)\n🏷️ Tags: ${obs.tags.join(', ') || '-'}`);
      return;
    }

    if (sub === 'search' || sub === 'find') {
      const hits = persistentMemory.searchIndex(userId, rest, 8);
      if (hits.length === 0) {
        await msg.reply('🧠 Tidak ditemukan memori yang cocok.');
        return;
      }
      const lines = hits.map(
        (h, i) => `${i + 1}. \`${h.id}\` [${h.type}] *${h.title}* (score: ${h.score})`
      );
      await msg.reply(`🧠 *Hasil Pencarian Memori (Progressive Disclosure Layer 1):*\n\n${lines.join('\n')}`);
      return;
    }

    if (sub === 'timeline') {
      if (!rest) {
        await msg.reply('❓ Gunakan: `!memory timeline <obsId>`');
        return;
      }
      const timeline = persistentMemory.getTimeline(userId, rest.trim(), 2);
      if (timeline.length === 0) {
        await msg.reply('🧠 Timeline kosong.');
        return;
      }
      const lines = timeline.map(
        (t, i) => `${i + 1}. \`${t.id}\` [${t.type}] *${t.title}* (${t.timestamp.slice(0, 19)})`
      );
      await msg.reply(`🕒 *Memory Timeline (Progressive Disclosure Layer 2):*\n\n${lines.join('\n')}`);
      return;
    }

    if (sub === 'get' || sub === 'detail' || sub === 'view') {
      const ids = rest.split(/[\s,]+/).filter(Boolean);
      if (ids.length === 0) {
        await msg.reply('❓ Gunakan: `!memory get <obsId>`');
        return;
      }
      const details = persistentMemory.getObservations(userId, ids);
      if (details.length === 0) {
        await msg.reply(`❌ Observasi \`${ids.join(', ')}\` tidak ditemukan.`);
        return;
      }
      const blocks = details.map(
        o => `🆔 \`${o.id}\` [${o.type}]\n📌 *${o.title}*\n📝 ${o.content}\n🏷️ Tags: ${(o.tags || []).join(', ') || '-'}`
      );
      await msg.reply(`🧠 *Detail Observasi (Progressive Disclosure Layer 3):*\n\n${blocks.join('\n\n')}`);
      return;
    }

    if (sub === 'compress' || sub === 'crush') {
      if (!rest) {
        await msg.reply('❓ Gunakan: `!memory compress <jobId|teks>`');
        return;
      }
      if (/^J[a-zA-Z0-9]{5}$/.test(rest)) {
        const job = await jobStore.getJob(rest);
        if (!job || !job.result?.items?.length) {
          await msg.reply(`❌ Job \`${rest}\` tidak ditemukan atau kosong.`);
          return;
        }
        const crushed = compressJsonItems(job.result.items);
        await msg.reply(
          [
            `🗜️ *Headroom Smart Crusher — Job \`${rest}\`*`,
            `📊 Tokens: *${crushed.stats.originalTokens}* → *${crushed.stats.compressedTokens}* (*Hemat ${crushed.stats.savingsPercent}%*)`,
            '',
            truncate(crushed.crushedText, 1500),
          ].join('\n')
        );
        return;
      }

      const comp = compressText(rest);
      await msg.reply(
        [
          '🗜️ *Headroom Text Compression*',
          `📊 Tokens: *${comp.stats.originalTokens}* → *${comp.stats.compressedTokens}* (*Hemat ${comp.stats.savingsPercent}%*)`,
          '',
          comp.compressedText,
        ].join('\n')
      );
      return;
    }

    if (sub === 'clear') {
      persistentMemory.clearMemory(userId);
      await msg.reply('🧹 Persistent memory Anda telah dibersihkan.');
      return;
    }

    // Default: list recent memory index
    const recent = persistentMemory.searchIndex(userId, '', 8);
    if (recent.length === 0) {
      await msg.reply(
        [
          '🧠 *Claude-Mem & Headroom Memory*',
          'Belum ada observasi tersimpan.',
          '',
          '*Commands:*',
          '• `!memory remember <fakta>` — Simpan memori lintas-sesi',
          '• `!memory search <kata>` — Cari di memori',
          '• `!memory compress <jobId|teks>` — Kompres token konteks (Headroom)',
          '• `!memory clear` — Hapus memori',
        ].join('\n')
      );
      return;
    }

    const lines = recent.map((h, i) => `${i + 1}. [${h.type}] *${h.title}* (\`${h.id}\`)`);
    await msg.reply(`🧠 *Memori Terbaru Anda:*\n\n${lines.join('\n')}`);
  } catch (err) {
    log.error('Memory command failed', { error: err.message });
    await msg.reply(`❌ Memory error: ${err.message}`);
  }
}

module.exports = { handle, command: 'memory', description: 'Persistent memory (Claude-Mem) and context compression (Headroom)' };
