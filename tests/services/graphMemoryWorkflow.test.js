'use strict';

/**
 * @fileoverview Tests for Knowledge Graph (Graphify), Persistent Memory (Claude-Mem),
 * Context Compressor (Headroom), Agentic Workflows (Dify), Agent Skills Registry, and Job Store.
 */

const knowledgeGraph = require('../../src/services/graph/knowledgeGraph');
const persistentMemory = require('../../src/services/memory/persistentMemory');
const contextCompressor = require('../../src/services/compression/contextCompressor');
const workflowEngine = require('../../src/services/workflows/workflowEngine');
const skillRegistry = require('../../src/services/skills/skillRegistry');
const jobStore = require('../../src/jobs/jobStore');
const { parseIdentifier } = require('../../src/jobs/paperWorker');

describe('Graphify, Claude-Mem, Headroom, Dify Workflows, Skills, and Jobs', () => {
  beforeEach(() => {
    persistentMemory.clearMemory('test-user@c.us');
    jobStore.clearAll();
  });

  test('knowledgeGraph builds nodes, edges, God Nodes, communities, and Mermaid diagram', () => {
    const items = [
      {
        title: 'GraphRAG with Knowledge Graphs',
        description: 'Combines Neo4j and OpenAI Embeddings for structured retrieval.',
        authors: 'Alice Smith, Bob Jones',
        source: 'openalex',
        doi: '10.1038/s41586-026-0001',
      },
      {
        title: 'Hybrid Retrieval with OpenAI Embeddings',
        description: 'Evaluates RAGFlow and GraphRAG on multi-hop benchmarks.',
        authors: 'Alice Smith',
        source: 'arxiv',
      },
    ];

    const graph = knowledgeGraph.buildGraphFromItems(items, { topic: 'GraphRAG Research' });

    expect(graph.nodes.length).toBeGreaterThan(4);
    expect(graph.edges.length).toBeGreaterThan(4);
    expect(graph.godNodes.length).toBeGreaterThan(0);
    expect(graph.communities.length).toBeGreaterThanOrEqual(1);

    const mermaid = knowledgeGraph.toMermaid(graph);
    expect(mermaid).toContain('flowchart LR');
    expect(mermaid).toContain('-->|');

    const report = knowledgeGraph.toMarkdownReport(graph);
    expect(report).toContain('GRAPHIFY KNOWLEDGE GRAPH REPORT');
    expect(report).toContain('God Nodes');
  });

  test('persistentMemory supports 3-layer progressive disclosure (searchIndex -> getTimeline -> getObservations)', () => {
    const userId = 'test-user@c.us';

    const obs1 = persistentMemory.recordObservation(userId, {
      type: 'search',
      title: 'Searched transformer architectures',
      content: 'User searched for attention mechanisms and FlashAttention papers',
    });
    const obs2 = persistentMemory.recordObservation(userId, {
      type: 'paper',
      title: 'Downloaded Attention Is All You Need',
      content: 'Resolved arXiv:1706.03762 and extracted PDF structure',
    });
    persistentMemory.recordObservation(userId, {
      type: 'preference',
      title: 'Prefers CSV format',
      content: 'User prefers exporting datasets in CSV format',
    });

    // Layer 1: compact index search
    const indexHits = persistentMemory.searchIndex(userId, 'attention transformer', 5);
    expect(indexHits.length).toBeGreaterThanOrEqual(2);
    expect(indexHits[0].id).toBeDefined();

    // Layer 2: timeline around obs2
    const timeline = persistentMemory.getTimeline(userId, obs2.id, 1);
    expect(timeline.length).toBe(3);

    // Layer 3: full observation payload
    const full = persistentMemory.getObservations(userId, [obs1.id]);
    expect(full.length).toBe(1);
    expect(full[0].content).toContain('FlashAttention');

    const promptBlock = persistentMemory.buildMemoryContextPrompt(userId, 'attention');
    expect(promptBlock).toContain('User Persistent Memory');
  });

  test('contextCompressor (Headroom) crushes JSON arrays, long text, and chat histories', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      title: `Paper #${i + 1} on Large Language Models`,
      url: `https://example.com/papers/${i + 1}`,
      description: 'This is a long description that repeats across items and contains extra whitespace.   '.repeat(4),
      thumbnail: '',
      sourceUrl: `https://example.com/papers/${i + 1}`,
      _score: 5.2,
      raw: null,
    }));

    const crushed = contextCompressor.compressJsonItems(items);
    expect(crushed.crushedItems.length).toBe(10);
    expect(crushed.stats.compressedTokens).toBeLessThan(crushed.stats.originalTokens);
    expect(crushed.stats.savingsPercent).toBeGreaterThan(20);

    const longText = [
      '# Main Heading',
      'Sentence one introduces the core benchmark with 98.4% accuracy [1].',
      'Filler sentence without much information that repeats generic words.',
      'Another filler sentence that adds padding to the paragraph.',
      ' Yet another filler sentence with low information density in the middle.',
      'Final conclusion sentence summarizing the 45% latency reduction [2].',
    ].join('\n');

    const textComp = contextCompressor.compressText(longText, { targetRatio: 0.55 });
    expect(textComp.compressedText).toContain('# Main Heading');
    expect(textComp.compressedText.length).toBeLessThan(longText.length);

    const messages = [
      { role: 'system', content: 'You are Rima assistant.' },
      { role: 'user', content: 'Hello, I am researching neural networks and deep learning history. '.repeat(20) },
      { role: 'assistant', content: 'Sure! Here is a detailed overview of perceptrons and backpropagation. '.repeat(20) },
      { role: 'user', content: 'What about transformers in 2017? '.repeat(20) },
      { role: 'assistant', content: 'Transformers replaced recurrence with self-attention. '.repeat(20) },
      { role: 'user', content: 'Summarize the key equation.' },
    ];

    const msgComp = contextCompressor.compressMessages(messages, 120);
    expect(msgComp.messages.length).toBeLessThan(messages.length);
    expect(msgComp.stats.compressedTokens).toBeLessThan(msgComp.stats.originalTokens);
  });

  test('workflowEngine executes multi-step Dify pipeline with pre-supplied items', async () => {
    const res = await workflowEngine.runWorkflow('deep-research', {
      query: 'Multi-Agent Systems',
      userId: 'test-user@c.us',
      items: [
        {
          title: 'AutoGen Multi-Agent Framework',
          url: 'https://arxiv.org/abs/2308.08155',
          description: 'Enables LLM applications using multiple conversing agents.',
          authors: 'Qingyun Wu',
          source: 'arxiv',
        },
        {
          title: 'MetaGPT Collaborative Agents',
          url: 'https://arxiv.org/abs/2308.00352',
          description: 'Assigns SOP roles to LLM agents for software engineering.',
          authors: 'Sirui Hong',
          source: 'arxiv',
        },
      ],
    });

    expect(res.workflowId).toBe('deep-research');
    expect(res.stepsExecuted).toEqual(['scrape', 'compress', 'graph', 'rag_index', 'memory', 'synthesize']);
    expect(res.state.graph.nodes.length).toBeGreaterThan(0);
    expect(res.state.ragDoc.chunkCount).toBeGreaterThan(0);
    expect(res.summaryReport).toContain('Workflow Completed');
  });

  test('skillRegistry discovers installed skills including karpathy-guidelines, superpowers, firecrawl, ragflow', () => {
    const count = skillRegistry.loadSkills(true);
    expect(count).toBeGreaterThanOrEqual(10);

    const karpathy = skillRegistry.getSkill('karpathy-guidelines');
    expect(karpathy).not.toBeNull();
    expect(karpathy.content).toContain('Think Before Coding');

    const firecrawlSkill = skillRegistry.getSkill('firecrawl');
    expect(firecrawlSkill).not.toBeNull();

    const activated = skillRegistry.setActiveSkill('user1@c.us', 'karpathy-guidelines');
    expect(activated.id).toBe('karpathy-guidelines');
    expect(skillRegistry.getActiveSkill('user1@c.us').id).toBe('karpathy-guidelines');

    skillRegistry.setActiveSkill('user1@c.us', 'off');
    expect(skillRegistry.getActiveSkill('user1@c.us')).toBeNull();
  });

  test('paperWorker.parseIdentifier and jobStore work accurately', async () => {
    expect(parseIdentifier('10.1038/s41586-020-2649-2')).toEqual({
      type: 'doi',
      value: '10.1038/s41586-020-2649-2',
    });
    expect(parseIdentifier('https://arxiv.org/abs/2301.07041v2')).toEqual({
      type: 'arxiv',
      value: '2301.07041v2',
    });
    expect(parseIdentifier('PMID:12345678')).toEqual({
      type: 'pmid',
      value: '12345678',
    });

    const job = await jobStore.createJob({
      type: 'SCRAPE',
      keyword: 'neural networks',
      scrapeType: 'papers',
      userId: 'u1@c.us',
    });
    expect(job.jobId).toMatch(/^J[A-Za-z0-9]{5}$/);

    const updated = await jobStore.updateJob(job.jobId, {
      status: 'COMPLETED',
      result: { items: [{ title: 'Test' }], itemCount: 1 },
    });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.result.itemCount).toBe(1);

    const stats = await jobStore.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(1);
  });

  test('knowledgeGraph orders godNodes strictly by centrality descending and preserves fenced code blocks in contextCompressor', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      title: 'Core Hub Concept',
      description: `Iteration ${i + 1} mentioning DeepLearning`,
      source: 'arxiv',
    }));
    const graph = knowledgeGraph.buildFromItems(items, { topic: 'Core Hub Concept' });
    for (let i = 1; i < graph.godNodes.length; i++) {
      expect(graph.godNodes[i - 1].centrality).toBeGreaterThanOrEqual(graph.godNodes[i].centrality);
    }

    const mdWithCode = [
      '# Code Example',
      'Filler prose sentence one that is fairly long and repetitive.',
      'Filler prose sentence two that is also fairly long and repetitive.',
      '```js\nfunction calculateScore(a, b) {\n  return a.value + b.value;\n}\n```',
      'Filler prose sentence three that can be dropped during compression.',
    ].join('\n\n');

    const compressed = contextCompressor.compressText(mdWithCode, { targetRatio: 0.55 });
    expect(compressed.compressedText).toContain('function calculateScore(a, b)');
    expect(compressed.compressedText).toContain('```js');
  });

  test('command handlers (!rag PDF attachment, !rag list, !crawl positional maxPages, !graph text, !memory timeline/get) work end-to-end', async () => {
    const ragHandler = require('../../src/commands/handlers/rag.handler');
    const crawlHandler = require('../../src/commands/handlers/crawl.handler');
    const graphHandler = require('../../src/commands/handlers/graph.handler');
    const memoryHandler = require('../../src/commands/handlers/memory.handler');

    const replies = [];
    const mockPdfBase64 = Buffer.from(
      'Research Paper Title\n\nAbstract\nQuantum routing achieves 99.2% fidelity in optical lattices.',
      'utf-8'
    ).toString('base64');

    const msgWithPdf = {
      hasMedia: true,
      downloadMedia: async () => ({
        mimetype: 'application/pdf',
        filename: 'quantum_routing.pdf',
        data: mockPdfBase64,
      }),
      getContact: async () => ({ id: { _serialized: 'u_test@c.us' } }),
      reply: async (text) => replies.push(text),
    };

    // 1. !rag with attached PDF + immediate question
    await ragHandler.handle(msgWithPdf, ['what', 'fidelity', 'was', 'achieved?']);
    expect(replies[replies.length - 1]).toContain('99.2%');

    // 2. !rag list
    const basicMsg = {
      hasMedia: false,
      getContact: async () => ({ id: { _serialized: 'u_test@c.us' } }),
      reply: async (text) => replies.push(text),
    };
    await ragHandler.handle(basicMsg, ['list']);
    expect(replies[replies.length - 1]).toContain('RAGFlow Index Stats');

    // 3. !graph with direct multi-sentence text passage
    await graphHandler.handle(basicMsg, [
      'GraphRAG integrates Knowledge Graphs with Vector Search. Neo4j and OpenAI Embeddings improve multi-hop reasoning across scientific literature.',
    ]);
    expect(replies[replies.length - 1]).toContain('GRAPHIFY KNOWLEDGE GRAPH REPORT');

    // 4. !memory remember -> search -> timeline -> get
    await memoryHandler.handle(basicMsg, ['remember', 'Preferred model is Gemini 2.5 Pro for long context']);
    const obsList = persistentMemory.searchIndex('u_test@c.us', 'gemini');
    expect(obsList.length).toBeGreaterThan(0);

    await memoryHandler.handle(basicMsg, ['timeline', obsList[0].id]);
    expect(replies[replies.length - 1]).toContain('Memory Timeline');

    await memoryHandler.handle(basicMsg, ['get', obsList[0].id]);
    expect(replies[replies.length - 1]).toContain('Detail Observasi');
    expect(replies[replies.length - 1]).toContain('Gemini 2.5 Pro');
  });
});
