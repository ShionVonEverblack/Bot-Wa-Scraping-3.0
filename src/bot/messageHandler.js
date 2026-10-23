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

/** Map of active pending interactive actions from poll button clicks: userId -> { action, timestamp, chatId } */
const pendingInteractiveActions = new Map();

const KNOWN_COMMANDS = [
  'scrape', 'crawl', 'paper', 'rag', 'graph', 'memory', 'workflow', 'skills',
  'deepscrape', 'template', 'analyze', 'ocr', 'youtube', 'help', 'menu',
  'clear', 'status', 'cancel', 'history', 'health', 'ai', 'settings',
  'lang', 'watch', 'unwatch', 'watches', 'wizard', 'next', 'send',
  'compress', 'resolve', 'admin'
];

/**
 * Compute Damerau-Levenshtein distance between two strings (handles transpositions).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function computeDamerauLevenshtein(a, b) {
  if (!a || !b) return (a || b || '').length;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d = [];
  for (let i = 0; i <= la; i++) d[i] = [i];
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[la][lb];
}

/**
 * Find closest registered command for typo / fuzzy suggestion.
 * @param {string} inputCmd
 * @param {string[]} [candidates]
 * @param {number} [threshold=0.50]
 * @returns {string|null}
 */
function findClosestCommand(inputCmd, candidates = KNOWN_COMMANDS, threshold = 0.50) {
  if (!inputCmd) return null;
  const target = inputCmd.toLowerCase().trim();
  let bestMatch = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    const dist = computeDamerauLevenshtein(target, candidate);
    const maxLen = Math.max(target.length, candidate.length);
    const similarity = maxLen > 0 ? (maxLen - dist) / maxLen : 0;
    if (similarity > highestScore && similarity >= threshold) {
      highestScore = similarity;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

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
async function routeCommand(msg, client, cleanText) {
  const { command, args, raw } = splitArgs(cleanText);
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
      ocr: 'ocr',
      baca: 'ocr',
      ekstrak: 'ocr',
      yt: 'youtube',
      youtube: 'youtube',
      rangkumyt: 'youtube',
      how: 'help',
      bantuan: 'help',
      menu: 'menu',
      hapus: 'clear',
      bersihkan: 'clear',
      crawl: 'crawl',
      firecrawl: 'crawl',
      crawl4ai: 'crawl',
      scrapling: 'crawl',
      rag: 'rag',
      ragflow: 'rag',
      graph: 'graph',
      graphify: 'graph',
      memory: 'memory',
      mem: 'memory',
      headroom: 'memory',
      workflow: 'workflow',
      dify: 'workflow',
      skill: 'skills',
      skills: 'skills',
    };

    const handlerName = handlerMap[command] || command;

    try {
      handler = require(`../commands/handlers/${handlerName}.handler`);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        try { if (typeof msg.react === 'function') await msg.react('❓'); } catch {}
        log.debug(`No handler for command: ${command}`);
        const suggestion = findClosestCommand(command);
        if (suggestion) {
          const argSuffix = args.length > 0 ? ' ' + args.join(' ') : '';
          await msg.reply(`❓ Command \`!${command}\` tidak dikenali. Maksud Anda *!${suggestion}*?\n\nKetik: \`!${suggestion}${argSuffix}\`\nAtau ketik \`!menu\` untuk tombol interaktif.`);
        } else {
          await msg.reply(`❓ Command \`!${command}\` tidak dikenali. Ketik \`!help\` untuk daftar command atau \`!menu\` untuk tombol interaktif.`);
        }
        return true;
      }
      throw err;
    }

    if (handler && typeof handler.handle === "function") {
      log.info(`Command: !${command}`, { args: args.slice(0, 5) });
      try { if (typeof msg.react === 'function') await msg.react('⏳'); } catch {}
      await handler.handle(msg, args, client);
      try { if (typeof msg.react === 'function') await msg.react('✅'); } catch {}
      return true;
    }
  } catch (err) {
    try { if (typeof msg.react === 'function') await msg.react('❌'); } catch {}
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

        // Update context & persistent memory (Claude-Mem)
        contextMemory.store(userId, {
          lastKeyword: keyword,
          lastType: type,
          lastJobId: job.jobId,
        });
        try {
          const persistentMemory = require('../services/memory/persistentMemory');
          persistentMemory.recordObservation(userId, {
            type: 'search',
            title: `Scrape ${type}: ${keyword}`,
            content: `User searched for ${type} "${keyword}" (Job ${job.jobId})`,
          });
        } catch { /* ignore */ }

        const typeEmoji = { images: '🖼️', papers: '📄', datasets: '📊', code: '💻', books: '📚', forums: '💬', general: '🔍' };
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
        const { compressMessages } = require('../services/compression/contextCompressor');
        const persistentMemory = require('../services/memory/persistentMemory');
        const skillRegistry = require('../services/skills/skillRegistry');

        await sendTyping(msg);
        await msg.reply('🤔 Sedang berpikir...');
        await sendTyping(msg);

        // Build multi-turn history from context and apply Headroom compression
        const rawHistory = (userContext?.messages || []).slice(-6)
          .map(m => ({ role: m.role, content: m.content }));
        const { messages: history } = compressMessages(rawHistory, 1200);

        let systemPromptOverride = undefined;
        if (userContext?.lastDocumentText) {
          systemPromptOverride = `Anda adalah Asisten Analitik Dokumen. Pengguna sedang bertanya mengenai dokumen / paper berjudul "${userContext.lastDocumentTitle || 'Dokumen'}" yang baru saja mereka baca.\n\n---\n[ISI DOKUMEN]\n${userContext.lastDocumentText}\n---\n\nJawablah pertanyaan pengguna SECARA DETAIL dan AKURAT HANYA berdasarkan teks dokumen di atas. Jika jawabannya tidak ada di dalam dokumen, katakan bahwa informasi tersebut tidak tercantum.`;
        } else {
          const extraBlocks = [];
          const activeSkill = skillRegistry.getActiveSkill(userId);
          if (activeSkill) {
            extraBlocks.push(`[Active Skill: ${activeSkill.name}]\n${activeSkill.content.slice(0, 1500)}`);
          }
          const memBlock = persistentMemory.buildMemoryContextPrompt(userId, text, 3);
          if (memBlock) {
            extraBlocks.push(memBlock);
          }
          if (extraBlocks.length > 0) {
            const { getSystemPrompt } = require('../services/ai/safety/aiSafety');
            systemPromptOverride = `${getSystemPrompt()}\n\n${extraBlocks.join('\n\n')}`;
          }
        }

        const response = await aiService.chat(text, { history, systemPrompt: systemPromptOverride });
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

    // 4c. Check pending interactive poll action (from clicking menu buttons)
    if (pendingInteractiveActions.has(userId) && !startsWithCommand(cleanText)) {
      const pending = pendingInteractiveActions.get(userId);
      pendingInteractiveActions.delete(userId);

      // Valid if within 5 minutes
      if (Date.now() - pending.timestamp < 5 * 60 * 1000) {
        log.info(`Executing interactive action ${pending.action} for ${userId}: "${truncate(cleanText, 40)}"`);
        let cmdToRun = '';
        if (pending.action === 'SCRAPE') cmdToRun = `!scrape ${cleanText}`;
        else if (pending.action === 'CRAWL') cmdToRun = `!crawl ${cleanText}`;
        else if (pending.action === 'PAPER') cmdToRun = `!paper ${cleanText}`;
        else if (pending.action === 'RAG') cmdToRun = `!rag ask ${cleanText}`;
        else if (pending.action === 'AI') cmdToRun = `!ai ${cleanText}`;

        if (cmdToRun) {
          const handled = await routeCommand(msg, client, cmdToRun);
          if (handled) return;
        }
      }
    }

    // 5. Command check (prefix ! or /)
    if (startsWithCommand(cleanText)) {
      const handled = await routeCommand(msg, client, cleanText);
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

/**
 * Handle poll vote update event from WhatsApp client.
 * @param {Object} vote - PollVote instance from whatsapp-web.js
 * @param {Object} client - WhatsApp client
 */
async function handleVoteUpdate(vote, client) {
  if (!vote || !Array.isArray(vote.selectedOptions) || vote.selectedOptions.length === 0) {
    return;
  }

  const voter = vote.voter;
  const selected = (vote.selectedOptions[0]?.name || '').trim();
  const parentMsg = vote.parentMessage;
  const chatId = parentMsg?.id?.remote || parentMsg?.to || parentMsg?.from || voter;

  if (!chatId || !client || typeof client.sendMessage !== 'function') {
    return;
  }

  log.info(`Poll vote received from ${voter}: "${selected}" in ${chatId}`);

  if (selected.includes('1') || selected.includes('Cari Data') || selected.includes('Scrape')) {
    pendingInteractiveActions.set(voter, { action: 'SCRAPE', timestamp: Date.now(), chatId });
    await client.sendMessage(
      chatId,
      `🔍 *Pencarian Data (Scrape)*\nSilakan ketik apa yang ingin Anda cari (contoh: "kucing anggora", "paper machine learning", "dataset covid"):`
    );
  } else if (selected.includes('2') || selected.includes('Crawl')) {
    pendingInteractiveActions.set(voter, { action: 'CRAWL', timestamp: Date.now(), chatId });
    await client.sendMessage(
      chatId,
      `🕸️ *LLM-Ready Web Crawler*\nKirimkan tautan (URL) website yang ingin Anda ubah menjadi Markdown bersih (contoh: "https://example.com"):`
    );
  } else if (selected.includes('3') || selected.includes('Download Paper')) {
    pendingInteractiveActions.set(voter, { action: 'PAPER', timestamp: Date.now(), chatId });
    await client.sendMessage(
      chatId,
      `📄 *Download Paper PDF*\nKirimkan DOI, link arXiv, atau PMID paper yang ingin Anda unduh (contoh: "10.1038/nature12345" atau "2301.07041"):`
    );
  } else if (selected.includes('4') || selected.includes('Chat Dokumen') || selected.includes('RAG')) {
    pendingInteractiveActions.set(voter, { action: 'RAG', timestamp: Date.now(), chatId });
    await client.sendMessage(
      chatId,
      `🧠 *Chat Dokumen & RAG*\nKetik pertanyaan Anda tentang dokumen yang baru saja diunduh (contoh: "apa kesimpulan penelitian ini?"):`
    );
  } else if (selected.includes('5') || selected.includes('Tanya AI')) {
    pendingInteractiveActions.set(voter, { action: 'AI', timestamp: Date.now(), chatId });
    await client.sendMessage(
      chatId,
      `🤖 *Tanya AI / Asisten*\nSilakan ketik pertanyaan apa saja yang ingin Anda tanyakan kepada AI:`
    );
  } else if (selected.includes('6') || selected.includes('Panduan') || selected.includes('Help')) {
    pendingInteractiveActions.delete(voter);
    const helpHandler = require('../commands/handlers/help.handler');
    const mockMsg = { reply: (content) => client.sendMessage(chatId, content) };
    await helpHandler.handle(mockMsg, [], client);
  }
}

module.exports = { handleMessage, setReady, handleVoteUpdate, findClosestCommand, pendingInteractiveActions };
