'use strict';

/**
 * @fileoverview Axios-based HTTP client with timeout, retry, and user-agent rotation.
 * @module utils/httpClient
 */

const axios = require('axios');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('utils:http');

/** Pool of realistic user-agent strings for rotation. */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

/**
 * Get a random user-agent string.
 * @returns {string}
 */
function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an axios instance with defaults.
 * @param {Object} [opts] - Override options
 * @returns {import('axios').AxiosInstance}
 */
function createClient(opts = {}) {
  const instance = axios.create({
    timeout: opts.timeout || 30000,
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'application/json, text/plain, */*',
      ...(opts.headers || {}),
    },
    ...opts,
  });

  // Request interceptor: rotate UA on each request
  instance.interceptors.request.use((cfg) => {
    cfg.headers['User-Agent'] = randomUA();
    return cfg;
  });

  return instance;
}

/** Default shared client instance. */
const client = createClient();

/**
 * Perform an HTTP GET with automatic retry and exponential backoff.
 * @param {string} url - Request URL
 * @param {Object} [options] - Axios request config + { maxRetries, signal }
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function get(url, options = {}) {
  const maxRetries = options.maxRetries || 3;
  delete options.maxRetries;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (options.signal && options.signal.aborted) {
        throw new Error('Request cancelled');
      }
      const response = await client.get(url, options);
      return response;
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = !status || status === 429 || status >= 500;

      if (attempt >= maxRetries || !isRetryable) {
        log.error(`HTTP GET failed: ${url}`, {
          status,
          attempt,
          error: err.message,
        });
        throw err;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      log.warn(`Retrying GET ${url} (attempt ${attempt}/${maxRetries}, wait ${delay}ms)`);
      await sleep(delay);
    }
  }
}

/**
 * Perform an HTTP POST with automatic retry and exponential backoff.
 * @param {string} url - Request URL
 * @param {*} data - Request body
 * @param {Object} [options] - Axios request config + { maxRetries, signal }
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function post(url, data, options = {}) {
  const maxRetries = options.maxRetries || 3;
  delete options.maxRetries;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (options.signal && options.signal.aborted) {
        throw new Error('Request cancelled');
      }
      const response = await client.post(url, data, options);
      return response;
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = !status || status === 429 || status >= 500;

      if (attempt >= maxRetries || !isRetryable) {
        log.error(`HTTP POST failed: ${url}`, {
          status,
          attempt,
          error: err.message,
        });
        throw err;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      log.warn(`Retrying POST ${url} (attempt ${attempt}/${maxRetries}, wait ${delay}ms)`);
      await sleep(delay);
    }
  }
}

module.exports = { get, post, createClient, randomUA, sleep };
