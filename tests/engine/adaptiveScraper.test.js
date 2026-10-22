'use strict';

/**
 * @fileoverview Tests for Scrapling-inspired Adaptive Scraper & Stealth Engine.
 */

const cheerio = require('cheerio');
const {
  getStealthHeaders,
  buildElementSignature,
  computeSignatureSimilarity,
  relocateElement,
  adaptiveExtract,
  clearSignatures,
} = require('../../src/engine/adaptiveScraper');

describe('adaptiveScraper (Scrapling integration)', () => {
  beforeEach(() => {
    clearSignatures();
  });

  test('getStealthHeaders generates realistic browser headers with Sec-CH-UA and Referer', () => {
    const headers = getStealthHeaders('https://shop.example.com/products/123');
    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0/);
    expect(headers['Sec-CH-UA']).toBeDefined();
    expect(headers['Sec-Fetch-Mode']).toBe('navigate');
    expect(headers['Referer']).toBe('https://shop.example.com/');
  });

  test('buildElementSignature and relocateElement self-heal when CSS classes and structure change', () => {
    const oldHtml = `
      <html><body>
        <div class="product-card-v1">
          <h2 class="title-old">RTX 5090 GPU</h2>
          <span class="price-tag-v1" data-testid="product-price" itemprop="price">$1,999.00</span>
        </div>
      </body></html>
    `;

    const $old = cheerio.load(oldHtml);
    const oldEl = $old('.price-tag-v1')[0];
    const sig = buildElementSignature($old, oldEl);

    expect(sig.tag).toBe('span');
    expect(sig.attributes['data-testid']).toBe('product-price');

    // Website redesigns: .price-tag-v1 is renamed to .new-pricing-badge, span becomes div
    const redesignedHtml = `
      <html><body>
        <section class="item-wrapper-v2">
          <h2>RTX 5090 GPU</h2>
          <div class="new-pricing-badge" data-testid="product-price" itemprop="price">$1,899.00</div>
          <p class="footer-note">Free shipping</p>
        </section>
      </body></html>
    `;

    const $new = cheerio.load(redesignedHtml);
    const relocated = relocateElement($new, sig, 0.4);

    expect(relocated.found).toBe(true);
    expect(relocated.text).toBe('$1,899.00');
    expect(relocated.score).toBeGreaterThan(0.5);
  });

  test('adaptiveExtract learns signature on first run and relocates when selector breaks on second run', async () => {
    const htmlV1 = `
      <html><body>
        <main>
          <article class="headline-box">
            <h1 class="main-headline" role="heading">Breaking AI Discovery 2026</h1>
          </article>
        </main>
      </body></html>
    `;

    const firstRun = await adaptiveExtract(htmlV1, {
      selector: '.main-headline',
      adaptiveKey: 'news::headline',
    });

    expect(firstRun.mode).toBe('selector');
    expect(firstRun.items).toEqual(['Breaking AI Discovery 2026']);

    // V2: .main-headline class is removed/renamed to .hero-title-text
    const htmlV2 = `
      <html><body>
        <main>
          <article class="headline-box">
            <h1 class="hero-title-text" role="heading">Breaking AI Discovery 2026 — Updated</h1>
          </article>
        </main>
      </body></html>
    `;

    const secondRun = await adaptiveExtract(htmlV2, {
      selector: '.main-headline', // no longer exists in V2!
      adaptiveKey: 'news::headline',
    });

    expect(secondRun.mode).toBe('adaptive-relocated');
    expect(secondRun.items).toEqual(['Breaking AI Discovery 2026 — Updated']);
    expect(secondRun.similarityScore).toBeGreaterThan(0.45);
  });

  test('computeSignatureSimilarity returns 0 for null inputs', () => {
    expect(computeSignatureSimilarity(null, {})).toBe(0);
  });
});
