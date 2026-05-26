'use strict';

/**
 * @fileoverview Central message handler — routes all incoming WhatsApp messages.
 * Integrates access control, cooldown, command routing, NLP intent classification,
 * and context memory for natural language interactions.
 * @module bot/messageHandler
 */

const config = require('../config');
const { createLogger } = require('../services/monitor/logger');
const { startsWithCommand, splitArgs, isWizardTrigger, stripMentions, truncate } = require('../utils/text');
const { classifyIntent, INTENTS } = require('./nlp/intentClassifier');
const { extractEntities, extractIdentifier } = require('./nlp/entityExtractor');
const contextMemory = require('./nlp/contextMemory');
const { sanitizeInput, checkRateLimit } = require('../services/security');
const { friendlyError } = require('../utils/errorMessages');

const log = createLogger('bot:handler');

/**
 * Send typing indicator to the current chat.
 * Shows "typing..." status to the user while the bot processes.
 * @param {Object} chatOrMsg - Chat object or message (will get chat)
 */
async function sendTyping(chatOrMsg) {
  try {
    const chat = chatOrMsg.sendStateTyping
      ? chatOrMsg
      : (typeof chatOrMsg.getChat === 'function' ? await chatOrMsg.getChat() : null);
    if (chat && chat.sendStateTyping) await chat.sendStateTyping();
  } catch { /* ignore */ }
}

/** Cooldown tracker: userId → last message timestamp. */
const cooldowns = new Map();

/** Ready gate — buffer messages until bot is ready. */
let isReady = false;
const messageBuffer = [];

/**
 * Set the ready state — when true, process buffered messages.
 * @param {boolean} ready
 * @param {Object} client - WhatsApp client
 */
function setReady(ready, client) {
  isReady = ready;
  if (ready && messageBuffer.length > 0) {
    log.info(`Processing ${messageBuffer.length} buffered messages`);
    const buffered = messageBuffer.splice(0);
    for (const { msg } of buffered) {
      handleMessage(msg, client).catch(err => {
        log.error('Buffered message error', { error: err.message });
      });
    }
  }
}

/**
 * Check if the bot is mentioned in a group message.
 * @param {Object} msg - WhatsApp message
 * @returns {Promise<boolean>}
 */
async function isBotMentioned(msg) {
  try {
    const mentions = await msg.getMentions();
    const chat = await msg.getChat();
    if (!chat.isGroup) return true; // DM always passes

    // Check if message mentions bot or starts with bot name
    const body = (msg.body || '').toLowerCase();
    const botName = config.botName.toLowerCase();

    if (body.includes(botName)) return true;
    if (mentions.some(m => m.isMe)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Check cooldown for a user.
 * @param {string} userId
 * @returns {{ allowed: boolean, remainingMs: number }}
 */
function checkCooldown(userId) {
  const now = Date.now();
  const lastTime = cooldowns.get(userId) || 0;
  const elapsed = now - lastTime;
  const cooldownMs = config.limits.userCooldownMs;

  if (elapsed < cooldownMs) {
    return { allowed: false, remainingMs: cooldownMs - elapsed };
  }

  cooldowns.set(userId, now);
  return { allowed: true, remainingMs: 0 };
}

/**
 * Route a command to its handler.
 * @param {Object} msg - WhatsApp message
 * @param {Object} client - WhatsApp client
 * @returns {Promise<boolean>} true if command was handled
 */
async function routeCommand(msg, client) {
  const { command, args, raw } = splitArgs(msg.body);
  if (!command) return false;

  // Try to load command handler
  try {
    let handler;

    // Map command names/aliases to handler files
    const handlerMap = {
      deepscrape: 'deepscrape',
      template: 'template',
      analisa: 'analyze',
      analyse: 'analyze',
      how: 'help',
      bantuan: 'help',
      hapus: 'clear',
      bersihkan: 'clear',
    };

    const handlerName = handlerMap[command] || command;

    try {
      handler = require(`../commands/handlers/${handlerName}.handler`);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        log.debug(`No handler for command: ${command}`);
        await msg.reply(`❓ Command \`!${command}\` tidak dikenali. Ketik \`!help\` untuk daftar command.`);
        return true;
      }
      throw err;
    }

    if (handler && typeof handler.handle === 'function') {
      log.info(`Command: !${command}`, { args: args.slice(0, 5) });
      await handler.handle(msg, args, client);
      return true;
    }
  } catch (err) {
    log.error(`Command handler error: !${command}`, { error: err.message });
    await msg.reply(`❌ Error menjalankan command: ${friendlyError(err)}`);
    return true;
  }

  return false;
}

/**
 * Handle NLP-based intent routing.
 * @param {Object} msg - WhatsApp message
 * @param {Object} client - WhatsApp client
 * @param {string} userId - User ID
 * @param {string} text - Cleaned message text
 */
async function handleNlpIntent(msg, client, userId, text) {
  // Show typing while classifying intent
  await sendTyping(msg);

  // Get user context
  const userContext = contextMemory.get(userId);

  // Classify intent
  const { intent, confidence, entities } = await classifyIntent(text, userContext);
  log.info(`NLP intent: ${intent} (${(confidence * 100).toFixed(0)}%)`, { entities });

  // Store interaction in context
  contextMemory.store(userId, {
    lastIntent: intent,
    message: { role: 'user', content: text },
  });

  switch (intent) {
    case INTENTS.SCRAPE: {
      const extracted = extractEntities(text, intent);

      // Merge with context if follow-up
      const keyword = extracted.keyword || userContext?.lastKeyword || '';
      const type = extracted.type || userContext?.lastType || 'general';
      const limit = extracted.limit || config.limits.resultLimitDefault;

      if (!keyword) {
        await msg.reply('🤔 Mau cari apa? Berikan keyword pencarian.\nContoh: "cari gambar kucing lucu"');
        return;
      }

      // Auto-create job
      try {
        const jobManager = require('../jobs/jobManager');
        const chat = await msg.getChat();

        const job = await jobManager.createJob({
          request: {
            type: 'SCRAPE',
            keyword,
            scrapeType: type,
            limit,
            format: extracted.format || config.output.formatDefault,
            useAI: extracted.useAI || false,
            multi: extracted.multi || false,
            chatId: chat.id._serialized,
            userId,
          },
          client,
        });

        // Update context
        contextMemory.store(userId, {
          lastKeyword: keyword,
          lastType: type,
          lastJobId: job.jobId,
        });

        const typeEmoji = { images: '🖼️', papers: '📄', datasets: '📊', general: '🔍' };
        await msg.reply(`${typeEmoji[type] || '🔍'} Mencari ${type} "${keyword}"... (Job: ${job.jobId})`);
      } catch (err) {
        log.error('Auto-scrape failed', { error: err.message });
        await msg.reply(`❌ Gagal membuat job: ${friendlyError(err)}`);
      }
      break;
    }

    case INTENTS.PAPER_DOWNLOAD: {
      const identifier = extractIdentifier(text);
      if (!identifier) {
        await msg.reply('📄 Kirim DOI, arXiv ID, atau URL paper yang mau di-download.');
        return;
      }

      try {
        const jobManager = require('../jobs/jobManager');
        const chat = await msg.getChat();

        const job = await jobManager.createJob({
          request: {
            type: 'DOWNLOAD_PAPER',
            identifier,
            chatId: chat.id._serialized,
            userId,
          },
          client,
        });

        await msg.reply(`📄 Downloading paper... (Job: ${job.jobId})`);
      } catch (err) {
        await msg.reply(`❌ Download paper gagal: ${friendlyError(err)}`);
      }
      break;
    }

    case INTENTS.AI_CHAT: {
      try {
        const aiService = require('../services/ai/aiService');
        await sendTyping(msg);
        await msg.reply('🤔 Sedang berpikir...');
        await sendTyping(msg);

        // Build multi-turn history from context (max 6 messages)
        const history = (userContext?.messages || []).slice(-6)
          .map(m => ({ role: m.role, content: m.content }));

        const response = await aiService.chat(text, { history });
        await msg.reply(response);

        contextMemory.store(userId, {
          message: { role: 'assistant', content: truncate(response, 500) },
        });
      } catch (err) {
        log.error('AI chat failed', { error: err.message });
        await msg.reply('❌ Maaf, AI sedang tidak tersedia. Coba lagi nanti.');
      }
      break;
    }

    case INTENTS.IMAGE_ANALYZE: {
      const quotedMsg = await msg.getQuotedMessage?.();
      const hasMedia = msg.hasMedia || quotedMsg?.hasMedia;

      if (!hasMedia) {
        await msg.reply('🖼️ Reply ke gambar yang ingin dianalisa, lalu ketik "analisa gambar ini".');
        return;
      }

      try {
        const mediaMsg = msg.hasMedia ? msg : quotedMsg;
        await sendTyping(msg);
        const media = await mediaMsg.downloadMedia();

        if (!media) {
          await msg.reply('❌ Gagal download gambar.');
          return;
        }

        await msg.reply('🔍 Menganalisa gambar...');
        await sendTyping(msg);

        const aiService = require('../services/ai/aiService');
        const analysis = await aiService.analyzeImage({
          imageBase64: media.data,
          mimeType: media.mimetype,
          prompt: text || 'Analisa gambar ini secara detail.',
        });

        await msg.reply(`🖼️ *Analisis Gambar:*\n\n${analysis}`);
      } catch (err) {
        log.error('Image analysis failed', { error: err.message });
        await msg.reply('❌ Gagal menganalisa gambar. Pastikan gambar valid.');
      }
      break;
    }

    case INTENTS.GREETING: {
      const greetings = [
        `Halo! 👋 Saya *${config.botName}*, asisten pencari data.\n\nMau cari apa hari ini? Ketik \`!menu\` untuk fitur lengkap, atau langsung bilang:\n• "cari gambar kucing"\n• "cari paper machine learning"\n• "apa itu neural network?"`,
      ];
      await msg.reply(greetings[0]);
      break;
    }

    case INTENTS.UNKNOWN:
    default: {
      // Fallback to AI chat in DM or when mentioned in group
      try {
        const aiService = require('../services/ai/aiService');
        await sendTyping(msg);

        // Include conversation history for multi-turn context
        const history = (userContext?.messages || []).slice(-6)
          .map(m => ({ role: m.role, content: m.content }));

        const response = await aiService.chat(text, { history });
        await msg.reply(response);

        contextMemory.store(userId, {
          message: { role: 'assistant', content: truncate(response, 500) },
        });
      } catch {
        await msg.reply(`Maaf, saya tidak mengerti. 🤔\nKetik \`!help\` untuk bantuan atau \`!menu\` untuk fitur lengkap.`);
      }
      break;
    }
  }
}

/**
 * Main message handler — processes all incoming WhatsApp messages.
 * @param {Object} msg - WhatsApp message object
 * @param {Object} client - WhatsApp client instance
 */
async function handleMessage(msg, client) {
  try {
    // 0. Ignore status/broadcast messages
    if (msg.isStatus || msg.from === 'status@broadcast') return;

    const body = (msg.body || '').trim();
    if (!body && !msg.hasMedia) return;

    // 1. Ready gate
    if (!isReady) {
      messageBuffer.push({ msg });
      return;
    }

    const contact = await msg.getContact();
    const userId = contact.id._serialized;
    const chat = await msg.getChat();
    const isGroup = chat.isGroup;

    log.info(`📩 ${isGroup ? `[${chat.name}]` : '[DM]'} ${contact.pushname || userId}: ${truncate(body, 80)}`);

    // 2. Access control
    const { allowList, denyList } = config.group;
    if (denyList.length > 0 && denyList.some(p => userId.includes(p))) {
      log.debug(`Denied: ${userId}`);
      return;
    }
    if (allowList.length > 0 && !allowList.some(p => userId.includes(p))) {
      log.debug(`Not in allowlist: ${userId}`);
      return;
    }

    // 3. Mention guard (group only)
    if (isGroup && config.group.requireMention) {
      const mentioned = await isBotMentioned(msg);
      const isCommand = startsWithCommand(body);
      if (!mentioned && !isCommand) return;
    }

    // Clean text (remove mentions + sanitize)
    let cleanText = sanitizeInput(stripMentions(body));

    // 3b. Voice Note Audio Transcription
    if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
      try {
        await sendTyping(msg);
        const media = await msg.downloadMedia();
        if (media && media.data) {
          const aiService = require('../services/ai/aiService');
          const transcribed = await aiService.transcribeAudio({
            audioBase64: media.data,
            mimeType: media.mimetype
          });
          if (transcribed) {
            cleanText = sanitizeInput(stripMentions(transcribed));
            log.info(`Transcribed audio to text: ${cleanText}`);
            await msg.reply(`🎤 _Terdengar:_ "${cleanText}"`);
          }
        }
      } catch (err) {
        log.error('Audio transcription failed in handler', { error: err.message });
        await msg.reply('❌ Maaf, sistem gagal menerjemahkan pesan suara Anda. Pastikan API key Groq atau OpenAI terkonfigurasi.');
        return;
      }
    }

    if (!cleanText) return; // If still empty after all processing

    // 4a. Rate limit check (30 msg/min window)
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      log.warn(`Rate limited: ${userId}`);
      await msg.reply('⚠️ Kamu mengirim pesan terlalu cepat. Tunggu sebentar ya...');
      return;
    }

    // 4b. Cooldown check (skip for commands that are status checks)
    if (!startsWithCommand(cleanText)) {
      const cooldown = checkCooldown(userId);
      if (!cooldown.allowed) {
        const secs = Math.ceil(cooldown.remainingMs / 1000);
        await msg.reply(`⏳ Tunggu ${secs} detik lagi ya...`);
        return;
      }
    }

    // 5. Command check (prefix ! or /)
    if (startsWithCommand(cleanText)) {
      const handled = await routeCommand(msg, client);
      if (handled) return;
    }

    // 6. Wizard check — active wizard session intercepts input
    try {
      const { shouldHandleWizard, handleWizardInput } = require('./wizard/wizardHandler');
      if (shouldHandleWizard(userId)) {
        const handled = await handleWizardInput(msg, client, userId, cleanText);
        if (handled) return;
      }
    } catch { /* wizard not loaded yet */ }

    // 8. NLP Intent Classification
    await handleNlpIntent(msg, client, userId, cleanText);

    // 9. Log processed
    log.debug('Message processed', { userId, intent: 'handled' });
  } catch (err) {
    log.error('Message handler error', { error: err.message, stack: err.stack });
    try {
      await msg.reply('❌ Maaf, terjadi error internal. Coba lagi ya.');
    } catch { /* ignore send error */ }
  }
}

module.exports = { handleMessage, setReady };
