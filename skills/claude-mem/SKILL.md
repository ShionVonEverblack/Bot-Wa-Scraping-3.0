---
name: claude-mem
description: Persistent cross-session memory system using 3-layer Progressive Disclosure (compact index search, chronological timeline window, and full observation retrieval).
---

# Claude-Mem — Persistent Memory & Progressive Disclosure

Reference Repository: https://github.com/thedotmack/claude-mem  
Native Bot Module: `src/services/memory/persistentMemory.js` (`recordObservation`, `searchIndex`, `getTimeline`, `getObservations`)  
Bot Command: `!memory <search|list|remember|clear>`

## Capabilities
- Automatically records user searches, paper downloads, and explicit facts across sessions (`cache/claude_mem.json`).
- **3-Layer Progressive Disclosure**:
  1. `searchIndex` — compact index with IDs, titles, and tags (~50 tokens/item).
  2. `getTimeline` — chronological context window around an observation.
  3. `getObservations` — full payload retrieval only for relevant IDs.
