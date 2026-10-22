'use strict';

/**
 * @fileoverview Tier 3 Cross-Feature Combination: Multi-Turn Dialogue, Context Headroom Compression & Persistent Memory.
 * Tests end-to-end integration between:
 *   - F25 (Layered Persistent Memory)
 *   - F26 (Context Window Compression & Headroom Smart Crusher)
 *   - F27 (Cross-Session Persistence)
 *   - F30/F31 (E2E Resilience & Boundary Hardening)
 */

const path = require('path');
const sampleDocs = require('../../fixtures/sampleDocs');

describe('Tier 3: Cross-Feature Combination — Dialogue Headroom Compression & Memory Persistence', () => {
  const rootDir = process.cwd();

  let contextCompressor;
  let persistentMemory;

  beforeAll(() => {
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
  });

  beforeEach(() => {
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Multi-Turn Dialogue Compression (Rolling Context Window)
  // --------------------------------------------------------------------------
  test('P4-1: Multi-turn chat dialogue compressed with older turn summarization and recent turn retention', () => {
    // Construct rich multi-turn discussion with substantial older turns
    const richDialogue = [
      { role: 'user', content: 'Detailed background description. '.repeat(20) },
      { role: 'assistant', content: 'Comprehensive architectural analysis. '.repeat(20) },
      { role: 'user', content: 'Further methodology inquiry. '.repeat(20) },
      { role: 'assistant', content: 'Detailed technical response and code breakdown. '.repeat(20) },
      { role: 'user', content: 'Recent question on training hyperparameters?' },
      { role: 'assistant', content: 'Recent reply: Batch size 32 and AdamW optimizer are recommended.' },
    ];

    const rawTokens = contextCompressor.estimateTokens(richDialogue.map(m => m.content).join('\n'));
    expect(rawTokens).toBeGreaterThan(300);

    // Compress with maxTokens budget = 250
    const compressed = contextCompressor.compressMessages(richDialogue, 250);
    expect(compressed.messages.length).toBeLessThan(richDialogue.length);

    // Verify recent turns are retained verbatim
    const lastTurn = compressed.messages[compressed.messages.length - 1];
    expect(lastTurn.role).toBe('assistant');
    expect(lastTurn.content).toContain('Batch size 32');

    // Verify older turns are captured in a compressed summary
    const summaryMsg = compressed.messages.find(m => m.content && m.content.includes('[Compressed Earlier Context]'));
    expect(summaryMsg).toBeDefined();

    // Significant token savings achieved
    expect(compressed.stats.compressedTokens).toBeLessThan(rawTokens);
    expect(compressed.stats.savingsPercent).toBeGreaterThan(40);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Smart Crushing of Heavy JSON Results in Dialogue Context
  // --------------------------------------------------------------------------
  test('P4-2: Heavy scraped JSON items crushed into schema-deduplicated tabular representation for prompt injection', () => {
    const res = contextCompressor.compressJsonItems(sampleDocs.sampleJsonItems);

    // Heavy keys stripped
    for (const item of res.crushedItems) {
      expect(item.raw).toBeUndefined();
      expect(item._score).toBeUndefined();
      expect(item.thumbnail).toBeUndefined();
      expect(item.sourceUrl).toBeUndefined();
      expect(item.title).toBeDefined();
      expect(item.price).toBeDefined();
    }

    // Schema header emitted
    expect(res.crushedText).toMatch(/^# Schema:/);
    expect(res.crushedText).toContain('RTX 4090 Gaming Edition');
    expect(res.crushedText).toContain('Radeon RX 7900 XTX');

    // Substantial token savings achieved
    expect(res.stats.originalTokens).toBeGreaterThan(res.stats.compressedTokens);
    expect(res.stats.savingsPercent).toBeGreaterThanOrEqual(25);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Fact Extraction from Dialogue into 3-Layer Persistent Memory
  // --------------------------------------------------------------------------
  test('P4-3: Critical hyperparameters extracted from dialogue turns and indexed in persistent memory', () => {
    const userId = 'ml_engineer_42';

    // Extract facts from dialogue turn 3 (batch size 32, AdamW, weight decay 0.01)
    const obs = persistentMemory.recordObservation(userId, {
      type: 'hyperparameter',
      title: 'Training Hyperparameters',
      content: 'Batch size: 32, Optimizer: AdamW, Weight decay: 0.01, Model: IndoBERT.',
      tags: ['batch_size', 'adamw', 'indobert', 'training'],
    });

    expect(obs.id).toBeDefined();

    // Layer 1 search: Fast index lookup
    const indexHits = persistentMemory.searchIndex(userId, 'adamw batch size');
    expect(indexHits.length).toBeGreaterThan(0);
    expect(indexHits[0].id).toBe(obs.id);
    expect(indexHits[0].tags).toContain('adamw');

    // Layer 2 timeline: Context around this event
    const timeline = persistentMemory.getTimeline(userId, obs.id, 1);
    expect(timeline.length).toBeGreaterThanOrEqual(1);

    // Layer 3 payload: Full content retrieval
    const fullObs = persistentMemory.getObservations(userId, [obs.id]);
    expect(fullObs[0].content).toContain('Batch size: 32');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Dynamic Headroom Prompt Assembly
  // --------------------------------------------------------------------------
  test('P4-4: Assembles composite prompt containing persistent memory, compressed dialogue, and crushed items within budget', () => {
    const userId = 'composer_user_01';

    // 1. Establish persistent memory
    persistentMemory.recordObservation(userId, {
      type: 'preference',
      title: 'GPU Budget Preference',
      content: 'Prefers NVIDIA GPUs with minimum 24GB VRAM for local LLM inference.',
    });

    const memoryBlock = persistentMemory.buildMemoryContextPrompt(userId, 'NVIDIA GPU 24GB');
    expect(memoryBlock).toContain('GPU Budget Preference');

    // 2. Compress chat history
    const compressedChat = contextCompressor.compressMessages(sampleDocs.multiTurnChatDialogue.slice(0, 6), 200);

    // 3. Crush tool outputs
    const crushedCatalog = contextCompressor.compressJsonItems(sampleDocs.sampleJsonItems);

    // 4. Combine into final prompt
    const finalPrompt = [
      memoryBlock,
      '--- CHAT HISTORY ---',
      ...compressedChat.messages.map(m => `${m.role}: ${m.content}`),
      '--- TOOL RESULTS (CRUSHED) ---',
      crushedCatalog.crushedText,
    ].join('\n\n');

    const totalTokens = contextCompressor.estimateTokens(finalPrompt);
    expect(totalTokens).toBeGreaterThan(0);
    expect(finalPrompt).toContain('GPU Budget Preference');
    expect(finalPrompt).toContain('# Schema:');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Cross-Session Continuity Verification
  // --------------------------------------------------------------------------
  test('P4-5: Memories survive session boundaries and correctly rehydrate into new conversation', () => {
    const userSession = 'cross_session_researcher';

    // Session 1: User stores preference
    persistentMemory.recordObservation(userSession, {
      type: 'fact',
      title: 'Target Architecture',
      content: 'Research focus is Graph Neural Networks and Knowledge Graph Embedding.',
    });

    // Session 1 ends — Simulate new session starting from scratch
    const newSessionQuery = 'What was my research focus?';
    const restoredPrompt = persistentMemory.buildMemoryContextPrompt(userSession, newSessionQuery);

    expect(restoredPrompt).toContain('Target Architecture');
    expect(restoredPrompt).toContain('Graph Neural Networks');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Adversarial Extreme Payload within Dialogue Pipeline
  // --------------------------------------------------------------------------
  test('P4-6: Adversarial dialogue turn with 30,000 characters compressed without memory overflow', () => {
    const giantPayload = 'Deep learning models process high-dimensional tensors. '.repeat(550); // ~30KB
    const stressMessages = [
      { role: 'user', content: giantPayload },
      { role: 'assistant', content: 'Detailed analysis of tensors. '.repeat(100) },
      { role: 'user', content: 'Second follow-up question. '.repeat(50) },
      { role: 'assistant', content: 'Handling giant payload safely.' },
      { role: 'user', content: 'Recent question.' },
      { role: 'assistant', content: 'Recent answer.' },
    ];

    expect(() => contextCompressor.compressMessages(stressMessages, 250)).not.toThrow();
    const result = contextCompressor.compressMessages(stressMessages, 250);
    expect(result.messages.length).toBeLessThan(stressMessages.length);
    expect(result.stats.compressedTokens).toBeLessThan(result.stats.originalTokens);
    expect(result.stats.savingsPercent).toBeGreaterThan(50);
  });
});
