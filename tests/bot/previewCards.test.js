'use strict';

const {
  formatPreview,
  codePreview,
  bookPreview,
  forumPreview,
  paperPreview,
  datasetPreview,
  imagePreview,
  generalPreview,
} = require('../../src/bot/templates/previewCards');

describe('bot/templates/previewCards — 7 Categories & WhatsApp Link Preview Unfurling', () => {
  test('codePreview displays repo metadata and primary URL on line 2', () => {
    const items = [
      {
        title: 'facebookresearch/llama',
        url: 'https://github.com/facebookresearch/llama',
        stars: 55000,
        forks: 9200,
        language: 'Python',
        description: 'Inference code for LLaMA models',
      },
      {
        title: 'ggerganov/llama.cpp',
        url: 'https://github.com/ggerganov/llama.cpp',
        stars: 62000,
        forks: 8900,
        language: 'C++',
        description: 'LLM inference in C/C++',
      },
    ];

    const preview = formatPreview(items, 'code', 5, { provider: 'github' });

    expect(preview).toContain('💻 *Code & Repositories* (2 hasil · via github)');
    // Primary URL on line 2 for WhatsApp link unfurling
    const lines = preview.split('\n');
    expect(lines[1]).toBe('🔗 https://github.com/facebookresearch/llama');
    expect(preview).toContain('⭐ 55000 | 🍴 9200 | 💻 Python');
    expect(preview).toContain('2. *ggerganov/llama.cpp*');
  });

  test('bookPreview displays author, downloads, and download links', () => {
    const items = [
      {
        title: 'Frankenstein; Or, The Modern Prometheus',
        authors: 'Shelley, Mary Wollstonecraft',
        downloads: 85240,
        url: 'https://www.gutenberg.org/ebooks/84',
        downloadUrl: 'https://www.gutenberg.org/files/84/84-0.txt',
      },
    ];

    const preview = formatPreview(items, 'books', 5, { provider: 'gutendex' });

    expect(preview).toContain('📚 *Books & Literature*');
    expect(preview).toContain('✍️ Shelley, Mary Wollstonecraft');
    expect(preview).toContain('⬇️ 85240');
    expect(preview).toContain('📥 https://www.gutenberg.org/files/84/84-0.txt');
  });

  test('forumPreview displays score, comments count, and author', () => {
    const items = [
      {
        title: 'Show HN: Rima WhatsApp Scraping Assistant',
        points: 450,
        comments: 120,
        author: 'developer',
        url: 'https://news.ycombinator.com/item?id=99999',
      },
    ];

    const preview = formatPreview(items, 'forums', 5, { provider: 'hackernews' });

    expect(preview).toContain('💬 *Forum & Discussions*');
    expect(preview).toContain('⬆️ 450 | 💬 120 | 👤 developer');
    expect(preview).toContain('🔗 https://news.ycombinator.com/item?id=99999');
  });

  test('paperPreview displays citation metrics and OA status', () => {
    const items = [
      {
        title: 'Attention Is All You Need',
        authors: 'Vaswani et al.',
        year: 2017,
        citationCount: 98000,
        isOpenAccess: true,
        pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf',
      },
    ];

    const preview = formatPreview(items, 'papers');

    expect(preview).toContain('📄 *Paper Results*');
    expect(preview).toContain('📊 98000 cit. | 🔓 OA');
    expect(preview).toContain('📥 https://arxiv.org/pdf/1706.03762.pdf');
  });

  test('datasetPreview displays size and download statistics', () => {
    const items = [
      {
        title: 'Global Climate Dataset 2026',
        author: 'noaa',
        size: '1.2 GB',
        downloads: 3400,
        url: 'https://kaggle.com/datasets/noaa/climate',
      },
    ];

    const preview = formatPreview(items, 'datasets');

    expect(preview).toContain('📊 *Dataset Results*');
    expect(preview).toContain('💾 1.2 GB | ⬇️ 3400');
  });

  test('imagePreview displays dimensions and photographer', () => {
    const items = [
      {
        title: 'Serene Mountain Vista',
        width: 3840,
        height: 2160,
        photographer: 'Jane Doe',
        url: 'https://images.unsplash.com/photo-12345',
      },
    ];

    const preview = formatPreview(items, 'images');

    expect(preview).toContain('🖼️ *Image Results*');
    expect(preview).toContain('📐 3840×2160 | 📷 Jane Doe');
  });

  test('generalPreview falls back cleanly and handles items with missing optional fields without undefined', () => {
    const items = [
      {
        title: 'Generic Result',
        url: 'https://example.com',
      },
    ];

    const preview = formatPreview(items, 'general');

    expect(preview).toContain('🔍 *Search Results*');
    expect(preview).not.toContain('undefined');
  });

  test('handles empty item list gracefully across all formatters', () => {
    expect(codePreview([])).toContain('Tidak ada repositori');
    expect(bookPreview([])).toContain('Tidak ada buku');
    expect(forumPreview([])).toContain('Tidak ada diskusi');
    expect(paperPreview([])).toContain('Tidak ada paper');
    expect(datasetPreview([])).toContain('Tidak ada dataset');
    expect(imagePreview([])).toContain('Tidak ada gambar');
    expect(generalPreview([])).toContain('Tidak ada hasil');
  });
});
