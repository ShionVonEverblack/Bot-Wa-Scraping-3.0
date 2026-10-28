'use strict';

/**
 * @fileoverview Pause, Resume, and Chat Mode handler — prevents the bot from
 * chiming in ("nimbrung") during human-to-human conversations.
 * Supports:
 * - !pause [duration] (e.g., !pause, !pause 30m, !pause 2h) -> Full silence until !resume or timeout
 * - !pause nlp / !mode command -> Command-only mode (only responds to '!' commands)
 * - !resume / !mode auto -> Restores normal operation
 * @module commands/handlers/pause
 */

const { parseTime, formatDuration } = require('../../utils/time');
const { splitArgs, stripMentions } = require('../../utils/text');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:pause');

/**
 * Per-chat state map: chatId -> { mode: 'auto'|'command'|'paused', pausedUntil: number|null, updatedAt: number }
 * @type {Map<string, { mode: string, pausedUntil: number|null, updatedAt: number }>}
 */
const chatStates = new Map();

/**
 * Resolve chatId from a WhatsApp message object.
 * @param {Object} msg
 * @returns {Promise<string>}
 */
async function resolveChatId(msg) {
  try {
    if (typeof msg.getChat === 'function') {
      const chat = await msg.getChat();
      if (chat?.id?._serialized) return chat.id._serialized;
    }
  } catch { /* ignore */ }
  return msg.from || msg.to || 'default_chat';
}

/**
 * Get the active interaction state for a chat, auto-expiring timed pauses.
 * @param {string} chatId
 * @returns {{ mode: 'auto'|'command'|'paused', pausedUntil: number|null, remainingMs: number|null }}
 */
function getChatState(chatId) {
  if (!chatId || !chatStates.has(chatId)) {
    return { mode: 'auto', pausedUntil: null, remainingMs: null };
  }

  const state = chatStates.get(chatId);
  if (state.mode === 'paused' && state.pausedUntil && state.pausedUntil !== Infinity) {
    const remaining = state.pausedUntil - Date.now();
    if (remaining <= 0) {
      chatStates.delete(chatId);
      log.info(`Timed pause expired for chat ${chatId}, returning to auto mode`);
      return { mode: 'auto', pausedUntil: null, remainingMs: null };
    }
    return { mode: 'paused', pausedUntil: state.pausedUntil, remainingMs: remaining };
  }

  return {
    mode: state.mode,
    pausedUntil: state.pausedUntil,
    remainingMs: state.pausedUntil === Infinity ? Infinity : null,
  };
}

/**
 * Check whether the bot is currently paused (full silence) in a chat.
 * @param {string} chatId
 * @returns {boolean}
 */
function isChatPaused(chatId) {
  return getChatState(chatId).mode === 'paused';
}

/**
 * Check whether the chat is in command-only mode (ignores casual chat/links/NLP).
 * @param {string} chatId
 * @returns {boolean}
 */
function isCommandOnlyMode(chatId) {
  return getChatState(chatId).mode === 'command';
}

/**
 * Pause the bot in a specific chat.
 * @param {string} chatId
 * @param {number|null} [durationMs=null] - Duration in ms, or null/Infinity for indefinite
 */
function setChatPause(chatId, durationMs = null) {
  if (!chatId) return;
  const pausedUntil = durationMs && durationMs > 0 ? Date.now() + durationMs : Infinity;
  chatStates.set(chatId, {
    mode: 'paused',
    pausedUntil,
    updatedAt: Date.now(),
  });
  log.info(`Chat ${chatId} paused`, { durationMs: durationMs || 'indefinite' });
}

/**
 * Set interaction mode for a chat ('auto' | 'command' | 'paused').
 * @param {string} chatId
 * @param {'auto'|'command'|'paused'} mode
 */
function setChatMode(chatId, mode) {
  if (!chatId) return;
  if (mode === 'auto') {
    chatStates.delete(chatId);
    log.info(`Chat ${chatId} set to auto mode`);
    return;
  }
  chatStates.set(chatId, {
    mode,
    pausedUntil: mode === 'paused' ? Infinity : null,
    updatedAt: Date.now(),
  });
  log.info(`Chat ${chatId} mode set to ${mode}`);
}

/**
 * Resume normal ('auto') operation in a chat.
 * @param {string} chatId
 */
function resumeChat(chatId) {
  if (!chatId) return;
  chatStates.delete(chatId);
  log.info(`Chat ${chatId} resumed to auto mode`);
}

/**
 * Clear all chat states (used for testing).
 */
function clearAllChatStates() {
  chatStates.clear();
}

/**
 * Handle !pause, !resume, and !mode commands.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args = []) {
  const chatId = await resolveChatId(msg);
  const rawBody = stripMentions((msg.body || '').trim());
  const { command } = splitArgs(rawBody);
  const invokedCmd = (command || 'pause').toLowerCase();
  const firstArg = (args[0] || '').toLowerCase().trim();

  // 1. Handle !resume / !unpause / !unmute / !lanjut
  if (['resume', 'unpause', 'unmute', 'lanjut'].includes(invokedCmd)) {
    resumeChat(chatId);
    await msg.reply(
      [
        '🟢 *Bot Aktif Kembali (Mode Auto)*',
        'Saya siap membantu kembali di ruang obrolan ini.',
        '',
        '💡 _Ketik `!mode command` jika hanya ingin bot merespons pesan berawalan `!`, atau `!pause` untuk mengheningkan lagi._',
      ].join('\n')
    );
    return;
  }

  // 2. Handle !mode [auto|command|pause]
  if (['mode', 'botmode'].includes(invokedCmd)) {
    if (['command', 'cmd', 'manual'].includes(firstArg)) {
      setChatMode(chatId, 'command');
      await msg.reply(
        [
          '🟡 *Mode Command-Only Aktif*',
          'Bot tidak akan ikut menyahuti obrolan biasa atau tautan di chat ini, dan *hanya* merespons jika pesan diawali tanda `!` (contoh: `!scrape`, `!menu`, `!ai`).',
          '',
          'Ketik `!mode auto` atau `!resume` untuk kembali ke mode normal.',
        ].join('\n')
      );
      return;
    }

    if (['auto', 'normal', 'on'].includes(firstArg)) {
      resumeChat(chatId);
      await msg.reply(
        [
          '🟢 *Mode Auto (Normal) Aktif*',
          'Bot akan merespons perintah `!`, tautan web, dan percakapan langsung.',
        ].join('\n')
      );
      return;
    }

    if (['pause', 'paused', 'silent', 'mute', 'off'].includes(firstArg)) {
      setChatPause(chatId, null);
      await msg.reply(
        [
          '🔴 *Bot Diheningkan (Paused)*',
          'Bot tidak akan merespons pesan apa pun di ruang obrolan ini hingga Anda mengetik `!resume`.',
        ].join('\n')
      );
      return;
    }

    // Status display when !mode is called without arguments
    const state = getChatState(chatId);
    let statusLine = '🟢 *Auto (Normal)* — Merespons perintah `!`, tautan, & bahasa alami.';
    if (state.mode === 'command') {
      statusLine = '🟡 *Command-Only* — Hanya merespons perintah berawalan `!` (tidak ikut nimbrung chat biasa).';
    } else if (state.mode === 'paused') {
      const remText = state.remainingMs && state.remainingMs !== Infinity
        ? ` (sisa waktu: ${formatDuration(state.remainingMs)})`
        : ' (hingga `!resume` diketik)';
      statusLine = `🔴 *Paused (Hening)*${remText}`;
    }

    await msg.reply(
      [
        '⚙️ *Status Mode Bot di Ruang Chat Ini*',
        `Status: ${statusLine}`,
        '',
        '*Pilihan Pengaturan:*',
        '• `!mode command` — Hanya aktif jika diawali tanda `!` (Anti-Nimbrung)',
        '• `!mode auto` — Mode pintar penuh (Default)',
        '• `!pause [durasi]` — Hening total (contoh: `!pause` atau `!pause 30m`)',
        '• `!resume` — Aktifkan bot kembali',
      ].join('\n')
    );
    return;
  }

  // 3. Handle !pause / !mute / !diam / !hening
  if (['nlp', 'command', 'cmd'].includes(firstArg)) {
    setChatMode(chatId, 'command');
    await msg.reply(
      [
        '🟡 *Mode Command-Only Aktif*',
        'Bot tidak akan ikut menyahuti obrolan biasa di chat ini, dan *hanya* merespons pesan dengan awalan `!`.',
        '',
        'Ketik `!resume` untuk kembali ke mode normal.',
      ].join('\n')
    );
    return;
  }

  if (firstArg) {
    const durationMs = /^\d+$/.test(firstArg)
      ? parseInt(firstArg, 10) * 60 * 1000
      : parseTime(firstArg);

    if (durationMs && durationMs > 0) {
      setChatPause(chatId, durationMs);
      const formatted = formatDuration(durationMs);
      await msg.reply(
        [
          `🔴 *Bot Diheningkan Sementara (${formatted})*`,
          `Bot tidak akan ikut menyahut di ruang obrolan ini selama *${formatted}*.`,
          '',
          'Ketik `!resume` kapan saja untuk mengaktifkan kembali lebih awal.',
        ].join('\n')
      );
      return;
    }
  }

  setChatPause(chatId, null);
  await msg.reply(
    [
      '🔴 *Bot Diheningkan (Paused)*',
      'Bot tidak akan ikut menyahut di ruang obrolan ini hingga Anda mengetik `!resume`.',
      '',
      '💡 _Tips: Gunakan `!pause 30m` untuk hening sementara, atau `!mode command` agar bot hanya merespons perintah berawalan `!`._',
    ].join('\n')
  );
}

module.exports = {
  handle,
  command: 'pause',
  description: 'Pause or change bot responsiveness mode in current chat',
  getChatState,
  isChatPaused,
  isCommandOnlyMode,
  setChatPause,
  setChatMode,
  resumeChat,
  clearAllChatStates,
};
