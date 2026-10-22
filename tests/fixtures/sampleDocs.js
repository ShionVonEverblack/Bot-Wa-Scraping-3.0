'use strict';

/**
 * @fileoverview Test fixtures: Documents, academic papers, and conversation data.
 */

const sampleDocs = {
  academicPaperText: `Deep Residual Learning for Image Recognition

Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun
Microsoft Research

Abstract
Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.

-- 1 of 5 --

1. Introduction
Deeper convolutional networks have led to a series of break-
throughs for image classification. Many other non-trivial visual
recognition tasks have also greatly benefited from very deep models.
Driven by the significance of depth, a question arises: Is learning
better networks as easy as stacking more layers? An obstacle to
answering this question was the notorious problem of vanishing/
exploding gradients, which hamper convergence from the beginning.
This problem, however, has been largely addressed by normalized
initialization and intermediate normalization layers.

When deeper networks are able to start converging, a degradation
problem has been exposed: with network depth increasing, accuracy
gets saturated and then degrades rapidly. Unexpectedly, such
degradation is not caused by overfitting, and adding more layers to a
suitably deep model leads to higher training error.

2. Methodology and Architecture
We introduce deep residual learning. Formally, denoting the desired
underlying mapping as H(x), we let the stacked nonlinear layers fit
another mapping of F(x) := H(x) - x. The original mapping is recast
into F(x) + x. We hypothesize that it is easier to optimize the
residual mapping than to optimize the original, unreferenced mapping.

-- 2 of 5 --

The formulation of F(x) + x can be realized by feedforward neural
networks with shortcut connections. Shortcut connections are those
skipping one or more layers. In our case, the shortcut connections
simply perform identity mapping, and their outputs are added to the
outputs of the stacked layers.

3. Experimental Results
We evaluate our residual nets on the ImageNet 2012 classification
dataset. The baseline models are plain nets of varying depths.

Model	Top-1 Error	Top-5 Error	FLOPs
Plain-18	27.94%	9.43%	1.8G
ResNet-18	27.88%	9.28%	1.8G
Plain-34	28.54%	10.02%	3.6G
ResNet-34	25.03%	7.76%	3.6G
ResNet-50	20.74%	5.25%	3.8G
ResNet-101	19.87%	4.60%	7.6G
ResNet-152	19.38%	4.49%	11.3G

-- 3 of 5 --

4. Discussion
Our ResNet-152 is 8x deeper than VGG nets while still having lower
complexity. On the ImageNet test set, an ensemble of these residual
nets achieves a 3.57% top-5 error rate. This result won 1st place in the
ILSVRC 2015 classification competition.

5. Conclusion
We have presented deep residual networks for image recognition. Our
framework eases optimization of deep networks, demonstrating that
increased depth directly translates to substantial performance gains.

References
[1] Y. LeCun et al. Gradient-based learning applied to document recognition. Proc. IEEE, 1998.
[2] A. Krizhevsky et al. ImageNet classification with deep convolutional neural networks. NeurIPS, 2012.
[3] K. Simonyan and A. Zisserman. Very deep convolutional networks for large-scale image recognition. ICLR, 2015.
`,

  graphCorpusText: `Google DeepMind developed AlphaFold, an AI system that predicts 3D protein structures with atomic accuracy.
Demis Hassabis co-founded DeepMind and led the AlphaFold research initiative.
AlphaFold relies heavily on Transformer neural network architectures and attention mechanisms.
The team published their breakthrough paper with DOI 10.1038/s41586-021-03819-2 in Nature.
PyTorch and JAX were utilized as primary Machine Learning frameworks for distributed training.
At the CASP14 competition, AlphaFold outperformed all competing methods by a wide margin.
Deep learning models such as Transformer and ResNet have revolutionized computational biology.`,

  multiTurnChatDialogue: [
    { role: 'user', content: 'Halo bot, saya sedang mengerjakan proyek klasifikasi teks berbahasa Indonesia dengan BERT.' },
    { role: 'assistant', content: 'Halo! Ada yang bisa saya bantu dengan model IndoBERT atau arsitektur transformer lainnya?' },
    { role: 'user', content: 'Tolong jelaskan perbedaan learning rate warmup dan cosine decay saat fine-tuning.' },
    { role: 'assistant', content: 'Learning rate warmup menaikkan learning rate dari 0 ke target maksimum pada awal epoch agar gradien stabil, sedangkan cosine decay menurunkannya secara perlahan mengikuti kurva kosinus untuk konvergensi optimal.' },
    { role: 'user', content: 'Bagus, tolong catat bahwa ukuran batch saya adalah 32 dan optimizer yang digunakan adalah AdamW dengan weight decay 0.01.' },
    { role: 'assistant', content: 'Baik, informasi tersimpan: Batch size 32, optimizer AdamW, weight decay 0.01.' },
    { role: 'user', content: 'Saya juga ingin mengevaluasi F1-score makro pada dataset validation.' },
    { role: 'assistant', content: 'Dicatat. Macro F1-score adalah metrik yang ideal terutama jika terdapat class imbalance pada dataset Anda.' },
    { role: 'user', content: 'Bagaimana cara menangani overfitting jika training loss terus turun tetapi validation loss naik?' },
    { role: 'assistant', content: 'Anda dapat menerapkan: 1) Early stopping, 2) Meningkatkan dropout ke 0.2 atau 0.3, 3) Menambah data augmentation, 4) Memperbesar weight decay pada AdamW.' }
  ],

  sampleJsonItems: [
    {
      title: 'RTX 4090 Gaming Edition',
      price: '$1,599',
      vendor: 'NVIDIA',
      description: 'Top-tier enthusiast graphics card with 24GB GDDR6X VRAM and DLSS 3.5 support for 4K ray tracing.',
      raw: '<html>...heavy raw blob...</html>',
      _score: 0.985,
      thumbnail: 'https://images.example.com/thumb1.jpg',
      sourceUrl: 'https://example.com/products/4090',
      specs: { vram: '24GB', tdp: 450 }
    },
    {
      title: 'Radeon RX 7900 XTX',
      price: '$999',
      vendor: 'AMD',
      description: 'Flagship RDNA 3 GPU with 24GB VRAM and DisplayPort 2.1 support for ultra high resolution gaming.',
      raw: '<html>...heavy raw blob...</html>',
      _score: 0.920,
      thumbnail: 'https://images.example.com/thumb2.jpg',
      sourceUrl: 'https://example.com/products/7900xtx',
      specs: { vram: '24GB', tdp: 355 }
    }
  ]
};

module.exports = sampleDocs;
