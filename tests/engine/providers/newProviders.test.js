'use strict';

/**
 * @fileoverview Unit and integration tests for the 8 new data providers and paperWorker integration.
 * Covers: unpaywall, pubmed, dblp, github, paperswithcode, gutendex, openlibrary, hackernews.
 */

const httpClient = require('../../../src/utils/httpClient');
const providerRegistry = require('../../../src/engine/providers');
const { normalizeType } = require('../../../src/utils/validators');
const { extractEntities } = require('../../../src/bot/nlp/entityExtractor');
const paperWorker = require('../../../src/jobs/paperWorker');

describe('New Providers Integration & Unit Tests', () => {
  let getSpy;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (getSpy && typeof getSpy.mockRestore === 'function') {
      getSpy.mockRestore();
    }
  });

  describe('Type Validation & Entity Extraction', () => {
    test('normalizeType recognizes new code aliases', () => {
      expect(normalizeType('code')).toBe('code');
      expect(normalizeType('repo')).toBe('code');
      expect(normalizeType('kode')).toBe('code');
      expect(normalizeType('github')).toBe('code');
      expect(normalizeType('repository')).toBe('code');
    });

    test('extractEntities recognizes code, book, and forum keywords', () => {
      expect(extractEntities('cari repo llama')).toEqual(expect.objectContaining({ type: 'code', keyword: 'llama' }));
      expect(extractEntities('carikan buku dune')).toEqual(expect.objectContaining({ type: 'books', keyword: 'dune' }));
      expect(extractEntities('cari forum teknologi')).toEqual(expect.objectContaining({ type: 'forums', keyword: 'teknologi' }));
    });
  });

  describe('Registry Discovery', () => {
    test('loads all 8 new providers into registry', () => {
      const codeProviders = providerRegistry.getByType('code');
      expect(codeProviders.map(p => p.id)).toEqual(expect.arrayContaining(['github', 'paperswithcode']));

      const paperProviders = providerRegistry.getByType('papers');
      expect(paperProviders.map(p => p.id)).toEqual(expect.arrayContaining(['unpaywall', 'pubmed', 'dblp']));

      const bookProviders = providerRegistry.getByType('books');
      expect(bookProviders.map(p => p.id)).toEqual(expect.arrayContaining(['gutendex', 'openlibrary']));

      const forumProviders = providerRegistry.getByType('forums');
      expect(forumProviders.map(p => p.id)).toEqual(expect.arrayContaining(['hackernews']));
    });
  });

  describe('Unpaywall Provider', () => {
    const unpaywall = require('../../../src/engine/providers/papers/unpaywall.provider');

    test('resolves direct DOI with Open Access PDF', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          doi: '10.1038/nature12373',
          title: 'Direct Reprogramming of Somatic Cells',
          is_oa: true,
          oa_status: 'gold',
          journal_name: 'Nature',
          year: 2021,
          best_oa_location: {
            url_for_pdf: 'https://nature.com/articles/nature12373.pdf',
            license: 'cc-by',
          },
          z_authors: [{ given: 'Shinya', family: 'Yamanaka' }],
        },
      });

      const res = await unpaywall.scrape({ keyword: '10.1038/nature12373' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Direct Reprogramming of Somatic Cells');
      expect(res.items[0].pdfUrl).toBe('https://nature.com/articles/nature12373.pdf');
      expect(res.items[0].isOpenAccess).toBe(true);
      expect(res.items[0].authors).toBe('Shinya Yamanaka');
    });

    test('searches Open Access papers for general query', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          results: [
            {
              title: 'Attention Is All You Need',
              doi: 'https://doi.org/10.48550/arxiv.1706.03762',
              publication_year: 2017,
              cited_by_count: 95000,
              best_oa_location: {
                pdf_url: 'https://arxiv.org/pdf/1706.03762.pdf',
              },
              authorships: [{ author: { display_name: 'Ashish Vaswani' } }],
            },
          ],
          meta: { count: 1 },
        },
      });

      const res = await unpaywall.scrape({ keyword: 'transformer attention' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Attention Is All You Need');
      expect(res.items[0].pdfUrl).toBe('https://arxiv.org/pdf/1706.03762.pdf');
    });
  });

  describe('PubMed Provider', () => {
    const pubmed = require('../../../src/engine/providers/papers/pubmed.provider');

    test('searches citations and extracts PMCID with PDF link', async () => {
      getSpy = jest.spyOn(httpClient, 'get')
        .mockResolvedValueOnce({
          data: {
            esearchresult: { idlist: ['32081636'], count: '1' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            result: {
              uids: ['32081636'],
              '32081636': {
                title: 'Clinical characteristics of COVID-19',
                source: 'New England Journal of Medicine',
                pubdate: '2020 Feb 28',
                authors: [{ name: 'Guan WJ' }, { name: 'Ni ZY' }],
                articleids: [
                  { idtype: 'pubmed', value: '32081636' },
                  { idtype: 'doi', value: '10.1056/NEJMoa2002032' },
                  { idtype: 'pmc', value: 'PMC7092819' },
                ],
              },
            },
          },
        });

      const res = await pubmed.scrape({ keyword: 'COVID-19 NEJM' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Clinical characteristics of COVID-19');
      expect(res.items[0].pmcId).toBe('PMC7092819');
      expect(res.items[0].pdfUrl).toContain('PMC7092819');
      expect(res.items[0].isOpenAccess).toBe(true);
    });
  });

  describe('DBLP Provider', () => {
    const dblp = require('../../../src/engine/providers/papers/dblp.provider');

    test('searches computer science publications', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          result: {
            hits: {
              '@total': '1',
              hit: [
                {
                  '@id': '100',
                  info: {
                    title: 'Deep Residual Learning for Image Recognition.',
                    venue: 'CVPR',
                    year: '2016',
                    doi: '10.1109/CVPR.2016.90',
                    ee: 'https://doi.org/10.1109/CVPR.2016.90',
                    authors: {
                      author: [{ text: 'Kaiming He' }, { text: 'Xiangyu Zhang' }],
                    },
                  },
                },
              ],
            },
          },
        },
      });

      const res = await dblp.scrape({ keyword: 'ResNet' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Deep Residual Learning for Image Recognition');
      expect(res.items[0].authors).toContain('Kaiming He');
      expect(res.items[0].year).toBe(2016);
    });
  });

  describe('GitHub Provider', () => {
    const github = require('../../../src/engine/providers/code/github.provider');

    test('searches open-source code repositories', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          total_count: 1,
          items: [
            {
              name: 'transformers',
              full_name: 'huggingface/transformers',
              html_url: 'https://github.com/huggingface/transformers',
              description: 'State-of-the-art Machine Learning for Pytorch, TensorFlow, and JAX.',
              stargazers_count: 135000,
              forks_count: 26000,
              language: 'Python',
              owner: { login: 'huggingface' },
              license: { spdx_id: 'Apache-2.0' },
              topics: ['nlp', 'deep-learning'],
            },
          ],
        },
      });

      const res = await github.scrape({ keyword: 'transformers' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('huggingface/transformers');
      expect(res.items[0].stars).toBe(135000);
      expect(res.items[0].language).toBe('Python');
      expect(res.items[0].source).toBe('github');
    });
  });

  describe('Papers With Code Provider', () => {
    const pwc = require('../../../src/engine/providers/code/paperswithcode.provider');

    test('searches ML papers with code repositories', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          count: 1,
          results: [
            {
              id: 'yolo-v4',
              title: 'YOLOv4: Optimal Speed and Accuracy of Object Detection',
              abstract: 'There are a huge number of features which are said to improve Convolutional Neural Network (CNN) accuracy.',
              authors: ['Alexey Bochkovskiy', 'Chien-Yao Wang'],
              arxiv_id: '2004.10934',
              url_abs: 'https://arxiv.org/abs/2004.10934',
              url_pdf: 'https://arxiv.org/pdf/2004.10934.pdf',
              published: '2020-04-23',
            },
          ],
        },
      });

      const res = await pwc.scrape({ keyword: 'yolov4' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toContain('YOLOv4');
      expect(res.items[0].pdfUrl).toBe('https://arxiv.org/pdf/2004.10934.pdf');
      expect(res.items[0].source).toBe('paperswithcode');
    });
  });

  describe('Gutendex Provider', () => {
    const gutendex = require('../../../src/engine/providers/books/gutendex.provider');

    test('searches public domain books with direct download links', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          count: 1,
          results: [
            {
              id: 84,
              title: 'Frankenstein; Or, The Modern Prometheus',
              authors: [{ name: 'Shelley, Mary Wollstonecraft' }],
              download_count: 65000,
              languages: ['en'],
              subjects: ['Monsters -- Fiction', 'Science fiction'],
              formats: {
                'text/html': 'https://www.gutenberg.org/ebooks/84.html.images',
                'application/epub+zip': 'https://www.gutenberg.org/ebooks/84.epub3.images',
                'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/84.txt.utf-8',
              },
            },
          ],
        },
      });

      const res = await gutendex.scrape({ keyword: 'frankenstein' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Frankenstein; Or, The Modern Prometheus');
      expect(res.items[0].textUrl).toContain('84.txt');
      expect(res.items[0].epubUrl).toContain('84.epub');
      expect(res.items[0].isOpenAccess).toBe(true);
    });
  });

  describe('Open Library Provider', () => {
    const openlibrary = require('../../../src/engine/providers/books/openlibrary.provider');

    test('searches books catalog with authors, year, and cover', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          numFound: 1,
          docs: [
            {
              key: '/works/OL27479W',
              title: 'The Hobbit',
              author_name: ['J.R.R. Tolkien'],
              first_publish_year: 1937,
              isbn: ['9780547928227'],
              cover_i: 8432047,
              has_fulltext: true,
            },
          ],
        },
      });

      const res = await openlibrary.scrape({ keyword: 'hobbit' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('The Hobbit');
      expect(res.items[0].authors).toBe('J.R.R. Tolkien');
      expect(res.items[0].coverUrl).toContain('8432047-M.jpg');
    });
  });

  describe('Hacker News Provider', () => {
    const hackernews = require('../../../src/engine/providers/forums/hackernews.provider');

    test('searches tech articles with points, author, and comments', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          nbHits: 1,
          hits: [
            {
              objectID: '34567890',
              title: 'Show HN: A new open source AI framework',
              url: 'https://github.com/example/ai-framework',
              points: 420,
              num_comments: 115,
              author: 'developer123',
              created_at: '2026-03-15T12:00:00Z',
            },
          ],
        },
      });

      const res = await hackernews.scrape({ keyword: 'open source AI' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Show HN: A new open source AI framework');
      expect(res.items[0].points).toBe(420);
      expect(res.items[0].comments).toBe(115);
      expect(res.items[0].author).toBe('developer123');
    });
  });

  describe('PaperWorker Resolver Chain with Unpaywall & PubMed', () => {
    test('resolves DOI via Unpaywall when OA PDF is available', async () => {
      getSpy = jest.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          doi: '10.1038/s41586-020-2649-2',
          title: 'Structural basis of RNA replication by SARS-CoV-2',
          is_oa: true,
          best_oa_location: {
            url_for_pdf: 'https://europepmc.org/articles/pmc7116812/pdf',
          },
          z_authors: [{ given: 'Huan', family: 'Yan' }],
        },
      });

      const parsed = { type: 'doi', value: '10.1038/s41586-020-2649-2' };
      const resolved = await paperWorker.resolvePdf(parsed);

      expect(resolved.source).toBe('Unpaywall');
      expect(resolved.pdfUrl).toBe('https://europepmc.org/articles/pmc7116812/pdf');
      expect(resolved.metadata.title).toContain('Structural basis');
    });

    test('resolves PMID via NCBI fallback if Europe PMC returns no hit', async () => {
      getSpy = jest.spyOn(httpClient, 'get')
        .mockResolvedValueOnce({
          data: { resultList: { result: [] } }, // Europe PMC empty
        })
        .mockResolvedValueOnce({
          data: {
            result: {
              '99999999': {
                title: 'Genomics of Human Immunity',
                authors: [{ name: 'Smith J' }],
                pubdate: '2025 Jan',
                articleids: [{ idtype: 'pmc', value: 'PMC9999999' }],
              },
            },
          },
        });

      const parsed = { type: 'pmid', value: '99999999' };
      const resolved = await paperWorker.resolvePdf(parsed);

      expect(resolved.source).toBe('NCBI/PubMed');
      expect(resolved.pdfUrl).toContain('PMC9999999');
      expect(resolved.metadata.title).toBe('Genomics of Human Immunity');
    });
  });
});
