'use strict';

/**
 * @fileoverview NLP Manager using node-nlp.
 * Handles training and intent classification using offline Neural Network.
 * @module bot/nlp/nlpManager
 */

const { NlpManager } = require('node-nlp');
const { createLogger } = require('../../services/monitor/logger');
const { INTENTS } = require('./intentClassifier');
const fs = require('fs');
const path = require('path');

const log = createLogger('nlp:manager');

// Model path
const MODEL_PATH = path.join(process.cwd(), 'model.nlp');

// Initialize NLP Manager
// We use 'id' for Indonesian and 'en' for English
const manager = new NlpManager({ languages: ['id', 'en'], forceNER: true, autoSave: false });

let isTrained = false;

/**
 * Add training data (corpus) to the NLP Manager.
 */
function addCorpus() {
  // ── INTENT: SCRAPE ──
  const scrapeDocs = [
    // Indonesian
    'cari', 'carikan', 'carin', 'tolong cari', 'bantu cari',
    'scrape', 'scraping', 'nyari', 'mau cari', 'mau nyari',
    'search', 'find', 'tolong cariin', 'coba cari',
    'carikan data', 'cari gambar', 'cari jurnal', 'cari paper',
    // English
    'find me', 'search for', 'can you find', 'scrape data',
  ];
  scrapeDocs.forEach(doc => {
    manager.addDocument('id', doc, INTENTS.SCRAPE);
    manager.addDocument('en', doc, INTENTS.SCRAPE);
  });

  // ── INTENT: PAPER_DOWNLOAD ──
  const paperDocs = [
    // Indonesian
    'download paper', 'download jurnal', 'unduh paper', 'unduh jurnal',
    'download artikel', 'downloadin paper ini', 'tolong download jurnal',
    'bantu unduh paper', 'buka paper',
    // English
    'download paper', 'get pdf', 'download this article', 'fetch journal',
  ];
  paperDocs.forEach(doc => {
    manager.addDocument('id', doc, INTENTS.PAPER_DOWNLOAD);
    manager.addDocument('en', doc, INTENTS.PAPER_DOWNLOAD);
  });

  // ── INTENT: IMAGE_ANALYZE ──
  const analyzeDocs = [
    // Indonesian
    'analisa gambar', 'analyze foto', 'jelaskan gambar', 'terangkan foto',
    'apa isi gambar ini', 'jelasin foto ini', 'gambar apa ini',
    'tolong analisa gambar', 'bantu jelasin foto', 'deskripsikan gambar',
    // English
    'analyze image', 'analyze photo', 'describe this picture',
    'explain this image', 'what is in this photo',
  ];
  analyzeDocs.forEach(doc => {
    manager.addDocument('id', doc, INTENTS.IMAGE_ANALYZE);
    manager.addDocument('en', doc, INTENTS.IMAGE_ANALYZE);
  });

  // ── INTENT: GREETING ──
  const greetDocs = [
    // Indonesian
    'hai', 'halo', 'helo', 'hey', 'hei', 'yo', 'oi', 'p',
    'assalamualaikum', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
    'bot', 'min', 'ping', 'test',
    // English
    'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
  ];
  greetDocs.forEach(doc => {
    manager.addDocument('id', doc, INTENTS.GREETING);
    manager.addDocument('en', doc, INTENTS.GREETING);
  });

  // ── INTENT: AI_CHAT ──
  const chatDocs = [
    // Indonesian
    'apa itu', 'siapa itu', 'siapa yang', 'bagaimana cara', 'gimana cara',
    'kenapa', 'mengapa', 'kapan', 'dimana', 'di mana', 'tolong jelaskan',
    'jelasin dong', 'ceritakan', 'apa maksudnya', 'ini apa',
    // English
    'what is', 'who is', 'how to', 'why is', 'when did', 'where is',
    'explain to me', 'tell me about', 'describe',
  ];
  chatDocs.forEach(doc => {
    manager.addDocument('id', doc, INTENTS.AI_CHAT);
    manager.addDocument('en', doc, INTENTS.AI_CHAT);
  });
}

/**
 * Train the NLP model and save it locally.
 */
async function trainModel() {
  if (isTrained) return;

  log.info('Training NLP model...');
  
  if (fs.existsSync(MODEL_PATH)) {
    manager.load(MODEL_PATH);
    log.info('Loaded existing NLP model from disk.');
  } else {
    addCorpus();
    await manager.train();
    manager.save(MODEL_PATH);
    log.info('NLP model trained and saved to disk.');
  }

  isTrained = true;
}

/**
 * Process a text message and return NLP.js classification.
 * @param {string} text 
 * @returns {Promise<Object>}
 */
async function processText(text) {
  if (!isTrained) {
    await trainModel();
  }
  // Try to process in Indonesian by default if language detection fails
  return manager.process('id', text);
}

module.exports = { trainModel, processText };
