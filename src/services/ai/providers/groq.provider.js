'use strict';

/**
 * @fileoverview Groq provider for AI service layer.
 * OpenAI-compatible API format with Groq's endpoint.
 * @module services/ai/providers/groq
 */

const { post, sleep } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../monitor/logger');

const log = createLogger('ai:groq');

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Generate a completion from Groq API.
 * @param {Object} params
 * @param {Array<{role:string,content:string}>} params.messages - Chat messages
 * @param {string} [params.model] - Model override
 * @param {number} [params.temperature=0.7] - Sampling temperature
 * @param {number} [params.maxTokens=2048] - Max tokens to generate
 * @returns {Promise<{text:string, usage:{promptTokens:number,completionTokens:number}|null}>}
 * @throws {Error} With code 'KEY_MISSING' if API key not configured
 */
async function generate({ messages, model, temperature = 0.7, maxTokens = 2048 }) {
  const apiKey = config.ai.groq.apiKey;
  if (!apiKey) {
    const err = new Error('Groq API key not configured');
    err.code = 'KEY_MISSING';
    throw err;
  }

  const modelName = model || config.ai.groq.model;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await post(BASE_URL, {
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
        maxRetries: 1,
      });

      const data = response.data;
      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';
      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
      } : null;

      log.debug('Groq response received', { model: modelName, tokens: usage });
      return { text, usage };
    } catch (err) {
      const status = err.response?.status;

      if (status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10);
        const delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 2000;
        log.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      log.error('Groq generate failed', {
        status,
        attempt,
        error: err.response?.data?.error?.message || err.message,
      });
      throw err;
    }
  }
}

module.exports = { generate };
