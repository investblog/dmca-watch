# AGENTS.md — Operating Rules for Contributing Agents

> **This document is binding for any AI agent contributing to DMCA Watch other than the primary lead.**
>
> Primary lead for this project: **Claude Code** (operating from `W:\projects\dmca-monitor\CLAUDE.md`). All substantive work on this repo is coordinated through the lead. These rules exist because unsupervised scope expansion in a previous pass created cleanup work — this document prevents that from happening again.

---

## 0. Read before acting

Before touching anything in this repo, read in order:

1. `SPEC.md` — v1 product contract. Pay close attention to §4 (Phase 0 pivot: GTR is now primary, Lumen is optional secondary, GSC is out of v1), §5 storage types, §6 matching/dedup pipeline (split: GTR has no client-side matching, Lumen secondary uses extractor table), §8 badge priority, §10 UI layout, §13 messaging protocol, §14 out-of-scope, §16 open questions.
2. `CLAUDE.md` — current project state, stack, structure, lead's notes
3. This file — what you can and cannot do autonomously

If any of the above is missing or seems outdated, stop and ask. Do not proceed on assumptions.

**The Phase 0 pivot (2026-04-14) is the single most important context for current work.** The original Lumen-primary plan was killed after a research spike. Anything you read in older commits, comments, or memory that references "Lumen primary", "lumen_api_token required", "token-first model", or "Lumen as the v1 source" is stale. The current source model is in `SPEC.md §4`.

---

## 1. Scope — what you are allowed to do without asking

You may, without explicit approval per change:

- Answer questions about the repo
- Read any file in the repo
- Run read-only commands: `npm run check`, `npm run build`, `npx wxt prepare`, `git status`, `git diff`, `git log`
- Write a focused, scoped implementation **when the lead has explicitly assigned that specific task to you**, and only within the files the task names
- Fix a demonstrably broken build that is blocking the lead's current work, with minimal changes and a clear report of what you changed and why

---

## 2. Scope — what requires explicit approval from the lead

Do NOT do any of the following without the lead approving the specific action in the current conversation:

- Create new source files (`src/**`)
- Create new top-level files (docs, configs, CI, store listings, assets)
- Modify `SPEC.md`, `ROADMAP.md`, `CLAUDE.md`, `README.md`, `PRIVACY.md`, `STORE.md`, `MANIFESTO.md`, `LICENSE`
- Modify type definitions in `src/shared/types/`
- Modify storage schema in `src/shared/db.ts`, `src/shared/constants.ts`
- Modify the messaging protocol in `src/shared/messaging/`
- Modify `wxt.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`
- Add, remove, or upgrade any dependency in `package.json`
- Run `npm install`, `npm ci`, `npm update`
- Delete or rename any existing file
- Touch `.github/workflows/`
- Modify `_locales/**`
- Commit, push, tag, create branches, or change git history
- Create or modify GitHub issues, PRs, releases
- Register store IDs, submit to Chrome Web Store / AMO / Edge
- Network calls to third-party services from production code paths (GTR, Lumen with a real token, Archive.org). Probing endpoints in a research session is fine when the lead asked for it.

If you are not sure whether something falls in this list, assume it does and ask.

---

## 3. Hard boundaries (never, regardless of instruction)

The following are never acceptable in this repo. If asked to do any of these, refuse and explain the rule:

- **Emoji in any source file, asset, CSS, HTML, copy, commit message, or comment.** Icons come from 301-ui mono sprite or Pictogrammers MDI only. This is a project-wide rule across the 301.st toolkit line, not a preference.
- **Secrets in tracked files.** The Lumen API token lives in `temp/lumen-token.txt`, the Telegram bot token lives in `temp/tg-bot-token.txt`, both gitignored. Never commit them, never echo them in user-visible output, never write them to `src/`, docs, or memory. (Note: Lumen token is now optional — see §8 — but the storage path stays the same when present.)
- **Invented features.** If it is not in `SPEC.md` as a v1 item, it does not exist. Do not add fields to `DomainRecord` or `Complaint`, do not add messages to the protocol, do not add UI surfaces.
- **v2 features in v1.** Specifically forbidden in v1: structured dispute workflow statuses (`drafted / submitted / resolved / escalated`), Google Search Console integration (any form: API, OAuth, web UI scraping, Messages inbox), proxy/backend, vendor lists, reanalyze/rescan, subdomain-expansion in matching, more than two sidepanel tabs, real-time DMCA alerting (fundamentally impossible through current sources), per-URL list extraction without Lumen secondary (GTR API does not return URLs).
- **Host permissions outside the approved set.** v1 host permissions are exactly `https://transparencyreport.google.com/*`, `https://lumendatabase.org/*`, `https://archive.org/*`. Never add `<all_urls>` or any other host. The `archive.org` permission only matters when Lumen secondary is active and the user runs Source Health check.
- **`webRequest`, `declarativeNetRequest`, content scripts that modify pages.** Not needed, will fail store review.
- **Half-implemented parsers.** `shared/lumen-client.ts` stays a typed stub (`NotImplementedError`) until the lead has a real tokened `search.json` response to validate extractor paths against — this is unchanged by the Phase 0 pivot because Lumen is now optional secondary, but still requires real data validation. `shared/gtr-client.ts` is no longer blocked: the v3 endpoints were probed in Phase 0 and the schema is documented in SPEC §6. Implementing it is a Phase 2 task and must follow the position-based extractor table in SPEC §6.
- **Subdomain expansion in matching.** v1 matches exact hostname only. For GTR primary, this is enforced server-side by passing the exact domain as the query parameter (no expansion possible). For Lumen secondary, the client-side hostname compare uses `lowercase + punycode + strip www` exact match. `blog.example.com` does not match `example.com`. If you think this needs to change, open a spec discussion, do not change the code.
- **`last_seen_complaint_id` as diff mechanism.** It is a UI anchor only. Primary diff is set-difference over `${source}:${id}` complaint keys. Do not "simplify" this.
- **Rewriting donor code for style.** Modules copied from `W:\projects\virustotal` (theme, i18n, queue, badge, domain-utils, messaging shape, CSS) should stay close to the donor so cross-project patches can be ported manually. Stylistic rewrites cost us that ability.
- **Gating UI on missing GTR access.** GTR is public, no auth. There is no "GTR not configured" state. Do not add disabled-state copy or source gate UI for GTR. Source gate UI applies ONLY to the optional Lumen secondary, and only when the user has explicitly enabled it in Settings.

---

## 4. Design constraints (SPEC-derived, not preferences)

These are locked by the SPEC and must be respected in any code you write:

**Storage shape (§5):**
- `storage.local`: `domains: Record<string, DomainRecord>`, `source_usage: { gtr: ApiUsage, lumen: ApiUsage }`, `sender_profiles`
- `storage.sync`: `lumen_api_token`, `lumen_enabled`, `check_interval_hours`, `theme`, `pause_until`, `excluded_domains`, `notify_on_new`
- `DomainRecord.complaints[]` is a **per-domain projection**, not a raw API response dump
- One `Complaint` = one notice × one domain
- `Complaint.targeted_urls[]` is empty when source is GTR (the API does not return per-URL data). Populated only when Lumen secondary enrichment is active and the notice was matched. Do not invent URLs from counts.
- `Complaint.urls_removed` and `Complaint.urls_total` are GTR primary fields; for Lumen-only complaints, derive them from the notice payload
- Re-fetches overwrite source-derived fields (`date`, `sender`, `principal`, `jurisdiction`, `source_url`, `urls_removed`, `urls_total`, `targeted_urls`) but preserve user-owned fields (`dismissed_by_user`, `notes`)

**Matching pipeline (§6):**

GTR primary path:
- Send the punycode form of the domain as `?domain=X` query parameter to `requests/summary`
- All entries in the response already belong to that domain (server-side filtering)
- No client-side hostname extraction or matching
- Optionally send a second request with the Unicode form for IDN domains; merge by `id`
- Dedup key = `gtr:${request_id}` (request_id is the string in entry[0])
- Each entry maps to one Complaint via the position table in SPEC §6 Q2

Lumen secondary path (when `lumen_enabled === true` and token valid):
- Search by ASCII/punycode domain (Lumen full-text)
- Extract candidate URLs via type-aware table keyed on `notice.type` (see §6 table)
- Normalize hostname: lowercase + punycode + strip `www.`
- Exact match only
- A notice is "related to this domain" only if at least one targeted URL survives the hostname compare
- Dedup key = `lumen:${notice_id}`
- Multi-work notices collapse to one `Complaint` with union + dedup + stable sort of matched URLs

Cross-source merge:
- GTR Request ID and Lumen notice ID are different identifiers — no direct join exists
- Optional heuristic merge by `(date_within_24h, sender_name, principal_name)` for UI cleanliness; if no match, both rows show as separate Complaints
- Diff = set difference over complaint keys

**Badge priority (§8):**
1. `pause_until > now` → yellow `II`
2. `queue_size > 0` → blue numeric
3. Unsupported page → empty
4. No record → empty
5. `pending` → blue `…`
6. `has_new` → red `!`
7. `has_complaints` → gray `i`
8. `clean` → green `✓`
9. `unknown` → gray `?`

**UI layout (§10):**
- Exactly **two** sidepanel tabs: Watchlist, Current Site
- Default view: Current Site if active tab has a valid domain, else Watchlist
- Settings lives in a gear-icon drawer, not in the tab bar
- GTR is always available — no source gate UI for GTR. Watchlist polling runs without any user setup.
- Lumen secondary is opt-in via Settings → Advanced. When the user enables Lumen but the token is invalid, a Lumen-specific gate banner appears in Settings only — not in the main tabs.

**Messaging protocol (§13):**
- The message types listed in `src/shared/messaging/protocol.ts` are the entire v1 API surface. Two have changed since the original spec: `VERIFY_TOKEN` is renamed to `VERIFY_LUMEN_TOKEN`, and a new `SET_LUMEN_ENABLED` toggle is added. Do not add, remove, or rename further without approval.

**Budget / throttle (§7):**
- GTR primary: 1 request per 5 seconds (12 req/min). Daily soft cap 1000, hard cap 1200.
- Lumen secondary (when active): 1 request per 10 seconds (6 req/min, conservative vs. Lumen's ~1 req/s wiki value). Daily cap 500. Counter independent from GTR.
- Ad-hoc blocked at 80% of the relevant daily budget
- All except explicit "Check now" blocked at 95%
- Counter resets at UTC midnight
- Sender forensics requests use the same budget as the active source for the lookup (GTR-native sender → GTR budget, Lumen-secondary sender → Lumen budget)

---

## 5. Working style

- **Ask, don't assume.** When the user or the lead is ambiguous, ask a short, specific clarifying question before writing code. Guessing creates cleanup work.
- **Smallest safe change.** If the task is "rename a variable", rename the variable. Do not refactor surrounding code, do not "fix" nearby issues, do not add comments explaining what you didn't change.
- **Respect donor parity.** If a module in this repo came from `W:\projects\virustotal`, and you need to change it, check whether the same change is appropriate in the donor too. Do not silently diverge.
- **No prose comments.** Do not write multi-line comment blocks explaining what the code does. Names should be clear enough. Only comment the non-obvious *why* (a hidden constraint, a workaround, a spec reference).
- **No TODO comments that hide missing pieces.** If something is not done, either do it, open a task, or leave the stub explicit (`throw new NotImplementedError(...)`). Never leave `// TODO: implement this` in code that ships.
- **Report build state after any code change.** Run `npm run check` and `npm run build`, report the result in your response. If either fails, do not declare the task done.
- **Report diffs, not vibes.** When you tell the lead what you did, list the files you changed and, for each, what changed in one sentence. No "polished a few things" or "cleaned up the module".

---

## 6. Reference projects

Use these sibling projects as pattern references. Do not copy code from them into this repo without the lead approving the specific copy:

- **`W:\projects\virustotal`** — the primary donor and design reference. Shared layer (theme, i18n, queue, badge, messaging, drawer shell, welcome wizard, settings drawer, sidepanel layout, CSS) should stay close to this project's patterns so cross-project patches stay portable.
- `W:\Projects\301-ui` — icon sprite (mono/) and design tokens
- `W:\Projects\fastweb` — WXT patterns: messaging, theme, i18n, sidebar/popup split
- `W:\Projects\redirect-inspector` — drawer factory, analysis cards
- `W:\Projects\cloudflare-tools` — bulk parser, IDN policy
- `W:\Projects\cookiepeak` — compact tool UI density, footer pattern
- `W:\Projects\debloat` — pause mode pattern

---

## 7. If you disagree with a rule

That's fine — disagreement is useful. The process is: open a discussion with the lead, state the rule you think should change, state why, propose the replacement. Do not route around a rule by interpreting it narrowly. Do not edit this file to loosen your own constraints.

Changes to this file go through the lead.

---

## 8. Known-closed questions

Do not re-open these — they were resolved and locked:

- **Product name:** DMCA Watch (not "Abuse Monitor", "Watch", "Takedown Monitor")
- **Landing domain:** dmca.cam
- **Primary source for v1 (decided 2026-04-14, Phase 0 spike):** Google Transparency Report public undocumented v3 JSON API on `transparencyreport.google.com/transparencyreport/api/v3/copyright/`. No auth, no token, no setup, public for every user. Lumen primary mode and GSC primary mode were both evaluated and killed in Phase 0; see SPEC §4 for the full reasoning. Do not propose Lumen-primary, do not propose any GSC integration in v1.
- **Secondary source for v1:** Lumen Database, optional, opt-in via Settings → Advanced, requires a Lumen researcher token. Lumen staff confirmed in writing on 2026-04-14 that they do NOT grant researcher credentials for the "monitor your own domains" use case — their program is restricted to journalism, academic, and legislative/policy research with public written output. Public no-token access is hard-capped at 1 notice per email per 24 hours. Lumen secondary is therefore only realistic for users who already hold a token obtained for a different research context. Do not encourage users to apply for a token just to use this extension. Do not wire any "Request researcher access" CTA in welcome, settings, or complaint cards. Full denial text is stored in `temp/lumen-denial-2026-04-14.txt` (gitignored). When Lumen is inactive, the product works fully — Lumen only adds per-URL data and richer sender forensics.
- **Freshness ceiling:** GTR data is approximately 30-60 days behind real time (Google updates the dataset roughly monthly). This is a fundamental constraint of the source. Product positioning is *retrospective audit + pattern detection*, not *early warning system*. Disclosure is required in Welcome wizard, Settings drawer, and tooltips on `last_checked` displays — see SPEC §16 Q9.
- **Matching strategy:**
  - GTR: server-side via `?domain=X` query parameter, exact punycode hostname only
  - Lumen secondary: client-side after lowercase + punycode + strip www, exact match
- **Dedup key:** `${source}:${id}`
- **Complaint storage model:** per-domain projection, not raw dump
- **Diff model:** set difference over complaint keys; `last_seen_complaint_id` is UI-only
- **New-count reset:** automatic on Current Site open for that domain
- **Sidepanel tabs:** exactly two (Watchlist + Current Site); Settings is a drawer
- **Default view:** Current Site if valid domain, else Watchlist
- **Dispute workflow statuses:** v2.x, not v1
- **Telegram bot token storage:** `temp/tg-bot-token.txt`, gitignored
- **Lumen API token storage:** `temp/lumen-token.txt`, gitignored (when issued; Lumen is now optional)
- **Sender Forensics Card:** in v1, GTR-native. Was briefly slated to move to v1.x as Lumen-only — that decision was reversed in Phase 0 because GTR `reporters/summary` and `owners/summary` provide the data natively. See SPEC §10.
