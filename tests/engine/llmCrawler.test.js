'use strict';

/**
 * @fileoverview Tests for LLM-Ready Web Crawler (Firecrawl / Crawl4AI / Agent-Reach integration).
 */

const {
  htmlToMarkdown,
  crawlSite,
  resolveUrl,
  tableToMarkdown,
} = require('../../src/engine/llmCrawler');
const cheerio = require('cheerio');

describe('llmCrawler', () => {
  test('resolveUrl resolves relative URLs and ignores javascript:/mailto:', () => {
    expect(resolveUrl('/docs/intro', 'https://example.com/blog/post')).toBe('https://example.com/docs/intro');
    expect(resolveUrl('javascript:void(0)', 'https://example.com')).toBe('');
    expect(resolveUrl('mailto:test@example.com', 'https://example.com')).toBe('');
    expect(resolveUrl('', 'https://example.com')).toBe('');
  });

  test('htmlToMarkdown converts headings, paragraphs, code blocks, lists, tables, and strips boilerplate for fitMarkdown', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Crawl4AI & Firecrawl Guide</title>
          <meta name="description" content="Complete guide to LLM-ready web scraping">
          <meta name="author" content="Rima Bot">
          <script>console.log("noise");</script>
          <style>.hidden { display: none; }</style>
        </head>
        <body>
          <nav class="navbar"><a href="/home">Home</a> | <a href="/pricing">Pricing</a></nav>
          <article>
            <h1>Main Article Heading</h1>
            <p>This is a detailed paragraph explaining how <strong>LLM-ready markdown</strong> extraction works with <a href="/spec">clean links</a> and removes navigation noise.</p>
            <h2>Benchmark Results</h2>
            <table>
              <thead><tr><th>Engine</th><th>Accuracy</th></tr></thead>
              <tbody>
                <tr><td>Firecrawl</td><td>96%</td></tr>
                <tr><td>Crawl4AI</td><td>95%</td></tr>
              </tbody>
            </table>
            <pre><code class="language-js">const x = 42;</code></pre>
            <ul>
              <li>Boilerplate removal</li>
              <li>Citation numbering</li>
            </ul>
          </article>
          <footer class="footer"><p>Copyright 2026 Spam Footer Links</p></footer>
        </body>
      </html>
    `;

    const res = htmlToMarkdown(html, { url: 'https://example.com/guide' });

    expect(res.title).toBe('Crawl4AI & Firecrawl Guide');
    expect(res.description).toBe('Complete guide to LLM-ready web scraping');
    expect(res.metadata.author).toBe('Rima Bot');
    expect(res.fitMarkdown).toContain('# Main Article Heading');
    expect(res.fitMarkdown).toContain('**LLM-ready markdown**');
    expect(res.fitMarkdown).toContain('[clean links](https://example.com/spec)');
    expect(res.fitMarkdown).toContain('| Engine | Accuracy |');
    expect(res.fitMarkdown).toContain('| Firecrawl | 96% |');
    expect(res.fitMarkdown).toContain('```js\nconst x = 42;\n```');
    expect(res.fitMarkdown).toContain('- Boilerplate removal');
    expect(res.fitMarkdown).toContain('### References');
    expect(res.fitMarkdown).toContain('[1]: https://example.com/spec');

    // Fit-Markdown should prune nav and footer boilerplate
    expect(res.fitMarkdown).not.toContain('Copyright 2026 Spam Footer Links');
    expect(res.fitMarkdown).not.toContain('console.log("noise")');
    expect(res.wordCount).toBeGreaterThan(15);
    expect(res.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  test('htmlToMarkdown handles empty or non-string input safely', () => {
    const empty = htmlToMarkdown('', { url: 'https://example.com' });
    expect(empty.markdown).toBe('');
    expect(empty.fitMarkdown).toBe('');
    expect(empty.wordCount).toBe(0);
  });

  test('tableToMarkdown handles pipes inside cells', () => {
    const $ = cheerio.load('<table><tr><th>Expr</th><th>Val</th></tr><tr><td>a | b</td><td>1</td></tr></table>');
    const md = tableToMarkdown($, $('table')[0]);
    expect(md).toContain('a \\| b');
  });

  test('crawlSite performs multi-page BFS within same domain and respects maxPages & maxDepth', async () => {
    const mockPages = {
      'https://example.com': {
        url: 'https://example.com',
        title: 'Home',
        fitMarkdown: '# Home Page',
        wordCount: 10,
        links: [
          { text: 'Page 1', url: 'https://example.com/page1', isExternal: false },
          { text: 'Page 2', url: 'https://example.com/page2', isExternal: false },
          { text: 'External', url: 'https://other.org/ext', isExternal: true },
        ],
      },
      'https://example.com/page1': {
        url: 'https://example.com/page1',
        title: 'Page 1',
        fitMarkdown: '# Page 1 Content',
        wordCount: 12,
        links: [
          { text: 'Home', url: 'https://example.com', isExternal: false }, // cycle
          { text: 'Deep', url: 'https://example.com/page1/deep', isExternal: false },
        ],
      },
      'https://example.com/page2': {
        url: 'https://example.com/page2',
        title: 'Page 2',
        fitMarkdown: '# Page 2 Content',
        wordCount: 14,
        links: [],
      },
    };

    const fetcher = jest.fn(async (url) => mockPages[url] || { url, title: url, fitMarkdown: '', links: [] });

    const result = await crawlSite('https://example.com', {
      maxPages: 3,
      maxDepth: 1,
      fetcher,
    });

    expect(result.pagesVisited).toBe(3);
    expect(result.pages.map(p => p.url)).toEqual([
      'https://example.com',
      'https://example.com/page1',
      'https://example.com/page2',
    ]);
    expect(result.combinedMarkdown).toContain('# Home Page');
    expect(result.combinedMarkdown).toContain('# Page 1 Content');
  });

  test('preserves <article><header><h1>, inline links inside <li>/<blockquote>, and strips huge data: base64 images', () => {
    const html = `
      <html><body>
        <header class="site-header"><nav>Top Site Nav</nav></header>
        <article>
          <header>
            <h1>Semantic Article Title</h1>
          </header>
          <p>Lead paragraph.</p>
          <ul>
            <li>Read the <a href="/paper.pdf">Full Paper</a> with <code>code</code></li>
          </ul>
          <blockquote>
            Quote from <a href="https://arxiv.org/abs/1234.5678">ArXiv Study</a> on agents.
          </blockquote>
          <img alt="Huge inline" src="data:image/png;base64,${'A'.repeat(5000)}" />
          <img alt="Real diagram" src="/assets/arch.png" />
        </article>
      </body></html>
    `;

    const res = htmlToMarkdown(html, { url: 'https://example.com/post' });

    expect(res.fitMarkdown).toContain('# Semantic Article Title');
    expect(res.fitMarkdown).not.toContain('Top Site Nav');
    expect(res.fitMarkdown).toContain('[Full Paper](https://example.com/paper.pdf)');
    expect(res.fitMarkdown).toContain('`code`');
    expect(res.fitMarkdown).toContain('> Quote from [ArXiv Study](https://arxiv.org/abs/1234.5678) on agents.');
    expect(res.fitMarkdown).toContain('[1]: https://example.com/paper.pdf');
    expect(res.fitMarkdown).toContain('[2]: https://arxiv.org/abs/1234.5678');
    expect(res.fitMarkdown).not.toContain('data:image/png;base64');
    expect(res.fitMarkdown).toContain('![Real diagram](https://example.com/assets/arch.png)');
  });

  test('resolveUrl blocks uppercase JAVASCRIPT:, data:, vbscript:, and fragment-only links', () => {
    expect(resolveUrl('JAVASCRIPT:alert(1)', 'https://example.com')).toBe('');
    expect(resolveUrl('data:text/html,<script>alert(1)</script>', 'https://example.com')).toBe('');
    expect(resolveUrl('vbscript:msgbox(1)', 'https://example.com')).toBe('');
    expect(resolveUrl('#section-2', 'https://example.com/page')).toBe('');
  });

  test('crawlSite handles invalid start URLs and redirect loops without infinite recursion', async () => {
    await expect(crawlSite('not-a-valid-url')).rejects.toThrow(/Invalid URL/);

    const loopFetcher = jest.fn(async (url) => ({
      url: 'https://example.com/', // canonical redirect back to root
      title: 'Root',
      fitMarkdown: '# Root',
      wordCount: 5,
      links: [
        { text: 'Redirect Alias', url: 'https://example.com/redirect-to-root', isExternal: false },
      ],
    }));

    const loopRes = await crawlSite('https://example.com', {
      maxPages: 5,
      maxDepth: 3,
      fetcher: loopFetcher,
    });
    // Alias redirects back to an already-visited canonical URL, so it is fetched
    // once but deduplicated (no duplicate page content, no infinite loop).
    expect(loopFetcher).toHaveBeenCalledTimes(2);
    expect(loopRes.pagesVisited).toBe(1);
  });
});
