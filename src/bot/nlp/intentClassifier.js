'use strict';

/**
 * @fileoverview Intent classifier with 2-layer approach: rule-based → AI fallback.
 * @module bot/nlp/intentClassifier
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('nlp:intent');

/** Intent type constants. */
const INTENTS = {
  SCRAPE: 'SCRAPE',
  AI_CHAT: 'AI_CHAT',
  PAPER_DOWNLOAD: 'PAPER_DOWNLOAD',
  IMAGE_ANALYZE: 'IMAGE_ANALYZE',
  GREETING: 'GREETING',
  COMMAND: 'COMMAND',
  UNKNOWN: 'UNKNOWN',
};

// ─── Rule-Based Patterns ────────────────────────────────────────────────────

/** Regex patterns for each intent (bilingual: ID + EN). */
const RULES = [
  {
    intent: INTENTS.COMMAND,
    patterns: [/^[!/]/],
    confidence: 1.0,
  },
  {
    intent: INTENTS.PAPER_DOWNLOAD,
    patterns: [
      /10\.\d{4,9}\/[^\s]+/,                   // DOI
      /arxiv[:\s]*\d{4}\.\d{4,5}/i,            // arXiv ID
      /\barxiv\.org\/abs\//i,                    // arXiv URL
      /\bPMID[:\s]*\d+/i,                       // PubMed ID
      /\bPMC\d+/i,                               // PMC ID
      /download\s+(paper|pdf|jurnal|artikel)/i,
      /unduh\s+(paper|pdf|jurnal|artikel)/i,
    ],
    confidence: 0.95,
  },
  {
    intent: INTENTS.IMAGE_ANALYZE,
    patterns: [
      /anali[sz][ea]\s+(gambar|image|foto|photo)/i,
      /anali[sz]e?\s+(this|the)?\s*(image|picture|photo)/i,
      /apa\s+(isi|yang ada di)\s+(gambar|foto)/i,
      /describe\s+(this|the)?\s*(image|picture|photo)/i,
      /jelaskan\s+(gambar|foto)\s*(ini)?/i,
    ],
    confidence: 0.9,
  },
  {
    intent: INTENTS.SCRAPE,
    patterns: [
      /\b(scrape|cari(kan)?|find|search|tolong\s+cari(kan)?|bantu\s+cari(kan)?)\b/i,
      /\b(cari\s+(gambar|paper|data|dataset|artikel|jurnal|image|foto))/i,
      /\b(scrape\s+(images?|papers?|datasets?))/i,
      /\b(cari\s+tentang)\b/i,
      /\b(mau\s+(cari|nyari))\b/i,
    ],
    confidence: 0.9,
  },
  {
    intent: INTENTS.GREETING,
    patterns: [
      /^(hai|halo|hello|hi|hey|hei|yo|oi)\s*[!.?]*$/i,
      /^(assalamualaikum|selamat\s+(pagi|siang|sore|malam))/i,
      /^(good\s+(morning|afternoon|evening|night))/i,
      /^(p|bot)\s*[!.?]*$/i,
    ],
    confidence: 0.95,
  },
  {
    intent: INTENTS.AI_CHAT,
    patterns: [
      /\b(apa\s+(itu|yang|sih))\b/i,
      /\b(jelaskan|explain|describe)\b/i,
      /\b(kenapa|mengapa|why)\b/i,
      /\b(bagaimana|gimana|how)\b/i,
      /\b(siapa|who)\b/i,
      /\b(kapan|when)\b/i,
      /\b(dimana|di\s+mana|where)\b/i,
      /\b(tolong\s+(jelaskan|bantu))\b/i,
      /\b(ceritakan|tell\s+me)\b/i,
      /\?\s*$/,  // ends with question mark
    ],
    confidence: 0.7,
  },
];

/**
 * Layer 1: Rule-based intent classification (fast, no API call).
 * @param {string} text - User's message text
 * @returns {{ intent: string, confidence: number }}
 */
function ruleBasedClassify(text) {
  if (!text || typeof text !== 'string') {
    return { intent: INTENTS.UNKNOWN, confidence: 0 };
  }

  const trimmed = text.trim();

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return { intent: rule.intent, confidence: rule.confidence };
      }
    }
  }

  return { intent: INTENTS.UNKNOWN, confidence: 0 };
}

/**
 * Classify intent of a message (2-layer: rule-based → AI fallback).
 * @param {string} text - User's message text
 * @param {Object} [context] - User conversation context from contextMemory
 * @returns {Promise<{intent:string, confidence:number, entities:Object}>}
 */
async function classifyIntent(text, context) {
  // Layer 1: Rule-based
  const ruleResult = ruleBasedClassify(text);

  if (ruleResult.confidence >= 0.8) {
    log.debug('Rule-based classification', {
      intent: ruleResult.intent,
      confidence: ruleResult.confidence,
    });
    return { ...ruleResult, entities: {} };
  }

  // Check context — if user has active context, assume follow-up
  if (context && context.lastIntent) {
    // Follow-up heuristics
    const lower = text.toLowerCase().trim();
    if (/^(lagi|more|tambah|next|lanjut)/.test(lower)) {
      log.debug('Context-based follow-up detected', { lastIntent: context.lastIntent });
      return {
        intent: context.lastIntent,
        confidence: 0.85,
        entities: { followUp: true },
      };
    }
  }

  // Layer 2: AI-based fallback (only if rule-based is ambiguous)
  if (ruleResult.confidence < 0.8) {
    try {
      const aiService = require('../../services/ai/aiService');
      const aiResult = await aiService.classifyIntent(text);
      log.debug('AI-based classification', { result: aiResult });
      return {
        intent: aiResult.intent || INTENTS.UNKNOWN,
        confidence: 0.85,
        entities: aiResult.entities || {},
      };
    } catch (err) {
      log.warn('AI classification fallback failed', { error: err.message });
    }
  }

  // Final fallback: return whatever rule-based gave us
  return { ...ruleResult, entities: {} };
}

module.exports = { classifyIntent, ruleBasedClassify, INTENTS };
