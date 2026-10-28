'use strict';

/**
 * @fileoverview Ollama local/offline LLM provider for AI service layer.
 * Connects to a local or self-hosted Ollama server (default http://localhost:11434)
 * for 100% free, private, quota-free AI inference (e.g. llama3.2, qwen2.5, mistral).
 * @module services/ai/providers/ollama
 */

const httpClient = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../monitor/logger');

const log = createLogger('ai:ollama');

/**
 * Check whether Ollama local provider is enabled in configuration or environment.
 * @param {boolean} [forceEnable=false]
 * @returns {boolean}
 */
function isOllamaEnabled(forceEnable = false) {
  if (forceEnable) return true;
  if (config.ai?.ollama?.enabled) return true;
  if (config.ai?.provider === 'ollama') return true;
  const envEnabled = String(process.env.OLLAMA_ENABLED || '').toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(envEnabled)) return true;
  if (String(process.env.AI_PROVIDER || '').toLowerCase() === 'ollama') return true;
  return false;
}

/**
 * Generate a chat completion from a local Ollama server.
 * @param {Object} params
 * @param {Array<{role:string,content:string|Array}>} params.messages - Chat messages
 * @param {string} [params.model] - Model override (e.g. 'llama3.2', 'qwen2.5:7b')
 * @param {number} [params.temperature=0.7] - Sampling temperature
 * @param {number} [params.maxTokens=2048] - Max tokens to generate
 * @param {boolean} [params.forceEnable=false] - Force execution even if OLLAMA_ENABLED is false
 * @returns {Promise<{text:string, usage:{promptTokens:number,completionTokens:number}|null}>}
 * @throws {Error} With code 'KEY_MISSING' if Ollama is not enabled
 */
async function generate({ messages, model, temperature = 0.7, maxTokens = 2048, forceEnable = false }) {
  if (!isOllamaEnabled(forceEnable)) {
    const err = new Error('Ollama local AI provider is not enabled (set OLLAMA_ENABLED=true)');
    err.code = 'KEY_MISSING';
    throw err;
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL || config.ai?.ollama?.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const modelName = model || process.env.OLLAMA_MODEL || config.ai?.ollama?.model || 'llama3.2';
  const endpoint = `${baseUrl}/api/chat`;

  // Normalize multimodal content arrays to plain strings for text-only Ollama models
  const normalizedMessages = (messages || []).map(m => ({
    role: m.role || 'user',
    content: Array.isArray(m.content)
      ? m.content.map(part => (typeof part === 'string' ? part : part.text || '')).join('\n')
      : String(m.content || ''),
  }));

  try {
    const response = await httpClient.post(
      endpoint,
      {
        model: modelName,
        messages: normalizedMessages,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        maxRetries: 1,
      }
    );

    const data = response.data || {};
    const text = data.message?.content || data.response || '';
    const usage =
      data.prompt_eval_count !== undefined || data.eval_count !== undefined
        ? {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
          }
        : null;

    log.debug('Ollama response received', { model: modelName, tokens: usage });
    return { text, usage };
  } catch (err) {
    log.error('Ollama generate failed', {
      model: modelName,
      endpoint,
      error: err.message,
    });
    throw err;
  }
}

module.exports = { generate, isOllamaEnabled };
