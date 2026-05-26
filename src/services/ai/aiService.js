'use strict';

/**
 * @fileoverview Unified AI service interface with auto-fallback across providers.
 * @module services/ai/aiService
 */

const config = require('../../config');
const { createLogger } = require('../monitor/logger');
const { getSystemPrompt, filterOutput, redactSecrets } = require('./safety/aiSafety');
const axios = require('axios');

const log = createLogger('ai:service');

/** Lazy-loaded provider modules. */
const PROVIDERS = {
  openai: () => require('./providers/openai.provider'),
  gemini: () => require('./providers/gemini.provider'),
  groq: () => require('./providers/groq.provider'),
  grok: () => require('./providers/grok.provider'),
};

/**
 * Get the provider module for a given name.
 * @param {string} name - Provider name
 * @returns {Object|null} Provider module or null
 */
function getProvider(name) {
  const factory = PROVIDERS[name];
  if (!factory) return null;
  try {
    return factory();
  } catch (err) {
    log.warn(`Failed to load provider: ${name}`, { error: err.message });
    return null;
  }
}

/**
 * Get the ordered list of providers to try (primary + fallback).
 * @param {string} [preferred] - Preferred provider override
 * @returns {string[]}
 */
function getProviderOrder(preferred) {
  const primary = preferred || config.ai.provider;
  const fallbacks = config.ai.fallbackOrder.filter(p => p !== primary);
  return [primary, ...fallbacks];
}

/**
 * Generate a completion with auto-fallback across providers.
 * @param {Object} params
 * @param {Array<{role:string,content:string|Array}>} params.messages - Chat messages
 * @param {string} [params.model] - Model override (provider-specific)
 * @param {number} [params.temperature=0.7] - Sampling temperature
 * @param {number} [params.maxTokens=2048] - Max tokens
 * @param {string} [params.aiProvider] - Override primary provider
 * @returns {Promise<{text:string, usage:{promptTokens:number,completionTokens:number}|null}>}
 */
async function generate({ messages, model, temperature = 0.7, maxTokens = 2048, aiProvider }) {
  const order = getProviderOrder(aiProvider);
  const errors = [];

  for (const providerName of order) {
    const provider = getProvider(providerName);
    if (!provider) continue;

    try {
      log.debug(`Trying AI provider: ${providerName}`);
      const result = await provider.generate({ messages, model, temperature, maxTokens });

      // Apply safety filters
      result.text = filterOutput(result.text);
      result.text = redactSecrets(result.text);

      return result;
    } catch (err) {
      if (err.code === 'KEY_MISSING') {
        log.debug(`Skipping ${providerName}: no API key`);
      } else {
        log.warn(`Provider ${providerName} failed, trying next`, { error: err.message });
      }
      errors.push({ provider: providerName, error: err.message });
    }
  }

  const errMsg = `All AI providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`;
  log.error(errMsg);
  throw new Error(errMsg);
}

/**
 * Simple chat interface — send a prompt, get a text response.
 * @param {string} prompt - User's question or message
 * @param {Object} [options] - Additional options
 * @param {string} [options.aiProvider] - Provider override
 * @param {string} [options.systemPrompt] - Custom system prompt
 * @param {Array<{role:string,content:string}>} [options.history] - Previous messages for multi-turn
 * @param {number} [options.maxTokens=2048] - Max tokens
 * @returns {Promise<string>} AI response text
 */
async function chat(prompt, options = {}) {
  const messages = [
    { role: 'system', content: options.systemPrompt || getSystemPrompt() },
    ...(options.history || []),
    { role: 'user', content: prompt },
  ];

  const result = await generate({
    messages,
    aiProvider: options.aiProvider,
    maxTokens: options.maxTokens || 2048,
  });

  return result.text;
}

/**
 * Summarize scrape results using AI.
 * @param {Object} params
 * @param {string} params.type - Scrape type (images, papers, datasets, general)
 * @param {Array<Object>} params.items - Result items to summarize
 * @param {string} [params.aiProvider] - Provider override
 * @returns {Promise<string>} Summary text
 */
async function summarizeResults({ type, items, aiProvider }) {
  if (!items || items.length === 0) return 'Tidak ada hasil untuk disummary.';

  // Limit items to summarize
  const maxItems = config.ai.summaryMaxItems;
  const sliced = items.slice(0, maxItems);

  const itemsText = sliced.map((item, i) => {
    const parts = [`${i + 1}.`];
    if (item.title) parts.push(item.title);
    if (item.description) parts.push(`— ${item.description.slice(0, 150)}`);
    if (item.url) parts.push(`(${item.url})`);
    return parts.join(' ');
  }).join('\n');

  const prompt = [
    `Berikan ringkasan singkat (3-5 bullet points) dari ${sliced.length} hasil pencarian ${type} berikut:`,
    '',
    itemsText,
    '',
    'Format: bullet points, singkat dan informatif. Bahasa: sesuaikan dengan konten.',
  ].join('\n');

  return chat(prompt, { aiProvider });
}

/**
 * Analyze an image using AI vision capabilities.
 * @param {Object} params
 * @param {string} params.imageBase64 - Base64 encoded image data
 * @param {string} params.mimeType - Image MIME type (e.g., 'image/jpeg')
 * @param {string} [params.prompt='Analisa gambar ini secara detail.'] - Analysis prompt
 * @param {Object} [options] - Additional options
 * @param {string} [options.aiProvider] - Provider override
 * @returns {Promise<string>} Analysis text
 */
async function analyzeImage({ imageBase64, mimeType, prompt }, options = {}) {
  const userPrompt = prompt || 'Analisa gambar ini secara detail.';

  const messages = [
    { role: 'system', content: getSystemPrompt() },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
      ],
    },
  ];

  const result = await generate({
    messages,
    aiProvider: options.aiProvider,
    maxTokens: 2048,
  });

  return result.text;
}

/**
 * Classify the intent of a text message using AI.
 * Used as fallback when rule-based classification is ambiguous.
 * @param {string} text - User's message text
 * @returns {Promise<{intent:string, entities:Object}>}
 */
async function classifyIntent(text) {
  const systemPrompt = [
    'Kamu adalah intent classifier. Klasifikasi pesan user ke salah satu intent:',
    '- SCRAPE: user ingin mencari/scrape data (gambar, paper, dataset, website)',
    '- AI_CHAT: user bertanya atau minta penjelasan',
    '- PAPER_DOWNLOAD: user mau download paper/PDF (ada DOI, arXiv ID, dll)',
    '- IMAGE_ANALYZE: user mau analisa gambar',
    '- GREETING: sapaan/salam',
    '- UNKNOWN: tidak jelas',
    '',
    'Respond HANYA dengan JSON: {"intent":"INTENT_NAME","entities":{"keyword":"...","type":"..."}}',
    'Contoh entities type: images, papers, datasets, general',
  ].join('\n');

  try {
    const result = await chat(text, { systemPrompt, maxTokens: 256 });

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { intent: 'UNKNOWN', entities: {} };
  } catch (err) {
    log.warn('AI intent classification failed', { error: err.message });
    return { intent: 'UNKNOWN', entities: {} };
  }
}

/**
 * Transcribe audio using Whisper (Groq or OpenAI).
 * @param {Object} params
 * @param {string} params.audioBase64 - Base64 encoded audio data
 * @param {string} params.mimeType - Audio MIME type
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio({ audioBase64, mimeType }) {
  const isGroq = !!config.ai.groq.apiKey;
  const isOpenAI = !!config.ai.openai.apiKey;
  
  if (!isGroq && !isOpenAI) {
    throw new Error('No API key configured for audio transcription (Groq or OpenAI required)');
  }

  const apiKey = isGroq ? config.ai.groq.apiKey : config.ai.openai.apiKey;
  const url = isGroq ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions';
  const model = isGroq ? 'whisper-large-v3' : 'whisper-1';

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    
    // Convert to Blob for Node 18+ native FormData
    const blob = new Blob([buffer], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, 'audio.ogg');
    form.append('model', model);

    log.debug(`Transcribing audio via ${isGroq ? 'Groq' : 'OpenAI'} (${buffer.length} bytes)`);

    const response = await axios.post(url, form, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000,
    });

    return response.data.text;
  } catch (err) {
    log.error('Audio transcription failed', { error: err.response?.data?.error?.message || err.message });
    throw new Error('Gagal mentranskripsi pesan suara');
  }
}

module.exports = { generate, chat, summarizeResults, analyzeImage, classifyIntent, transcribeAudio };
