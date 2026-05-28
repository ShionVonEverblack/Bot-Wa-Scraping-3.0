'use strict';

/**
 * @fileoverview YouTube Summarizer command.
 * Fetches transcript using youtube-transcript and summarizes it via AI.
 * Command: !yt, !youtube, !rangkumyt
 * @module commands/handlers/youtube.handler
 */

const { YoutubeTranscript } = require('youtube-transcript');
const { createLogger } = require('../../services/monitor/logger');
const aiService = require('../../services/ai/aiService');

const log = createLogger('cmd:youtube');
const MAX_TRANSCRIPT_LENGTH = 20000;

/**
 * Handle !yt / !youtube command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  // Try to find the URL from arguments
  const url = args.find(arg => arg.includes('youtube.com') || arg.includes('youtu.be'));
  
  if (!url) {
    await msg.reply('❌ Mohon sertakan link YouTube yang valid.\nContoh: `!yt https://youtu.be/xxx`');
    return;
  }

  try {
    await msg.reply('⏳ Menghubungi server YouTube untuk mengunduh subtitle/transkrip...');
    log.info(`Fetching transcript for: ${url}`);

    const transcriptArray = await YoutubeTranscript.fetchTranscript(url);
    
    if (!transcriptArray || transcriptArray.length === 0) {
      throw new Error('Transcript is empty');
    }

    // Combine all transcript chunks into a single string
    let fullText = transcriptArray.map(t => t.text).join(' ');

    // Security check to avoid overloading the AI context window
    if (fullText.length > MAX_TRANSCRIPT_LENGTH) {
      fullText = fullText.substring(0, MAX_TRANSCRIPT_LENGTH) + '\n\n... [SISA TEKS DIPOTONG Kkarena keterbatasan memori]';
      log.info('Transcript truncated due to length limits');
    }

    await msg.reply(`✅ Transkrip ditarik (${fullText.length} karakter). Memproses analisis AI...`);

    // AI Prompt Engineering for Video Summarization
    const prompt = [
      'Kamu adalah asisten ahli yang bertugas merangkum isi video YouTube.',
      'Berikut adalah transkrip otomatis (CC) dari video tersebut.',
      'Buatlah ringkasan yang rapi, komprehensif, dan mudah dibaca (gunakan emoji secukupnya), mencakup:',
      '1. Judul Topik Utama',
      '2. Poin-Poin Penting',
      '3. Kesimpulan Akhir',
      '',
      'Transkrip Video:',
      '"""',
      fullText,
      '"""'
    ].join('\n');

    const summary = await aiService.chat(prompt, { maxTokens: 1500 });

    await msg.reply(`📺 *YOUTUBE SUMMARY*\n━━━━━━━━━━━━━━━━━━━━━━\n\n${summary}`);
  } catch (err) {
    log.error('YouTube summarizer failed', { error: err.message });
    await msg.reply('❌ Gagal memproses video.\nKemungkinan penyebab:\n1. Video ini tidak memiliki fitur Subtitle (CC).\n2. Video bersifat privat atau dihapus.\n3. Server YouTube membatasi akses.');
  }
}

module.exports = { handle, command: 'youtube', description: 'Summarize YouTube video from its transcript' };
