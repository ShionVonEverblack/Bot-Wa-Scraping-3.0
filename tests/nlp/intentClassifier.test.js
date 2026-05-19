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
      expect([INTENTS.AI_CHAT, INTENTS.UNKNOWN]).toContain(result.intent);
    });

    test('returns UNKNOWN for null/empty input', async () => {
      const { ruleBasedClassify } = require('../../src/bot/nlp/intentClassifier');
      expect(ruleBasedClassify(null).intent).toBe(INTENTS.UNKNOWN);
      expect(ruleBasedClassify('').intent).toBe(INTENTS.UNKNOWN);
      expect((await classifyIntent(null)).intent).toBe(INTENTS.UNKNOWN);
    });

    test('returns UNKNOWN for text matching no rules', async () => {
      const { ruleBasedClassify } = require('../../src/bot/nlp/intentClassifier');
      expect(ruleBasedClassify('asdfghjkl').intent).toBe(INTENTS.UNKNOWN);
    });
  });

  describe('contextual and AI fallback', () => {
    test('uses context for follow-up intent', async () => {
      const context = { lastIntent: INTENTS.SCRAPE };
      const result = await classifyIntent('lagi kucing', context);
      expect(result.intent).toBe(INTENTS.SCRAPE);
      expect(result.entities.followUp).toBe(true);
    });

    test('returns AI fallback when rule-based is ambiguous', async () => {
      // "asdfghjkl" has 0 confidence, triggers AI fallback
      const aiService = require('../../src/services/ai/aiService');
      aiService.classifyIntent.mockResolvedValueOnce({ intent: INTENTS.AI_CHAT, entities: {} });
      
      const result = await classifyIntent('asdfghjkl');
      expect(result.intent).toBe(INTENTS.AI_CHAT);
    });

    test('handles AI fallback failure gracefully', async () => {
      const aiService = require('../../src/services/ai/aiService');
      aiService.classifyIntent.mockRejectedValueOnce(new Error('API failure'));
      
      const result = await classifyIntent('asdfghjkl');
      expect(result.intent).toBe(INTENTS.UNKNOWN); // Fallback to rule result
    });
  });
});
