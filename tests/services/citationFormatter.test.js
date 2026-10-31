'use strict';

const { formatCitations, buildSourcesBlock } = require('../../src/services/ai/citationFormatter');

describe('services/ai/citationFormatter', () => {
  const mockSources = [
    { title: 'Paper A: Deep Residual Learning', section: 'Abstract', url: 'https://arxiv.org/abs/1512.03385' },
    { title: 'Paper B: Attention Is All You Need', section: 'Methodology', url: 'https://arxiv.org/abs/1706.03762' },
    { title: 'Paper C: FlashAttention', section: 'Results', url: 'https://arxiv.org/abs/2205.14135' },
  ];

  test('buildSourcesBlock correctly formats numbered context blocks', () => {
    const block = buildSourcesBlock(mockSources);
    expect(block).toContain('[1] (Paper A: Deep Residual Learning — Section: Abstract — https://arxiv.org/abs/1512.03385)');
    expect(block).toContain('[2] (Paper B: Attention Is All You Need — Section: Methodology — https://arxiv.org/abs/1706.03762)');
    expect(block).toContain('[3] (Paper C: FlashAttention — Section: Results — https://arxiv.org/abs/2205.14135)');
    expect(block).toContain('---');
  });

  test('formatCitations preserves valid citations and appends verified footer', () => {
    const rawAnswer = 'ResNet menggunakan residual connection [1]. Transformer memperkenalkan self-attention [2].';
    const result = formatCitations(rawAnswer, mockSources);

    expect(result.text).toContain('ResNet menggunakan residual connection [1]. Transformer memperkenalkan self-attention [2].');
    expect(result.text).toContain('📚 *Sumber:*');
    expect(result.text).toContain('*[1]* Paper A: Deep Residual Learning — Bagian: Abstract — https://arxiv.org/abs/1512.03385');
    expect(result.text).toContain('*[2]* Paper B: Attention Is All You Need — Bagian: Methodology — https://arxiv.org/abs/1706.03762');
    expect(result.used).toHaveLength(2);
    expect(result.invalid).toEqual([]);
  });

  test('formatCitations renumbers citations by order of first appearance', () => {
    // LLM cited Paper C (original 3) first, then Paper A (original 1)
    const rawAnswer = 'FlashAttention mengoptimalkan IO [3]. Sementara itu ResNet diperkenalkan pada 2015 [1]. FlashAttention sangat cepat [3].';
    const result = formatCitations(rawAnswer, mockSources);

    // In the renumbered answer, [3] becomes [1], and [1] becomes [2]
    expect(result.text).toContain('FlashAttention mengoptimalkan IO [1]. Sementara itu ResNet diperkenalkan pada 2015 [2]. FlashAttention sangat cepat [1].');
    expect(result.text).toContain('*[1]* Paper C: FlashAttention — Bagian: Results — https://arxiv.org/abs/2205.14135');
    expect(result.text).toContain('*[2]* Paper A: Deep Residual Learning — Bagian: Abstract — https://arxiv.org/abs/1512.03385');
    expect(result.used[0].title).toBe('Paper C: FlashAttention');
    expect(result.used[1].title).toBe('Paper A: Deep Residual Learning');
  });

  test('formatCitations handles multi-citations in single brackets and strips hallucinated numbers', () => {
    const rawAnswer = 'Model modern menggunakan kombinasi teknik [2, 99, 1]. Klaim palsu [888].';
    const result = formatCitations(rawAnswer, mockSources);

    // 99 and 888 are invalid. Original 2 is seen first -> 1. Original 1 is seen next -> 2.
    // Bracket [2, 99, 1] becomes [1, 2]. Bracket [888] is removed cleanly.
    expect(result.text).toContain('Model modern menggunakan kombinasi teknik [1, 2]. Klaim palsu.');
    expect(result.invalid).toEqual([99, 888]);
    expect(result.used).toHaveLength(2);
  });

  test('formatCitations creates context fallback footer when no citations exist in LLM answer', () => {
    const rawAnswer = 'Ini adalah jawaban rangkuman umum tanpa ada sitasi kurung siku.';
    const result = formatCitations(rawAnswer, mockSources);

    expect(result.text).toContain('Ini adalah jawaban rangkuman umum tanpa ada sitasi kurung siku.');
    expect(result.text).toContain('📎 *Konteks yang digunakan:*');
    expect(result.text).toContain('• Paper A: Deep Residual Learning — https://arxiv.org/abs/1512.03385');
    expect(result.used).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  test('formatCitations gracefully handles empty input', () => {
    const result = formatCitations('', []);
    expect(result.text).toBe('');
    expect(result.used).toEqual([]);
    expect(result.invalid).toEqual([]);
  });
});
