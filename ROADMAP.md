# DMCA Watch — Roadmap

---

## v0.1 — Bootstrap (current)

- [x] Первая спецификация (SPEC.md) с открытыми вопросами
- [x] CLAUDE.md с референцией на VT Monitor
- [x] package.json / wxt.config.ts / tsconfig.json / eslint.config.mjs
- [x] Выбор финального названия (§16 Q7) → **DMCA Watch**
- [x] Регистрация домена → **dmca.cam**
- [x] Проверка официальной документации Lumen (§16 Q1, изначально): search требует token, authenticated throttle ≈ 1 req/s
- [x] Tokenless JSON smoke test (2026-04-10): локально `403` на `/notices/search.json` и `/notices/1.json`
- [x] Спек-решение для Q2/Q3: per-domain complaint projection + dedup по `${source}:${id}`
- [x] **Phase 0 source spike (2026-04-14):** проверка GSC API и Google Transparency Report как кандидатов на primary source. Результат — GSC отвергнут (URL Inspection / Search Analytics не различают DMCA-removals), GTR подтверждён через network probe реального тестового домена. Найдены 5 undocumented v3 endpoints, протестированы curl без auth/cookies/referer, schema documented в SPEC §6.
- [x] **Pivot декада 2026-04-14:** primary source v1 → GTR public undocumented JSON API. Lumen → optional secondary enrichment (по-прежнему требует researcher token, но больше не gate). GSC out of v1 entirely.
- [x] **SPEC.md / AGENTS.md / CLAUDE.md / ROADMAP.md / PRIVACY.md / MANIFESTO.md / STORE.md обновлены под новую модель**
- [x] **Phase 2 — code surface migration (2026-04-14):** `gtr-client.ts` primary implementation с position-based extractor, `background.ts` switched to GTR primary loop, welcome wizard 4→3 шагов с freshness disclaimer, settings drawer Lumen toggle в Advanced, sender drawer GTR-native aggregation с cross-watchlist, complaint card counts + optional URL list. `npm run check` и оба builds зелёные.
- [x] **Phase 3 — code review fixes (2026-04-15):** pagination loop + overlap-stop + **union-merge** в `mergeComplaints` (closed silent history truncation), **Top Contributors card** на Current Site computed локально из `record.complaints`, copy walked back from "complete history" to "historical audit". Deleted unused `lumen-request-template.ts`.
- [x] **Phase 4 — real pagination contract fix (2026-04-15):** live-sniff SPA через Chrome automation, реальный контракт `/requests/summary/page?p=<cursor>` с next cursor at `wrapper[2][1]`. Verified 3-page walk против zippyshare.com. SPEC §6 Q2 исправлен.
- [x] **Public GitHub repo (2026-04-15):** [github.com/investblog/dmca-watch](https://github.com/investblog/dmca-watch) под investblog account, MIT license, homepage https://dmca.cam, 10 topics, initial commit + 2 follow-up commits.
- [x] **Beta release v0.1.0-beta.1 (2026-04-15):** via GitHub Actions CI, auto-prerelease detection, 29s runtime, 4 zips (chrome-mv3 55 kB, edge-mv3 55 kB, firefox-mv2 55 kB, sources 191 kB).
- [ ] **Live smoke test on real domains** — user-side manual gate перед v1.0 stable
- [ ] **CI Node.js 20 → 24 migration** — GitHub Actions deprecation, deadline 2026-06-02, one-line fix
- [ ] **Lumen re-ask letter** — draft в `temp/lumen-reask-2026-04-15.txt`, user personalizes + sends; leans на Lumen's own 2022 abuse research и now-public repo
- [ ] Landing page на dmca.cam (domain registered, копия в MANIFESTO.md и STORE.md)

---

## v1.0 — MVP (public GTR mode, no token required)

Базовый мониторинг DMCA-жалоб против собственных доменов через публичный Google Transparency Report API. Никаких токенов и аккаунтов для базовой работы. Lumen secondary enrichment — opt-in для пользователей с researcher token.

**Source-coupled core — DONE (Phase 2 + Phase 3 + Phase 4):**

- [x] `shared/gtr-client.ts` — primary client с position-based extractor против 5 v3 endpoints. **Pagination contract live-verified 2026-04-15:** `/requests/summary/page?p=<cursor>`, next cursor at `wrapper[2][1]`. `fetchGtrComplaintsPage` + `searchGtrComplaintsByDomain` с overlap-stop loop. Defensive errors (`GtrNetworkError`, `GtrRateLimitedError`, `GtrParseError`).
- [x] `shared/lumen-client.ts` — secondary client, stays typed stub (`NotImplementedError`) до реального tokened sample. Активируется только когда `lumen_enabled === true` И токен валиден.
- [x] Type updates: `ComplaintSource = 'gtr' | 'lumen'`, `Complaint.urls_removed/urls_total`, `lumen_enabled` storage key, `SenderProfile.source` discriminant, `cross_watchlist` field, `SourceUsageMap` без gsc.
- [x] `background.ts` — GTR primary flow (pagination with `knownKeys` overlap-stop), Lumen secondary enrichment когда активен. **`mergeComplaints` UNION, не replace** (post-Phase 3 fix — дropping previous complaints destroys history). GTR никогда не gate'ит UI.
- [x] Messaging protocol — `VERIFY_LUMEN_TOKEN` rename, новый `SET_LUMEN_ENABLED`, никакого gsc.
- [x] Manifest `host_permissions` — `transparencyreport.google.com/*`, `lumendatabase.org/*`, `archive.org/*`. Убран `https://*/*` (source health v1.x feature, Lumen-only).

**Infrastructure (already in place from initial scaffolding):**

- [x] Скелет WXT + types + storage + тема (копируем из VT Monitor)
- [x] `shared/queue.ts` — throttled queue (discriminated union: domain + sender kinds)
- [x] `shared/badge.ts` — badge logic (has_new / has_complaints / clean / pending / unknown)
- [x] `background.ts` infrastructure — алармы + очередь + messaging + notifications + sender dispatch
- [x] Pause mode (1h auto-resume) + enqueue gate + UI gating
- [x] Excluded domains
- [x] IDN support (Unicode display, punycode API)
- [x] Real icons (SVG + 4 PNG sizes через resvg-js)
- [x] GitHub Actions release pipeline

**UX adaptations — DONE (Phase 2 + Phase 3):**

- [x] Welcome wizard rewrite: 3 шага без token entry — приветствие с freshness disclaimer, первый домен, готово. Lumen explainer только в Settings → Advanced.
- [x] Side panel: Watchlist + Current Site (2 tabs, Current Site default)
- [x] Side panel: complaint card UX — counts as default UX, URL list только когда Lumen secondary enriched, link либо на GTR либо на Lumen notice page
- [x] Side panel: freshness disclaimer tooltip над `last_checked` (SPEC §16 Q9 option B)
- [x] **Top Contributors card на Current Site (Phase 3):** top-5 reporters + top-5 copyright owners aggregated локально, each clickable → opens Sender drawer
- [x] Dispute drawer: counter-notice шаблоны (DMCA 17 U.S.C. §512(g))
- [x] Settings drawer rewrite: GTR source status (always-on) + Lumen toggle в Advanced section с explainer about Lumen's formal denial
- [x] **Sender forensics drawer (GTR-native):** local aggregation из `record.complaints`, cross_watchlist killer feature («Also in your watchlist»), monthly sparkline из local dates. Lumen-only sections скрыты когда `source === 'gtr'`.
- [x] Browser notifications на новые жалобы
- [x] Disabled/gated states only for Lumen secondary (not for GTR — GTR never gates)
- [x] i18n-ready English, Lumen application template removed from welcome (file deleted in Phase 3)

**Documentation (Phase 1 work, in progress):**

- [x] SPEC.md rewrite under GTR primary
- [x] AGENTS.md rewrite — relax token-first rules, update host permissions, update closed questions
- [x] ROADMAP.md rebalance (this file)
- [x] CLAUDE.md snapshot + next-step
- [x] PRIVACY.md rewrite — GTR primary, Lumen optional, freshness disclosure
- [x] MANIFESTO.md rewrite — drop "Lumen is the only source" narrative
- [x] STORE.md rewrite — pitch + setup + permissions
- [ ] Final pass on PRIVACY.md под Lumen ToS + GTR Terms (legal review TBD)
- [ ] Store listings (en + 14 локалей через manifest i18n)

---

## v1.1 — Polish

- [ ] Bulk add domains (паттерн из VT Monitor)
- [ ] Manifest i18n — 14 локалей (копируем из VT Monitor)
- [ ] SEO store listings per locale
- [ ] Export/Import watchlist (JSON + CSV)
- [ ] Local search/filter по Watchlist
- [ ] Relative time auto-refresh
- [ ] Inspector card refinement (301-ui fieldset/legend)
- [ ] GTR endpoint stability monitoring (см. SPEC §16 Q10): version detection, graceful degradation на schema breakage, alert UI когда parse fails
- [ ] Sender drawer cross-reference UI: «этот reporter атакует ещё N доменов из вашего watchlist» — данные есть из GTR, нужна навигация

---

## v1.x — Lumen Power Pack (optional secondary enrichment)

Полное доведение Lumen secondary mode до качественного состояния — для пользователей, у которых **уже есть** researcher token, полученный по другому research purpose (journalism, academic study, legislative/policy research). Lumen staff формально подтвердили 2026-04-14, что webmaster monitoring use case им не granted и никогда не был granted — так что этот путь существует только для существующих держателей токена. В Settings drawer и welcome wizard мы не отправляем пользователей в researcher application flow; полный текст отказа — `temp/lumen-denial-2026-04-14.txt`.

- [ ] Реализация `lumen-client.ts` против real tokened `search.json` response (была заблокирована, перекочёвывает сюда; perspective change: теперь это не gate v1, а v1.x upgrade)
- [ ] Per-URL list extraction для GTR-жалоб через Lumen heuristic merge `(date, sender, principal)`
- [ ] Cross-recipient жалобы (Twitter / GitHub / Twitch и др., которые не попадают в GTR) как самостоятельные Complaints
- [ ] Lumen-only sender forensics sections в sender drawer: top recipients, top targeted hosts, top cited source URLs, jurisdictions
- [ ] Source health check для Lumen-cited URLs (HTTP HEAD + Archive.org snapshot)
- [ ] Lumen settings flow refinement: token verification, error states, retry guidance, ToS/researcher application explainer
- [ ] Lumen-specific dossier JSON export (полнее GTR-only)

---

## v2.0 — Multi-source

- [ ] Google Search Console integration: исследовать paths к real-time DMCA detection. Кандидаты:
  - GSC OAuth + content script на `search.google.com/search-console/*` для scraping Messages inbox (где DMCA-уведомления приходят)
  - Reverse-engineering undocumented Messages endpoint (если есть)
  - Эта работа research-spike, не commitment
- [ ] Google Transparency Report scraping fallback — если undocumented JSON API сломается, парсить SPA через content script на `transparencyreport.google.com/*`
- [ ] Unified timeline: все источники в одной ленте жалоб для домена
- [ ] Smart dedup между источниками
- [ ] Source health panel (какие источники работают, кто вернул ошибку)
- [ ] Webhook / push notifications для GSC real-time path (когда realised)

---

## v2.x — Dispute workflow

- [ ] Статус counter-notice: drafted / submitted / resolved / escalated
- [ ] История переписки по жалобе (notes + timestamps)
- [ ] AI-промпты для адаптации шаблонов (только локальные промпты, без отправки данных)
- [ ] Экспорт дела целиком (жалоба + counter-notice + заметки) в PDF для юриста
- [ ] Интеграция с хостерами (шаблоны писем для популярных хостов)

---

## v3.x — Research Mode

- [ ] Анализ паттернов фейковых жалоб: частотные отправители, общие шаблоны текста
- [ ] Cross-domain insights: «этот sender атаковал ещё N доменов из вашего watchlist» (часть уже в v1.1)
- [ ] Community-shared blocklist фейковых sender'ов (opt-in)
- [ ] Интеграция с VT Monitor: общий watchlist, единый badge, shared settings

---

## Not planned

- Юридическое консультирование / оценка обоснованности жалобы
- Автоматическая отправка counter-notice (только шаблоны + ручное копирование)
- Свой бэкенд для агрегации (кроме возможного прокси для GSC OAuth в v2)
- Платные фичи / пейволл
- Массовый рынок (инструмент вебмастера, не для обычных пользователей)
- Real-time DMCA alerts через GTR (фундаментально невозможно — данные обновляются раз в месяц)
- Lumen primary mode (selective researcher approval делает невозможным для massmarket)
