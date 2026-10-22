'use strict';

/**
 * @fileoverview Test fixtures: HTML pages for crawler, markdown, and selector testing.
 */

const samplePages = {
  blogPage: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Understanding Modern Artificial Intelligence</title>
  <meta name="description" content="A comprehensive guide to deep learning, transformers, and LLM reasoning engines.">
  <meta name="author" content="Dr. Alan Turing">
  <meta property="og:title" content="Understanding Modern Artificial Intelligence">
  <meta property="og:description" content="A comprehensive guide to deep learning and LLMs.">
  <meta property="og:site_name" content="AI Research Quarterly">
  <link rel="canonical" href="https://example.com/blog/understanding-ai">
</head>
<body>
  <header id="header">
    <nav class="navbar">
      <a href="https://example.com/">Home</a>
      <a href="https://example.com/about">About Us</a>
      <a href="https://example.com/contact">Contact</a>
    </nav>
  </header>

  <div class="cookie-banner" id="cookie-consent">
    <p>We use cookies to enhance your browsing experience. <button id="accept-cookies">Accept</button></p>
  </div>

  <aside class="sidebar" id="sidebar">
    <div class="ad advertisement promo">
      <h4>Sponsored</h4>
      <p>Buy cloud GPUs now! Fast & cheap.</p>
    </div>
    <div class="widget">
      <h3>Recent Articles</h3>
      <ul>
        <li><a href="https://example.com/post-1">Post 1</a></li>
        <li><a href="https://example.com/post-2">Post 2</a></li>
      </ul>
    </div>
  </aside>

  <main role="main">
    <article class="post-content">
      <h1>Understanding Modern Artificial Intelligence</h1>
      <p class="byline">Published on <time datetime="2026-03-15">March 15, 2026</time> by Dr. Alan Turing</p>

      <p>Artificial intelligence has witnessed a paradigm shift with the emergence of large language models. These models demonstrate unprecedented reasoning capabilities across diverse cognitive domains.</p>

      <h2>1. The Transformer Architecture</h2>
      <p>Introduced in 2017, the <strong>Transformer</strong> replaced recurrent mechanisms with <em>multi-head self-attention</em>. This enabled massive parallelization during training across distributed GPU clusters.</p>

      <pre><code class="language-python">
import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, embed_dim):
        super().__init__()
        self.qkv = nn.Linear(embed_dim, embed_dim * 3)
      </code></pre>

      <blockquote>
        "Attention is all you need to achieve breakthrough performance across sequence-to-sequence benchmarks."
      </blockquote>

      <h2>2. Key Innovations</h2>
      <ul>
        <li>Positional Encodings for sequence awareness</li>
        <li>Scaled Dot-Product Attention for numerical stability</li>
        <li>Layer Normalization and Residual Connections</li>
      </ul>

      <h2>3. Performance Metrics</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Parameters</th>
            <th>MMLU Score</th>
            <th>Context Window</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Model-A</td>
            <td>7B</td>
            <td>68.4%</td>
            <td>8K</td>
          </tr>
          <tr>
            <td>Model-B</td>
            <td>70B</td>
            <td>82.1%</td>
            <td>32K</td>
          </tr>
          <tr>
            <td>Model-C</td>
            <td>405B</td>
            <td>88.6%</td>
            <td>128K</td>
          </tr>
        </tbody>
      </table>

      <p>For more details, consult the <a href="https://arxiv.org/abs/1706.03762">original paper on arXiv</a> or check our <a href="/benchmarks">internal benchmarks</a>.</p>
      <img src="https://example.com/images/transformer-diagram.png" alt="Transformer Diagram" width="800" height="400">
    </article>
  </main>

  <footer class="footer" id="footer">
    <p>&copy; 2026 AI Research Quarterly. All rights reserved.</p>
    <div class="share-buttons">
      <a href="https://twitter.com/share">Twitter</a>
      <a href="https://linkedin.com/share">LinkedIn</a>
    </div>
  </footer>
</body>
</html>`,

  ecommercePage: `<!DOCTYPE html>
<html>
<head><title>Gadget Store — Pro Laptop</title></head>
<body>
  <div class="nav-bar">Store Nav</div>
  <div id="product-container" class="product-wrapper">
    <div class="product-card-v1" data-testid="product-card" role="region">
      <h1 class="product-title" data-testid="item-title">UltraBook Pro Max 16"</h1>
      <span class="price-tag css-19xq2a" data-testid="item-price" data-currency="USD">$1,999.00</span>
      <div class="stock-status in-stock" data-stock="42">In Stock (42 units)</div>
      <button class="buy-btn btn-primary" id="add-to-cart-btn" data-action="cart">Add to Cart</button>
      <div class="specs-box">
        <p>CPU: 16-Core Neural Engine</p>
        <p>RAM: 64GB Unified Memory</p>
        <p>SSD: 2TB NVMe PCIe 4.0</p>
      </div>
    </div>
  </div>
</body>
</html>`,

  mutatedEcommercePage: `<!DOCTYPE html>
<html>
<head><title>Gadget Store — Pro Laptop</title></head>
<body>
  <header>Updated Header 2026</header>
  <main>
    <div id="root">
      <!-- Layout classes mutated by CSS-in-JS build -->
      <section class="tw-bg-white sc-hKjWfm jfPqYd" role="region" data-testid="product-card">
        <h1 class="sc-bZQynM font-bold" data-testid="item-title">UltraBook Pro Max 16"</h1>
        <span class="sc-gzVnrw tw-text-green-600" data-testid="item-price" data-currency="USD">$1,999.00</span>
        <div class="tw-text-sm" data-stock="42">In Stock (42 units)</div>
        <button class="sc-bxivhb tw-rounded-lg" id="btn-submit-cart" data-action="cart">Add to Cart</button>
        <div class="tw-p-4">
          <p>CPU: 16-Core Neural Engine</p>
          <p>RAM: 64GB Unified Memory</p>
          <p>SSD: 2TB NVMe PCIe 4.0</p>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`,

  tablePage: `<!DOCTYPE html>
<html>
<head><title>GPU Benchmark Comparison</title></head>
<body>
  <main>
    <h1>GPU Computing Benchmark Comparison</h1>
    <table>
      <thead>
        <tr>
          <th>Architecture</th>
          <th>GPU Model</th>
          <th>VRAM (GB)</th>
          <th>FP16 TFLOPS</th>
          <th>TDP (Watts)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Hopper</td>
          <td>H100 SXM5</td>
          <td>80</td>
          <td>1979</td>
          <td>700</td>
        </tr>
        <tr>
          <td>Blackwell</td>
          <td>B200 NVL</td>
          <td>192</td>
          <td>4500</td>
          <td>1000</td>
        </tr>
        <tr>
          <td>Ada Lovelace</td>
          <td>RTX 4090</td>
          <td>24</td>
          <td>330</td>
          <td>450</td>
        </tr>
      </tbody>
    </table>
  </main>
</body>
</html>`,

  schemaPage: `<!DOCTYPE html>
<html>
<head>
  <title>Quantum Computing Breakthrough</title>
  <meta name="description" content="Researchers demonstrate quantum error correction threshold.">
  <meta property="og:title" content="Quantum Computing Breakthrough">
  <meta property="og:description" content="Researchers demonstrate quantum error correction threshold.">
  <meta property="og:site_name" content="Tech Science News">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "Quantum Computing Breakthrough",
    "datePublished": "2026-04-01T08:00:00Z",
    "author": {
      "@type": "Person",
      "name": "Prof. Richard Feynman"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Tech Science News"
    }
  }
  </script>
</head>
<body>
  <main>
    <h1>Quantum Computing Breakthrough</h1>
    <p>A new error-correcting logical qubit code surpasses the physical fault tolerance threshold.</p>
  </main>
</body>
</html>`,

  malformedPage: `
  <div>
    <div>
      <div>
        <p>Text trapped in deep non-semantic nested divs without standard headings.</p>
        <span>Extra snippet of valuable information that must be extracted.</span>
        <a href="https://example.com/deep-link?utm_source=tracker&ref=123">Read More</a>
      </div>
    </div>
  </div>`,

  hugeImagePage: `<!DOCTYPE html>
<html>
<head><title>Heavy Media Article</title></head>
<body>
  <article>
    <h1>Article with Huge Embedded Image</h1>
    <p>Leading paragraph before the massive image.</p>
    <img src="data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='.repeat(100)}" alt="Sample Image">
    <p>Trailing paragraph after the image.</p>
  </article>
</body>
</html>`,

  circularLinksPage: `<!DOCTYPE html>
<html>
<head><title>Circular Spider Page A</title></head>
<body>
  <main>
    <h1>Page A</h1>
    <p>Welcome to page A in our network.</p>
    <a href="https://example.com/page-b">Go to Page B</a>
    <a href="https://example.com/page-a#section">Self Bookmark Link</a>
    <a href="https://external-domain.org/other">External Site</a>
  </main>
</body>
</html>`
};

module.exports = samplePages;
