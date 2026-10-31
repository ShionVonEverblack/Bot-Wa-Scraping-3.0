'use strict';

/**
 * @fileoverview Perplexity-style inline citations formatter and grounded prompt builder.
 * Parses and validates [n] inline citations, renumbers by appearance order,
 * strips hallucinations / out-of-bounds references, and appends a verified sources footer.
 * @module services/ai/citationFormatter
 */

/**
 * Build a structured, numbered context block suitable for LLM RAG prompts.
 * @param {Array<{ title?: string, section?: string, url?: string, rawText?: string, content?: string, snippet?: string, description?: string }>} sources
 * @returns {string}
 */
function buildSourcesBlock(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return '';
  return sources
    .map((s, idx) => {
      const num = idx + 1;
      const citationTag = s.citation || `[${num}]`;
      const headerParts = [];
      if (s.title) headerParts.push(s.title);
      if (s.section && s.section !== 'Main' && s.section !== 'Dokumen Utama') {
        headerParts.push(`Section: ${s.section}`);
      }
      if (s.url) headerParts.push(s.url);
      const header = headerParts.length > 0 ? headerParts.join(' — ') : `Sumber ${num}`;
      const text = s.rawText || s.content || s.snippet || s.description || '';
      return `${citationTag} (${header}):\n${text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Format an LLM answer with Perplexity-style inline citations and verified source footer.
 *
 * @param {string} answer - Raw LLM answer containing inline [n] or [n, m] citations
 * @param {Array<{ title?: string, section?: string, url?: string, rawText?: string, content?: string }>} sources - Sources array matching the [1]..[N] indexes in prompt
 * @param {Object} [options]
 * @param {number} [options.maxSources=5] - Maximum source entries in footer
 * @param {string} [options.header='📚 *Sumber:*'] - Footer header for verified citations
 * @param {string} [options.fallbackHeader='📎 *Konteks yang digunakan:*'] - Footer header when no citations used
 * @returns {{ text: string, used: Array<Object>, invalid: number[] }}
 */
function formatCitations(answer, sources = [], options = {}) {
  const rawAnswer = String(answer || '');
  const validSources = Array.isArray(sources) ? sources : [];
  const maxSources = options.maxSources || 5;
  const header = options.header || '📚 *Sumber:*';
  const fallbackHeader = options.fallbackHeader || '📎 *Konteks yang digunakan:*';

  if (!rawAnswer.trim()) {
    return { text: '', used: [], invalid: [] };
  }

  const citationRegex = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const invalidSet = new Set();
  const seenOriginals = [];
  const origToNew = new Map();

  // First pass: scan all citations, validate ranges, and assign sequential IDs by first appearance
  let match;
  while ((match = citationRegex.exec(rawAnswer)) !== null) {
    const rawNumbers = match[1].split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    for (const num of rawNumbers) {
      if (num >= 1 && num <= validSources.length) {
        if (!origToNew.has(num)) {
          seenOriginals.push(num);
          origToNew.set(num, seenOriginals.length);
        }
      } else {
        invalidSet.add(num);
      }
    }
  }

  const invalid = Array.from(invalidSet).sort((a, b) => a - b);
  const used = seenOriginals.map(origIdx => ({
    ...validSources[origIdx - 1],
    originalIndex: origIdx,
    citationIndex: origToNew.get(origIdx),
  }));

  let cleanedAnswer = rawAnswer.replace(citationRegex, (_m, rawNums) => {
    const rawNumbers = rawNums.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    const validMapped = [];

    for (const n of rawNumbers) {
      if (origToNew.has(n)) {
        const newId = origToNew.get(n);
        if (!validMapped.includes(newId)) {
          validMapped.push(newId);
        }
      }
    }

    if (validMapped.length === 0) {
      return '';
    }

    validMapped.sort((a, b) => a - b);
    return `[${validMapped.join(', ')}]`;
  });

  // Tidy up double spaces and spaces preceding punctuation caused by removed brackets
  cleanedAnswer = cleanedAnswer
    .replace(/[ \t]+\./g, '.')
    .replace(/[ \t]+,/g, ',')
    .replace(/[ \t]+;/g, ';')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // Build footer
  let footer = '';
  if (used.length > 0) {
    const footerLines = [header];
    const limitedUsed = used.slice(0, maxSources);
    for (const s of limitedUsed) {
      const parts = [];
      if (s.title) parts.push(s.title);
      if (s.section && s.section !== 'Main' && s.section !== 'Dokumen Utama') {
        parts.push(`Bagian: ${s.section}`);
      }
      if (s.url) parts.push(s.url);
      const desc = parts.length > 0 ? parts.join(' — ') : `Dokumen #${s.citationIndex}`;
      footerLines.push(`*[${s.citationIndex}]* ${desc}`);
    }
    if (used.length > maxSources) {
      footerLines.push(`_... dan ${used.length - maxSources} sumber lainnya_`);
    }
    footer = footerLines.join('\n');
  } else if (validSources.length > 0) {
    // Fallback: list top sources as context used
    const fallbackLines = [fallbackHeader];
    const topSources = validSources.slice(0, Math.min(3, maxSources));
    for (const s of topSources) {
      const parts = [];
      if (s.title) parts.push(s.title);
      if (s.url) parts.push(s.url);
      else if (s.section && s.section !== 'Main') parts.push(s.section);
      const desc = parts.length > 0 ? parts.join(' — ') : 'Dokumen pendukung';
      fallbackLines.push(`• ${desc}`);
    }
    footer = fallbackLines.join('\n');
  }

  const finalFormatted = footer ? `${cleanedAnswer}\n\n${footer}` : cleanedAnswer;

  return {
    text: finalFormatted,
    used,
    invalid,
  };
}

module.exports = {
  buildSourcesBlock,
  formatCitations,
};
