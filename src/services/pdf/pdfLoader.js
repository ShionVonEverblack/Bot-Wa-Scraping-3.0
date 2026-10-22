'use strict';

/**
 * @fileoverview Deep Layout-Aware PDF Loader & Structure Extractor.
 * Inspired by opendataloader-project/opendataloader-pdf.
 * Reconstructs reading order, detects academic/document section hierarchies,
 * converts tabular blocks into GitHub-Flavored Markdown tables, strips page
 * headers/footers, and provides an optional bridge to opendataloader-pdf CLI.
 * @module services/pdf/pdfLoader
 */

const fs = require('fs');
const zlib = require('zlib');
const { execFile } = require('child_process');
const config = require('../../config');
const { createLogger } = require('../monitor/logger');

const log = createLogger('services:pdf');

/** Common academic/report section heading names. */
const ACADEMIC_HEADINGS = new Set([
  'abstract',
  'abstrak',
  'introduction',
  'pendahuluan',
  'background',
  'latar belakang',
  'related work',
  'literature review',
  'tinjauan pustaka',
  'methodology',
  'methods',
  'metodologi',
  'metode penelitian',
  'experimental setup',
  'experiments',
  'implementation',
  'results',
  'results and discussion',
  'hasil dan pembahasan',
  'discussion',
  'pembahasan',
  'evaluation',
  'conclusion',
  'conclusions',
  'kesimpulan',
  'future work',
  'acknowledgments',
  'acknowledgements',
  'references',
  'daftar pustaka',
  'appendix',
]);

/**
 * Unescape PDF literal string escapes: \(, \), \\, \n, \r, \t, and octal \ddd.
 * @param {string} raw
 * @returns {string}
 */
function unescapePdfString(raw) {
  return raw
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

/**
 * Native Node.js fallback extractor for binary `%PDF-` buffers when pdfjs-dist worker
 * cannot initialize (e.g. inside Jest VM without --experimental-vm-modules).
 * Supports uncompressed and FlateDecode streams, BT..ET text blocks, Tj and TJ arrays.
 * @param {Buffer} buffer
 * @returns {{ text: string, pageCount: number, info: Object }}
 */
function extractPdfTextNative(buffer) {
  const rawLatin1 = buffer.toString('latin1');
  const pageMatches = rawLatin1.match(/\/Type\s*\/Page\b(?!s)/g);
  const pageCount = pageMatches ? pageMatches.length : 1;

  const info = {};
  const titleMatch = rawLatin1.match(/\/Title\s*\(([^)]*)\)/);
  if (titleMatch) {
    info.Title = unescapePdfString(titleMatch[1]).trim();
  }

  const extractedLines = [];
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const dict = match[1] || '';
    const streamBodyLatin1 = match[2] || '';
    let content = streamBodyLatin1;

    if (/\/FlateDecode\b/.test(dict)) {
      const rawBytes = Buffer.from(streamBodyLatin1, 'latin1');
      try {
        content = zlib.inflateSync(rawBytes).toString('latin1');
      } catch {
        try {
          content = zlib.inflateRawSync(rawBytes).toString('latin1');
        } catch {
          continue;
        }
      }
    }

    // Parse BT ... ET text blocks or fallback to stream-level Tj/TJ operators
    const btBlocks = content.match(/BT[\s\S]*?ET/g) || [content];
    for (const block of btBlocks) {
      const blockLines = [];
      let currentLine = '';

      // Match TJ arrays, Tj literals, or line positioning operators
      const tokenRegex = /\[((?:[^[\]]|\([^)]*\))*)\]\s*TJ|\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")|\b(?:Td|TD|T\*)\b/g;
      let tok;
      while ((tok = tokenRegex.exec(block)) !== null) {
        const full = tok[0];
        if (/^(?:Td|TD|T\*)$/.test(full)) {
          if (currentLine.trim()) {
            blockLines.push(currentLine.trim());
            currentLine = '';
          }
        } else if (tok[1] !== undefined) {
          // TJ array: [(Hello ) -120 (World)]
          const strParts = [];
          const litRegex = /\(((?:\\.|[^\\)])*)\)/g;
          let lit;
          while ((lit = litRegex.exec(tok[1])) !== null) {
            strParts.push(unescapePdfString(lit[1]));
          }
          currentLine += strParts.join('');
        } else {
          // Tj / ' / " literal
          const litMatch = full.match(/^\(((?:\\.|[^\\)])*)\)/);
          if (litMatch) {
            const decoded = unescapePdfString(litMatch[1]);
            if (currentLine && !currentLine.endsWith(' ') && !decoded.startsWith(' ')) {
              blockLines.push(currentLine.trim());
              currentLine = decoded;
            } else {
              currentLine += decoded;
            }
          }
        }
      }

      if (currentLine.trim()) {
        blockLines.push(currentLine.trim());
      }
      if (blockLines.length > 0) {
        extractedLines.push(blockLines.join('\n'));
      }
    }
  }

  return {
    text: extractedLines.join('\n').trim(),
    pageCount,
    info,
  };
}

/**
 * Detect whether a line is a section heading and return its level + clean title.
 * @param {string} line
 * @returns {{ level: number, title: string }|null}
 */
function detectHeading(line) {
  const trimmed = (line || '').trim();
  if (!trimmed || trimmed.length > 100) return null;

  // Already Markdown heading
  const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (mdMatch) {
    return { level: mdMatch[1].length, title: mdMatch[2].trim() };
  }

  // Numbered heading: "1. Introduction", "2.1. System Architecture", "III. Results"
  const numMatch = trimmed.match(/^((?:\d+\.)+\d*|[IVX]{1,5}\.)\s+([A-Z][A-Za-z0-9\s,:()/-]{2,80})$/);
  if (numMatch) {
    const dots = (numMatch[1].match(/\./g) || []).length;
    const level = Math.min(4, Math.max(2, dots + 1));
    return { level, title: `${numMatch[1]} ${numMatch[2].trim()}` };
  }

  // Canonical academic heading
  const cleanedLower = trimmed.replace(/^[:.\-\d\s]+|[:.\s]+$/g, '').toLowerCase();
  if (ACADEMIC_HEADINGS.has(cleanedLower)) {
    return { level: 2, title: trimmed.replace(/[:.]+$/, '') };
  }

  // Short ALL-CAPS heading (at least 4 letters, no trailing period)
  if (
    trimmed.length >= 4 &&
    trimmed.length <= 60 &&
    /^[A-Z0-9\s,&/-]+$/.test(trimmed) &&
    /[A-Z]{3,}/.test(trimmed) &&
    !/^\d+$/.test(trimmed)
  ) {
    return { level: 2, title: trimmed };
  }

  return null;
}

/**
 * Convert a group of aligned tabular text lines into a Markdown table.
 * @param {string[]} lines
 * @returns {string}
 */
function convertLinesToMarkdownTable(lines) {
  const rows = lines
    .map(l => {
      if (l.includes('\t')) return l.split('\t').map(c => c.trim()).filter(Boolean);
      if (l.includes('|')) return l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      return l.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
    })
    .filter(r => r.length >= 2);

  if (rows.length < 2) return lines.join('\n');

  const colCount = Math.max(...rows.map(r => r.length));
  const formatRow = (r) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push('');
    return `| ${padded.map(c => c.replace(/\|/g, '\\|')).join(' | ')} |`;
  };

  const header = formatRow(rows[0]);
  const sep = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const body = rows.slice(1).map(formatRow);
  return [header, sep, ...body].join('\n');
}

/**
 * Extract structured layout (sections, tables, reading-order paragraphs, clean Markdown)
 * from raw PDF text (opendataloader-pdf style).
 * @param {string} rawText
 * @param {Object} [options]
 * @param {string} [options.title]
 * @returns {{
 *   title: string,
 *   sections: Array<{ heading: string, level: number, content: string, wordCount: number, page: number, bbox: { x: number, y: number, width: number, height: number } }>,
 *   tables: string[],
 *   markdown: string,
 *   text: string,
 *   wordCount: number
 * }}
 */
function extractLayoutStructure(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      title: options.title || 'Untitled Document',
      sections: [],
      tables: [],
      markdown: '',
      text: '',
      wordCount: 0,
    };
  }

  // 1. De-hyphenate words split across line breaks and normalize line endings
  const dehyphenated = rawText
    .replace(/\r\n/g, '\n')
    .replace(/([a-zA-Z])-\n([a-z])/g, '$1$2');

  const rawLines = dehyphenated.split('\n');

  // 2. Remove standalone page markers ("-- 1 of 10 --", "Page 3", standalone numbers)
  const cleanedLines = rawLines.filter(line => {
    const t = line.trim();
    if (!t) return true;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(t)) return false;
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(t)) return false;
    if (/^\d{1,3}$/.test(t)) return false;
    return true;
  });

  // 3. Detect title if not provided (first non-empty line)
  let detectedTitle = options.title || '';
  for (const l of cleanedLines) {
    if (l.trim().length > 4) {
      if (!detectedTitle) detectedTitle = l.trim().slice(0, 140);
      break;
    }
  }
  if (!detectedTitle) detectedTitle = 'Untitled Document';

  // 4. Segment into sections & detect tabular blocks with reading-order coordinate estimation
  const sections = [];
  const tables = [];
  let currentSection = {
    heading: 'Overview',
    level: 2,
    lines: [],
    startLine: 0,
  };

  let tableBuffer = [];
  const flushTableBuffer = () => {
    if (tableBuffer.length >= 2) {
      const mdTable = convertLinesToMarkdownTable(tableBuffer);
      tables.push(mdTable);
      currentSection.lines.push(`\n${mdTable}\n`);
    } else if (tableBuffer.length === 1) {
      currentSection.lines.push(tableBuffer[0]);
    }
    tableBuffer = [];
  };

  const pushCompletedSection = (sec, endLineIdx) => {
    const content = sec.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!content) return;
    const page = Math.max(1, Math.floor(sec.startLine / 45) + 1);
    const lineSpan = Math.max(1, endLineIdx - sec.startLine);
    const y = 72 + ((sec.startLine % 45) * 14);
    const height = Math.min(648, lineSpan * 14);
    sections.push({
      heading: sec.heading,
      level: sec.level,
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      page,
      bbox: { x: 72, y, width: 468, height },
    });
  };

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    const trimmed = line.trim();

    // Check if line looks like a multi-column table row (tabs or 2+ spaces between 2+ tokens)
    const isTabularRow =
      trimmed.length > 0 &&
      trimmed.length < 160 &&
      ((trimmed.match(/\t/g) || []).length >= 1 ||
        (trimmed.split(/\s{2,}/).filter(Boolean).length >= 3 && !/[.?!]$/.test(trimmed)));

    if (isTabularRow) {
      tableBuffer.push(trimmed);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTableBuffer();
    }

    const heading = detectHeading(trimmed);
    if (heading) {
      if (currentSection.lines.join('').trim().length > 0) {
        pushCompletedSection(currentSection, i);
      }
      currentSection = {
        heading: heading.title,
        level: heading.level,
        lines: [],
        startLine: i,
      };
    } else {
      currentSection.lines.push(trimmed);
    }
  }

  flushTableBuffer();

  if (currentSection.lines.join('').trim().length > 0) {
    pushCompletedSection(currentSection, cleanedLines.length);
  }

  // 5. Render structured Markdown
  const mdParts = [`# ${detectedTitle}`];
  for (const sec of sections) {
    mdParts.push(`${'#'.repeat(sec.level)} ${sec.heading}\n\n${sec.content}`);
  }
  const markdown = mdParts.join('\n\n').trim();
  const text = sections.map(s => `${s.heading}\n${s.content}`).join('\n\n').trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    title: detectedTitle,
    sections,
    tables,
    markdown,
    text,
    wordCount,
  };
}

/**
 * Check if a Buffer or Uint8Array starts with a PDF magic header (`%PDF-`).
 * @param {Buffer|Uint8Array} buf
 * @returns {boolean}
 */
function isBinaryPdfBuffer(buf) {
  if (!buf || buf.length < 5) return false;
  const headerSlice = Buffer.isBuffer(buf)
    ? buf.subarray(0, Math.min(1024, buf.length)).toString('latin1')
    : Buffer.from(buf.subarray(0, Math.min(1024, buf.length))).toString('latin1');
  return headerSlice.includes('%PDF-');
}

/**
 * Parse a PDF Buffer into structured sections, tables, and LLM-ready Markdown.
 * Supports pdf-parse v2 (`PDFParse` class), v1 function export, native PDF stream
 * extraction fallback (when VM dynamic import is unavailable), and plain-text fast path.
 * @param {Buffer|Uint8Array} buffer
 * @param {Object} [options]
 * @param {string} [options.title]
 * @returns {Promise<Object>}
 */
async function parseBuffer(buffer, options = {}) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF buffer');
  }

  const normalizedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let rawText = '';
  let pageCount = 0;
  let info = {};
  const extractedTables = [];

  if (!isBinaryPdfBuffer(normalizedBuffer)) {
    // Fast-path for plain-text / Markdown buffers passed to parseBuffer
    rawText = normalizedBuffer.toString('utf-8');
    pageCount = 1;
  } else {
    try {
      const pdfParseModule = require('pdf-parse');
      if (typeof pdfParseModule.PDFParse === 'function') {
        // pdf-parse v2 API
        const parser = new pdfParseModule.PDFParse({ data: normalizedBuffer });
        try {
          const textResult = await parser.getText({ parseHyperlinks: true });
          rawText = textResult?.text || '';
          pageCount = textResult?.total || (textResult?.pages ? textResult.pages.length : 0);

          try {
            const tableResult = await parser.getTable();
            if (tableResult?.pages) {
              for (const p of tableResult.pages) {
                for (const t of p.tables || []) {
                  if (Array.isArray(t) && t.length > 0) {
                    const lines = t.map(row => (Array.isArray(row) ? row.join('\t') : String(row)));
                    extractedTables.push(convertLinesToMarkdownTable(lines));
                  }
                }
              }
            }
          } catch { /* table vector extraction is optional */ }
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {});
          }
        }
      } else if (typeof pdfParseModule === 'function') {
        // pdf-parse v1 API
        const res = await pdfParseModule(normalizedBuffer);
        rawText = res.text || '';
        pageCount = res.numpages || 0;
        info = res.info || {};
      }
    } catch (err) {
      log.debug('pdf-parse worker failed, using native PDF stream extractor fallback', { error: err.message });
      const nativeRes = extractPdfTextNative(normalizedBuffer);
      rawText = nativeRes.text;
      pageCount = nativeRes.pageCount;
      info = nativeRes.info;
    }

    // If pdf-parse returned empty text on a valid binary PDF, try native stream extraction
    if (!rawText.trim()) {
      const nativeRes = extractPdfTextNative(normalizedBuffer);
      if (nativeRes.text) {
        rawText = nativeRes.text;
        pageCount = pageCount || nativeRes.pageCount;
        info = { ...nativeRes.info, ...info };
      }
    }
  }

  const layout = extractLayoutStructure(rawText, {
    title: options.title || info?.Title,
  });

  if (extractedTables.length > 0) {
    layout.tables.push(...extractedTables);
  }

  return {
    ...layout,
    pageCount,
    metadata: info,
  };
}

/**
 * Parse a PDF file from disk. Optionally uses `opendataloader-pdf` CLI if requested & installed.
 * @param {string} filePath
 * @param {Object} [options]
 * @param {boolean} [options.useCliBridge]
 * @returns {Promise<Object>}
 */
async function parseFile(filePath, options = {}) {
  const useCliBridge = options.useCliBridge ?? config.rag?.usePdfCliBridge ?? false;
  if (useCliBridge) {
    try {
      const cliOutput = await new Promise((resolve, reject) => {
        execFile('opendataloader-pdf', [filePath, '--format', 'markdown'], { timeout: 30000 }, (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });
      if (cliOutput && cliOutput.trim()) {
        return {
          ...extractLayoutStructure(cliOutput, options),
          bridgeUsed: 'opendataloader-pdf-cli',
        };
      }
    } catch (err) {
      log.debug('opendataloader-pdf CLI not available, using native Node.js PDF loader', { error: err.message });
    }
  }

  const buffer = await fs.promises.readFile(filePath);
  return parseBuffer(buffer, options);
}

module.exports = {
  parseBuffer,
  parseFile,
  parsePdfFile: parseFile,
  extractLayoutStructure,
  extractPdfTextNative,
  detectHeading,
  convertLinesToMarkdownTable,
};
