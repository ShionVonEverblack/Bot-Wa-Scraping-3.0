# Rima Bot WA Scraping 3.0 — Engineering Guardrails

1. **Deteksi Mention & Anti-Nimbrung**:
   - JANGAN PERNAH menggunakan `body.includes(botName)` untuk mendeteksi panggilan nama bot `"Rima"`, karena akan terpicu oleh kata bahasa Indonesia seperti *"terima kasih"*, *"darimana"*, *"kiriman"*, dan *"menerima"*.
   - Selalu gunakan *word-boundary regex* `(?:^|[\s.,!?@])rima(?:$|[\s.,!?:;])` dan hormati status per-chat dari `pause.handler.js` (`isChatPaused` & `isCommandOnlyMode`).

2. **Konvensi Pemanggilan HTTP pada Provider (`src/engine/providers/`)**:
   - Selalu impor `const httpClient = require('../../../utils/httpClient');` dan panggil `httpClient.get(...)` secara langsung.
   - Jangan mendestrukturisasi `{ get }` di tingkat modul agar `jest.spyOn(httpClient, 'get')` berfungsi di seluruh pengujian unit tanpa melakukan koneksi jaringan nyata.

3. **Sinkronisasi Multi-Turn Context Memory (`src/bot/nlp/contextMemory.js`)**:
   - Setiap handler yang mengekstrak teks dari tautan atau dokumen (`!crawl`, `!paper`, `handleSmartLinkDrop`) wajib menyimpan teks ke `lastDocumentText` dan judul ke `lastDocumentTitle` melalui `contextMemory.store(userId, ...)` agar pertanyaan AI lanjutan tetap memiliki konteks dokumen.
