# 📖 Rima — Dokumentasi Lengkap Bot Scraping WhatsApp 3.0

> **Rima** adalah bot WhatsApp all-in-one untuk pencarian data (gambar, paper akademik, dataset, buku, forum, web) dengan 3-Layer NLP, multi-AI provider, dan 19 data source. Dibangun dengan Node.js, whatsapp-web.js, dan Puppeteer.

---

## 1. Gambaran Umum

### Apa itu Rima?
Bot asisten WhatsApp yang bisa:
- **Mencari data** dari 19+ sumber (Unsplash, Zenodo, Reddit, Safebooru, arXiv, Kaggle, Wikipedia, dll)
- **Chat dengan AI** (OpenAI, Gemini, Groq, Grok) dengan konteks multi-turn
- **Download paper akademik** via DOI/arXiv ID/PMID dengan smart resolver (Europe PMC, Sci-Hub fallback)
- **Deep scrape** halaman web dengan Puppeteer + Brave browser
- **Analisa gambar** menggunakan AI vision
- **Jadwalkan pencarian** otomatis (hourly/daily/weekly)

### Tech Stack
| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js v18+ |
| WhatsApp | whatsapp-web.js + Puppeteer |
| Browser | Brave Browser (auto-detect) |
| AI | OpenAI, Gemini, Groq, Grok (auto-fallback) |
| NLP | 3-Layer: Neural Network (`node-nlp`) → Regex rules → AI fallback |
| Job Queue | Bottleneck (concurrency limiter) |
| Scheduling | node-cron |
| HTTP | Axios |
| Scraping | Cheerio + Puppeteer |

---

## 2. Arsitektur Sistem

### Alur Kerja (Message Flow)
```
User mengirim pesan WhatsApp
        │
        ▼
  ┌─────────────┐
  │ client.js   │  ← whatsapp-web.js event listener
  └──────┬──────┘
         ▼
  ┌──────────────────────────────┐
  │ messageHandler               │  ← Central router
  │  1. Sanitize                 │  ← sanitizeInput()
  │  2. Rate limit               │  ← checkRateLimit()
  │  3. Cooldown                 │  ← 3s per user
  │  4. Command?                 │  ── Yes ──▶ commands/handlers/*.handler.js
  │  5. 3-Layer NLP Classifier:  │  ── Intent detected ──▼
  │     a. Local Neural Network  │
  │     b. Regex Fallback        │
  │     c. AI Fallback           │
  └──────────────────────────────┘
         │
    ┌────┴─────────────────────────┐
    │  INTENTS:                    │
    │  SCRAPE → jobManager         │
    │  AI_CHAT → aiService.chat()  │
    │  PAPER_DOWNLOAD → paperWorker│
    │  IMAGE_ANALYZE → AI vision   │
    │  GREETING → template reply   │
    │  UNKNOWN → AI fallback       │
    └──────────────────────────────┘
```

### Scraping Pipeline
```
jobManager.createJob()
    │
    ▼
jobQueue.enqueue()  ← Bottleneck (max 3 concurrent)
    │
    ▼
scrapeEngine.scrape()
    │
    ├── 1. Cache check (hit? return cached)
    ├── 2. providerRouter.route()
    │       ├── Circuit breaker check (skip if OPEN)
    │       ├�Bot scraping 3.0/
├── index.js                    # Entry point, bootstrap, shutdown
├── model.nlp                   # Model biner hasil training NLP offline
├── .env / .env.example         # Konfigurasi environment
├── package.json                # Dependencies & scripts
├── Dockerfile                  # Docker support
├── docker-compose.yml
│
├── src/
│   ├── config.js               # Centralized config parser (frozen object)
│   │
│   ├── bot/                    # WhatsApp Bot Core
│   │   ├── client.js           # WhatsApp client setup + Brave auto-detect
│   │   ├── clientManager.js    # Start/restart/shutdown lifecycle
│   │   ├── messageHandler.js   # Central message router (sanitize → rate limit → NLP)
│   │   ├── nlp/
│   │   │   ├── nlpManager.js        # node-nlp manager (training & classification offline)
│   │   │   ├── intentClassifier.js  # 3-layer: Neural Network → regex → AI fallback
│   │   │   ├── entityExtractor.js   # Extract keyword, type, limit, DOI, --ai flag
│   │   │   └── contextMemory.js     # Per-user conversation memory (TTL 30min)
│   │   ├── wizard/             # Step-by-step guided wizard
│   │   ├── menu/               # Menu templates
│   │   └── templates/          # Message templates
│   │
│   ├── commands/handlers/      # 23 Command Handlers
│   │   ├── scrape.handler.js   # !scrape <keyword> --type --limit [--ai]
│   │   ├── paper.handler.js    # !paper <DOI/arXiv/PMID>
│   │   ├── deepscrape.handler.js  # !deepscrape <URL>
│   │   ├── ai.handler.js       # !ai <question>
│   │   ├── analyze.handler.js  # !analyze (reply to image)
│   │   ├── watch.handler.js    # !watch <keyword> --every daily
│   │   ├── wizard.handler.js   # !wizard (guided flow)
│   │   ├── menu.handler.js     # !menu
│   │   ├── help.handler.js     # !help
│   │   ├── health.handler.js   # !health (system status)
│   │   ├── history.handler.js  # !history (job history)
│   │   ├── status.handler.js   # !status <jobId>
│   │   ├── cancel.handler.js   # !cancel <jobId>
│   │   ├── next.handler.js     # !next <jobId> (pagination)
│   │   ├── continue.handler.js # !continue (resume context)
│   │   ├── send.handler.js     # !send <format> (export results)
│   │   ├── template.handler.js # !template (scrape templates)
│   │   ├── compress.handler.js # !compress (ZIP files)
│   │   ├── resolve.handler.js  # !resolve <DOI> (metadata lookup)
│   │   ├── watches.handler.js  # !watches (list active watches)
│   │   ├── unwatch.handler.js  # !unwatch <id>
│   │   ├── settings.handler.js # !settings
│   │   └── lang.handler.js     # !lang <id|en>
│   │
│   ├── engine/                 # Scraping Engine
│   │   ├── scrapeEngine.js     # Pipeline orchestrator (cache→route→norm→dedup→rank)
│   │   ├── providerRouter.js   # Multi-provider routing + circuit breaker
│   │   ├── deepScraper.js      # Full-page scraping with Puppeteer
│   │   └── providers/          # 19 Data Providers
│   │       ├── index.js        # Auto-discovery registry
│   │       ├── books/          # Google Books
│   │       ├── datasets/       # Kaggle, HuggingFace, Zenodo
│   │       ├── forums/         # Reddit
│   │       ├── images/         # Unsplash, Pexels, Pixabay, Wikimedia, RedditImages, Safebooru
│   │       ├── papers/         # OpenAlex, arXiv, Crossref, Semantic Scholar, Europe PMC
│   │       └── general/        # DuckDuckGo, Wikipedia, Puppeteer
es.handler.js  # !watches (list active watches)
│   │   ├── unwatch.handler.js  # !unwatch <id>
│   │   ├── settings.handler.js # !settings
│   │   └── lang.handler.js     # !lang <id|en>
│   │
│   ├── engine/                 # Scraping Engine
│   │   ├── scrapeEngine.js     # Pipeline orchestrator (cache→route→norm→dedup→rank)
│   │   ├── providerRouter.js   # Multi-provider routing + circuit breaker
│   │   ├── deepScraper.js      # Full-page scraping with Puppeteer
│   │   └── providers/          # 13 Data Providers
│   │       ├── index.js        # Auto-discovery registry
│   │       ├── images/         # Unsplash, Pexels, Pixabay, Wikimedia
│   │       ├── papers/         # OpenAlex, arXiv, Crossref, Semantic Scholar
│   │       ├── datasets/       # Kaggle, HuggingFace
│   │       └── general/        # DuckDuckGo, Wikipedia, Puppeteer
│   │
│   ├── jobs/                   # Async Job System
│   │   ├── jobManager.js       # Job creation, access control, resume
│   │   ├── jobQueue.js         # Bottleneck-based queue + cancellation
│   │   ├── jobWorker.js        # Scrape job processor
│   │   ├── paperWorker.js      # Paper download processor
│   │   ├── jobStore.js         # In-memory job storage
│   │   └── jobSchemas.js       # Job object schema & constants
│   │
│   ├── services/
│   │   ├── ai/                 # AI Integration
│   │   │   ├── aiService.js    # Unified interface + auto-fallback
│   │   │   ├── providers/      # OpenAI, Gemini, Groq, Grok adapters
│   │   │   └── safety/         # System prompt, output filter, secret redaction
│   │   ├── cache/              # In-memory TTL cache
│   │   ├── resilience/         # Circuit breaker pattern
│   │   ├── security/           # Rate limiter, access control, input sanitization
│   │   ├── formatters/         # JSON, CSV, TSV, HTML, Excel, SQL, TXT
│   │   ├── packaging/          # ZIP archiver
│   │   ├── images/             # Sharp image processing
│   │   ├── watch/              # Cron-based scheduled scrapes
│   │   ├── i18n/               # Internationalization (ID/EN)
│   │   ├── identity/           # Bot identity/persona
│   │   ├── monitor/            # Logger (winston-style)
│   │   └── scrapeTemplates/    # Predefined scrape configurations
│   │
│   └── utils/
│       ├── httpClient.js       # Axios wrapper with retry + timeout
│       ├── fsUtil.js           # File system helpers (ensureDir, readJson, writeJson)
│       ├── text.js             # Text utils (stripMentions, truncate, splitArgs)
│       ├── time.js             # Time formatting
│       ├── id.js               # Unique ID generator
│       ├── validators.js       # Input normalization (type, format, limit)
│       └── errorMessages.js    # Technical → user-friendly error mapping
│
└── tests/                      # Jest test suites (73 tests)
```

---

## 3. Data Providers (19 Total)

### Images (6 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| Unsplash | ✅ `UNSPLASH_ACCESS_KEY` | 90 | High-quality photos |
| Pexels | ✅ `PEXELS_API_KEY` | 85 | Stock photos |
| Pixabay | ✅ `PIXABAY_API_KEY` | 80 | Free images |
| RedditImages | ❌ | 75 | Subreddit images (r/pics, etc.) |
| Safebooru | ❌ | 70 | Anime art & illustration database |
| Wikimedia | ❌ | 65 | Wikipedia commons |

### Papers (5 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| OpenAlex | ❌ (email recommended) | 90 | 250M+ academic works |
| arXiv | ❌ | 85 | Preprints |
| Europe PMC | ❌ | 80 | Life science & biomedical literature |
| Crossref | ❌ (email recommended) | 75 | DOI metadata |
| Semantic Scholar | Optional `S2_API_KEY` | 70 | AI-powered citations |

### Datasets (3 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| Kaggle | ✅ `KAGGLE_USERNAME` + `KAGGLE_KEY` | 90 | ML datasets |
| HuggingFace | ❌ | 85 | AI/ML models & datasets |
| Zenodo | ❌ | 80 | Open scientific datasets & publications |

### Forums (1 provider)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| Reddit | ❌ | 80 | Reddit posts & discussions |

### Books (1 provider)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| Google Books | ❌ | 80 | Google Books metadata & search |

### General (3 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| DuckDuckGo | ❌ | 70 | Instant answers |
| Wikipedia | ❌ | 75 | Encyclopedia |
| Puppeteer | ❌ (needs Brave) | 60 | Full page scraping |

### Provider Fallback
Providers dicoba berurutan dari **priority tertinggi**. Jika gagal, circuit breaker mencatat kegagalan. Setelah 5 kegagalan berturut-turut, provider di-skip selama 60 detik (konfigurabel via `CB_FAILURE_THRESHOLD` dan `CB_RESET_TIMEOUT_MS`).

---

## 4. AI System

### Providers & Fallback
Urutan default: **OpenAI → Gemini → Groq → Grok**. Jika provider pertama gagal (error/timeout), otomatis coba provider berikutnya.

| Provider | Model Default | Fitur |
|----------|---------------|-------|
| OpenAI | gpt-4o-mini | Chat, vision, summary |
| Gemini | gemini-1.5-flash | Chat, vision, summary |
| Groq | llama3-70b-8192 | Chat, summary (cepat) |
| Grok | grok-4 | Chat, summary |

### Multi-Turn Conversation
Bot menyimpan **6 pesan terakhir** per user di `contextMemory` (TTL 30 menit). Setiap pesan AI baru menyertakan history ini, sehingga AI "ingat" konteks percakapan.

### On-Demand AI Summary
Fitur baru yang memungkinkan peringkasan instan pada data hasil scraping.
- **Cara Kerja**: Jika opsi `--ai` ditambahkan pada command atau terdeteksi oleh NLP, bot akan mengarahkan data mentah hasil scraping ke `aiService.summarizeResults()`.
- **Provider AI**: Summarization diproses oleh AI provider utama (atau fallback) untuk menghasilkan poin-poin ringkasan yang ringkas dan padat langsung di WhatsApp, disertai bonus lampiran file mentah.

### Safety
- **System prompt** membatasi perilaku AI
- **Output filter** menyaring konten berbahaya
- **Secret redaction** mencegah API keys bocor di output

---

## 5. NLP (Natural Language Processing)

### 3-Layer Classification
Klasifikasi intent sekarang sangat andal dan cerdas dengan 3 lapis keamanan:
1. **Layer 1 — Local Neural Network (node-nlp)**: Klasifikasi super cepat secara offline yang toleran terhadap typo, mendukung multibahasa (ID/EN), dan dilatih langsung pada dataset intensif. Menggunakan file model binary `model.nlp` lokal.
2. **Layer 2 — Regex Rules (Fallback)**: Pattern matching langsung untuk intent yang memiliki pola tegas (seperti format DOI, tautan arXiv, atau explicit command).
3. **Layer 3 — AI Fallback (LLM API)**: Jika Neural Network lokal dan Regex tidak yakin, pesan dikirim ke LLM API untuk diklasifikasi secara semantik agar tidak salah dalam merespons pesan pengguna.

### Intents
| Intent | Contoh Pesan | Aksi |
|--------|-------------|------|
| `COMMAND` | `!scrape kucing` | Route ke command handler |
| `SCRAPE` | "cari gambar kucing", "tolong scrape zenodo covid" | Buat scrape job |
| `PAPER_DOWNLOAD` | "download 10.1038/s41586" | Download paper PDF |
| `IMAGE_ANALYZE` | "analisa gambar ini" | AI vision analysis (vision api) |
| `AI_CHAT` | "apa itu neural network?" | Chat dengan AI |
| `GREETING` | "halo", "hi" | Salam + menu utama |
| `UNKNOWN` | (lainnya) | Fallback ke AI chat |

### Entity Extraction
Dari teks natural language, bot mengekstrak entities berikut secara otomatis:
- **Keyword**: "cari gambar `kucing lucu`" → keyword = "kucing lucu"
- **Type**: "cari `paper` deep learning" → type = "papers"
- **Limit**: "cari 20 gambar" → limit = 20
- **Identifier**: DOI, arXiv ID, PMID, PMC dari teks
- **AI Summary Flag**: "cari paper AI --ai" atau "cari gambar kucing +ai" → useAI = true

---

## 6. Job System

### Lifecycle
```
PENDING → RUNNING → COMPLETED
                  → FAILED (auto-retry available)
                  → CANCELLED (via !cancel)
```

### Concurrency
Menggunakan **Bottleneck** dengan `MAX_CONCURRENCY=3` (default). Job di-queue dan diproses berurutan dengan jeda minimum 500ms.

### Progress Updates
Saat job berjalan, user menerima progress bar di WhatsApp:
```
⏳ Mencari images "kucing"...
▓▓░░░░░░░░ 20%
```

### Job Types
- `SCRAPE` → `jobWorker.js` (melalui scrapeEngine pipeline)
- `DOWNLOAD_PAPER` → `paperWorker.js` (resolver chain: Unpaywall → OpenAlex → arXiv → Crossref)

---

## 7. Cara Menggunakan

### Setup
```bash
# 1. Clone & install
git clone <repo-url>
cd "Bot scraping 3.0"
npm install

# 2. Configure
cp .env.example .env
# Edit .env → isi minimal 1 AI key (OPENAI_API_KEY atau GEMINI_API_KEY)

# 3. Run
node index.js
# Scan QR code yang muncul di terminal dengan WhatsApp
```

### Commands
| Command | Deskripsi | Contoh / Opsi Baru |
|---------|-----------|--------------------|
| `!scrape` | Cari data dari 19+ provider | `!scrape machine learning --type papers --ai` (dengan summary AI)<br>`!scrape anime --type images --provider safebooru` |
| `!paper` | Download paper | `!paper 10.1038/s41586-020-2649-2` |
| `!deepscrape` | Scrape halaman web | `!deepscrape https://example.com` |
| `!ai` | Tanya AI | `!ai apa itu machine learning?` |
| `!analyze` | Analisa gambar | Reply ke gambar + `!analyze` |
| `!watch` | Jadwalkan scrape | `!watch AI news --every daily` |
| `!unwatch` | Hapus jadwal | `!unwatch W12345` |
| `!watches` | Lihat jadwal aktif | `!watches` |
| `!wizard` | Guided wizard | `!wizard` |
| `!next` | Halaman berikutnya | `!next JOB123` |
| `!cancel` | Batalkan job | `!cancel JOB123` |
| `!status` | Cek status job | `!status JOB123` |
| `!history` | Riwayat job | `!history` |
| `!send` | Export hasil | `!send csv` |
| `!compress` | ZIP file | `!compress` |
| `!template` | Template scrape | `!template list` |
| `!resolve` | Lookup DOI | `!resolve 10.1038/...` |
| `!health` | Status sistem | `!health` |
| `!settings` | Lihat setting | `!settings` |
| `!lang` | Ganti bahasa | `!lang en` |
| `!menu` | Menu interaktif (Native Polls) / Teks | `!menu` (tombol interaktif)<br>`!menu text` (menu teks klasik) |
| `!help` | Bantuan lengkap | `!help` |
| `!crawl` | Web → Markdown LLM-ready / crawl multi-halaman | `!crawl https://example.com --max 3 --depth 1`<br>`!crawl <url> --bridge native\|jina\|firecrawl`<br>`!crawl <url> --selector "article h2"` |
| `!rag` | Tanya-jawab dokumen/web dengan sitasi | `!rag ingest <url\|jobId\|teks>`<br>`!rag ask apa metodologinya?`<br>`!rag stats` / `!rag list` / `!rag clear` |
| `!graph` | Knowledge graph dari job/URL/keyword/teks | `!graph <jobId\|url\|keyword>` |
| `!memory` | Memori persisten lintas sesi | `!memory remember <fakta>`<br>`!memory search <kata>` / `timeline <obsId>` / `get <obsId>`<br>`!memory compress <jobId\|teks>` / `list` / `clear` |
| `!workflow` | Workflow agentik deklaratif | `!workflow list`<br>`!workflow run deep-research <topik>`<br>`!workflow run url-to-rag <url>`<br>`!workflow run quick-digest <topik_atau_url>` |
| `!skills` | Jelajahi & aktifkan Agent Skills | `!skills list <kata>` / `info <nama>` / `use <nama>` / `off` |

### Natural Language (Tanpa Command)
Bot memahami bahasa natural (Indonesia & English) dengan sangat cerdas & toleran terhadap salah ketik:
```
"cari gambar kucing lucu 20 --ai"     → Scrape 20 images + ringkas dengan AI
"tolong cari dataset covid di zenodo"  → Scrape dataset spesifik di Zenodo
"carikan paper machine learning +ai"   → Scrape papers + ringkas hasil dengan AI
"download paper arXiv 2301.07041"      → Mengunduh paper secara otomatis
"apa itu deep learning?"               → Chat multi-turn dengan AI
"analisa gambar ini"                   → Image analysis (vision AI)
```

### Interaktivitas & UX Cerdas
- **WhatsApp Native Polls Menu (`!menu`)**: Menu utama disajikan berupa tombol interaktif WhatsApp Native Polls resmi (`new Poll`, `allowMultipleAnswers: false`) yang aman anti-ban dan kompatibel multi-device (MD). Menyediakan panduan berantai interaktif (wizard) saat tombol diklik.
- **Emoji Status Reactions**: Bot memberikan feedback langsung via reaksi emoji pada pesan: `⏳` (memproses), `✅` (berhasil), `❌` (gagal), dan `❓` (perintah tidak dikenal).
- **Fuzzy Typo Suggestion**: Deteksi otomatis salah ketik perintah via algoritma Damerau-Levenshtein (contoh: `!scraep` -> `!scrape`).
- **Auto-Delivery Dokumen**: File hasil crawl (`.md`) dan laporan unduhan langsung dikirimkan ke chat via `MessageMedia.fromFilePath`.

### Grup vs DM
- **DM (Private Chat)**: Bot merespon semua pesan
- **Grup**: Bot hanya merespon jika di-mention (`@Rima`) atau pesan diawali `!command` (konfigurabel via `GROUP_REQUIRE_MENTION`)

---

## 8. Security & Resilience

| Fitur | Deskripsi |
|-------|-----------|
| **Input Sanitization** | Null bytes, control chars dihapus sebelum diproses |
| **Rate Limiter** | Max 30 pesan/menit per user |
| **Cooldown** | 3 detik antar pesan (konfigurabel) |
| **Circuit Breaker** | Provider gagal 5x → skip 60 detik |
| **Access Control** | Allow/deny list + admin phones |
| **Secret Redaction** | API keys otomatis di-redact dari output AI |
| **Graceful Shutdown** | Stop watches → drain queue → close browser |

---

## 9. Konfigurasi (.env)

### Wajib
| Variable | Deskripsi |
|----------|-----------|
| `OPENAI_API_KEY` atau `GEMINI_API_KEY` | Minimal 1 AI provider |

### Opsional (Rekomendasi)
| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `BOT_NAME` | Rima | Nama bot |
| `AI_PROVIDER` | openai | AI provider utama |
| `AI_FALLBACK_ORDER` | openai,gemini,groq,grok | Urutan fallback |
| `MAX_CONCURRENCY` | 3 | Maks job bersamaan |
| `USER_COOLDOWN_MS` | 3000 | Cooldown per user (ms) |
| `CACHE_TTL_SECONDS` | 300 | Cache TTL (5 menit) |
| `CB_FAILURE_THRESHOLD` | 5 | Trip circuit setelah N gagal |
| `RESULT_LIMIT_DEFAULT` | 10 | Default hasil per pencarian |
| `RESULT_LIMIT_MAX` | 50 | Maks hasil per pencarian |
| `PUPPETEER_HEADLESS` | false | Headless browser mode |

### Opsional — LLM Crawler, RAG, Graph, Memory & Workflow
Semua fitur ini berjalan **native di Node.js** tanpa konfigurasi. Variabel berikut hanya untuk tuning atau mengaktifkan *bridge* eksternal.

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `FIRECRAWL_API_KEY` | – | Aktifkan bridge Firecrawl API (`--bridge firecrawl`) |
| `FIRECRAWL_BASE_URL` | `https://api.firecrawl.dev/v1` | Endpoint Firecrawl (bisa self-hosted) |
| `CRAWL4AI_API_URL` / `CRAWL4AI_API_KEY` | – | Bridge ke server Crawl4AI |
| `USE_JINA_READER` | `false` | Pakai Jina Reader sebagai reader fallback |
| `CRAWL_MAX_PAGES` | `5` | Maks halaman per `!crawl` (hard cap 25) |
| `CRAWL_MAX_DEPTH` | `2` | Maks kedalaman BFS (hard cap 5) |
| `RAG_CHUNK_SIZE` | `800` | Ukuran chunk (karakter) |
| `RAG_CHUNK_OVERLAP` | `150` | Overlap antar chunk |
| `RAG_TOP_K` | `5` | Jumlah chunk teratas untuk jawaban |
| `RAGFLOW_API_URL` / `RAGFLOW_API_KEY` / `RAGFLOW_DATASET_ID` | – | Bridge ke RAGFlow |
| `USE_GRAPHIFY_CLI` | `false` | Pakai Graphify CLI jika terpasang |
| `MEMORY_PERSIST` | `true` | Simpan memori ke disk |
| `MEMORY_MAX_OBSERVATIONS` | `200` | Batas observasi tersimpan |
| `DIFY_API_URL` / `DIFY_API_KEY` | `https://api.dify.ai/v1` / – | Bridge ke Dify workflow API |

Lihat `.env.example` untuk daftar lengkap semua variable.

---

## 10. Docker

```bash
# Build & run
docker-compose up -d

# Logs
docker-compose logs -f
```

`Dockerfile` menggunakan Node.js 18 Alpine + Chromium. `docker-compose.yml` meng-mount volume untuk `auth/`, `outputs/`, dan `cache/`.

---

## 11. Testing

```bash
# Run semua test (dengan coverage)
npx jest --coverage

# Run test spesifik
npx jest tests/wizard/wizard.test.js
```

**Test coverage saat ini:** 40 suites, 605 tests — mencakup fungsi inti, utilitas, NLP, memori konteks, formatter, wizard, timeout, circuit breaker, job system (termasuk *adversarial stress test* & regression test untuk bug allowList bypass, overwrite status CANCELLED, dan cancel yang mengabaikan AbortSignal), serta E2E 3-tier untuk LLM crawler, adaptive scraper, PDF/RAG, knowledge graph, memory, compression, dan workflow.

---

## 12. QR Code Web Dashboard

Rima menyediakan **web dashboard** untuk memonitor status bot dan men-scan QR code WhatsApp dari browser — sangat berguna saat bot di-deploy ke VPS atau Docker di mana akses terminal terbatas.

### Akses Dashboard
Setelah menjalankan `node index.js`, buka browser dan akses:
```
http://localhost:3000
```

Port dapat diubah via `.env`:
```env
DASHBOARD_PORT=3000
```

### Fitur Dashboard
| Fitur | Deskripsi |
|-------|-----------|
| **QR Code Visual** | Tampilan QR code besar dan jelas untuk di-scan via HP |
| **Status Real-time** | Menunjukkan status koneksi (Menunggu Scan / Terautentikasi / Online / Terputus) |
| **Metrik Sistem** | Uptime, penggunaan memori, versi Node.js, dan environment |
| **Auto-refresh** | Halaman otomatis refresh setiap 5 detik |
| **REST API** | Endpoint JSON untuk integrasi monitoring eksternal |

### API Endpoints
| Endpoint | Deskripsi |
|----------|-----------|
| `GET /` | Halaman dashboard HTML |
| `GET /api/status` | Status bot dalam format JSON |
| `GET /api/qr` | QR code sebagai data URL (base64) |
| `GET /api/qr.png` | QR code sebagai gambar PNG langsung |

---

## 13. Limitasi & Catatan

| Item | Status |
|------|--------|
| **State persistence** | ✅ Job tersimpan di `jobs/*.json` & di-resume saat restart; memori `!memory` persisten di disk |
| **Web dashboard** | ✅ Tersedia di `http://localhost:3000` (lihat bagian 12) |
| **Cloud export** | ❌ Belum ada — rencana Google Drive/Dropbox |
| **Auto-retry** | ⚠️ Partial — job bisa di-resume manual, belum auto |
| **Multi-device** | ✅ Supported via whatsapp-web.js LocalAuth |
| **Bahasa** | ✅ Indonesia + English (NLP bilingual) |

---

## 14. Glossary

| Term | Definisi |
|------|---------|
| **Provider** | Sumber data (API) seperti Unsplash, arXiv, Kaggle |
| **Circuit Breaker** | Pattern yang menghentikan request ke provider yang terus gagal |
| **Intent** | Maksud user yang terdeteksi oleh NLP (SCRAPE, AI_CHAT, dll) |
| **Job** | Unit kerja async yang di-queue dan diproses di background |
| **Watch** | Pencarian terjadwal yang berjalan otomatis via cron |
| **Context Memory** | Penyimpanan konteks percakapan per user (TTL 30 menit) |
| **Deep Scrape** | Full-page scraping menggunakan headless browser (Puppeteer) |
| **Wizard** | Mode step-by-step yang memandu user membuat pencarian |
| **Fit-Markdown** | Markdown yang sudah dibersihkan dari boilerplate (nav, iklan, footer) agar hemat token untuk LLM |
| **Adaptive Selector** | Selector CSS yang bisa "menyembuhkan diri" dengan mencari elemen paling mirip saat struktur web berubah |
| **RAG** | *Retrieval-Augmented Generation* — AI menjawab berdasarkan potongan dokumen yang relevan, dengan sitasi |
| **RRF** | *Reciprocal Rank Fusion* — penggabungan ranking BM25 (kata kunci) & TF-IDF cosine (vektor) |
| **God Node** | Entitas dengan sentralitas tertinggi dalam knowledge graph |
| **Observation** | Satu unit memori persisten (`!memory`) yang bisa dicari via index → timeline → detail |
| **Agent Skill** | Paket instruksi `SKILL.md` yang bisa diaktifkan untuk memandu perilaku AI |

---

## 15. Modul Baru (Crawler, RAG, Graph, Memory, Workflow, Skills)

Semua modul diimplementasikan **native di Node.js** (langsung jalan tanpa Python), dengan *bridge* opsional ke layanan eksternal bila dikonfigurasi.

| Modul | File | Terinspirasi dari | Kemampuan |
|-------|------|-------------------|-----------|
| LLM Crawler | `src/engine/llmCrawler.js` | Firecrawl, Crawl4AI, Agent-Reach | `htmlToMarkdown`, Fit-Markdown, ekstraksi metadata & tabel, `crawlSite` (BFS, dedup redirect/canonical, blokir `javascript:`/`data:`), bridge Jina/Firecrawl/Crawl4AI |
| Adaptive Scraper | `src/engine/adaptiveScraper.js` | Scrapling | Element signature, similarity scoring, `relocateElement`, `adaptiveExtract`, stealth headers |
| PDF Loader | `src/services/pdf/pdfLoader.js` | OpenDataLoader-PDF | Parsing PDF layout-aware (heading, tabel, urutan baca), dekode stream FlateDecode, bridge CLI opsional |
| RAG Engine | `src/services/rag/ragEngine.js` | RAGFlow | Chunking sadar struktur, tabel Markdown atomik, Hybrid BM25 + TF-IDF (RRF), jawaban dengan sitasi |
| Knowledge Graph | `src/services/graph/knowledgeGraph.js` | Graphify | Ekstraksi entitas & relasi, God Nodes, deteksi komunitas, ekspor Mermaid |
| Persistent Memory | `src/services/memory/persistentMemory.js` | Claude-Mem | 3-layer progressive disclosure: `searchIndex` → `getTimeline` → `getObservations`, persist ke disk |
| Context Compressor | `src/services/compression/contextCompressor.js` | Headroom | `smartCrushJson`, `compressText`, `compressChatHistory` untuk hemat token |
| Workflow Engine | `src/services/workflows/workflowEngine.js` | Dify | Workflow deklaratif `deep-research`, `url-to-rag`, `quick-digest` + bridge Dify API |
| Skill Registry | `src/services/skills/skillRegistry.js` | Anthropic Skills dkk. | Indeks 395 `SKILL.md` dari folder `skills/` |

### Agent Skills yang Terpasang
| Folder | Sumber |
|--------|--------|
| `skills/karpathy-guidelines`, `skills/andrej-karpathy-skills-main`, `CLAUDE.md`, `.cursor/rules/karpathy-guidelines.mdc` | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) |
| `skills/superpowers` | [obra/superpowers](https://github.com/obra/superpowers) |
| `skills/mattpocock-skills` | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `skills/ecc` | [affaan-m/ECC](https://github.com/affaan-m/ECC) |
| `skills/anthropic-skills` | [anthropics/skills](https://github.com/anthropics/skills) |
| `skills/{firecrawl,crawl4ai,scrapling,agent-reach,opendataloader-pdf,ragflow,graphify,claude-mem,headroom,dify}` | `SKILL.md` ringkasan integrasi tiap repo |

Salinan untuk agent IDE tersedia di `.agents/skills/`.

---

*Dokumentasi ini terakhir diperbarui pada 2026-10-22. Untuk perubahan terbaru, lihat commit history.*