'use strict';

/**
 * @fileoverview Centralized configuration parser for Bot Scraping WhatsApp 3.0.
 * Parses ALL environment variables into a frozen config object.
 * @module config
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert env string to boolean.
 * @param {string} val - The env value
 * @param {boolean} [fallback=false] - Default if undefined
 * @returns {boolean}
 */
function toBool(val, fallback = false) {
  if (val === undefined || val === null || val === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(val).toLowerCase());
}

/**
 * Convert env string to integer.
 * @param {string} val - The env value
 * @param {number} fallback - Default if undefined or NaN
 * @returns {number}
 */
function toInt(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Parse comma-separated list from env.
 * @param {string} val - The env value
 * @returns {string[]}
 */
function parseList(val) {
  if (!val || typeof val !== 'string') return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse priority list (comma-separated, order matters).
 * @param {string} val - The env value
 * @param {string[]} fallback - Default list
 * @returns {string[]}
 */
function parsePriorityList(val, fallback = []) {
  const list = parseList(val);
  return list.length > 0 ? list : fallback;
}

// ─── Build Config ───────────────────────────────────────────────────────────

const env = process.env;

const config = {
  // --- Runtime ---
  nodeEnv: env.NODE_ENV || 'development',
  botName: env.BOT_NAME || 'Rima',
  sessionName: env.SESSION_NAME || 'rima-session',
  logLevel: env.LOG_LEVEL || 'info',

  dirs: {
    auth: env.DIR_AUTH || './auth',
    cache: env.DIR_CACHE || './cache',
    jobs: env.DIR_JOBS || './jobs',
    outputs: env.DIR_OUTPUTS || './outputs',
    reports: env.DIR_REPORTS || './reports',
    watches: env.DIR_WATCHES || './watches',
    templates: env.DIR_TEMPLATES || './templates',
  },

  // --- Group ---
  group: {
    requireMention: toBool(env.GROUP_REQUIRE_MENTION, true),
    allowCommands: toBool(env.GROUP_ALLOW_COMMANDS, true),
    allowList: parseList(env.ALLOW_LIST),
    denyList: parseList(env.DENY_LIST),
    adminPhones: parseList(env.ADMIN_PHONES),
  },

  // --- Limits ---
  limits: {
    userCooldownMs: toInt(env.USER_COOLDOWN_MS, 3000),
    maxConcurrency: toInt(env.MAX_CONCURRENCY, 3),
    jobTimeoutMs: toInt(env.JOB_TIMEOUT_MS, 120000),
    resultLimitDefault: toInt(env.RESULT_LIMIT_DEFAULT, 10),
    resultLimitMax: toInt(env.RESULT_LIMIT_MAX, 50),
  },

  // --- AI ---
  ai: {
    provider: (env.AI_PROVIDER || 'openai').toLowerCase(),
    fallbackOrder: parsePriorityList(env.AI_FALLBACK_ORDER, ['openai', 'gemini', 'groq', 'grok']),
    autoSummary: toBool(env.AUTO_SUMMARY, false),
    summaryMaxItems: toInt(env.AI_SUMMARY_MAX_ITEMS, 20),

    openai: {
      apiKey: env.OPENAI_API_KEY || '',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY || '',
      model: env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    groq: {
      apiKey: env.GROQ_API_KEY || '',
      model: env.GROQ_MODEL || 'llama3-70b-8192',
    },
    grok: {
      apiKey: env.GROK_API_KEY || '',
      model: env.GROK_MODEL || 'grok-4',
    },
  },

  // --- Providers ---
  providers: {
    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY || '',
    pexelsApiKey: env.PEXELS_API_KEY || '',
    pixabayApiKey: env.PIXABAY_API_KEY || '',
    kaggleUsername: env.KAGGLE_USERNAME || '',
    kaggleKey: env.KAGGLE_KEY || '',
    s2ApiKey: env.S2_API_KEY || '',
    contactEmail: env.CONTACT_EMAIL || '',
    wikipediaLang: env.WIKIPEDIA_LANG || 'en',
    githubToken: env.GITHUB_TOKEN || '',
    stackexchangeSite: env.STACKEXCHANGE_SITE || 'stackoverflow',
    stackexchangeKey: env.STACKEXCHANGE_KEY || '',
    youtubeApiKey: env.YOUTUBE_API_KEY || '',
    coreApiKey: env.CORE_API_KEY || '',
    openalexEmail: env.OPENALEX_EMAIL || '',
    crossrefMailto: env.CROSSREF_MAILTO || '',
  },

  // --- Puppeteer ---
  puppeteer: {
    braveExecutable: env.BRAVE_EXECUTABLE || '',
    headless: toBool(env.PUPPETEER_HEADLESS, false),
    maxPages: toInt(env.PUPPETEER_MAX_PAGES, 3),
  },

  // --- Cache ---
  cache: {
    ttlSeconds: toInt(env.CACHE_TTL_SECONDS, 300),
    cbFailureThreshold: toInt(env.CB_FAILURE_THRESHOLD, 5),
    cbResetTimeoutMs: toInt(env.CB_RESET_TIMEOUT_MS, 60000),
  },

  // --- Output ---
  output: {
    formatDefault: env.OUTPUT_FORMAT_DEFAULT || 'json',
    zipThresholdBytes: toInt(env.ZIP_THRESHOLD_BYTES, 5242880),
    zipFileCountThreshold: toInt(env.ZIP_FILE_COUNT_THRESHOLD, 5),
  },
};

// Freeze to prevent accidental mutation
Object.freeze(config);
Object.freeze(config.dirs);
Object.freeze(config.group);
Object.freeze(config.limits);
Object.freeze(config.ai);
Object.freeze(config.ai.openai);
Object.freeze(config.ai.gemini);
Object.freeze(config.ai.groq);
Object.freeze(config.ai.grok);
Object.freeze(config.providers);
Object.freeze(config.puppeteer);
Object.freeze(config.cache);
Object.freeze(config.output);

module.exports = config;
