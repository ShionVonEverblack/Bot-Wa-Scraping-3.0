'use strict';

/**
 * @fileoverview Unit and integration tests for Smart UX & Anti-Ban features:
 * 1. Typing State Indicator (sendTyping)
 * 2. Anti-Ban Human Jitter Delay (jitterDelay)
 * 3. Mobile Brevity Guard (replyWithBrevityGuard)
 * 4. Smart Link Drop (handleSmartLinkDrop & auto URL summarization)
 */

const path = require('path');
const fs = require('fs');
const {
  sendTyping,
  jitterDelay,
  replyWithBrevityGuard,
  handleSmartLinkDrop,
  handleMessage,
  setReady,
} = require('../../src/bot/messageHandler');

describe('Smart UX & Anti-Ban WhatsApp Features', () => {
  beforeEach(() => {
    setReady(true);
    jest.clearAllMocks();
  });

  describe('1. Typing State Indicator (sendTyping)', () => {
    test('calls sendStateTyping on chat object', async () => {
      const mockChat = { sendStateTyping: jest.fn().mockResolvedValue() };
      const mockMsg = { getChat: jest.fn().mockResolvedValue(mockChat) };

      await sendTyping(mockMsg);
      expect(mockChat.sendStateTyping).toHaveBeenCalledTimes(1);
    });

    test('handles missing or failing sendStateTyping gracefully without throwing', async () => {
      const mockMsg = { getChat: jest.fn().mockRejectedValue(new Error('Network error')) };
      await expect(sendTyping(mockMsg)).resolves.not.toThrow();
    });
  });

  describe('2. Anti-Ban Human Jitter Delay (jitterDelay)', () => {
    test('resolves immediately when NODE_ENV is test to keep test suites fast', async () => {
      const start = Date.now();
      await jitterDelay(400, 900);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    test('calculates a delay within minMs and maxMs when not in test env', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const start = Date.now();
      await jitterDelay(10, 20);
      const elapsed = Date.now() - start;

      process.env.NODE_ENV = origEnv;
      expect(elapsed).toBeGreaterThanOrEqual(8);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('3. Mobile Brevity Guard (replyWithBrevityGuard)', () => {
    test('replies directly without truncating when text is under maxChars', async () => {
      const mockMsg = {
        reply: jest.fn().mockResolvedValue({ id: 'msg-short' }),
      };

      const shortText = 'Ini adalah jawaban singkat AI yang nyaman dibaca.';
      await replyWithBrevityGuard(mockMsg, shortText, 1500);

      expect(mockMsg.reply).toHaveBeenCalledWith(shortText);
      expect(mockMsg.reply).toHaveBeenCalledTimes(1);
    });

    test('truncates and sends document attachment when text exceeds maxChars', async () => {
      const mockChat = {
        sendMessage: jest.fn().mockResolvedValue({ id: 'msg-media' }),
      };
      const mockMsg = {
        reply: jest.fn().mockResolvedValue({ id: 'msg-excerpt' }),
        getChat: jest.fn().mockResolvedValue(mockChat),
      };

      const longText = 'A'.repeat(2000);
      await replyWithBrevityGuard(mockMsg, longText, 1500);

      expect(mockMsg.reply).toHaveBeenCalledTimes(1);
      const excerptSent = mockMsg.reply.mock.calls[0][0];
      expect(excerptSent).toContain('teks dipotong agar nyaman dibaca di ponsel');
      expect(excerptSent.length).toBeLessThan(1800);
    });
  });

  describe('4. Smart Link Drop (handleSmartLinkDrop)', () => {
    test('detects URL, crawls with llmCrawler, summarizes with AI, and delivers summary', async () => {
      const llmCrawler = require('../../src/engine/llmCrawler');
      const aiService = require('../../src/services/ai/aiService');

      jest.spyOn(llmCrawler, 'scrapeUrlToMarkdown').mockResolvedValueOnce({
        title: 'Pengumuman Teknologi Terkini',
        markdown: '# Judul Berita\n\nIsi berita lengkap mengenai perkembangan AI di Indonesia tahun 2026.',
      });

      jest.spyOn(aiService, 'chat').mockResolvedValueOnce(
        '1. Perkembangan AI di Indonesia bertumbuh pesat.\n2. Banyak startup mengadopsi model lokal.'
      );

      const mockMsg = {
        reply: jest.fn().mockResolvedValue(),
        react: jest.fn().mockResolvedValue(),
        getChat: jest.fn().mockResolvedValue({ sendStateTyping: jest.fn().mockResolvedValue() }),
      };
      const mockClient = {};

      const handled = await handleSmartLinkDrop(
        mockMsg,
        mockClient,
        'user123@c.us',
        'tolong rangkum https://example.com/berita-ai',
        'https://example.com/berita-ai'
      );

      expect(handled).toBe(true);
      expect(llmCrawler.scrapeUrlToMarkdown).toHaveBeenCalledWith('https://example.com/berita-ai');
      expect(aiService.chat).toHaveBeenCalled();
      expect(mockMsg.reply).toHaveBeenCalledWith(expect.stringContaining('Ringkasan Halaman Web:'));
      expect(mockMsg.react).toHaveBeenCalledWith('✅');
    });

    test('delegates YouTube URLs directly to youtube.handler', async () => {
      const ytHandler = require('../../src/commands/handlers/youtube.handler');
      jest.spyOn(ytHandler, 'handle').mockResolvedValueOnce();

      const mockMsg = {
        react: jest.fn().mockResolvedValue(),
        reply: jest.fn().mockResolvedValue(),
        getChat: jest.fn().mockResolvedValue({ sendStateTyping: jest.fn().mockResolvedValue() }),
      };
      const mockClient = {};

      const handled = await handleSmartLinkDrop(
        mockMsg,
        mockClient,
        'user123@c.us',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ'
      );

      expect(handled).toBe(true);
      expect(ytHandler.handle).toHaveBeenCalledWith(mockMsg, ['https://youtu.be/dQw4w9WgXcQ'], mockClient);
    });
  });

  describe('5. Integration in handleMessage Flow', () => {
    test('automatically intercepts direct URL message and invokes Smart Link Drop', async () => {
      const llmCrawler = require('../../src/engine/llmCrawler');
      const aiService = require('../../src/services/ai/aiService');

      jest.spyOn(llmCrawler, 'scrapeUrlToMarkdown').mockResolvedValueOnce({
        title: 'Open Source Community',
        markdown: 'Open source projects allow global collaboration across software developers.',
      });
      jest.spyOn(aiService, 'chat').mockResolvedValueOnce('Ringkasan: Kolaborasi global developer.');

      const mockMsg = {
        body: 'https://opensource.org/article',
        from: 'user_link@c.us',
        getContact: jest.fn().mockResolvedValue({ id: { _serialized: 'user_link@c.us' }, pushname: 'Rudi' }),
        getChat: jest.fn().mockResolvedValue({ id: { _serialized: 'user_link@c.us' }, isGroup: false, sendStateTyping: jest.fn().mockResolvedValue() }),
        reply: jest.fn().mockResolvedValue(),
        react: jest.fn().mockResolvedValue(),
      };
      const mockClient = {};

      await handleMessage(mockMsg, mockClient);

      expect(mockMsg.reply).toHaveBeenCalledWith(expect.stringContaining('Membaca tautan web...'));
      expect(llmCrawler.scrapeUrlToMarkdown).toHaveBeenCalled();
    });
  });
});
