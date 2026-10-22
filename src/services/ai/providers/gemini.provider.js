'use strict';

/**
 * @fileoverview Google Gemini provider for AI service layer.
 * Uses REST API with axios (no SDK).
 * @module services/ai/providers/gemini
 */

const { post, sleep } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../monitor/logger');

const log = createLogger('ai:gemini');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Convert standard messages format to Gemini format.
 * OpenAI format: [{ role: 'user'|'assistant'|'system', content: '...' }]
 * Gemini format: { contents: [{ role: 'user'|'model', parts: [{ text: '...' }] }] }
 * @param {Array<{role:string,content:string|Array}>} messages
 * @returns {{ systemInstruction: Object|undefined, contents: Array }}
 */
function convertMessages(messages) {
  let systemInstruction;
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini uses systemInstruction at top level
      systemInstruction = { parts: [{ text: msg.content }] };
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';

    // Handle vision messages (array content with image_url)
    if (Array.isArray(msg.content)) {
      const parts = msg.content.map(item => {
        if (item.type === 'text') return { text: item.text };
        if (item.type === 'image_url') {
          // Extract base64 data if inline, otherwise use url
          const url = item.image_url?.url || '';
          if (url.startsWith('data:')) {
            const match = url.match(/^data:([\w/]+);base64,(.+)/);
            if (match) {
              return { inlineData: { mimeType: match[1], data: match[2] } };
            }
          }
          return { text: `[Image: ${url}]` };
        }
        return { text: String(item) };
      });
      contents.push({ role, parts });
    } else {
      contents.push({ role, parts: [{ text: String(msg.content) }] });
    }
  }

  return { systemInstruction, contents };
}

/**
 * Generate a completion from Gemini API.
 * @param {Object} params
 * @param {Array<{role:string,content:string|Array}>} params.messages - Chat messages
 * @param {string} [params.model] - Model override
 * @param {number} [params.temperature=0.7] - Sampling temperature
 * @param {number} [params.maxTokens=2048] - Max tokens to generate
 * @returns {Promise<{text:string, usage:{promptTokens:number,completionTokens:number}|null}>}
 * @throws {Error} With code 'KEY_MISSING' if API key not configured
 */
async function generate({ messages, model, temperature = 0.7, maxTokens = 2048 }) {
  const apiKey = config.ai.gemini.apiKey;
  if (!apiKey) {
    const err = new Error('Gemini API key not configured');
    err.code = 'KEY_MISSING';
    throw err;
  }

  const modelName = model || config.ai.gemini.model;
  const url = `${BASE_URL}/models/${modelName}:generateContent?key=${apiKey}`;
  const { systemInstruction, contents } = convertMessages(messages);

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        maxRetries: 1,
      });

      const data = response.data;
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map(p => p.text).join('') || '';
      const usageMeta = data.usageMetadata;
      const usage = usageMeta ? {
        promptTokens: usageMeta.promptTokenCount || 0,
        completionTokens: usageMeta.candidatesTokenCount || 0,
      } : null;

      log.debug('Gemini response received', { model: modelName, tokens: usage });
      return { text, usage };
    } catch (err) {
      const status = err.response?.status;

      if (status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        log.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      log.error('Gemini generate failed', {
        status,
        attempt,
        error: err.response?.data?.error?.message || err.message,
      });
      throw err;
    }
  }
}

module.exports = { generate };
