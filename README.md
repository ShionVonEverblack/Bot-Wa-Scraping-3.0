# 🤖 Rima — Bot Scraping WhatsApp 3.0

> Asisten pencari data all-in-one berbasis WhatsApp dengan NLP, multi-AI provider, dan 19 data source.

## ✨ Fitur Utama (Ultimate 3.0)

- 🎙️ **Voice Note AI** — Anda tidak perlu mengetik! Kirim pesan suara (PTT/Audio) dan bot akan otomatis mentranskripsikannya menggunakan model *Speech-to-Text* (Whisper/OpenAI) dan memrosesnya layaknya teks.
- 🧠 **Chat dengan Dokumen (RAG)** — Setelah mengunduh jurnal/paper (PDF), AI akan secara instan membaca isinya ke dalam memori. Anda bisa bertanya spesifik tentang metodologi, kesimpulan, atau isi dari jurnal tersebut!
- 🗄️ **Multi-Provider Aggregation (`--multi`)** — Tarik data dari seluruh sumber API sekaligus secara paralel! Bot akan menggabungkan, mendeduplikasi, dan merangking hasilnya.
- 🔍 **Smart Search (NLP)** — Cari gambar, anime art, paper akademik, dataset, dan web via bahasa natural. Paham *typo* dan terklasifikasi dalam *3-Layer NLP Intent*.
- 🤖 **Multi-AI & Auto-Summary** — Dukungan OpenAI, Gemini, Groq, dan Grok dengan sistem *auto-fallback* dan peringkasan instan (`--ai` atau `+ai`).
- 📄 **Paper Download** — Rantai resolver pintar: Europe PMC → Unpaywall → OpenAlex → arXiv → Crossref.
- 🌐 **Deep Scrape & Custom Scrape** — Puppeteer + Brave browser. Kini dilengkapi `!customscrape` yang bisa menargetkan CSS Selector spesifik dari web apa pun.
- 🛡️ **Admin Dashboard (`!admin`)** — Kontrol penuh khusus nomor pemilik bot: pantau RAM, _uptime_, pembersihan _cache_, hingga menghentikan proses paksa (`cancel-all`).
- ⏰ **Watch System** — Penjadwalan scraping otomatis (jam/hari/minggu).
- 📦 **Multi-Format Output** — Ekspor hasil ke JSON, CSV, TSV, HTML, Excel, SQL, TXT, ZIP.
- 🧪 **100% Test Coverage** — Sistem teruji penuh (193 Unit Test) menjamin stabilitas fungsi inti.
- 📊 **Web Dashboard** — Monitor status bot & scan QR code via browser (`http://localhost:3000`).

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

### Command Terstruktur
```
!scrape <keyword> --type images --limit 20
!scrape anime --type images --provider safebooru --multi
!scrape covid --type datasets --provider zenodo --ai
!paper 10.1038/s41586-020-2649-2
!deepscrape https://example.com
!customscrape https://news.ycombinator.com/ --selector "span.titleline > a"
!ai apa itu machine learning?
!analyze                          (reply ke gambar)
!watch keyword --every daily
!wizard                           (guided step-by-step)
!help | !bantuan                  (Memunculkan menu bantuan teks)
!admin stats | !admin flush       (Khusus Admin)
```

### Bahasa Natural (NLP) & Voice Note
Anda bisa merekam _Voice Note_ (Pesan Suara) atau mengetik kalimat percakapan sehari-hari secara fleksibel:
```
"cari gambar kucing lucu"
"carikan anime art naruto dari safebooru"
"tolong cari dataset covid di zenodo --ai"
"carikan paper tentang deep learning dari semua tempat --multi"
"download paper arXiv 2301.07041"
(Setelah PDF terdownload): "Tolong rangkum metodologinya!"
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

