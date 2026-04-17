# DMCA Watch

## Snapshot

**v0.1.0-beta.1 released 2026-04-15** via GitHub Actions CI. Repo public at [github.com/investblog/dmca-watch](https://github.com/investblog/dmca-watch) (MIT), 4 browser zips uploaded (chrome-mv3 / edge-mv3 / firefox-mv2 / sources), auto-detected as prerelease via tag-name rule. `npm run check` and both builds pass clean. **Landing page live at [dmca.cam](https://dmca.cam)** since 2026-04-16 (Cloudflare Pages, static HTML/CSS from 301-ui design system, green theme from logo). Phases 0–4 all done in two calendar days (2026-04-14 and 2026-04-15):

- **Phase 0 (research spike):** pivoted from Lumen-primary to GTR-primary after GSC API audit ruled out DMCA signal and Phase 0 probes verified Google Transparency Report's undocumented v3 JSON API (`transparencyreport.google.com/transparencyreport/api/v3/copyright/`) as a public, no-auth, stable source. Sender Forensics reinstated in v1 as GTR-native cross-watchlist aggregation.
- **Phase 1 (doc rewrite):** SPEC, AGENTS, ROADMAP, CLAUDE, PRIVACY, MANIFESTO, STORE, README all rewritten under new model and honest *retrospective audit + pattern detection* positioning with explicit 30–60 day freshness disclosure. **Lumen formally declined** the webmaster use case 2026-04-14 (full text in `temp/lumen-denial-2026-04-14.txt`), confirming the pivot was correct.
- **Phase 2 (code migration):** `src/shared/gtr-client.ts` written with position-based extractor, `background.ts` switched to GTR primary loop, welcome wizard 4→3 steps with freshness disclaimer, settings drawer Lumen toggle in Advanced, sender drawer GTR-native aggregation, complaint card UX changed from URL list to counts-with-optional-URL-list-when-Lumen-enriched, manifest host_permissions updated to `transparencyreport.google.com/* + lumendatabase.org/* + archive.org/*`.
- **Phase 3 (code review fixes):** pagination loop + overlap-stop + union-merge (fixed silent history truncation on refresh), Top Contributors card on Current Site computed locally from `record.complaints`, copy walked back from "complete history" to "historical audit". `lumen-request-template.ts` deleted.
- **Phase 4 (real pagination contract fix):** Phase 3's first pagination attempt used the wrong endpoint suffix and wrong cursor index. Live-sniffed the GTR SPA's own pagination traffic via Chrome automation — real contract is `/requests/summary/page?p=<cursor>` (NOT `?start=`) with next cursor at `wrapper[2][1]` (NOT `[2]`). Verified end-to-end with 3-page walk against zippyshare.com returning 9 unique entry IDs. SPEC §6 Q2 updated to reflect the corrected contract and why.

Browser extension for webmasters: **retrospective audit + pattern detection** for DMCA complaints against their own domains — not early warning (GTR data is ~30–60 days behind real time, and this is stated honestly throughout the UI). `lumen-client.ts` stays a typed stub; real Lumen impl is v1.x Power Pack work reserved for users who already hold a researcher token from a different research context. GSC ruled out for v1 (URL Inspection / Search Analytics don't expose DMCA removals; Messages inbox not in public API) and parked as v2 research track.

Repo: [github.com/investblog/dmca-watch](https://github.com/investblog/dmca-watch) | Landing: [dmca.cam](https://dmca.cam)

Sibling product in the 301.st webmaster toolkit line. Sponsored by 301.st.

Surfaces: `background.ts`, `welcome/`, `sidepanel/`. No separate popup — Firefox popup fallback reuses `sidepanel.html`.

## Ownership

Claude Code is the project lead. Non-primary contributing agents operate under `AGENTS.md`, which enumerates what they can and cannot do without explicit approval. When the lead hands a scoped task to another agent, that task must name the files it is allowed to touch.

## Stack

- WXT `^0.19`, TypeScript `^5.7` strict, ESLint `^9`
- Vanilla DOM, zero runtime dependencies
- Aliases: `@/` → `src/`, `@shared/` → `src/shared/`

## Commands

`npm run dev` / `dev:firefox` / `dev:edge` / `build` / `build:firefox` / `build:edge` / `zip:all` / `check`

## Current Structure (scaffolded, build passing)

```text
site/                           — dmca.cam landing page (Cloudflare Pages)
  index.html                    — single-page landing, 301-ui design system
  css/theme.css                 — design tokens, green brand from logo
  css/landing.css               — BEM components, mobile-first responsive
  favicon.svg                   — extension icon reused as favicon
src/
  entrypoints/
    background.ts           — message router, queue loop, badge, alarm tick, pause/resume
    sidepanel/
      index.html            — 2 tabs only: Current Site (default) + Watchlist
      main.ts               — renders both views, reactive to storage.onChanged
      components/
        drawer.ts           — drawer factory
        dispute-drawer.ts   — counter-notice templates + AI prompts
        settings-drawer.ts  — token, interval, theme, pause, excluded, export/import
    welcome/
      index.html            — 4 wizard steps
      main.ts               — step navigation, token verify stub, first domain
  shared/
    types/index.ts          — DomainRecord, Complaint, QueueItem (SPEC §5)
    constants.ts            — STORAGE_KEYS, badge config, throttle/budget
    db.ts                   — storage wrapper with locks
    domain-utils.ts         — normalize, punycode, validation
    theme.ts                — dark/light/auto (donor copy)
    i18n.ts                 — data-i18n attribute helper (donor copy)
    alarm.ts                — watchlist alarm wrapper
    badge.ts                — status→color/text mapping
    queue.ts                — priority queue with dedup/cooldown/budget guards
    messaging/              — protocol.ts (13 types) + index.ts
    lumen-client.ts         — typed stub, throws NotImplementedError (now optional v1.x secondary, no longer v1 blocker)
    gtr-client.ts           — Phase 2: NOT YET WRITTEN. Primary client against transparencyreport.google.com v3 API. Position-based extractor against verified endpoints (see SPEC §6).
    counter-notice-templates.ts — DMCA §512(g) templates + AI prompts
    bulk-parser.ts          — CSV/newline bulk domain parser (donor copy)
    ui-helpers.ts           — el() factory, toast (donor copy)
  assets/css/
    theme.css               — donor copy, byte-identical
    components.css          — donor copy (minus .dispute-status cruft)
  public/
    icons/                  — 16/32/48/128 PNG
    _locales/en/messages.json — English strings
```

Большая часть shared-слоя скопирована из VT Monitor почти 1-в-1 и должна оставаться близко к донору, чтобы кросс-проектные патчи переносились руками без мерджей. Донорские файлы помечены выше.

## Storage

- `storage.local`: `domains` (Record<string, DomainRecord>), `source_usage` (отдельные счётчики для gtr и lumen), `sender_profiles`
- `storage.sync`: `lumen_api_token` (опциональный), `lumen_enabled` (default false), `check_interval_hours`, `theme`, `pause_until`, `excluded_domains`, `notify_on_new`

DomainRecord: domain, watchlist, added_at, last_checked, complaints[], last_seen_complaint_id, new_count, status.

Complaint: id, source ('gtr' | 'lumen'), date, sender, principal, urls_total, urls_removed, targeted_urls[] (empty for GTR — populated only when Lumen secondary enriched), jurisdiction, source_url, dismissed_by_user, notes.

См. SPEC.md §5 для полных типов.

## Queue / Budget

Паттерн тот же, что в VT Monitor (см. `W:\projects\virustotal\src\shared\queue.ts`):

- Priorities: high (user) > normal (watchlist) > low (ad-hoc)
- **GTR primary throttle:** 5s между запросами (12 req/min). Daily soft cap 1000, hard cap 1200. Google CDN, документированных лимитов нет — наша вежливость.
- **Lumen secondary throttle (когда активен):** 10s между запросами (6 req/min, conservative vs Lumen's ~1 req/s wiki value). Daily cap 500. Counter independent from GTR.
- Dedup, cooldown, budget gate, pause gate — перед добавлением в очередь
- `abortQueue()` на shutdown, `shouldCountApiRequest()` для учёта только реальных HTTP ответов

Полный budget contract — SPEC.md §7. Phase 0 spike результаты — SPEC.md §16 Q1.

## Signal Contract

Layer 1: Icon badge — Pause `II` жёлтый > Queue count синий > Per-tab status (`!` red / `i` gray / `✓` green)
Layer 2: Footer badges — domains, queue (GET_QUEUE_STATUS), source usage
Layer 3: Footer progress bar — is-loading during queue/render
Layer 4: Toasts — 4s auto-dismiss
Layer 5: OS notifications — новые жалобы (только при `notify_on_new: true`)
Layer 6: Button states — btn--loading, disabled "Queued"

## Default view

Current Site if active tab has valid domain, otherwise Watchlist.
Settings в gear icon drawer, не в tabs.

## Design References

- **`W:\projects\virustotal`** — **главный референс**: весь shared-слой, UI-паттерны, drawer architecture, queue/badge/messaging, manifest i18n, store listings workflow. DMCA Monitor — sibling расширение на том же стеке, копируем структуру и большинство модулей.
- **`W:\Projects\301-ui`** — design system: icons (mono/), drawers, tables, fieldsets, copy feedback
- **`W:\Projects\fastweb`** — WXT patterns: messaging, theme, i18n, sidebar/popup
- **`W:\Projects\redirect-inspector`** — drawer factory, analysis cards
- **`W:\Projects\cloudflare-tools`** — bulk parser, IDN policy
- **`W:\Projects\cookiepeak`** — compact tool UI, dense inspector, footer
- **`W:\Projects\debloat`** — pause mode pattern

## Relationship to VT Monitor

DMCA Monitor — **отдельный продукт**, не fork. Но большинство инфраструктуры копируется с минимальными правками:

Копируется почти без изменений:
- `wxt.config.ts` (сменить name/perms/host_perms)
- `tsconfig.json`, `eslint.config.mjs`
- `shared/theme.ts`, `shared/i18n.ts`, `shared/domain-utils.ts`, `shared/alarm.ts`
- `shared/messaging/` (типы сообщений адаптируются под DMCA)
- `shared/ui-helpers.ts`, `shared/bulk-parser.ts`
- `assets/css/theme.css`, `components.css`
- Welcome wizard skeleton
- Sidepanel shell + drawer factory
- Settings drawer skeleton
- Export/Import pattern
- Manifest i18n (14 locales)
- Store listings workflow (`store/{locale}.md`)
- GitHub Actions release pipeline

Отличается радикально:
- `shared/gtr-client.ts` (primary, вместо `vt-client.ts`) + `shared/lumen-client.ts` (optional secondary, без аналога в VT)
- `shared/counter-notice-templates.ts` (вместо `dispute-templates.ts` — другая семантика)
- `components/dispute-drawer.ts` (counter-notice DMCA 512(g), не vendor dispute)
- `background.ts` обработка ответа: diff по `complaints[]`, не `vt_stats`
- Badge семантика: has_new / has_complaints / clean / pending / unknown
- Source model: GTR public undocumented API (без auth), Lumen — optional researcher token (gate'ит только Lumen-only фичи)
- Отсутствуют: WHOIS parsing, vendor list, reanalyze, rescan policy

Когда правишь общий паттерн в VT Monitor и он применим сюда — синхронизируй вручную. Нет автоматической зависимости между проектами.

## Rules

- **No emoji** — SVG icons from 301-ui mono or Pictogrammers MDI, add to sprite. Правило ОБЩЕЕ со всей линейкой 301.st.
- Keep AGENTS.md, CLAUDE.md, ROADMAP.md, SPEC.md aligned with code
- SPEC.md = v1 product contract (see open questions §16)
- ROADMAP.md = future work
- AGENTS.md = operating rules for non-primary contributing agents — update it if the lead wants different constraints on delegated work
- Lumen API token в `temp/lumen-token.txt` (gitignored) — нужен только когда пользователь активирует Lumen secondary (после Phase 0 pivot Lumen больше не v1 blocker)
- Telegram bot token (dmcacheckbot) в `temp/tg-bot-token.txt` (gitignored)
- Always build after changes before responding (project-wide rule)

## Next steps (post-beta)

Phases 0–4 are all done. Repo is public, `v0.1.0-beta.1` is live with all 4 browser zips, CI workflow is verified working, GTR pagination contract is live-verified. No pending code work blocks the release.

**What remains before v1.0 stable:**

1. **Live smoke test on real domains** (user-side, manual). Load `dmca-watch-0.1.0-chrome.zip` (or firefox/edge equivalent) from the v0.1.0-beta.1 release page as unpacked extension, add 2–3 real domains, verify end-to-end: pagination actually walks multiple pages, union-merge preserves history across refreshes, Top Contributors card populates from local complaints, Sender drawer's "Also in your watchlist" cross-reference works with multi-domain portfolio. This is the last validation gate before calling v1.0 done — cannot be done from Claude Code.
2. **Node.js 20 → 24 CI migration.** GitHub Actions annotated v0.1.0-beta.1's run with a deprecation warning. Hard deadline 2026-06-02. One-line change in `.github/workflows/release.yml`.
3. ~~**Lumen re-ask letter send**~~ — DONE 2026-04-16. Letter sent, **second denial received** (personal reply to admin@301.st). However, a separate mass email to legal@301.st announced Lumen is actively investigating enterprise access and linked a Harvard Qualtrics survey (`harvard.az1.qualtrics.com/jfe/form/SV_1KQBBJ1lmOArvF4`). Survey asks for business name/URL, domains monitored, and type of access needed. **Action: fill out survey** with dmca.cam as business URL, referencing public research output commitment.
4. ~~**Landing page on dmca.cam.**~~ — DONE 2026-04-16. Static site deployed to Cloudflare Pages (`site/` directory), 301-ui design system, green theme extracted from logo gradients (#47b05c / #2f2e7b). Sections: hero, transparency disclosure (honest 30-60 day lag), features, how-it-works, audience, privacy, about. Deploy: `wrangler pages deploy ./site --project-name=dmca-cam`.
5. **Store submissions** — Chrome Web Store, Firefox AMO, Microsoft Edge Add-ons. Requires store screenshots (SPEC lists 7 ideas), finalized listing copy per locale (currently EN-only), PRIVACY.md legal review, and developer account registration with each store. This is Phase 5.
6. **v1.0 stable tag.** After smoke test passes + at least one store submission is accepted, tag `v0.1.0` (no pre-release suffix) for the stable release. CI workflow auto-detects non-prerelease from the clean tag name.
7. **v1.1 polish items** — see ROADMAP.md: bulk add domains, manifest i18n 14 locales, export/import, local search/filter, relative time auto-refresh, inspector card refinement, GTR endpoint stability monitoring (SPEC §16 Q10), sender drawer cross-reference navigation expansion.

**Known gotchas that future code changes must preserve:**

- **GTR pagination contract:** subsequent pages use endpoint path `/requests/summary/page` (NOT `/requests/summary`) and param `p=<cursor>` (NOT `?start=`). Next cursor is at `paginationMeta[1]` (NOT `[2]` — that's the *last-page* cursor). End-of-list detected by `entries.length < size` OR `currentPage >= totalPages` OR `nextCursor === cursor`. Live-verified 2026-04-15 against zippyshare.com 3-page walk. See `src/shared/gtr-client.ts: fetchGtrComplaintsPage` and SPEC §6 Q2.
- **mergeComplaints is a UNION, not a replace.** Previous complaints that are absent from the latest fetch must stay in local storage — silently dropping them destroys the historical audit value. See `src/entrypoints/background.ts: mergeComplaints`. The overlap-stop strategy in the GTR client relies on this being correct.
- **Sender Forensics is local aggregation, not an API call.** GTR API does not accept any per-sender filter (probed `reporter_id`, `owner_id`, several aliases — all return empty or unchanged). The "Also in your watchlist" cross-reference is computed from `record.complaints` across all watchlist domains. This ended up being the killer feature because it's actionable — don't try to replace it with a "global stats" API call that doesn't exist.
- **No "Request Lumen researcher access" CTA anywhere in the UI.** Lumen declined the webmaster use case in writing 2026-04-14, and declined again 2026-04-16 (second personal denial). However, Lumen also announced an enterprise access investigation with a Harvard Qualtrics survey (2026-04-16 mass email to legal@301.st) — this may change in the future. For now, the Settings → Advanced Lumen toggle is explicitly documented as being only for users who already hold a token obtained for journalism/academic/policy research. See AGENTS.md §8 and `temp/lumen-denial-2026-04-14.txt`.
