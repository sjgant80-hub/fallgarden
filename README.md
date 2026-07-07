# FallGarden

Sovereign, file-native second brain. Obsidian-shape. Single HTML PWA.

Markdown files + `[[wikilinks]]` + backlinks + force-directed graph + full-text search.
Optional semantic search via [fall-kit](https://sjgant80-hub.github.io/fall-kit/) (T0 off · T2 WebLLM in-browser · T3 BYOK frontier).

Live: **https://sjgant80-hub.github.io/fallgarden/**

## Why

Obsidian is closed-source, single-vendor, and its sync is paid.
[fallnote](https://sjgant80-hub.github.io/fallnote/) is the block-based (Notion-shape) cousin.
FallGarden is the **file-based** cousin — your notes stay `.md`, live in a folder you own, open in any editor forever.

Nothing leaves your device unless you opt in. No accounts. No cloud. MIT.

## Features

- **Vault loader** — File System Access API (Chrome, Edge). Point it at any folder, it reads and writes `.md` in place. Import an existing Obsidian vault by picking its root — 1:1.
- **Fallback** — Firefox / Safari get IndexedDB storage + .md file import.
- **Editor** — plain markdown, live preview, split view, `[[wikilink]]` autocomplete as you type.
- **Wikilinks** — click to open. Missing targets go coral; click to create.
- **Backlinks panel** — every note that links here, live-updated on save.
- **Graph view** — force-directed SVG. Nodes for notes + tags. Zoom, pan, click to open. No d3.
- **Local minigraph** — right sidebar shows the current note's immediate neighbourhood.
- **Full-text search** — inverted-index, sub-second across large vaults, highlighted snippets.
- **Semantic search (opt-in)** — cascade via fall-kit. T2 = WebLLM, T3 = BYOK Claude/GPT/Gemini.
- **Tags** — `#tag` anywhere. Sidebar shows tag chips with counts. Click to filter.
- **Command palette** — `Ctrl+K`. Fuzzy jump to any note or action.
- **Auto-save** — 2s debounced. Written straight to the file system.
- **Ed25519 signing (opt-in)** — via [FallSignature](https://sjgant80-hub.github.io/fallsignature/).
- **Publish (opt-in)** — via [FallCast](https://sjgant80-hub.github.io/fallcast/).
- **Multi-device sync (opt-in)** — via [FallSync](https://sjgant80-hub.github.io/fallsync/).
- **PWA** — installs. Works offline. Service worker.
- **MCP hook** — `window.fallgarden.query(text)`, `.list()`, `.read(path)`, `.write(path,body)`, `.graph()`. A companion `fallgarden-mcp` server can talk through the extension.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command palette |
| `Ctrl+E` | Toggle split view |
| `Ctrl+G` | Graph view |
| `Ctrl+Shift+F` | Full-text search |
| `Ctrl+N` | New note |
| `Ctrl+S` | Force save |
| `[[` | Wikilink autocomplete |
| `#` | Tag |

## How it differs from fallnote

- **fallnote** — block-based, Notion-shape, database-substrate style. Best for structured knowledge, tables, embedded databases.
- **fallgarden** — file-based, Obsidian-shape. Best for a knowledge graph over plain-text `.md` files that live on your disk.

They coexist. Use both.

## How to import an Obsidian vault

1. Open FallGarden.
2. Click **Open Vault**.
3. Pick your existing Obsidian vault folder.
4. That's it. Every `.md` renders. `[[wikilinks]]` and `#tags` work immediately.
5. Your `.obsidian/` config is left alone. FallGarden doesn't touch it.

## Cascade settings

Semantic search + LLM features are **T0 off by default**. Open Settings (top bar ⚙) → click **Open cascade** → pick your tier:

- **T0** — off. All features work locally, no LLM.
- **T2** — WebLLM in-browser (Llama 3.2 1B/3B, Qwen 7B, Llama 8B/70B). Weights download once, cached in browser.
- **T3** — BYOK Anthropic, OpenAI, Google. Your key stays in localStorage.

## MCP companion

A future `fallgarden-mcp` server can drive FallGarden via the browser extension surface:

```js
window.fallgarden.query("what did I write about torus")
window.fallgarden.list()
window.fallgarden.read("Ideas/torus.md")
window.fallgarden.write("Ideas/torus.md", "# torus\n\n...")
window.fallgarden.graph() // {nodes, links}
```

## Estate lineage

FallGarden is part of the [AI-Native Solutions](https://ai-nativesolutions.com/) estate.
Cousins: [fallnote](https://sjgant80-hub.github.io/fallnote/) (blocks), [fallvault](https://sjgant80-hub.github.io/fallvault/) (encrypted backup), [fallmirror](https://sjgant80-hub.github.io/fallmirror/) (self-reflection).
Substrate: [fall-kit](https://sjgant80-hub.github.io/fall-kit/), [fallsignature](https://sjgant80-hub.github.io/fallsignature/), [fallcast](https://sjgant80-hub.github.io/fallcast/), [fallsync](https://sjgant80-hub.github.io/fallsync/).

MIT · `◊ · κ = 1`
