'use strict';

/**
 * @fileoverview Paper resolution and PDF download worker.
 * Resolver chain: arXiv → OpenAlex → Unpaywall/EuropePMC → Crossref.
 * Integrates deep PDF text/structure extraction and stores document context in memory.
 * @module jobs/paperWorker
 */

const path = require('path');
const config = require('../config');
const httpClient = require('../utils/httpClient');
const { ensureDir, writeFile } = require('../utils/fsUtil');
const { createLogger } = require('../services/monitor/logger');
const contextMemory = require('../bot/nlp/contextMemory');
const jobStore = require('./jobStore');
const { JOB_STATUS } = require('./jobSchemas');

const log = createLogger('jobs:paper');

/**
 * Parse a paper identifier string into a normalized type and value.
 * @param {string} raw - Raw identifier (DOI, arXiv ID, PMID, PMC, or URL)
 * @returns {{ type: 'doi'|'arxiv'|'pmid'|'pmc'|'url'|'query', value: string }}
 */
function parseIdentifier(raw) {
  if (!raw || typeof raw !== 'string') {
    return { type: 'query', value: '' };
  }

  const trimmed = raw.trim();

  // Direct arXiv URL or ID
  const arxivUrlMatch = trimmed.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i);
  if (arxivUrlMatch) {
    return { type: 'arxiv', value: arxivUrlMatch[1] };
  }

  const arxivPrefixMatch = trimmed.match(/^(?:arxiv[:\s]*)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
  if (arxivPrefixMatch) {
    return { type: 'arxiv', value: arxivPrefixMatch[1] };
  }

  // DOI
  const doiMatch = trimmed.match(/(10\.\d{4,9}\/[^\s]+)/);
  if (doiMatch) {
    return { type: 'doi', value: doiMatch[1].replace(/[.,;]+$/, '') };
  }

  // PMID
  const pmidMatch = trimmed.match(/^PMID[:\s]*(\d+)$/i);
  if (pmidMatch) {
    return { type: 'pmid', value: pmidMatch[1] };
  }

  // PMC
  const pmcMatch = trimmed.match(/^(PMC\d+)$/i);
  if (pmcMatch) {
    return { type: 'pmc', value: pmcMatch[1].toUpperCase() };
  }

  // Direct URL
  if (/^https?:\/\//i.test(trimmed)) {
    return { type: 'url', value: trimmed };
  }

  return { type: 'query', value: trimmed };
}

/**
 * Resolve a parsed identifier to metadata and an open-access PDF URL.
 * @param {{ type: string, value: string }} parsed
 * @returns {Promise<{ pdfUrl: string|null, source: string, metadata: { title?: string, authors?: string, year?: number|null, doi?: string|null } }>}
 */
async function resolvePdf(parsed) {
  const { type, value } = parsed || {};
  if (!value) {
    return { pdfUrl: null, source: 'none', metadata: {} };
  }

  // 1. Direct arXiv resolution
  if (type === 'arxiv') {
    const pdfUrl = `https://arxiv.org/pdf/${value}.pdf`;
    let metadata = { title: `arXiv:${value}`, authors: '', year: null, doi: null };
    try {
      const resp = await httpClient.get(
        `http://export.arxiv.org/api/query?id_list=${encodeURIComponent(value)}`,
        { timeout: 10000, maxRetries: 1 }
      );
      const xml = String(resp.data || '');
      const titleMatch = xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        metadata.title = titleMatch[1].replace(/\s+/g, ' ').trim();
      }
    } catch { /* ignore metadata lookup error */ }
    return { pdfUrl, source: 'arXiv', metadata };
  }

  // 2. Direct URL
  if (type === 'url') {
    return {
      pdfUrl: value,
      source: 'direct-url',
      metadata: { title: path.basename(value) || 'Paper PDF' },
    };
  }

  // 3. PMID / PMC via Europe PMC
  if (type === 'pmid' || type === 'pmc') {
    try {
      const query = type === 'pmid' ? `EXT_ID:${value}` : `PMCID:${value}`;
      const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core`;
      const resp = await httpClient.get(url, { timeout: 15000, maxRetries: 2 });
      const hit = resp.data?.resultList?.result?.[0];
      if (hit) {
        const pmcid = hit.pmcid;
        const pdfUrl = pmcid
          ? `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcid}&blobtype=pdf`
          : null;
        return {
          pdfUrl,
          source: 'EuropePMC',
          metadata: {
            title: hit.title || value,
            authors: hit.authorString || '',
            year: hit.pubYear ? parseInt(hit.pubYear, 10) : null,
            doi: hit.doi || null,
          },
        };
      }
    } catch (err) {
      log.debug('EuropePMC resolution failed', { error: err.message });
    }

    // NCBI E-utilities fallback
    try {
      const db = type === 'pmc' ? 'pmc' : 'pubmed';
      const cleanVal = type === 'pmc' ? value.replace(/^PMC/i, '') : value;
      const apiKey = config.providers.ncbiApiKey;
      const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${db}&id=${encodeURIComponent(cleanVal)}&retmode=json${keyParam}`;
      const resp = await httpClient.get(url, { timeout: 15000, maxRetries: 1 });
      const doc = resp.data?.result?.[cleanVal];
      if (doc) {
        const articleIds = Array.isArray(doc.articleids) ? doc.articleids : [];
        const pmcItem = articleIds.find(i => i.idtype === 'pmc');
        const pmcid = type === 'pmc' ? value : (pmcItem ? pmcItem.value : null);
        const doiItem = articleIds.find(i => i.idtype === 'doi');
        const pdfUrl = pmcid
          ? `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcid}&blobtype=pdf`
          : null;
        return {
          pdfUrl,
          source: 'NCBI/PubMed',
          metadata: {
            title: (doc.title || value).replace(/<[^>]+>/g, '').trim(),
            authors: Array.isArray(doc.authors) ? doc.authors.map(a => a.name).join(', ') : '',
            year: doc.pubdate ? parseInt(doc.pubdate.slice(0, 4), 10) : null,
            doi: doiItem ? doiItem.value : null,
          },
        };
      }
    } catch (err) {
      log.debug('NCBI fallback resolution failed', { error: err.message });
    }
  }

  // 4. DOI via Unpaywall (Gold standard for free Open-Access PDF location)
  if (type === 'doi') {
    try {
      const email = config.providers.unpaywallEmail || config.providers.openalexEmail || config.providers.contactEmail || 'bot@example.com';
      const upUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(value)}?email=${encodeURIComponent(email)}`;
      const resp = await httpClient.get(upUrl, { timeout: 15000, maxRetries: 1 });
      const data = resp.data;
      if (data && (data.is_oa || data.best_oa_location?.url_for_pdf)) {
        const pdfUrl = data.best_oa_location?.url_for_pdf || data.best_oa_location?.url || null;
        if (pdfUrl) {
          const authors = Array.isArray(data.z_authors)
            ? data.z_authors.map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean).join(', ')
            : '';
          return {
            pdfUrl,
            source: 'Unpaywall',
            metadata: {
              title: data.title || value,
              authors,
              year: data.year ? parseInt(data.year, 10) : null,
              doi: value,
            },
          };
        }
      }
    } catch (err) {
      log.debug('Unpaywall resolution failed', { error: err.message });
    }

  // 5. DOI via OpenAlex
    try {
      const oaUrl = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(value)}`;
      const resp = await httpClient.get(oaUrl, { timeout: 15000, maxRetries: 2 });
      const work = resp.data;
      if (work) {
        const pdfUrl =
          work.open_access?.oa_url ||
          work.primary_location?.pdf_url ||
          work.best_oa_location?.pdf_url ||
          null;
        const authors = Array.isArray(work.authorships)
          ? work.authorships.map(a => a.author?.display_name).filter(Boolean).join(', ')
          : '';
        return {
          pdfUrl,
          source: 'OpenAlex',
          metadata: {
            title: work.title || value,
            authors,
            year: work.publication_year || null,
            doi: value,
          },
        };
      }
    } catch (err) {
      log.debug('OpenAlex DOI resolution failed', { error: err.message });
    }

    // 5. Fallback Crossref metadata
    try {
      const crUrl = `https://api.crossref.org/works/${encodeURIComponent(value)}`;
      const resp = await httpClient.get(crUrl, { timeout: 15000, maxRetries: 1 });
      const msg = resp.data?.message;
      if (msg) {
        const pdfLink = Array.isArray(msg.link)
          ? msg.link.find(l => l['content-type'] === 'application/pdf')?.URL || null
          : null;
        return {
          pdfUrl: pdfLink,
          source: 'Crossref',
          metadata: {
            title: Array.isArray(msg.title) ? msg.title[0] : (msg.title || value),
            authors: Array.isArray(msg.author)
              ? msg.author.map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ')
              : '',
            year: msg.issued?.['date-parts']?.[0]?.[0] || null,
            doi: value,
          },
        };
      }
    } catch (err) {
      log.debug('Crossref resolution failed', { error: err.message });
    }
  }

  return {
    pdfUrl: null,
    source: 'unresolved',
    metadata: { title: value },
  };
}

/**
 * Process a DOWNLOAD_PAPER job.
 * @param {Object} job
 * @param {Object} [client]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
async function processPaperJob(job, client, signal) {
  const { jobId, request } = job;
  const rawId = request.identifier || request.keyword;

  await jobStore.updateJob(jobId, {
    status: JOB_STATUS.RUNNING,
    startedAt: new Date().toISOString(),
    progress: { percent: 25, message: `Resolving ${rawId}...` },
  });

  const parsed = parseIdentifier(rawId);
  const resolved = await resolvePdf(parsed);

  if (!resolved.pdfUrl) {
    const failed = await jobStore.updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      completedAt: new Date().toISOString(),
      error: `Open-access PDF not found for ${rawId}`,
      result: {
        items: [resolved.metadata],
        itemCount: 0,
        providerUsed: resolved.source,
        files: [],
        meta: resolved,
      },
    });

    if (client && request.chatId && typeof client.sendMessage === 'function') {
      await client.sendMessage(
        request.chatId,
        `❌ PDF open-access tidak ditemukan untuk \`${rawId}\` (Sumber: ${resolved.source}).`
      );
    }
    return failed;
  }

  // Download PDF binary
  await ensureDir(config.dirs.outputs);
  const safeName = parsed.value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
  const pdfPath = path.join(config.dirs.outputs, `paper_${safeName}_${Date.now()}.pdf`);

  const response = await httpClient.get(resolved.pdfUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
    signal,
  });

  const buffer = Buffer.from(response.data);
  await writeFile(pdfPath, buffer);

  // Extract PDF text & structure for RAG / follow-up Q&A in contextMemory
  let extractedText = '';
  try {
    const pdfLoader = require('../services/pdf/pdfLoader');
    const doc = await pdfLoader.parseBuffer(buffer, { title: resolved.metadata?.title || rawId });
    extractedText = doc.markdown || doc.text || '';
  } catch {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      extractedText = data.text || '';
    } catch { /* ignore PDF parse errors */ }
  }

  if (extractedText && request.userId) {
    contextMemory.store(request.userId, {
      lastDocumentTitle: resolved.metadata?.title || rawId,
      lastDocumentText: extractedText.slice(0, 15000),
    });
  }

  const currentJob = await jobStore.getJob(jobId);
  if ((signal && signal.aborted) || currentJob?.status === JOB_STATUS.CANCELLED) {
    log.info(`Paper job ${jobId} was cancelled before completion, skipping delivery`);
    return currentJob || job;
  }

  const updatedJob = await jobStore.updateJob(jobId, {
    status: JOB_STATUS.COMPLETED,
    completedAt: new Date().toISOString(),
    progress: { percent: 100, message: 'Paper downloaded' },
    result: {
      items: [{ ...resolved.metadata, pdfUrl: resolved.pdfUrl, source: resolved.source }],
      itemCount: 1,
      providerUsed: resolved.source,
      files: [pdfPath],
      meta: resolved,
    },
  });

  if (client && request.chatId && typeof client.sendMessage === 'function') {
    const finalJob = await jobStore.getJob(jobId);
    if ((signal && signal.aborted) || finalJob?.status === JOB_STATUS.CANCELLED) {
      return updatedJob;
    }
    try {
      const { MessageMedia } = require('whatsapp-web.js');
      const media = MessageMedia.fromFilePath(pdfPath);
      await client.sendMessage(request.chatId, media, {
        caption: `📄 *${resolved.metadata?.title || rawId}*\n🔧 Source: ${resolved.source}`,
      });
    } catch (err) {
      log.warn('Failed to send PDF via WhatsApp client', { error: err.message });
    }
  }

  return updatedJob;
}

module.exports = {
  parseIdentifier,
  resolvePdf,
  processPaperJob,
};
