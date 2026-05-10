# 📖 Rima — Dokumentasi Lengkap Bot Scraping WhatsApp 3.0

> **Rima** adalah bot WhatsApp all-in-one untuk pencarian data (gambar, paper akademik, dataset, web) dengan Natural Language Processing, multi-AI provider, dan 13 data source. Dibangun dengan Node.js, whatsapp-web.js, dan Puppeteer.

---

## 1. Gambaran Umum

### Apa itu Rima?
Bot asisten WhatsApp yang bisa:
- **Mencari data** dari 13+ sumber (Unsplash, arXiv, Kaggle, Wikipedia, dll)
- **Chat dengan AI** (OpenAI, Gemini, Groq, Grok) dengan konteks multi-turn
- **Download paper akademik** via DOI/arXiv ID
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
| NLP | 2-layer: regex rules → AI fallback |
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
  ┌──────────────────┐
  │ messageHandler   │  ← Central router
  │  1. Sanitize     │  ← sanitizeInput()
  │  2. Rate limit   │  ← checkRateLimit()
  │  3. Cooldown     │  ← 3s per user
  │  4. Command?     │  ── Yes ──▶ commands/handlers/*.handler.js
  │  5. NLP classify │  ── Intent detected ──▼
  └──────────────────┘
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
    │       ├── Try provider by priority (highest first)
    │       ├── Record success/failure → circuit breaker
    │       └── Fallback to next provider on failure
    ├── 3. Normalize items (consistent fields)
    ├── 4. Deduplicate (by URL)
    ├── 5. Rank by relevance (keyword matching + metadata)
    ├── 6. Cache result for future requests
    └── 7. Return to jobWorker → send to WhatsApp
```

### Struktur Direktori
```
Bot scraping 3.0/
├── index.js                    # Entry point, bootstrap, shutdown
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
│   │   │   ├── intentClassifier.js  # 2-layer: regex → AI fallback
│   │   │   ├── entityExtractor.js   # Extract keyword, type, limit, DOI
│   │   │   └── contextMemory.js     # Per-user conversation memory (TTL 30min)
│   │   ├── wizard/             # Step-by-step guided wizard
│   │   ├── menu/               # Menu templates
│   │   └── templates/          # Message templates
│   │
│   ├── commands/handlers/      # 23 Command Handlers
│   │   ├── scrape.handler.js   # !scrape <keyword> --type --limit
│   │   ├── paper.handler.js    # !paper <DOI/arXiv>
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

## 3. Data Providers (13 Total)

### Images (4 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| Unsplash | ✅ `UNSPLASH_ACCESS_KEY` | 90 | High-quality photos |
| Pexels | ✅ `PEXELS_API_KEY` | 85 | Stock photos |
| Pixabay | ✅ `PIXABAY_API_KEY` | 80 | Free images |
| Wikimedia | ❌ | 70 | Wikipedia commons |

### Papers (4 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| OpenAlex | ❌ (email recommended) | 90 | 250M+ academic works |
| arXiv | ❌ | 85 | Preprints |
| Crossref | ❌ (email recommended) | 80 | DOI metadata |
| Semantic Scholar | Optional `S2_API_KEY` | 75 | AI-powered citations |

### Datasets (2 providers)
| Provider | API Key? | Priority | Source |
|----------|----------|----------|--------|
| Kaggle | ✅ `KAGGLE_USERNAME` + `KAGGLE_KEY` | 90 | ML datasets |
| HuggingFace | ❌ | 85 | AI/ML models & datasets |

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

### Safety
- **System prompt** membatasi perilaku AI
- **Output filter** menyaring konten berbahaya
- **Secret redaction** mencegah API keys bocor di output

---

## 5. NLP (Natural Language Processing)

### 2-Layer Classification
1. **Layer 1 — Regex Rules**: Pattern matching cepat untuk intent yang jelas
2. **Layer 2 — AI Fallback**: Jika regex tidak cocok, gunakan AI untuk klasifikasi

### Intents
| Intent | Contoh Pesan | Aksi |
|--------|-------------|------|
| `COMMAND` | `!scrape kucing` | Route ke command handler |
| `SCRAPE` | "cari gambar kucing" | Buat scrape job |
| `PAPER_DOWNLOAD` | "download 10.1038/s41586" | Download paper PDF |
| `IMAGE_ANALYZE` | "analisa gambar ini" | AI vision analysis |
| `AI_CHAT` | "apa itu neural network?" | Chat dengan AI |
| `GREETING` | "halo", "hi" | Salam + menu |
| `UNKNOWN` | (lainnya) | Fallback ke AI chat |

### Entity Extraction
Dari teks natural language, bot mengekstrak:
- **Keyword**: "cari gambar `kucing lucu`" → keyword = "kucing lucu"
- **Type**: "cari `paper` deep learning" → type = "papers"
- **Limit**: "cari 20 gambar" → limit = 20
- **Identifier**: DOI, arXiv ID, PMID dari teks

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
| Command | Deskripsi | Contoh |
|---------|-----------|--------|
| `!scrape` | Cari data | `!scrape kucing --type images --limit 20` |
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
| `!menu` | Menu utama | `!menu` |
| `!help` | Bantuan | `!help` |

### Natural Language (Tanpa Command)
Bot memahami bahasa natural (Indonesia & English):
```
"cari gambar kucing lucu 20"       → Scrape 20 images "kucing lucu"
"carikan paper machine learning"   → Scrape papers "machine learning"
"download paper arXiv 2301.07041"  → Download paper
"apa itu deep learning?"           → AI chat
"analisa gambar ini"               → Image analysis (reply to image)
```

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
# Run semua test
node ./node_modules/jest/bin/jest.js --verbose

# Run test spesifik
node ./node_modules/jest/bin/jest.js tests/utils/errorMessages.test.js
```

**Test coverage saat ini:** 11 suites, 73 tests — mencakup utils, NLP, validators, cache, circuit breaker, formatters, wizard, job schemas, dan error messages.

---

## 12. Limitasi & Catatan

| Item | Status |
|------|--------|
| **State persistence** | ❌ In-memory (hilang saat restart) — rencana migrasi ke SQLite |
| **Web dashboard** | ❌ Belum ada — rencana monitoring dashboard |
| **Cloud export** | ❌ Belum ada — rencana Google Drive/Dropbox |
| **Auto-retry** | ⚠️ Partial — job bisa di-resume manual, belum auto |
| **Multi-device** | ✅ Supported via whatsapp-web.js LocalAuth |
| **Bahasa** | ✅ Indonesia + English (NLP bilingual) |

---

## 13. Glossary

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

---

*Dokumentasi ini dibuat pada 2026-05-10. Untuk perubahan terbaru, lihat commit history.*