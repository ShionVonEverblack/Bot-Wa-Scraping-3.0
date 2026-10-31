'use strict';

const ragEngine = require('../../src/services/rag/ragEngine');
const aiService = require('../../src/services/ai/aiService');

describe('services/rag/ragEngine — Guard & Citation Formatting', () => {
  beforeEach(() => {
    ragEngine.clearIndex();
    jest.restoreAllMocks();
  });

  test('score guard returns not found without calling LLM when score is below threshold', async () => {
    ragEngine.indexDocument('doc_test', 'Kucing adalah hewan mamalia karnivora berkaki empat.', {
      title: 'Biologi Kucing',
    });

    const chatSpy = jest.spyOn(aiService, 'chat');

    // Query completely unrelated to the indexed content
    const res = await ragEngine.answerWithRag('arsitektur microservices kubernetes ingress controller', {
      minScore: 0.8, // strict threshold
    });

    expect(res.answer).toContain('Tidak ditemukan potongan dokumen yang relevan');
    expect(res.citations).toEqual([]);
    expect(chatSpy).not.toHaveBeenCalled();
  });

  test('answerWithRag applies citationFormatter to LLM response and returns formatted result', async () => {
    ragEngine.indexDocument(
      'doc_ai',
      'Transformers menggunakan mekanisme multi-head attention untuk memproses token secara paralel. Feed-forward network memetakan representasi tersembunyi.',
      { title: 'Attention Is All You Need' }
    );

    jest.spyOn(aiService, 'chat').mockResolvedValue(
      'Mekanisme multi-head attention memproses token secara paralel [1].'
    );

    const res = await ragEngine.answerWithRag('bagaimana cara kerja attention');

    expect(res.answer).toContain('Mekanisme multi-head attention memproses token secara paralel [1].');
    expect(res.answer).toContain('📚 *Sumber:*');
    expect(res.answer).toContain('Attention Is All You Need');
    expect(res.formatted).toBeDefined();
    expect(res.formatted.used.length).toBeGreaterThan(0);
    expect(res.citations.length).toBeGreaterThan(0);
  });
});
