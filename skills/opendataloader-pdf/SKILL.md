---
name: opendataloader-pdf
description: Layout-aware PDF parser for AI-ready data. Reconstructs reading order, detects section hierarchies, extracts tables into Markdown, and strips running page headers/footers.
---

# OpenDataLoader-PDF — AI-Ready PDF Structure Extraction

Reference Repository: https://github.com/opendataloader-project/opendataloader-pdf  
Native Bot Module: `src/services/pdf/pdfLoader.js` (`parseBuffer`, `parseFile`, `extractLayoutStructure`)  
Bot Command: `!rag ingest <pdf_url_or_doi>` or `!paper <doi_or_arxiv>`

## Capabilities
- De-hyphenates wrapped lines and removes repeating page numbers/headers.
- Identifies academic and report sections (`Abstract`, `Methodology`, `Results`, numbered headings).
- Converts aligned multi-column blocks and vector PDF tables into GitHub-Flavored Markdown tables.
