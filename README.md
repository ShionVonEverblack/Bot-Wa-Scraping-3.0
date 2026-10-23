# 🤖 Rima - Bot Scraping WhatsApp 3.0

> Asisten pencari data all-in-one berbasis WhatsApp dengan NLP, multi-AI provider, dan 19 data source.

## ✨ Fitur Utama (Ultimate 3.0)

- 🎙️ **Voice Note AI** - Anda tidak perlu mengetik! Kirim pesan suara (PTT/Audio) dan bot akan otomatis mentranskripsikannya menggunakan model *Speech-to-Text* (Whisper/OpenAI) dan memrosesnya layaknya teks.
- 📺 **YouTube Video Summarizer** - Kirim link YouTube (contoh: `!yt https://youtu.be/...`). Bot akan mengunduh transkrip/CC videonya di latar belakang lalu AI akan membuat ringkasan terstruktur lengkap dengan poin penting!
- 👁️ **AI OCR (Ekstraksi Teks Gambar)** - Kirim atau _reply_ gambar (buku, jurnal, tabel) dengan `!ocr`. AI Vision (Gemini/GPT-4o) akan mengekstrak **seluruh teks** secara mutlak dan presisi (mendukung tulisan tangan & bahasa asing).
- 🧠 **Chat dengan Dokumen (RAG)** - Setelah mengunduh jurnal/paper (PDF), AI akan secara instan membaca isinya ke dalam memori. Anda bisa bertanya spesifik tentang metodologi, kesimpulan, atau isi dari jurnal tersebut!
- 🗄️ **Multi-Provider Aggregation (`--multi`)** - Tarik data dari seluruh sumber API sekaligus secara paralel! Bot akan menggabungkan, mendeduplikasi, dan merangking hasilnya.
- 🔍 **Smart Search (NLP)** - Cari gambar, anime art, paper akademik, dataset, dan web via bahasa natural. Paham *typo* dan terklasifikasi dalam *3-Layer NLP Intent*.
- 🤖 **Multi-AI & Auto-Summary** - Dukungan OpenAI, Gemini, Groq, dan Grok dengan sistem *auto-fallback* dan peringkasan instan (`--ai` atau `+ai`).
- 📄 **Paper Download** - Rantai resolver pintar: Europe PMC → Unpaywall → OpenAlex → arXiv → Crossref.
- 🌐 **Deep Scrape & Custom Scrape** - Puppeteer + Brave browser. Kini dilengkapi `!customscrape` yang bisa menargetkan CSS Selector spesifik dari web apa pun.
- 🛡️ **Anti-Spam & Rate Limiting** - Melindungi bot dari _banned_ WhatsApp dan pembengkakan tagihan API dengan sistem *Cooldown* cerdas (10 detik) per pengguna.
- ✨ **Rich UI Formatting** - Balasan bot menggunakan kutipan *(Blockquote)* dan pembatas elegan ala *Markdown* yang membuat output tampak sangat rapi dan berkelas.
- 🛠️ **Admin Dashboard (`!admin`)** - Kontrol penuh khusus nomor pemilik bot: pantau RAM, _uptime_, pembersihan _cache_, hingga menghentikan proses paksa (`cancel-all`).
- ⏰ **Watch System** - Penjadwalan scraping otomatis (jam/hari/minggu).
- 📦 **Multi-Format Output** - Ekspor hasil ke JSON, CSV, TSV, HTML, Excel, SQL, TXT, ZIP.
- 🕸️ **LLM-Ready Web Crawler (`!crawl`)** - Terinspirasi *Firecrawl*, *Crawl4AI* & *Agent-Reach*: ubah halaman web jadi Markdown bersih (Fit-Markdown), buang boilerplate (nav/iklan/footer), dan crawl multi-halaman (BFS) dengan deduplikasi redirect.
- 🧬 **Adaptive Scraper** - Terinspirasi *Scrapling*: selector yang "self-healing" (relokasi elemen via signature similarity saat struktur web berubah) + stealth headers.
- 📚 **Deep PDF & RAG (`!rag`)** - Terinspirasi *OpenDataLoader-PDF* & *RAGFlow*: parsing PDF layout-aware, chunking sadar struktur (tabel atomik), Hybrid Search BM25 + TF-IDF (RRF), dan jawaban dengan sitasi.
- 🕵️ **Knowledge Graph (`!graph`)** - Terinspirasi *Graphify*: ekstraksi entitas/relasi, "God Nodes" (sentralitas), deteksi komunitas, dan ekspor diagram Mermaid.
- 🧠 **Persistent Memory (`!memory`)** - Terinspirasi *Claude-Mem*: memori 3-lapis (index → timeline → observasi) yang tersimpan di disk + kompresi konteks ala *Headroom*.
- ⚙️ **Agentic Workflows (`!workflow`)** - Terinspirasi *Dify*: workflow deklaratif `deep-research`, `crawl-and-rag`, `fact-check` + bridge opsional ke Dify API.
- 🧩 **Agent Skills (`!skills`)** - 395 skill terindeks dari Karpathy Guidelines, Superpowers, Matt Pocock Skills, ECC, dan Anthropic Skills.
- 🧪 **Test Suite Lengkap** - 40 test suites / 605 tests (unit + E2E + adversarial stress) menjamin stabilitas fungsi inti.
- 📊 **Web Dashboard** - Monitor status bot & scan QR code via browser (`http://localhost:3000`).

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

**Bridge opsional (fitur tetap jalan native tanpa ini):**

| Variable | Deskripsi |
|----------|-----------|
| `FIRECRAWL_API_KEY` / `FIRECRAWL_BASE_URL` | Bridge ke Firecrawl API untuk `!crawl` |
| `CRAWL4AI_API_URL` / `CRAWL4AI_API_KEY` | Bridge ke server Crawl4AI |
| `USE_JINA_READER` | `true` = pakai Jina Reader sebagai fallback reader |
| `CRAWL_MAX_PAGES` / `CRAWL_MAX_DEPTH` | Batas crawl multi-halaman (default 5 / 2) |
| `RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP` / `RAG_TOP_K` | Tuning RAG (default 800 / 150 / 5) |
| `RAGFLOW_API_URL` / `RAGFLOW_API_KEY` / `RAGFLOW_DATASET_ID` | Bridge ke RAGFlow |
| `USE_GRAPHIFY_CLI` | `true` = pakai Graphify CLI jika terpasang |
| `MEMORY_PERSIST` / `MEMORY_MAX_OBSERVATIONS` | Persistensi memori (default `true` / 200) |
| `DIFY_API_URL` / `DIFY_API_KEY` | Bridge ke Dify workflow API |

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
!yt https://youtube.com/watch?v=...     (AI merangkum video YouTube)
!analyze                          (reply ke gambar, AI mendeskripsikan gambar)
!ocr | !baca                      (reply ke gambar, AI mengekstrak Teks/OCR)
!watch keyword --every daily
!wizard                           (guided step-by-step)
!help | !bantuan                  (Memunculkan menu bantuan teks)
!admin stats | !admin flush       (Khusus Admin)
```

### Fitur Baru: Crawl, RAG, Graph, Memory, Workflow & Skills
```
!crawl https://example.com                         (halaman → Markdown bersih LLM-ready)
!crawl https://example.com --max 3 --depth 1       (crawl multi-halaman BFS)
!crawl https://example.com --bridge firecrawl      (bridge: native | jina | firecrawl)
!crawl https://example.com --selector "article h2" (adaptive selector, self-healing)
!rag ingest <url|jobId|teks>                       (masukkan dokumen/web ke basis pengetahuan)
!rag ask apa metodologi yang digunakan?            (jawaban + sitasi sumber)
!rag stats | !rag list | !rag clear
!graph <jobId|url|keyword|teks>                    (knowledge graph + God Nodes + Mermaid)
!memory remember <fakta>                           (simpan ke memori persisten)
!memory search <kata> | !memory timeline <obsId> | !memory get <obsId>
!memory compress <jobId|teks> | !memory list | !memory clear
!workflow list
!workflow run deep-research <topik>                (scrape → compress → graph → RAG → sintesis)
!workflow run url-to-rag <url>
!workflow run quick-digest <topik_atau_url>
!skills list <kata> | !skills info <nama> | !skills use <nama> | !skills off
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
├── commands/       # 25+ command handlers (termasuk crawl, rag, graph, memory, workflow, skills)
├── engine/         # Provider router, deep scraper, scrape engine
│   ├── llmCrawler.js       # Firecrawl/Crawl4AI-style HTML→Markdown + BFS crawler + bridges
│   ├── adaptiveScraper.js  # Scrapling-style self-healing selectors + stealth headers
│   └── providers/  # 20 data providers (images/papers/datasets/forums/books/general)
├── jobs/           # Bottleneck job queue + workers
├── services/       # AI, cache, formatters, i18n, images, packaging,
│   │               # resilience, security, identity, watch, templates
│   ├── pdf/        # OpenDataLoader-style layout-aware PDF loader
│   ├── rag/        # RAGFlow-style chunking + Hybrid BM25/TF-IDF search
│   ├── graph/      # Graphify-style knowledge graph
│   ├── memory/     # Claude-Mem-style persistent 3-layer memory
│   ├── compression/# Headroom-style context compressor
│   ├── workflows/  # Dify-style declarative workflow engine
│   └── skills/     # Agent skill registry
└── utils/          # HTTP client, file system, validators, logger

skills/             # Agent Skills: karpathy-guidelines, superpowers, mattpocock-skills,
                    # ecc, anthropic-skills + SKILL.md untuk firecrawl, crawl4ai, scrapling,
                    # agent-reach, opendataloader-pdf, ragflow, graphify, claude-mem, headroom, dify
.agents/skills/     # Salinan skill untuk agent IDE (Antigravity/Claude/Cursor)
```

## 🙏 Sumber Inspirasi

Fitur baru diimplementasikan **native di Node.js** (tanpa dependensi Python) dengan konsep dari:
[Firecrawl](https://github.com/firecrawl/firecrawl) · [Crawl4AI](https://github.com/unclecode/crawl4ai) · [Scrapling](https://github.com/D4Vinci/Scrapling) · [Agent-Reach](https://github.com/Panniantong/Agent-Reach) · [OpenDataLoader-PDF](https://github.com/opendataloader-project/opendataloader-pdf) · [RAGFlow](https://github.com/infiniflow/ragflow) · [Graphify](https://github.com/Graphify-Labs/graphify) · [Claude-Mem](https://github.com/thedotmack/claude-mem) · [Headroom](https://github.com/headroomlabs-ai/headroom) · [Dify](https://github.com/langgenius/dify).
Agent Skills: [Karpathy Skills](https://github.com/multica-ai/andrej-karpathy-skills) · [Superpowers](https://github.com/obra/superpowers) · [Matt Pocock Skills](https://github.com/mattpocock/skills) · [ECC](https://github.com/affaan-m/ECC) · [Anthropic Skills](https://github.com/anthropics/skills).

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

