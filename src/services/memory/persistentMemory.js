'use strict';

/**
 * @fileoverview Persistent Cross-Session Memory System (inspired by thedotmack/claude-mem).
 * Captures structured observations from user interactions and implements 3-layer
 * Progressive Disclosure retrieval:
 *   Layer 1: searchIndex() — compact index with IDs, titles, tags (~50 tokens/item)
 *   Layer 2: getTimeline() — chronological context window around an observation ID
 *   Layer 3: getObservations() — full observation details only for filtered IDs
 * @module services/memory/persistentMemory
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { ensureDir, writeJson, readJson } = require('../../utils/fsUtil');
const { createLogger } = require('../monitor/logger');

const log = createLogger('services:memory');

/** @type {Map<string, Array<Object>>} userId -> Observation[] */
const memoryStore = new Map();

let loadedFromDisk = false;
let writeChain = Promise.resolve();

/**
 * Path to the persistent memory JSON file.
 * @returns {string}
 */
function getMemoryFilePath() {
  return path.join(config.dirs.cache || './cache', 'claude_mem.json');
}

/**
 * Load persisted memory from disk once if enabled.
 */
function ensureLoadedSync() {
  if (loadedFromDisk) return;
  loadedFromDisk = true;
  if (!config.memory?.persistToDisk) return;

  try {
    const filePath = getMemoryFilePath();
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (raw && typeof raw === 'object') {
        for (const [userId, list] of Object.entries(raw)) {
          if (Array.isArray(list)) {
            memoryStore.set(userId, list);
          }
        }
      }
    }
  } catch (err) {
    log.debug('Failed to load persistent memory from disk', { error: err.message });
  }
}

/**
 * Persist memory store to disk asynchronously via a serialized write queue
 * to prevent concurrent write races.
 * @returns {Promise<void>}
 */
function persistToDisk() {
  if (!config.memory?.persistToDisk) return Promise.resolve();
  const snapshot = {};
  for (const [userId, list] of memoryStore.entries()) {
    snapshot[userId] = list.slice();
  }
  writeChain = writeChain.then(async () => {
    try {
      await ensureDir(config.dirs.cache || './cache');
      await writeJson(getMemoryFilePath(), snapshot);
    } catch (err) {
      log.debug('Could not persist claude_mem.json', { error: err.message });
    }
  });
  return writeChain;
}

/**
 * Wait for any queued disk persistence operations to finish.
 * @returns {Promise<void>}
 */
function flushMemory() {
  return writeChain;
}

/**
 * Extract lowercase keyword tags from text.
 * @param {string} text
 * @returns {string[]}
 */
function extractTags(text) {
  if (!text || typeof text !== 'string') return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3);
  return Array.from(new Set(words)).slice(0, 12);
}

/**
 * Record a structured observation for a user.
 * @param {string} userId
 * @param {Object} observation
 * @param {string} [observation.type='fact'] - 'search'|'paper'|'fact'|'preference'|'workflow'
 * @param {string} observation.title - Short title (~60 chars)
 * @param {string} [observation.content=''] - Full detail payload
 * @param {string[]} [observation.tags] - Explicit tags
 * @param {Object} [observation.meta] - Extra metadata
 * @returns {Object} Created observation
 */
function recordObservation(userId, observation = {}) {
  if (!userId) throw new Error('userId is required');
  ensureLoadedSync();

  const list = memoryStore.get(userId) || [];
  const obsId = `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const title = String(observation.title || observation.summary || 'Observation').trim().slice(0, 120);
  const content = String(observation.content || observation.details || title).trim();
  const tags = Array.isArray(observation.tags) && observation.tags.length > 0
    ? observation.tags
    : extractTags(`${title} ${content}`);

  const entry = {
    id: obsId,
    userId,
    type: observation.type || 'fact',
    title,
    content,
    tags,
    meta: observation.meta || {},
    timestamp: new Date().toISOString(),
  };

  list.push(entry);

  const maxObs = config.memory?.maxObservations || 200;
  if (list.length > maxObs) {
    list.splice(0, list.length - maxObs);
  }

  memoryStore.set(userId, list);
  persistToDisk();

  return entry;
}

/**
 * Layer 1 (Progressive Disclosure): Search compact memory index.
 * Returns lightweight index entries (ID, type, title, tags, score) to save tokens.
 * @param {string} userId
 * @param {string} [query='']
 * @param {number} [limit=10]
 * @returns {Array<{ id: string, type: string, title: string, tags: string[], score: number, timestamp: string }>}
 */
function searchIndex(userId, query = '', limit = 10) {
  if (!userId) return [];
  ensureLoadedSync();

  const list = memoryStore.get(userId) || [];
  if (list.length === 0) return [];

  const qTerms = extractTags(query);

  const scored = list.map((obs, idx) => {
    let score = idx * 0.001; // Slight recency tie-breaker
    if (qTerms.length === 0) {
      score += 1;
    } else {
      const hay = `${obs.title} ${obs.content} ${(obs.tags || []).join(' ')}`.toLowerCase();
      for (const term of qTerms) {
        if ((obs.tags || []).includes(term)) score += 3;
        else if (hay.includes(term)) score += 1.5;
      }
    }
    return { obs, score };
  });

  return scored
    .filter(item => qTerms.length === 0 || item.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ obs, score }) => ({
      id: obs.id,
      type: obs.type,
      title: obs.title,
      tags: obs.tags,
      score: Number(score.toFixed(3)),
      timestamp: obs.timestamp,
    }));
}

/**
 * Layer 2 (Progressive Disclosure): Get chronological timeline around an anchor observation ID.
 * @param {string} userId
 * @param {string} anchorId
 * @param {number} [windowSize=2]
 * @returns {Array<Object>}
 */
function getTimeline(userId, anchorId, windowSize = 2) {
  if (!userId) return [];
  ensureLoadedSync();

  const list = memoryStore.get(userId) || [];
  const idx = list.findIndex(o => o.id === anchorId);
  if (idx === -1) return list.slice(-Math.max(1, windowSize * 2));

  const start = Math.max(0, idx - windowSize);
  const end = Math.min(list.length, idx + windowSize + 1);
  return list.slice(start, end).map(o => ({
    id: o.id,
    type: o.type,
    title: o.title,
    timestamp: o.timestamp,
  }));
}

/**
 * Layer 3 (Progressive Disclosure): Fetch full observation payloads by IDs.
 * @param {string} userId
 * @param {string[]} ids
 * @returns {Array<Object>}
 */
function getObservations(userId, ids = []) {
  if (!userId || !Array.isArray(ids)) return [];
  ensureLoadedSync();

  const idSet = new Set(ids);
  const list = memoryStore.get(userId) || [];
  return list.filter(o => idSet.has(o.id));
}

/**
 * Build a compact memory context block for injecting into an AI prompt.
 * @param {string} userId
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {string}
 */
function buildMemoryContextPrompt(userId, query, limit = 5) {
  const indexHits = searchIndex(userId, query, limit);
  if (indexHits.length === 0) return '';

  const fullObs = getObservations(userId, indexHits.map(h => h.id));
  const lines = fullObs.map(
    o => `- [${o.type.toUpperCase()} | ${o.timestamp.slice(0, 10)}] ${o.title}: ${o.content.slice(0, 200)}`
  );

  return `### User Persistent Memory (Claude-Mem)\n${lines.join('\n')}`;
}

/**
 * Clear all observations for a user (or all users if userId omitted).
 * @param {string} [userId]
 */
function clearMemory(userId) {
  ensureLoadedSync();
  if (userId) {
    memoryStore.delete(userId);
  } else {
    memoryStore.clear();
  }
  persistToDisk();
}

module.exports = {
  recordObservation,
  searchIndex,
  getTimeline,
  getObservations,
  buildMemoryContextPrompt,
  buildPromptMemoryContext: buildMemoryContextPrompt,
  clearMemory,
  flushMemory,
  extractTags,
};
