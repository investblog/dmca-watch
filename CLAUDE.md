# DMCA Watch

## Snapshot

v0.1.0 — skeleton up, build green. **Phase 0 source spike done 2026-04-14: pivoted from Lumen-primary to GTR-primary. Phase 1 doc rewrite + Phase 2 code migration complete same day.** Google Transparency Report's undocumented v3 JSON API is the v1 primary source — public, no auth, schema and position-based extractor live in `src/shared/gtr-client.ts`. `background.ts` switched to GTR primary loop; welcome wizard shrunk from 4 steps (with Lumen token form) to 3 steps (with honest freshness disclaimer); settings drawer exposes Lumen as opt-in Advanced toggle only. `npm run check` and `npm run build` both pass for chrome-mv3 and firefox-mv2. **Lumen Database formally declined 2026-04-14** the "monitor own domains" use case — researcher credentials only for journalism/academic/policy research — confirming the pivot was right. Lumen remains v1 optional secondary for existing token holders only; we do not steer users into researcher applications. Full denial text in `temp/lumen-denial-2026-04-14.txt`. `lumen-client.ts` stays a typed stub; real Lumen impl is v1.x Power Pack work. GSC ruled out for v1 (URL Inspection / Search Analytics don't expose DMCA removals; Messages inbox not in public API). Браузерное расширение для вебмастеров: **retrospective audit + pattern detection** для DMCA-жалоб против собственных доменов (не early-warning — данные GTR ~30-60 дней позади реального времени).

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

## Next code step (Phase 2 — code surface migration)

Phase 1 (docs rewrite) is in progress and currently being executed. Phase 2 begins after Phase 1 ships and the user gives a go.

**Phase 2 code work, in dependency order:**

1. `shared/types/index.ts` — `ComplaintSource = 'gtr' | 'lumen'` (drop `'gsc'`), add `Complaint.urls_removed` and `Complaint.urls_total` fields, adapt `SenderProfile` for GTR-native vs Lumen-only fields, add `lumen_enabled` to settings types.
2. `shared/constants.ts` — add `LUMEN_ENABLED` storage key, split `BUDGET` into GTR + Lumen sections, drop GSC from default excluded list (already not present), update `THROTTLE_MS` strategy (now per-source).
3. `shared/db.ts` — getter/setter for `lumen_enabled`, source_usage map split (gtr / lumen).
4. `shared/messaging/protocol.ts` — rename `VERIFY_TOKEN` → `VERIFY_LUMEN_TOKEN`, add `SET_LUMEN_ENABLED`, drop any `gsc` references.
5. **`shared/gtr-client.ts`** — new primary client. Endpoints documented in SPEC §6. Position-based extractor for `requests/summary` entries. Defensive parser with graceful degradation on schema breakage. Implementation no longer blocked — Phase 0 spike confirmed all endpoints work without auth.
6. `shared/lumen-client.ts` — stays a typed stub. Phase 0 pivot moved its real implementation to v1.x.
7. `entrypoints/background.ts` — switch from Lumen-only flow to GTR primary + optional Lumen secondary enrichment. Remove gating-on-missing-token logic for the main monitor loop. Lumen status only affects Lumen-specific UI in Settings.
8. `entrypoints/welcome/` — rewrite from 4 steps (with Lumen token form) to 3 steps (welcome with freshness disclaimer → first domain → done). Lumen explainer moves to Settings → Advanced.
9. `entrypoints/sidepanel/components/settings-drawer.ts` — Lumen toggle in Advanced section with explainer; GTR source status as always-on indicator.
10. `entrypoints/sidepanel/components/sender-drawer.ts` — adapt to GTR-native data (`reporters/summary`, `owners/summary`, `overview/urlsremoved`); Lumen-only sections show only when secondary active.
11. `entrypoints/sidepanel/main.ts` — complaint card UX: counts as default, URL list only when Lumen-enriched. Freshness tooltip on `last_checked` displays.
12. `wxt.config.ts` — `host_permissions` add `https://transparencyreport.google.com/*`, keep `lumendatabase.org` and `archive.org` (for optional secondary).
13. `_locales/en/messages.json` — copy strings updated for new positioning, freshness disclaimer, GTR primary, Lumen optional explainer.
14. `npm run check && npm run build` — must pass cleanly.

**Discovery items in Phase 2:**
- Verify GTR `domain=` param accepts both Unicode and punycode for IDN — if not, only send punycode.
- Probe `requests/summary?reporter_id=X` (or similar) for sender-specific notice samples — currently SPEC §10 sender drawer assumes this works but it was not probed in Phase 0.
- Confirm that GTR API does not require any specific User-Agent or fail on extension-typical UA strings.
