'use strict';

/**
 * @fileoverview OpenAI provider for AI service layer.
 * Supports chat completions and vision (image_url in content).
 * @module services/ai/providers/openai
 */

const { post, sleep } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../monitor/logger');

const log = createLogger('ai:openai');

const BASE_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Generate a completion from OpenAI API.
 * @param {Object} params
 * @param {Array<{role:string,content:string|Array}>} params.messages - Chat messages
 * @param {string} [params.model] - Model override
 * @param {number} [params.temperature=0.7] - Sampling temperature
 * @param {number} [params.maxTokens=2048] - Max tokens to generate
 * @returns {Promise<{text:string, usage:{promptTokens:number,completionTokens:number}|null}>}
 * @throws {Error} With code 'KEY_MISSING' if API key not configured
 */
async function generate({ messages, model, temperature = 0.7, maxTokens = 2048 }) {
  const apiKey = config.ai.openai.apiKey;
  if (!apiKey) {
    const err = new Error('OpenAI API key not configured');
    err.code = 'KEY_MISSING';
    throw err;
  }

  const modelName = model || config.ai.openai.model;
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
        maxRetries: 1, // httpClient retry disabled, we handle retry here
      });

      const data = response.data;
      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';
      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
      } : null;

      log.debug('OpenAI response received', { model: modelName, tokens: usage });
      return { text, usage };
    } catch (err) {
      const status = err.response?.status;

      // Rate limit — retry with backoff
      if (status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10);
        const delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
        log.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      log.error('OpenAI generate failed', {
        status,
        attempt,
        error: err.response?.data?.error?.message || err.message,
      });
      throw err;
    }
  }
}

module.exports = { generate };
