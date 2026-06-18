# Conjure — Product Specification

> A browser-only **AI tool workshop**. Users bring their own LLM API key and
> data source, describe what they want in natural language, and an LLM
> generates a small front-end tool that runs **sandboxed in their own
> browser** — letting them quickly visualize and work with their data without
> writing code or trusting a server.

This document is the source of truth for what Conjure does and how it is
architected. It is written for both humans and AI assistants working in this
repo. Update it when the design changes.

---

## 1. Core idea

Conjure is **not** a chatbot. It is a closed loop:

> describe a need → AI writes a tool → the tool runs immediately on your data.

Everything happens client-side. There is **no backend**. API keys and data
never leave the user's browser except in the direct API calls the user
themselves configured.

## 1a. Settings and Projects

The app is organised around two concepts:

- **Settings** — a reusable library the user maintains once:
  - **LLM profiles**: named OpenAI-compatible configs (base URL, key, model).
  - **Data-source profiles**: named data sources (paste / file / HTTP / MCP),
    with uploaded file contents persisted so they stay reusable.
- **Projects** — each project:
  - selects **one LLM profile** and **one or more data-source profiles**;
  - generates a tool whose **source is version-controlled** (`ToolVersion[]`):
    the user can switch the preview back to any version at any time;
  - keeps a **conversation history** (`ChatEntry[]`) of every request and
    response. When refining, the model is given either the **latest** version
    or the **version the user is currently viewing** as the base to modify;
  - can be **exported to / imported from a self-contained JSON file** so a
    finished tool can be shared. The bundle carries the project plus the data
    sources and LLM profile it uses, with the **LLM API key stripped** — the
    recipient supplies their own key.

## 2. End-to-end flow

1. **Configure the LLM** — base URL, API key, model name (OpenAI-compatible).
   Stored in `localStorage`.
2. **Configure a data source** — one of: paste JSON, upload a file, an HTTP
   request, or an MCP tool call (see §5). Stored in `localStorage`.
3. **Load data** — Conjure fetches/loads the data into memory as JSON.
4. **Derive context** — a compact **schema + small sample** is extracted from
   the data (never the whole dataset) to feed the model cheaply.
5. **Describe the tool** — the user types a request, e.g. "bar chart of revenue
   by region" or "a sortable table with a search box".
6. **Generate** — Conjure sends `(request + per-source schema + sample)` to the
   LLM and gets back a **prose explanation plus** a single self-contained
   HTML/JS fragment. The explanation and code become a new `ToolVersion` and two
   conversation entries.
7. **Run sandboxed** — the generated fragment runs in an isolated
   `<iframe sandbox>` (see §4). The selected sources are inlined into the
   document.
8. **View, switch & iterate** — the preview toggles between the rendered
   **Result** and the **Code**; the user can switch to any earlier version, and
   ask the LLM to refine the latest or currently-viewed version. Everything is
   persisted to `localStorage`.

## 3. LLM integration

- **Only the OpenAI-compatible Chat Completions API is implemented.** A single
  integration (base URL + API key + model) covers OpenRouter, Ollama, LM
  Studio, vLLM, and most local/hosted gateways. Anthropic/Gemini can be used
  through any OpenAI-compatible proxy.
- Calls go **directly from the browser** to the user's configured base URL.
  This depends on that endpoint allowing browser CORS (local servers and most
  gateways do).
- The system prompt instructs the model to output exactly one self-contained
  HTML document that:
  - reads its data from the injected global (see §4), never from the network;
  - uses **only the pre-bundled libraries** provided in the sandbox;
  - renders into `document.body`;
  - performs **no network requests** of any kind.

## 4. Execution sandbox (security-critical)

AI-generated code is **untrusted**. Isolation is mandatory and non-negotiable:

- The tool runs in an `<iframe>` built from a `srcdoc`, with
  `sandbox="allow-scripts allow-downloads"` **and crucially NOT
  `allow-same-origin`**. The iframe therefore has an opaque origin and **cannot
  read the parent page's `localStorage`** — so it can never see the LLM API key
  or data-source credentials. `allow-downloads` only lets a tool offer a
  user-initiated file download (e.g. *export CSV* via a `Blob` object URL); it
  grants no network or origin access.
- A strict **Content-Security-Policy** inside the iframe document enforces
  **no network access**: `default-src 'none'` with only inline `script`/`style`
  allowed. This is why the chosen design bundles libraries instead of loading
  them from a CDN — see decision in §7.
- **Data flow into the sandbox:** the parent app loads the data (using the
  user's data-source config) and passes it into the iframe via `postMessage`
  after the iframe signals it is ready. The iframe exposes the data to the
  generated code as a global (e.g. `window.__CONJURE_DATA__`).
- **Why this is safe:** the generated code can see the data (it must, to render
  it), but with no network it **cannot exfiltrate** anything, and with no
  same-origin access it **cannot reach credentials**.

## 5. Data sources

Four input methods, all normalized to in-memory JSON:

| Source | Notes |
| --- | --- |
| **Paste JSON** | Simplest; bypasses CORS entirely. |
| **Upload file** | JSON or CSV; CSV is parsed to JSON client-side. |
| **HTTP request** | Configurable method / URL / headers / body. **Subject to CORS** — if the target server does not allow browser cross-origin requests, it cannot be reached from a pure front-end app. This is an inherent browser limitation with no backend. |
| **MCP tool as API** | Connect to an MCP server over a browser-reachable HTTP transport (Streamable HTTP / SSE), list its tools, call a chosen tool with arguments, and use the returned content as the data payload. Also **subject to CORS** and requires the MCP server to expose an HTTP transport. Treated as just another way to fetch JSON. |

## 6. Persistence & state

- `localStorage` holds two keys: `conjure:settings` (LLM + data-source
  profiles) and `conjure:projects` (each project's selected profiles, its
  `ToolVersion[]`, the current version, and the conversation history). Old
  single-config keys are migrated into profiles on first load.
- **Disclosure:** keys live in `localStorage` in plaintext, as is standard for
  bring-your-own-key apps. This is surfaced to the user in the UI. The sandbox
  design (§4) ensures generated tools cannot read them.

## 7. Key architecture decisions (locked)

1. **LLM provider:** OpenAI-compatible endpoint only.
2. **Sandbox network:** **disabled**. Common visualization libraries are
   **bundled into the app** and inlined into the sandbox document, so generated
   tools work fully offline and data cannot be exfiltrated.
3. **What the AI emits:** a single self-contained HTML/JS document (not a React
   component), which is the simplest thing to sandbox and the most flexible.
4. **Isolation:** `iframe` with `allow-scripts` only + strict CSP; data via
   `postMessage`; credentials never enter the iframe.

## 8. Resolved details

- **Bundled library set (starting point):** **Chart.js** (self-contained UMD,
  for charts) and **PapaParse** (CSV → JSON for file uploads). These are inlined
  into the sandbox document so tools work offline. The set can grow later.
- **MCP transport:** support the current standard **Streamable HTTP** transport.
  Like the HTTP data source it is subject to CORS, surfaced in the UI.

## 9. Out of scope (for now)

- Any server-side component, hosted proxy, or shared/cloud storage. (Projects
  can still be **shared as exported JSON files** — local, with API keys
  stripped — see §1a.)
- Multi-user accounts or collaboration.
