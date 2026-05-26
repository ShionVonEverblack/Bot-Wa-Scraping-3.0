# 🤖 Rima — Bot Scraping WhatsApp 3.0

> Asisten pencari data all-in-one berbasis WhatsApp dengan NLP, multi-AI provider, dan 19 data source.

## ✨ Fitur Utama

- 🔍 **Smart Search** — Cari gambar, anime art, paper akademik, dataset, dan web via bahasa natural (NLP)
- 🤖 **Multi-AI & Auto-Summary** — Dukungan OpenAI, Gemini, Groq, dan Grok dengan sistem *auto-fallback* jika salah satu gagal, dan fitur peringkasan instan (`--ai` atau `+ai`)
- 🧠 **3-Layer NLP Intent** — Klasifikasi niat pengguna 3 lapis super cerdas (Local Neural Network `node-nlp` → Rule-based Regex → AI Fallback) toleran terhadap *typo* dan singkatan
- 📄 **Paper Download** — Rantai resolver pintar: Europe PMC → Unpaywall → OpenAlex → arXiv → Crossref
- 🌐 **Deep Scrape** — Puppeteer + Brave browser, *stealth mode*, bypass anti-bot
- 📊 **19 Data Providers** —
  - **Images**: Unsplash, Pexels, Pixabay, RedditImages, Safebooru (Anime art), Wikimedia
  - **Papers**: OpenAlex, arXiv, Europe PMC, Crossref, Semantic Scholar
  - **Datasets**: Kaggle, HuggingFace, Zenodo (Scientific datasets)
  - **Forums**: Reddit
  - **Books**: Google Books
  - **General**: DuckDuckGo, Wikipedia, Puppeteer
- ⏰ **Watch System** — Penjadwalan scraping otomatis (jam/hari/minggu)
- 📦 **Multi-Format Output** — Ekspor hasil ke JSON, CSV, TSV, HTML, Excel, SQL, TXT, ZIP
- 🛡️ **Production-Ready & Resilient** — Dilengkapi *Circuit Breaker*, *Rate Limiter*, *Job Queue* (antrean tugas), dan auto-restart
- 🧪 **100% Test Coverage** — Sistem teruji penuh (192 unit tes) menjamin stabilitas fungsi inti, utilitas, memori konteks, formatter, dan wizard.
- 📊 **Web Dashboard** — Monitor status bot & scan QR code via browser (`http://localhost:3000`)

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
# Scan QR code di terminal atau via Web Dashboard dengan WhatsApp Anda
```

## ⚙️ Konfigurasi

Copy `.env.example` ke `.env` dan isi:

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `OPENAI_API_KEY` | ✅* | OpenAI API key |
| `GEMINI_API_KEY` | ✅* | Google Gemini API key |
| `GROQ_API_KEY` | ❌ | Groq Cloud API key |
| `GROK_API_KEY` | ❌ | Grok (xAI) API key |
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
!scrape anime --type images --provider safebooru --limit 10
!scrape covid --type datasets --provider zenodo --ai
!paper 10.1038/s41586-020-2649-2
!deepscrape https://example.com
!ai apa itu machine learning?
!analyze                          (reply ke gambar)
!watch keyword --every daily
!wizard                           (guided step-by-step)
!menu | !help | !health | !history
```

### Natural Language (NLP)
Bot memahami bahasa percakapan sehari-hari secara fleksibel:
```
"cari gambar kucing lucu"
"carikan anime art naruto dari safebooru"
"tolong cari dataset covid di zenodo --ai"
"carikan paper tentang deep learning dan ringkas"
"apa itu neural network?"
"download paper arXiv 2301.07041"
```

## 🏗️ Arsitektur

```
src/
├── bot/            # WhatsApp client, message handler, NLP (Neural Network), wizard
├── commands/       # 20+ command handlers
├── engine/         # Provider router, deep scraper, scrape engine
│   └── providers/  # 19 data providers (images/papers/datasets/forums/books/general)
├── jobs/           # Bottleneck job queue + workers
├── services/       # AI, cache, formatters, i18n, images, packaging,
│                   # resilience, security, identity, watch, templates
└── utils/          # HTTP client, file system, validators, logger
```

## 📊 Web Dashboard

Setelah bot berjalan, buka `http://localhost:3000` untuk:
- 📱 Scan QR code WhatsApp dari browser (tidak perlu akses terminal)
- 🟢 Monitor status koneksi real-time (auto-refresh 5 detik)
- 📈 Lihat metrik: uptime, memori, Node.js version

**API Endpoints:**
| Endpoint | Fungsi |
|----------|--------|
| `GET /api/status` | Status bot (JSON) |
| `GET /api/qr` | QR code (base64 data URL) |
| `GET /api/qr.png` | QR code (gambar PNG) |

## 🐳 Docker

```bash
docker-compose up -d
```

## 📄 License

MIT

