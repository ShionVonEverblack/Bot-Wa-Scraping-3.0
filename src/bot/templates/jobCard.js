'use strict';

/**
 * @fileoverview Job card template — pretty WhatsApp message formatting for job status.
 * @module bot/templates/jobCard
 */

const { formatDuration } = require('../../utils/time');
const { truncate } = require('../../utils/text');

const STATUS_EMOJI = {
  PENDING: '⏳', RUNNING: '🔄', COMPLETED: '✅', FAILED: '❌', CANCELLED: '🚫',
};

const TYPE_EMOJI = {
  images: '🖼️', papers: '📄', datasets: '📊', general: '🔍',
};

/**
 * Format a job object as a pretty WhatsApp card.
 * @param {Object} job
 * @returns {string}
 */
function formatJobCard(job) {
  const emoji = STATUS_EMOJI[job.status] || '❓';
  const typeEmoji = TYPE_EMOJI[job.request?.scrapeType] || '🔍';
  const elapsed = job.startedAt
    ? formatDuration(new Date(job.completedAt || Date.now()) - new Date(job.startedAt))
    : '-';

  const lines = [
    `╔══ ${emoji} *Job ${job.jobId}* ══╗`,
    '',
    `📝 Keyword: *${truncate(job.request?.keyword || '-', 40)}*`,
    `${typeEmoji} Type: ${job.request?.scrapeType || '-'}`,
    `📋 Status: *${job.status}*`,
  ];

  if (job.progress?.message) lines.push(`📊 Progress: ${job.progress.message}`);
  if (job.result?.itemCount) lines.push(`📦 Results: ${job.result.itemCount} items`);
  if (job.result?.providerUsed) lines.push(`🔧 Provider: ${job.result.providerUsed}`);
  lines.push(`⏱️ Duration: ${elapsed}`);
  if (job.error) lines.push(`\n❌ Error: ${job.error}`);

  lines.push('', `╚${'═'.repeat(26)}╝`);
  return lines.join('\n');
}

/**
 * Format a compact one-line job summary.
 * @param {Object} job
 * @returns {string}
 */
function formatJobLine(job) {
  const emoji = STATUS_EMOJI[job.status] || '❓';
  const keyword = truncate(job.request?.keyword || '-', 20);
  const items = job.result?.itemCount || 0;
  return `${emoji} \`${job.jobId}\` — ${keyword} (${items} items)`;
}

module.exports = { formatJobCard, formatJobLine };
