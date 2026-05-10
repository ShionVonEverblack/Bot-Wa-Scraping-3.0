'use strict';

/**
 * @fileoverview Wizard prompts — text prompts for each wizard step.
 * @module bot/wizard/wizardPrompts
 */

const config = require('../../config');

const PROMPTS = {
  keyword: {
    ask: '🔍 *Step 1/4: Keyword*\nMau cari apa? Ketik keyword pencarian:\n\n_Contoh: "machine learning", "kucing lucu", "covid dataset"_',
    invalid: '❌ Keyword tidak boleh kosong. Coba lagi:',
  },
  type: {
    ask: '📂 *Step 2/4: Jenis Data*\nPilih jenis data yang dicari:\n\n1️⃣ `images` — Gambar\n2️⃣ `papers` — Paper akademik\n3️⃣ `datasets` — Dataset\n4️⃣ `general` — Web umum\n\n_Ketik angka atau nama:_',
    invalid: '❌ Pilihan tidak valid. Ketik 1-4 atau nama jenis data:',
  },
  limit: {
    ask: '📋 *Step 3/4: Jumlah Hasil*\nBerapa banyak hasil? (1-50)\n\n_Default: 10. Ketik angka atau "skip" untuk default:_',
    invalid: '❌ Masukkan angka 1-50:',
  },
  confirm: {
    ask: (summary) => `✅ *Step 4/4: Konfirmasi*\n\n${summary}\n\nLanjutkan? Ketik *ya* atau *tidak*`,
    invalid: '❌ Ketik "ya" untuk lanjut atau "tidak" untuk batal:',
  },
  cancelled: '🚫 Wizard dibatalkan. Ketik `!menu` untuk kembali.',
  timeout: '⏰ Wizard timeout (2 menit tidak ada input). Ketik `!wizard` untuk mulai ulang.',
};

module.exports = PROMPTS;
