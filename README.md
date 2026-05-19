# 🤖 Rima — Bot Scraping WhatsApp 3.0

> Asisten pencari data all-in-one berbasis WhatsApp dengan NLP, multi-AI provider, dan 13+ data source.

## ✨ Fitur Utama

- 🔍 **Smart Search** — Cari gambar, paper akademik, dataset, dan web via bahasa natural (NLP)
- 🤖 **Multi-AI** — Dukungan OpenAI, Gemini, Groq, dan Grok dengan sistem *auto-fallback* jika salah satu gagal
- 🧠 **NLP Intent** — Klasifikasi niat pengguna 2 lapis (Rule-based Regex → AI Fallback) untuk efisiensi
- 📄 **Paper Download** — Rantai resolver pintar: Unpaywall → OpenAlex → arXiv → Crossref
- 🌐 **Deep Scrape** — Puppeteer + Brave browser, *stealth mode*, bypass anti-bot
- 📊 **13+ Data Providers** — Unsplash, Pexels, Pixabay, Wikimedia, OpenAlex, arXiv, Crossref, Semantic Scholar, Kaggle, HuggingFace, DuckDuckGo, Wikipedia, dan Puppeteer
- ⏰ **Watch System** — Penjadwalan scraping otomatis (jam/hari/minggu)
- 📦 **Multi-Format Output** — Ekspor hasil ke JSON, CSV, TSV, HTML, Excel, SQL, TXT, ZIP
- 🛡️ **Production-Ready & Resilient** — Dilengkapi *Circuit Breaker*, *Rate Limiter*, *Job Queue* (antrean tugas), dan auto-restart
- 🧪 **100% Test Coverage** — Sistem teruji penuh (192 unit tes) menjamin stabilitas fungsi inti, utilitas, memori konteks, formatter, dan wizard.

## 📋 Prerequisites

- **Node.js** v18+
- **Brave Browser** (atau Chromium-based browser)
- **WhatsApp** account
- API keys (minimal: OpenAI atau Gemini)

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd "Bot scraping 3.0"
npm install

# 2. Configure
cp .env.example .env
# Edit .env → isi API keys

# 3. Run
node index.js
# Scan QR code di terminal dengan WhatsApp
```

## ⚙️ Konfigurasi

Copy `.env.example` ke `.env` dan isi:

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `OPENAI_API_KEY` | ✅* | OpenAI API key |
| `GEMINI_API_KEY` | ✅* | Google Gemini API key |
| `UNSPLASH_ACCESS_KEY` | ❌ | Unsplash image API |
| `PEXELS_API_KEY` | ❌ | Pexels image API |
| `PIXABAY_API_KEY` | ❌ | Pixabay image API |
| `KAGGLE_USERNAME` | ❌ | Kaggle credentials |
| `KAGGLE_KEY` | ❌ | Kaggle API key |

*Minimal satu AI provider harus terisi.

## 💬 Cara Pakai

### Command
```
!scrape <keyword> --type images --limit 20
!paper 10.1038/s41586-020-2649-2
!deepscrape https://example.com
!ai apa itu machine learning?
!analyze                          (reply ke gambar)
!watch keyword --every daily
!wizard                           (guided step-by-step)
!menu | !help | !health | !history
```

### Natural Language
```
"cari gambar kucing lucu"
"carikan paper tentang deep learning"
"apa itu neural network?"
"download paper arXiv 2301.07041"
```

## 🏗️ Arsitektur

```
src/
├── bot/            # WhatsApp client, message handler, NLP, wizard
├── commands/       # 20+ command handlers
├── engine/         # Provider router, deep scraper, scrape engine
│   └── providers/  # 13 data providers (images/papers/datasets/general)
├── jobs/           # Bottleneck job queue + workers
├── services/       # AI, cache, formatters, i18n, images, packaging,
│                   # resilience, security, identity, watch, templates
└── utils/          # HTTP client, file system, validators, logger
```

## 🐳 Docker

```bash
docker-compose up -d
```

## 📄 License

MIT
