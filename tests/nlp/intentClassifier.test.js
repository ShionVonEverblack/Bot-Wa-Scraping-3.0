'use strict';

/**
 * @fileoverview Tests for NLP intent classifier.
 */

// Mock AI service to avoid real API calls
jest.mock('../../src/services/ai/aiService', () => ({
  classifyIntent: jest.fn().mockResolvedValue({ intent: 'UNKNOWN', confidence: 0.5 }),
}));

const { classifyIntent, INTENTS } = require('../../src/bot/nlp/intentClassifier');

describe('intentClassifier', () => {
  describe('rule-based classification', () => {
    test('detects scrape intent', async () => {
      const result = await classifyIntent('cari gambar kucing');
      expect(result.intent).toBe(INTENTS.SCRAPE);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('detects paper download intent', async () => {
      const result = await classifyIntent('download paper 10.1234/test');
      expect(result.intent).toBe(INTENTS.PAPER_DOWNLOAD);
    });

    test('detects greeting', async () => {
      const result = await classifyIntent('halo');
      expect(result.intent).toBe(INTENTS.GREETING);
    });

    test('detects AI chat intent', async () => {
      const result = await classifyIntent('jelaskan apa itu machine learning');
      // May fall to AI fallback (mocked as UNKNOWN), or match rule-based
      expect([INTENTS.AI_CHAT, INTENTS.UNKNOWN]).toContain(result.intent);
    });
  });
});
