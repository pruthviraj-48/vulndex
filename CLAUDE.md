# CLAUDE.md — VULNDEX

Guidance for Claude Code when working in this repository.

## What this is

**VULNDEX** — a self-contained, offline-capable study console covering **121 web
application vulnerabilities**. Each vulnerability is a dossier with the same 7
sections so the testing workflow becomes muscle memory:

1. **Overview** — what it is + impact
2. **Test A→Z** — graded 3-tier methodology: **Beginner** (recon/detection) → **Intermediate** (exploitation) → **Advanced** (chaining, automation, WAF/filter bypass). Stored per vuln in a `levels:{beginner,intermediate,advanced}` field (each item `{step, detail}`); `app.js` `levelize()` falls back to splitting `howToTest` into thirds + `bypass[]` if `levels` is absent.
3. **Lab Setup** — safe practice target (PortSwigger labs, DVWA, Juice Shop, docker)
4. **Payloads** — copy-paste probes & exploit strings
5. **WAF Bypass** — defeating filters, WAFs, weak blocklists, rate limits
6. **Tools** — standard kit per vuln class
7. **References** — HackTricks, PortSwigger Academy, OWASP, A-to-Z repo, CWE

**Purpose:** authorized pentesting, CTFs and security education only.

## Stack / architecture

No build step, no server, no dependencies, no package manager. Pure static
HTML + CSS + vanilla JS.

```
index.html              markup + view shells (home grid / dossier / about)
assets/css/style.css    cyber-noir holographic theme
assets/js/app.js        engine — hash router, search, render, progress (~24K)
assets/js/vulns.js      data — window.VULNS = [...121 dossiers...] (~2.5M, single line)
.nojekyll               disables Jekyll on GitHub Pages
README.md               human-facing readme
```

Key design points:

- **Data is embedded as a JS global** (`window.VULNS`), not `fetch()`ed — so it
  works from `file://` with no CORS issues. `vulns.js` is one giant line (~3.1 MB).
- **Hash-routed** SPA: `#/` home, `#/v/<id>` dossier, `#/about` field manual.
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

- `vulns.js` is a single 3.1 MB line — do **not** try to hand-edit or
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
