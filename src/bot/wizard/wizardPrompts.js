'use strict';

/**
 * @fileoverview Wizard prompts — text prompts for each wizard step.
 * @module bot/wizard/wizardPrompts
 */

const config = require('../../config');

const PROMPTS = {
  keyword: {
    ask: '🔍 *Mau cari apa?*\nKetik topik pencarian (misal: _machine learning, kucing lucu_).\n\n_Ketik `batal` kapan saja untuk keluar._',
    invalid: '❌ Keyword tidak boleh kosong. Coba lagi:',
  },
  type: {
    ask: '📂 *Pilih Jenis Data:*\n1️⃣ `images` (Gambar)\n2️⃣ `papers` (Paper Akademik)\n3️⃣ `datasets` (Dataset)\n4️⃣ `general` (Web Umum)\n\n_Ketik angka 1-4 atau namanya:_',
    invalid: '❌ Ketik angka 1-4 atau nama jenis data:',
  },
  limit: {
    ask: '📋 *Berapa Banyak Hasil?*\nKetik angka antara 1 sampai 50.\n\n_Ketik `skip` untuk membiarkan default (10)._',
    invalid: '❌ Masukkan angka antara 1-50 atau ketik `skip`:',
  },
  confirm: {
    ask: (summary) => `✅ *Konfirmasi Pencarian*\n\n${summary}\n\nLanjutkan? Ketik *ya* atau *batal*`,
    invalid: '❌ Ketik *ya* untuk lanjut atau *batal* untuk membatalkan:',
  },
  cancelled: '🚫 Wizard dibatalkan. Ketik `!menu` untuk melihat fitur lainnya.',
  timeout: '⏰ Waktu tunggu habis. Ketik `!wizard` jika ingin memulai kembali.',
};

module.exports = PROMPTS;
