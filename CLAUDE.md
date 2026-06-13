# CLAUDE.md — VULNDEX

Guidance for Claude Code when working in this repository.

## What this is

**VULNDEX** — a self-contained, offline-capable study console covering **121 web
application vulnerabilities**. Each vulnerability is a dossier with the same core
sections so the testing workflow becomes muscle memory:

1. **Overview** — what it is + impact
2. **Test A→Z** — graded 3-tier methodology: **Beginner** (recon/detection) → **Intermediate** (exploitation) → **Advanced** (chaining, automation, WAF/filter bypass). Stored per vuln in a `levels:{beginner,intermediate,advanced}` field (each item `{step, detail, how}`, where `how:{m,t,c}` = **m**ethod (how to test it) · **t**ool/framework · **c**ommand/function — rendered by `stepLi()` as the green "▸ how to test" block; `levelize()` norm carries `how`, `dossierMarkdown()` emits it as a `_How to test:_` line). `how` is assigned programmatically by a keyword→toolbox matcher (domain-specific regexes first, broad encode/decode + generic intercept/fuzz last) with a per-family fallback. `levelize()` falls back to splitting `howToTest` into thirds + `bypass[]` if `levels` is absent.
3. **Lab Setup** — safe practice target (PortSwigger labs, DVWA, Juice Shop, docker)
4. **Payloads** — copy-paste probes & exploit strings. Two sub-blocks render under the raw list: `annotatedPayloads:[{p,c}]` (payload + what it does) and `encoding:[{layer,sample,note}]` — the **Encode/Decode lab**: the same payload in every wire-form (single/full/double URL-encode, HTML-entity dec+hex, `\u`/`\x`, base64/base64url, mixed-case, overlong-UTF-8), each with a decode/why-it-evades note. Seeded from the vuln's own first payload + a class base via family detection. All exact encoded strings are computed (not hand-typed) — regenerate programmatically, never hand-edit.
5. **WAF Bypass** — defeating filters, WAFs, weak blocklists, rate limits
6. **Chaining** — attack-to-attack pivots. Stored per vuln in a `chain` field: `{feeders:[{from,slug,how}], pivots:[{to,slug,how,gain}], scenario:{name,steps[],result}}`. `feeders`/`pivots` cross-link other dossiers by `slug` (rendered as `#/vuln/<slug>` links); `renderChain()` shows plain text when `slug` is absent.
7. **Write-Up** — ready-to-adapt vulnerability report. Stored per vuln in a `report` field: `{title,severity,cvss,summary,steps[],impact,remediation[]}`. `renderReport()` shows the card + a "copy as Markdown" button (`reportMarkdown()`).
8. **Tools** — standard kit per vuln class
9. **References** — HackTricks, PortSwigger Academy, OWASP, A-to-Z repo, CWE

Plus two more dossier tabs: **CTF Lab** (`ctf` field, walkthrough) and **Reports** (`reports` field, real-world disclosed CVEs/bounties — distinct from the **Write-Up** template above).

**Purpose:** authorized pentesting, CTFs and security education only.

## Stack / architecture

No build step, no server, no dependencies, no package manager. Pure static
HTML + CSS + vanilla JS.

```
index.html              markup + view shells (home grid / dossier / map / about)
assets/css/style.css    cyber-noir holographic theme + glass-3D + a11y/map layer
assets/js/app.js        engine — hash router, search, render, progress, attack map (~40K)
assets/js/vulns.js      data — window.VULNS = [...121 dossiers...] (~5.4M, single line)
manifest.webmanifest    PWA manifest (installable, standalone)
sw.js                   service worker — offline app-shell + runtime font cache
.nojekyll               disables Jekyll on GitHub Pages
README.md               human-facing readme
```

Key design points:

- **Data is embedded as a JS global** (`window.VULNS`), not `fetch()`ed — so it
  works from `file://` with no CORS issues. `vulns.js` is one giant line (~5.4 MB).
- **Hash-routed** SPA: `#/` home, `#/vuln/<slug>` dossier, `#/vuln/<slug>/<tab>`
  deep-link (opens that tab; tab clicks update the hash via `replaceState`),
  `#/map` attack-chain map, `#/about` field manual.
- **Attack Chain Map** (`#/map`, `renderMap()`) — SVG chord diagram of all 121
  nodes (severity-coloured) ringed by attack class, with `chain.pivots` drawn as
  curves; hover/focus lights a node's chains, click opens the dossier.
- **PWA / offline** — `sw.js` cache-first app shell + stale-while-revalidate
  Google Fonts; registered in `init()` only over http/https (not `file://`).
  Bump `CACHE` const in `sw.js` when assets change to bust the cache.
- **Search** — `searchHay(v)` (memoised on `v._hay`) indexes name/category/
  summary/description/cwe/tags/tools/payloads/bypass/chain/report/notes; used by
  both the home filter and the command palette.
- **A11y** — cards are `<a href>`; dossier tabs are an ARIA tablist with
  `aria-selected` + ←/→/Home/End arrow nav; skip-link; visible focus rings;
  `print` stylesheet expands all panels.
- **Other features** — clickable `#tags` (filter the codex), CWE→MITRE link,
  "Export .md" (whole dossier via `dossierMarkdown()`), Random vuln, Unpracticed-
  only toggle.
- **Command palette** — `Ctrl/Cmd+K` or `/`.
- **Practice tracker** — mark vulns done, progress persists in `localStorage`.
- Category rail + severity chips (Critical/High/Medium/Low).
- Animated matrix bg, glass cards, glitch title; responsive, keyboard-nav,
  reduced-motion aware.
- **3D depth**: grid cards + hero stats tilt toward the cursor (parallax via
  `bindTilt()` in `app.js` setting `--rx/--ry/--mx/--my` custom props; CSS does
  `rotateX/rotateY` + radial glare + `translateZ` lift). Disabled under
  `prefers-reduced-motion`.
- External deps loaded by CDN only: Google Fonts (Orbitron / Space Grotesk /
  JetBrains Mono / Inter). Everything else is local.

## Current status

- **Type:** static site, complete. 121/121 vuln dossiers present in `vulns.js`.
- **Hosting:** GitHub Pages — **LIVE**.
  - Live URL: https://pruthviraj-48.github.io/vulndex/
  - Repo: https://github.com/pruthviraj-48/vulndex (`origin`)
  - Source: `main` branch, `/` root. Build type: legacy. HTTPS enforced. Public.
  - Pages status: `built`.
- **Branch:** `main` (tracks `origin/main`).

## Run locally

No build. Open the file directly:

```bash
xdg-open index.html        # Linux
# or: open index.html      # macOS
```

Optional (nicer hash-routing / clipboard):

```bash
python3 -m http.server 8099   # then http://127.0.0.1:8099
```

## Deploy

Plain `git push` to `main` → GitHub Pages auto-rebuilds from root. No CI/CD,
no `.github/workflows`. Keep `.nojekyll` (filenames/dirs would otherwise risk
Jekyll processing).

## Working notes / gotchas

- `vulns.js` is a single 5.4 MB line — do **not** try to hand-edit or
  pretty-print blindly; edit programmatically and re-minify to one line.
- When repairing JSON in the data, do **not** apply a global stray-backslash
  regex — it corrupts valid `\\` escapes. One past batch emitted invalid
  `\x00`; fix targeted, not global.
- `.gitignore` excludes `*:Zone.Identifier` (WSL ADS files) and `.DS_Store`.
- Source data lives in `Web_Application_Vulnerabilities.txt` (the 121 list).
  Extra notes: `XSS_CTF_Labs_Full_Notes.md`.

## Data sources

- HackTricks — https://hacktricks.wiki/en/index.html
- A-to-Z-Vulnerabilities — https://github.com/0xKayala/A-to-Z-Vulnerabilities
- PortSwigger Web Security Academy — https://portswigger.net/web-security
- OWASP WSTG — https://owasp.org/www-project-web-security-testing-guide/
