'use strict';

/**
 * @fileoverview RAG command handler — Deep Document & Web RAG (RAGFlow + OpenDataLoader-PDF).
 * Command: !rag <ingest|ask|stats|clear> [args...]
 * @module commands/handlers/rag
 */

const ragEngine = require('../../services/rag/ragEngine');
const pdfLoader = require('../../services/pdf/pdfLoader');
const { scrapeUrlToMarkdown } = require('../../engine/llmCrawler');
const jobStore = require('../../jobs/jobStore');
const { truncate } = require('../../utils/text');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:rag');

/**
 * Attempt to extract a PDF/document buffer from the message or its quoted message.
 * @param {Object} msg
 * @returns {Promise<{ buffer: Buffer, filename: string }|null>}
 */
async function extractAttachedOrQuotedPdf(msg) {
  try {
    let targetMsg = msg.hasMedia ? msg : null;
    if (!targetMsg && msg.hasQuotedMsg && typeof msg.getQuotedMessage === 'function') {
      const quoted = await msg.getQuotedMessage();
      if (quoted && quoted.hasMedia) targetMsg = quoted;
    }
    if (!targetMsg || typeof targetMsg.downloadMedia !== 'function') return null;

    const media = await targetMsg.downloadMedia();
    if (!media || !media.data) return null;

    const mime = (media.mimetype || '').toLowerCase();
    const filename = media.filename || `document_${Date.now()}.pdf`;
    if (mime.includes('pdf') || mime.includes('text') || /\.pdf$|\.txt$|\.md$/i.test(filename)) {
      return {
        buffer: Buffer.from(media.data, 'base64'),
        filename,
      };
    }
  } catch (err) {
    log.debug('Could not extract media for RAG ingestion', { error: err.message });
  }
  return null;
}

/**
 * Handle !rag command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const sub = (args[0] || '').toLowerCase();
  const rest = args.slice(1).join(' ').trim();
  const fullInput = args.join(' ').trim();

  try {
    // Check if the user attached or quoted a PDF/document
    const mediaAttachment = await extractAttachedOrQuotedPdf(msg);
    if (mediaAttachment && (!sub || sub === 'ingest' || sub === 'add' || sub === 'index' || (sub !== 'stats' && sub !== 'list' && sub !== 'clear' && sub !== 'help'))) {
      const parsedPdf = await pdfLoader.parseBuffer(mediaAttachment.buffer, {
        title: mediaAttachment.filename,
      });
      const indexed = ragEngine.indexDocument(
        `pdf_${Date.now()}`,
        parsedPdf,
        { title: parsedPdf.title || mediaAttachment.filename }
      );

      const followUpQuestion =
        sub === 'ingest' || sub === 'add' || sub === 'index'
          ? rest
          : fullInput;

      if (followUpQuestion) {
        const res = await ragEngine.answerWithRag(followUpQuestion, { docId: indexed.docId });
        await msg.reply(
          `📄 *PDF Diindeks:* ${indexed.title} (\`${indexed.docId}\`, *${indexed.chunkCount} chunks*)\n\n${res.answer}`
        );
      } else {
        await msg.reply(
          `✅ Berhasil mengindeks PDF *${indexed.title}* ke RAG!\n🆔 Doc ID: \`${indexed.docId}\` (*${indexed.chunkCount} chunks*, *${parsedPdf.sections?.length || 0} sections*, *${parsedPdf.tables?.length || 0} tables*)`
        );
      }
      return;
    }

    if (!sub || sub === 'help') {
      await msg.reply(
        [
          '📚 *!rag — Deep Document & Web RAG (RAGFlow + OpenDataLoader)*',
          '',
          '*Sub-commands:*',
          '• `!rag ingest <url|jobId|teks>` — Index halaman web, hasil job, atau teks ke RAG',
          '• Reply PDF dengan `!rag` atau `!rag <pertanyaan>` — Parse & index PDF otomatis',
          '• `!rag ask <pertanyaan>` — Tanya RAG dengan Hybrid Search (BM25 + Vector RRF) & sitasi',
          '• `!rag stats` / `!rag list` — Lihat jumlah dokumen & chunk terindeks',
          '• `!rag clear` — Bersihkan indeks RAG',
        ].join('\n')
      );
      return;
    }

    if (sub === 'stats' || sub === 'list') {
      const stats = ragEngine.getStats();
      const docLines = stats.documents
        .slice(0, 10)
        .map((d, i) => `${i + 1}. \`${d.docId}\` — *${truncate(d.title, 45)}* (${d.chunkCount} chunks)`)
        .join('\n');

      await msg.reply(
        [
          '📊 *RAGFlow Index Stats*',
          `📄 Documents: *${stats.totalDocuments}*`,
          `🧩 Structure-Aware Chunks: *${stats.totalChunks}*`,
          docLines ? `\n*Daftar Dokumen:*\n${docLines}` : '',
        ].filter(Boolean).join('\n')
      );
      return;
    }

    if (sub === 'clear') {
      ragEngine.clearIndex();
      await msg.reply('🧹 Indeks RAG berhasil dibersihkan.');
      return;
    }

    // Direct URL or JobID without 'ingest' keyword, or explicit 'ingest'/'add'/'index'
    const isDirectUrl = /^https?:\/\//i.test(fullInput);
    const isDirectJobId = /^J[a-zA-Z0-9]{5}$/.test(fullInput);
    if (sub === 'ingest' || sub === 'add' || sub === 'index' || isDirectUrl || isDirectJobId) {
      const target = isDirectUrl || isDirectJobId ? fullInput : rest;
      if (!target) {
        await msg.reply('❓ Gunakan: `!rag ingest <url|jobId|teks>`');
        return;
      }

      // 1. URL ingestion
      if (/^https?:\/\//i.test(target)) {
        await msg.reply(`⏳ Mengunduh & mem-parsing struktur halaman ${truncate(target, 50)}...`);
        const doc = await scrapeUrlToMarkdown(target);
        const indexed = ragEngine.indexDocument(`url_${Date.now()}`, doc.fitMarkdown || doc.markdown, {
          title: doc.title || target,
        });
        await msg.reply(
          `✅ Berhasil mengindeks *${indexed.title}* ke RAG!\n🆔 Doc ID: \`${indexed.docId}\` (*${indexed.chunkCount} chunks*)`
        );
        return;
      }

      // 2. Job ID ingestion
      if (/^J[a-zA-Z0-9]{5}$/.test(target)) {
        const job = await jobStore.getJob(target);
        if (!job || !job.result?.items?.length) {
          await msg.reply(`❌ Job \`${target}\` tidak ditemukan atau kosong.`);
          return;
        }
        const combined = job.result.items
          .map((item, idx) => `## ${idx + 1}. ${item.title || 'Item'}\n${item.description || ''}\nURL: ${item.url || ''}`)
          .join('\n\n');
        const indexed = ragEngine.indexDocument(`job_${target}`, combined, {
          title: `Job ${target}: ${job.request?.keyword || 'Results'}`,
        });
        await msg.reply(
          `✅ Berhasil mengindeks hasil Job \`${target}\` ke RAG (*${indexed.chunkCount} chunks*)!`
        );
        return;
      }

      // 3. Raw text ingestion
      const indexed = ragEngine.indexDocument(`txt_${Date.now()}`, target, {
        title: truncate(target, 40),
      });
      await msg.reply(`✅ Teks diindeks ke RAG (\`${indexed.docId}\`, *${indexed.chunkCount} chunks*).`);
      return;
    }

    // Default or 'ask' / 'query'
    const question = sub === 'ask' || sub === 'query' ? rest : fullInput;
    if (!question) {
      await msg.reply('❓ Masukkan pertanyaan. Contoh: `!rag ask apa metodologi yang digunakan?`');
      return;
    }

    const res = await ragEngine.answerWithRag(question);
    await msg.reply(res.answer);
  } catch (err) {
    log.error('RAG command failed', { error: err.message });
    await msg.reply(`❌ RAG error: ${err.message}`);
  }
}

module.exports = { handle, command: 'rag', description: 'Deep Document & Web RAG engine' };
