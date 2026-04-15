# DMCA Watch — Спецификация продукта v1.0

> Статус: **draft** — pivot после Phase 0 source spike (2026-04-14), есть открытые вопросы (см. §16)
>
> Проверено 2026-04-14: Google Transparency Report (GTR) отдаёт публичный undocumented v3 JSON API без auth/cookies. Lumen Database переведён в роль optional secondary enrichment (требует researcher token). Google Search Console для DMCA-данных не подходит и убран из v1.
>
> Landing: [dmca.cam](https://dmca.cam)

---

## 1. Продукт

Браузерное расширение для вебмастеров: **аудит и история DMCA-жалоб** против собственных доменов с pattern-detection по reporters / copyright owners.

**Что делает:**
- Watchlist доменов с автоматической фоновой проверкой по расписанию через Google Transparency Report
- Badge на иконке расширения — индикатор «есть новые жалобы» (новые относительно прошлой проверки) для текущего сайта
- Side panel с деталями: кто подал жалобу (reporter), от чьего имени (copyright owner), сколько URL удалено, дата, ссылки на источник
- Sender Forensics Card: top reporters / owners против домена + sparkline помесячной активности — увидеть, кто из «копирайт-троллей» бьёт по сайту систематически
- Drawer с counter-notice шаблонами и AI-промптами (DMCA 17 U.S.C. §512(g))
- Welcome wizard: краткое объяснение что показывает GTR + первый домен (без токенов и аккаунтов)
- Optional: Lumen secondary enrichment для пользователей с researcher token (per-URL list + raw notice text)

**Чем не является:**
- Не early-warning system. **Данные GTR обновляются Google примерно раз в месяц, отставание ~30-60 дней от реального события.** Если URL удалён сегодня — увидим через месяц или два. Pitch продукта — *retrospective audit*, не *real-time alerting*.
- Не юридический сервис, не автоматический генератор counter-notice
- Не блокировщик/антивирус, не аналитика трафика
- Инструмент вебмастера — живёт рядом с VirusTotal Domain Monitor, Redirect Inspector, CookiePeek, Geo Tier Builder

**Landing:** [dmca.cam](https://dmca.cam)

**CWS-категория:** Developer Tools

---

## 2. Целевая аудитория

Вебмастера и владельцы сайтов, которые:
- Хотят знать **полную историю DMCA-жалоб** против своих доменов в одном месте, без ручного хождения на transparencyreport.google.com per-domain
- Расследуют конкретного «копирайт-тролля», который бьёт по нескольким их сайтам подряд — нужны pattern-detection и сравнение reporters / copyright owners
- Уже потеряли позиции в поиске и хотят понять, что именно произошло, кто именно подал жалобы, какие URL были удалены
- Ведут несколько доменов и хотят единый дашборд DMCA-активности по портфелю
- Готовят counter-notice и нужны заготовки шаблонов §512(g)

**Прямо НЕ подходит для:**
- Real-time мониторинг DMCA-атак (фундаментально невозможно через GTR — данные отстают на ~30-60 дней; см. §4)
- Тех, кому нужен полный список удалённых URL — GTR API публикует только counts; per-URL list требует optional Lumen secondary с researcher token

---

## 3. Зачем это нужно (контекст проблемы)

Фейковые DMCA-жалобы — массовая индустрия: «копирайт-тролли», конкуренты-чернушники, репутационные атаки. Стандартный эффект — URL выпиливается из Google поиска без уведомления владельца. Если владелец не узнал о жалобе и не подал counter-notice вовремя, URL остаётся выпиленным навсегда.

Google публикует данные о копирайт-removals в **Google Transparency Report** на `transparencyreport.google.com/copyright`. Эта база накрывает 95%+ копирайт-жалоб против Google Search с 2011 года. Данные обновляются примерно раз в месяц.

Параллельно Google пересылает большинство жалоб в **Lumen Database** (Berkman Klein Center, Harvard) — там доступны raw тексты notices, including полный список удалённых URL. Доступ к Lumen API требует researcher credentials, выдаётся выборочно.

DMCA Watch — это monitoring + history layer над GTR (primary, бесплатно, no auth) с optional Lumen enrichment для пользователей с researcher token. Real-time alerts невозможны через эти источники; продукт фокусируется на **retrospective discovery** («какие удары я уже пропустил»), **pattern detection** («кто меня бьёт системно») и **portfolio tracking** («что происходит с моими доменами в сумме»).

---

## 4. Источники данных

### Primary (v1): Google Transparency Report — undocumented v3 JSON API

**База:** `transparencyreport.google.com/transparencyreport/api/v3/copyright/`

GTR — публичная Google Transparency Report. SPA на `transparencyreport.google.com/copyright/domains/<domain>` грузит данные через серию JSON endpoints, undocumented но стабильных (используются продакшен SPA Google). Подтверждено 2026-04-14 через network probe реального тестового домена.

**Endpoints:**

| Endpoint | Параметры | Назначение |
|---|---|---|
| `domains/detail` | `?domain=X` | сводка по домену: total requests, total URLs removed, totals по периодам |
| `requests/summary` | `?size=N&domain=X[&start=cursor]` | пагинированный список жалоб против домена: `[id, ts, [reporter], urls_in_request, urls_not_in_index, [owner], urls_removed]` |
| `reporters/summary` | `?size=N&domain=X` | топ reporting orgs против домена с total counts и last activity timestamps |
| `owners/summary` | `?size=N&domain=X` | топ copyright owners против домена с total counts и last activity timestamps |
| `overview/urlsremoved` | `?domain=X` | weekly time series для sparkline: `[[ts_ms, [[count]]], …]` |

**Формат ответа:** Google's anti-XSSI prefix `)]}'\n`, далее JSON позиционные массивы (positional, not keyed). Extractor должен использовать position-based mapping. Schema стабильна между доменами.

**Auth:** не требуется. Ни cookies, ни tokens, ни referer, ни origin headers. Прямой fetch с любого клиента.

**CORS:** API не отдаёт `Access-Control-Allow-Origin`. Из обычного web-context fetch блокируется браузером. Из background service worker WebExtension с `host_permissions` на `transparencyreport.google.com` CORS bypass'ится — это стандартное MV3 поведение, проверено на VT Monitor с другими endpoints.

**Pagination:** `requests/summary` отдаёт opaque base64 cursor в last array. Передаётся обратно как `&start=<cursor>` для следующей страницы. Размер страницы фиксируется в cursor — менять `size` между страницами не безопасно.

**Throttle:** Google CDN, документированных лимитов нет. v1 default — 5 секунд между запросами (12 req/min) per installation, daily soft cap 1000 запросов. Conservative относительно реальной capacity, но мы не один пользователь у Google CDN — лимит на стороне нашей вежливости, не их брокенности.

**Freshness — фундаментальная дыра:**

Latest data point в GTR API на момент Phase 0 spike (2026-04-14) для тестового домена — `2026-02-07`. Bulk dataset (`storage.googleapis.com/transparencyreport/copyright/{domains,requests}.csv`) `Last-Modified: 2026-02-11`. Совпадает: Google обновляет копирайт-данные **примерно раз в месяц**, отставание реальных событий от появления в GTR — **30-60 дней**.

Это рушит сценарий «знай о жалобе до того, как просядет трафик». К моменту, когда GTR покажет новую жалобу, URL уже месяц-два как удалён из Google и трафик уже потерян. Продукт фундаментально retrospective, не proactive.

Disclosure обязательна в:
- Welcome wizard (visible explainer на первом шаге)
- Settings drawer / Source status section
- README + landing page
- Store listing description

**ToS:** GTR — публичная Transparency Report Google, ToS от обычных Google Terms. Никаких research-restrictions в духе Lumen. Программный доступ к публичным endpoint'ам Google разрешён в рамках общей политики rate limits и good-citizen behavior. Bulk redistribution не делаем — мы только показываем пользователю его собственные домены в его собственном браузере.

**Per-URL data limitation:** GTR API возвращает только COUNTS удалённых URL (например, «12 URLs removed in this request»), но **не сами URL**. Это намеренное решение Google — публиковать список infringing URLs было бы по сути directory of pirated content. Per-URL list доступен только через optional Lumen secondary (см. ниже).

### Secondary (v1, optional): Lumen Database — researcher API

Lumen используется как **дополнительный enrichment layer** для пользователей, у которых уже есть Lumen researcher token. Активируется опционально через Settings drawer; по умолчанию выключен.

**Что добавляет Lumen, чего нет в GTR:**
- Per-URL list для каждой жалобы (поле `targeted_urls[]` в Complaint становится непустым)
- Raw notice text (для investigation против abusive senders)
- Cross-recipient view (Lumen агрегирует жалобы не только Google, но и Twitter / GitHub / Twitch / etc — GTR только Google Search)
- Дополнительные dimensions для sender forensics (top targeted hosts, top cited source URLs, jurisdictions)
- Source health check (HTTP status + Archive.org snapshot для cited source URLs)

**ToS-контракт (проверено 2026-04-11, актуально):**

Источники: [Lumen API Documentation wiki](https://github.com/berkmancenter/lumendatabase/wiki/Lumen-API-Documentation), [API Terms of Use](https://lumendatabase.org/pages/api_terms), [Researchers page](https://lumendatabase.org/pages/researchers).

**Ключевые положения, дословно:**

- **Search без токена запрещён:** "Requests for notice data or searches through the API are not permitted without an Authentication Token."
- **Аутентифицированный throttling:** "approximately one request per second" — сервер возвращает `429 Too Many Requests` при превышении.
- **Research Purpose only:** "Users of the Lumen API, whether using an Authentication Token or not, must agree that they are a Researcher and will limit their use to Research Purposes only."
- **Кому выдают credentials:** "Lumen generally issues Lumen researcher credentials only to people or non-profit organizations planning journalistic, academic, or legislative policy-focused public written research outputs."
- **Что считается Research Purpose (широко):** "to compare trends involving removal requests; to understand what types of content are subject to removal requests; to determine how parties make or respond to such requests; and for other purposes reasonably aimed at gaining knowledge about legal complaints and requests for removal of online materials."
- **Bandwidth:** prohibited "use of an unreasonable amount of bandwidth"
- **Redistribution:** "individual notice texts remain under the terms set by the submitter; bulk redistribution of raw data may require permission"
- **Downstream usage:** "should you follow any link returned by the API, your use of the resulting content will be limited to non-infringing and/or fair use under copyright law"
- **Revocation:** "Lumen reserves the right to eliminate access to the API to anyone for any reason"

**Формальный отказ (2026-04-14):** В прямой переписке с Lumen staff выяснено, что мониторинг собственных доменов **не является** granted use case: *"Businesses interested in takedown notices referencing their sites that have been sent to other OSPs, such as Google, should investigate webmaster and/or Search Console tools, or contact those OSPs directly."* Public no-token access ограничен **1 notice per email per 24 hours** без планов на расширение. Lumen сам направляет такую категорию пользователей к GSC — что совпадает с нашим v2 roadmap. Это окончательно закрепляет Lumen secondary как фичу для пользователей, у которых **уже есть** токен, полученный по другому research purpose (journalism/academic/legislative/policy). Полный текст ответа — `temp/lumen-denial-2026-04-14.txt` (gitignored). Не отправляем пользователей в researcher application flow ни из welcome wizard, ни из settings.

**Импликации для DMCA Watch v1 secondary mode:**

| Модель | ToS compatibility | Вердикт для v1 secondary |
|---|---|---|
| **Per-user token, клиент → Lumen напрямую** | Каждый user — отдельный researcher, свой токен, свои запросы для своих доменов. Ровно research purpose. | ✅ **v1 optional secondary** |
| **Tokenless HTML scraping** | Прямо запрещено: "searches...not permitted without an Authentication Token". | ❌ **killed** |
| **Центральный CF-cache с нашим токеном** | "Bulk redistribution of raw data may require permission". | ⚠️ **parked** до явного permission от Lumen |

**Активация Lumen в DMCA Watch:** в Settings drawer есть toggle "Enable Lumen enrichment". При включении пользователь вставляет researcher token. Token хранится в `chrome.storage.sync` как и раньше. Throttle для Lumen — отдельный, 10s между запросами (как в первоначальном плане), отдельный budget counter.

Без активного Lumen secondary продукт работает полностью — просто complaint cards показывают URL counts вместо URL lists, и sender drawer не имеет некоторых dimensions. Lumen — pure upgrade, не gate.

**Disclosure требований Lumen:** Welcome wizard НЕ упоминает Lumen на главных шагах — это advanced feature. В Settings drawer при активации toggle показывается explainer:
- Researcher token нужен и выдаётся выборочно
- Approval может занять дни-недели
- Часть запросов получает отказ
- UI работает без токена, monitoring работает без токена, Lumen — это только enrichment

### Killed / out of v1

- **Lumen primary mode** — убит после Phase 0. Селективность researcher approval (дни-недели + часть отказов) делает продукт неприменимым для massmarket. См. полную аргументацию ниже.
- **Lumen tokenless scraping** — прямой конфликт с ToS, убит ещё в раунде 2026-04-11.
- **Google Search Console primary** — рассмотрен в Phase 0 spike (2026-04-14), убит. URL Inspection API возвращает `verdict / indexingState / coverageState`, но ни одно из полей не различает «removed by DMCA» от других причин не-индексации. Search Analytics — это clicks/impressions, симптом, не сигнал. DMCA-notifications в GSC приходят пользователю как Messages во внутренний inbox — этих сообщений в публичном API нет.
- **Cloudflare worker proxy** — для GTR не нужен (CORS обходится через host_permissions, нет токена для брокерства), для Lumen остаётся parked до permission.

### v2 candidates (не в v1)

- **GSC OAuth + Messages scraping** — единственный путь к real-time DMCA detection. Требует web UI scraping или undocumented Messages endpoint reverse engineering. Сложный, требует OAuth flow и content script на `search.google.com/search-console/*`. Нужен для пользователей, которым критична свежесть.
- **GTR direct request page deep-link** — если Google добавит per-request UI на GTR, мы сможем линковать на конкретную жалобу вместо domain page.
- **Bulk CSV server-side index** — для массивных доменов с >100k жалоб может потребоваться пред-индексация bulk dataset на стороне сервера (33GB). Только если мы решим выйти за наш «no backend» принцип.
- **Лимиты исключения:** GTR показывает только Google Search delistings. Жалобы, отправленные в Twitter/GitHub/Twitch/etc., не попадают в GTR — для них нужен Lumen.

---

## 5. Хранилище

### chrome.storage.local — данные

```typescript
// Ключ: "domains"
// Значение: Record<string, DomainRecord>

interface DomainRecord {
  domain: string;              // нормализованный hostname (ключ)
  watchlist: boolean;          // true = авто-проверки, false = ad-hoc кеш
  added_at: number;
  last_checked: number;        // timestamp нашей последней проверки источника
  complaints: Complaint[];     // найденные жалобы (сорт. по дате убыв.)
  last_seen_complaint_id: string | null;  // последний complaint id, который пользователь видел в Current Site
  new_count: number;           // жалоб, не просмотренных пользователем
  status: 'clean' | 'has_complaints' | 'has_new' | 'pending' | 'unknown';
}

interface Complaint {
  id: string;                  // ID из источника. GTR: Request ID. Lumen: notice id.
  source: 'gtr' | 'lumen';     // primary GTR, optional secondary Lumen
  date: number;                // timestamp жалобы (UTC ms)
  sender: string;              // GTR: reporting organization name. Lumen: sender name.
  principal: string | null;    // GTR: copyright owner name. Lumen: principal name. null если не указан.
  urls_removed: number;        // GTR primary поле — сколько URL удалено по этой жалобе
  urls_total: number;          // GTR: urls_in_request. Lumen: derived from notice payload.
  targeted_urls: string[];     // ПУСТОЙ для GTR (per-URL list недоступен), populated только когда Lumen secondary активен и обогатил жалобу
  jurisdiction: string | null; // GTR: всегда 'DMCA' (GTR публикует только DMCA). Lumen: из notice type.
  source_url: string;          // canonical link на источник: GTR per-domain page или Lumen notice page
  dismissed_by_user: boolean;  // пользователь отметил как «разобрался»
  notes: string | null;        // пользовательские заметки
}

// Ключ: "source_usage"
// Значение: { gtr: { count, date }, lumen: { count, date } }

// Ключ: "sender_profiles"
// Значение: Record<string, SenderProfile>

interface SenderProfile {
  sender_name: string;
  source: 'gtr' | 'lumen';         // какой источник дал данные; GTR-native в v1 default
  fetched_at: number;              // cache timestamp, 0 если ещё не загружен
  status: 'fresh' | 'loading' | 'error' | 'stale';
  error: string | null;
  total_notices: number;           // GTR: total count из reporters/summary entry. Lumen: meta.total_entries.
  sampled_notices: number;         // только для Lumen (с GTR sample == total)
  first_activity: number | null;   // earliest timestamp seen
  last_activity: number | null;    // latest timestamp seen (для GTR — последний `last_activity` из reporters/summary)
  monthly_counts: Array<{ month: string; count: number }>; // YYYY-MM. Для GTR — derived from overview/urlsremoved.
  // GTR-native:
  top_target_domains: Array<{ domain: string; count: number }>; // другие домены, которые этот reporter атакует
  // Lumen-only (пустые когда source === 'gtr'):
  top_principals: Array<{ name: string; count: number }>;
  top_recipients: Array<{ name: string; count: number }>;
  top_target_hosts: Array<{ host: string; count: number }>;
  top_source_urls: Array<{ url: string; count: number }>;
  jurisdictions: Array<{ name: string; count: number }>;
  source_health: SourceHealth[];
}

interface SourceHealth {
  url: string;
  checked_at: number;
  http_status: number | null;      // null = unreachable
  archive_last_snapshot: number | null;
  archive_snapshot_url: string | null;
  error: string | null;
}
```

Sender profiles TTL: 24 часа (`SENDER_PROFILE_TTL_MS`). GTR-native sender profile использует `reporters/summary` (или `owners/summary`, в зависимости от типа sender'а) — данные приходят сразу, без sampling. Lumen-secondary path сохраняет старый sample-based подход (5 страниц × 100 = 500 sampled).

### chrome.storage.sync — настройки

```typescript
// "lumen_api_token"       → string | null   (опционально для активации Lumen secondary enrichment)
// "lumen_enabled"         → boolean (default: false)  опционально enriches GTR жалобы Lumen-данными
// "check_interval_hours"  → number (default: 24)
// "theme"                 → 'dark' | 'light' | 'auto'
// "pause_until"           → number | null
// "excluded_domains"      → string[]
// "notify_on_new"         → boolean (default: true)
```

**Жизненный цикл DomainRecord:**
- **Add to watchlist** → создать `watchlist: true`, очередь high
- **Ad-hoc cache** (посещение сайта) → создать `watchlist: false`, очередь low, 7-дневный cooldown
- **Promote** → `watchlist: false → true`
- **Remove** → удалить запись полностью
- **Check now** → переставить в очередь high

### Проекция жалобы на домен

`DomainRecord.complaints[]` хранит не raw API ответ, а **domain-scoped projection**:

- один элемент `Complaint` = одна жалоба источника для одного домена
- уникальный ключ внутри домена: `${source}:${id}`
- для GTR: source это `'gtr'`, id это Request ID; жалоба автоматически принадлежит этому домену потому что GTR API filtering on-server (см. §6)
- для Lumen secondary: source `'lumen'`, id это notice id; `targeted_urls[]` содержит только те URL из notice, чьи hostnames сматчились с этим доменом
- user-owned поля `dismissed_by_user` и `notes` принадлежат локальному projection и должны переживать re-fetch той же жалобы

---

## 6. Фоновая логика (background.ts)

### Алармы
```
chrome.alarms.create('watchlist-tick', { periodInMinutes: 60 })
```

Каждый час: домены из watchlist с `last_checked + interval_hours < now` → в очередь normal.

### Нормализация доменов
- lowercase, strip `www.`, hostname-only
- IDN → punycode для API-запросов; Unicode для отображения
- Игнор: `chrome://`, `about:`, extension pages, IP, localhost, `file://`, `data:`

### Очередь запросов

```
Priorities:
  high   — user-initiated (Check now, Add to watchlist)
  normal — watchlist авто-обновление
  low    — ad-hoc кеш при посещении сайта

Guards:
  - Dedup: домен уже в очереди → пропустить
  - Cooldown: ad-hoc с last_checked < 7 дней → пропустить
  - Budget: см. §7
  - Pause: pause_until > now → не обрабатывать

Cycle (для каждого домена):
  1. Запрос к GTR primary по домену (см. ниже extraction pipeline)
  2. Если Lumen secondary активен — параллельно запрос в Lumen для enrichment
  3. Diff с существующими complaints → выделить новые
  4. Обновить DomainRecord (complaints, last_checked, new_count, status)
  5. Инкрементировать source_usage
  6. Обновить badge (если домен = активная вкладка)
  7. Если новые жалобы + notify_on_new → browser notification
  8. setTimeout(throttle_interval) → следующий
```

### Q2 — GTR extraction pipeline (решение для v1)

GTR API отличается от Lumen радикально: filtering происходит на стороне сервера через `?domain=X` query parameter. Никакого client-side full-text search → URL extraction → hostname matching не нужно. SPA Google уже сделала всю эту работу.

**Pipeline для GTR:**

1. **Подготовка query**
   - domain = punycode-форма (для IDN)
   - если Unicode-форма отличается, делаем второй запрос по Unicode-варианту, сливаем результаты по `id`
   - exact domain only — GTR API не поддерживает subdomain expansion, и v1 этого не хочет

2. **Запрос к requests/summary — с пагинацией и overlap-stop стратегией**
   - First page URL: `https://transparencyreport.google.com/transparencyreport/api/v3/copyright/requests/summary?size=10&domain=<query>`
   - **Subsequent pages URL:** `https://transparencyreport.google.com/transparencyreport/api/v3/copyright/requests/summary/page?size=10&domain=<query>&p=<cursor>` — **обрати внимание:** suffix `/page`, param name `p=` (не `start=`), это проверено live 2026-04-15 через sniff SPA traffic + curl verify
   - response prefix `)]}'\n` → strip → JSON parse → `cp.rrsr` → `wrapper[1]` = entries, `wrapper[2]` = pagination meta
   - **Pagination meta positional shape (verified live 2026-04-15):**
     - `[0]` = previous page cursor (null на page 1)
     - `[1]` = **next page cursor** (то что передаём в следующий `/page` вызов)
     - `[2]` = last page cursor
     - `[3]` = current page number (1-indexed)
     - `[4]` = total page count
   - **Важно:** изначальная Phase 2 имплементация читала `[2]` как next cursor — это was wrong, `[2]` это LAST page, что вызывало либо нулевой прогресс либо instant jump на последнюю страницу. Правильный индекс — `[1]`. End-of-list определяется тремя проверками: `entries.length < GTR_REQUESTS_PAGE_SIZE` OR `currentPage >= totalPages` OR `nextCursor === cursor` (guard против loops).
   - **Pagination loop** (реализация в `gtr-client.ts: searchGtrComplaintsByDomain`):
     - Клиент получает `knownKeys: Set<string>` — множество уже существующих complaint keys из `DomainRecord.complaints` для этого домена
     - **First fetch (knownKeys пустой):** качает до `GTR_MAX_PAGES_PER_FETCH` (default 10 = 100 complaints)
     - **Refresh (knownKeys непустой):** качает пока не встретит хотя бы один entry с key ∈ knownKeys → overlap-stop; это значит что мы догнали локальную историю снизу и больше нет unseen жалоб
     - Hard cap в обоих режимах: `GTR_MAX_PAGES_PER_FETCH`. Короткий throttle 1s между страницами внутри одного fetch (inter-item THROTTLE_MS=5s остаётся).
     - Return: `{ complaints, pagesFetched, stoppedBy }` где `stoppedBy` ∈ `'overlap' | 'end-of-list' | 'max-pages'`
   - `pagesFetched` передаётся в `incrementSourceUsageBy('gtr', n)` — usage counter учитывает каждый запрос, не каждый fetch
   - **История не теряется:** `mergeComplaints` в `background.ts` делает UNION previous ∪ incoming, а не replace. Если какая-то ранее виденная жалоба не попала в свежий ответ (выпала из top-N после новых), она всё равно остаётся в `DomainRecord.complaints`.
   - **Практический эффект:** для low-volume доменов (<100 исторических жалоб) первый fetch берёт всю историю. Для high-volume — берёт 100 самых свежих, и каждый refresh добавляет новые сверху. История растёт со временем и никогда не усекается локально.

3. **Извлечение Complaint полей из positional array**

   Каждый entry: `[id, ts_ms, [reporter_type, reporter_id, reporter_name], urls_in_request, urls_not_in_index, [owner_type, owner_id, owner_name], urls_removed]`

   | Field | Origin | Notes |
   |---|---|---|
   | `id` | `entry[0]` (string) | matches Request ID в bulk CSV |
   | `source` | constant `'gtr'` | |
   | `date` | `entry[1]` (number ms) | UTC milliseconds |
   | `sender` | `entry[2][2]` (string) | reporting organization name |
   | `principal` | `entry[5][2]` (string \| null) | copyright owner name |
   | `urls_total` | `entry[3]` (number) | URLs in the original request |
   | `urls_removed` | `entry[6]` (number) | actually removed by Google |
   | `targeted_urls` | empty array | not in API response — populated only if Lumen secondary enriches |
   | `jurisdiction` | constant `'DMCA'` | GTR — DMCA only |
   | `source_url` | constructed | `https://transparencyreport.google.com/copyright/owners/?id=<owner_id>` (см. ниже) |

4. **source_url construction**

   GTR не имеет per-request URL — нет страницы для отдельной жалобы. Лучшее, что можно дать пользователю как «ссылка на источник»:
   - если есть `owner_id`: `https://transparencyreport.google.com/copyright/owners/?id=<owner_id>`
   - else если есть `reporter_id`: `https://transparencyreport.google.com/copyright/reporters/?id=<reporter_id>`
   - fallback: `https://transparencyreport.google.com/copyright/domains/?domain=<domain>`

5. **Никакого hostname matching** — все жалобы из ответа API уже относятся к этому домену. Это серверный contract.

### Q2 — Lumen secondary extractor (если активен)

Когда Lumen enrichment включён, дополнительно делаем поиск по Lumen API и обогащаем GTR-жалобы. Lumen использует full-text search → URL extraction → hostname matching pipeline (как в исходном спеке):

1. **Search terms**
   - основной query term = ASCII/punycode-версия домена
   - exact search предпочтителен, sort `date_received desc`

2. **Из response извлекаются candidate URLs по `notice.type`:**

   | `notice.type` | Path |
   |---|---|
   | `DMCA`, `Counternotice` | `works[].infringing_urls[].url` |
   | `CourtOrder` | `works[].targetted_urls[].url` |
   | `DataProtection` | `works[].urls_mentioned_in_request[].url` |
   | `Defamation` | `works[].defamatory_urls[].url` |
   | `Other` | `works[].problematic_urls[].url` |
   | `PrivateInformation` | `works[].urls_with_private_information[].url` |
   | `LawEnforcementRequest` | `works[].urls_in_request[].url` |
   | `GovernmentRequest` | `works[].urls_mentioned_in_request[].url` (verify on real response) |
   | `Trademark` | `marks[].infringing_urls[].url` (verify on real response) |

3. **Filter:** drop `No URL submitted` и пустые; lowercase + punycode + strip `www.`; exact hostname match.

4. **Notice считается относящимся к домену только если** хоть один targeted URL сматчился — иначе drop.

5. **Merge с GTR-жалобами:**
   - попробовать сматчить Lumen notice с GTR Complaint по `(date, sender, principal)` heuristic — Request ID и Lumen notice ID разные, прямого join нет
   - если нашёлся — обогатить GTR Complaint полями `targeted_urls`, опциональный `lumen_notice_url`
   - если не нашёлся — добавить как отдельный Complaint c `source: 'lumen'` (cross-recipient жалобы, которые в GTR не попали)

### Q3 — dedup и merge (решение для v1)

Нормализация результата для одного домена:

- primary complaint key = `${source}:${id}`
- GTR жалобы и Lumen жалобы могут описывать одно и то же событие, но dedup-key разный — это fine. Junction между ними делается опционально через heuristic merge выше; даже без merge один и тот же event покажется как два rows, что приемлемо для v1.
- если тот же notice найден повторно:
  - source-derived поля (`date`, `sender`, `principal`, `jurisdiction`, `source_url`, `urls_removed`, `urls_total`, `targeted_urls`) обновляются из свежего ответа
  - user-owned поля (`dismissed_by_user`, `notes`) сохраняются из предыдущей локальной записи

Diff и seen-state:

- **новые жалобы** определяются по diff множеств complaint keys между старым и новым `complaints[]`
- `last_seen_complaint_id` — UI anchor, не diff mechanism
- при открытии `Current Site` он ставится в id самой новой жалобы, а `new_count` сбрасывается в `0`
- если после refresh anchor `last_seen_complaint_id` больше не найден, это не должно само по себе превращать весь список в "new"; source diff всё равно считается по keys

**Статус решения:** принять как v1 contract. GTR pipeline проверять на реальных доменах с known жалобами. Lumen extractor table остаётся неутверждённой до реального tokened sample.

### Обработка ошибок
- **GTR network error / 5xx** → retry 30s, макс. 3 попытки
- **GTR 429** → pause очереди на 60s, retry
- **Lumen 401/403** → пометить `lumen_api_token` как invalid, поставить Lumen в состояние "action required", показать CTA в Settings, ПРОДОЛЖИТЬ работу через GTR primary (Lumen — opcional, не gate)
- **Lumen 429** → pause Lumen-очереди на 60s, retry; GTR продолжает работать
- Сетевая ошибка → retry 30s, макс. 3 попытки
- **GTR никогда не gate'ит UI** — нет токена, нет setup, нет invalid состояния. Если GTR упал, просто показываем "GTR unreachable, retry later" и watchlist остаётся видимым с прошлыми данными.

---

## 7. Budget / Throttle

### GTR primary

- **Throttle:** 1 запрос каждые 5s (12 req/min). Google CDN, документированных лимитов нет, conservative.
- **Watchlist резерв:** 80% дневного бюджета
- **Ad-hoc:** блокируется при 80% использованного бюджета
- **Hard cap:** всё кроме explicit «Check now» блокируется при 95%
- **Daily budget:** 1000 запросов (hard cap 1200). Реалистично один пользователь с watchlist в 50 доменов и 24h interval делает ~50 запросов/сутки — запас 20×.
- Счётчик сбрасывается в полночь UTC

### Lumen secondary (когда активен)

- **Throttle:** 1 запрос каждые 10s (6 req/min) — намеренно в 10× консервативнее официального лимита 1 req/s, чтобы не попасть под "unreasonable amount of bandwidth"
- **Daily budget:** 500 запросов (как в оригинальном Lumen-primary плане)
- Счётчик отдельный от GTR

### Sender forensics

Sender profile lookup идёт через ту же общую очередь, kind: 'sender'. Throttled вместе с domain lookups (shared GTR budget когда GTR-native, shared Lumen budget когда Lumen-secondary).

---

## 8. Badge

| status | Цвет | Текст | Условие |
|--------|------|-------|---------|
| clean | `#22c55e` зелёный | `✓` | complaints.length === 0 |
| has_complaints | `#6b7280` серый | `i` | есть жалобы, все разобраны |
| has_new | `#ef4444` красный | `!` | `new_count > 0` |
| pending | `#3b82f6` синий | `…` | в очереди, ещё не проверен |
| unknown | `#6b7280` серый | `?` | нет данных / ошибка / unsupported page |

Табличные статусы выше описывают только **per-tab state**. Поверх них действует глобальный слой сигналов.

**Глобальные оверлеи:**
- `pause_until > now` → badge показывает `II` жёлтый поверх всего
- `queue_size > 0` и нет pause → badge показывает синий queue count
- Только если нет pause и нет queue overlay, рендерится per-tab status

**Приоритет рендеринга:**
1. Pause → `II` жёлтый
2. Queue count → синий numeric badge
3. Unsupported page → пустой badge
4. Нет записи в domains → пустой badge
5. `pending` → синий
6. `has_new` → красный
7. `has_complaints` → серый `i`
8. `clean` → зелёный
9. `unknown` → серый `?`

---

## 9. Welcome — онбординг-визард

3 шага. **Никаких токенов на главных шагах.** Lumen прячется в Settings drawer.

### Шаг 1/3 — Приветствие + честный disclosure
- Название продукта
- Одна строка ценности: «Историческая картина всех DMCA-жалоб против ваших доменов, без аккаунтов и токенов»
- Краткий explainer в одном параграфе:
  - Источник: Google Transparency Report — публичная база Google о копирайт-removals
  - Что показывает: кто подал жалобу, copyright owner, сколько URL удалено, дата
  - **Что НЕ показывает:** real-time alerts. Google обновляет данные раз в месяц, отставание реальных событий — ~30-60 дней. Это retrospective audit tool, не early warning system.
- Кнопка «Get started →»

### Шаг 2/3 — Первый домен
- Инпут `example.com`
- Кнопка «Add & Check now» или «Skip»
- Мини-tip: «We'll check this domain through Google Transparency Report. Results will appear in the side panel.»

### Шаг 3/3 — Готово
- «Setup complete! Open Monitor →»
- Подсказка: «Want per-URL details and richer sender forensics? Enable optional Lumen enrichment in Settings (requires a researcher token).»

Welcome повторно доступен из Settings → «Setup guide».

---

## 10. Side Panel — основной UI

Две вкладки + Settings drawer (как в VT Monitor v1.1).

**Default view:** `Current Site`, если у активной вкладки есть валидный домен; иначе `Watchlist`.

### Вкладка: Watchlist
Карточка домена:
- Имя (моноспейс)
- Статусная точка + счётчик `new_count` (если > 0)
- «Last checked: 2h ago» (с напоминанием — данные GTR ~30-60 дней позади реального времени)
- Последняя жалоба: `«DMCA from X — 3 days ago»` (показывает дату из source data, не дату fetch'а)
- Кнопки: «Check now», «Open» (раскрывает Current Site по этому домену), «Remove»

GTR не gate'ится никогда — список watchlist всегда видимый, refresh всегда возможен.

### Вкладка: Current Site
- Hostname активной вкладки
- Статусный блок:
  - Цветной индикатор + текст
  - Counter: «N complaints (K new)»
  - «Last checked: 2h ago» + freshness disclaimer («Source data ~30-60 days behind real time»)
- **Top contributors card** («Who is hitting this domain») — агрегация `record.complaints` на клиенте:
  - **Top reporters (top 5)** — по `complaint.sender`, отсортировано по count desc, tiebreak last_activity desc
  - **Top copyright owners (top 5)** — по `complaint.principal`, тот же sort
  - Каждое имя clickable → открывает sender drawer
  - Card скрыта если `record.complaints` пуст или ни одна жалоба не даёт owner (тогда только reporters показываются)
  - Не делает отдельный API-запрос — чистое локальное aggregation из уже-сохранённых complaints
- Список жалоб (карточки):
  - Дата (из source data), sender (reporter), principal (copyright owner), jurisdiction
  - **Counts:** «12 URLs removed / 14 in original request» (для GTR — это default UX)
  - **URL list:** показывается **только** если Lumen secondary активен И эту жалобу удалось обогатить URL'ами. Иначе строка «Per-URL list available with optional Lumen enrichment (Settings → Advanced)» — discoverable, не nag.
  - «View on Google Transparency Report ↗»
  - «View on Lumen ↗» (только когда есть Lumen URL — после enrichment)
  - «Mark as resolved» → `dismissed_by_user = true`
  - «Draft counter-notice» → открыть Dispute drawer
- Кнопка «Add to watchlist» (если ad-hoc)
- Кнопка «Check now»

Поведение new-state:
- при открытии `Current Site` для домена расширение автоматически сбрасывает `new_count` этого домена в `0`
- `dismissed_by_user` не влияет на факт "seen/unseen"
- отдельная кнопка `Mark all seen` в v1 не нужна

### Dispute drawer
- Шаблоны counter-notice (DMCA 17 U.S.C. §512(g))
- AI-промпты для адаптации под конкретный случай
- Контакты: Google DMCA counter-notice форма, шаблон письма хостеру
- Поле для заметок по жалобе

Структурированный workflow-статус (`drafted / submitted / resolved / escalated`) не входит в v1 storage contract и переносится в v2.x.

### Sender drawer (Sender Forensics Card)

Открывается кликом на `sender_name` (reporter) или на `principal` (copyright owner) из любого места, где отображается имя — complaint card на Current Site, top contributors card на Current Site, или watchlist. В v1 default — данные агрегируются **локально** из `DomainRecord.complaints` по всем watchlist-доменам, без дополнительных GTR запросов. Когда Lumen secondary активен и есть данные, добавляются Lumen-only sections.

Reactive через `storage.onChanged` — обновляется автоматически, когда background завершает fetch.

**Header:** sender / owner name, source label (`Aggregated from your watchlist via Google Transparency Report` или `Enriched with Lumen Database`)

**Meta block:**
- Total complaints across user's watchlist (sum из local aggregation)
- Activity range: first → last (derived locally из complaint dates)
- Fetched/snapshot timestamp + freshness disclaimer

**Body sections (v1, GTR-native, computed locally):**
1. **Activity (monthly)** — SVG спарклайн. Для GTR — derived из дат local complaints, сгруппированных по month. Только жалобы, где `sender === senderName` или `principal === senderName`.
2. **Also in your watchlist** — **killer feature:** список всех *других* watchlist-доменов, по которым этот reporter/owner бил, с per-domain counts и last_activity. Это самый сильный дифференциатор — pattern detection через user's own portfolio, которого ни GTR ни Lumen не дают в своих UI.

**Почему нет «global sender stats» или «notice samples per sender»:** в Phase 0/2 мы пробовали GTR endpoints с параметрами `reporter_id`, `owner_id`, `reporting_organization_id`, `copyright_owner_id` — ни один не фильтрует `requests/summary`. GTR API не экспонирует per-sender view, и SPA сайта Google тоже не имеет per-reporter deep-link страницы. Это жёсткое ограничение источника. Cross-watchlist aggregation — наш ответ, и он более action-oriented для вебмастера чем global stats были бы.

**Body sections (v1.x Lumen Power Pack, когда active):**
3. **Top principals** — от чьего имени подают, top N (5)
4. **Top recipients** — кого атакуют (Google / Twitter / GitHub etc.)
5. **Top targeted hosts** — агрегация hostname'ов из `works[].infringing_urls`
6. **Top cited source URLs** — что цитируют как «оригинал»
7. **Jurisdictions** — распределение по юрисдикциям
8. **Source health** — HTTP status + Archive.org last snapshot для top source URLs (опционально, триггерится кнопкой)

**Body sections (v1.x, Lumen secondary, когда активен):**
4. **Top principals** — от чьего имени подают, top N (5)
5. **Top recipients** — кого атакуют (Google / Twitter / GitHub etc.)
6. **Top targeted hosts** — агрегация hostname'ов из `works[].infringing_urls`
7. **Top cited source URLs** — что цитируют как «оригинал»
8. **Jurisdictions** — распределение по юрисдикциям
9. **Source health** — HTTP status + Archive.org last snapshot для top source URLs (опционально, триггерится кнопкой)

**Footer actions:**
- **Refresh** — force re-fetch (через `GET_SENDER_PROFILE { forceRefresh: true }`)
- **Check sources** — Lumen-only (когда активен)
- **Export JSON** — dump SenderProfile как dossier-файл `dmca-watch-sender-{name}.json`
- **View on Google Transparency Report** — external link на reporter/owner page
- **View on Lumen** — внешняя ссылка (только когда Lumen активен)

**Правило UI:** никакого label «fake» / «abuser» / «suspicious» / скоринга. Только нейтральные метрики — вывод делает пользователь.

**Сбор данных:** sender lookup идёт через ту же очередь (kind: 'sender'), throttled вместе с domain lookups (shared budget для активного источника).

### Settings drawer
- **Source status** — GTR statuses: `connected` / `unreachable` / `rate_limited`. Lumen statuses (только когда enabled): `not_configured` / `configured` / `invalid`.
- **Lumen enrichment toggle** (Advanced section)
  - Off by default
  - При включении показывается explainer о research token и process
  - Поле для Lumen API token
  - Кнопка «Verify & Save»
- **Check interval** (12h / 24h / 3d / 7d)
- **Pause mode**
- **Excluded domains**
- **Notify on new complaint** (toggle)
- **Theme**
- **Data:** export/import watchlist (JSON + CSV)
- **About** — версия + ссылка на freshness disclaimer

---

## 11. Визуальный стиль

Полное переиспользование CSS-системы VT Monitor / FastWeb / 301-ui:
- Цветовые токены из `@/assets/css/theme.css`
- Компоненты из `components.css`: `.btn`, `.input`, `.domain-card`, drawer shell
- Иконки: 301-ui mono sprite + Pictogrammers MDI
- **Правило проекта: никаких emoji** (см. CLAUDE.md)

---

## 12. Манифест

### Chrome/Edge
```jsonc
{
  "permissions": ["storage", "alarms", "tabs", "activeTab", "sidePanel", "notifications"],
  "host_permissions": [
    "https://transparencyreport.google.com/*",
    "https://lumendatabase.org/*",
    "https://archive.org/*"
  ],
  "side_panel": { "default_path": "sidepanel.html#sidebar" }
}
```

### Firefox
```jsonc
{
  "permissions": ["storage", "alarms", "tabs", "activeTab", "notifications"],
  "host_permissions": [
    "https://transparencyreport.google.com/*",
    "https://lumendatabase.org/*",
    "https://archive.org/*"
  ],
  "action": { "default_popup": "sidepanel.html" },
  "sidebar_action": {
    "default_panel": "sidepanel.html#sidebar",
    "default_icon": "icons/icon-48.png"
  }
}
```

**Общее:**
- `transparencyreport.google.com` — primary source, всегда нужен.
- `lumendatabase.org` — для optional secondary enrichment.
- `archive.org` — для Lumen source health check feature (когда активен).
- НЕ запрашиваем `<all_urls>` — никаких arbitrary host requests.
- Без `webRequest` / `declarativeNetRequest`.

---

## 13. Messaging Protocol

```typescript
type RequestMessage =
  | { type: 'CHECK_DOMAIN'; domain: string }
  | { type: 'ADD_DOMAIN'; domain: string }
  | { type: 'REMOVE_DOMAIN'; domain: string }
  | { type: 'CHECK_ALL' }
  | { type: 'DISMISS_COMPLAINT'; domain: string; complaintId: string }
  | { type: 'MARK_DOMAIN_SEEN'; domain: string }
  | { type: 'SAVE_COMPLAINT_NOTE'; domain: string; complaintId: string; notes: string | null }
  | { type: 'VERIFY_LUMEN_TOKEN'; token: string }       // переименовано из VERIFY_TOKEN
  | { type: 'SET_LUMEN_ENABLED'; enabled: boolean }     // новый: toggle для Lumen secondary
  | { type: 'GET_QUEUE_STATUS' }
  | { type: 'GET_SOURCE_STATUS' }
  | { type: 'PAUSE'; hours: number }
  | { type: 'RESUME' }
  | { type: 'OPEN_SIDEPANEL' }
  | { type: 'GET_SENDER_PROFILE'; sender_name: string; forceRefresh?: boolean }
  | { type: 'CHECK_SENDER_SOURCE_HEALTH'; sender_name: string };
```

Реактивное обновление UI через `chrome.storage.onChanged`.

---

## 14. Вне скоупа v1.0

- Real-time DMCA alerting (фундаментально невозможно через GTR — данные отстают на ~30-60 дней)
- Per-URL list жалоб без Lumen secondary (GTR API limitation: возвращает counts, не URLs)
- Автоматическая отправка counter-notice (только шаблоны + ручное копирование)
- Юридическое консультирование / анализ обоснованности жалобы
- Google Search Console integration (v2 — требует OAuth + GSC web UI scraping)
- Прокси/бэкенд для агрегации жалоб
- История изменений позиций в поиске
- Платные фичи / пейволл
- Множественные аккаунты Lumen
- Структурированные статусы dispute workflow (`drafted / submitted / resolved / escalated`)
- Переводы интерфейса (v1 только English, i18n-ready)
- Cross-reference между sender'ом и его другими атаковыми доменами с UI-навигацией (basic data есть, full feature — v1.x)

---

## 15. Порядок разработки

1. Скелет WXT + типы + storage + тема (переиспользовать из VT Monitor) — **готово**
2. `shared/gtr-client.ts` — primary client с probe реальных endpoints, position-based extractor
3. `shared/lumen-client.ts` — optional secondary, остаётся stub до реального tokened sample (как было)
4. `shared/queue.ts` — throttled queue (адаптация VT Monitor версии) — **готово**
5. `shared/alarm.ts`, `shared/badge.ts`, `shared/messaging/` — **готово**, минорные адаптации под новый source enum
6. `entrypoints/background.ts` — склейка GTR primary + опциональный Lumen secondary
7. `entrypoints/welcome/` — **переписать**: 3 шага без token entry на главной
8. `entrypoints/sidepanel/` — Watchlist + Current Site + Settings drawer (existing skeleton); адаптация complaint card UX (counts vs URL list)
9. `components/dispute-drawer.ts` — counter-notice шаблоны — **готово**
10. `components/sender-drawer.ts` — адаптация под GTR-native data + Lumen-secondary section
11. Тест на реальных доменах
12. Полировка, store listings, релиз

---

## 16. Открытые вопросы

### Q1: Primary source для v1 — ЗАКРЫТ (2026-04-14, Phase 0 spike)

Phase 0 проверила 3 кандидата. Результаты:

- **Lumen primary** — убит. Researcher token approval selective, занимает дни-недели, часть запросов получает отказ. Неприменимо для massmarket.
- **Google Search Console primary** — убит. URL Inspection / Search Analytics / Manual Actions API не различают «removed by DMCA» от других причин. DMCA-notifications в GSC inbox не публикуются в API.
- **Google Transparency Report primary** — ✅ **выбран**. Undocumented v3 JSON API на `transparencyreport.google.com/transparencyreport/api/v3/copyright/`. Public, no auth, stable schema, sender forensics native (`reporters/summary` + `owners/summary`). Цена: данные отстают на ~30-60 дней.

**Решение:**
- v1 primary: GTR public undocumented API
- v1 optional secondary: Lumen (как enrichment, не gate)
- v1 out: GSC, GSC OAuth, GSC scraping
- продуктовое позиционирование: retrospective audit + pattern detection (не early warning)

См. §4 для деталей.

### Q2: Как матчить жалобу на домен?
GTR pipeline: server-side filtering через `?domain=X`, никакого client-side matching. См. §6.

Lumen secondary pipeline: оригинальная full-text search → URL extraction → hostname compare. См. §6.

Статус: GTR pipeline проверять на реальных доменах в Phase 2. Lumen extractor таблица остаётся неутверждённой до реального tokened sample.

### Q3: Как дедуплицировать жалобы?
- dedup key = `${source}:${id}`
- GTR Request ID и Lumen notice ID разные, прямой join невозможен. Optional heuristic merge по `(date, sender, principal)` для UI-чистоты, см. §6.

### Q4: Badge "has_new" — как сбрасывается?
Автоматически, когда пользователь открыл Current Site этого домена. См. §10.

### Q5: Privacy + CWS review
Расширение не отправляет данные пользователя на собственный backend. Делает запросы:
- к Google Transparency Report (всегда)
- к Lumen Database (только если пользователь явно включил Lumen secondary и предоставил researcher token)
- к Archive.org (только если пользователь нажимает "Check sources" в sender drawer + Lumen активен)

Это нужно явно описать в store listing + PRIVACY.md.

### Q6: Нужен ли собственный backend?
В v1 — нет. Все запросы с клиента напрямую в GTR / Lumen / Archive.org.

### Q7: Название → **DMCA Watch** (решено 2026-04-10)
Домен `dmca.cam` зарегистрирован, будет основным лэндингом.

### Q8: Дженерик или только Google?
GTR primary = только Google Search delistings (это всё, что GTR публикует).

Lumen secondary, когда активен, добавляет cross-recipient жалобы (Twitter, GitHub, Twitch и др.) — Lumen не ограничен Google.

В v1 не фильтруем по получателю — показываем всё, что касается домена из любого активного источника.

### Q9: Где визуально размещать freshness disclaimer? (новый, Phase 1)

Варианты:
- **(a)** Только Welcome wizard step 1 + Settings → About — минимально, ненавязчиво
- **(b)** Welcome + Settings + tooltip над `last_checked` в Current Site/Watchlist карточках — больше частота, риск шума
- **(c)** Welcome + Settings + persistent footer banner в side panel — максимально честно, риск надоесть

Предложение: **(b)**. Tooltip — discoverable, не ест место, упоминается там, где timestamps релевантны. Решение — за пользователем.

### Q10: GTR endpoint stability monitoring (новый, Phase 1)

GTR API undocumented. Google может изменить shape или сломать endpoints в любой момент без предупреждения. Нужен defensive approach в `gtr-client.ts`:
- log version detection (сравнить shape ответа с expected)
- graceful degradation: если parse fails, помечать source как `unstable`, показывать в Settings, предлагать Lumen secondary как fallback
- не падать, не очищать существующие данные при API breakage

Phase 2 решает реализацию.
