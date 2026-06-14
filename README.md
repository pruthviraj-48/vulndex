# VULNDEX — A→Z Web Attack Lab

A self-contained, offline-capable study console for **139 web application vulnerabilities**.
Each vulnerability is a full dossier with the same core sections so your testing workflow becomes muscle memory:

- **Overview** — what it is + impact
- **Test A→Z** — graded methodology in three tiers: **Beginner** (recon & detection) → **Intermediate** (exploitation) → **Advanced** (chaining, automation & WAF/filter bypass)
- **Lab Setup** — how to stand up a safe practice target (PortSwigger labs, DVWA, Juice Shop, docker)
- **Payloads** — copy-paste probes & exploit strings
- **WAF Bypass** — defeating filters, WAFs, weak blocklists, rate limits
- **Chaining** — what bug leads *into* this one, where it pivots *next*, and one worked end-to-end kill-chain (with links to the chained dossiers)
- **Write-Up** — a ready-to-adapt vulnerability report: title, severity/CVSS, PoC steps, business impact, remediation — copyable as Markdown
- **Tools** — the standard kit per class
- **References** — HackTricks, PortSwigger Academy, OWASP, A-to-Z repo, CWE

Plus a **CTF Lab** walkthrough and a **Reports** tab of real-world disclosed CVEs/bounty write-ups per class.

> ⚠️ **Authorized use only.** For pentesting engagements, CTFs and education. Never run these against
> systems you do not own or lack written permission to test.

## Run it

No build, no server, no dependencies. Just open the file:

```bash
xdg-open index.html        # Linux
# or: open index.html      # macOS
```

Optional (nicer for hash-routing / clipboard):

```bash
python3 -m http.server 8099
# then visit http://127.0.0.1:8099
```

## Features

- Cyber-noir holographic theme with **3D tilt cards** (cursor parallax, glare, depth, animated gradient borders)
- **Beginner → Advanced** level switcher inside every dossier's Test tab
- Instant filter + **command palette** (`Ctrl/Cmd+K` or `/`)
- Category rail + severity chips (Critical/High/Medium/Low)
- Tabbed **dossier** view per vuln with copy-to-clipboard payloads
- **Practice tracker** — mark vulns done, progress persists in `localStorage`
- Fully responsive, keyboard-navigable, reduced-motion aware

## Structure

```
index.html            markup + view shells
assets/css/style.css  theme
assets/js/app.js       engine (router, search, render, progress)
assets/js/vulns.js     data — window.VULNS = [...139 dossiers...]
```

Data is embedded as a JS global (not fetched) so it works from `file://` with no CORS issues.

## Sources

- HackTricks — https://hacktricks.wiki/en/index.html
- A-to-Z-Vulnerabilities — https://github.com/0xKayala/A-to-Z-Vulnerabilities
- PortSwigger Web Security Academy — https://portswigger.net/web-security
- OWASP WSTG — https://owasp.org/www-project-web-security-testing-guide/
